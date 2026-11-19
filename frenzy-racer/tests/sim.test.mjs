// Frenzy Racer · sim 单元测试（node --test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

function throughCountdown(run, dt = 1 / 60) {
  let guard = 0;
  while (run.state.phase === 'countdown' && guard < 60 * 5) {
    run.step(dt);
    guard += 1;
  }
}

test('createRun 从倒计时开始，且 level 为 1 基', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'countdown');
  assert.equal(run.state.level, 1);
});

test('倒计时结束后进入 playing，并开始生成实体', () => {
  const run = createRun(0, { seed: 2 });
  throughCountdown(run);
  assert.equal(run.state.phase, 'playing');
  // 开跑后立即生成第一波
  run.step(1 / 60);
  assert.ok(run.state.entities.length > 0);
});

test('倒计时阶段不能换道', () => {
  const run = createRun(0, { seed: 3 });
  const res = run.switchCar('c1');
  assert.equal(res.ok, false);
  assert.equal(run.state.cars.c1, 0);
});

test('playing 阶段换道成功并切换车道', () => {
  const run = createRun(0, { seed: 4 });
  throughCountdown(run);
  const res = run.switchCar('c1');
  assert.equal(res.ok, true);
  assert.equal(run.state.cars.c1, 1);
});

test('吃球增加收集数与连击', () => {
  const run = createRun(0, { seed: 5 });
  throughCountdown(run);
  run.state.entities.push({ id: 999, kind: 'star', lane: 0, arrive: run.state.time, resolved: false });
  run.state.cars.c1 = 0;
  run.step(1 / 60);
  assert.equal(run.state.starsCollected, 1);
  assert.equal(run.state.combo, 1);
});

test('无护盾撞闸门立即失败', () => {
  const run = createRun(0, { seed: 6 });
  throughCountdown(run);
  run.state.entities.push({ id: 998, kind: 'barrier', lane: 0, arrive: run.state.time, resolved: false });
  run.state.cars.c1 = 0;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.reason, 'crash');
});

test('有护盾撞闸门不失败，护盾消耗', () => {
  const run = createRun(0, { seed: 7 });
  throughCountdown(run);
  run.state.shield = true;
  run.state.entities.push({ id: 997, kind: 'barrier', lane: 0, arrive: run.state.time, resolved: false });
  run.state.cars.c1 = 0;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.shield, false);
});

test('吃护盾球获得护盾', () => {
  const run = createRun(0, { seed: 8 });
  throughCountdown(run);
  run.state.entities.push({ id: 996, kind: 'shield', lane: 2, arrive: run.state.time, resolved: false });
  run.state.cars.c2 = 0;
  run.step(1 / 60);
  assert.equal(run.state.shield, true);
});

test('存活满时长且收集率达标 → 通关并给出 1-3 星', () => {
  const run = createRun(0, { seed: 9 });
  throughCountdown(run);
  run.state.starsCollected = 10;
  run.state.starsSpawned = 10;
  run.state.timeLeft = 0.01;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
});

test('存活满时长但收集率不达标 → 失败', () => {
  const run = createRun(0, { seed: 10 });
  throughCountdown(run);
  run.state.starsCollected = 0;
  run.state.starsSpawned = 10;
  run.state.timeLeft = 0.01;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.reason, 'timeUp');
});

test('闸门不与同一波星星同车道', () => {
  const run = createRun(3, { seed: 11 });
  throughCountdown(run);
  for (let i = 0; i < 30; i += 1) run.step(1 / 60);
  const stars = run.state.entities.filter((e) => e.kind === 'star');
  const barriers = run.state.entities.filter((e) => e.kind === 'barrier');
  assert.ok(stars.length > 0);
  assert.ok(barriers.length > 0);
  // 同一 arrive 时间的星与闸门车道不同
  for (const s of stars) {
    for (const b of barriers) {
      if (Math.abs(s.arrive - b.arrive) < 1e-9) assert.notEqual(s.lane, b.lane);
    }
  }
});

test('mulberry32 确定性', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('LEVELS 数量与递增难度一致', () => {
  assert.equal(LEVELS.length, LEVEL_COUNT);
  assert.ok(LEVEL_COUNT >= 12);
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].speed >= LEVELS[i - 1].speed);
    assert.ok(LEVELS[i].goal >= LEVELS[i - 1].goal);
  }
});

test('实体的 arrive = 生成时刻 + lead', () => {
  const run = createRun(0, { seed: 12 });
  throughCountdown(run);
  run.state.entities = [];
  run.step(1 / 60); // 触发第一波生成
  const lead = LEVELS[0].lead;
  assert.ok(run.state.entities.length > 0);
  for (const e of run.state.entities) {
    assert.ok(Math.abs(e.arrive - (run.state.time + lead)) < 0.01);
  }
});
