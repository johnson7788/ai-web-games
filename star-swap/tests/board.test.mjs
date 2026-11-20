import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  idx, rc, inBounds, isDark, isColored, cloneGrid,
  findAllMatches, areAdjacent, hasValidMove, findValidSwaps,
  resolveBoard, createGrid, shuffleGrid, evaluateSwap,
} from '../src/game/board.js';
import { BOARD, GRAVITY, SPECIAL } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const R = BOARD.ROWS;
const C = BOARD.COLS;

function cell(color, special = 0, dark = false) {
  return dark ? { color: -1, special: 0, dark: true } : { color, special, dark: false };
}
function emptyGrid() { return new Array(R * C).fill(null); }

// 无任何相邻同色的棋盘基底（(r+c)%5 模色，横竖相邻都差 1）
function checker() {
  const g = emptyGrid();
  for (let r = 0; r < R; r += 1) for (let c = 0; c < C; c += 1) g[idx(r, c)] = cell((r + c) % 5);
  return g;
}

function fillGrid(rows) {
  const g = emptyGrid();
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < rows[r].length; c += 1) {
      const ch = rows[r][c];
      if (ch === '.') g[idx(r, c)] = null;
      else if (ch === '#') g[idx(r, c)] = cell(0, 0, true);
      else g[idx(r, c)] = cell(Number(ch));
    }
  }
  return g;
}

test('idx/rc 互逆且 inBounds 正确', () => {
  for (let i = 0; i < R * C; i += 1) {
    const { r, c } = rc(i);
    assert.equal(idx(r, c), i);
    assert.ok(inBounds(r, c));
  }
  assert.ok(!inBounds(-1, 0));
  assert.ok(!inBounds(0, C));
});

test('findAllMatches 识别横向三连', () => {
  const g = checker();
  g[idx(0, 0)] = cell(0); g[idx(0, 1)] = cell(0); g[idx(0, 2)] = cell(0);
  const m = findAllMatches(g);
  assert.equal(m.length, 1);
  assert.equal(m[0].dir, 'h');
  assert.equal(m[0].len, 3);
  assert.equal(m[0].color, 0);
});

test('findAllMatches 识别纵向四连', () => {
  const g = checker();
  g[idx(0, 0)] = cell(1); g[idx(1, 0)] = cell(1); g[idx(2, 0)] = cell(1); g[idx(3, 0)] = cell(1);
  const m = findAllMatches(g);
  assert.equal(m.length, 1);
  assert.equal(m[0].dir, 'v');
  assert.equal(m[0].len, 4);
});

test('暗物质格不参与连线', () => {
  const g = checker();
  g[idx(0, 0)] = cell(0); g[idx(0, 1)] = cell(0); g[idx(0, 2)] = cell(0);
  g[idx(0, 2)] = cell(0, 0, true); // 打断
  const m = findAllMatches(g);
  assert.equal(m.length, 0);
});

test('areAdjacent 判定', () => {
  assert.ok(areAdjacent(idx(0, 0), idx(0, 1)));
  assert.ok(areAdjacent(idx(0, 0), idx(1, 0)));
  assert.ok(!areAdjacent(idx(0, 0), idx(1, 1)));
  assert.ok(!areAdjacent(idx(0, 0), idx(0, 2)));
});

test('createGrid 无现成连线且有解', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const g = createGrid(mulberry32(seed), { colors: 5 });
    assert.equal(findAllMatches(g).length, 0, `seed=${seed} 不应有现成连线`);
    assert.ok(hasValidMove(g), `seed=${seed} 应有解`);
  }
});

test('createGrid 带暗物质格仍可解且暗格在位', () => {
  const g = createGrid(mulberry32(3), { colors: 5, darkCells: [{ r: 0, c: 0 }, { r: 7, c: 7 }] });
  assert.equal(findAllMatches(g).length, 0);
  assert.ok(hasValidMove(g));
  assert.ok(isDark(g[idx(0, 0)]));
  assert.ok(isDark(g[idx(7, 7)]));
});

test('resolveBoard 消三连并落下补给', () => {
  const g = checker();
  g[idx(0, 0)] = cell(0); g[idx(0, 1)] = cell(0); g[idx(0, 2)] = cell(0);
  const events = [];
  const res = resolveBoard(g, (e) => events.push(e), { rng: mulberry32(1), colors: 5 });
  assert.ok(res.cleared >= 3);
  assert.ok(res.score > 0);
  assert.equal(findAllMatches(g).length, 0, '解析后应无现成连线');
  assert.ok(events.some((e) => e.type === 'match'));
  assert.ok(events.some((e) => e.type === 'clearStar'));
});

test('四连生成特殊星（行爆）', () => {
  const g = checker();
  g[idx(0, 0)] = cell(1); g[idx(0, 1)] = cell(1); g[idx(0, 2)] = cell(1); g[idx(0, 3)] = cell(1);
  const events = [];
  resolveBoard(g, (e) => events.push(e), { rng: mulberry32(1), colors: 5, swapCells: [idx(0, 3)] });
  const spec = events.filter((e) => e.type === 'specialCreate');
  assert.equal(spec.length, 1);
  assert.equal(spec[0].special, SPECIAL.ROW);
  assert.equal(spec[0].i, idx(0, 3));
});

test('纵向四连生成列爆星', () => {
  const g = checker();
  g[idx(0, 2)] = cell(2); g[idx(1, 2)] = cell(2); g[idx(2, 2)] = cell(2); g[idx(3, 2)] = cell(2);
  const events = [];
  resolveBoard(g, (e) => events.push(e), { rng: mulberry32(1), colors: 5, swapCells: [idx(3, 2)] });
  const spec = events.filter((e) => e.type === 'specialCreate');
  assert.equal(spec.length, 1);
  assert.equal(spec[0].special, SPECIAL.COL);
});

test('五连生成超新星', () => {
  const g = checker();
  g[idx(0, 0)] = cell(3); g[idx(0, 1)] = cell(3); g[idx(0, 2)] = cell(3); g[idx(0, 3)] = cell(3); g[idx(0, 4)] = cell(3);
  const events = [];
  resolveBoard(g, (e) => events.push(e), { rng: mulberry32(1), colors: 5, swapCells: [idx(0, 2)] });
  const spec = events.filter((e) => e.type === 'specialCreate');
  assert.equal(spec.length, 1);
  assert.equal(spec[0].special, SPECIAL.NOVA);
});

test('特殊星被消触发爆发', () => {
  const g = checker();
  // (0,0) 行爆星（色0）与 (0,1)(0,2) 同色成三连 → 被清 → 爆发清整行
  g[idx(0, 0)] = cell(0, SPECIAL.ROW);
  g[idx(0, 1)] = cell(0);
  g[idx(0, 2)] = cell(0);
  const events = [];
  resolveBoard(g, (e) => events.push(e), { rng: mulberry32(1), colors: 5 });
  assert.ok(events.some((e) => e.type === 'specialBlast' && e.special === SPECIAL.ROW));
  assert.ok(events.some((e) => e.type === 'clearStar' && e.c === 7), '行爆应波及最右列');
});

test('暗物质格被相邻特殊星爆开', () => {
  const g = checker();
  // 第 0 列 (0,0)(1,0)(2,0) 同色 0 成竖三连，其中 (1,0) 是列爆星 → 被清爆发 → 相邻 (1,1) 暗格被爆开
  g[idx(0, 0)] = cell(0);
  g[idx(1, 0)] = cell(0, SPECIAL.COL);
  g[idx(2, 0)] = cell(0);
  g[idx(1, 1)] = cell(0, 0, true);
  const events = [];
  resolveBoard(g, (e) => events.push(e), { rng: mulberry32(1), colors: 5 });
  assert.ok(events.some((e) => e.type === 'specialBlast' && e.special === SPECIAL.COL));
  assert.ok(events.some((e) => e.type === 'darkBreak'));
});

test('evaluateSwap 有效交换返回 valid 且不改原盘', () => {
  const g = checker();
  g[idx(0, 0)] = cell(0); g[idx(0, 1)] = cell(0); g[idx(0, 3)] = cell(0);
  // 交换 (0,2)(0,3)：row0 变为 0 0 0 2 → 三连
  const before = cloneGrid(g);
  const r = evaluateSwap(g, idx(0, 2), idx(0, 3), 5);
  assert.ok(r.valid);
  assert.ok(r.cleared >= 3);
  assert.deepEqual(g, before);
});

test('evaluateSwap 无效交换返回 valid=false 且不改原盘', () => {
  const g = checker(); // 无相邻同色 → 任意相邻交换都无效
  const before = cloneGrid(g);
  const r = evaluateSwap(g, idx(0, 0), idx(0, 1), 5);
  assert.equal(r.valid, false);
  assert.deepEqual(g, before);
});

test('findValidSwaps 在有解棋盘上非空且均为相邻', () => {
  const g = createGrid(mulberry32(11), { colors: 5 });
  const swaps = findValidSwaps(g);
  assert.ok(swaps.length > 0);
  for (const [a, b] of swaps) assert.ok(areAdjacent(a, b));
});

test('shuffleGrid 把无解棋盘重排成有解', () => {
  const g = checker(); // 无任何相邻同色 → 无解
  assert.equal(hasValidMove(g), false);
  const ok = shuffleGrid(mulberry32(5), g, 5);
  assert.ok(ok);
  assert.ok(hasValidMove(g));
});

test('重力反转：星屑从底部补给、无空洞', () => {
  const g = checker();
  g[idx(0, 0)] = cell(0); g[idx(0, 1)] = cell(0); g[idx(0, 2)] = cell(0);
  const events = [];
  resolveBoard(g, (e) => events.push(e), { rng: mulberry32(1), colors: 5, gravity: GRAVITY.UP });
  assert.ok(events.some((e) => e.type === 'refill'));
  for (let i = 0; i < R * C; i += 1) assert.ok(g[i] != null);
});
