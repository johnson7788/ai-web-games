import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  X, O, LINES, winner, winningLine, isFull, empties, mulberry32,
  bestMove, greedyMove, randomMove, canForceWin, canForceDraw, winningMoves, drawingMoves,
  createRun, createEndless,
} from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';

const b = (s) => s.split('').map((c) => (c === 'X' ? X : c === 'O' ? O : null));

test('winner：行/列/对角线/无胜负', () => {
  assert.equal(winner(b('XXX......')), X);
  assert.equal(winner(b('X..X..X..')), X);
  assert.equal(winner(b('...OOO...')), O);
  assert.equal(winner(b('X..OX..OX')), X); // 对角线 0,4,8
  assert.equal(winner(b('XOOOXXOXO')), null); // 满盘无三连（真平局）
  assert.equal(winner(b('.........')), null);
});

test('winningLine：返回正确的三连', () => {
  assert.deepEqual(winningLine(b('XXX......')), [0, 1, 2]);
  assert.deepEqual(winningLine(b('X..X..X..')), [0, 3, 6]);
  assert.equal(winningLine(b('XOOOXXOXO')), null);
});

test('isFull / empties', () => {
  assert.equal(isFull(b('XOOOXXOXO')), true);
  assert.equal(isFull(b('XOXOOXXO.')), false);
  assert.deepEqual(empties(b('X........')), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('mulberry32：同 seed 可复现', () => {
  const a = mulberry32(42)();
  const r1 = mulberry32(42)();
  assert.equal(a, r1);
});

test('bestMove：完美 AI 能赢即赢（O 两子成线）', () => {
  // X@0,1,6 O@4,5（#X=3,#O=2，O 先手）→ O 走 3 成行
  assert.equal(bestMove(b('XX..OOX..'), O), 3);
});

test('bestMove：完美 AI 堵对手威胁（不堵则负）', () => {
  // X@0,1,6 O@4,8（#X=3,#O=2，O 先手，X 威胁顶行）→ O 必须堵 2
  assert.equal(bestMove(b('XX..O.X.O'), O), 2);
});

test('greedyMove：能赢即赢', () => {
  assert.equal(greedyMove(b('XX..O....'), X, Math.random), 2);
});

test('greedyMove：堵对手威胁', () => {
  assert.equal(greedyMove(b('XX..O....'), O, Math.random), 2);
});

test('greedyMove：空盘优先中心', () => {
  assert.equal(greedyMove(b('.........'), X, Math.random), 4);
});

test('randomMove：返回空格', () => {
  const board = b('X........');
  const m = randomMove(board, mulberry32(1));
  assert.ok(board[m] == null);
  assert.ok(m >= 0 && m <= 8 && m !== 0);
});

test('canForceWin：win-in-1 残局', () => {
  const board = b('XX..O...O'); // L1
  assert.equal(canForceWin(board, 1), true);
  assert.equal(canForceWin(board, 0), false);
});

test('canForceWin：win-in-2 残局（fork）', () => {
  const board = b('X..O...XO'); // L3
  assert.equal(canForceWin(board, 2), true);
  assert.equal(canForceWin(board, 1), false);
});

test('canForceDraw：L12 逼平完美蝎子', () => {
  const board = b('..XO.XOXO');
  assert.equal(canForceWin(board, 3), false);
  assert.equal(canForceDraw(board), true);
});

test('winningMoves / drawingMoves', () => {
  assert.deepEqual(winningMoves(b('XX..O...O'), 1), [2]);
  assert.deepEqual(drawingMoves(b('..XO.XOXO')), [0]);
});

test('createRun：谜题 state 形状', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.mode, 'puzzle');
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.turn, X);
  assert.equal(s.movesLimit, 1);
  assert.equal(s.goal, 'win');
  assert.equal(s.board.length, 9);
});

test('puzzle place：win-in-1 走必胜格 → won', () => {
  const r = createRun(0, { seed: 1 });
  const res = r.place(2);
  assert.equal(res.ok, true);
  assert.equal(res.won, true);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.outcome, 'win');
});

test('puzzle place：win-in-1 走错格 → lost outOfMoves', () => {
  const r = createRun(0, { seed: 1 });
  const res = r.place(6);
  assert.equal(res.ok, true);
  assert.equal(res.lost, true);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'outOfMoves');
});

test('puzzle place：占用/越界 校验', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.place(0), { ok: false, reason: 'occupied' });
  assert.deepEqual(r.place(-1), { ok: false, reason: 'bounds' });
  assert.deepEqual(r.place(9), { ok: false, reason: 'bounds' });
});

test('puzzle place：win-in-2 fork 两回合获胜', () => {
  const r = createRun(2, { seed: 1 }); // L3 win-in-2
  const first = r.place(1); // winningMoves=[1]
  assert.equal(first.ok, true);
  assert.equal(r.state.phase, 'playing'); // 蝎子已回应，未结束
  // 继续走必胜格直到结束
  const k = r.state.movesLimit - r.state.movesMade;
  const wm = winningMoves(r.state.board, k);
  assert.ok(wm.length > 0);
  const res = r.place(wm[0]);
  assert.equal(r.state.phase, 'won');
});

test('L12 逼平：走唯一逼平格 → won（draw 目标）', () => {
  const r = createRun(11, { seed: 1 }); // L12
  assert.equal(r.state.goal, 'draw');
  const res = r.place(0); // drawingMoves=[0]
  assert.equal(res.ok, true);
  // 蝎子回应后，X 继续走逼平格直到平局
  while (r.state.phase === 'playing') {
    const dm = drawingMoves(r.state.board);
    assert.ok(dm.length > 0, '仍有逼平格');
    r.place(dm[0]);
  }
  assert.equal(r.state.phase, 'won'); // draw 目标下，平局记为 won
  assert.equal(r.state.result.outcome, 'win');
});

test('createEndless：state 形状 + AI 模式', () => {
  const r = createEndless('perfect', { seed: 1 });
  assert.equal(r.state.mode, 'endless');
  assert.equal(r.state.ai, 'perfect');
  assert.equal(r.state.phase, 'playing');
  assert.equal(r.state.board.filter((v) => v).length, 0);
});

test('endless perfect：不可战胜（greedy X 无法赢）', () => {
  const r = createEndless('perfect', { seed: 1 });
  const g = greedyMove.bind(null);
  let guard = 20;
  while (r.state.phase === 'playing' && guard-- > 0) {
    const mv = greedyMove(r.state.board, X, Math.random);
    r.place(mv);
  }
  assert.notEqual(r.state.result?.outcome, 'win');
});

test('endless 2p：交替落子并正确判胜', () => {
  const r = createEndless('2p', { seed: 1 });
  assert.equal(r.state.turn, X);
  r.place(0); // X
  assert.equal(r.state.turn, O);
  r.place(3); // O
  assert.equal(r.state.turn, X);
  r.place(1); // X
  r.place(4); // O
  r.place(2); // X → 胜
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.outcome, 'win');
});

test('getHud / drainEvents 事件包含 start/place/win', () => {
  const r = createRun(0, { seed: 1 });
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.ok(Array.isArray(r.drainEvents())); // start
  r.place(2);
  const ev = r.drainEvents();
  const types = ev.map((e) => e.type);
  assert.ok(types.includes('place'));
  assert.ok(types.includes('win'));
});
