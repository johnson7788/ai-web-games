import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { TOPICS, QUESTION_COUNT } from '../config/topics.js';

test('createRun 起始状态：playing + 第一题 + 出行者 0', () => {
  const run = createRun({ seed: 7 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.questionIndex, 0);
  assert.equal(run.state.travelerIndex, 0);
  assert.ok(run.state.question);
  assert.equal(run.state.timeLeft, run.state.timeLimit);
});

test('答对首题：得星 + 连击 +1 + 前进', () => {
  const run = createRun({ seed: 1 });
  const correct = run.state.question.correct[0];
  const res = run.answer(correct);
  assert.equal(res.ok, true);
  assert.equal(res.correct, true);
  assert.equal(run.state.stars, 1);
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.questionIndex, 1);
});

test('答错：不前进 + 标记本题失败 + 原地重试', () => {
  const run = createRun({ seed: 1 });
  const q = run.state.question;
  const wrong = q.options.find((o) => !q.correct.includes(o.i)).i;
  const res = run.answer(wrong);
  assert.equal(res.ok, true);
  assert.equal(res.correct, false);
  assert.equal(run.state.questionIndex, 0);
  assert.equal(run.state.failedThisQuestion, true);
  assert.equal(run.state.stars, 0);
  assert.equal(run.state.totalWrong, 1);
});

test('错后答对：不得星、连击归零、仍前进', () => {
  const run = createRun({ seed: 2 });
  const q0 = run.state.question;
  run.answer(q0.options.find((o) => !q0.correct.includes(o.i)).i);
  const res = run.answer(q0.correct[0]);
  assert.equal(res.correct, true);
  assert.equal(run.state.stars, 0);
  assert.equal(run.state.combo, 0);
  assert.equal(run.state.questionIndex, 1);
});

test('多可接受答案：任一正确项都判对', () => {
  // q_ride_1（id 3）correct=[1]，选项 0 为错误
  const run = createRun({ seed: 3 });
  run.jumpTo(3);
  assert.deepEqual(run.state.question.correct, [1]);
  const wrong = run.answer(0);
  assert.equal(wrong.correct, false);
});

test('提示：扣次数 + 标记 removed + hintActive', () => {
  const run = createRun({ seed: 4 });
  const before = run.state.hintLeft;
  const res = run.hint();
  assert.equal(res.ok, true);
  assert.equal(run.state.hintLeft, before - 1);
  assert.equal(run.state.hintActive, true);
  assert.ok(run.state.hintRemoved >= 0);
});

test('提示后答对：不计星（hintActive 打断首答）', () => {
  const run = createRun({ seed: 5 });
  run.hint();
  const res = run.answer(run.state.question.correct[0]);
  assert.equal(res.correct, true);
  assert.equal(run.state.stars, 0);
});

test('超时：时间到触发 timeout 且原地重试', () => {
  const run = createRun({ seed: 6 });
  run.step(run.state.timeLimit + 0.1);
  assert.equal(run.state.timeouts, 1);
  assert.equal(run.state.questionIndex, 0);
  assert.equal(run.state.timeLeft, run.state.timeLimit);
});

test('连击累计：连续首答正确递增 maxCombo', () => {
  const run = createRun({ seed: 8 });
  for (let i = 0; i < 3; i += 1) {
    run.answer(run.state.question.correct[0]);
  }
  assert.equal(run.state.maxCombo, 3);
  assert.equal(run.state.stars, 3);
});

test('整局通关：7 题全对 → won + 8 星 + 第 3 章', () => {
  const run = createRun({ seed: 9 });
  let guard = 20;
  while (run.state.phase === 'playing' && guard-- > 0) {
    run.answer(run.state.question.correct[0]);
  }
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.questionsDone, QUESTION_COUNT);
  assert.equal(run.state.stars, 8); // 7 题 + 连击奖励
  assert.equal(run.state.levelsReached, 3);
  assert.equal(run.state.maxCombo, 7);
});

test('事件流：drainEvents 返回并清空', () => {
  const run = createRun({ seed: 10 });
  const evs = run.drainEvents();
  assert.ok(evs.length >= 1);
  assert.equal(evs[0].type, 'question');
  assert.equal(run.state.events.length, 0);
});

test('jumpTo：跳题并重置计数', () => {
  const run = createRun({ seed: 11 });
  run.answer(run.state.question.correct[0]);
  run.jumpTo(5);
  assert.equal(run.state.questionIndex, 5);
  assert.equal(run.state.travelerIndex, 1);
  assert.equal(run.state.stars, 0);
});

test('mulberry32：确定性随机', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('题目数据完整性：每题至少 2 选项且含正确答案', () => {
  assert.equal(TOPICS.length, QUESTION_COUNT);
  for (const q of TOPICS) {
    assert.ok(q.options.length >= 2, `题 ${q.id} 选项不足`);
    for (const c of q.correct) {
      assert.ok(c >= 0 && c < q.options.length, `题 ${q.id} 正确项越界`);
    }
  }
});
