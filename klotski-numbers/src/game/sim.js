// KLOTSKI NUMBERS · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：数字华容道状态机 —— 可解打乱 / 整行整列滑动 / 连击 / 提示 / 重洗 / 星级结算 / 事件表。
// 依赖：config/levels.js（LEVELS）、config/game.config.js（GAME）。
// 随机：注入 seed 的 mulberry32，可复现。
import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ 可解性
// 与参考实现（数字华容道）1:1：空位视为 0，只统计非空块之间的逆序。
// 奇数边长：逆序为偶可解；偶数边长：(逆序 + 边长 - 空位所在行(1基)) 为偶可解。
export function isSolvable(cells, n) {
  const L = n * n;
  let inv = 0;
  for (let i = 0; i < L - 1; i += 1) {
    if (cells[i] === 0) continue;
    for (let j = i + 1; j < L; j += 1) {
      if (cells[j] === 0) continue;
      if (cells[i] > cells[j]) inv += 1;
    }
  }
  const blankRow = Math.floor(cells.indexOf(0) / n) + 1; // 1 基
  if (n % 2 === 1) return inv % 2 === 0;
  return (inv + n - blankRow) % 2 === 0;
}

export function shuffleCells(n, rng) {
  const L = n * n;
  const cells = [];
  for (let v = 1; v < L; v += 1) cells.push(v);
  cells.push(0); // 空位
  do {
    for (let i = L - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = cells[i];
      cells[i] = cells[j];
      cells[j] = tmp;
    }
  } while (!isSolvable(cells, n));
  return cells;
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const n = level.size;
  const L = n * n;
  const cells = shuffleCells(n, rng);

  const state = {
    level: level.index,
    size: n,
    cells,
    blank: cells.indexOf(0),
    moves: 0,
    time: 0,
    phase: 'playing', // playing | won | lost
    timeLimit: level.timeLimit,
    timePar: level.timePar,
    movePar: level.movePar,
    hintLeft: level.hintCount,
    shuffleLeft: level.shuffleCount,
    combo: 0,
    maxCombo: 0,
    stars: 0,
    result: null,
    hint: null, // 提示高亮的格子 index
    doneRows: [],
    doneCols: [],
    milestones: 0,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],

    // ---- 时间推进（超时判负）
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      s.time += dt;
      if (s.time >= s.timeLimit) {
        s.time = s.timeLimit;
        this._lose('timeOut');
      }
    },

    // ---- 滑动：点击与空位同行/列的格子 t，整行/整列朝空位滑一格
    move(t) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      t |= 0;
      const L = s.size * s.size;
      if (t < 0 || t >= L) return { ok: false, reason: 'bounds' };
      const b = s.blank;
      if (t === b) return { ok: false, reason: 'blank' };
      const sameRow = Math.floor(t / s.size) === Math.floor(b / s.size);
      const sameCol = (t % s.size) === (b % s.size);
      if (!sameRow && !sameCol) return { ok: false, reason: 'notAligned' };
      const step = sameRow ? 1 : s.size;

      const cells = s.cells;
      if (t < b) {
        for (let cur = b; cur > t; cur -= step) cells[cur] = cells[cur - step];
      } else {
        for (let cur = b; cur < t; cur += step) cells[cur] = cells[cur + step];
      }
      cells[t] = 0;
      s.blank = t;
      s.moves += 1;
      s.hint = null;

      // 是否有数字块新落到归位位置（连击依据）
      let landedHome = false;
      const lo = Math.min(t, b);
      const hi = Math.max(t, b);
      for (let p = lo; p <= hi; p += step) {
        if (p === t) continue;
        if (p < L - 1 && cells[p] === p + 1) { landedHome = true; break; }
      }

      if (landedHome) {
        s.combo += 1;
        if (s.combo > s.maxCombo) s.maxCombo = s.combo;
        if (s.combo >= GAME.COMBO_MIN) this._emit({ type: 'combo', combo: s.combo });
      } else {
        s.combo = 0;
      }

      this._emit({ type: 'slide', index: t, landedHome, combo: s.combo });
      this._updateMilestones();

      if (this._isSolved()) this._win();
      return { ok: true, landedHome };
    },

    // ---- 提示：高亮第一个未归位数字（有限次数）
    hint() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.hintLeft <= 0) return { ok: false, reason: 'noHint' };
      s.hintLeft -= 1;
      const L = s.size * s.size;
      let index = -1;
      for (let i = 0; i < L - 1; i += 1) {
        if (s.cells[i] !== i + 1) { index = i; break; }
      }
      if (index === -1) index = L - 1;
      s.hint = index;
      this._emit({ type: 'hint', index, value: s.cells[index] });
      return { ok: true, index, value: s.cells[index] };
    },

    // ---- 重洗：重新打乱（可解），清空步数与连击，时间照走（有限次数）
    shuffle() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.shuffleLeft <= 0) return { ok: false, reason: 'noShuffle' };
      s.shuffleLeft -= 1;
      s.cells = shuffleCells(s.size, this._rng);
      s.blank = s.cells.indexOf(0);
      s.moves = 0;
      s.combo = 0;
      s.hint = null;
      this._resetMilestoneBaseline();
      this._emit({ type: 'shuffle' });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        size: s.size,
        time: s.time,
        timeLimit: s.timeLimit,
        moves: s.moves,
        phase: s.phase,
        hintLeft: s.hintLeft,
        shuffleLeft: s.shuffleLeft,
        combo: s.combo,
        maxCombo: s.maxCombo,
        stars: s.stars,
        hint: s.hint,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _isSolved() {
      const s = this.state;
      const L = s.size * s.size;
      for (let i = 0; i < L - 1; i += 1) if (s.cells[i] !== i + 1) return false;
      return true;
    },

    _rowComplete(r) {
      const s = this.state;
      for (let c = 0; c < s.size; c += 1) {
        const i = r * s.size + c;
        if (i === s.size * s.size - 1) { if (s.cells[i] !== 0) return false; }
        else if (s.cells[i] !== i + 1) return false;
      }
      return true;
    },

    _colComplete(c) {
      const s = this.state;
      const L = s.size * s.size;
      for (let r = 0; r < s.size; r += 1) {
        const i = r * s.size + c;
        if (i === L - 1) { if (s.cells[i] !== 0) return false; }
        else if (s.cells[i] !== i + 1) return false;
      }
      return true;
    },

    _resetMilestoneBaseline() {
      const s = this.state;
      s.doneRows = [];
      s.doneCols = [];
      for (let r = 0; r < s.size; r += 1) s.doneRows[r] = this._rowComplete(r);
      for (let c = 0; c < s.size; c += 1) s.doneCols[c] = this._colComplete(c);
    },

    _updateMilestones() {
      const s = this.state;
      for (let r = 0; r < s.size; r += 1) {
        const now = this._rowComplete(r);
        if (now && !s.doneRows[r]) {
          s.doneRows[r] = true;
          s.milestones += 1;
          this._emit({ type: 'milestone', kind: 'row', index: r, count: s.milestones });
        }
      }
      for (let c = 0; c < s.size; c += 1) {
        const now = this._colComplete(c);
        if (now && !s.doneCols[c]) {
          s.doneCols[c] = true;
          s.milestones += 1;
          this._emit({ type: 'milestone', kind: 'col', index: c, count: s.milestones });
        }
      }
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.stars = 1 + (s.time <= s.timePar ? 1 : 0) + (s.moves <= s.movePar ? 1 : 0);
      s.result = { won: true, stars: s.stars, time: s.time, moves: s.moves, maxCombo: s.maxCombo };
      this._emit({ type: 'win', stars: s.stars, time: s.time, moves: s.moves, maxCombo: s.maxCombo });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, time: s.time, moves: s.moves };
      this._emit({ type: 'lose', reason });
    },
  };

  run._resetMilestoneBaseline();
  run._emit({ type: 'start', level: state.level, size: n });
  return run;
}

// ------------------------------------------------------------------ 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
