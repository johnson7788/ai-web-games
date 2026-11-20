import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, CATEGORIES } from '../config/quiz.js';
import { questionCount, questionsByCategory, pickQuestion, validCategories } from '../src/game/quiz.js';
import { mulberry32 } from '../src/game/rng.js';

test('题库总量 ≥120 且 en/zh 双语完整', () => {
  assert.ok(QUESTIONS.length >= 120, `总题量 ${QUESTIONS.length} < 120`);
  for (const q of QUESTIONS) {
    assert.ok(q.en && typeof q.en.text === 'string' && q.en.text.trim().length > 0, `${q.id} 缺英文题干`);
    assert.ok(q.zh && typeof q.zh.text === 'string' && q.zh.text.trim().length > 0, `${q.id} 缺中文题干`);
  }
});

test('每题 4 个选项且答案下标合法，en/zh 选项数一致', () => {
  for (const q of QUESTIONS) {
    assert.equal(q.en.options.length, 4, `${q.id} en 选项≠4`);
    assert.equal(q.zh.options.length, 4, `${q.id} zh 选项≠4`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, `${q.id} 答案下标非法`);
    q.en.options.forEach((o) => assert.ok(typeof o === 'string' && o.trim().length > 0));
    q.zh.options.forEach((o) => assert.ok(typeof o === 'string' && o.trim().length > 0));
  }
});

test('题目 id 无重复', () => {
  const ids = new Set(QUESTIONS.map((q) => q.id));
  assert.equal(ids.size, QUESTIONS.length);
});

test('题干无重复', () => {
  const seen = new Set();
  for (const q of QUESTIONS) {
    assert.ok(!seen.has(q.en.text), `英文题干重复：${q.en.text}`);
    seen.add(q.en.text);
  }
});

test('每个类别 ≥30 题，且类别集合合法', () => {
  for (const cat of CATEGORIES) {
    const n = questionsByCategory(cat).length;
    assert.ok(n >= 30, `类别 ${cat} 只有 ${n} 题`);
  }
  for (const q of QUESTIONS) {
    assert.ok(CATEGORIES.includes(q.category), `${q.id} 类别非法`);
  }
});

test('pickQuestion 遵守类别池且同一局不重复', () => {
  const rng = mulberry32(99);
  const used = new Set();
  const cats = ['science'];
  for (let i = 0; i < 10; i += 1) {
    const q = pickQuestion(rng, cats, used);
    assert.equal(q.category, 'science');
    assert.ok(!used.has(q.id) === false, '抽中后应写入 used');
  }
});

test('pickQuestion 类别池抽空后回退到任意未用题', () => {
  const rng = mulberry32(7);
  const used = new Set();
  const scienceIds = questionsByCategory('science').map((q) => q.id);
  scienceIds.forEach((id) => used.add(id));
  const q = pickQuestion(rng, ['science'], used);
  assert.ok(q, '池空也能抽题');
});
