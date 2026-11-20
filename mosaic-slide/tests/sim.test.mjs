import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { isSolvable, solvability, neighbors, solveScramble, indexToRC, rcToIndex } from '../src/game/solver.js';
import { createPattern } from '../src/game/pattern.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

test('mulberry32：同 seed 序列可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 20; i += 1) assert.equal(a(), b());
});

test('neighbors：四连通且不越界', () => {
  assert.deepEqual(neighbors(0, 3, 3).sort((x, y) => x - y), [1, 3]);
  assert.deepEqual(neighbors(4, 3, 3).sort((x, y) => x - y), [1, 3, 5, 7]);
  assert.deepEqual(neighbors(8, 3, 3).sort((x, y) => x - y), [5, 7]);
});

test('indexToRC / rcToIndex 互为逆', () => {
  for (const [i, cols] of [[0, 3], [5, 3], [8, 3], [11, 4]]) {
    const { r, c } = indexToRC(i, cols);
    assert.equal(rcToIndex(r, c, cols), i);
  }
});

test('可解性：完成态可解', () => {
  for (const lv of LEVELS) {
    const N = lv.rows * lv.cols;
    const board = [];
    for (let i = 0; i < N; i += 1) board.push(i);
    assert.equal(isSolvable(board, lv.rows, lv.cols), true, `L${lv.index} 完成态应可解`);
  }
});

test('可解性：经典 14-15 对调（4×4）不可解', () => {
  const board = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14];
  assert.equal(isSolvable(board, 4, 4), false);
});

test('可解性：3×3 两碎片对调不可解', () => {
  const board = [0, 2, 1, 3, 4, 5, 6, 7, 8];
  assert.equal(isSolvable(board, 3, 3), false);
});

test('shuffle：每关 run 的初始棋盘可解', () => {
  for (const lv of LEVELS) {
    for (const seed of [1, 7, 99]) {
      const run = createRun(lv.index - 1, { seed });
      assert.equal(isSolvable(run.state.board, lv.rows, lv.cols), true, `L${lv.index} seed=${seed} 应可解`);
    }
  }
});

test('slide：非相邻碎片不能滑动', () => {
  const run = createRun(0, { seed: 5 });
  // 找一个与缺口不相邻的格子
  const blank = run.state.blank;
  const nbs = new Set(neighbors(blank, run.state.rows, run.state.cols));
  let target = -1;
  for (let i = 0; i < run.state.rows * run.state.cols; i += 1) {
    if (i !== blank && !nbs.has(i)) { target = i; break; }
  }
  if (target >= 0) {
    const { r, c } = indexToRC(target, run.state.cols);
    assert.equal(run.slide(r, c).ok, false);
  }
});

test('slide：相邻碎片滑动后缺口移动、步数 +1', () => {
  const run = createRun(0, { seed: 5 });
  const before = run.state.blank;
  const nbs = neighbors(before, run.state.rows, run.state.cols);
  const { r, c } = indexToRC(nbs[0], run.state.cols);
  const res = run.slide(r, c);
  assert.equal(res.ok, true);
  assert.equal(run.state.blank, nbs[0]);
  assert.equal(run.state.moves, 1);
});

test('solveScramble：倒放缺口游走回到完成态并触发 win', () => {
  for (const idx of [0, 2, 4, 11]) {
    const run = createRun(idx, { seed: 123 });
    const sol = solveScramble(run._blankSeq, run._scrambleDepth);
    assert.equal(sol.length, run._scrambleDepth);
    for (const cell of sol) {
      if (run.state.phase !== 'playing') break;
      const { r, c } = indexToRC(cell, run.state.cols);
      assert.equal(run.slide(r, c).ok, true, `L${idx + 1} 解法步 ${cell} 应可滑`);
    }
    assert.equal(run.state.phase, 'won', `L${idx + 1} 应通关`);
    assert.equal(run.state.stars >= 1, true);
  }
});

test('旋转关：rotate 旋转 90°、步数 +1；非旋转关拒绝 rotate', () => {
  const normal = createRun(0, { seed: 3 });
  assert.equal(normal.rotate(0, 1).ok, false);
  const rotRun = createRun(6, { seed: 3 }); // L7 rotate
  assert.equal(rotRun.state.rotate, true);
  const t = rotRun.state.board[1];
  const before = rotRun.state.rot[1];
  const { r, c } = indexToRC(1, rotRun.state.cols);
  const res = rotRun.rotate(r, c);
  assert.equal(res.ok, true);
  assert.equal(rotRun.state.rot[1], (before + 1) % 4);
  assert.equal(rotRun.state.moves, 1);
});

test('盲拼关：peek 消耗次数、恢复参考图可见；非盲拼关拒绝 peek', () => {
  const normal = createRun(0, { seed: 3 });
  assert.equal(normal.peek().ok, false);
  const blind = createRun(7, { seed: 3 }); // L8 blind
  assert.equal(blind.state.blind, true);
  assert.equal(blind.state.peekLeft, GAME.PEEK_COUNT);
  assert.equal(blind.peek().ok, true);
  assert.equal(blind.state.peekLeft, GAME.PEEK_COUNT - 1);
  assert.equal(blind.state.reference.visible, true);
});

test('盲拼关：参考图 5 秒后隐藏', () => {
  const blind = createRun(7, { seed: 3 });
  for (let i = 0; i < 60 * 6; i += 1) blind.step(1 / 60);
  assert.equal(blind.state.reference.visible, false);
});

test('限时：时间耗尽触发 lose（death）', () => {
  const run = createRun(0, { seed: 3 });
  const level = LEVELS[0];
  for (let i = 0; i < (level.time + 1) * 60; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'lose' && e.reason === 'timeOut'));
});

test('三星：步数与时间都在目标内 → 3 星', () => {
  const run = createRun(0, { seed: 123 });
  const sol = solveScramble(run._blankSeq, run._scrambleDepth);
  for (const cell of sol) {
    const { r, c } = indexToRC(cell, run.state.cols);
    run.slide(r, c);
  }
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.stars, 3); // 解法恰为 scramble 步数（≤movePar），耗时≈0（≤timePar）
});

test('事件：win 同时发出 win 与 levelClear', () => {
  const run = createRun(0, { seed: 123 });
  const sol = solveScramble(run._blankSeq, run._scrambleDepth);
  for (const cell of sol) {
    const { r, c } = indexToRC(cell, run.state.cols);
    run.slide(r, c);
  }
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'win'));
  assert.ok(evs.some((e) => e.type === 'levelClear'));
  assert.ok(evs.some((e) => e.type === 'firstMove'));
  assert.ok(evs.some((e) => e.type === 'slide'));
  assert.ok(evs.some((e) => e.type === 'settle'));
  assert.ok(evs.some((e) => e.type === 'levelStart'));
});

test('图案：同关确定性；不同场景色板不同', () => {
  const p1 = createPattern(LEVELS[0]);
  const p2 = createPattern(LEVELS[0]);
  assert.equal(p1.cell(1, 1).fill, p2.cell(1, 1).fill);
  const night = createPattern(LEVELS[8]); // candle-night
  assert.notEqual(p1.cell(1, 1).fill, night.cell(1, 1).fill);
});

test('双图关：纹样 variant 按棋盘交织', () => {
  const dual = createRun(8, { seed: 3 }); // L9 dual
  assert.equal(dual.state.dual, true);
  const pat = createPattern(LEVELS[8]);
  assert.equal(pat.cell(0, 0).variant, 0);
  assert.equal(pat.cell(0, 1).variant, 1);
  assert.equal(pat.cell(1, 0).variant, 1);
});

test('solvability 返回逆序数与缺口距离', () => {
  const board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const r = solvability(board, 3, 3);
  assert.equal(r.inversions, 0);
  assert.equal(r.blankDist, 0);
  assert.equal(r.solvable, true);
});
