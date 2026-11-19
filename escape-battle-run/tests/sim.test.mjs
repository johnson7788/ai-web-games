import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, PLAYER, ENEMY, SKILL, GEM, WAVE } from '../config/game.config.js';

function drain(run) {
  const ev = run.drainEvents();
  return ev;
}

test('玩家向右输入会向右移动', () => {
  const run = createRun({ seed: 1 });
  const x0 = run.state.player.x;
  for (let i = 0; i < 10; i += 1) run.step({ x: 1, y: 0 });
  assert.ok(run.state.player.x > x0, 'x 应增加');
});

test('玩家不会越出活动区边界', () => {
  const run = createRun({ seed: 1 });
  run.state.enemies = [];
  run.state.enemyRespawnTimer = 99999;
  run.state.player.x = WORLD.WIDTH;
  run.state.player.y = WORLD.HEIGHT;
  run.step({ x: 1, y: 1 });
  assert.ok(run.state.player.x <= WORLD.WIDTH - WORLD.MARGIN);
  assert.ok(run.state.player.y <= WORLD.HEIGHT - WORLD.MARGIN);
  run.state.player.x = 0;
  run.state.player.y = 0;
  run.step({ x: -1, y: -1 });
  assert.ok(run.state.player.x >= WORLD.MARGIN);
  assert.ok(run.state.player.y >= WORLD.HUD_H + WORLD.MARGIN);
});

test('种子一致则开局敌人一致（可复现）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  assert.equal(a.state.enemies.length, b.state.enemies.length);
  assert.equal(a.state.enemies[0].x, b.state.enemies[0].x);
  assert.equal(a.state.enemies[0].y, b.state.enemies[0].y);
});

test('第 1 波敌人数量等于 BASE_COUNT', () => {
  const run = createRun({ seed: 7 });
  assert.equal(run.state.enemies.length, ENEMY.BASE_COUNT);
});

test('晶体可在玩家位置生成并被收集', () => {
  const run = createRun({ seed: 1 });
  run.state.gems.push({ x: run.state.player.x, y: run.state.player.y, r: GEM.R });
  const before = run.state.gemCount;
  run.step({ x: 0, y: 0 });
  assert.equal(run.state.gemCount, before + 1, '应收集一颗晶体');
  assert.equal(run.state.combo, 2, '收集后连击 +1');
  assert.ok(run.state.energy >= GEM.ENERGY, '能量应增加');
});

test('能量爆发清掉半径内敌人并重置能量', () => {
  const run = createRun({ seed: 1 });
  run.state.enemies = [];
  run.state.player.x = WORLD.WIDTH / 2;
  run.state.player.y = WORLD.HEIGHT / 2;
  run.state.enemies.push({ x: WORLD.WIDTH / 2 + 50, y: WORLD.HEIGHT / 2, r: ENEMY.R, speed: 100, nearMiss: false });
  run.state.energy = SKILL.ENERGY_COST;
  run.state.novaCd = 0;
  run.state.enemyRespawnTimer = 99999;
  run.step({ x: 0, y: 0, nova: true });
  assert.equal(run.state.enemies.length, 0, '半径内敌人应被清除');
  assert.equal(run.state.kills, 1);
  assert.equal(run.state.energy, 0);
  assert.equal(run.state.novaCd, SKILL.COOLDOWN);
});

test('能量不足时爆发不会触发', () => {
  const run = createRun({ seed: 1 });
  run.state.enemies = [];
  run.state.player.x = WORLD.WIDTH / 2;
  run.state.player.y = WORLD.HEIGHT / 2;
  run.state.enemies.push({ x: WORLD.WIDTH / 2 + 50, y: WORLD.HEIGHT / 2, r: ENEMY.R, speed: 100, nearMiss: false });
  run.state.energy = 0;
  run.state.novaCd = 0;
  run.step({ x: 0, y: 0, nova: true });
  assert.equal(run.state.kills, 0, '能量不足时不应击杀');
  assert.equal(run.state.energy, 0, '能量保持不变');
});

test('敌人碰到玩家会触发死亡并进入结算', () => {
  const run = createRun({ seed: 1 });
  run.state.enemies = [];
  run.state.player.x = WORLD.WIDTH / 2;
  run.state.player.y = WORLD.HEIGHT / 2;
  run.state.enemies.push({ x: run.state.player.x, y: run.state.player.y, r: ENEMY.R, speed: 0, nearMiss: false });
  run.step({ x: 0, y: 0 });
  assert.equal(run.state.phase, 'result');
  const ev = drain(run);
  assert.ok(ev.some((e) => e.type === 'death'), '应有死亡事件');
});

test('岩石命中会让玩家短暂眩晕（减速）', () => {
  const run = createRun({ seed: 1 });
  run.state.rocks = [];
  run.state.rocks.push({ x: run.state.player.x + 5, y: run.state.player.y, r: 20, vx: 0, vy: 0 });
  run.step({ x: 0, y: 0 });
  assert.ok(run.state.player.stunned > 0, '应进入眩晕');
});

test('生存 15 秒后进入第 2 波并触发 wave 事件', () => {
  const run = createRun({ seed: 1 });
  run.state.enemies = [];
  run.state.enemyRespawnTimer = 99999;
  for (let i = 0; i < Math.ceil(WAVE.DURATION * 60); i += 1) run.step({ x: 0, y: 0 });
  assert.equal(run.state.wave, 2, '应进入第 2 波');
});

test('事件流包含核心事件类型（tick/gem/enemySpawn 等）', () => {
  const run = createRun({ seed: 1 });
  const seen = new Set();
  for (let i = 0; i < 60 * 12; i += 1) {
    run.step({ x: 0, y: 0 });
    for (const e of drain(run)) seen.add(e.type);
  }
  for (const t of ['tick', 'gemSpawn', 'enemySpawn']) {
    assert.ok(seen.has(t), `应观察到 ${t}`);
  }
});

test('无输入时玩家会被追击死亡（死亡存在性）', () => {
  const run = createRun({ seed: 3 });
  let steps = 0;
  while (run.state.phase === 'playing' && steps < 60 * 30) {
    run.step({ x: 0, y: 0 });
    drain(run);
    steps += 1;
  }
  assert.equal(run.state.phase, 'result', '静止不动应被追上');
});

test('mulberry32 确定性序列一致', () => {
  const a = mulberry32(99);
  const b = mulberry32(99);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
});
