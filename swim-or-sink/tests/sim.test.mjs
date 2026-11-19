import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT, pick } from '../config/questions.js';
import { GAME } from '../config/game.config.js';

test('开局：phase=playing，level=1，空气满', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.air, GAME.maxAir);
  assert.equal(run.state.qIndex, 0);
});

test('答对推进到下一题，qIndex+1', () => {
  const run = createRun(0, { seed: 1 });
  const q = run.state.questions[0];
  const res = run.answer(q.answer);
  assert.equal(res.ok, true);
  assert.equal(res.correct, true);
  assert.equal(run.state.qIndex, 1);
  assert.equal(run.state.totalCorrect, 1);
});

test('答错扣空气且停留在本题', () => {
  const run = createRun(0, { seed: 1 });
  const q = run.state.questions[0];
  const wrong = q.answer === 0 ? 1 : 0;
  const res = run.answer(wrong);
  assert.equal(res.correct, false);
  assert.equal(run.state.air, GAME.maxAir - 1);
  assert.equal(run.state.qIndex, 0);
});

test('连续答错 3 次 → 空气耗尽 → lost', () => {
  const run = createRun(0, { seed: 1 });
  const q = run.state.questions[0];
  const wrong = q.answer === 0 ? 1 : 0;
  run.answer(wrong);
  run.answer(wrong);
  const res = run.answer(wrong);
  assert.equal(run.state.air, 0);
  assert.equal(run.state.phase, 'lost');
  assert.equal(res.correct, false);
});

test('连击递增，连击奖励分随层数增加', () => {
  const run = createRun(0, { seed: 1 });
  let prev = 0;
  for (let i = 0; i < 3; i += 1) {
    const q = run.state.questions[run.state.qIndex];
    run.answer(q.answer);
    assert.equal(run.state.streak, i + 1);
    assert.ok(run.state.score > prev);
    prev = run.state.score;
  }
  assert.equal(run.state.maxStreak, 3);
});

test('扣空气后 3 连击回 1 格空气', () => {
  const run = createRun(0, { seed: 1 });
  const q0 = run.state.questions[0];
  run.answer(q0.answer === 0 ? 1 : 0); // 扣 1 格
  assert.equal(run.state.air, GAME.maxAir - 1);
  const q1 = run.state.questions[run.state.qIndex];
  run.answer(q1.answer);
  const q2 = run.state.questions[run.state.qIndex];
  run.answer(q2.answer);
  const q3 = run.state.questions[run.state.qIndex];
  run.answer(q3.answer); // 第 3 连击 → 回气
  assert.equal(run.state.air, GAME.maxAir);
});

test('清空第 1 关 4 题后进入第 2 关', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < 4; i += 1) {
    run.answer(run.state.questions[run.state.qIndex].answer);
  }
  assert.equal(run.state.level, 2);
  assert.equal(run.state.qIndex, 0);
});

test('全对通关：level=3，won，3 星，空气满', () => {
  const run = createRun(0, { seed: 7 });
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 100) {
    run.answer(run.state.questions[run.state.qIndex].answer);
    guard += 1;
  }
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.level, 3);
  assert.equal(run.state.totalCorrect, 12);
  assert.equal(run.state.totalWrong, 0);
  assert.equal(run.state.air, GAME.maxAir);
  assert.equal(run.state.stars, 3);
});

test('浮标：3 选 1 题消除一个错误选项，且仅能用 1 次', () => {
  const run = createRun(1, { seed: 3 }); // L2 有 3 选 1
  // 推进到某道 3 选 1 题（L2 全是 3 选 1）
  const q = run.state.questions[run.state.qIndex];
  assert.ok(q.opts.length >= 3);
  const res = run.useLifeline();
  assert.equal(res.ok, true);
  assert.equal(run.state.usedLifeline, true);
  assert.ok(q.eliminated.has(res.eliminated));
  assert.equal(run.useLifeline().ok, false);
});

test('被消除的选项不能选', () => {
  const run = createRun(1, { seed: 3 });
  const q = run.state.questions[run.state.qIndex];
  const res = run.useLifeline();
  assert.equal(res.ok, true);
  const before = run.state.air;
  const r = run.answer(res.eliminated);
  assert.equal(r.ok, false);
  assert.equal(run.state.air, before);
});

test('远海选项打乱后 answer 仍指向正确语义', () => {
  const run = createRun(2, { seed: 9 }); // L3 shuffle
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 100) {
    const q = run.state.questions[run.state.qIndex];
    assert.ok(q.answer >= 0 && q.answer < q.opts.length);
    run.answer(q.answer);
    guard += 1;
  }
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.totalWrong, 0);
});

test('getHud 返回关键数值', () => {
  const run = createRun(0, { seed: 1 });
  const h = run.getHud();
  assert.equal(h.level, 1);
  assert.equal(h.air, GAME.maxAir);
  assert.equal(h.qCount, 4);
  assert.equal(h.streak, 0);
});

test('题目双语齐全且 answer 合法', () => {
  for (const lv of LEVELS) {
    for (const q of lv.questions) {
      assert.ok(pick(q.q, 'en').length > 0);
      assert.ok(pick(q.q, 'zh').length > 0);
      assert.ok(q.opts.length >= 2);
      assert.ok(q.answer >= 0 && q.answer < q.opts.length);
      assert.ok(pick(q.reason, 'en').length > 0);
      assert.ok(pick(q.reason, 'zh').length > 0);
    }
  }
  assert.equal(LEVEL_COUNT, 3);
});
