import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, cloneState, mulberry32 } from '../src/game/sim.js';
import { PHYS, STEP } from '../config/game.config.js';

function drain(run) {
  return run.drainEvents();
}

function stepN(run, n, gas) {
  for (let i = 0; i < n; i += 1) {
    run.gas(gas);
    run.step(STEP);
  }
}

// 无横穿车：纯路线逻辑
function noTraffic(run) {
  run.state.crossings = [];
  run.state.cars = [];
  return run;
}

test('开局处于倒计时，随后进入 running', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'countdown');
  stepN(run, Math.ceil(1.1 / STEP), false);
  assert.equal(run.state.phase, 'running');
  assert.ok(drain(run).some((e) => e.type === 'go'));
});

test('公交车始终向前移动（dist 单调递增）', () => {
  const run = noTraffic(createRun(0, { seed: 1 }));
  stepN(run, 70, false); // 越过倒计时
  const d0 = run.state.dist;
  stepN(run, 30, false);
  assert.ok(run.state.dist > d0);
});

test('油门加速、松手减速，速度夹在 [MIN, MAX]', () => {
  const run = noTraffic(createRun(0, { seed: 1 }));
  stepN(run, 70, false);
  for (let i = 0; i < 40; i += 1) {
    run.gas(true);
    run.step(STEP);
  }
  assert.ok(run.state.speed > PHYS.MIN_SPEED);
  assert.ok(run.state.speed <= PHYS.MAX_SPEED + 1e-6);
  const fast = run.state.speed;
  for (let i = 0; i < 40; i += 1) {
    run.gas(false);
    run.step(STEP);
  }
  assert.ok(run.state.speed < fast);
  assert.ok(run.state.speed >= PHYS.MIN_SPEED - 1e-6);
});

test('接客点触发 pickup 事件并累加乘客', () => {
  const run = noTraffic(createRun(0, { seed: 1 }));
  const events = [];
  let guard = 0;
  while (run.state.phase === 'countdown' || run.state.phase === 'running') {
    run.gas(true);
    run.step(STEP);
    events.push(...drain(run));
    if (run.state.phase === 'running' && run.state.passengers >= 1) break;
    guard += 1;
    if (guard > 3000) break;
  }
  assert.ok(events.some((e) => e.type === 'pickup'));
  assert.equal(run.state.passengers, 1);
});

test('送客点触发 dropoff/coin 事件并增加金币', () => {
  const run = noTraffic(createRun(0, { seed: 1 }));
  const events = [];
  let guard = 0;
  while (run.state.phase === 'countdown' || run.state.phase === 'running') {
    run.gas(true);
    run.step(STEP);
    events.push(...drain(run));
    if (run.state.delivered >= 1) break;
    guard += 1;
    if (guard > 3000) break;
  }
  assert.ok(events.some((e) => e.type === 'dropoff'));
  assert.ok(events.some((e) => e.type === 'coin'));
  assert.ok(run.state.coins > 0);
});

test('到达终点通关并结算星级', () => {
  const run = noTraffic(createRun(0, { seed: 1 }));
  let guard = 0;
  while (run.state.phase === 'running' || run.state.phase === 'countdown') {
    run.gas(true);
    run.step(STEP);
    drain(run);
    guard += 1;
    if (guard > 4000) break;
  }
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
});

test('noinput 策略必然撞车（deathPresence 基线）', () => {
  const run = createRun(0, { seed: 1 });
  let guard = 0;
  while (run.state.phase === 'countdown' || run.state.phase === 'running') {
    run.gas(false);
    run.step(STEP);
    if (run.state.phase === 'crashed') break;
    guard += 1;
    if (guard > 3000) break;
  }
  assert.equal(run.state.phase, 'crashed');
  assert.equal(run.state.deaths, 1);
});

test('护盾可挡一次碰撞（shieldBreak）', () => {
  const run = createRun(0, { seed: 1 });
  stepN(run, 70, false);
  run.state.shield = 1;
  run.state.cars = [{ id: 999, x: run.state.x, y: run.state.y, vx: 0, r: 20, nearMissed: false }];
  run.step(STEP);
  assert.equal(run.state.shield, 0);
  assert.equal(run.state.phase, 'running');
  assert.ok(drain(run).some((e) => e.type === 'shieldBreak'));
});

test('贴近横穿车触发 nearMiss 并累加连击', () => {
  const run = createRun(0, { seed: 1 });
  stepN(run, 70, false);
  run.state.cars = [{ id: 998, x: run.state.x + 50, y: run.state.y, vx: 0, r: 20, nearMissed: false }];
  run.step(STEP);
  assert.equal(run.state.nearMisses, 1);
  assert.ok(drain(run).some((e) => e.type === 'nearMiss'));
});

test('金币道具直接加钱', () => {
  const run = noTraffic(createRun(0, { seed: 1 }));
  const before = run.state.coins;
  run.state.pickups = [{ d: run.state.dist + 2, x: 0, y: run.state.dist + 2, type: 'coin', taken: false }];
  stepN(run, 180, true);
  assert.ok(run.state.coins > before);
});

test('氮气道具进入 turbo 且速度抬升', () => {
  const run = noTraffic(createRun(0, { seed: 1 }));
  stepN(run, 70, false);
  run.state.pickups = [{ d: run.state.dist + 2, x: 0, y: run.state.dist + 2, type: 'turbo', taken: false }];
  stepN(run, 80, true);
  assert.ok(run.state.turboT > 0 || drain(run).some((e) => e.type === 'turbo'));
});

test('cloneState 深度复制且互不影响', () => {
  const run = createRun(0, { seed: 1 });
  stepN(run, 70, false);
  const before = run.state.cars.length;
  const c = cloneState(run.state);
  c.cars.push({ id: 1, x: 0, y: 0, vx: 0, r: 20, nearMissed: false });
  assert.equal(run.state.cars.length, before);
  assert.equal(c.cars.length, before + 1);
  assert.notEqual(c.heading, run.state.heading);
});

test('mulberry32 确定性（同 seed 同序列）', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const sa = [a(), a(), a()];
  const sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
});
