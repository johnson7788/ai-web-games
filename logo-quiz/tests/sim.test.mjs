import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, answer, next, getHud, ROUND_COUNT } from '../src/game/sim.js';
import { BRANDS } from '../config/brands.js';
import { RULES, CONFIG } from '../config/game.config.js';

test('初始化：第 1 回合、4 选项、含正确答案', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.round, 0);
  assert.equal(run.phase, 'question');
  assert.equal(run.current.options.length, RULES.options);
  assert.ok(run.current.options.includes(run.current.brand.name));
  assert.equal(run.current.options[run.current.correct], run.current.brand.name);
});

test('选项无重复', () => {
  const run = createRun({ seed: 1 });
  assert.equal(new Set(run.current.options).size, RULES.options);
});

test('答对得分', () => {
  const run = createRun({ seed: 1 });
  const r = answer(run, run.current.correct);
  assert.equal(r.correct, true);
  assert.equal(run.score, RULES.scorePerCorrect);
  assert.equal(run.phase, 'reveal');
});

test('答错不得分', () => {
  const run = createRun({ seed: 1 });
  const wrong = (run.current.correct + 1) % RULES.options;
  const r = answer(run, wrong);
  assert.equal(r.correct, false);
  assert.equal(run.score, 0);
});

test('下一回合推进，末回合后 done', () => {
  const run = createRun({ seed: 1, rounds: 2 });
  answer(run, run.current.correct);
  next(run);
  assert.equal(run.round, 1);
  assert.equal(run.phase, 'question');
  answer(run, run.current.correct);
  next(run);
  assert.equal(run.phase, 'done');
});

test('reveal 阶段不能重复作答', () => {
  const run = createRun({ seed: 1 });
  answer(run, run.current.correct);
  assert.equal(answer(run, 0).ok, false);
});

test('品牌库完整性：名称唯一、图标/配色齐全', () => {
  const names = new Set();
  for (const b of BRANDS) {
    assert.ok(!names.has(b.name), `名称唯一 ${b.name}`);
    names.add(b.name);
    assert.ok(b.icon && b.color);
  }
});

test('可复现：同 seed 题目一致', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  assert.equal(a.current.brand.name, b.current.brand.name);
  assert.deepEqual(a.current.options, b.current.options);
});

test('配置默认值：12 回合 / 16 品牌 / en+zh', () => {
  assert.equal(ROUND_COUNT, 12);
  assert.equal(BRANDS.length, 16);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ seed: 1 })).rounds, 12);
});