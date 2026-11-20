import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, randInt, shuffle } from '../src/game/rng.js';

test('mulberry32：同 seed 产生同序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});

test('mulberry32：不同 seed 产生不同序列', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  assert.notEqual(a(), b());
});

test('randInt：结果落在闭区间内', () => {
  const rng = mulberry32(5);
  for (let i = 0; i < 200; i += 1) {
    const v = randInt(rng, 3, 6);
    assert.ok(v >= 3 && v <= 6);
  }
});

test('shuffle：不改原数组并保持元素集合', () => {
  const rng = mulberry32(8);
  const arr = [0, 1, 2, 3, 4];
  const out = shuffle(rng, arr);
  assert.equal(arr.length, 5);
  assert.deepEqual([...out].sort(), [0, 1, 2, 3, 4]);
});
