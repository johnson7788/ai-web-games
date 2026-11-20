// 斗兽棋 · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：棋盘状态机、选子/走子/吃子、AI 回合、谜题步数预算、胜负判定、事件表、走子动画计时。
// 依赖：src/game/rules.js、src/game/ai.js、config/levels.js、config/game.config.js。
// 随机：AI 决策确定性（minimax），无需 RNG；createRun 仍接受 seed 以保持接口一致。
import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';
import {
  ROWS, COLS, BLUE, RED, pieceSide, pieceRank, DEN, ANIMALS,
  initialBoard, setupBoard, genMoves, applyMove, anyPiece, isWater, trapsOf,
} from './rules.js';
import { bestMove, goalWin } from './ai.js';

const AI_SOLVER_DEPTH = 3; // selfplay / 提示用的蓝方求解深度

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const board = level.kind === 'puzzle' ? setupBoard(level.setup) : initialBoard();

  const state = {
    level: level.index,
    kind: level.kind,
    scene: level.scene,
    goal: level.goal,
    movesToWin: level.movesToWin ?? Infinity,
    aiTier: level.aiTier ?? null,
    aiDepth: level.aiDepth ?? 2,
    phase: 'playing',       // 'playing' | 'won' | 'lost' | 'draw'
    rows: ROWS,
    cols: COLS,
    board,
    sideToMove: BLUE,
    selected: null,
    legalMoves: [],
    moveCount: 0,           // 总步数（ply）
    blueMoves: 0,           // 蓝方已走步数（谜题预算）
    capturedByBlue: [],     // 蓝吃到的红子 rank 列表
    capturedByRed: [],      // 红吃到的蓝子 rank 列表
    lastMove: null,
    anim: null,             // { from, to, t, kind, jump, capturedRank, capturedSide }
    thinking: false,
    thinkingT: 0,
    result: null,
    stars: 0,
  };

  const run = {
    state,
    _level: level,
    _events: [],
    _seed: (opts.seed ?? 1) >>> 0,

    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;

      // 走子动画计时
      if (s.anim) {
        s.anim.t += dt / (s.anim.kind === 'capture' ? GAME.CAPTURE_ANIM_S : GAME.MOVE_ANIM_S);
        if (s.anim.t >= 1) s.anim = null;
      }

      // AI 回合
      if (s.sideToMove === RED && s.phase === 'playing') {
        if (s.thinking) {
          s.thinkingT -= dt;
          if (s.thinkingT <= 0) this._aiMove();
        }
      }
    },

    // 玩家点选/走子（蓝方）
    tap(r, c) {
      const s = this.state;
      if (s.phase !== 'playing' || s.sideToMove !== BLUE || s.thinking) return { ok: false, reason: 'phase' };
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return { ok: false, reason: 'bounds' };
      const idx = r * COLS + c;

      if (s.selected != null) {
        // 已有选中：尝试走子
        const mv = s.legalMoves.find((m) => m.to === idx);
        if (mv) {
          const res = this.makeMove(BLUE, mv.from, mv.to);
          s.selected = null;
          s.legalMoves = [];
          return res;
        }
        // 点到自己子 → 改选
        const v = s.board[idx];
        if (v !== 0 && pieceSide(v) === BLUE) {
          return this.select(r, c);
        }
        // 点到别处 → 取消
        s.selected = null;
        s.legalMoves = [];
        return { ok: false, reason: 'deselect' };
      }
      return this.select(r, c);
    },

    select(r, c) {
      const s = this.state;
      if (s.phase !== 'playing' || s.sideToMove !== BLUE || s.thinking) return { ok: false, reason: 'phase' };
      const idx = r * COLS + c;
      const v = s.board[idx];
      if (v === 0 || pieceSide(v) !== BLUE) return { ok: false, reason: 'notOwn' };
      s.selected = idx;
      s.legalMoves = genMoves(s.board, BLUE).filter((m) => m.from === idx);
      this._emit({ type: 'select', r, c, animal: ANIMALS[pieceRank(v)], moves: s.legalMoves.length });
      return { ok: true, legalMoves: s.legalMoves.length };
    },

    // 供 AI / selfplay 使用：某方最优走法
    suggestMove(side, depth = AI_SOLVER_DEPTH) {
      return bestMove(this.state.board, side, depth, this.state.goal);
    },

    // 核心：执行某方一步（side 须是当前行棋方）
    makeMove(side, from, to) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (side !== s.sideToMove) return { ok: false, reason: 'notTurn' };
      const legal = genMoves(s.board, side).find((m) => m.from === from && m.to === to);
      if (!legal) return { ok: false, reason: 'illegal' };
      return this._doMove(side, legal);
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _doMove(side, mv) {
      const s = this.state;
      const fromRank = pieceRank(s.board[mv.from]);
      const { board: nb, captured, denCaptured, winner, outcome } = applyMove(s.board, mv.from, mv.to);
      s.board = nb;
      s.moveCount += 1;
      if (side === BLUE) s.blueMoves += 1;
      if (captured) {
        if (side === BLUE) s.capturedByBlue.push(captured.rank);
        else s.capturedByRed.push(captured.rank);
      }

      const kind = outcome === 'capture' || outcome === 'mutual' ? 'capture' : 'move';
      s.lastMove = { from: mv.from, to: mv.to, jump: !!mv.jump, outcome, fromRank, capturedRank: captured ? captured.rank : null };
      s.anim = { from: mv.from, to: mv.to, t: 0, kind, jump: !!mv.jump, capturedRank: captured ? captured.rank : null, capturedSide: captured ? captured.side : null, mover: side };

      this._emit({ type: 'move', side, from: mv.from, to: mv.to, animal: ANIMALS[fromRank], jump: !!mv.jump });
      if (mv.jump) this._emit({ type: 'jump', side, animal: ANIMALS[fromRank] });
      if (kind === 'capture') {
        this._emit({ type: 'capture', side, animal: ANIMALS[fromRank], captured: ANIMALS[captured.rank] });
        if (trapsOf(side).has(mv.to)) this._emit({ type: 'trap', side, captured: ANIMALS[captured.rank] });
      }
      if (isWater(mv.to) && fromRank === 0) this._emit({ type: 'river', side, animal: 'rat' });

      if (denCaptured != null) {
        if (denCaptured === RED) { this._win('den'); return { ok: true }; }
        this._lose('den'); return { ok: true };
      }

      // 谜题关键子被吃 / 红方被吃光
      if (side === BLUE) {
        if (goalWin(s.board, BLUE, s.goal) || !anyPiece(s.board, RED)) {
          this._win(s.goal.type === 'piece' ? 'piece' : 'den');
          return { ok: true };
        }
        if (s.kind === 'puzzle' && s.blueMoves >= (s.movesToWin ?? Infinity)) {
          this._lose('moves');
          return { ok: true };
        }
      } else {
        // 红方走完：红占蓝穴 或 蓝被吃光
        const blueDen = DEN[BLUE];
        if ((s.board[blueDen] !== 0 && pieceSide(s.board[blueDen]) === RED) || !anyPiece(s.board, BLUE)) {
          this._lose('den');
          return { ok: true };
        }
      }

      // 步数上限（完整对局）
      if (s.kind === 'game' && s.moveCount >= GAME.PLY_LIMIT) {
        this._draw();
        return { ok: true };
      }

      // 换边
      s.sideToMove = 1 - side;
      s.selected = null;
      s.legalMoves = [];
      if (s.sideToMove === RED) {
        s.thinking = true;
        s.thinkingT = GAME.AI_THINK_S;
        this._emit({ type: 'thinking', side: RED });
      }
      this._emit({ type: 'turn', side: s.sideToMove, moveCount: s.moveCount });
      return { ok: true };
    },

    _aiMove() {
      const s = this.state;
      s.thinking = false;
      const mv = bestMove(s.board, RED, s.aiDepth ?? 2, s.goal);
      if (!mv) {
        // 红方无子可动 → 蓝胜
        this._win('pieces');
        return;
      }
      this._doMove(RED, { from: mv.from, to: mv.to, jump: false, outcome: null });
    },

    _win(reason) {
      const s = this.state;
      s.phase = 'won';
      s.sideToMove = BLUE;
      s.thinking = false;
      const stars = this._calcStars(true, reason);
      s.stars = stars;
      s.result = { won: true, reason, stars, movesUsed: s.blueMoves };
      this._emit({ type: 'win', reason, stars, moves: s.blueMoves });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.thinking = false;
      s.stars = 0;
      s.result = { won: false, reason, stars: 0, movesUsed: s.blueMoves };
      this._emit({ type: 'lose', reason });
    },

    _draw() {
      const s = this.state;
      s.phase = 'draw';
      s.thinking = false;
      s.stars = 1;
      s.result = { won: false, reason: 'draw', stars: 1, movesUsed: s.blueMoves };
      this._emit({ type: 'draw' });
    },

    _calcStars(won, reason) {
      const s = this.state;
      if (!won) return 0;
      if (s.kind === 'puzzle') {
        return s.blueMoves <= 1 ? 3 : 2;
      }
      // 完整对局：吃子优势 + 保留子力
      const materialEdge = s.capturedByBlue.length >= s.capturedByRed.length;
      const remaining = sideCount(s.board, BLUE);
      return 1 + (materialEdge ? 1 : 0) + (remaining >= 5 ? 1 : 0);
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        kind: s.kind,
        scene: s.scene,
        sideToMove: s.sideToMove,
        thinking: s.thinking,
        moveCount: s.moveCount,
        blueMoves: s.blueMoves,
        movesToWin: s.movesToWin,
        goal: s.goal,
        aiTier: s.aiTier,
        capturedByBlue: s.capturedByBlue.slice(),
        capturedByRed: s.capturedByRed.slice(),
        stars: s.stars,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },
  };

  run._emit({ type: 'levelStart', level: state.level, kind: state.kind, scene: state.scene });
  return run;
}

function sideCount(board, side) {
  let n = 0;
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] !== 0 && pieceSide(board[i]) === side) n += 1;
  }
  return n;
}
