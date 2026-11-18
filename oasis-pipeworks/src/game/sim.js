// Oasis Pipeworks · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：管件队列、抓取/放置/铲除、倒计时、水流推进、星级结算、事件表。
// 依赖：config/levels.js（LEVELS/LEVEL_COUNT）。
// 契约：docs/README.md §3.3-§3.5（createRun API / state 形状 / 事件表）。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVELS } from '../../config/levels.js';

// ------------------------------------------------------------------ 方向
export const OPPOSITE = { top: 'down', down: 'top', left: 'right', right: 'left' };
const DR = { top: -1, down: 1, left: 0, right: 0 };
const DC = { top: 0, down: 0, left: -1, right: 1 };

// ------------------------------------------------------------------ 管型
// piece: 'E' | 'N' | 'UL' | 'UR' | 'LL' | 'LR' | 'X'
export function opens(piece) {
  switch (piece) {
    case 'E': return ['left', 'right'];
    case 'N': return ['top', 'down'];
    case 'UL': return ['left', 'top'];
    case 'UR': return ['top', 'right'];
    case 'LL': return ['left', 'down'];
    case 'LR': return ['down', 'right'];
    case 'X': return ['top', 'down', 'left', 'right'];
    default: return [];
  }
}

// 水从 enter 边进入 piece，从哪条边出；不匹配返回 null。
// X 简化为直通（竖进竖出、横进横出）：退出边 = 对边。
export function exitOf(piece, enter) {
  if (piece === 'X') return OPPOSITE[enter] ?? null;
  const edges = opens(piece);
  if (!edges.includes(enter)) return null;
  return edges.find((e) => e !== enter) ?? null;
}

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PIECE_WEIGHTS = [
  ['E', 0.22], ['N', 0.22],
  ['UL', 0.12], ['UR', 0.12], ['LL', 0.12], ['LR', 0.12],
  ['X', 0.08], // 仅 L5+ 计入权重
];

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const grid = buildGrid(level);
  const state = {
    level: level.index,
    phase: 'countdown', // 'countdown' | 'flowing' | 'won' | 'lost'
    rows: level.rows,
    cols: level.cols,
    grid,
    start: { r: level.start.r, c: level.start.c, entrance: level.start.entrance, exit: OPPOSITE[level.start.entrance] },
    end: { r: level.end.r, c: level.end.c, entrance: level.end.entrance, exit: OPPOSITE[level.end.entrance] },
    queue: [],
    queueCap: level.queueCap,
    selected: null,
    timeLeft: level.time,
    initialTime: level.time,
    water: { path: [], cells: [], head: 0, t: 0 },
    blooms: 0,
    bloomTotal: level.blooms.length,
    digLeft: level.dig ? 1 : 0,
    digMax: 2,
    placements: 0,
    stars: 0,
    result: null,
  };

  const run = {
    state,
    inputLatencyProbe: null, // 遥测占位，main 层测
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0, // 累计 sim 秒
    _flowClock: 0, // flowStart 起的秒数
    _blockTime: level.blockTime,
    _lastSecond: Math.ceil(level.time),
    _tickIdx: 0,
    _bloomCounted: new Set(),

    // ---- 时间推进
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1; // 防大跳帧
      this._clock += dt;

      for (const q of s.queue) {
        if (q.offsetT > 0) q.offsetT = Math.max(0, q.offsetT - dt * 2);
      }

      if (s.phase === 'countdown') {
        s.timeLeft -= dt;
        const sec = Math.ceil(s.timeLeft);
        if (sec < this._lastSecond && sec >= 0) {
          this._lastSecond = sec;
          this._emit({ type: 'countdownTick', timeLeft: sec });
        }
        if (s.timeLeft <= 0) {
          s.timeLeft = 0;
          this._lose('timeOut', null, null);
        }
      } else if (s.phase === 'flowing') {
        this._flowClock += dt;
        // 水头进程的细粒度反馈：每格 5 个路径点发一次 flowTick（视觉水头 + 音效水滴同步）
        const tickIdx = Math.floor((this._flowClock / this._blockTime) * 5);
        while (this._tickIdx < tickIdx) {
          this._tickIdx += 1;
          this._emit({ type: 'flowTick', i: this._tickIdx, t: this._flowClock });
        }
        this._stepFlow();
      }
    },

    // ---- 开闸（main 在倒计时内调用；到 0 未开闸则 timeOut）
    startFlow() {
      if (this.state.phase !== 'countdown') return { ok: false, reason: 'notCountdown' };
      const s = this.state;
      s.phase = 'flowing';
      this._flowClock = 0;
      this._tickIdx = 0;
      const w = s.water;
      w.cells = [];
      w.path = [];
      w.head = 0;
      w.t = 0;
      this._enterCell(s.start.r, s.start.c, s.start.entrance);
      this._emit({ type: 'flowStart' });
      return { ok: true };
    },

    // ---- 抓队首可抓件（底槽起，第一件未锁定）
    grab() {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      if (s.selected) return { ok: false, reason: 'holding' };
      const idx = s.queue.findIndex((q) => !q.locked);
      if (idx === -1) return { ok: false, reason: s.queue.length ? 'locked' : 'empty' };
      const [item] = s.queue.splice(idx, 1);
      s.selected = item.piece;
      for (let i = idx; i < s.queue.length; i += 1) s.queue[i].offsetT = 1;
      this._refill();
      this._emit({ type: 'grab', piece: item.piece });
      return { ok: true, piece: item.piece };
    },

    // ---- 放置 selected 到空格（bloom 格可放）
    place(r, c) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      if (!s.selected) return { ok: false, reason: 'noSelection' };
      if (r < 0 || r >= s.rows || c < 0 || c >= s.cols) return { ok: false, reason: 'bounds' };
      const cell = s.grid[r][c];
      if (cell.kind !== 'empty' && cell.kind !== 'bloom') return { ok: false, reason: 'occupied' };
      const piece = s.selected;
      cell.kind = 'pipe';
      cell.piece = piece;
      cell.bloom = cell.bloom || false;
      cell.watered = false;
      cell.waterT = 0;
      s.selected = null;
      s.placements += 1;
      if (s.placements >= 3) for (const q of s.queue) q.locked = false;
      this._emit({ type: 'place', r, c, piece });
      return { ok: true };
    },

    // ---- 铲除已放管格（岩石/起点/终点不可铲）
    dig(r, c) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      if (r < 0 || r >= s.rows || c < 0 || c >= s.cols) return { ok: false, reason: 'bounds' };
      const cell = s.grid[r][c];
      if (cell.kind !== 'pipe') return { ok: false, reason: 'notPipe' };
      if (s.digLeft <= 0) return { ok: false, reason: 'noDig' };
      cell.kind = cell.bloom ? 'bloom' : 'empty';
      cell.piece = null;
      cell.watered = false;
      cell.waterT = 0;
      s.digLeft -= 1;
      this._emit({ type: 'dig', r, c });
      return { ok: true };
    },

    // ---- 广告补铲（main 调用），封顶 2 次
    addDig() {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      if (s.digLeft >= s.digMax) return { ok: false, reason: 'max' };
      s.digLeft += 1;
      return { ok: true, digLeft: s.digLeft };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        timeLeft: s.timeLeft,
        phase: s.phase,
        blooms: s.blooms,
        bloomTotal: s.bloomTotal,
        digLeft: s.digLeft,
        stars: s.stars,
        queueLen: s.queue.length,
        selected: s.selected,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _rollPiece() {
      const weights = this.state.level >= 5 ? PIECE_WEIGHTS : PIECE_WEIGHTS.filter(([p]) => p !== 'X');
      const total = weights.reduce((sum, [, w]) => sum + w, 0);
      let r = this._rng() * total;
      for (const [p, w] of weights) {
        r -= w;
        if (r <= 0) return p;
      }
      return 'E';
    },

    _refill(quiet = false) {
      const s = this.state;
      while (s.queue.length < s.queueCap) {
        const piece = this._rollPiece();
        s.queue.push({ piece, locked: false, offsetT: quiet ? 0 : 1 });
        if (!quiet) this._emit({ type: 'queueRefill', piece });
      }
      this._ensureLock();
    },

    // L10+：placements<3 时队列里保持 1 件锁定（锁最新/顶端件），≥3 全解锁。
    _ensureLock() {
      const s = this.state;
      if (!this._level.lock) return;
      if (s.placements >= 3) {
        for (const q of s.queue) q.locked = false;
        return;
      }
      if (s.queue.some((q) => q.locked)) return;
      if (s.queue.length) s.queue[s.queue.length - 1].locked = true;
    },

    _cellExit(wc) {
      const cell = this.state.grid[wc.r][wc.c];
      if (cell.kind === 'start') return this.state.start.exit;
      if (cell.kind === 'end') return null;
      return exitOf(cell.piece, wc.enter);
    },

    _enterCell(r, c, enter) {
      const s = this.state;
      const w = s.water;
      w.cells.push({ r, c, tEnter: this._flowClock, tExit: this._flowClock + this._blockTime, enter });
      w.path.push({ r, c });
      w.head = w.cells.length - 1;
      w.t = 0;
      const cell = s.grid[r][c];
      cell.watered = true;
      cell.waterT = 0;
      this._emit({ type: 'cellWatered', r, c });
      if (cell.bloom && !this._bloomCounted.has(`${r},${c}`)) {
        this._bloomCounted.add(`${r},${c}`);
        s.blooms += 1;
        this._emit({ type: 'bloom', r, c, blooms: s.blooms });
      }
    },

    _stepFlow() {
      const s = this.state;
      const w = s.water;
      if (w.head >= w.cells.length) return;
      const cur = w.cells[w.head];
      w.t = Math.min(1, (this._flowClock - cur.tEnter) / this._blockTime);
      s.grid[cur.r][cur.c].waterT = w.t;
      let guard = 0;
      while (
        s.phase === 'flowing' && w.head < w.cells.length &&
        this._flowClock >= w.cells[w.head].tExit
      ) {
        this._advance();
        if (++guard > s.rows * s.cols + 2) break;
        if (s.phase === 'flowing' && w.head < w.cells.length) {
          const nc = w.cells[w.head];
          w.t = Math.min(1, (this._flowClock - nc.tEnter) / this._blockTime);
          s.grid[nc.r][nc.c].waterT = w.t;
        }
      }
    },

    _advance() {
      const s = this.state;
      const w = s.water;
      const cur = w.cells[w.head];
      const exit = this._cellExit(cur);
      if (exit === null) return this._lose('deadEnd', cur.r, cur.c);
      const nr = cur.r + DR[exit];
      const nc = cur.c + DC[exit];
      if (nr < 0 || nr >= s.rows || nc < 0 || nc >= s.cols) return this._lose('deadEnd', cur.r, cur.c);
      const ncell = s.grid[nr][nc];
      const inDir = OPPOSITE[exit];
      if (ncell.kind === 'end') {
        if (s.end.entrance === inDir) {
          this._enterCell(nr, nc, inDir);
          this._win();
        } else {
          this._lose('deadEnd', cur.r, cur.c);
        }
        return;
      }
      if (ncell.kind === 'rock' || ncell.kind === 'start') return this._lose('deadEnd', cur.r, cur.c);
      if (ncell.kind === 'pipe') {
        if (exitOf(ncell.piece, inDir) !== null) this._enterCell(nr, nc, inDir);
        else this._lose('deadEnd', cur.r, cur.c);
        return;
      }
      // empty 或未放置的 bloom 格 → 断流
      this._lose('deadEnd', cur.r, cur.c);
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.water.t = 1;
      const stars = 1 + (s.blooms === s.bloomTotal ? 1 : 0) + (s.timeLeft >= s.initialTime * 0.3 ? 1 : 0);
      s.stars = stars;
      s.result = { won: true, stars, blooms: s.blooms, bloomTotal: s.bloomTotal, timeLeft: s.timeLeft, placements: s.placements };
      this._emit({ type: 'win', stars, blooms: s.blooms, timeLeft: s.timeLeft });
    },

    _lose(reason, r, c) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, blooms: s.blooms, bloomTotal: s.bloomTotal, timeLeft: s.timeLeft, placements: s.placements };
      this._emit({ type: 'lose', reason, r: r ?? null, c: c ?? null });
    },
  };

  // 初始队列填满并结算锁定件（初始填充不视为 refill，不发 queueRefill）
  run._refill(true);

  return run;
}

function buildGrid(level) {
  const grid = [];
  for (let r = 0; r < level.rows; r += 1) {
    grid[r] = [];
    for (let c = 0; c < level.cols; c += 1) {
      grid[r][c] = { kind: 'empty', piece: null, watered: false, waterT: 0, bloom: false };
    }
  }
  grid[level.start.r][level.start.c] = { kind: 'start', piece: 'N', watered: false, waterT: 0, bloom: false };
  grid[level.end.r][level.end.c] = { kind: 'end', piece: 'N', watered: false, waterT: 0, bloom: false };
  for (const [r, c] of level.rocks) {
    grid[r][c] = { kind: 'rock', piece: null, watered: false, waterT: 0, bloom: false };
  }
  for (const [r, c] of level.blooms) {
    if (grid[r][c].kind === 'empty') {
      grid[r][c].kind = 'bloom';
      grid[r][c].bloom = true;
    }
  }
  return grid;
}

// ------------------------------------------------------------------ 兼容骨架别名（Lead 重写 main 后可移除）
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
