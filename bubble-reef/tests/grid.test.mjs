import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchCluster, floatingCells, snapToCell, traceShot, countBubbles, anyTouchingDeathLine,
} from '../src/game/grid.js';
import {
  COLS, colsInRow, rowX, rowY, rowIndexFromY, colFromX, neighborsOf, parityOf,
  TOP_Y, BUBBLE_R, DEATH_Y, WORLD, MAX_AIM,
} from '../config/gameplay.js';

// 由嵌套数组建网格：null = 空，0 = 岩礁，1..5 = 颜色
function mk(rows) {
  const grid = [];
  const parities = [];
  rows.forEach((row, r) => {
    parities[r] = r % 2;
    grid[r] = row.map((c) => (c == null ? null : { c, gold: false, wildcard: false }));
  });
  return { grid, parities };
}

test('colsInRow：parity 0 → COLS，parity 1 → COLS-1', () => {
  assert.equal(colsInRow(0), COLS);
  assert.equal(colsInRow(1), COLS - 1);
});

test('行列↔坐标互逆', () => {
  for (const p of [0, 1]) {
    for (const col of [0, 3, colsInRow(p) - 1]) {
      assert.equal(colFromX(rowX(p, col), p), col);
    }
  }
  for (const r of [0, 1, 5]) assert.equal(rowIndexFromY(rowY(r)), r);
});

test('neighborsOf：每个格子恰好 6 个邻居（含自身 parity 偏移）', () => {
  for (const p of [0, 1]) {
    const n = neighborsOf(p);
    assert.equal(n.length, 6);
    const set = new Set(n.map(([dr, dc]) => `${dr},${dc}`));
    assert.equal(set.size, 6);
  }
});

test('matchCluster：同色 3 连通返回 3', () => {
  const { grid, parities } = mk([
    [1, 1, 1],
  ]);
  const out = matchCluster(grid, parities, 0, 0);
  assert.equal(out.length, 3);
});

test('matchCluster：少于 3 个返回空', () => {
  const { grid, parities } = mk([
    [1, 1, null],
  ]);
  assert.deepEqual(matchCluster(grid, parities, 0, 0), []);
});

test('matchCluster：岩礁泡（c=0）不可消', () => {
  const { grid, parities } = mk([
    [0, 0, 0],
  ]);
  assert.deepEqual(matchCluster(grid, parities, 0, 0), []);
});

test('floatingCells：顶行悬空则整簇掉落', () => {
  const { grid, parities } = mk([
    [null, null],
    [null, null],
    [1, null],
  ]);
  const out = floatingCells(grid, parities);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { row: 2, col: 0 });
});

test('floatingCells：连接到顶行则不掉落', () => {
  const { grid, parities } = mk([
    [null, null, null, 1],
    [null, null, null, 1],
  ]);
  // (1,3) 是 (0,3) 的下邻（parity0 的 down-right）
  const out = floatingCells(grid, parities);
  assert.equal(out.length, 0);
});

test('snapToCell：返回最近空格', () => {
  const { grid, parities } = mk([[null, null, null]]);
  const p = rowX(0, 1);
  const cell = snapToCell(grid, parities, p, rowY(0));
  assert.deepEqual(cell, { row: 0, col: 1 });
});

test('traceShot：直射触顶落顶行', () => {
  const { grid, parities } = mk([[null, null, null]]);
  const tr = traceShot(grid, parities, 0);
  assert.equal(tr.hitTop, true);
  assert.ok(tr.landing);
  assert.equal(tr.landing.row, 0);
});

test('traceShot：左右壁反弹仍在场内', () => {
  const { grid, parities } = mk([[null, null, null]]);
  const tr = traceShot(grid, parities, MAX_AIM);
  for (const p of tr.points) {
    assert.ok(p.x >= BUBBLE_R - 1 && p.x <= WORLD.WIDTH - BUBBLE_R + 1, `x=${p.x} 出界`);
  }
});

test('countBubbles：统计非空格子', () => {
  const { grid } = mk([[1, 0, 2], [null, 3]]);
  assert.equal(countBubbles(grid), 4);
});

test('anyTouchingDeathLine：泡泡触底返回 true', () => {
  const { grid, parities } = mk([[null]]);
  grid[0][0] = { c: 1, gold: false, wildcard: false };
  const r = Math.ceil((DEATH_Y - TOP_Y - BUBBLE_R) / (2 * BUBBLE_R * Math.sqrt(3) / 2)) + 1;
  grid[r] = [];
  grid[r][0] = { c: 1, gold: false, wildcard: false };
  assert.equal(anyTouchingDeathLine(grid, DEATH_Y), true);
});

test('parityOf：越界行按 row%2 兜底', () => {
  assert.equal(parityOf([], 0), 0);
  assert.equal(parityOf([], 1), 1);
});
