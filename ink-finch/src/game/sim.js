// INK FINCH · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：小鸟物理（单键上扑+重力）、竹节卷轴、穿缝记分、双缝路线、逆风漂移、
//       气流滑翔、竹刺转轮、碰撞判定、关卡目标、事件表。
// 依赖：config/levels.js（LEVELS/LEVEL_COUNT）、config/game.config.js（WORLD/BIRD/GATE）。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVELS } from '../../config/levels.js';
import { WORLD, BIRD, GATE } from '../../config/game.config.js';

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

function rectHitsCircle(px, py, pw, ph, c, r) {
  const cx = clamp(c.x, px, px + pw);
  const cy = clamp(c.y, py, py + ph);
  const dx = c.x - cx;
  const dy = c.y - cy;
  return dx * dx + dy * dy < r * r;
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    level: level.index,
    scene: level.scene,
    phase: 'ready',          // 'ready' | 'playing' | 'won' | 'lost'
    score: 0,
    target: level.target,
    time: 0,
    bird: {
      x: BIRD.X,
      y: WORLD.HEIGHT / 2,
      vy: 0,
      vx: 0,
      r: BIRD.R,
    },
    gates: [],
    held: false,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _periodic: {},
    _altBand: Math.floor(WORLD.HEIGHT / 2 / 120),

    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      s.time += dt;

      // 就绪阶段：原地轻摆，宽限后自动起飞（noinput 也会下坠死亡）
      if (s.phase === 'ready') {
        s.bird.y = WORLD.HEIGHT / 2 + Math.sin(s.time * 3) * 8;
        if (s.time >= BIRD.READY_GRACE) {
          s.phase = 'playing';
          this._emit({ type: 'autoStart' });
        }
        return;
      }

      const b = s.bird;
      const lv = this._level;

      // 重力 / 长按滑翔（气流关按住下坠变慢）
      const grav = (lv.glideGravity && s.held) ? lv.glideGravity : BIRD.GRAVITY;
      b.vy = Math.min(BIRD.MAX_FALL, b.vy + grav * dt);
      b.y += b.vy * dt;

      // 逆风水平漂移（vx 收敛到 windVx；上扑给一个向右冲量）
      if (lv.windVx) {
        b.vx += (lv.windVx - b.vx) * Math.min(1, dt * 2);
        b.x += b.vx * dt;
      }
      b.x = clamp(b.x, BIRD.MIN_X, BIRD.MAX_X);

      // 卷轴与竹节
      for (const g of s.gates) {
        g.x -= lv.scroll * dt;
        this._updateGateRects(g);
        if (g.wheel) g.wheel.angle += g.wheel.speed * dt;
        if (!g.approached && g.x < b.x + 420) {
          g.approached = true;
          this._emit({ type: 'gateApproach', x: g.x });
        }
      }
      // 生成 / 回收（第一根竹节快速入画，首分 ≈2.2s）
      if (s.gates.length === 0) s.gates.push(this._spawnGate(BIRD.X + 400));
      let last = s.gates[s.gates.length - 1];
      while (last.x < WORLD.WIDTH + lv.spacing) {
        last = this._spawnGate(last.x + lv.spacing);
        s.gates.push(last);
      }
      while (s.gates.length && s.gates[0].x + lv.stalkW / 2 < -40) s.gates.shift();

      // 碰撞
      const hit = this._collide();
      if (hit) {
        this._die(hit);
        return;
      }

      // 穿缝记分
      for (const g of s.gates) {
        if (!g.scored && g.x + g.w / 2 < b.x - b.r) {
          g.scored = true;
          const pts = this._scoreGate(g);
          s.score += pts;
          this._emit({ type: 'gatePass', points: pts, x: g.x });
          if (pts > 1) this._emit({ type: 'bonus', points: pts });
          if (this._nearMiss(g)) this._emit({ type: 'nearMiss', x: g.x });
          if (s.score >= s.target) {
            this._win();
            return;
          }
        }
      }

      // 细粒度事件密度（遥测：最大间隔 ≤3s）
      this._periodic('breeze', 0.45);
      if (lv.glideGravity && s.held) this._periodic('updraft', 0.5);
      if (lv.windVx) this._periodic('windGust', 1.0);
      if (lv.wheel) this._periodic('wheelSpin', 0.4);
      const band = Math.floor(b.y / 120);
      if (band !== this._altBand) {
        this._altBand = band;
        this._emit({ type: 'altitude', band });
      }
    },

    // 上扑（单键动词；就绪阶段第一扑即起飞）
    flap() {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      if (s.phase === 'ready') s.phase = 'playing';
      const b = s.bird;
      b.vy = BIRD.FLAP_VY;
      if (this._level.flapVx) b.vx += this._level.flapVx;
      this._emit({ type: 'flap', y: b.y });
      this._emit({ type: 'ink', x: b.x, y: b.y }); // 签名记忆点：振翅溅墨
      return { ok: true };
    },

    setHold(held) {
      this.state.held = !!held;
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return { level: s.level, score: s.score, target: s.target, phase: s.phase, time: s.time };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _periodic(kind, period, cond = true) {
      if (!cond) return;
      const s = this.state;
      const next = this._periodic[kind] ?? 0;
      if (s.time >= next) {
        this._periodic[kind] = s.time + period;
        this._emit({ type: kind });
      }
    },

    _randGapY() {
      const lv = this._level;
      return lv.gapYMin + this._rng() * (lv.gapYMax - lv.gapYMin);
    },

    _spawnGate(x) {
      const lv = this._level;
      const g = {
        x,
        w: lv.stalkW,
        kind: lv.doubleGap ? 'double' : 'single',
        scored: false,
        approached: false,
        baseGapY: this._randGapY(),
        moveAmp: lv.moveAmp,
        movePeriod: lv.movePeriod,
        phase: this._rng() * Math.PI * 2,
        gapH: lv.gapH,
        gapY: 0,
        gapTop: 0,
        gapBottom: 0,
        wheel: null,
        approachY: this.state.bird.y,
      };
      if (lv.doubleGap) {
        g.upperCenter = lv.doubleGapY - lv.gapSep / 2;
        g.lowerCenter = lv.doubleGapY + lv.gapSep / 2;
        const dUpper = Math.abs(g.approachY - g.upperCenter);
        const dLower = Math.abs(g.approachY - g.lowerCenter);
        g.nearCenter = dUpper <= dLower ? 'upper' : 'lower';
        g.doubleGapH = lv.doubleGapH;
        g.nearPoints = lv.nearPoints;
        g.farPoints = lv.farPoints;
      }
      if (lv.wheel) {
        g.wheel = { r: lv.wheelR, speed: lv.wheelSpeed, angle: this._rng() * Math.PI * 2, cy: 0 };
      }
      this._updateGateRects(g);
      return g;
    },

    _updateGateRects(g) {
      const s = this.state;
      const lv = this._level;
      if (g.moveAmp) {
        g.gapY = g.baseGapY + Math.sin(g.phase + s.time * ((2 * Math.PI) / g.movePeriod)) * g.moveAmp;
        g.gapY = clamp(g.gapY, lv.gapYMin + g.moveAmp, lv.gapYMax - g.moveAmp);
      } else {
        g.gapY = g.baseGapY;
      }
      g.gapTop = g.gapY - g.gapH / 2;
      g.gapBottom = g.gapY + g.gapH / 2;
      if (g.kind === 'double') {
        g.upperTop = g.upperCenter - g.doubleGapH / 2;
        g.upperBottom = g.upperCenter + g.doubleGapH / 2;
        g.lowerTop = g.lowerCenter - g.doubleGapH / 2;
        g.lowerBottom = g.lowerCenter + g.doubleGapH / 2;
      }
      if (g.wheel) {
        g.wheel.cy = g.kind === 'double' ? (g.upperBottom + g.lowerTop) / 2 : g.gapY;
      }
    },

    _collide() {
      const s = this.state;
      const b = s.bird;
      if (b.y - b.r <= WORLD.CEILING_Y) return 'ceiling';
      if (b.y + b.r >= WORLD.GROUND_Y) return 'ground';
      if (this._level.windVx && b.x - b.r <= BIRD.MIN_X) return 'blownBack';
      for (const g of s.gates) {
        if (g.kind === 'double') {
          // 双缝：上竹节 / 中间竹节 / 下竹节
          if (rectHitsCircle(g.x - g.w / 2, 0, g.w, g.upperTop, b, b.r)) return 'stalk';
          if (rectHitsCircle(g.x - g.w / 2, g.upperBottom, g.w, g.lowerTop - g.upperBottom, b, b.r)) return 'stalk';
          if (rectHitsCircle(g.x - g.w / 2, g.lowerBottom, g.w, WORLD.GROUND_Y - g.lowerBottom, b, b.r)) return 'stalk';
        } else {
          // 单缝：上竹节 / 下竹节
          if (rectHitsCircle(g.x - g.w / 2, 0, g.w, g.gapTop, b, b.r)) return 'stalk';
          if (rectHitsCircle(g.x - g.w / 2, g.gapBottom, g.w, WORLD.GROUND_Y - g.gapBottom, b, b.r)) return 'stalk';
        }
        // 竹刺转轮（圆形障碍）
        if (g.wheel) {
          const dx = b.x - g.x;
          const dy = b.y - g.wheel.cy;
          if (dx * dx + dy * dy < (g.wheel.r + b.r) * (g.wheel.r + b.r)) return 'wheel';
        }
      }
      return null;
    },

    _scoreGate(g) {
      if (g.kind === 'single') return 1;
      const b = this.state.bird;
      const throughUpper = b.y >= g.upperTop && b.y <= g.upperBottom;
      const tookFar = (g.nearCenter === 'upper' && !throughUpper) || (g.nearCenter === 'lower' && throughUpper);
      return tookFar ? g.farPoints : g.nearPoints;
    },

    _nearMiss(g) {
      const b = this.state.bird;
      const m = GATE.NEAR_MISS;
      const edges = g.kind === 'double'
        ? [g.upperTop, g.upperBottom, g.lowerTop, g.lowerBottom]
        : [g.gapTop, g.gapBottom];
      return edges.some((e) => Math.abs(b.y - e) < m);
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.result = { won: true, score: s.score, target: s.target };
      this._emit({ type: 'win', score: s.score });
    },

    _die(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, score: s.score, target: s.target, reason };
      this._emit({ type: 'death', reason });
    },
  };

  run._emit({ type: 'levelStart' });
  return run;
}

// 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}
export function updateSim(sim, input) {
  if (input && input.jump) sim.flap();
  sim.step(1 / 60);
  return sim;
}
