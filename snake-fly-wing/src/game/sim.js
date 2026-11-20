// NEON SERPENT · 模拟层（纯逻辑，零 DOM / window / Date.now / canvas）
// 职责：拍翼物理、峡谷门滚动、身体节=生命、护盾/狂热/连击/星级、计分、事件表。
// 依赖：config/game.config.js。随机：注入 seed 的 mulberry32，可复现。
import { WORLD, SERPENT, GATES, GAME, PICKUP } from '../../config/game.config.js';

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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ createRun
export function createRun(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const body = SERPENT.BODY_START;
  const segs = [];
  for (let i = 0; i < body; i += 1) {
    segs.push({ x: SERPENT.X - (i + 1) * SERPENT.SEG_GAP, y: WORLD.HEIGHT / 2 });
  }

  const state = {
    phase: 'playing',            // 'playing' | 'dead'
    level: 1,                    // zone（1 基，每 ZONE_EVERY 分 +1）
    score: 0,
    best: 0,
    combo: 1,
    serpent: {
      y: WORLD.HEIGHT / 2,
      vy: SERPENT.LAUNCH_VY,
      body,
      segs,
      shieldT: 0,
      feverT: 0,
      invincT: 0,
      stars: 0,
    },
    speed: GAME.SPEED_BASE,
    gates: [],
    pickups: [],
    distance: 0,
    time: 0,
    result: null,
  };

  // 预生成门（确定性）：随机游走的缺口中心；岩石从第 ROCK_FROM 个门起每 ROCK_EVERY 一次
  {
    let gapY = WORLD.HEIGHT / 2;
    for (let i = 0; i < GATES.COUNT; i += 1) {
      const isRock = i >= GATES.ROCK_FROM && (i - GATES.ROCK_FROM) % GATES.ROCK_EVERY === 0;
      gapY = clamp(gapY + (rng() - 0.5) * 260, GATES.GAP_MIN_Y, GATES.GAP_MAX_Y);
      state.gates.push({
        x: GATES.SPAWN_X + i * GATES.GAP_X,
        gapY,
        gapH: isRock ? GATES.ROCK_GAP_H : GATES.GAP_H,
        w: isRock ? GATES.ROCK_W : GATES.W,
        kind: isRock ? 'rock' : 'crystal',
        passed: false,
      });
    }
  }

  // 道具放在指定门的缺口中心（greedy 沿缺口中心飞即可吃到）
  const PICKUP_SCHEDULE = { 2: 'heart', 4: 'gem', 6: 'star', 7: 'star', 8: 'star', 10: 'heart', 12: 'gem', 14: 'star', 16: 'star', 18: 'star', 20: 'heart', 22: 'gem', 26: 'star', 27: 'star', 28: 'star' };
  for (const [idx, kind] of Object.entries(PICKUP_SCHEDULE)) {
    const g = state.gates[+idx];
    if (!g) continue;
    state.pickups.push({ x: g.x, y: g.gapY, kind, r: PICKUP.R, collected: false });
  }

  const run = {
    state,
    _rng: rng,
    _events: [],
    _clock: 0,
    _shieldWasOn: false,
    _feverWasOn: false,

    // ---- 开局（重开复用）----
    start() {
      this.state.phase = 'playing';
      this._emit({ type: 'start' });
      return { ok: true };
    },

    // ---- 拍翼 ----
    flap() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      s.serpent.vy = SERPENT.FLAP_VY;
      this._emit({ type: 'flap' });
      return { ok: true };
    },

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;
      s.time += dt;

      const serp = s.serpent;

      // 速度：护盾/狂热时冲刺，否则随分数缓慢上升
      if (serp.shieldT > 0 || serp.feverT > 0) {
        s.speed = GAME.SHIELD_SPEED;
      } else {
        s.speed = Math.min(GAME.SPEED_MAX, GAME.SPEED_BASE + s.score * GAME.SPEED_PER_SCORE);
      }

      // 护盾：自动巡航（无重力，向中线靠拢）
      if (serp.shieldT > 0) {
        serp.vy = 0;
        serp.y += (WORLD.HEIGHT / 2 - serp.y) * Math.min(1, dt * 6);
      } else {
        serp.vy = Math.min(SERPENT.MAX_FALL, serp.vy + SERPENT.GRAVITY * dt);
        serp.y += serp.vy * dt;
      }

      // 身体节跟随（尾部波动）
      let leaderY = serp.y;
      for (let i = 0; i < serp.segs.length; i += 1) {
        const seg = serp.segs[i];
        seg.x = SERPENT.X - (i + 1) * SERPENT.SEG_GAP;
        seg.y += (leaderY - seg.y) * Math.min(1, dt * 9);
        leaderY = seg.y;
      }

      // 边界即死
      if (serp.y - SERPENT.R <= WORLD.CEILING || serp.y + SERPENT.R >= WORLD.FLOOR) {
        this._die('wall');
        return;
      }

      // 世界滚动
      for (const g of s.gates) g.x -= s.speed * dt;
      for (const p of s.pickups) {
        if (p.collected) continue;
        p.x -= s.speed * dt;
        if (serp.feverT > 0 && Math.abs(p.x - SERPENT.X) < PICKUP.MAGNET_RANGE) {
          const dir = Math.sign(serp.y - p.y) || 1;
          p.y += dir * PICKUP.MAGNET_SPEED * dt;
          if (Math.abs(serp.y - p.y) < PICKUP.MAGNET_SPEED * dt) p.y = serp.y;
        }
      }
      s.distance += s.speed * dt;

      // 计时器
      if (serp.shieldT > 0) {
        serp.shieldT = Math.max(0, serp.shieldT - dt);
        if (serp.shieldT === 0) this._emit({ type: 'shieldOff' });
      }
      if (serp.feverT > 0) {
        serp.feverT = Math.max(0, serp.feverT - dt);
        if (serp.feverT === 0) this._emit({ type: 'feverOff' });
      }
      if (serp.invincT > 0) serp.invincT = Math.max(0, serp.invincT - dt);

      // 门：通过计分 + 碰撞判定
      for (const g of s.gates) {
        if (g.passed) continue;
        const halfW = g.w / 2;
        // 通过：门右缘越过头部左缘
        if (g.x + halfW < SERPENT.X - SERPENT.R) {
          g.passed = true;
          const base = g.kind === 'rock' ? 3 : 1;
          const feverMult = serp.feverT > 0 ? 2 : 1;
          const pts = base * s.combo * feverMult;
          s.score += pts;
          this._emit({ type: 'score', pts, kind: g.kind });
          if (s.combo < GAME.COMBO_MAX) {
            s.combo += 1;
            this._emit({ type: 'combo', combo: s.combo });
          }
          this._checkZone();
          continue;
        }
        // 碰撞：头部横轴与柱子重叠
        if (Math.abs(g.x - SERPENT.X) < halfW + SERPENT.R) {
          const gapTop = g.gapY - g.gapH / 2;
          const gapBot = g.gapY + g.gapH / 2;
          const inGap = serp.y + SERPENT.R < gapBot && serp.y - SERPENT.R > gapTop;
          if (!inGap) this._hit();
        }
      }

      // 道具收集
      for (const p of s.pickups) {
        if (p.collected) continue;
        if (Math.abs(p.x - SERPENT.X) < p.r + SERPENT.R && Math.abs(p.y - serp.y) < p.r + SERPENT.R) {
          p.collected = true;
          this._collect(p.kind);
        }
      }
    },

    getHud() {
      const s = this.state;
      return {
        score: s.score,
        best: s.best,
        combo: s.combo,
        body: s.serpent.body,
        shieldT: s.serpent.shieldT,
        feverT: s.serpent.feverT,
        stars: s.serpent.stars,
        zone: s.level,
        speed: s.speed,
        phase: s.phase,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _hit() {
      const s = this.state;
      const serp = s.serpent;
      if (serp.shieldT > 0 || serp.feverT > 0 || serp.invincT > 0) return;
      if (serp.body > 0) {
        serp.body -= 1;
        serp.segs.pop();
        s.combo = 1;
        serp.invincT = GAME.INVINCIBLE_TIME;
        this._emit({ type: 'hit', body: serp.body });
        if (serp.body === 0) this._emit({ type: 'lastHit' });
      } else {
        this._die('pillar');
      }
    },

    _collect(kind) {
      const s = this.state;
      const serp = s.serpent;
      if (kind === 'heart') {
        if (serp.body < SERPENT.BODY_MAX) {
          serp.body += 1;
          const last = serp.segs[serp.segs.length - 1];
          serp.segs.push({ x: last ? last.x - SERPENT.SEG_GAP : SERPENT.X - SERPENT.SEG_GAP, y: last ? last.y : serp.y });
          this._emit({ type: 'life', body: serp.body });
        } else {
          s.score += GAME.HEART_BONUS;
          this._emit({ type: 'bonus', pts: GAME.HEART_BONUS });
          this._checkZone();
        }
      } else if (kind === 'gem') {
        serp.shieldT = GAME.SHIELD_TIME;
        this._emit({ type: 'shield' });
      } else if (kind === 'star') {
        serp.stars += 1;
        this._emit({ type: 'star', stars: serp.stars });
        if (serp.stars >= GAME.STAR_NEED) {
          serp.stars = 0;
          serp.feverT = GAME.FEVER_TIME;
          this._emit({ type: 'fever' });
        }
      }
    },

    _checkZone() {
      const s = this.state;
      const zone = Math.min(GAME.ZONE_MAX, Math.floor(s.score / GAME.ZONE_EVERY) + 1);
      if (zone > s.level) {
        s.level = zone;
        this._emit({ type: 'zone', zone });
      }
    },

    _die(reason) {
      const s = this.state;
      if (s.phase === 'dead') return;
      s.phase = 'dead';
      s.result = { won: false, score: s.score, best: Math.max(s.best, s.score), reason, zone: s.level };
      this._emit({ type: 'die', reason, score: s.score });
    },
  };

  return run;
}

// ------------------------------------------------------------------ 兼容骨架别名
export function createSim() {
  return createRun({ seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
