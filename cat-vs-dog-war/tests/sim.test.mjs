import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, MONSTER_TYPES, GAME } from '../src/game/sim.js';

test('初始状态：playing、5 洞、3 心、目标分 400', () => {
  const run = createRun(7);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.holes.length, 5);
  assert.equal(run.state.hearts, GAME.HEARTS);
  assert.equal(run.state.target, GAME.STAGE_TARGETS[0]);
});

test('mulberry32 是确定性 RNG（同 seed 同序列）', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const sa = [a(), a(), a()];
  const sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
});

test('step 会从洞里钻出小动物（spawn 事件）', () => {
  const run = createRun(1);
  let spawned = 0;
  for (let i = 0; i < 120 && spawned === 0; i += 1) {
    run.step(1 / 60);
    spawned += run.drainEvents().filter((e) => e.type === 'spawn').length;
  }
  assert.ok(spawned > 0, '应产生至少一次 spawn');
});

test('单次点击打死 1-tap 动物并加分', () => {
  const run = createRun(1);
  run.state.holes[0].monster = { type: 'cat', tapsLeft: 1, tapsNeeded: 1, score: 100, age: 0.1, lifetime: 2.8 };
  const res = run.tapHole(0);
  assert.ok(res.ok && res.kill);
  assert.equal(run.state.score, 100);
  assert.equal(run.state.kills, 1);
});

test('4-tap 猎犬要点满 4 次才死', () => {
  const run = createRun(1);
  run.state.holes[0].monster = { type: 'hound', tapsLeft: 4, tapsNeeded: 4, score: 400, age: 0.1, lifetime: 3.6 };
  for (let i = 0; i < 3; i += 1) {
    const r = run.tapHole(0);
    assert.equal(r.kill, undefined);
  }
  assert.equal(run.state.score, 0);
  const last = run.tapHole(0);
  assert.ok(last.kill);
  assert.equal(run.state.score, 400);
});

test('点石头扣心且不致死动物', () => {
  const run = createRun(1);
  run.state.holes[0].monster = { type: 'rock', tapsLeft: 0, tapsNeeded: 0, score: -50, age: 0.1, lifetime: 2.0 };
  const res = run.tapHole(0);
  assert.ok(res.rock);
  assert.equal(run.state.hearts, GAME.HEARTS - 1);
  assert.equal(run.state.rockHits, 1);
});

test('动物超时逃脱扣一颗心', () => {
  const run = createRun(1);
  run.state.holes[0].monster = { type: 'cat', tapsLeft: 1, tapsNeeded: 1, score: 100, age: 2.7, lifetime: 2.8 };
  run.step(1 / 60 * 20); // 推进到超时
  assert.equal(run.state.hearts, GAME.HEARTS - 1);
  assert.equal(run.state.escapes, 1);
});

test('连击：连续击杀提升倍率', () => {
  const run = createRun(1);
  const mk = (type) => ({ type, tapsLeft: MONSTER_TYPES[type].taps, tapsNeeded: MONSTER_TYPES[type].taps, score: MONSTER_TYPES[type].score, age: 0.1, lifetime: 3 });
  run.state.holes[0].monster = mk('cat');
  run.tapHole(0);
  assert.equal(run.state.combo, 1);
  run.state.holes[1].monster = mk('pup');
  run.tapHole(1);
  assert.equal(run.state.combo, 2);
  assert.equal(run.state.score, 100 + 200 * 2);
});

test('3 心耗尽判负（deaths=1）', () => {
  const run = createRun(1);
  for (let i = 0; i < 3; i += 1) {
    run.state.holes[0].monster = { type: 'rock', tapsLeft: 0, tapsNeeded: 0, score: -50, age: 0.1, lifetime: 2.0 };
    run.tapHole(0);
  }
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.deaths, 1);
});

test('分数达标推进波次并最终胜利', () => {
  const run = createRun(1);
  run.state.score = GAME.STAGE_TARGETS[2];
  // 直接跳到第 3 波末尾
  run.state.stage = 3;
  run.state.target = GAME.STAGE_TARGETS[2];
  run.state.timeLeft = 0.01;
  run.state.levelsReached = 3;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
});

test('分数不达标超时判负', () => {
  const run = createRun(1);
  run.state.score = 0;
  run.state.timeLeft = 0.01;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.reason, 'timeUp');
});

test('星级：达标阈值对应 1/2/3 星', () => {
  const run = createRun(1);
  assert.equal(run.starRating(GAME.STARS_2 - 1), 1);
  assert.equal(run.starRating(GAME.STARS_2), 2);
  assert.equal(run.starRating(GAME.STARS_3), 3);
});
