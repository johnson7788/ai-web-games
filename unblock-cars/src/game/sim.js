// UNBLOCK CARS · 模拟层（纯逻辑，零 DOM/window/canvas）
// 职责：车辆滑动、碰撞/岩石判定、连击计分、撤回、提示（BFS 求解）、星级结算、事件表。
// 依赖：src/game/levels.js（getLevel / solveCars / isSolved）。
// 随机：注入 seed 的 mulberry32，可复现。

import { getLevel, solveCars, isSolved, COLS, ROWS, mulberry32 } from './levels.js';
import { GAME } from '../../config/game.config.js';

export { mulberry32, solveCars, isSolved, COLS, ROWS };

// ---------------- 车辆工具 ----------------

function carCoordKey(car) {
  return car.o === 'H' ? 'col' : 'row';
}

function cellsOf(car) {
  const cells = [];
  for (let i = 0; i < car.len; i += 1) {
    if (car.o === 'H') cells.push([car.row, car.col + i]);
    else cells.push([car.row + i, car.col]);
  }
  return cells;
}

function occupancyExcluding(cars, rocks, excludeId) {
  const s = new Set();
  for (const [r, c] of rocks) s.add(`${r},${c}`);
  for (const car of cars) {
    if (car.id === excludeId) continue;
    for (const [r, c] of cellsOf(car)) s.add(`${r},${c}`);
  }
  return s;
}

function slideRange(car, occ) {
  let lo;
  let hi;
  if (car.o === 'H') {
    lo = car.col; hi = car.col;
    while (lo - 1 >= 0 && !occ.has(`${car.row},${lo - 1}`)) lo -= 1;
    while (hi + car.len < COLS && !occ.has(`${car.row},${hi + car.len}`)) hi += 1;
  } else {
    lo = car.row; hi = car.row;
    while (lo - 1 >= 0 && !occ.has(`${lo - 1},${car.col}`)) lo -= 1;
    while (hi + car.len < ROWS && !occ.has(`${hi + car.len},${car.col}`)) hi += 1;
  }
  return [lo, hi];
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------- createRun ----------------

export function createRun(levelIndex = 0, opts = {}) {
  const level = getLevel(levelIndex);
  const cars = level.cars.map((c) => ({ ...c }));

  const state = {
    level: level.index,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    rows: level.rows,
    cols: level.cols,
    heroRow: level.heroRow,
    cars,
    rocks: level.rocks.map(([r, c]) => [r, c]),
    moves: 0,
    maxMoves: level.maxMoves,
    par: level.par,
    elapsed: 0,
    score: 0,
    combo: 1,
    comboStreak: 0,
    bestCombo: 1,
    stars: 0,
    hintsLeft: GAME.HINTS_PER_LEVEL,
    hint: null,          // { carId, to }
    history: [],         // 撤回快照
    result: null,
  };

  const run = {
    state,
    _level: level,
    _events: [],
    _clock: 0,

    // ---- 时间推进（回合制：只累计计时，供计时器/粒子/遥测用）----
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;
      s.elapsed += dt;
    },

    // ---- 把车滑到指定坐标（H=col，V=row），自动夹到可达范围；无效则拒绝 ----
    moveCar(carId, to) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      const car = s.cars.find((c) => c.id === carId);
      if (!car) return { ok: false, reason: 'noCar' };
      const key = carCoordKey(car);
      const before = car[key];
      const occ = occupancyExcluding(s.cars, s.rocks, car.id);
      const [lo, hi] = slideRange(car, occ);
      const target = clamp(Math.round(to), lo, hi);
      if (target === before) {
        this._emit({ type: 'block', carId, reason: 'noMove' });
        return { ok: false, reason: 'noMove', target };
      }
      return this._commit(car, key, before, target);
    },

    // ---- 单步滑动（方向：'left'|'right'|'up'|'down'），供键盘/随机自对弈用 ----
    nudge(carId, dir) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      const car = s.cars.find((c) => c.id === carId);
      if (!car) return { ok: false, reason: 'noCar' };
      const key = carCoordKey(car);
      const delta = dir === 'right' || dir === 'down' ? 1 : dir === 'left' || dir === 'up' ? -1 : 0;
      if (!delta) return { ok: false, reason: 'badDir' };
      const before = car[key];
      const occ = occupancyExcluding(s.cars, s.rocks, car.id);
      const [lo, hi] = slideRange(car, occ);
      const target = clamp(before + delta, lo, hi);
      if (target === before) {
        this._emit({ type: 'block', carId, reason: 'blocked' });
        return { ok: false, reason: 'blocked', target };
      }
      return this._commit(car, key, before, target);
    },

    _commit(car, key, before, target) {
      const s = this.state;
      s.history.push({
        carId: car.id,
        key,
        prev: before,
        moves: s.moves,
        score: s.score,
        combo: s.combo,
        comboStreak: s.comboStreak,
        bestCombo: s.bestCombo,
      });
      car[key] = target;
      s.moves += 1;
      s.comboStreak += 1;
      s.combo = Math.min(s.comboStreak, GAME.COMBO_CAP);
      if (s.combo > s.bestCombo) s.bestCombo = s.combo;
      s.score += GAME.BASE_SCORE_PER_MOVE * s.combo;
      if (s.hint && s.hint.carId === car.id) s.hint = null;
      if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo });
      this._emit({ type: 'move', carId: car.id, to: target, moves: s.moves, combo: s.combo });

      if (isSolved(s.cars)) {
        this._win();
        return { ok: true, won: true };
      }
      if (s.moves >= s.maxMoves) {
        this._lose('stalled');
        return { ok: true, lost: true };
      }
      return { ok: true };
    },

    // ---- 撤回：回退上一手（含步数/分数/连击）----
    undo() {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      if (!s.history.length) return { ok: false, reason: 'empty' };
      const h = s.history.pop();
      const car = s.cars.find((c) => c.id === h.carId);
      if (car) car[h.key] = h.prev;
      s.moves = h.moves;
      s.score = h.score;
      s.combo = h.combo;
      s.comboStreak = h.comboStreak;
      s.bestCombo = h.bestCombo;
      s.hint = null;
      this._emit({ type: 'undo', moves: s.moves, combo: s.combo });
      return { ok: true };
    },

    // ---- 提示：用 BFS 求当前状态下一步最优解 ----
    hint() {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      if (s.hintsLeft <= 0) return { ok: false, reason: 'noHints' };
      const sol = solveCars(s.cars, s.rocks);
      if (!sol || !sol.length) return { ok: false, reason: 'unsolvable' };
      const first = sol[0];
      s.hint = { carId: first.carId, to: first.to };
      s.hintsLeft -= 1;
      this._emit({ type: 'hint', carId: first.carId, to: first.to, hintsLeft: s.hintsLeft });
      return { ok: true, carId: first.carId, to: first.to, hintsLeft: s.hintsLeft };
    },

    // ---- 当前状态的最优解（自对弈/验收用）----
    solve() {
      return solveCars(this.state.cars, this.state.rocks);
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        moves: s.moves,
        maxMoves: s.maxMoves,
        par: s.par,
        elapsed: s.elapsed,
        score: s.score,
        combo: s.combo,
        hintsLeft: s.hintsLeft,
        stars: s.stars,
        heroRow: s.heroRow,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    _emit(e) { this._events.push(e); },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.stars = s.moves <= s.par + 3 ? 3 : s.moves <= s.par + 10 ? 2 : 1;
      s.score += s.stars * GAME.WIN_BONUS_PER_STAR + Math.max(0, s.maxMoves - s.moves) * 25;
      s.result = { won: true, stars: s.stars, score: s.score, moves: s.moves, par: s.par, elapsed: s.elapsed };
      this._emit({ type: 'win', stars: s.stars, score: s.score, moves: s.moves, par: s.par });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, score: s.score, moves: s.moves, par: s.par, elapsed: s.elapsed };
      this._emit({ type: 'lose', reason });
    },
  };

  run._emit({ type: 'levelStart', level: state.level, par: state.par, maxMoves: state.maxMoves });
  return run;
}

export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
