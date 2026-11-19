// BLADE BARRAGE · 模拟层（纯逻辑，零 DOM/window/canvas/Date.now）
// 改编自 Cocos Creator 源码《万剑归一》（local/batch3/extracted/万剑归一creator/assets/Script/one.ts + player.ts）。
// P0 骨架 1:1：飞刃在底部 → 点击垂直向上发射 → 命中来回穿梭的「核心」得分并重生（更小）→ 撞尖刺死亡。
// 新增机制：连击 combo、中心 PERFECT ×2、能量宝石 + Surge（子弹时间）、岩石障碍、空中爆发 burst、3 条命 + 结算。
// 随机：注入 seed 的 mulberry32，完全可复现（selfplay / 测试用）。

import { GAME } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 波次：每 HITS_PER_WAVE 次命中进一波（用于难度 & 推进率）。 */
export function waveFor(hits) {
  return 1 + Math.floor(hits / GAME.HITS_PER_WAVE);
}

/** 核心速度随波次上升。 */
export function coreSpeedFor(hits) {
  return GAME.CORE_SPEED0 + (waveFor(hits) - 1) * GAME.CORE_SPEED_STEP;
}

/** 核心半径随命中缩小（有下限）。 */
export function coreRadiusFor(hits) {
  return Math.max(GAME.CORE_RADIUS_MIN, GAME.CORE_RADIUS0 - hits * GAME.CORE_RADIUS_STEP);
}

/** 星级：按总分 1–3 星。 */
export function starsFor(score) {
  if (score >= GAME.STAR_3) return 3;
  if (score >= GAME.STAR_2) return 2;
  if (score >= GAME.STAR_1) return 1;
  return 0;
}

/** 恒定速度反弹运动在 t 秒后的水平位置（用于 greedy 预测）。 */
export function bounceXAt(x0, vx0, xMin, xMax, t) {
  if (xMax <= xMin) return { x: x0, vx: vx0 };
  let x = x0;
  let vx = vx0;
  let remaining = Math.max(0, t);
  let guard = 0;
  while (remaining > 1e-9 && guard++ < 1000) {
    if (vx > 0) {
      const dist = xMax - x;
      const dt = dist / vx;
      if (dt >= remaining) { x += vx * remaining; remaining = 0; break; }
      x = xMax; remaining -= dt; vx = -vx;
    } else if (vx < 0) {
      const dist = x - xMin;
      const dt = dist / (-vx);
      if (dt >= remaining) { x += vx * remaining; remaining = 0; break; }
      x = xMin; remaining -= dt; vx = -vx;
    } else {
      break;
    }
  }
  return { x, vx };
}

function stepBounce(obj, dt) {
  obj.x += obj.vx * dt;
  if (obj.x < obj.xMin) { obj.x = 2 * obj.xMin - obj.x; obj.vx = -obj.vx; }
  else if (obj.x > obj.xMax) { obj.x = 2 * obj.xMax - obj.x; obj.vx = -obj.vx; }
}

function spawnCore(rng, hits) {
  // 偏离中线出生、朝中线运动：首次/连续命中的等待更短，节奏更快（改自源：敌人在中线上出生）。
  const side = rng() < 0.5 ? -1 : 1;
  const x = GAME.BLADE_X + side * (120 + rng() * 300);
  return {
    x,
    y: GAME.CORE_Y_MIN + rng() * (GAME.CORE_Y_MAX - GAME.CORE_Y_MIN),
    vx: -side * coreSpeedFor(hits),
    xMin: GAME.CORE_X_MIN,
    xMax: GAME.CORE_X_MAX,
    radius: coreRadiusFor(hits),
  };
}

function spawnRock(rng) {
  const dir = rng() < 0.5 ? -1 : 1;
  return {
    x: 260 + rng() * 760,
    y: GAME.ROCK_Y_MIN + rng() * (GAME.ROCK_Y_MAX - GAME.ROCK_Y_MIN),
    vx: dir * GAME.ROCK_SPEED,
    xMin: 90,
    xMax: 1190,
    r: GAME.ROCK_RADIUS,
  };
}

function spawnGem(rng) {
  const dir = rng() < 0.5 ? -1 : 1;
  return {
    x: GAME.BLADE_X, // 宝石从剑刃正上方中线生成（易接取，符合「中线重生」主题）
    y: GAME.GEM_Y_MIN + rng() * (GAME.GEM_Y_MAX - GAME.GEM_Y_MIN),
    vx: dir * GAME.GEM_SPEED,
    xMin: 90,
    xMax: 1190,
    r: GAME.GEM_RADIUS,
    collected: false,
  };
}

// 圆形 vs 竖直飞刃矩形（blade 固定 x = BLADE_X）的相交检测。
function circleHitsBlade(s, cx, cy, r) {
  const bx = GAME.BLADE_X;
  const top = s.blade.y - GAME.BLADE_HALF_H;
  const bot = s.blade.y + GAME.BLADE_HALF_H;
  const nx = clamp(cx, bx - GAME.BLADE_HALF_W, bx + GAME.BLADE_HALF_W);
  const ny = clamp(cy, top, bot);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

export function createRun(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    phase: 'playing', // 'playing' | 'lost'
    time: 0,
    score: 0,
    hits: 0,
    combo: 0,
    maxCombo: 0,
    wave: 1,
    lives: GAME.LIVES,
    gems: 0,
    surge: false,
    surgeT: 0,
    stars: 0,
    result: null,
    blade: { x: GAME.BLADE_X, y: GAME.BLADE_START_Y, fired: false, flightT: 0 },
    core: null,
    rocks: [],
    pickups: [],
    nextGemAt: 0,
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    _clock: 0,

    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      s.time += dt;

      // Surge 计时（子弹时间）
      if (s.surge) {
        s.surgeT -= dt;
        if (s.surgeT <= 0) {
          s.surge = false;
          s.surgeT = 0;
          this._emit({ type: 'surgeEnd' });
        }
      }

      // 核心速度受 surge 影响
      const surgeScale = s.surge ? GAME.SURGE_SPEED_SCALE : 1;
      if (s.core) {
        s.core.vx = (s.core.vx > 0 ? 1 : -1) * coreSpeedFor(s.hits) * surgeScale;
        stepBounce(s.core, dt);
      }
      for (const rock of s.rocks) stepBounce(rock, dt);
      for (const p of s.pickups) if (!p.collected) stepBounce(p, dt);

      // 飞刃
      if (s.blade.fired) {
        s.blade.flightT += dt;
        s.blade.y -= GAME.BLADE_SPEED * dt;
        if (s.core && circleHitsBlade(s, s.core.x, s.core.y, s.core.radius)) {
          this._onHit();
          return;
        }
        this._collectGems();
        this._checkRocks();
        if (s.phase !== 'playing') return;
        if (s.blade.y - GAME.BLADE_HALF_H <= GAME.TOP_SPIKE_Y) this._die('topSpike');
      } else {
        s.blade.y += GAME.FALL_SPEED * dt;
        if (s.blade.y + GAME.BLADE_HALF_H >= GAME.BOTTOM_SPIKE_Y) this._die('bottomSpike');
      }

      this._spawns();
    },

    fire() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.blade.fired) return { ok: false, reason: 'fired' };
      s.blade.fired = true;
      s.blade.flightT = 0;
      this._emit({ type: 'fire' });
      return { ok: true };
    },

    burst() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (!s.blade.fired) return { ok: false, reason: 'notFired' };
      if (s.blade.flightT < 0.06) return { ok: false, reason: 'tooEarly' };
      const bx = s.blade.x;
      const by = s.blade.y;
      this._emit({ type: 'burst', x: bx, y: by });
      // 核心在爆发半径内 → GOOD 命中
      if (s.core && Math.hypot(s.core.x - bx, s.core.y - by) <= GAME.BURST_RADIUS + s.core.radius) {
        this._onHit(false); // 爆发命中不计 PERFECT
        return { ok: true, hit: 'core' };
      }
      // 宝石在爆发半径内 → 收集
      let got = false;
      for (const p of s.pickups) {
        if (p.collected) continue;
        if (Math.hypot(p.x - bx, p.y - by) <= GAME.BURST_RADIUS + p.r) {
          this._collectGem(p);
          got = true;
        }
      }
      if (got) {
        s.pickups = s.pickups.filter((p) => !p.collected);
        this._resetBlade();
        return { ok: true, hit: 'gem' };
      }
      this._die('burst');
      return { ok: true, hit: null };
    },

    /** 公开：测试/selfplay 直接结束本局（按原因死亡）。 */
    forceEnd(reason = 'topSpike') {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false };
      s.lives = 1;
      this._die(reason);
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        phase: s.phase,
        score: s.score,
        hits: s.hits,
        combo: s.combo,
        maxCombo: s.maxCombo,
        wave: s.wave,
        lives: s.lives,
        gems: s.gems,
        surge: s.surge,
        surgeT: s.surgeT,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _onHit(perfect) {
      const s = this.state;
      const c = s.core;
      const dx = Math.abs(c.x - GAME.BLADE_X);
      const isPerfect = perfect !== false && dx <= c.radius * GAME.PERFECT_RATIO;
      s.hits += 1;
      s.combo += 1;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      const oldWave = s.wave;
      s.wave = waveFor(s.hits);
      const mult = (isPerfect ? 2 : 1) * (s.surge ? 2 : 1);
      const points = GAME.BASE_HIT * s.combo * mult;
      s.score += points;
      this._emit({ type: 'hit', points, combo: s.combo, wave: s.wave, precision: isPerfect ? 'perfect' : 'good' });
      if (isPerfect) this._emit({ type: 'perfect', points, combo: s.combo });
      if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo });
      if (s.wave > oldWave) this._emit({ type: 'wave', wave: s.wave });
      this._resetBlade();
      s.core = spawnCore(this._rng, s.hits);
      this._spawns();
    },

    _collectGem(p) {
      const s = this.state;
      p.collected = true;
      s.gems += 1;
      const points = GAME.GEM_SCORE * (s.surge ? 2 : 1);
      s.score += points;
      this._emit({ type: 'gem', points, gems: s.gems });
      if (s.gems % GAME.SURGE_GEMS === 0) {
        s.surge = true;
        s.surgeT = GAME.SURGE_DURATION;
        this._emit({ type: 'surge' });
      }
      s.nextGemAt = s.time + 2.5;
    },

    _collectGems() {
      const s = this.state;
      let any = false;
      for (const p of s.pickups) {
        if (p.collected) continue;
        if (circleHitsBlade(s, p.x, p.y, p.r)) {
          this._collectGem(p);
          any = true;
        }
      }
      if (any) s.pickups = s.pickups.filter((p) => !p.collected);
    },

    _checkRocks() {
      const s = this.state;
      for (const rock of s.rocks) {
        if (circleHitsBlade(s, rock.x, rock.y, rock.r)) {
          this._die('rock');
          return;
        }
      }
    },

    _resetBlade() {
      const s = this.state;
      s.blade.y = GAME.BLADE_START_Y;
      s.blade.fired = false;
      s.blade.flightT = 0;
    },

    _spawns() {
      const s = this.state;
      // 岩石：wave≥3 出现 1 颗，wave≥5 出现 2 颗
      const wantRocks = s.wave >= 5 ? 2 : s.wave >= 3 ? 1 : 0;
      while (s.rocks.length < wantRocks) {
        s.rocks.push(spawnRock(this._rng));
        this._emit({ type: 'rockSpawn' });
      }
      // 宝石：wave≥2 出现 1 颗，收集后间隔 2.5s 重生
      if (s.wave >= 2 && s.pickups.length === 0 && s.time >= s.nextGemAt) {
        s.pickups.push(spawnGem(this._rng));
      }
    },

    _die(reason) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.combo = 0;
      s.lives -= 1;
      this._emit({ type: 'die', reason });
      if (s.lives <= 0) {
        s.stars = starsFor(s.score);
        s.phase = 'lost';
        s.result = {
          won: false,
          score: s.score,
          hits: s.hits,
          maxCombo: s.maxCombo,
          gems: s.gems,
          wave: s.wave,
          stars: s.stars,
          reason,
        };
        this._emit({ type: 'lose', reason, score: s.score, stars: s.stars, hits: s.hits, maxCombo: s.maxCombo, gems: s.gems, wave: s.wave });
        return;
      }
      // 还有命：重生飞刃与核心，继续本局
      this._resetBlade();
      s.core = spawnCore(this._rng, s.hits);
      this._spawns();
    },
  };

  state.core = spawnCore(rng, 0);
  return run;
}
