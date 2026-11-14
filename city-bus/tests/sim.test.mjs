import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tick, getHud, isOnRoad, spawnPassenger, BUILDINGS, makeRng } from '../src/game/sim.js';
import { WORLD, STOPS, BUS, RULES } from '../config/game.config.js';

const step = (run, n, input = {}) => { for (let i = 0; i < n; i++) tick(run, 1 / 60, input); };

test('创建：初始金额 0，班次 90s，巴士在路口', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.money, 0);
  assert.equal(run.timeLeft, RULES.shiftTime);
  assert.ok(isOnRoad(run.bus.x, run.bus.y));
  assert.equal(run.phase, 'play');
});

test('道路判定：路口在路上，街块中心不在', () => {
  assert.ok(isOnRoad(640, 360));
  assert.ok(isOnRoad(200, 255));
  assert.ok(!isOnRoad(420, 255)); // 街块内部
});

test('加速：油门使速度上升并前进', () => {
  const run = createRun({ seed: 1 });
  const x0 = run.bus.x;
  step(run, 60, { up: true });
  assert.ok(run.bus.speed > 40);
  assert.ok(Math.abs(run.bus.x - x0) > 20);
});

test('转向：行进中右转改变朝向', () => {
  const run = createRun({ seed: 1 });
  step(run, 40, { up: true });
  const h0 = run.bus.heading;
  step(run, 30, { up: true, right: true });
  assert.ok(run.bus.heading > h0);
});

test('建筑碰撞：巴士不会驶入街块', () => {
  const run = createRun({ seed: 1 });
  run.bus.x = 300; run.bus.y = 360; run.bus.heading = -Math.PI / 2; // 向上冲向街块
  step(run, 180, { up: true });
  assert.ok(run.bus.y > 318);
  for (const b of BUILDINGS) {
    const inside = run.bus.x > b.x && run.bus.x < b.x + b.w && run.bus.y > b.y && run.bus.y < b.y + b.h;
    assert.ok(!inside);
  }
});

test('乘客生成：随时间出现候车乘客', () => {
  const run = createRun({ seed: 3 });
  step(run, 60 * 8, {});
  assert.ok(run.passengers.some((p) => p.state === 'waiting'));
});

test('上车：停稳在站点，候车乘客上车', () => {
  const run = createRun({ seed: 1 });
  spawnPassenger(run, 0, 3);
  run.bus.x = STOPS[0].x; run.bus.y = STOPS[0].y; run.bus.speed = 0;
  step(run, 40, {});
  assert.ok(run.passengers.some((p) => p.state === 'aboard'));
});

test('下车：停稳在目的站，收车费并计数', () => {
  const run = createRun({ seed: 1 });
  spawnPassenger(run, 0, 3);
  run.passengers[0].state = 'aboard';
  const fare = run.passengers[0].fare;
  run.bus.x = STOPS[3].x; run.bus.y = STOPS[3].y; run.bus.speed = 0;
  step(run, 40, {});
  assert.equal(run.money, fare);
  assert.equal(run.delivered, 1);
});

test('容量：上车不超过 capacity', () => {
  const run = createRun({ seed: 1 });
  for (let i = 0; i < 6; i++) spawnPassenger(run, 0, (i % 7) + 1);
  run.bus.x = STOPS[0].x; run.bus.y = STOPS[0].y; run.bus.speed = 0;
  step(run, 40, {});
  const aboard = run.passengers.filter((p) => p.state === 'aboard').length;
  assert.ok(aboard <= RULES.capacity);
  assert.equal(aboard, RULES.capacity);
});

test('耐心：候车超时离开', () => {
  const run = createRun({ seed: 1 });
  spawnPassenger(run, 0, 3);
  run.spawnT = 999; // 不再生成
  step(run, 60 * (RULES.patience + 2), {});
  assert.ok(!run.passengers.some((p) => p.state === 'waiting' && p.origin === 0 && p.dest === 3));
});

test('班次结束：时间耗尽进入 over', () => {
  const run = createRun({ seed: 1 });
  run.timeLeft = 0.2;
  step(run, 30, {});
  assert.equal(run.phase, 'over');
  assert.equal(run.timeLeft, 0);
});

test('RNG：同种子可复现', () => {
  const a = makeRng(9), b = makeRng(9);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});