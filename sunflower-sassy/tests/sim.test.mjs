import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  mulberry32,
  stageFor,
  TIERS,
  ROUND_TIME,
  QUEUE_LEN,
  MAX_HEARTS,
  FEVER_COMBO,
} from '../src/game/sim.js';

test('createRun 初始状态正确', () => {
  const run = createRun({ seed: 7 });
  const s = run.state;
  assert.equal(s.phase, 'playing');
  assert.equal(s.timeLeft, ROUND_TIME);
  assert.equal(s.hearts, MAX_HEARTS);
  assert.equal(s.queue.length, QUEUE_LEN);
  assert.equal(s.stage, 1);
  assert.ok(s.queue.every((t) => t.dir !== 'rock'), 'stage1 初始队列无岩石');
});

test('tap 正确方向会推进队列并累计 combo', () => {
  const run = createRun({ seed: 7 });
  const first = run.state.queue[0].dir;
  const expected = first === 'rock' ? 'dodge' : first;
  const res = run.tap(expected);
  assert.equal(res.ok, true);
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.correct, 1);
  assert.equal(run.state.queue.length, QUEUE_LEN);
});

test('tap 错误方向会掉心并断连击', () => {
  const run = createRun({ seed: 7 });
  const cur = run.state.queue[0].dir;
  const wrong = cur === 'left' ? 'right' : 'left';
  run.tap(wrong);
  assert.equal(run.state.hearts, MAX_HEARTS - 1);
  assert.equal(run.state.combo, 0);
  assert.equal(run.state.mistakes, 1);
});

test('每秒计分：5 次正确按键映射到 tier2(+30) 并加分', () => {
  const run = createRun({ seed: 7 });
  for (let i = 0; i < 5; i += 1) {
    const cur = run.state.queue[0].dir;
    run.tap(cur === 'rock' ? 'dodge' : cur);
  }
  run._stepT = 1.0;
  run._scoreTick();
  assert.ok(run.state.score > 0, '有得分');
  assert.equal(run.state.speedTier, 2); // TIERS[2].rate === 5
  assert.equal(run.state.speed, 1.0);
  assert.equal(run.state.rate, 0);
});

test('岩石牌：DODGE 命中、左右误按掉心', () => {
  const run = createRun({ seed: 7 });
  run.state.queue[0] = { dir: 'rock' };
  const before = run.state.dodges;
  run.tap('dodge');
  assert.equal(run.state.dodges, before + 1);
  assert.equal(run.state.hearts, MAX_HEARTS);

  run.state.queue[0] = { dir: 'rock' };
  run.tap('left');
  assert.equal(run.state.hearts, MAX_HEARTS - 1);
});

test('连击达到阈值触发 FEVER', () => {
  const run = createRun({ seed: 7 });
  for (let i = 0; i < FEVER_COMBO; i += 1) {
    const cur = run.state.queue[0].dir;
    run.tap(cur === 'rock' ? 'dodge' : cur);
  }
  assert.equal(run.state.fever, true);
  assert.equal(run.state.combo, FEVER_COMBO);
  const evs = run.drainEvents().map((e) => e.type);
  assert.ok(evs.includes('fever'));
});

test('失误 3 次 → lost（0 星）', () => {
  const run = createRun({ seed: 7 });
  for (let i = 0; i < 3; i += 1) {
    const cur = run.state.queue[0].dir;
    run.tap(cur === 'left' ? 'right' : 'left');
  }
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.stars, 0);
  assert.equal(run.state.result.won, false);
});

test('时间走完 → won（≥1 星）', () => {
  const run = createRun({ seed: 7 });
  run.state.score = GAME_STAR_3_HELPER;
  run.state.elapsed = ROUND_TIME;
  run.state.timeLeft = 0;
  run.step(0.05);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
});

test('超时掉心并推进队列', () => {
  const run = createRun({ seed: 7 });
  const prev = run.state.queue[1];
  run.state.deadline = 0.01;
  run.step(0.05);
  assert.equal(run.state.timeouts, 1);
  assert.equal(run.state.hearts, MAX_HEARTS - 1);
  assert.equal(run.state.queue[0], prev, '超时后当前牌推进到原第二张');
});

test('stageFor 边界与阶段推进事件', () => {
  assert.equal(stageFor(0), 1);
  assert.equal(stageFor(13.9), 1);
  assert.equal(stageFor(14), 2);
  assert.equal(stageFor(27.9), 2);
  assert.equal(stageFor(28), 3);
  const run = createRun({ seed: 7 });
  run.state.elapsed = 14.5;
  run.state.timeLeft = ROUND_TIME - 14.5;
  run.step(0.01);
  assert.equal(run.state.stage, 2);
});

test('getHud / drainEvents / multiplier 契约', () => {
  const run = createRun({ seed: 7 });
  const hud = run.getHud();
  assert.ok('score' in hud && 'combo' in hud && 'hearts' in hud && 'deadline' in hud);
  assert.equal(run.multiplier(), 1);
  run.state.combo = 25;
  run.state.fever = true;
  assert.equal(run.multiplier(), 4); // 1 + floor(25/10) + fever(1) = 4
  run.state.combo = 100;
  assert.equal(run.multiplier(), 6); // 封顶 6
});

test('mulberry32 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});

test('TIERS 表 P0 1:1 数值', () => {
  assert.deepEqual(TIERS.map((t) => t.rate), [1, 2, 5, 10, 15, 20]);
  assert.deepEqual(TIERS.map((t) => t.score), [1, 20, 30, 40, 60, 100]);
  assert.deepEqual(TIERS.map((t) => t.speed), [0.3, 0.5, 1.0, 1.3, 1.5, 2.0]);
});

const GAME_STAR_3_HELPER = 2000;
