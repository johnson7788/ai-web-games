import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestion, generateGrid, pickBlankIndices } from '../src/game/questions.js';
import { mulberry32 } from '../src/game/rng.js';

test('pickBlankIndices：返回指定数量且不重复、升序', () => {
  const rng = mulberry32(7);
  const idx = pickBlankIndices(rng, 4, 2);
  assert.equal(idx.length, 2);
  assert.equal(new Set(idx).size, 2);
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
  assert.ok(idx[0] >= 0 && idx[1] <= 3);
});

test('中文填空：答案为 4 字、缺字位置合法、释义为 clue', () => {
  const q = generateQuestion({ lang: 'zh', blanks: 1, riddle: false, rng: mulberry32(1), used: new Set() });
  assert.equal(q.kind, 'fill');
  assert.equal(q.answer.length, 4);
  assert.equal(q.blanks.length, 1);
  assert.ok(q.blanks[0] >= 0 && q.blanks[0] < 4);
  assert.ok(q.clue && q.clue.length > 0);
  assert.equal(q.riddle, false);
  assert.equal(q.mult, 1);
});

test('中文双缺字：两个不重复位置', () => {
  const q = generateQuestion({ lang: 'zh', blanks: 2, riddle: false, rng: mulberry32(2), used: new Set() });
  assert.equal(q.blanks.length, 2);
  assert.equal(new Set(q.blanks).size, 2);
});

test('中文字谜：单字答案、riddle=true、mult=2', () => {
  const q = generateQuestion({ lang: 'zh', blanks: 1, riddle: true, rng: mulberry32(3), used: new Set() });
  assert.equal(q.kind, 'riddle');
  assert.equal(q.answer.length, 1);
  assert.deepEqual(q.blanks, [0]);
  assert.equal(q.riddle, true);
  assert.equal(q.mult, 2);
});

test('英文填空：4 字母答案', () => {
  const q = generateQuestion({ lang: 'en', blanks: 1, riddle: false, rng: mulberry32(4), used: new Set() });
  assert.equal(q.answer.length, 4);
  assert.match(q.answer.join(''), /^[A-Z]{4}$/);
  assert.equal(q.blanks.length, 1);
});

test('英文字谜：4 字母全空、riddle=true、mult=2', () => {
  const q = generateQuestion({ lang: 'en', blanks: 2, riddle: true, rng: mulberry32(5), used: new Set() });
  assert.deepEqual(q.blanks, [0, 1, 2, 3]);
  assert.equal(q.riddle, true);
  assert.equal(q.mult, 2);
});

test('候选字格：含正确字、无重复、大小等于 gridSize', () => {
  const rng = mulberry32(6);
  const q = generateQuestion({ lang: 'zh', blanks: 1, riddle: false, rng, used: new Set() });
  const grid = generateGrid({ question: q, gridSize: 8, lang: 'zh', rng });
  assert.equal(grid.length, 8);
  assert.equal(new Set(grid).size, 8, '字格不应重复');
  const want = q.answer[q.blanks[0]];
  assert.ok(grid.includes(want), '字格应包含正确字');
});

test('同 seed 同输入 → 同题目与字格（确定性）', () => {
  const a = generateQuestion({ lang: 'en', blanks: 1, riddle: false, rng: mulberry32(42), used: new Set() });
  const b = generateQuestion({ lang: 'en', blanks: 1, riddle: false, rng: mulberry32(42), used: new Set() });
  assert.deepEqual(a.answer, b.answer);
  assert.deepEqual(a.blanks, b.blanks);
});
