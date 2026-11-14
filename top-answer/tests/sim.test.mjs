import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, submitGuess, useHint, revealAll, isComplete, foundCount, getHud, normEn, QUESTION_COUNT,
} from '../src/game/sim.js';
import { QUESTIONS } from '../config/questions.js';
import { RULES, CONFIG } from '../config/game.config.js';

test('初始化：第 1 题 6 答案、全未揭示、0 分', () => {
  const run = createRun({ questionIndex: 0 });
  assert.equal(run.answers.length, 6);
  assert.equal(foundCount(run), 0);
  assert.equal(run.score, 0);
  assert.equal(run.phase, 'playing');
});

test('猜对：揭示答案并按热度加分', () => {
  const run = createRun({ questionIndex: 0 });
  const r = submitGuess(run, 'pepperoni');
  assert.equal(r.ok, true);
  assert.equal(r.points, 35);
  assert.equal(run.score, 35);
  assert.equal(run.answers[0].revealed, true);
});

test('匹配大小写/空格不敏感', () => {
  const run = createRun({ questionIndex: 0 });
  assert.equal(submitGuess(run, '  PEPPERONI  ').ok, true);
});

test('匹配英文别名：mozzarella → Cheese', () => {
  const run = createRun({ questionIndex: 0 });
  const r = submitGuess(run, 'mozzarella');
  assert.equal(r.ok, true);
  assert.equal(r.index, 1, 'Cheese 是第 2 个答案');
});

test('匹配中文答案：芝士 → Cheese', () => {
  const run = createRun({ questionIndex: 0 });
  const r = submitGuess(run, '芝士');
  assert.equal(r.ok, true);
  assert.equal(r.index, 1);
});

test('猜错：miss 不揭示不加分', () => {
  const run = createRun({ questionIndex: 0 });
  const r = submitGuess(run, 'pineapple'); // 不在披萨题
  assert.equal(r.kind, 'miss');
  assert.equal(foundCount(run), 0);
  assert.equal(run.score, 0);
});

test('重复猜：already', () => {
  const run = createRun({ questionIndex: 0 });
  submitGuess(run, 'pepperoni');
  const r = submitGuess(run, 'pepperoni');
  assert.equal(r.kind, 'already');
  assert.equal(run.score, 35, '不重复加分');
});

test('全部揭示 → complete + clear 事件', () => {
  const run = createRun({ questionIndex: 5 }); // 4 季节
  for (const a of run.answers) submitGuess(run, a.en);
  assert.equal(isComplete(run), true);
  assert.equal(run.phase, 'complete');
});

test('提示：标记首字母、扣次数、用尽 null', () => {
  const run = createRun({ questionIndex: 0 });
  for (let i = 0; i < RULES.hintLimit; i += 1) {
    const h = useHint(run);
    assert.ok(h && typeof h.char === 'string', `第 ${i + 1} 次提示`);
    assert.equal(run.answers[h.index].hinted, true);
  }
  assert.equal(useHint(run), null, '提示用尽');
});

test('揭示全部：剩余不得分但回合结束', () => {
  const run = createRun({ questionIndex: 0 });
  submitGuess(run, 'pepperoni'); // 35
  const before = run.score;
  assert.equal(revealAll(run), true);
  assert.equal(run.score, before, '揭示不加分');
  assert.equal(isComplete(run), true);
  assert.equal(run.phase, 'complete');
});

test('normEn：去空格/标点/大小写', () => {
  assert.equal(normEn('Hot Chocolate!'), 'hotchocolate');
  assert.equal(normEn('  PEPPERONI '), 'pepperoni');
  assert.equal(normEn('热巧克力'), '', '中文被英文化为空（走中文匹配）');
});

test('配置默认值：10 题 / en+zh / 3 提示', () => {
  assert.equal(QUESTION_COUNT, 10);
  assert.equal(QUESTION_COUNT, QUESTIONS.length);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(RULES.hintLimit, 3);
  assert.equal(getHud(createRun({ questionIndex: 0 })).total, 6);
});