import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { QUESTIONS } from '../config/questions.js';
import { QUIZ } from '../config/game.config.js';

const answerOf = (run) => QUESTIONS[run.state.order[run.state.index]].answer;

function winRun(seed = 1) {
  const run = createRun({ seed });
  while (run.state.phase === 'playing') {
    run.answer(answerOf(run));
  }
  return run;
}

test('创建 run：10 题乱序、倒计时满、phase=playing', () => {
  const run = createRun({ seed: 5 });
  assert.equal(run.state.order.length, 10);
  assert.equal(new Set(run.state.order).size, 10);
  assert.equal(run.state.timeLeft, QUIZ.TIME_LIMIT);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.score, 0);
});

test('确定性：同 seed 产生相同题序', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  assert.deepEqual(a.state.order, b.state.order);
});

test('答对：加分、计数 +1、自动翻题', () => {
  const run = createRun({ seed: 1 });
  const before = run.state.index;
  const res = run.answer(answerOf(run));
  assert.equal(res.correct, true);
  assert.equal(run.state.correct, 1);
  assert.ok(run.state.score >= QUIZ.BASE_SCORE);
  assert.equal(run.state.index, before + 1);
});

test('答错：不加分、连击清零、不翻题、锁按钮', () => {
  const run = createRun({ seed: 1 });
  const wrong = answerOf(run) === 'right' ? 'wrong' : 'right';
  const idx = run.state.index;
  const res = run.answer(wrong);
  assert.equal(res.correct, false);
  assert.equal(run.state.correct, 0);
  assert.equal(run.state.wrong, 1);
  assert.equal(run.state.combo, 0);
  assert.equal(run.state.index, idx);
  // 立即再答被锁
  assert.equal(run.answer(answerOf(run)).ok, false);
});

test('连击：连续答对累积 combo 与 maxCombo，且加成分递增', () => {
  const run = createRun({ seed: 2 });
  run.answer(answerOf(run));
  const g1 = run.state.score;
  run.answer(answerOf(run));
  const g2 = run.state.score;
  assert.equal(run.state.combo, 2);
  assert.equal(run.state.maxCombo, 2);
  assert.ok(g2 - g1 > QUIZ.BASE_SCORE, '连击加分应高于基础分');
});

test('答错后连击从 0 重新累积', () => {
  const run = createRun({ seed: 3 });
  run.answer(answerOf(run));
  run.answer(answerOf(run));
  assert.equal(run.state.combo, 2);
  const wrong = answerOf(run) === 'right' ? 'wrong' : 'right';
  run.answer(wrong);
  assert.equal(run.state.combo, 0);
  run.step(0.4); // 越过答错锁定
  run.answer(answerOf(run));
  assert.equal(run.state.combo, 1);
});

test('通关：答完 10 题 phase=result、won=true、星级 1–3', () => {
  const run = winRun(7);
  assert.equal(run.state.phase, 'result');
  assert.equal(run.state.won, true);
  assert.equal(run.state.correct, 10);
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
});

test('满分零失误应拿 3 星', () => {
  const run = winRun(7);
  assert.equal(run.state.wrong, 0);
  assert.equal(run.state.stars, 3);
});

test('超时：timeLeft 归零后判负', () => {
  const run = createRun({ seed: 1 });
  run.step(QUIZ.TIME_LIMIT + 0.1);
  assert.equal(run.state.phase, 'result');
  assert.equal(run.state.won, false);
  assert.equal(run.state.reason, 'timeout');
  assert.equal(run.state.stars, 0);
});

test('倒计时事件：最后 5 秒每秒发 countdownTick', () => {
  const run = createRun({ seed: 1 });
  run.step(QUIZ.TIME_LIMIT - 5.01);
  const before = run.drainEvents().length; // 清掉可能的事件
  for (let i = 0; i < 5 * 60; i += 1) run.step(1 / 60);
  const evs = run.drainEvents();
  const ticks = evs.filter((e) => e.type === 'countdownTick');
  assert.ok(ticks.length >= 4, `应至少有 4 次 tick，实际 ${ticks.length}`);
});

test('导航：左右翻题在边界内夹紧', () => {
  const run = createRun({ seed: 1 });
  const first = run.navigate(-1);
  assert.equal(first.ok, false); // 已在第 0 题
  assert.equal(run.navigate(1).ok, true);
  for (let i = 0; i < 20; i += 1) run.navigate(1);
  assert.equal(run.state.index, QUESTIONS.length - 1);
  assert.equal(run.navigate(1).ok, false);
});

test('事件契约：answer_correct / win 事件被 drain', () => {
  const run = winRun(9);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'answer_correct'));
  assert.ok(evs.some((e) => e.type === 'win'));
});

test('getHud 反映当前状态', () => {
  const run = createRun({ seed: 1 });
  const hud = run.getHud();
  assert.equal(hud.total, 10);
  assert.equal(hud.combo, 0);
  assert.equal(hud.round, 1);
});
