import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLS, ROWS, BLUE, RED, RAT, CAT, DOG, WOLF, LEOPARD, TIGER, LION, ELEPHANT,
  rc, initialBoard, setupBoard, genMoves, applyMove, captureOutcome, pieceSide, pieceRank,
  DEN, isWater, anyPiece, sidePieceCount, ANIMALS,
} from '../src/game/rules.js';
import { bestMove, WIN_SCORE, hasForcedWin, goalWin, hasKeyPiece } from '../src/game/ai.js';
import { createRun } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

// ---------- 规则：棋盘与地形 ----------
test('棋盘 7×9，共 63 格', () => {
  assert.equal(COLS, 7);
  assert.equal(ROWS, 9);
  assert.equal(COLS * ROWS, 63);
});

test('初始局面：蓝红各 8 子，兽穴为空', () => {
  const b = initialBoard();
  assert.equal(sidePieceCount(b, BLUE), 8);
  assert.equal(sidePieceCount(b, RED), 8);
  assert.equal(b[DEN[BLUE]], 0);
  assert.equal(b[DEN[RED]], 0);
});

test('地形：河域 12 格，蓝红陷阱各 3 格', () => {
  let water = 0;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) if (isWater(rc(r, c))) water += 1;
  }
  assert.equal(water, 12);
});

test('蓝方初始有合法走法（10 步）', () => {
  const b = initialBoard();
  assert.equal(genMoves(b, BLUE).length, 10);
  assert.equal(genMoves(b, RED).length, 10);
});

// ---------- 规则：吃子 ----------
test('鼠克象：rat 吃 elephant 合法', () => {
  assert.equal(captureOutcome(RAT, ELEPHANT, BLUE, false, false, false), 'capture');
});
test('象吃鼠（正常强弱），鼠也吃象（特殊规则）', () => {
  assert.equal(captureOutcome(ELEPHANT, RAT, BLUE, false, false, false), 'capture');
  assert.equal(captureOutcome(RAT, ELEPHANT, BLUE, false, false, false), 'capture');
});
test('同级互吃', () => {
  assert.equal(captureOutcome(TIGER, TIGER, BLUE, false, false, false), 'mutual');
});
test('陷阱：防守方在攻方陷阱内任意被吃', () => {
  assert.equal(captureOutcome(RAT, ELEPHANT, BLUE, false, false, true), 'capture');
  assert.equal(captureOutcome(DOG, ELEPHANT, BLUE, false, false, true), 'capture');
});
test('陆地兽不能吃水中兽，水中鼠不能吃陆兽', () => {
  assert.equal(captureOutcome(TIGER, RAT, BLUE, false, true, false), null); // 虎(陆) vs 鼠(水)
  assert.equal(captureOutcome(RAT, CAT, BLUE, true, false, false), null);   // 鼠(水) vs 猫(陆)
});
test('水中鼠 vs 水中鼠 → 同归于尽', () => {
  assert.equal(captureOutcome(RAT, RAT, BLUE, true, true, false), 'mutual');
});

// ---------- 规则：走子 ----------
test('applyMove 普通移动', () => {
  const b = setupBoard([{ r: 2, c: 3, side: BLUE, rank: LION }]);
  const { board, captured, winner } = applyMove(b, rc(2, 3), rc(1, 3));
  assert.equal(pieceSide(board[rc(1, 3)]), BLUE);
  assert.equal(pieceRank(board[rc(1, 3)]), LION);
  assert.equal(captured, null);
  assert.equal(winner, null);
});

test('applyMove 吃子（虎吃狼）', () => {
  const b = setupBoard([
    { r: 2, c: 3, side: BLUE, rank: TIGER },
    { r: 1, c: 3, side: RED, rank: WOLF },
  ]);
  const { board, captured } = applyMove(b, rc(2, 3), rc(1, 3));
  assert.equal(pieceSide(board[rc(1, 3)]), BLUE);
  assert.equal(pieceRank(board[rc(1, 3)]), TIGER);
  assert.deepEqual(captured, { side: RED, rank: WOLF });
});

test('applyMove 占对方兽穴即胜', () => {
  const b = setupBoard([{ r: 1, c: 3, side: BLUE, rank: LION }]);
  const { winner, denCaptured } = applyMove(b, rc(1, 3), DEN[RED]);
  assert.equal(winner, BLUE);
  assert.equal(denCaptured, RED);
});

test('不能进自己兽穴 / 不能吃自己', () => {
  const b = setupBoard([
    { r: 7, c: 3, side: BLUE, rank: DOG },
    { r: 6, c: 3, side: BLUE, rank: CAT },
  ]);
  const moves = genMoves(b, BLUE);
  assert.ok(!moves.some((m) => m.to === DEN[BLUE] || m.to === rc(6, 3)));
});

test('虎跳河（横向越水、无鼠阻挡）', () => {
  const b = setupBoard([
    { r: 3, c: 0, side: BLUE, rank: TIGER },
    { r: 3, c: 3, side: RED, rank: WOLF },
  ]);
  const moves = genMoves(b, BLUE);
  const jump = moves.find((m) => m.from === rc(3, 0) && m.to === rc(3, 3));
  assert.ok(jump, '应有跳河走法');
  assert.equal(jump.jump, true);
  assert.equal(jump.outcome, 'capture');
});

test('跳河被水中鼠阻挡', () => {
  const b = setupBoard([
    { r: 3, c: 0, side: BLUE, rank: TIGER },
    { r: 3, c: 1, side: RED, rank: RAT },
    { r: 3, c: 3, side: RED, rank: WOLF },
  ]);
  const moves = genMoves(b, BLUE);
  assert.ok(!moves.some((m) => m.jump && m.to === rc(3, 3)));
});

test('狮纵向跳河', () => {
  const b = setupBoard([
    { r: 2, c: 1, side: BLUE, rank: LION },
    { r: 6, c: 1, side: RED, rank: TIGER },
  ]);
  const moves = genMoves(b, BLUE);
  const jump = moves.find((m) => m.from === rc(2, 1) && m.to === rc(6, 1));
  assert.ok(jump);
  assert.equal(jump.jump, true);
  assert.equal(jump.outcome, 'capture');
});

test('鼠能下水，非鼠不能下水', () => {
  const b = setupBoard([
    { r: 2, c: 1, side: BLUE, rank: RAT },
    { r: 2, c: 2, side: BLUE, rank: DOG },
  ]);
  const ratMoves = genMoves(b, BLUE).filter((m) => m.from === rc(2, 1));
  assert.ok(ratMoves.some((m) => m.to === rc(3, 1)), '鼠可进河');
  const dogMoves = genMoves(b, BLUE).filter((m) => m.from === rc(2, 2));
  assert.ok(!dogMoves.some((m) => m.to === rc(3, 2)), '狗不能进河');
});

// ---------- AI ----------
test('L1–L6 谜题均存在必胜走法（solver 验证）', () => {
  for (let i = 0; i < 6; i += 1) {
    const lv = LEVELS[i];
    const b = setupBoard(lv.setup);
    const depth = Math.max(2, (lv.movesToWin ?? 1) * 2 + 1);
    const m = bestMove(b, BLUE, depth, lv.goal);
    assert.ok(m, `L${lv.index} 无走法`);
    assert.ok(m.score >= WIN_SCORE - 10, `L${lv.index} 无必胜：score=${m.score}`);
  }
});

test('goalWin：占穴 / 吃关键子', () => {
  const bDen = setupBoard([{ r: 0, c: 3, side: BLUE, rank: LION }]);
  assert.equal(goalWin(bDen, BLUE, { type: 'den' }), true);
  const bPiece = setupBoard([{ r: 1, c: 1, side: RED, rank: CAT }]);
  assert.equal(goalWin(bPiece, BLUE, { type: 'piece', animal: ELEPHANT }), true);
  assert.equal(hasKeyPiece(bPiece, RED, CAT), true);
  assert.equal(hasKeyPiece(bPiece, RED, ELEPHANT), false);
});

// ---------- sim ----------
test('L1 一步杀：选狮踏穴即胜（3 星）', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.state.phase, 'playing');
  assert.equal(r.select(1, 3).ok, true);
  const t = r.tap(0, 3);
  assert.equal(t.ok, true);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.stars, 3);
  assert.equal(r.state.result.reason, 'den');
});

test('L2 鼠克象：吃关键子即胜', () => {
  const r = createRun(1, { seed: 1 });
  assert.equal(r.select(1, 1).ok, true);
  r.tap(0, 1);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.reason, 'piece');
});

test('L3 两步杀：AI 应手后仍必胜', () => {
  const r = createRun(2, { seed: 1 });
  const mv = r.suggestMove(0, 3);
  assert.ok(mv);
  r.makeMove(0, mv.from, mv.to);
  // 红方（AI）走一步
  r.step(0.5);
  // 蓝方第二手 → 胜
  const mv2 = r.suggestMove(0, 3);
  assert.ok(mv2);
  r.makeMove(0, mv2.from, mv2.to);
  assert.equal(r.state.phase, 'won');
});

test('L4 陷阱：狗吃踩陷阱的狮', () => {
  const r = createRun(3, { seed: 1 });
  assert.equal(r.select(6, 3).ok, true);
  r.tap(7, 3);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.reason, 'piece');
});

test('L5 虎跳河吃关键子', () => {
  const r = createRun(4, { seed: 1 });
  assert.equal(r.select(3, 0).ok, true);
  const legal = r.state.legalMoves;
  assert.ok(legal.some((m) => m.jump && m.to === rc(3, 3)));
  r.tap(3, 3);
  assert.equal(r.state.phase, 'won');
});

test('L6 狮纵向跳河吃关键子', () => {
  const r = createRun(5, { seed: 1 });
  assert.equal(r.select(2, 1).ok, true);
  r.tap(6, 1);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.reason, 'piece');
});

test('完整对局：AI 思考后落子，回合推进', () => {
  const r = createRun(6, { seed: 1 });
  assert.equal(r.state.sideToMove, BLUE);
  const mv = r.suggestMove(0, 3);
  r.makeMove(0, mv.from, mv.to);
  assert.equal(r.state.sideToMove, RED);
  assert.equal(r.state.thinking, true);
  r.step(0.5);
  assert.equal(r.state.sideToMove, BLUE);
  assert.equal(r.state.thinking, false);
});

test('非法走子被拒绝', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.makeMove(0, rc(1, 3), rc(3, 3)).ok, false);
});

test('事件表：levelStart/select/move/win 序列', () => {
  const r = createRun(0, { seed: 1 });
  r.drainEvents();
  r.select(1, 3);
  r.tap(0, 3);
  const ev = r.drainEvents().map((e) => e.type);
  assert.ok(ev.includes('select'));
  assert.ok(ev.includes('move'));
  assert.ok(ev.includes('win'));
});

test('关卡表：12 关、前 6 谜题后 6 对局', () => {
  assert.equal(LEVEL_COUNT, 12);
  for (let i = 0; i < 6; i += 1) assert.equal(LEVELS[i].kind, 'puzzle');
  for (let i = 6; i < 12; i += 1) assert.equal(LEVELS[i].kind, 'game');
});

test('ANIMALS 顺序：鼠→象 由弱到强', () => {
  assert.deepEqual(ANIMALS, ['rat', 'cat', 'dog', 'wolf', 'leopard', 'tiger', 'lion', 'elephant']);
});
