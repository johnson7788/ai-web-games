import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, computeStars, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';

test('createRun 初始进入记忆阶段，朋友数量与关卡一致', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'memorize');
  assert.equal(run.state.friends.length, LEVELS[0].persons);
  assert.equal(run.state.level, 1);
  assert.equal(run.state.hintLeft, 1);
});

test('memorizeDone 进入答题阶段并生成第一题', () => {
  const run = createRun(0, { seed: 1 });
  const res = run.memorizeDone();
  assert.equal(res.ok, true);
  assert.equal(run.state.phase, 'question');
  assert.ok(run.state.question);
  assert.ok(Array.isArray(run.state.question.options));
});

test('每位朋友的名字在关卡内唯一', () => {
  const run = createRun(4, { seed: 7 });
  const names = run.state.friends.map((f) => f.nameEn);
  assert.equal(new Set(names).size, names.length);
});

test('答题正确：得分 +100，连击 +1，并发出 correct 事件', () => {
  const run = createRun(0, { seed: 2 });
  run.memorizeDone();
  const q = run.state.question;
  const ci = q.options.indexOf(q.target);
  const res = run.answer(ci);
  assert.equal(res.correct, true);
  assert.equal(run.state.correct, 1);
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.score, 100);
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('correct'));
});

test('连续答对触发连击事件', () => {
  const run = createRun(1, { seed: 3 });
  run.memorizeDone();
  // 第一题
  run.answer(run.state.question.options.indexOf(run.state.question.target));
  run.step(0.5);
  // 第二题
  const q = run.state.question;
  run.answer(q.options.indexOf(q.target));
  assert.ok(run.state.combo >= 2);
  assert.equal(run.state.score, 100 + 200);
});

test('答错清空连击并发出 wrong 事件', () => {
  const run = createRun(0, { seed: 4 });
  run.memorizeDone();
  const q = run.state.question;
  const wi = q.options.findIndex((o) => o !== q.target);
  const res = run.answer(wi);
  assert.equal(res.correct, false);
  assert.equal(run.state.wrong, 1);
  assert.equal(run.state.combo, 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'wrong'));
});

test('扫描提示：移除一个错误选项且扣减次数', () => {
  const run = createRun(2, { seed: 5 }); // 第 3 关：3 个选项
  run.memorizeDone();
  const before = run.state.question.options.length;
  const res = run.revealHint();
  assert.equal(res.ok, true);
  assert.equal(run.state.question.options.length, before - 1);
  assert.equal(run.state.hintLeft, 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'hint'));
});

test('两选项问题扫描不生效（避免变成单选）', () => {
  const run = createRun(0, { seed: 6 }); // 第 1 关：2 个选项
  run.memorizeDone();
  const res = run.revealHint();
  assert.equal(res.ok, false);
  assert.equal(run.state.hintLeft, 1);
});

test('记忆阶段超时自动进入答题阶段', () => {
  const run = createRun(0, { seed: 8 });
  for (let i = 0; i < LEVELS[0].memorizeTime * 60 + 1; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'question');
});

test('全程无输入会因倒计时归零而失败', () => {
  const run = createRun(0, { seed: 9 });
  for (let i = 0; i < LEVELS[0].timeLimit * 60 + 10; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'lose');
  assert.equal(run.state.reason, 'timeOut');
});

test('答完所有题后胜利并结算星级', () => {
  const run = createRun(0, { seed: 10 });
  run.memorizeDone();
  let guard = 0;
  while (run.state.phase !== 'won' && guard++ < 1000) {
    if (run.state.phase === 'question' && run.state.question && !run.state.answered && run.state.transitionLeft <= 0) {
      run.answer(run.state.question.options.indexOf(run.state.question.target));
    }
    run.step(1 / 60);
  }
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
});

test('computeStars：0 失误 + 时间充足 = 3 星', () => {
  const stars = computeStars({ wrong: 0, timeLeft: 30, initialTime: 40 });
  assert.equal(stars, 3);
});

test('固定种子下关卡内容可复现', () => {
  const a = createRun(3, { seed: 42 });
  const b = createRun(3, { seed: 42 });
  assert.deepEqual(a.state.friends.map((f) => f.nameEn), b.state.friends.map((f) => f.nameEn));
  assert.deepEqual(a.state.questions, b.state.questions);
});

test('mulberry32 稳定输出', () => {
  const r1 = mulberry32(123);
  const r2 = mulberry32(123);
  assert.equal(r1(), r2());
  assert.equal(r1(), r2());
});
