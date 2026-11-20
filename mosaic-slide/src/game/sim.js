// MOSAIC SLIDE · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：滑块拼图（点击缺口旁碎片滑入）、旋转块、盲拼偷看、双图参考切换、
//       倒计时与限时失败、三星结算、事件表。
// 依赖：config/levels.js、config/game.config.js、src/game/{pattern,solver}.js。
// 随机：注入 seed 的 mulberry32（shuffle 可复现；图案与 run seed 无关，由 pattern.js 决定）。

import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';
import { mulberry32 } from './pattern.js';
import { neighbors } from './solver.js';

export { mulberry32 };

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const N = level.rows * level.cols;

  // 完成态：cell 0 = 缺口(0)，cell i = 碎片 i（i=1..N-1）。
  const board = [];
  for (let i = 0; i < N; i += 1) board.push(i);

  const rot = new Array(N).fill(0);
  const homeRot = new Array(N).fill(0); // homeRot[碎片id]，旋转关才非 0

  // ---- shuffle：缺口随机游走（记录路径，天然可解）+ 旋转关额外给朝向 ----
  let blank = GAME.BLANK_HOME;
  const blankSeq = [blank];
  const depth = level.scramble;
  for (let k = 0; k < depth; k += 1) {
    const nbs = neighbors(blank, level.rows, level.cols);
    const n = nbs[Math.floor(rng() * nbs.length)];
    board[blank] = board[n];
    board[n] = 0;
    const tmp = rot[blank]; rot[blank] = rot[n]; rot[n] = tmp; // 朝向随碎片走
    blank = n;
    blankSeq.push(n);
  }

  if (level.rotate) {
    // 选 rotateCount 个碎片（确定性），homeRot=1（转 90° 一步归位）；当前 rot 保持 0。
    const ids = [];
    for (let t = 1; t < N; t += 1) ids.push(t);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const chosen = new Set(ids.slice(0, Math.min(level.rotateCount, N - 1)));
    for (const t of chosen) homeRot[t] = 1;
  }

  const state = {
    level: level.index,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    rows: level.rows,
    cols: level.cols,
    scene: level.scene,
    cut: level.cut,
    rotate: level.rotate,
    blind: level.blind,
    dual: level.dual,
    timed: level.timed,
    hex: level.hex,
    grand: level.grand,
    board,
    rot,
    homeRot,
    blank,
    moves: 0,
    rotations: 0,
    movePar: level.movePar,
    timePar: level.timePar,
    timeLeft: level.time,
    initialTime: level.time,
    reference: {
      visible: true,
      mode: 'full',             // 'full' | 'a' | 'b'（双图交替）
      hideAt: level.blind ? GAME.REF_HIDE_SECONDS : Infinity,
      peekUntil: null,
    },
    peekLeft: level.blind ? GAME.PEEK_COUNT : 0,
    stars: 0,
    wonClock: 0,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _lastSecond: Math.ceil(level.time),
    _dualIdx: 0,
    _blankSeq: blankSeq,
    _scrambleDepth: depth,

    step(dt) {
      const s = this.state;
      if (s.phase === 'won') { s.wonClock += dt; return; }
      if (s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;
      s.timeLeft -= dt;

      const sec = Math.ceil(s.timeLeft);
      if (sec < this._lastSecond && sec >= 0) {
        this._lastSecond = sec;
        this._emit({ type: 'countdownTick', timeLeft: sec });
      }

      // 盲拼：开局参考图 5 秒后隐藏
      if (s.blind && s.reference.visible && this._clock >= s.reference.hideAt) {
        s.reference.visible = false;
        this._emit({ type: 'referenceHide' });
      }
      // 偷看窗口到期
      if (s.reference.visible && s.reference.peekUntil != null && this._clock >= s.reference.peekUntil) {
        s.reference.visible = false;
        s.reference.peekUntil = null;
        this._emit({ type: 'referenceHide' });
      }
      // 双图：参考图周期性切换 a/b
      if (s.dual) {
        const idx = Math.floor(this._clock / GAME.DUAL_SWITCH_SECONDS);
        if (idx !== this._dualIdx) {
          this._dualIdx = idx;
          s.reference.mode = idx % 2 ? 'b' : 'a';
          this._emit({ type: 'referenceSwitch', mode: s.reference.mode });
        }
      }

      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        this._lose('timeOut');
      }
    },

    // 点击 (r,c)：若该格碎片与缺口相邻，则滑入缺口
    slide(r, c) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const cell = r * s.cols + c;
      if (cell === s.blank) return { ok: false, reason: 'blank' };
      if (!neighbors(cell, s.rows, s.cols).includes(s.blank)) return { ok: false, reason: 'notAdjacent' };

      const blankCell = s.blank;
      const moved = s.board[cell];
      const wasCorrect = this._correctAt(cell);

      s.board[blankCell] = moved;
      s.board[cell] = 0;
      const tmp = s.rot[cell]; s.rot[cell] = s.rot[blankCell]; s.rot[blankCell] = tmp;
      s.blank = cell;
      s.moves += 1;

      const isCorrect = this._correctAt(blankCell);
      if (s.moves === 1) this._emit({ type: 'firstMove' });
      this._emit({ type: 'slide', r, c, tile: moved });
      this._emit({ type: 'settle', r, c, tile: moved });
      if (wasCorrect && !isCorrect) this._emit({ type: 'wrong', r, c });
      if (!wasCorrect && isCorrect) this._emit({ type: 'correct', r, c });
      this._checkWin();
      return { ok: true, moved };
    },

    // 旋转关：把 (r,c) 的碎片转 90°（占用一步）
    rotate(r, c) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (!s.rotate) return { ok: false, reason: 'noRotate' };
      const cell = r * s.cols + c;
      if (s.board[cell] === 0) return { ok: false, reason: 'blank' };
      const wasCorrect = this._correctAt(cell);
      s.rot[cell] = (s.rot[cell] + 1) % 4;
      s.moves += 1;
      s.rotations += 1;
      const isCorrect = this._correctAt(cell);
      this._emit({ type: 'rotate', r, c, rot: s.rot[cell] });
      if (wasCorrect && !isCorrect) this._emit({ type: 'wrong', r, c });
      if (!wasCorrect && isCorrect) this._emit({ type: 'correct', r, c });
      this._checkWin();
      return { ok: true };
    },

    // 盲拼关：偷看参考图几秒
    peek() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (!s.blind) return { ok: false, reason: 'noPeek' };
      if (s.peekLeft <= 0) return { ok: false, reason: 'noPeek' };
      s.peekLeft -= 1;
      s.reference.visible = true;
      s.reference.peekUntil = this._clock + GAME.PEEK_SECONDS;
      this._emit({ type: 'peek', peekLeft: s.peekLeft });
      return { ok: true, peekLeft: s.peekLeft };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        moves: s.moves,
        movePar: s.movePar,
        timeLeft: s.timeLeft,
        timePar: s.timePar,
        stars: s.stars,
        peekLeft: s.peekLeft,
        rotate: s.rotate,
        blind: s.blind,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _correctAt(cell) {
      const s = this.state;
      const t = s.board[cell];
      if (t === 0) return false;
      return t === cell && s.rot[cell] === s.homeRot[t];
    },

    _correctCount() {
      const s = this.state;
      let n = 0;
      for (let cell = 1; cell < s.board.length; cell += 1) {
        if (this._correctAt(cell)) n += 1;
      }
      return n;
    },

    _emit(e) { this._events.push(e); },

    _checkWin() {
      const s = this.state;
      for (let cell = 1; cell < s.board.length; cell += 1) {
        if (!this._correctAt(cell)) return false;
      }
      this._win();
      return true;
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.wonClock = 0;
      const elapsed = s.initialTime - s.timeLeft;
      const stars = 1 + (s.moves <= s.movePar ? 1 : 0) + (elapsed <= s.timePar ? 1 : 0);
      s.stars = stars;
      s.result = { won: true, stars, moves: s.moves, timeLeft: s.timeLeft, elapsed };
      this._emit({ type: 'win', stars, moves: s.moves });
      this._emit({ type: 'levelClear', stars, moves: s.moves });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, moves: s.moves, timeLeft: s.timeLeft, reason };
      this._emit({ type: 'lose', reason });
    },
  };

  run._emit({ type: 'levelStart', level: level.index });
  return run;
}

// 兼容骨架别名（Lead 重写 main 后可移除）
export function createSim() {
  return createRun(0, { seed: 1 });
}
export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
