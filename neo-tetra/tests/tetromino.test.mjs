import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, cellsFor, rotState, kicksFor, COLOR_ID } from '../src/game/tetromino.js';

test('每种块 4 个旋转状态，每个状态 4 格', () => {
  for (const type of TYPES) {
    for (let r = 0; r < 4; r += 1) {
      const cells = cellsFor(type, r);
      assert.equal(cells.length, 4, `${type} rot${r} 应有 4 格`);
      for (const [x, y] of cells) {
        assert.ok(Number.isInteger(x) && Number.isInteger(y), `${type} rot${r} 坐标应为整数`);
      }
    }
  }
});

test('rotState 在 0..3 内环绕', () => {
  assert.equal(rotState('T', 0, 1), 1);
  assert.equal(rotState('T', 3, 1), 0);
  assert.equal(rotState('T', 0, -1), 3);
  assert.equal(rotState('T', 2, -1), 1);
});

test('O 块踢墙只有原点', () => {
  assert.deepEqual(kicksFor('O', 0, 1), [[0, 0]]);
});

test('I 块踢墙 0>1 有 5 个偏移，首项为原点', () => {
  const k = kicksFor('I', 0, 1);
  assert.equal(k.length, 5);
  assert.deepEqual(k[0], [0, 0]);
});

test('COLOR_ID 覆盖 7 种块且唯一', () => {
  const ids = Object.values(COLOR_ID);
  assert.equal(new Set(ids).size, 7);
});
