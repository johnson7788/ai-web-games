// HOP CHARGE · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：蓄力/起跳/落点判定/连击/星级/事件表。
// 依赖：config/levels.js（LEVELS/PLATFORM_W）与 config/game.config.js（GAME 常量）。
// 契约：docs/README.md §3（createRun API / state 形状 / 事件表）。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVELS, PLATFORM_W } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

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

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 平台在 t 时刻的世界 x（移动台左右缓动；其余静止）。
export function platformX(p, t) {
  if (p && p.type === 'moving' && p.motion) {
    return p.x + p.motion.amp * Math.sin(p.motion.speed * t + p.motion.phase);
  }
  return p ? p.x : 0;
}

function spacingFor(level, i, rng) {
  const s = level.spacing;
  let d = s.base;
  if (s.kind === 'farther') d = s.base + s.step * i;
  else if (s.kind === 'nearer') d = s.base + s.step * i;
  else if (s.kind === 'varying') d = s.base + (rng() * 2 - 1) * (s.variance || 0);
  return clamp(d, s.min, s.max);
}

function buildPlatforms(level, rng) {
  const count = level.goalJumps + 8; // 弹簧弹射会跳台，多留余量
  const platforms = [{ x: 0, y: 0, w: PLATFORM_W.start, type: 'start', motion: null }];
  for (let i = 1; i <= count; i += 1) {
    const prev = platforms[i - 1];
    const dist = spacingFor(level, i, rng);
    const type = level.typeCycle[(i - 1) % level.typeCycle.length];
    const motion = type === 'moving'
      ? { type: 'moving', amp: GAME.MOVE_AMP, speed: GAME.MOVE_SPEED, phase: rng() * Math.PI * 2 }
      : null;
    platforms.push({
      x: prev.x + dist,
      y: 0,
      w: PLATFORM_W[type] || PLATFORM_W.normal,
      type,
      motion,
    });
  }
  return platforms;
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const platforms = buildPlatforms(level, rng);

  const state = {
    level: level.index,
    phase: 'ready', // 'ready' | 'charging' | 'jumping' | 'won' | 'lost'
    platforms,
    player: {
      platformIndex: 0,
      x: platformX(platforms[0], 0),
      charge: 0,
      squash: 0,
    },
    jumps: 0,
    goalJumps: level.goalJumps,
    combo: 0,
    maxCombo: 0,
    score: 0,
    perfects: 0,
    nearMisses: 0,
    timeLeft: level.timeLimit,
    initialTime: level.timeLimit,
    wind: !!level.wind,
    stars: 0,
    result: null,
    pending: null, // { targetIndex, landX, dir, jumpT }
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _chargeTickAcc: 0,

    // ---- 时间推进（固定步长） ----
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1; // 防大跳帧
      this._clock += dt;

      if (s.timeLeft > 0) {
        s.timeLeft -= dt;
        if (s.timeLeft <= 0) {
          s.timeLeft = 0;
          this._lose('timeOut');
          return;
        }
      }

      if (s.phase === 'charging') {
        s.player.charge = Math.min(GAME.MAX_CHARGE, s.player.charge + dt);
        s.player.squash = s.player.charge / GAME.MAX_CHARGE;
        this._chargeTickAcc += dt;
        if (this._chargeTickAcc >= 0.1) {
          this._chargeTickAcc = 0;
          this._emit({ type: 'chargeTick', charge: s.player.charge });
        }
      } else if (s.phase === 'jumping') {
        s.pending.jumpT += dt / GAME.JUMP_DURATION;
        if (s.pending.jumpT >= 1) this._resolveLanding();
      }
    },

    // ---- 按下：开始蓄力 ----
    press() {
      const s = this.state;
      if (s.phase !== 'ready') return { ok: false, reason: 'phase' };
      s.phase = 'charging';
      s.player.charge = 0;
      s.player.squash = 0;
      this._chargeTickAcc = 0;
      this._emit({ type: 'chargeStart' });
      return { ok: true };
    },

    // ---- 松开：起跳 ----
    release() {
      const s = this.state;
      if (s.phase !== 'charging') return { ok: false, reason: 'phase' };
      const charge = Math.max(GAME.MIN_CHARGE, s.player.charge);
      const idx = s.player.platformIndex + 1;
      if (idx >= s.platforms.length) {
        this._lose('fall');
        return { ok: false, reason: 'noPlatform' };
      }
      const target = s.platforms[idx];
      const tLand = this._clock + GAME.JUMP_DURATION;
      const cx = platformX(target, tLand);
      const dir = Math.sign(cx - s.player.x) || 1;
      const windF = s.wind ? GAME.HEADWIND_FACTOR : 1;
      const dist = charge * GAME.CHARGE_SPEED * windF;
      const landX = s.player.x + dir * dist;

      s.phase = 'jumping';
      s.pending = { targetIndex: idx, fromX: s.player.x, landX, dir, jumpT: 0 };
      s.player.charge = 0;
      s.player.squash = 0;
      this._emit({ type: 'jump', targetIndex: idx, landX, charge, dir });
      return { ok: true, targetIndex: idx };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        jumps: s.jumps,
        goalJumps: s.goalJumps,
        score: s.score,
        combo: s.combo,
        maxCombo: s.maxCombo,
        timeLeft: s.timeLeft,
        stars: s.stars,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _resolveLanding() {
      const s = this.state;
      const p = s.pending;
      s.pending = null;
      const target = s.platforms[p.targetIndex];
      const cx = platformX(target, this._clock);
      let off = p.landX - cx;

      // 冰面：落点沿行进方向滑半格
      if (target.type === 'ice') {
        off += p.dir * (GAME.ICE_SLIDE_RATIO * target.w);
        this._emit({ type: 'iceSlide', targetIndex: p.targetIndex, off });
      }

      // 弹簧：落在台上即弹射到再下一台（省力但有横偏）
      if (target.type === 'spring' && Math.abs(off) <= target.w / 2) {
        this._resolveSpring(p, target);
        return;
      }

      this._resolveQuality(off, target, p.dir, p.targetIndex);
    },

    _resolveSpring(p, spring) {
      const s = this.state;
      s.jumps += 1;
      s.combo = 0;
      this._emit({ type: 'springBounce', targetIndex: p.targetIndex });
      const bounceIdx = p.targetIndex + 1;
      if (bounceIdx >= s.platforms.length) {
        this._lose('fall');
        return;
      }
      const next = s.platforms[bounceIdx];
      const drift = (this._rng() * 2 - 1) * (GAME.SPRING_DRIFT_RATIO * next.w);
      const cx = platformX(next, this._clock);
      this._resolveQuality(drift, next, p.dir, bounceIdx);
    },

    _resolveQuality(off, target, dir, targetIndex) {
      const s = this.state;
      const w = target.w;
      const perfectR = GAME.PERFECT_RATIO * w;
      const normalR = (target.type === 'narrow' ? GAME.NARROW_NORMAL_RATIO : GAME.NORMAL_RATIO) * w;
      const abs = Math.abs(off);

      if (abs <= perfectR) {
        s.jumps += 1;
        s.perfects += 1;
        s.combo = s.combo === 0 ? GAME.COMBO_BASE : s.combo * 2;
        s.maxCombo = Math.max(s.maxCombo, s.combo);
        s.score += s.combo;
        this._landOn(target, targetIndex);
        s.phase = 'ready';
        this._emit({ type: 'land', targetIndex, quality: 'perfect', off });
        this._emit({ type: 'perfect', targetIndex, off, combo: s.combo });
        if (s.combo > 1) this._emit({ type: 'combo', combo: s.combo });
        this._checkWin();
        return;
      }
      if (abs <= normalR) {
        s.jumps += 1;
        s.nearMisses += 1;
        s.combo = 0;
        s.score += 1;
        this._landOn(target, targetIndex);
        s.phase = 'ready';
        this._emit({ type: 'land', targetIndex, quality: 'normal', off });
        this._emit({ type: 'nearMiss', targetIndex, off });
        this._checkWin();
        return;
      }
      if (abs <= w / 2) {
        this._lose('slip', targetIndex);
        return;
      }
      this._lose('fall', targetIndex);
    },

    _landOn(target, targetIndex) {
      const s = this.state;
      s.player.platformIndex = targetIndex;
      s.player.x = platformX(target, this._clock);
    },

    _checkWin() {
      const s = this.state;
      if (s.jumps < s.goalJumps) return;
      s.phase = 'won';
      s.stars = 1
        + (s.maxCombo >= GAME.GOAL_STAR_COMBO ? 1 : 0)
        + (s.nearMisses === 0 ? 1 : 0);
      s.result = {
        won: true, stars: s.stars, score: s.score, jumps: s.jumps,
        goalJumps: s.goalJumps, combo: s.maxCombo, perfects: s.perfects,
        nearMisses: s.nearMisses, timeLeft: s.timeLeft,
      };
      this._emit({ type: 'levelClear', jumps: s.jumps, goalJumps: s.goalJumps, stars: s.stars });
      this._emit({ type: 'win', stars: s.stars, score: s.score, combo: s.maxCombo });
    },

    _lose(reason, targetIndex) {
      const s = this.state;
      s.phase = 'lost';
      s.result = {
        won: false, stars: 0, score: s.score, jumps: s.jumps,
        goalJumps: s.goalJumps, combo: s.maxCombo, reason,
      };
      if (reason === 'slip') this._emit({ type: 'slip', targetIndex: targetIndex ?? null });
      else if (reason === 'fall') this._emit({ type: 'fall', targetIndex: targetIndex ?? null });
      else this._emit({ type: 'timeOut' });
      this._emit({ type: 'lose', reason, jumps: s.jumps, goalJumps: s.goalJumps });
    },
  };

  return run;
}

// ------------------------------------------------------------------ 贪心助手
// 返回「为让下一台落进中心」所需的蓄力秒数与目标台索引。
// 移动台取落地时刻的中心；冰面提前瞄准近边缘（滑动会把落点送进中心）。
export function greedyCharge(run) {
  const s = run.state;
  if (s.phase !== 'ready' && s.phase !== 'charging') return null;
  const idx = s.player.platformIndex + 1;
  if (idx >= s.platforms.length) return null;
  const target = s.platforms[idx];
  const tLand = run._clock + GAME.JUMP_DURATION;
  const cx = platformX(target, tLand);
  const dir = Math.sign(cx - s.player.x) || 1;
  let aim = cx;
  if (target.type === 'ice') aim = cx - dir * (GAME.ICE_SLIDE_RATIO * target.w);
  const windF = s.wind ? GAME.HEADWIND_FACTOR : 1;
  const dist = aim - s.player.x;
  const charge = clamp(dist / (GAME.CHARGE_SPEED * windF), 0, GAME.MAX_CHARGE);
  return { charge, targetIndex: idx };
}

// 兼容骨架别名（node --test / 旧壳用）
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
