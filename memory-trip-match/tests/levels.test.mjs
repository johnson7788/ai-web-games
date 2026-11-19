import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT, levelFor } from '../config/levels.js';

test('共 20 关', () => {
  assert.equal(LEVEL_COUNT, 20);
  assert.equal(LEVELS.length, 20);
});

test('配对数 3→22 逐关 +1（复刻参考 count 曲线）', () => {
  assert.equal(LEVELS[0].pairs, 3);
  assert.equal(LEVELS[LEVELS.length - 1].pairs, 22);
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.equal(LEVELS[i].pairs, LEVELS[i - 1].pairs + 1);
  }
});

test('步数预算 = 配对数 × 3', () => {
  for (const lv of LEVELS) {
    assert.equal(lv.moveBudget, lv.pairs * 3);
  }
});

test('第 5 关起才有岩石卡', () => {
  assert.equal(LEVELS[0].rockPairs, 0);
  assert.equal(LEVELS[3].rockPairs, 0); // L4 无岩石
  assert.ok(LEVELS[4].rockPairs >= 1);  // L5 引入岩石
});

test('levelFor 边界夹取安全', () => {
  assert.equal(levelFor(-1).index, 1);
  assert.equal(levelFor(999).index, 20);
  assert.equal(levelFor(0).index, 1);
});
