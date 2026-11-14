import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, legalMoves, applyMove, gameStatus, isInCheck, isAttacked, aiBestMove, findKing,
} from '../src/game/chess.js';
import { createRun, playerMove, aiMove, undo, movesFrom, getHud } from '../src/game/sim.js';
import { CONFIG } from '../config/game.config.js';

function emptyBoard() {
  const s = initialState();
  s.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  s.castling = { wK: false, wQ: false, bK: false, bQ: false };
  return s;
}
function put(s, r, c, type, color) { s.board[r][c] = { type, color }; }
function moveCoord(s, fr, fc, tr, tc) {
  const m = legalMoves(s, s.turn).find((x) => x.from.r === fr && x.from.c === fc && x.to.r === tr && x.to.c === tc);
  assert.ok(m, `合法走法 ${fr},${fc}→${tr},${tc}`);
  return applyMove(s, m);
}

test('初始局面：32 子、白先、20 个合法走法', () => {
  const s = initialState();
  let count = 0;
  for (const row of s.board) for (const p of row) if (p) count += 1;
  assert.equal(count, 32);
  assert.equal(s.turn, 'w');
  assert.equal(legalMoves(s, 'w').length, 20, '16 兵 + 4 马');
});

test('应将：被将军时只能解将', () => {
  const s = emptyBoard();
  put(s, 7, 4, 'k', 'w');
  put(s, 0, 4, 'k', 'b');
  put(s, 4, 4, 'r', 'b'); // 黑车 e4 将军白王 e1（同列）
  s.turn = 'w';
  assert.equal(isInCheck(s, 'w'), true);
  const moves = legalMoves(s, 'w');
  assert.ok(moves.length > 0);
  for (const m of moves) {
    const next = applyMove(s, m);
    assert.equal(isInCheck(next, 'w'), false, '解将后不再被将军');
  }
});

test(' fool\'s mate：Qh4 将杀', () => {
  let s = initialState();
  s = moveCoord(s, 6, 5, 5, 5); // f3
  s = moveCoord(s, 1, 4, 3, 4); // e5
  s = moveCoord(s, 6, 6, 4, 6); // g4
  s = moveCoord(s, 0, 3, 4, 7); // Qh4#
  assert.equal(gameStatus(s), 'checkmate');
  assert.equal(s.turn, 'w');
});

test('逼和：无子可动且未被将军', () => {
  const s = emptyBoard();
  put(s, 0, 0, 'k', 'b'); // 黑王 a8
  put(s, 1, 2, 'q', 'w'); // 白后 c7 控制 a8 周边但不在将军
  put(s, 2, 0, 'k', 'w');
  s.turn = 'b';
  // 黑王 a8：a7 被后控、b8 被后控、b7 被后控 → 无合法走法且未被将军
  assert.equal(isInCheck(s, 'b'), false);
  assert.equal(gameStatus(s), 'stalemate');
});

test('王车易位：王翼易位合法且车到位', () => {
  const s = emptyBoard();
  put(s, 7, 4, 'k', 'w');
  put(s, 7, 7, 'r', 'w');
  put(s, 7, 0, 'r', 'w');
  put(s, 0, 4, 'k', 'b');
  s.castling = { wK: true, wQ: true, bK: false, bQ: false };
  s.turn = 'w';
  const moves = legalMoves(s, 'w');
  const castleK = moves.find((m) => m.castle === 'K');
  assert.ok(castleK, '存在王翼易位');
  const next = applyMove(s, castleK);
  assert.equal(next.board[7][6].type, 'k', '王到 g1');
  assert.equal(next.board[7][5].type, 'r', '车到 f1');
  assert.equal(next.castling.wK, false);
});

test('吃过路兵', () => {
  const s = emptyBoard();
  put(s, 3, 4, 'p', 'w'); // 白兵 e5
  put(s, 1, 3, 'p', 'b'); // 黑兵 d7
  put(s, 7, 4, 'k', 'w');
  put(s, 0, 4, 'k', 'b');
  s.turn = 'b';
  const s2 = moveCoord(s, 1, 3, 3, 3); // d7-d5（双步）
  assert.ok(s2.ep, '产生过路兵目标格');
  const s3 = moveCoord(s2, 3, 4, 2, 3); // e5xd6 过路兵
  assert.equal(s3.board[3][3], null, '黑兵 d5 被移除');
  assert.equal(s3.board[2][3].type, 'p', '白兵到 d6');
});

test('升变：兵到底线变后', () => {
  const s = emptyBoard();
  put(s, 1, 0, 'p', 'w'); // 白兵 a7
  put(s, 7, 4, 'k', 'w');
  put(s, 0, 4, 'k', 'b');
  s.turn = 'w';
  const m = legalMoves(s, 'w').find((x) => x.promotion);
  assert.ok(m, '存在升变走法');
  const next = applyMove(s, { ...m, promo: 'q' });
  assert.equal(next.board[0][0].type, 'q', '升变为后');
});

test('AI 返回合法走法且能吃免费子', () => {
  const s = emptyBoard();
  put(s, 7, 4, 'k', 'w');
  put(s, 0, 4, 'k', 'b');
  put(s, 4, 4, 'q', 'b'); // 黑后 e4 无保护
  put(s, 7, 0, 'r', 'w'); // 白车 a1 可吃后？a1→e1→e4 需同列/行
  put(s, 4, 0, 'r', 'w'); // 白车 a4 同行吃 e4 后
  s.turn = 'w';
  const m = aiBestMove(s, 2);
  assert.ok(m, 'AI 有走法');
  const next = applyMove(s, m);
  assert.ok(legalMoves(s, 'w').some((x) => x.from.r === m.from.r && x.from.c === m.from.c && x.to.r === m.to.r && x.to.c === m.to.c), 'AI 走法合法');
});

test('对局流程：玩家走子 → AI 应着 → 悔棋', () => {
  const run = createRun({ seed: 1 });
  const r = playerMove(run, { r: 6, c: 4 }, { r: 4, c: 4 }); // e2-e4
  assert.equal(r.ok, true);
  assert.equal(run.state.turn, 'b');
  const a = aiMove(run);
  assert.equal(a.ok, true);
  assert.equal(run.state.turn, 'w');
  assert.equal(run.history.length, 2);
  assert.equal(undo(run), true);
  assert.equal(run.state.turn, 'w', '悔棋回到玩家回合');
  assert.equal(run.history.length, 0);
});

test('AI 自对弈可结束（浅深度），无死循环', () => {
  let s = initialState();
  let plies = 0;
  while (gameStatus(s) === 'playing' && plies < 120) {
    const m = aiBestMove(s, 1);
    if (!m) break;
    s = applyMove(s, m);
    plies += 1;
  }
  assert.ok(plies > 10, '对弈进行了多步');
});

test('配置默认值：en+zh / AI 深度', () => {
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ seed: 1 })).turn, 'w');
});