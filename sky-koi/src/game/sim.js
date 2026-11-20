// SKY KOI · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：单键上扑物理、鸟居门柱循环池、珍珠/水花/星级结算、事件表。
// 依赖：config/levels.js（LEVELS/LEVEL_COUNT）+ config/game.config.js（GAME）。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVELS } from '../../config/levels.js';
import { WORLD, GAME } from '../../config/game.config.js';

export const GATE_W = 64;    // 门柱宽度
export const PEARL_R = 11;   // 珍珠半径

// 可复现 RNG
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

// 门柱几何（含移动门 / 双门）：渲染、自对弈、碰撞共用，避免各自重算。
export function gateGeometry(g, clock = 0) {
  const move = g.moveAmp
    ? g.moveAmp * Math.sin((clock || 0) * (g.moveFreq || 1.1) + (g.movePhase || 0))
    : 0;
  const c0 = g.baseCenter + move;
  if (!g.double) {
    return { centers: [c0], gaps: [{ top: c0 - g.gapH / 2, bottom: c0 + g.gapH / 2 }] };
  }
  const spread = g.gapH * 0.62;
  const cA = g.baseCenter - spread + move;
  const cB = g.baseCenter + spread + move;
  const h = g.gapH * 0.66;
  return {
    centers: [cA, cB],
    gaps: [
      { top: cA - h / 2, bottom: cA + h / 2 },
      { top: cB - h / 2, bottom: cB + h / 2 },
    ],
  };
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    level: level.index,
    sceneKey: level.scene,
    phase: 'playing',          // 'playing' | 'won' | 'lost'
    started: false,
    narrow: level.narrow,
    moving: level.moving,
    wind: level.wind,
    double: level.double,
    wave: level.wave,
    dash: level.dash,
    clock: 0,
    koi: { x: GAME.KOI_X, y: 360, vy: 0, r: GAME.KOI_R },
    gates: [],
    score: 0,
    targetGates: level.targetGates,
    pearls: 0,
    pearlTarget: level.pearl ? level.pearlTarget : 0,
    skimJumps: 0,
    skimTarget: level.skimTarget,
    waterY: GAME.WATER_BASE,
    shimmer: 0,                // 鳞光冲刺剩余时间（渲染用）
    stars: 0,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _lastGapCenter: 320,
    _skimming: false,
    _windPhase: rng() * Math.PI * 2,
    _wavePhase: rng() * Math.PI * 2,
    _windClock: 0,
    _periodClock: 0,

    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;
      s.clock = this._clock;

      if (!s.started) {
        // 等待第一扑：原地漂浮（无重力、无滚动）
        s.koi.y = 360 + Math.sin(this._clock * 2.6) * 12;
        s.koi.vy = 0;
        this._emitPeriodic(dt);
        return;
      }

      // 重力 + 侧风湍流（竖直阵风）
      let ay = GAME.GRAVITY;
      if (level.wind) ay += level.wind * Math.sin(this._clock * 1.7 + this._windPhase);
      s.koi.vy += ay * dt;
      s.koi.y += s.koi.vy * dt;
      if (s.koi.y < GAME.CEILING) {
        s.koi.y = GAME.CEILING;
        s.koi.vy = Math.max(0, s.koi.vy);
      }

      this._updateWater();
      this._spawnGates();

      // 门滚动 + 回收
      for (const g of s.gates) g.x -= level.speed * dt;
      s.gates = s.gates.filter((g) => g.x > -GATE_W * 2);

      // 侧风事件（可感知反馈）
      if (level.wind) {
        this._windClock += dt;
        if (this._windClock >= 1.3) {
          this._windClock = 0;
          this._emit({ type: 'windGust', y: s.koi.y });
        }
      }

      this._checkGateCollision();
      this._checkPearls();
      this._checkSkim();

      if (s.phase !== 'playing') return;

      if (s.koi.y + s.koi.r >= s.waterY) return this._lose('water');

      this._checkGatePass();

      if (s.shimmer > 0) s.shimmer = Math.max(0, s.shimmer - dt);

      this._emitPeriodic(dt);
    },

    // 单键上扑（也是「开始」的输入）
    flap() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      this._ensureStarted();
      s.koi.vy = GAME.FLAP_VY;
      this._emit({ type: 'flap', y: s.koi.y });
      return { ok: true };
    },

    // 无需扑水地开始（noinput 基线用：开局即下落）
    start() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      this._ensureStarted();
      return { ok: true };
    },

    // 供自对弈：返回下一扇待穿门的「目标高度 / 门缝几何」。
    // targetY 已按门缝安全带钳制（含珍珠），bot 直接追逐即可，不越界。
    gateAhead() {
      const s = this.state;
      for (const g of s.gates) {
        if (!g.passed && g.x + GATE_W / 2 > s.koi.x - s.koi.r) {
          const geo = gateGeometry(g, this._clock);
          let gi = 0;
          let bestD = Math.abs(s.koi.y - geo.centers[0]);
          for (let i = 1; i < geo.centers.length; i += 1) {
            const d = Math.abs(s.koi.y - geo.centers[i]);
            if (d < bestD) { bestD = d; gi = i; }
          }
          let targetY = geo.centers[gi];
          const p = g.pearls.find((pp) => !pp.taken && pp.gap === gi);
          if (p) targetY = geo.centers[gi] + p.rel;
          const gap = geo.gaps[gi];
          const safeTop = gap.top + s.koi.r + 10;
          const safeBottom = gap.bottom - s.koi.r - 10;
          targetY = Math.max(safeTop, Math.min(safeBottom, targetY));
          return { x: g.x, targetY, gaps: geo.gaps };
        }
      }
      return null;
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        score: s.score,
        targetGates: s.targetGates,
        pearls: s.pearls,
        pearlTarget: s.pearlTarget,
        skimJumps: s.skimJumps,
        skimTarget: s.skimTarget,
        stars: s.stars,
        phase: s.phase,
        waterY: s.waterY,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _ensureStarted() {
      if (this.state.started) return;
      this.state.started = true;
      this._spawnGates();
    },

    _emitPeriodic(dt) {
      this._periodClock += dt;
      if (this._periodClock >= 0.8) {
        this._periodClock = 0;
        this._emit({ type: 'glideTick' });
      }
    },

    _updateWater() {
      const s = this.state;
      s.waterY = GAME.WATER_BASE
        + (level.wave ? level.wave * Math.sin(this._clock * GAME.WAVE_FREQ + this._wavePhase) : 0);
    },

    _nextGapCenter() {
      const [lo, hi] = level.gapRange;
      const prev = this._lastGapCenter;
      let c = prev + (this._rng() * 2 - 1) * 140;
      c = clamp(c, lo, hi);
      this._lastGapCenter = c;
      return c;
    },

    _spawnGate(x) {
      const s = this.state;
      const center = this._nextGapCenter();
      const g = {
        x,
        baseCenter: center,
        gapH: level.gap,
        double: level.double,
        moveAmp: level.moving ? level.movingAmp : 0,
        movePhase: this._rng() * Math.PI * 2,
        moveFreq: 1.1,
        passed: false,
        pearls: [],
      };
      if (level.pearl) {
        const n = level.pearlPerGate || 1;
        const spread = g.double ? g.gapH * 0.62 : 0;
        for (let i = 0; i < n; i += 1) {
          const gapIdx = g.double ? (i % 2) : 0;
          const rel = g.double ? 0 : (this._rng() * 2 - 1) * (g.gapH * 0.08);
          g.pearls.push({ gap: gapIdx, rel, taken: false, r: PEARL_R });
        }
      }
      s.gates.push(g);
      this._emit({ type: 'gateApproach', x: g.x, center });
    },

    _spawnGates() {
      const s = this.state;
      if (!s.gates.length) this._spawnGate(WORLD.WIDTH + 120);
      while (s.gates[s.gates.length - 1].x < WORLD.WIDTH + level.spacing) {
        this._spawnGate(s.gates[s.gates.length - 1].x + level.spacing);
      }
    },

    _checkGateCollision() {
      const s = this.state;
      for (const g of s.gates) {
        if (g.passed) continue;
        const overlapX = s.koi.x + s.koi.r > g.x - GATE_W / 2 && s.koi.x - s.koi.r < g.x + GATE_W / 2;
        if (!overlapX) continue;
        const geo = gateGeometry(g, this._clock);
        const safe = geo.gaps.some(
          (gap) => s.koi.y - s.koi.r > gap.top && s.koi.y + s.koi.r < gap.bottom,
        );
        if (!safe) return this._lose('gate');
      }
      return null;
    },

    _checkPearls() {
      const s = this.state;
      for (const g of s.gates) {
        const geo = gateGeometry(g, this._clock);
        for (const p of g.pearls) {
          if (p.taken) continue;
          const py = geo.centers[p.gap] + p.rel;
          if (Math.abs(s.koi.x - g.x) < s.koi.r + p.r && Math.abs(s.koi.y - py) < s.koi.r + p.r) {
            p.taken = true;
            s.pearls += 1;
            this._emit({ type: 'pearl', x: g.x, y: py, pearls: s.pearls });
            if (s.pearls % 3 === 0) {
              this._emit({ type: 'star', reason: 'pearl', pearls: s.pearls });
              if (level.dash) {
                s.koi.vy = -700;
                s.shimmer = 0.55;
                this._emit({ type: 'scaleDash', y: s.koi.y });
              }
            }
          }
        }
      }
    },

    _checkSkim() {
      const s = this.state;
      const bottom = s.koi.y + s.koi.r;
      const inZone = bottom > s.waterY - GAME.SKIM_BAND;
      // 只有「低飞/轻缓降落」才算贴水；俯冲过快（vy≥200）不触发，直接算落水。
      const gentle = s.koi.vy > -80 && s.koi.vy < 200;
      if (inZone && gentle && !s._skimming) {
        s._skimming = true;
        this._emit({ type: 'nearWater', y: s.waterY });
        s.koi.vy = Math.min(s.koi.vy, GAME.SKIM_JUMP_VY);
        s.skimJumps += 1;
        this._emit({ type: 'waterSplash', y: s.koi.y, skimJumps: s.skimJumps });
        if (s.skimJumps === level.skimTarget) this._emit({ type: 'star', reason: 'skim', skimJumps: s.skimJumps });
      } else if (!inZone && bottom < s.waterY - GAME.SKIM_BAND - 14) {
        s._skimming = false;
      }
    },

    _checkGatePass() {
      const s = this.state;
      for (const g of s.gates) {
        if (g.passed) continue;
        if (g.x + GATE_W / 2 < s.koi.x - s.koi.r) {
          g.passed = true;
          s.score += 1;
          this._emit({ type: 'gatePass', score: s.score, x: g.x });
          if (s.score >= s.targetGates) return this._win();
        }
      }
      return null;
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const stars = 1
        + (level.pearl && s.pearls >= level.pearlTarget ? 1 : 0)
        + (s.skimJumps >= level.skimTarget ? 1 : 0);
      s.stars = stars;
      s.result = {
        won: true, stars, score: s.score, pearls: s.pearls, skimJumps: s.skimJumps, targetGates: s.targetGates,
      };
      this._emit({ type: 'win', stars, score: s.score, pearls: s.pearls });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = {
        won: false, stars: 0, score: s.score, pearls: s.pearls, skimJumps: s.skimJumps, targetGates: s.targetGates,
      };
      this._emit({ type: 'lose', reason });
    },
  };

  run._emit({ type: 'levelStart', level: level.index });
  return run;
}

export function createSim() {
  return createRun(0, { seed: 1 });
}
