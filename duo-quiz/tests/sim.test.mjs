import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, currentQuestion, answer, tick, next, getHud, ROUND_COUNT } from '../src/game/sim.js';
import { QUESTIONS } from '../config/questions.js';
import { RULES, CONFIG } from '../config/game.config.js';

test('初始化：回合 0、比分 0、question 阶段', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.round, 0);
  assert.deepEqual(run.scores, [0, 0]);
  assert.equal(run.phase, 'question');
  assert.equal(run.order.length, RULES.rounds);
});

test('作答：双方都答 → 进入揭示', () => {
  const run = createRun({ seed: 1 });
  answer(run, 0, 0);
  assert.equal(run.phase, 'question');
  answer(run, 1, 1);
  assert.equal(run.phase, 'reveal');
});

test('答对得分：基础分 + 速度分', () => {
  const run = createRun({ seed: 1 });
  const q = currentQuestion(run);
  answer(run, 0, q.correct);
  answer(run, 1, q.correct);
  assert.ok(run.scores[0] >= RULES.baseScore);
  assert.ok(run.scores[0] <= RULES.baseScore + RULES.speedBonusMax);
});

test('答错不得分', () => {
  const run = createRun({ seed: 1 });
  const q = currentQuestion(run);
  const wrong = (q.correct + 1) % 4;
  answer(run, 0, wrong);
  answer(run, 1, q.correct);
  assert.equal(run.scores[0], 0);
  assert.ok(run.scores[1] > 0);
});

test('超时自动揭示', () => {
  const run = createRun({ seed: 1 });
  tick(run, RULES.roundTime + 1);
  assert.equal(run.phase, 'reveal');
});

test('重复作答被阻止', () => {
  const run = createRun({ seed: 1 });
  answer(run, 0, 0);
  const r = answer(run, 0, 1);
  assert.equal(r.ok, false);
  assert.equal(run.answers[0], 0);
});

test('下一题推进回合，最后一题后 done', () => {
  const run = createRun({ seed: 1, rounds: 2 });
  const q = currentQuestion(run);
  answer(run, 0, q.correct);
  answer(run, 1, q.correct);
  next(run);
  assert.equal(run.round, 1);
  assert.equal(run.phase, 'question');
  const q2 = currentQuestion(run);
  answer(run, 0, q2.correct);
  answer(run, 1, q2.correct);
  next(run);
  assert.equal(run.phase, 'done');
});

test('胜负判定：全对者胜', () => {
  const run = createRun({ seed: 1, rounds: 3 });
  for (let i = 0; i < 3; i += 1) {
    const q = currentQuestion(run);
    answer(run, 0, q.correct);
    answer(run, 1, (q.correct + 1) % 4);
    next(run);
  }
  assert.equal(run.phase, 'done');
  assert.ok(run.scores[0] > run.scores[1]);
});

test('题库完整性：每题 4 选项、正确索引合法', () => {
  for (const q of QUESTIONS) {
    assert.equal(q.options.length, 4);
    assert.ok(q.correct >= 0 && q.correct < 4);
    assert.ok(q.q.en && q.q.zh);
  }
});

test('配置默认值：10 回合 / en+zh / 20 题', () => {
  assert.equal(ROUND_COUNT, 10);
  assert.equal(QUESTIONS.length, 20);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ seed: 1 })).rounds, 10);
});