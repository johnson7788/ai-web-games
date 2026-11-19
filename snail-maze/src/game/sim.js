// SNAIL MAZE · 模拟层（纯逻辑，零 DOM/window/canvas/Date.now）
// 玩法：霓虹蜗牛在发光管道里自动滑行，到拐角按一下转向；撞墙死亡、到终点过关。
// 新机制：星尘收集（评分/连击/星级）、连击倍率（×1..×5）、岩石壳击（时机点击击碎）。
import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';
import { mulberry32 } from './rng.js';

export { mulberry32 };

const DIR_VEC = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPP = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const PERPS = { top: ['left', 'right'], bottom: ['left', 'right'], left: ['top', 'bottom'], right: ['top', 'bottom'] };

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const list = level.list;
  const lens = list.map((s) => s.num);
  const speed = level.speed * GAME.SPEED_SCALE;

  // 折线点（拐角坐标）
  const points = [{ x: 0, y: 0 }];
  for (const seg of list) {
    const v = DIR_VEC[seg.str];
    const p = points[points.length - 1];
    points.push({ x: p.x + v.x * seg.num, y: p.y + v.y * seg.num });
  }

  // 星尘 / 岩石：带世界坐标与存活标记（每局独立）
  const orbs = level.orbs.map((o) => {
    const seg = list[o.seg];
    const p = points[o.seg];
    const v = DIR_VEC[seg.str];
    return { seg: o.seg, d: o.d, alive: true, x: p.x + v.x * o.d, y: p.y + v.y * o.d };
  });
  const rocks = level.rocks.map((r) => {
    const seg = list[r.seg];
    const p = points[r.seg];
    const v = DIR_VEC[seg.str];
    return { seg: r.seg, d: r.d, alive: true, warned: false, x: p.x + v.x * r.d, y: p.y + v.y * r.d };
  });

  const state = {
    level: level.index,               // 0 基
    phase: 'countdown',               // countdown | running | won | lost
    countdownT: 1.0,
    seg: 0,
    dist: 0,
    dir: list[0].str,
    veered: false,
    veerDir: null,
    lat: 0,
    speed,
    time: 0,
    score: 0,
    combo: 1,
    orbsCollected: 0,
    orbsTotal: level.orbs.length,
    rocksHit: 0,
    rocksBashed: 0,
    rockTotal: level.rocks.length,
    rating: 0,
    turnAvailable: false,
    bashWindow: false,
    rotate: level.rotate,
    random: level.random,
  };

  const run = {
    state,
    _level: level,
    _points: points,
    _orbs: orbs,
    _rocks: rocks,
    _rng: rng,
    _events: [],
    _prevTurn: false,

    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      s.time += dt;

      if (s.phase === 'countdown') {
        s.countdownT -= dt;
        if (s.countdownT <= 0) {
          s.phase = 'running';
          this._emit({ type: 'start' });
        }
        return;
      }

      if (s.veered) {
        s.lat += s.speed * dt;
        if (s.lat >= GAME.CORRIDOR_HALF) this._lose('wall');
        return;
      }

      const prevDist = s.dist;
      s.dist += s.speed * dt;
      const len = lens[s.seg];

      this._cross(s.seg, prevDist, s.dist);

      if (s.seg === lens.length - 1) {
        if (s.dist >= len) this._win();
        s.turnAvailable = false;
      } else {
        if (s.dist > len + GAME.MARGIN) { this._lose('wall'); return; }
        s.turnAvailable = s.dist >= len - GAME.PRE_WINDOW;
      }
      s.bashWindow = this._inBashWindow() !== null;

      if (s.turnAvailable && !this._prevTurn) this._emit({ type: 'arrow', seg: s.seg });
      this._prevTurn = s.turnAvailable;
    },

    tap() {
      const s = this.state;
      if (s.phase !== 'running') return { ok: false, reason: 'phase' };
      const bashIdx = this._inBashWindow();
      if (bashIdx !== null) { this._bash(bashIdx); return { ok: true, type: 'bash' }; }
      if (this._inTurnWindow()) { this._turn(); return { ok: true, type: 'turn' }; }
      this._veer();
      return { ok: true, type: 'veer' };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    getHud() {
      const s = this.state;
      let traveled = s.dist;
      for (let i = 0; i < s.seg; i += 1) traveled += lens[i];
      const total = lens.reduce((a, b) => a + b, 0);
      return {
        level: s.level + 1,
        phase: s.phase,
        score: s.score,
        combo: s.combo,
        orbsCollected: s.orbsCollected,
        orbsTotal: s.orbsTotal,
        rockTotal: s.rockTotal,
        rocksHit: s.rocksHit,
        rocksBashed: s.rocksBashed,
        rating: s.rating,
        time: s.time,
        speed: s.speed,
        progress: total > 0 ? Math.min(1, traveled / total) : 0,
      };
    },

    // 供 bot / 提示使用：当前最优动作
    hint() {
      const s = this.state;
      if (s.phase !== 'running') return null;
      const bashIdx = this._inBashWindow();
      if (bashIdx !== null) return 'bash';
      if (s.veered) return null;
      if (s.seg < lens.length - 1 && s.dist >= lens[s.seg] - 2) return 'turn';
      return null;
    },

    snail() {
      const s = this.state;
      const segDir = list[s.seg].str;
      const p = this._points[s.seg];
      const base = DIR_VEC[segDir];
      const bx = p.x + base.x * s.dist;
      const by = p.y + base.y * s.dist;
      if (s.veered) {
        const v = DIR_VEC[s.veerDir];
        return { x: bx + v.x * s.lat, y: by + v.y * s.lat, dir: s.veerDir };
      }
      return { x: bx, y: by, dir: s.dir };
    },

    view() {
      return {
        points: this._points,
        dirs: list.map((x) => x.str),
        lens,
        orbs: this._orbs,
        rocks: this._rocks,
        rotate: this.state.rotate,
        random: this.state.random,
        speed: this.state.speed,
      };
    },

    _emit(e) { this._events.push(e); },

    _cross(segIdx, from, to) {
      const s = this.state;
      for (const o of this._orbs) {
        if (!o.alive || o.seg !== segIdx) continue;
        if (o.d > from && o.d <= to) {
          o.alive = false;
          s.orbsCollected += 1;
          s.score += GAME.ORB_SCORE * s.combo;
          const old = s.combo;
          s.combo = Math.min(GAME.COMBO_MAX, s.combo + 1);
          this._emit({ type: 'star', x: o.x, y: o.y, orbsCollected: s.orbsCollected, combo: s.combo });
          if (s.combo !== old) this._emit({ type: 'combo', combo: s.combo });
        }
      }
      for (const r of this._rocks) {
        if (!r.alive || r.seg !== segIdx) continue;
        if (!r.warned && to >= r.d - GAME.NEAR_ROCK) {
          r.warned = true;
          this._emit({ type: 'nearRock', x: r.x, y: r.y });
        }
        if (r.d > from && r.d <= to) {
          r.alive = false;
          s.rocksHit += 1;
          s.combo = 1;
          s.score = Math.max(0, s.score - GAME.ROCK_PENALTY);
          this._emit({ type: 'rockHit', x: r.x, y: r.y, combo: s.combo });
        }
      }
    },

    _inBashWindow() {
      const s = this.state;
      if (s.veered) return null;
      for (let i = 0; i < this._rocks.length; i += 1) {
        const r = this._rocks[i];
        if (!r.alive || r.seg !== s.seg) continue;
        if (Math.abs(s.dist - r.d) <= GAME.BASH_WINDOW) return i;
      }
      return null;
    },

    _inTurnWindow() {
      const s = this.state;
      if (s.veered || s.seg >= lens.length - 1) return false;
      return s.dist >= lens[s.seg] - GAME.PRE_WINDOW;
    },

    _turn() {
      const s = this.state;
      s.dir = list[s.seg + 1].str;
      s.seg += 1;
      s.dist = 0;
      s.turnAvailable = false;
      this._prevTurn = false;
      this._emit({ type: 'turn', dir: s.dir, seg: s.seg });
    },

    _bash(idx) {
      const s = this.state;
      const r = this._rocks[idx];
      r.alive = false;
      s.rocksBashed += 1;
      s.score += GAME.BASH_SCORE;
      this._emit({ type: 'bash', x: r.x, y: r.y, score: s.score });
    },

    _veer() {
      const s = this.state;
      const perps = PERPS[s.dir];
      s.veerDir = perps[Math.floor(this._rng() * perps.length)];
      s.veered = true;
      s.lat = 0;
      this._emit({ type: 'veered', dir: s.veerDir });
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const all = s.orbsTotal === 0 || s.orbsCollected >= s.orbsTotal;
      const clean = s.rocksHit === 0;
      let rating = 1;
      if (all && clean) rating = 3;
      else if (all || (clean && s.orbsCollected >= Math.ceil(s.orbsTotal * 0.6))) rating = 2;
      s.rating = rating;
      s.result = { won: true, rating, score: s.score, orbsCollected: s.orbsCollected, orbsTotal: s.orbsTotal, rocksHit: s.rocksHit, time: s.time };
      this._emit({ type: 'win', rating, score: s.score });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, rating: 0, score: s.score, orbsCollected: s.orbsCollected, orbsTotal: s.orbsTotal, reason };
      this._emit({ type: 'lose', reason });
    },
  };

  return run;
}
