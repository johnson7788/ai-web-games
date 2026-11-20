import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORD_LIST, WORD_SET, WORD_COUNT } from '../config/words.js';

test('词库 ≥800 个', () => {
  assert.ok(WORD_COUNT >= 800, `词库只有 ${WORD_COUNT} 个`);
});

test('全部单词 3–8 字母且纯小写字母', () => {
  for (const w of WORD_LIST) {
    assert.match(w, /^[a-z]{3,8}$/, `非法单词：${w}`);
  }
});

test('无重复单词', () => {
  assert.equal(new Set(WORD_LIST).size, WORD_COUNT, '存在重复');
});

test('WORD_SET 与 WORD_LIST 一致', () => {
  assert.equal(WORD_SET.size, WORD_COUNT);
  for (const w of ['cat', 'word', 'heal', 'game', 'spell']) {
    assert.ok(WORD_SET.has(w), `缺常用词 ${w}`);
  }
});

test('长度分布覆盖 3–8', () => {
  const lens = new Set(WORD_LIST.map((w) => w.length));
  for (let i = 3; i <= 8; i += 1) assert.ok(lens.has(i), `缺 ${i} 字母词`);
});
