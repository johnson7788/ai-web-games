import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, idealPower } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

test('初始状态：aiming / 3 命 / 0 分 / 阶段 1', () => {
  const run = createRun(1);
  const s = run.state;
  assert.equal(s.phase, 'aiming');
  assert.equal(s.lives, GAME.LIVES);
  assert.equal(s.score, 0);
  assert.equal(s.stage, 1);
  assert.equal(s.combo, 0);
});

test('mulberry32 确定性：同种子同序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('mulberry32 输出在 [0,1)', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 100; i += 1) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `v=${v}`);
  }
});

test('idealPower 随环位上下漂移，且在 [0.12, 0.88]', () => {
  const run = createRun(1);
  run.state.targetRingY = GAME.RING_BASE_Y;
  assert.equal(idealPower(run.state), 0.5);
  run.state.targetRingY = GAME.RING_BASE_Y - 120;
  assert.ok(idealPower(run.state) < 0.5);
  assert.ok(idealPower(run.state) >= 0.12);
  run.state.targetRingY = GAME.RING_BASE_Y + 120;
  assert.ok(idealPower(run.state) > 0.5);
  assert.ok(idealPower(run.state) <= 0.88);
});

test('力量指针始终在 [0,1]', () => {
  const run = createRun(1);
  for (let i = 0; i < 600; i += 1) {
    run.step(1 / 60);
    assert.ok(run.state.power >= 0 && run.state.power <= 1);
  }
});

test('空心：对准理想力量 → 得分 + 连击', () => {
  const run = createRun(1);
  run.state.power = run.idealPower();
  const res = run.shoot();
  assert.equal(res.outcome, 'swish');
  assert.equal(run.state.goals, 1);
  assert.ok(run.state.score >= 1);
  assert.equal(run.state.combo, 1);
});

test('擦板：偏离理想力量 → 得分但连击清零', () => {
  const run = createRun(1);
  run.state.power = run.idealPower() + 0.08;
  const res = run.shoot();
  assert.equal(res.outcome, 'bank');
  assert.equal(run.state.goals, 1);
  assert.equal(run.state.combo, 0);
});

test('失手：偏离过远 → 无分，进入 recover', () => {
  const run = createRun(1);
  run.state.power = Math.min(0.99, run.idealPower() + 0.5);
  const res = run.shoot();
  assert.equal(res.outcome, 'miss');
  assert.equal(run.state.score, 0);
  assert.equal(run.state.phase, 'recover');
});

test('recover 后回到 aiming', () => {
  const run = createRun(1);
  run.state.power = 0.99;
  run.shoot();
  assert.equal(run.state.phase, 'recover');
  for (let i = 0; i < 30; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'aiming');
});

test('连击 ≥2 有加分，≥3 触发烈焰事件', () => {
  const run = createRun(1);
  const events = [];
  for (let i = 0; i < 4; i += 1) {
    run.state.power = run.idealPower();
    run.shoot();
    events.push(...run.drainEvents());
  }
  assert.ok(run.state.score > 4, `score=${run.state.score}`);
  assert.ok(events.includes('combo'));
  assert.ok(events.includes('flame'));
});

test('金环每 GOLDEN_EVERY 球出现一次', () => {
  const run = createRun(1);
  // 进 3 球后，下一球应为金环
  for (let i = 0; i < 3; i += 1) {
    run.state.power = run.idealPower();
    run.shoot();
    run.drainEvents();
  }
  assert.equal(run.state.golden, true);
  // 金环进球后，golden 重置为 false
  run.state.power = run.idealPower();
  const evs = run.shoot();
  const drained = run.drainEvents();
  assert.equal(evs.outcome, 'swish');
  assert.equal(run.state.golden, false);
  assert.ok(drained.includes('score'));
});

test('阶段随进球数提升', () => {
  const run = createRun(1);
  for (let i = 0; i < 4; i += 1) {
    run.state.power = run.idealPower();
    run.shoot();
    run.drainEvents();
  }
  assert.ok(run.state.stage >= 3, `stage=${run.state.stage}`);
});

test('时钟耗尽扣命；命尽出局', () => {
  const run = createRun(1);
  const events = [];
  for (let i = 0; i < GAME.OFF_TIME_0 * 60 * 4; i += 1) {
    run.step(1 / 60);
    events.push(...run.drainEvents());
    if (run.state.phase === 'lost') break;
  }
  assert.equal(run.state.phase, 'lost');
  assert.ok(events.includes('lifeLost'));
  assert.ok(events.includes('lose'));
});

test('连击空心打到 WIN_SCORE 即通关', () => {
  const run = createRun(3);
  let guard = 40;
  while (guard-- > 0 && run.state.phase !== 'won') {
    run.state.power = run.idealPower();
    run.shoot();
    run.drainEvents();
  }
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.score >= GAME.WIN_SCORE);
});

test('换边：每球后目标环左右交替', () => {
  const run = createRun(1);
  const first = run.state.targetSide;
  run.state.power = run.idealPower();
  run.shoot();
  assert.equal(run.state.targetSide, -first);
});
