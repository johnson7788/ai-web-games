import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { BOARD, GAME } from '../config/game.config.js';
import { LEVELS, totalEnemies } from '../config/levels.js';

const center = (c, r) => ({ x: BOARD.OX + c * BOARD.TILE + BOARD.TILE / 2, y: BOARD.OY + r * BOARD.TILE + BOARD.TILE / 2 });

function fireAt(run, c, r) {
  const p = center(c, r);
  run.state.bullets.push({ x: p.x, y: p.y, dir: 'down', owner: 'player' });
  run.step(1 / 60);
}

test('createRun：初始为 playing，网格 26×26，出生队列=总敌军', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.grid.length, BOARD.ROWS);
  assert.equal(run.state.grid[0].length, BOARD.COLS);
  assert.equal(run.state.spawnQueue.length, totalEnemies(LEVELS[0]));
  assert.equal(run.state.player.lives, GAME.PLAYER_LIVES);
});

test('mulberry32：同种子产出确定序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('移动：按住向上，玩家 y 减小（朝上走）', () => {
  const run = createRun(0, { seed: 2 });
  const y0 = run.state.player.y;
  run.setInput({ dir: 'up', fire: false });
  for (let i = 0; i < 10; i += 1) run.step(1 / 60);
  assert.ok(run.state.player.y < y0, '应该向上移动');
});

test('碰撞：砖墙挡路，玩家不能穿墙', () => {
  const run = createRun(0, { seed: 3 });
  const p = run.state.player;
  run.state.grid[22][4] = { t: 'brick', hp: 1 }; // 正上方一格设为砖
  p.y = center(4, 23).y;
  p.x = center(4, 23).x;
  const y0 = p.y;
  run.setInput({ dir: 'up', fire: false });
  for (let i = 0; i < 5; i += 1) run.step(1 / 60);
  assert.ok(Math.abs(p.y - y0) < 1, '不应穿过砖墙');
});

test('子弹：一发打碎砖墙', () => {
  const run = createRun(0, { seed: 4 });
  run.state.grid[10][5] = { t: 'brick', hp: 1 };
  fireAt(run, 5, 10);
  assert.equal(run.state.grid[10][5].t, 'empty');
});

test('岩石：两发才打碎，一发只掉血', () => {
  const run = createRun(0, { seed: 5 });
  run.state.grid[10][6] = { t: 'rock', hp: 2 };
  fireAt(run, 6, 10);
  assert.equal(run.state.grid[10][6].t, 'rock');
  assert.equal(run.state.grid[10][6].hp, 1);
  fireAt(run, 6, 10);
  assert.equal(run.state.grid[10][6].t, 'empty');
});

test('钢铁：子弹打不碎，砖块保留', () => {
  const run = createRun(0, { seed: 6 });
  run.state.grid[10][7] = { t: 'steel', hp: 1 };
  fireAt(run, 7, 10);
  assert.equal(run.state.grid[10][7].t, 'steel');
});

test('水域：子弹能飞过，坦克走不过', () => {
  const run = createRun(0, { seed: 7 });
  run.state.grid[10][8] = { t: 'water', hp: 1 };
  // 子弹越过水域
  run.state.grid[11][8] = { t: 'brick', hp: 1 };
  run.state.bullets.push({ x: center(8, 10).x, y: center(8, 10).y, dir: 'down', owner: 'player' });
  for (let i = 0; i < 12; i += 1) run.step(1 / 60);
  assert.equal(run.state.grid[11][8].t, 'empty', '子弹应飞过水域打碎下方砖');
});

test('子弹击毁敌军：连击 +1 并计入分数', () => {
  const run = createRun(0, { seed: 8 });
  run.state.spawnQueue = [];
  run.state.enemies = [];
  run.state.enemies.push({ id: 1, type: 'grunt', x: center(6, 12).x, y: center(6, 12).y, dir: 'up', hp: 1, speed: GAME.ENEMY_SPEED, fireCd: 9, alive: true, invuln: 0, moveT: 9, fireT: 9 });
  run.state.bullets.push({ x: center(6, 12).x, y: center(6, 12).y, dir: 'down', owner: 'player' });
  run.step(1 / 60);
  assert.equal(run.state.enemies[0].alive, false);
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.maxCombo, 1);
  assert.equal(run.state.score, 10);
});

test('通关：敌军清空后 phase=won 且至少 1 星', () => {
  const run = createRun(0, { seed: 9 });
  run.state.spawnQueue = [];
  run.state.enemies = [];
  run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
});

test('失败：核心被毁 phase=lost', () => {
  const run = createRun(0, { seed: 10 });
  run.state.baseAlive = false;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
});

test('道具：拾取 rapid 后射速提升', () => {
  const run = createRun(0, { seed: 11 });
  const p = run.state.player;
  p.alive = true;
  p.x = center(8, 20).x;
  p.y = center(8, 20).y;
  run.state.powerups.push({ x: p.x, y: p.y, type: 'rapid', ttl: 12 });
  run.step(1 / 60);
  assert.ok(p.rapidT > 0);
});

test('getHud：返回关卡/生命/敌军/连击/分数', () => {
  const run = createRun(3, { seed: 12 });
  const h = run.getHud();
  assert.equal(h.level, 4);
  assert.equal(typeof h.lives, 'number');
  assert.equal(typeof h.enemiesLeft, 'number');
  assert.equal(typeof h.score, 'number');
  assert.equal(typeof h.combo, 'number');
});
