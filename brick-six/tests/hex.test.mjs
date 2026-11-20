import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allCells, buildLines, neighbors, rotateOffsets, normalizeOffsets, isConnected, SIDE, RADIUS,
} from '../src/game/hex.js';

test('allCells 生成 61 格（side=5）', () => {
  const cells = allCells();
  assert.equal(cells.length, 3 * SIDE * SIDE - 3 * SIDE + 1);
  for (const { q, r } of cells) {
    assert.ok(Math.abs(q) <= RADIUS && Math.abs(r) <= RADIUS && Math.abs(q + r) <= RADIUS);
  }
});

test('buildLines 生成 3 方向 × 9 条 = 27 条消除线', () => {
  const lines = buildLines(allCells());
  assert.equal(lines.length, 27);
  const lens = lines.map((l) => l.length).sort((a, b) => a - b);
  const expected = [];
  for (let i = 0; i < 3; i += 1) expected.push(5, 5, 6, 6, 7, 7, 8, 8, 9);
  expected.sort((a, b) => a - b);
  assert.deepEqual(lens, expected);
});

test('每个格子属于恰好 3 条线', () => {
  const cells = allCells();
  const key = ({ q, r }) => `${q},${r}`;
  const count = new Map(cells.map((c) => [key(c), 0]));
  for (const line of buildLines(cells)) {
    for (const c of line) count.set(key(c), count.get(key(c)) + 1);
  }
  for (const v of count.values()) assert.equal(v, 3);
});

test('neighbors 返回 6 个且互相可达', () => {
  const ns = neighbors(0, 0);
  assert.equal(ns.length, 6);
  for (const [q, r] of ns) {
    assert.ok(neighbors(q, r).some(([qq, rr]) => qq === 0 && rr === 0), '邻域应含原点');
  }
});

test('rotateOffsets 旋转 6 次回到原位', () => {
  const shape = [[0, 0], [1, 0], [0, 1]];
  let o = shape;
  for (let i = 0; i < 6; i += 1) o = rotateOffsets(o);
  assert.deepEqual(o.sort(), shape.sort());
});

test('normalizeOffsets 去重并平移', () => {
  const norm = normalizeOffsets([[2, 3], [2, 3], [3, 3]]);
  assert.equal(norm.length, 2);
  assert.ok(norm.some(([q, r]) => q === 0 && r === 0), '应有锚点 0,0');
});

test('isConnected 判断连通性', () => {
  assert.ok(isConnected([[0, 0], [1, 0], [0, 1]]));
  assert.ok(!isConnected([[0, 0], [2, 0]]), '间隔的格子不连通');
});
