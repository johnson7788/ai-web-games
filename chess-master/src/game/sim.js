// 对局管理：玩家（白）vs AI（黑）+ 历史/悔棋 + 状态 + 吃子统计。
import {
  initialState, cloneState, legalMoves, applyMove, gameStatus, isInCheck, aiBestMove, findKing,
} from './chess.js';
import { RULES } from '../../config/game.config.js';

const INITIAL_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

export function computeCaptured(board) {
  const count = { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } };
  for (const row of board) for (const p of row) if (p) count[p.color][p.type] += 1;
  const captured = { w: [], b: [] };
  for (const color of ['w', 'b']) {
    const enemy = color === 'w' ? 'b' : 'w';
    for (const type of ['q', 'r', 'b', 'n', 'p']) {
      const missing = INITIAL_COUNT[type] - count[enemy][type];
      for (let i = 0; i < missing; i += 1) captured[color].push(type);
    }
  }
  return captured;
}

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun({ seed = 1 } = {}) {
  const state = initialState();
  return {
    state,
    history: [],
    lastMove: null,
    status: 'playing',
    winner: null,
    playerColor: 'w',
    aiColor: 'b',
    captured: computeCaptured(state.board),
    events: [],
    rng: makeRng(seed),
  };
}

export function legalForPlayer(run) {
  if (run.status !== 'playing' || run.state.turn !== run.playerColor) return [];
  return legalMoves(run.state, run.playerColor);
}

export function movesFrom(run, r, c) {
  return legalForPlayer(run).filter((m) => m.from.r === r && m.from.c === c);
}

function commit(run, move) {
  run.history.push({ state: cloneState(run.state), move });
  run.state = applyMove(run.state, move);
  run.lastMove = move;
  run.captured = computeCaptured(run.state.board);
  run.status = gameStatus(run.state);
  run.events.push({ type: 'move', move, capture: !!move.capture, castle: !!move.castle });
  if (run.status === 'checkmate') {
    run.winner = run.state.turn === 'w' ? 'b' : 'w';
    run.events.push({ type: 'end', status: 'checkmate', winner: run.winner });
  } else if (run.status === 'stalemate' || run.status === 'draw') {
    run.winner = null;
    run.events.push({ type: 'end', status: run.status, winner: null });
  } else if (isInCheck(run.state, run.state.turn)) {
    run.events.push({ type: 'check' });
  }
}

// 玩家走子（from→to）；升变传 promo。返回 { ok, move, promotion }。
export function playerMove(run, from, to, promo = 'q') {
  if (run.status !== 'playing' || run.state.turn !== run.playerColor) return { ok: false };
  const candidates = legalForPlayer(run).filter((m) => m.from.r === from.r && m.from.c === from.c && m.to.r === to.r && m.to.c === to.c);
  if (candidates.length === 0) return { ok: false };
  const move = { ...candidates[0] };
  if (move.promotion) move.promo = promo;
  commit(run, move);
  return { ok: true, move, promotion: !!move.promotion };
}

export function aiMove(run) {
  if (run.status !== 'playing' || run.state.turn !== run.aiColor) return { ok: false };
  const move = aiBestMove(run.state, RULES.aiDepth, run.rng);
  if (!move) return { ok: false };
  commit(run, move);
  return { ok: true, move };
}

export function undo(run) {
  if (run.history.length === 0) return false;
  let entry;
  do {
    entry = run.history.pop();
    run.state = entry.state;
  } while (run.history.length > 0 && run.state.turn !== run.playerColor);
  run.lastMove = run.history.length > 0 ? run.history[run.history.length - 1].move : null;
  run.status = gameStatus(run.state);
  run.winner = null;
  run.captured = computeCaptured(run.state.board);
  return true;
}

export function getHud(run) {
  return {
    turn: run.state.turn,
    status: run.status,
    winner: run.winner,
    inCheck: isInCheck(run.state, run.state.turn),
    moveCount: run.history.length,
    captured: run.captured,
    kingPos: findKing(run.state.board, run.state.turn),
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}