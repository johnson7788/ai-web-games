// PIN & POUR · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：蜜糖分装台的闸板/蜂蜜珠子/气泡珠子/瓶与排口的确定性模拟。
// 物理：珠子在 2D 网格里受重力下落（先竖直，再斜向铺开）；蜂蜜下沉、气泡下沉（危险）。
// 拉闸 = 把闸板单元格变空；珠子即可穿过。
// 判定：蜂蜜进瓶=收集；气泡进瓶=污染(lose)；蜂蜜进排口=浪费(lose)；气泡进排口=安全。
// 依赖：config/levels.js（LEVELS）。随机：注入 seed 的 mulberry32（本作全确定性，seed 仅作兼容）。
import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

export const GRAVITY_TICK = GAME.GRAVITY_TICK || (1 / 16);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGrid(level) {
  const grid = [];
  for (let r = 0; r < level.rows; r += 1) {
    grid[r] = [];
    for (let c = 0; c < level.cols; c += 1) {
      grid[r][c] = { kind: 'empty' };
    }
  }
  for (const [r, c] of level.walls || []) grid[r][c] = { kind: 'wall' };
  for (const [r, c] of level.screens || []) grid[r][c] = { kind: 'screen' };
  for (const [r, c] of level.combs || []) grid[r][c] = { kind: 'comb' };
  for (const [r, c] of level.bottles || []) grid[r][c] = { kind: 'bottle' };
  for (const [r, c] of level.drains || []) grid[r][c] = { kind: 'drain' };
  for (const g of level.gates || []) grid[g.r][g.c] = { kind: 'gate', gateId: g.id };
  return grid;
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const beads = (level.beads || []).map((b, i) => ({
    id: `b${i + 1}`,
    type: b.type,
    r: b.r,
    c: b.c,
    pr: b.r,
    pc: b.c,
    settled: false,
    done: false,
  }));
  const state = {
    level: level.index,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    rows: level.rows,
    cols: level.cols,
    grid: buildGrid(level),
    beads,
    gates: (level.gates || []).map((g) => ({ id: g.id, r: g.r, c: g.c, pulled: false })),
    collected: 0,
    totalHoney: beads.filter((b) => b.type === 'honey').length,
    drained: 0,
    totalBubble: beads.filter((b) => b.type === 'bubble').length,
    pulls: 0,
    par: level.par ?? 1,
    stars: 0,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _physAccum: 0,
    _wasMoving: false,
    _gravTick: GRAVITY_TICK,

    // ---- 时间推进（60Hz 固定步长；内部按 GRAVITY_TICK 离散推进物理）----
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;
      this._physAccum += dt;
      let guard = 0;
      while (this._physAccum >= this._gravTick && s.phase === 'playing' && guard < 300) {
        this._physAccum -= this._gravTick;
        const moved = this._tick();
        if (moved > 0) this._emit({ type: 'flowTick', moved });
        guard += 1;
      }
    },

    // 推进单个物理 tick（solver/selfplay 用，绕过 60Hz 累加器）
    tick() {
      const s = this.state;
      if (s.phase !== 'playing') return 0;
      const moved = this._tick();
      if (moved > 0) this._emit({ type: 'flowTick', moved });
      return moved;
    },

    // ---- 拉闸 ----
    pullGate(id) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const g = s.gates.find((x) => x.id === id);
      if (!g) return { ok: false, reason: 'noGate' };
      if (g.pulled) return { ok: false, reason: 'pulled' };
      g.pulled = true;
      s.grid[g.r][g.c].kind = 'empty';
      s.grid[g.r][g.c].gateId = null;
      s.pulls += 1;
      this._emit({ type: 'gatePull', gate: id, pulls: s.pulls });
      return { ok: true, gate: id };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        collected: s.collected,
        totalHoney: s.totalHoney,
        drained: s.drained,
        totalBubble: s.totalBubble,
        pulls: s.pulls,
        par: s.par,
        stars: s.stars,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // 快进到终局（调试 / gif / 验收）
    fastForward(maxTicks = 4000) {
      const s = this.state;
      let guard = maxTicks;
      while (guard-- > 0 && s.phase === 'playing') this.tick();
      return s.phase;
    },

    // 所有珠子是否都已静止（solver 判断「已settle」用）
    isSettled() {
      const s = this.state;
      if (s.phase !== 'playing') return true;
      const occ = this._occ();
      for (const b of s.beads) {
        if (b.done) continue;
        if (this._findTarget(b, occ)) return false;
      }
      return true;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _occ() {
      const set = new Set();
      for (const b of this.state.beads) if (!b.done) set.add(`${b.r},${b.c}`);
      return set;
    },

    _findTarget(b, occ) {
      const s = this.state;
      const dirs = [[1, 0], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        const nr = b.r + dr;
        const nc = b.c + dc;
        if (nr >= s.rows || nr < 0 || nc < 0 || nc >= s.cols) continue;
        const cell = s.grid[nr][nc];
        if (cell.kind === 'wall' || cell.kind === 'gate') continue;
        if (cell.kind === 'screen') {
          // 滤网：只有气泡能穿过；蜂蜜视为实心墙
          if (b.type === 'bubble') return { r: nr, c: nc };
          continue;
        }
        if (cell.kind === 'comb') {
          // 蜂巢块：只有蜂蜜能穿过去并把它冲走；气泡视为实心墙
          if (b.type === 'honey') return { r: nr, c: nc, dissolve: true };
          continue;
        }
        if (occ.has(`${nr},${nc}`)) continue;
        if (cell.kind === 'bottle' || cell.kind === 'drain') {
          return { absorb: true, kind: cell.kind, r: nr, c: nc };
        }
        if (cell.kind === 'empty') return { r: nr, c: nc };
      }
      return null;
    },

    _tick() {
      const s = this.state;
      if (s.phase !== 'playing') return 0;
      const occ = this._occ();
      const order = [...s.beads].filter((b) => !b.done).sort((a, b) => (b.r - a.r) || (a.c - b.c));
      let moved = 0;
      for (const b of order) {
        if (b.done || s.phase !== 'playing') continue;
        const target = this._findTarget(b, occ);
        if (!target) {
          // 蜂蜜落到最底行却不在瓶里 = 浪费
          if (b.type === 'honey' && b.r === s.rows - 1) {
            this._lose('waste', b.r, b.c);
            return moved;
          }
          b.settled = true;
          continue;
        }
        if (target.absorb) {
          occ.delete(`${b.r},${b.c}`);
          this._absorb(b, target.kind);
          moved += 1;
          continue;
        }
        occ.delete(`${b.r},${b.c}`);
        b.pr = b.r; b.pc = b.c;
        b.r = target.r; b.c = target.c; b.settled = false;
        occ.add(`${b.r},${b.c}`);
        if (target.dissolve) {
          s.grid[target.r][target.c].kind = 'empty';
          this._emit({ type: 'wash', r: target.r, c: target.c });
        }
        moved += 1;
      }
      if (s.beads.some((b) => b.done)) s.beads = s.beads.filter((b) => !b.done);

      if (moved > 0) {
        this._wasMoving = true;
      } else if (this._wasMoving) {
        this._wasMoving = false;
        this._emit({ type: 'settle' });
      }
      this._checkWin();
      return moved;
    },

    _absorb(b, kind) {
      const s = this.state;
      b.done = true;
      if (b.type === 'honey') {
        if (kind === 'bottle') {
          s.collected += 1;
          this._emit({ type: 'collect', bead: b.id, collected: s.collected });
        } else {
          this._emit({ type: 'waste', bead: b.id });
          this._lose('waste', b.r, b.c);
        }
      } else {
        if (kind === 'drain') {
          s.drained += 1;
          this._emit({ type: 'drain', bead: b.id, drained: s.drained });
        } else {
          this._emit({ type: 'pollution', bead: b.id });
          this._lose('pollution', b.r, b.c);
        }
      }
    },

    _checkWin() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      // 必须等所有珠子都静止（气泡还可能继续掉落污染），才能判胜。
      if (s.collected >= s.totalHoney && s.totalHoney > 0 && this.isSettled()) {
        s.phase = 'won';
        const perfect = s.pulls <= s.par;
        const clean = s.drained === s.totalBubble;
        const stars = 1 + (perfect ? 1 : 0) + (clean ? 1 : 0);
        s.stars = stars;
        s.result = { won: true, stars, collected: s.collected, drained: s.drained, pulls: s.pulls };
        this._emit({ type: 'win', stars, collected: s.collected, drained: s.drained, pulls: s.pulls });
      }
    },

    _lose(reason, r, c) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, collected: s.collected, drained: s.drained, pulls: s.pulls };
      this._emit({ type: 'lose', reason, r: r ?? null, c: c ?? null });
    },
  };

  return run;
}

export function createSim() {
  return createRun(0, { seed: 1 });
}
