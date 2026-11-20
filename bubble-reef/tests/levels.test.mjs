import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, levelAt } from '../config/levels.js';

test('levels：共 12 关，index 连续 1..12', () => {
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((l, i) => assert.equal(l.index, i + 1));
});

test('levels：颜色数与清除率合法', () => {
  for (const l of LEVELS) {
    assert.ok(l.colors === 4 || l.colors === 5);
    assert.ok(l.clearance > 0 && l.clearance <= 1);
    assert.ok(l.shotsToSink >= 1);
  }
});

test('levels：三场景包轮换', () => {
  const packs = new Set(LEVELS.map((l) => l.pack));
  assert.deepEqual([...packs].sort(), ['night', 'shallow', 'wreck']);
});

test('levels：每关字段齐全（颜色/行数/清除率/下沉间隔/场景包）', () => {
  for (const l of LEVELS) {
    assert.ok(Number.isInteger(l.index));
    assert.ok(Number.isInteger(l.colors));
    assert.ok(Number.isInteger(l.rows) && l.rows >= 3);
    assert.ok(typeof l.clearance === 'number');
    assert.ok(Number.isInteger(l.shotsToSink) && l.shotsToSink >= 1);
    assert.ok(['shallow', 'night', 'wreck'].includes(l.pack));
    assert.ok(Number.isInteger(l.rocks));
    assert.ok(typeof l.drift === 'number');
  }
});

test('levelAt：越界安全夹取', () => {
  assert.equal(levelAt(1).index, 1);
  assert.equal(levelAt(0).index, 1);
  assert.equal(levelAt(13).index, 12);
  assert.equal(levelAt(999).index, 12);
});
