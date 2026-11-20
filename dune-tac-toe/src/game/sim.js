// DUNE TAC TOE · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：3×3 井字棋、三连判胜/平局、Perfect/Greedy/Random 三档 AI、
//       12 个谜题残局（win-in-N / 逼平完美蝎子）、无尽对战、事件表。
// 依赖：config/levels.js（LEVELS）。
// 随机：注入 seed 的 mulberry32，可复现。
// 棋子：'X' = 仙人掌（玩家/先手），'O' = 蝎子（AI / 后手）。

import { LEVELS } from '../../config/levels.js';

export const X = 'X';
export const O = 'O';
export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],   // 行
  [0, 3, 6], [1, 4, 7], [2, 5, 8],   // 列
  [0, 4, 8], [2, 4, 6],              // 对角线
];

// ------------------------------------------------------------------ 基础
export function winner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

export function winningLine(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

export function isFull(board) {
  return board.every((v) => v);
}

export function empties(board) {
  const r = [];
  for (let i = 0; i < 9; i += 1) if (!board[i]) r.push(i);
  return r;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 轮到谁：X 先手，故 #X===#O 时 X 走，否则 O 走
function turnOf(board) {
  let nx = 0;
  let no = 0;
  for (const v of board) {
    if (v === X) nx += 1;
    else if (v === O) no += 1;
  }
  return nx === no ? X : O;
}

// 某方当前拥有的「成线威胁」数量（2 子 + 1 空）
function threatsOf(board, p) {
  let n = 0;
  for (const [a, b, c] of LINES) {
    const cells = [board[a], board[b], board[c]];
    if (cells.filter((v) => v === p).length === 2 && cells.some((v) => v == null)) n += 1;
  }
  return n;
}

// ------------------------------------------------------------------ Minimax（Perfect AI）
function minimaxScore(board, ai) {
  const w = winner(board);
  if (w === ai) return 1;
  if (w && w !== ai) return -1;
  if (isFull(board)) return 0;
  const turn = turnOf(board);
  const maximizing = turn === ai;
  let best = maximizing ? -Infinity : Infinity;
  for (const e of empties(board)) {
    const nb = board.slice();
    nb[e] = turn;
    const sc = minimaxScore(nb, ai);
    if (maximizing) best = Math.max(best, sc);
    else best = Math.min(best, sc);
  }
  return best;
}

// ai 的完美最优落子（能赢则赢，否则逼平，输棋时任意）
export function bestMove(board, ai) {
  let bestScore = -Infinity;
  let best = null;
  for (const e of empties(board)) {
    const nb = board.slice();
    nb[e] = ai;
    const sc = minimaxScore(nb, ai);
    if (sc > bestScore) {
      bestScore = sc;
      best = e;
    }
  }
  return best;
}

// Greedy AI：能赢→堵对手→中心→角→边→随机
export function greedyMove(board, ai, rng = Math.random) {
  const opp = ai === X ? O : X;
  const es = empties(board);
  for (const e of es) {
    const nb = board.slice(); nb[e] = ai;
    if (winner(nb) === ai) return e;
  }
  for (const e of es) {
    const nb = board.slice(); nb[e] = opp;
    if (winner(nb) === opp) return e;
  }
  if (board[4] == null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] == null);
  if (corners.length) return corners[Math.floor(rng() * corners.length)];
  const sides = [1, 3, 5, 7].filter((i) => board[i] == null);
  if (sides.length) return sides[Math.floor(rng() * sides.length)];
  return es[Math.floor(rng() * es.length)];
}

// Random AI
export function randomMove(board, rng = Math.random) {
  const es = empties(board);
  return es.length ? es[Math.floor(rng() * es.length)] : null;
}

// ------------------------------------------------------------------ 谜题求解器（构造/验证/自对弈共用）
// X 先手，能否在 ≤k 步（X 的步数）内强制获胜（对抗完美 O）。
export function canForceWin(board, k) {
  const w = winner(board);
  if (w === X) return true;
  if (w === O || isFull(board)) return false;
  if (k <= 0) return false;
  for (const e of empties(board)) {
    const nb = board.slice(); nb[e] = X;
    if (defendsAll(nb, k - 1)) return true;
  }
  return false;
}

// O 走（X 刚落子）；X 还剩 k 步，能否对 O 的所有回应仍强制获胜。
function defendsAll(board, k) {
  const w = winner(board);
  if (w === X) return true;
  if (w === O || isFull(board)) return false;
  if (k <= 0) return false;
  for (const e of empties(board)) {
    const nb = board.slice(); nb[e] = O;
    if (winner(nb) === O) return false;
    if (!canForceWin(nb, k)) return false;
  }
  return true;
}

// X 先手，能否至少逼平（对抗完美 O）。
export function canForceDraw(board) {
  const w = winner(board);
  if (w === X) return true;
  if (w === O) return false;
  if (isFull(board)) return true;
  for (const e of empties(board)) {
    const nb = board.slice(); nb[e] = X;
    if (drawAfterX(nb)) return true;
  }
  return false;
}

function drawAfterX(board) {
  const w = winner(board);
  if (w === X) return true;
  if (w === O) return false;
  if (isFull(board)) return true;
  for (const e of empties(board)) {
    const nb = board.slice(); nb[e] = O;
    if (winner(nb) === O) return false;
    if (!canForceDraw(nb)) return false;
  }
  return true;
}

// X 在 k 步内仍能维持强制获胜的可下格（供 solver/greedy bot 使用）
export function winningMoves(board, k) {
  return empties(board).filter((e) => {
    const nb = board.slice(); nb[e] = X;
    return winner(nb) === X || defendsAll(nb, k - 1);
  });
}

// X 能维持「不输」的可下格（供 L12 逼平 solver 使用）
export function drawingMoves(board) {
  return empties(board).filter((e) => {
    const nb = board.slice(); nb[e] = X;
    return winner(nb) === X || drawAfterX(nb);
  });
}

// ------------------------------------------------------------------ 事件落子时的细粒度反馈
function emitMoveFx(run, board, player, beforeBoard) {
  const opp = player === X ? O : X;
  if (threatsOf(board, player) > 0) run._emit('threat', { player });
  if (threatsOf(beforeBoard, opp) > 0 && threatsOf(board, opp) === 0) run._emit('block', { player });
}

function aiMoveFor(run, difficulty, ai) {
  if (difficulty === 'perfect') return bestMove(run.state.board, ai);
  if (difficulty === 'greedy') return greedyMove(run.state.board, ai, run._rng);
  return randomMove(run.state.board, run._rng);
}

// ------------------------------------------------------------------ createRun（谜题模式）
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    mode: 'puzzle',
    level: level.index,
    scene: level.scene,
    phase: 'playing',            // playing | won | lost
    board: level.board.slice(),
    turn: X,
    movesMade: 0,
    movesLimit: level.movesLimit,
    goal: level.goal,            // 'win' | 'draw'
    result: null,                // { outcome:'win'|'lose', reason, movesMade }
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    step() { /* 回合制：无连续推进 */ },
    place(i) { return puzzlePlace(this, i); },
    getHud() {
      const s = this.state;
      return { mode: s.mode, level: s.level, phase: s.phase, turn: s.turn, movesMade: s.movesMade, movesLimit: s.movesLimit, goal: s.goal, board: s.board.slice() };
    },
    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },
    _emit(type, extra) { this._events.push({ type, ...extra }); },
  };

  run._emit('start', { mode: 'puzzle', level: level.index, goal: level.goal, movesLimit: level.movesLimit });
  return run;
}

function puzzlePlace(run, i) {
  const s = run.state;
  if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
  if (!Number.isInteger(i) || i < 0 || i > 8) return { ok: false, reason: 'bounds' };
  if (s.board[i]) return { ok: false, reason: 'occupied' };
  if (s.turn !== X) return { ok: false, reason: 'notYourTurn' };

  const before = s.board.slice();
  s.board[i] = X;
  s.movesMade += 1;
  run._emit('place', { cell: i, player: X });
  emitMoveFx(run, s.board, X, before);

  if (winner(s.board) === X) return puzzleEnd(run, 'won', 'line');
  if (isFull(s.board)) return puzzleEnd(run, s.goal === 'draw' ? 'won' : 'lost', 'draw');
  if (s.goal === 'win' && s.movesMade >= s.movesLimit) return puzzleEnd(run, 'lost', 'outOfMoves');

  // 蝎子（完美）回应
  s.turn = O;
  run._emit('turn', { player: O });
  const om = bestMove(s.board, O);
  if (om == null) return puzzleEnd(run, s.goal === 'draw' ? 'won' : 'lost', 'draw');
  const obefore = s.board.slice();
  s.board[om] = O;
  run._emit('place', { cell: om, player: O });
  emitMoveFx(run, s.board, O, obefore);
  if (winner(s.board) === O) return puzzleEnd(run, 'lost', 'scorpionWins');
  if (isFull(s.board)) return puzzleEnd(run, s.goal === 'draw' ? 'won' : 'lost', 'draw');
  s.turn = X;
  run._emit('turn', { player: X });
  return { ok: true };
}

function puzzleEnd(run, phase, reason) {
  const s = run.state;
  s.phase = phase;
  s.result = { outcome: phase === 'won' ? 'win' : 'lose', reason, movesMade: s.movesMade };
  run._emit(phase === 'won' ? 'win' : 'lose', { reason, movesMade: s.movesMade });
  return { ok: true, won: phase === 'won', lost: phase === 'lost' };
}

// ------------------------------------------------------------------ createEndless（无尽对战）
export function createEndless(mode = 'random', opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const scene = opts.scene || 'dawn';

  const state = {
    mode: 'endless',
    level: 0,
    scene,
    phase: 'playing',            // playing | won | lost | draw
    board: new Array(9).fill(null),
    turn: X,
    movesMade: 0,
    goal: 'win',
    ai: mode,                    // 'random' | 'greedy' | 'perfect' | '2p'
    result: null,                // { outcome:'win'|'lose'|'draw', reason }
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    step() {},
    place(i) { return endlessPlace(this, i); },
    getHud() {
      const s = this.state;
      return { mode: s.mode, level: s.level, phase: s.phase, turn: s.turn, movesMade: s.movesMade, movesLimit: null, goal: s.goal, ai: s.ai, board: s.board.slice() };
    },
    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },
    _emit(type, extra) { this._events.push({ type, ...extra }); },
  };

  run._emit('start', { mode: 'endless', ai: mode });
  return run;
}

function endlessPlace(run, i) {
  const s = run.state;
  if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
  if (!Number.isInteger(i) || i < 0 || i > 8) return { ok: false, reason: 'bounds' };
  if (s.board[i]) return { ok: false, reason: 'occupied' };

  // 双人同屏：任意回合、交替落子
  if (s.ai === '2p') {
    const p = s.turn;
    const before = s.board.slice();
    s.board[i] = p;
    s.movesMade += 1;
    run._emit('place', { cell: i, player: p });
    emitMoveFx(run, s.board, p, before);
    const w = winner(s.board);
    if (w) return endlessEnd(run, w === X ? 'won' : 'lost', 'line');
    if (isFull(s.board)) return endlessEnd(run, 'draw', 'draw');
    s.turn = p === X ? O : X;
    run._emit('turn', { player: s.turn });
    return { ok: true };
  }

  // 人机：人恒为 X（先手）
  if (s.turn !== X) return { ok: false, reason: 'notYourTurn' };
  const before = s.board.slice();
  s.board[i] = X;
  s.movesMade += 1;
  run._emit('place', { cell: i, player: X });
  emitMoveFx(run, s.board, X, before);
  if (winner(s.board) === X) return endlessEnd(run, 'won', 'line');
  if (isFull(s.board)) return endlessEnd(run, 'draw', 'draw');

  s.turn = O;
  run._emit('turn', { player: O });
  const om = aiMoveFor(run, s.ai, O);
  if (om == null) return endlessEnd(run, 'draw', 'draw');
  const obefore = s.board.slice();
  s.board[om] = O;
  run._emit('place', { cell: om, player: O });
  emitMoveFx(run, s.board, O, obefore);
  if (winner(s.board) === O) return endlessEnd(run, 'lost', 'scorpionWins');
  if (isFull(s.board)) return endlessEnd(run, 'draw', 'draw');
  s.turn = X;
  run._emit('turn', { player: X });
  return { ok: true };
}

function endlessEnd(run, phase, reason) {
  const s = run.state;
  s.phase = phase; // 'won' | 'lost' | 'draw'
  const outcome = phase === 'won' ? 'win' : phase === 'lost' ? 'lose' : 'draw';
  s.result = { outcome, reason };
  run._emit(outcome === 'win' ? 'win' : outcome === 'lose' ? 'lose' : 'draw', { reason });
  return { ok: true, won: outcome === 'win', lost: outcome === 'lose', draw: outcome === 'draw' };
}
