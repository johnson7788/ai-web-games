// BUBBLE SHOOTER POP · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：炮台滑动、自动射击 + 手动连发、泡泡下落与击破、连击/波次/星级、事件表。
// 依赖：config/game.config.js（WORLD/GAME）。随机：注入 seed 的 mulberry32，可复现。
import { WORLD, GAME as G } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KIND_DEF = {
  normal: { r: G.BUBBLE_R, hp: 1, value: 1, weight: 0.62, minWave: 1 },
  rock:   { r: G.BUBBLE_ROCK_R, hp: 5, value: 10, weight: 0.16, minWave: 2 },
  gold:   { r: G.BUBBLE_GOLD_R, hp: 1, value: 12, weight: 0.10, minWave: 3 },
  bomb:   { r: G.BUBBLE_BOMB_R, hp: 2, value: 8, weight: 0.12, minWave: 4 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createRun(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    phase: 'playing',          // 'playing' | 'over'
    wave: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    pops: 0,
    popsThisWave: 0,
    misses: 0,
    time: 0,
    stars: 0,
    result: null,
    cannon: { x: WORLD.WIDTH / 2, y: G.CANNON_Y, vx: 0 },
    bullets: [],
    bubbles: [],
    powerups: [],
    rapidT: 0,
    tripleT: 0,
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    _shootT: G.SHOOT_INTERVAL,
    _spawnT: 0.6,
    _burstT: 0,
    _nextId: 1,

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      s.time += dt;
      if (s.rapidT > 0) s.rapidT = Math.max(0, s.rapidT - dt);
      if (s.tripleT > 0) s.tripleT = Math.max(0, s.tripleT - dt);
      if (this._burstT > 0) this._burstT = Math.max(0, this._burstT - dt);

      // 炮台滑动
      s.cannon.x = clamp(s.cannon.x + s.cannon.vx * dt, G.CANNON_MIN_X, G.CANNON_MAX_X);

      // 自动射击
      this._shootT -= dt;
      if (this._shootT <= 0) {
        this._fire(false);
        this._shootT = G.SHOOT_INTERVAL / (s.rapidT > 0 ? G.RAPID_MULT : 1);
      }

      // 出生
      this._spawnT -= dt;
      if (this._spawnT <= 0) {
        this._spawnBubble();
        this._spawnT = this._spawnInterval();
      }

      this._stepBullets(dt);
      this._stepBubbles(dt);
      this._stepPowerups(dt);

      // 清理死亡对象
      s.bullets = s.bullets.filter((b) => !b.dead);
      s.bubbles = s.bubbles.filter((b) => !b.dead);
      s.powerups = s.powerups.filter((p) => !p.dead);
    },

    // ---- 输入 ----
    move(dir) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const d = dir > 0 ? 1 : dir < 0 ? -1 : 0;
      s.cannon.vx = d * G.CANNON_SPEED;
      return { ok: true };
    },

    burst() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (this._burstT > 0) return { ok: false, reason: 'cooldown' };
      this._burstT = G.BURST_COOLDOWN;
      this._fire(true);
      return { ok: true };
    },

    steer(x) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      s.cannon.x = clamp(x, G.CANNON_MIN_X, G.CANNON_MAX_X);
      s.cannon.vx = 0;
      return { ok: true };
    },

    // ---- 观察 ----
    getHud() {
      const s = this.state;
      return {
        phase: s.phase,
        wave: s.wave,
        score: s.score,
        combo: s.combo,
        popsThisWave: s.popsThisWave,
        popsPerWave: G.POPS_PER_WAVE,
        misses: s.misses,
        missLimit: G.MISS_LIMIT,
        rapidT: s.rapidT,
        tripleT: s.tripleT,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---- 调试 ----
    spawnBubble(kind = 'normal', x = WORLD.WIDTH / 2) {
      const s = this.state;
      if (!KIND_DEF[kind]) kind = 'normal';
      const def = KIND_DEF[kind];
      const bubble = this._makeBubble(kind, clamp(x, def.r + 20, WORLD.WIDTH - def.r - 20), 60);
      s.bubbles.push(bubble);
      this._emit({ type: 'spawn', id: bubble.id, kind, x: bubble.x });
      return { ok: true, id: bubble.id };
    },

    spawnPowerup(kind = 'rapid', x = WORLD.WIDTH / 2) {
      const s = this.state;
      const k = kind === 'triple' ? 'triple' : 'rapid';
      const p = { kind: k, x: clamp(x, 40, WORLD.WIDTH - 40), y: -20, vy: G.POWERUP_FALL, r: 18, dead: false };
      s.powerups.push(p);
      return { ok: true, kind: k };
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _spawnInterval() {
      return clamp(G.BASE_SPAWN - (this.state.wave - 1) * G.SPAWN_PER_WAVE, G.SPAWN_MIN, G.BASE_SPAWN);
    },

    _rollKind() {
      const wave = this.state.wave;
      const avail = Object.keys(KIND_DEF).filter((k) => KIND_DEF[k].minWave <= wave);
      const total = avail.reduce((sum, k) => sum + KIND_DEF[k].weight, 0);
      let r = this._rng() * total;
      for (const k of avail) {
        r -= KIND_DEF[k].weight;
        if (r <= 0) return k;
      }
      return 'normal';
    },

    _hpFor(kind) {
      const wave = this.state.wave;
      if (kind === 'rock') return clamp(5 + Math.floor((wave - 1) / 2), 5, 9);
      if (kind === 'bomb') return 2;
      return 1;
    },

    _valueFor(kind) {
      const wave = this.state.wave;
      if (kind === 'rock') return this._hpFor(kind) * 2;
      if (kind === 'gold') return 12 + wave;
      if (kind === 'bomb') return 8;
      return 1 + Math.floor((wave - 1) / 3);
    },

    _makeBubble(kind, x, y) {
      const def = KIND_DEF[kind];
      const wave = this.state.wave;
      const hp = this._hpFor(kind);
      const fall = clamp(G.BASE_FALL + (wave - 1) * G.FALL_PER_WAVE, G.BASE_FALL, G.FALL_CAP);
      return {
        id: this._nextId++,
        kind,
        x,
        y,
        vx: (this._rng() - 0.5) * 44,
        vy: fall,
        hp,
        maxHp: hp,
        value: this._valueFor(kind),
        r: def.r,
        color: kind === 'normal' ? 1 + Math.floor(this._rng() * 4) : 0,
        home: this._rng() < 0.65 ? 22 : 0,   // 部分泡泡会向炮台飘（制造威胁）
        age: 0,
        dead: false,
      };
    },

    _spawnBubble() {
      const kind = this._rollKind();
      const def = KIND_DEF[kind];
      const x = def.r + 30 + this._rng() * (WORLD.WIDTH - 2 * (def.r + 30));
      const bubble = this._makeBubble(kind, x, -def.r - 8);
      this.state.bubbles.push(bubble);
      this._emit({ type: 'spawn', id: bubble.id, kind, x: bubble.x });
    },

    _fire(manual) {
      const s = this.state;
      const cx = s.cannon.x;
      const cy = s.cannon.y - G.CANNON_H / 2 - 4;
      const angles = s.tripleT > 0 ? [-0.16, 0, 0.16] : [0];
      for (const a of angles) {
        s.bullets.push({
          x: cx, y: cy,
          vx: Math.sin(a) * G.BULLET_SPEED,
          vy: -Math.cos(a) * G.BULLET_SPEED,
          r: G.BULLET_R,
          dead: false,
        });
      }
      this._emit({ type: manual ? 'burst' : 'shot', x: cx, y: cy });
    },

    _stepBullets(dt) {
      const s = this.state;
      for (const b of s.bullets) {
        if (b.dead) continue;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y < -30 || b.x < -30 || b.x > WORLD.WIDTH + 30) { b.dead = true; continue; }
        for (const bb of s.bubbles) {
          if (bb.dead) continue;
          const dx = b.x - bb.x;
          const dy = b.y - bb.y;
          if (dx * dx + dy * dy <= (bb.r + b.r) * (bb.r + b.r)) {
            b.dead = true;
            bb.hp -= G.BULLET_DAMAGE;
            this._emit({ type: 'hit', id: bb.id, kind: bb.kind, hp: Math.max(0, bb.hp), x: bb.x, y: bb.y });
            if (bb.hp <= 0) this._pop(bb, 'bullet');
            break;
          }
        }
      }
    },

    _stepBubbles(dt) {
      const s = this.state;
      for (const b of s.bubbles) {
        if (b.dead) continue;
        b.age += dt;
        if (b.home) {
          b.vx += Math.sign(s.cannon.x - b.x) * b.home * dt;
          b.vx = clamp(b.vx, -70, 70);
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
        if (b.x > WORLD.WIDTH - b.r) { b.x = WORLD.WIDTH - b.r; b.vx = -Math.abs(b.vx); }
        // 逃逸（落到屏幕底外）→ 断连击 + 漏接计数
        if (b.y > WORLD.HEIGHT + b.r) {
          if (this._onMiss(b, false)) return;
          continue;
        }
        // 撞炮台 → 死亡
        if (b.y + b.r * 0.55 >= s.cannon.y - G.CANNON_H / 2 && Math.abs(b.x - s.cannon.x) <= G.CANNON_W / 2 + b.r * 0.55) {
          this._lose(b, 'crash');
          return;
        }
        // 超时未击破自动消失（也视为 miss）
        if (b.age > G.EXPIRE_TIME) {
          if (this._onMiss(b, true)) return;
        }
      }
    },

    _stepPowerups(dt) {
      const s = this.state;
      for (const p of s.powerups) {
        if (p.dead) continue;
        p.y += p.vy * dt;
        if (p.y > WORLD.HEIGHT + 30) { p.dead = true; continue; }
        if (p.y + p.r >= s.cannon.y - G.CANNON_H / 2 && Math.abs(p.x - s.cannon.x) <= G.CANNON_W / 2 + 16) {
          p.dead = true;
          if (p.kind === 'rapid') s.rapidT = G.RAPID_TIME;
          else s.tripleT = G.TRIPLE_TIME;
          this._emit({ type: 'powerup', kind: p.kind, x: p.x, y: p.y });
        }
      }
    },

    _pop(bubble, cause) {
      const s = this.state;
      if (bubble.dead) return;
      bubble.dead = true;
      const gain = bubble.value;
      const comboBonus = s.combo;
      s.score += gain + comboBonus;
      s.combo += 1;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      s.pops += 1;
      s.popsThisWave += 1;
      this._emit({ type: 'pop', id: bubble.id, kind: bubble.kind, value: gain, combo: s.combo, x: bubble.x, y: bubble.y, cause });
      if (s.combo >= G.COMBO_MILESTONE && s.combo % G.COMBO_MILESTONE === 0) {
        this._emit({ type: 'combo', combo: s.combo });
      }
      if (bubble.kind === 'bomb') this._explode(bubble);
      if (bubble.kind === 'gold') this._spawnPowerupAt(bubble.x, bubble.y);
      if (s.popsThisWave >= G.POPS_PER_WAVE) {
        s.popsThisWave = 0;
        s.wave += 1;
        this._emit({ type: 'wave', wave: s.wave });
      }
    },

    _explode(bomb) {
      const s = this.state;
      const victims = s.bubbles.filter((b) => !b.dead && b.id !== bomb.id && this._dist(b, bomb) < G.BOMB_RADIUS + b.r);
      this._emit({ type: 'bomb', id: bomb.id, x: bomb.x, y: bomb.y, count: victims.length });
      for (const v of victims) {
        if (!v.dead) this._pop(v, 'bomb');
      }
    },

    _dist(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    },

    _spawnPowerupAt(x, y) {
      const s = this.state;
      const kind = this._rng() < 0.5 ? 'rapid' : 'triple';
      s.powerups.push({ kind, x: clamp(x, 40, WORLD.WIDTH - 40), y, vy: G.POWERUP_FALL, r: 18, dead: false });
    },

    _onMiss(bubble, expired) {
      const s = this.state;
      bubble.dead = true;
      s.combo = 0;
      s.misses += 1;
      this._emit({ type: 'miss', id: bubble.id, kind: bubble.kind, misses: s.misses, expired: !!expired, x: bubble.x, y: bubble.y });
      if (s.misses >= G.MISS_LIMIT) {
        this._lose(bubble, 'overflow');
        return true;
      }
      return false;
    },

    _lose(bubble, reason) {
      const s = this.state;
      s.phase = 'over';
      s.stars = 1 + (s.score >= G.STAR_2 ? 1 : 0) + (s.score >= G.STAR_3 ? 1 : 0);
      s.result = {
        won: false,
        score: s.score,
        wave: s.wave,
        stars: s.stars,
        maxCombo: s.maxCombo,
        pops: s.pops,
        misses: s.misses,
        reason: reason || 'crash',
      };
      this._emit({ type: 'lose', score: s.score, wave: s.wave, stars: s.stars, maxCombo: s.maxCombo, misses: s.misses, reason: reason || 'crash', x: bubble.x, y: bubble.y });
    },
  };

  return run;
}

// 兼容骨架别名
export function createSim(seed = 1) {
  return createRun({ seed });
}
