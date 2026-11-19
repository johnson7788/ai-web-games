import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, TILE, buildGrid, waveComposition } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

const SOLID = new Set([TILE.BRICK, TILE.ROCK, TILE.STEEL]);

test('初始状态：玩家在出生点、面向正上、phase=playing', () => {
  const r = createRun(1);
  const p = r.state.player;
  assert.equal(r.state.phase, 'playing');
  assert.equal(p.c, GAME.PLAYER.spawn[0]);
  assert.equal(p.r, GAME.PLAYER.spawn[1]);
  assert.equal(p.dir, 0);
  assert.equal(p.team, 0);
});

test('初始网格尺寸为 13x13 且出生点/玩家行/核心位可通行', () => {
  const g = buildGrid(1);
  assert.equal(g.length, GAME.ROWS);
  assert.equal(g[0].length, GAME.COLS);
  for (const [c, r] of GAME.SPAWNS) assert.ok(!SOLID.has(g[r][c]), `spawn ${c},${r} 不能是固体`);
  assert.ok(!SOLID.has(g[GAME.PLAYER.spawn[1]][GAME.PLAYER.spawn[0]]), '玩家出生点不能是固体');
  assert.equal(g[GAME.CORE.pos[1]][GAME.CORE.pos[0]], TILE.EMPTY, '核心位是实体，不是地形砖');
});

test('第 1 波不含岩石/钢墙；第 2 波出现岩石；第 3 波出现钢墙', () => {
  const g1 = buildGrid(1);
  const g2 = buildGrid(2);
  const g3 = buildGrid(3);
  const has = (g, t) => g.some((row) => row.includes(t));
  assert.ok(!has(g1, TILE.ROCK) && !has(g1, TILE.STEEL));
  assert.ok(has(g2, TILE.ROCK));
  assert.ok(has(g3, TILE.STEEL));
});

test('波次构成：L1 两个普通敌人，总数随关卡递增', () => {
  assert.equal(waveComposition(1).length, 2);
  assert.equal(waveComposition(2).length, 3);
  assert.equal(waveComposition(3).length, 4);
  assert.deepEqual(waveComposition(1), ['normal', 'normal']);
});

test('玩家移动一格后位置更新', () => {
  const r = createRun(1);
  r.setMove(0); // 上
  for (let i = 0; i < 20; i += 1) r.step(1 / 60);
  const p = r.state.player;
  assert.ok(p.r < GAME.PLAYER.spawn[1], '向上移动后行号减小');
});

test('玩家开火生成子弹并发出 shoot 事件', () => {
  const r = createRun(1);
  const ok = r.fire();
  assert.equal(ok.ok, true);
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'shoot' && e.team === 0));
  assert.equal(r.state.bullets.length, 1);
});

test('子弹摧毁砖墙并发出 brickBreak', () => {
  const r = createRun(1);
  r.state.grid[3][6] = TILE.BRICK;
  r.state.bullets = [{ x: 6.5, y: 4.5, dx: 0, dy: -1, speed: 9, team: 0, alive: true }];
  for (let i = 0; i < 30; i += 1) r.step(1 / 60);
  assert.equal(r.state.grid[3][6], TILE.EMPTY);
  assert.ok(r.drainEvents().some((e) => e.type === 'brickBreak'));
});

test('岩石需两枪：第一枪变砖，第二枪才清空', () => {
  const r = createRun(1);
  r.state.grid[3][6] = TILE.ROCK;
  r.state.bullets = [{ x: 6.5, y: 4.5, dx: 0, dy: -1, speed: 9, team: 0, alive: true }];
  for (let i = 0; i < 20; i += 1) r.step(1 / 60);
  assert.equal(r.state.grid[3][6], TILE.BRICK, '岩石一枪后变砖');
  r.state.bullets = [{ x: 6.5, y: 4.5, dx: 0, dy: -1, speed: 9, team: 0, alive: true }];
  for (let i = 0; i < 20; i += 1) r.step(1 / 60);
  assert.equal(r.state.grid[3][6], TILE.EMPTY);
});

test('连击：连续击杀提升 combo 并发出 combo 事件', () => {
  const r = createRun(7);
  r.state.spawnQueue = [];
  r.state.aliveEnemies = 0;
  r.state.tanks = r.state.tanks.filter((t) => t.team === 0);
  const mk = (id, c, rr) => ({ id, team: 1, type: 'normal', c, r: rr, dir: 2, hp: 1, maxHp: 1, speed: 0, fireInterval: 99, fireCd: 99, moveTimer: 99, moving: false, fireHeld: false, alive: true, shieldUntil: 0, rapidUntil: 0, tripleUntil: 0, speedUntil: 0, score: 100 });
  r.state.tanks.push(mk(10, 6, 5), mk(11, 6, 4));
  r.state.aliveEnemies = 2;
  // 玩家向上连开两枪（子弹从 (6,10) 出发，分别命中 (6,5) 与 (6,4)）
  r.fire();
  for (let i = 0; i < 45; i += 1) r.step(1 / 60);
  r.fire();
  for (let i = 0; i < 45; i += 1) r.step(1 / 60);
  const evs = r.drainEvents();
  const kills = evs.filter((e) => e.type === 'kill').length;
  assert.ok(kills >= 2, `应至少两次击杀，实际 ${kills}`);
  assert.ok(evs.some((e) => e.type === 'combo' && e.combo >= 2), '连续击杀应触发 combo');
});

test('核心被击：coreHit 扣血，血量归零判负', () => {
  const r = createRun(1);
  r.state.player.c = 0;
  r.state.player.r = 0;
  r.state.player.shieldUntil = 0;
  r.state.core.hp = 1;
  r.state.bullets = [{ x: 6.5, y: 11.5, dx: 0, dy: 1, speed: 9, team: 1, alive: true }];
  for (let i = 0; i < 20; i += 1) r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'coreHit'));
  assert.ok(evs.some((e) => e.type === 'lose' && e.reason === 'core'));
});

test('玩家阵亡判负（lose: tank）', () => {
  const r = createRun(1);
  r.state.player.shieldUntil = 0;
  r.state.player.hp = 1;
  r.state.bullets = [{ x: 6.5, y: 10.5, dx: 0, dy: 1, speed: 9, team: 1, alive: true }];
  for (let i = 0; i < 20; i += 1) r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
});

test('清空一波后晋级并恢复核心血量', () => {
  const r = createRun(1);
  for (const t of r.state.tanks) if (t.team === 1) { t.alive = false; }
  r.state.tanks = r.state.tanks.filter((t) => t.alive);
  r.state.spawnQueue = [];
  r.state.aliveEnemies = 0;
  const before = r.state.level;
  const coreBefore = r.state.core.hp;
  r.step(1 / 60);
  assert.equal(r.state.level, before + 1);
  assert.ok(r.state.core.hp >= coreBefore, '过关应恢复核心血量');
  assert.ok(r.drainEvents().some((e) => e.type === 'win'));
});

test('mulberry32 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
});

test('护盾期间玩家不受子弹伤害', () => {
  const r = createRun(1);
  const p = r.state.player;
  p.hp = 3;
  p.shieldUntil = r.state.time + 5;
  r.state.spawnQueue = [];
  r.state.bullets = [{ x: 6.5, y: 10.5, dx: 0, dy: 1, speed: 9, team: 1, alive: true }];
  for (let i = 0; i < 20; i += 1) r.step(1 / 60);
  assert.equal(p.hp, 3, '护盾吞弹不掉血');
  assert.equal(r.state.phase, 'playing');
});
