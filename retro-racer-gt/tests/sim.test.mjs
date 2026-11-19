import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { PLAYER, TIERS, LANE_X } from '../config/game.config.js';

test('初始状态：running / 中车道 / 速度 0 / tier 0', () => {
  const run = createRun(1);
  assert.equal(run.state.phase, 'running');
  assert.equal(run.state.lane, PLAYER.START_LANE);
  assert.equal(run.state.speed, 0);
  assert.equal(run.state.tier, 0);
});

test('速度随时间加速（不超过常规极速）', () => {
  const run = createRun(1);
  run.step(1 / 60);
  assert.ok(run.state.speed > 0, 'step 后速度应大于 0');
  for (let i = 0; i < 60 * 10; i += 1) run.step(1 / 60);
  assert.ok(run.state.speed <= 860, '常规速度不应超过 maxSpeed 附近');
});

test('变道：turnRight 换到右邻车道，最右再右失败', () => {
  const run = createRun(1);
  const r1 = run.turnRight();
  assert.equal(r1.ok, true);
  assert.equal(run.state.lane, PLAYER.START_LANE + 1);
  run.state.lane = LANE_X.length - 1;
  run.state.turnDir = 0;
  const r2 = run.turnRight();
  assert.equal(r2.ok, false);
});

test('变道：turnLeft 换到左邻车道，最左再左失败', () => {
  const run = createRun(1);
  const r1 = run.turnLeft();
  assert.equal(r1.ok, true);
  assert.equal(run.state.lane, PLAYER.START_LANE - 1);
  run.state.lane = 0;
  run.state.turnDir = 0;
  const r2 = run.turnLeft();
  assert.equal(r2.ok, false);
});

test('碰撞同向车 → crashed', () => {
  const run = createRun(1);
  run.state.speed = 500;
  run.state.cars.push({ lane: run.state.lane, y: PLAYER.Y, w: 58, h: 100, dir: 1, passed: false, nearMissed: false });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'crashed');
});

test('氮气期间撞车无敌（不 crashed）', () => {
  const run = createRun(1);
  assert.equal(run.useNitro().ok, true);
  run.state.cars.push({ lane: run.state.lane, y: PLAYER.Y, w: 58, h: 100, dir: 1, passed: false, nearMissed: false });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'running');
});

test('岩石即使氮气期间也会撞车', () => {
  const run = createRun(1);
  assert.equal(run.useNitro().ok, true);
  run.state.rocks.push({ lane: run.state.lane, y: PLAYER.Y, w: 52, h: 52, nearMissed: false });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'crashed');
});

test('分数随时间增加', () => {
  const run = createRun(1);
  run.state.speed = 500;
  run.step(1 / 60);
  assert.ok(run.state.score > 0, 'score 应随距离增加');
});

test('难度升级：跨过 tier 门槛发出 levelUp 事件', () => {
  const run = createRun(1);
  run.state.score = TIERS[1].score;
  run.state.speed = 100;
  run.step(1 / 60);
  assert.equal(run.state.tier, 1);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'levelUp'), '应发出 levelUp');
});

test('超车触发连击并发出 pass 事件', () => {
  const run = createRun(1);
  run.state.speed = 1000;
  run.state.cars.push({ lane: 0, y: PLAYER.Y - 2, w: 58, h: 100, dir: 1, passed: false, nearMissed: false });
  run.step(1 / 60);
  assert.equal(run.state.carsPassed, 1);
  assert.equal(run.state.combo, 1);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'pass'), '应发出 pass');
});

test('收集能量星加分并充氮气冷却', () => {
  const run = createRun(1);
  run.state.nitroCd = 3;
  run.state.stars.push({ lane: run.state.lane, y: PLAYER.Y, w: 40, h: 40, collected: false });
  run.step(1 / 60);
  assert.equal(run.state.starsCollected, 1);
  assert.ok(run.state.nitroCd < 3, '收集后冷却应减少');
});

test('固定 seed 结果可复现', () => {
  const a = createRun(7);
  const b = createRun(7);
  for (let i = 0; i < 60; i += 1) { a.step(1 / 60); b.step(1 / 60); }
  assert.deepEqual(
    a.state.cars.map((c) => [c.lane, c.dir]),
    b.state.cars.map((c) => [c.lane, c.dir]),
  );
});

test('mulberry32 是稳定随机源', () => {
  const r1 = mulberry32(99);
  const r2 = mulberry32(99);
  assert.equal(r1(), r2());
  assert.equal(r1(), r2());
});
