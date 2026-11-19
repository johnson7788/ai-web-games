import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDIOMS, DIFFICULTIES } from '../config/idioms.js';

test('三档难度都存在', () => {
  assert.deepEqual(Object.keys(DIFFICULTIES).map(Number).sort(), [1, 2, 3]);
});

test('分值符合 P0：简单 1 / 复杂 1.5 / 困难 2', () => {
  assert.equal(DIFFICULTIES[1].points, 1);
  assert.equal(DIFFICULTIES[2].points, 1.5);
  assert.equal(DIFFICULTIES[3].points, 2);
});

test('每档题库至少 12 个成语（足够推进到第 3 驿站）', () => {
  for (const d of [1, 2, 3]) {
    assert.ok(IDIOMS[d].length >= 12, `difficulty ${d} 只有 ${IDIOMS[d].length} 个`);
  }
});

test('所有成语均为 4 个字符且释义非空', () => {
  for (const d of [1, 2, 3]) {
    for (const entry of IDIOMS[d]) {
      assert.equal(Array.from(entry.idiom).length, 4, `${entry.idiom} 不是 4 字`);
      assert.ok(entry.meaningZh && entry.meaningZh.trim().length > 0, `${entry.idiom} 缺 zh 释义`);
      assert.ok(entry.meaningEn && entry.meaningEn.trim().length > 0, `${entry.idiom} 缺 en 释义`);
    }
  }
});

test('同一难度内无重复成语', () => {
  for (const d of [1, 2, 3]) {
    const set = new Set(IDIOMS[d].map((e) => e.idiom));
    assert.equal(set.size, IDIOMS[d].length, `difficulty ${d} 有重复`);
  }
});

test('三档成语互不重复（换皮后独立出题）', () => {
  const all = new Set();
  for (const d of [1, 2, 3]) for (const e of IDIOMS[d]) all.add(e.idiom);
  const total = IDIOMS[1].length + IDIOMS[2].length + IDIOMS[3].length;
  assert.equal(all.size, total);
});
