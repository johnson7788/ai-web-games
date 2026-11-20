// REEF RAIDER · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：炮台档位与发射、灯泡弹道与反弹、鱼群游动（直线/正弦/穿屏）、命中扣血、
//       光网捕鱼、金币经济与救济、目标分制胜负、连击倍率、稀有/幽灵/王鱼、事件表。
// 依赖：config/levels.js（LEVELS）、config/game.config.js（GAME/FISH_TYPES/LAYOUT）。
// 随机：注入 seed 的 mulberry32，可复现。事件 payload 字段绝不叫 type（见复盘）。
import { LEVELS } from '../../config/levels.js';
import { GAME, FISH_TYPES, LAYOUT } from '../../config/game.config.js';

export const WORLD_W = 1280;
export const WORLD_H = 720;

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

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

function rollDamage(power, rng) {
  return Math.ceil(rng() * power * GAME.DAMAGE_RANGE + power);
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    level: level.index,
    scene: level.scene,
    phase: 'playing',          // playing | won | lost
    coins: level.startCoins,
    score: 0,
    target: level.target,
    timeLeft: level.time,
    initialTime: level.time,
    powerLevel: 1,
    fish: [],
    bullets: [],
    effects: [],               // { kind, x, y, ttl, color, ... }
    combo: 0,
    comboMult: 1,
    stars: 0,
    result: null,
    reliefUsed: false,
    _rareSpawned: 0,
    reef: level.reef,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _nextId: 1,
    _fireCooldown: 0,
    _spawnClock: 0,
    _rareSpawned: 0,
    _lastCapture: -99,
    _reliefClock: 0,
    _lastSecond: Math.ceil(level.time),

    // ---------------- 时间推进
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1; // 防大跳帧

      this._clock += dt;
      s.timeLeft -= dt;
      this._fireCooldown = Math.max(0, this._fireCooldown - dt);

      // 整秒倒计时事件
      const sec = Math.ceil(s.timeLeft);
      if (sec < this._lastSecond && sec >= 0) {
        this._lastSecond = sec;
        this._emit({ type: 'countdownTick', timeLeft: sec });
      }

      this._stepSpawning(dt);
      this._stepRare();
      this._stepCombo();
      this._stepRelief(dt);
      this._stepFish(dt);
      this._stepBullets(dt);
      this._stepEffects(dt);

      if (s.timeLeft <= 0) this._lose('timeOut');
    },

    // ---------------- 发射灯泡
    fire(angle) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (this._fireCooldown > 0) return { ok: false, reason: 'cooldown' };
      if (s.coins < s.powerLevel) return { ok: false, reason: 'noCoins' };
      s.coins -= s.powerLevel;
      this._fireCooldown = GAME.FIRE_COOLDOWN;
      const dirx = Math.sin(angle);
      const diry = -Math.cos(angle);
      s.bullets.push({
        id: this._nextId++,
        x: LAYOUT.TURRET_X,
        y: LAYOUT.TURRET_Y,
        vx: dirx * GAME.BULLET_SPEED,
        vy: diry * GAME.BULLET_SPEED,
        angle,
        power: s.powerLevel,
        bounces: GAME.BOUNCES,
      });
      this._emit({ type: 'shot', angle, power: s.powerLevel, coins: s.coins });
      this._emit({ type: 'coinSpend', amount: s.powerLevel, coins: s.coins });
      return { ok: true, angle, power: s.powerLevel };
    },

    // ---------------- 切炮档
    setPower(n) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const p = clamp(Math.round(n), GAME.POWER_MIN, GAME.POWER_MAX);
      if (p === s.powerLevel) return { ok: false, reason: 'same' };
      s.powerLevel = p;
      this._emit({ type: 'powerSwitch', power: p });
      return { ok: true, power: p };
    },

    // ---------------- 调试/测试入口：直接生成一条鱼
    spawnFish(fishType, x, y, dir = 1) {
      const s = this.state;
      const t = FISH_TYPES[fishType] || FISH_TYPES.lantern;
      if (s.fish.length >= this._level.maxFish + 4) return { ok: false, reason: 'cap' };
      s.fish.push(this._makeFish(fishType, x, y, dir));
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        coins: s.coins,
        score: s.score,
        target: s.target,
        timeLeft: s.timeLeft,
        powerLevel: s.powerLevel,
        combo: s.combo,
        comboMult: s.comboMult,
        phase: s.phase,
        fishCount: s.fish.length,
        bulletCount: s.bullets.length,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部
    _emit(e) { this._events.push(e); },

    _makeFish(fishType, x, y, dir = 1) {
      const t = FISH_TYPES[fishType] || FISH_TYPES.lantern;
      const amp = t.radius > 40 ? 18 : 60 + rngAmp(this._rng) * 40;
      return {
        id: this._nextId++,
        type: fishType,
        x, y,
        baseY: y,
        dir: dir > 0 ? 1 : -1,
        speed: t.speed * (this._level.speedMult || 1),
        amp,
        freq: 0.004 + this._rng() * 0.006,
        phase: this._rng() * Math.PI * 2,
        hp: t.hp,
        maxHp: t.hp,
        gold: t.gold,
        radius: t.radius,
        color: t.color,
        glow: t.glow,
        alive: true,
        rare: false,
        vx: 0,
        vy: 0,
      };
    },

    _spawnFish() {
      const s = this.state;
      if (s.fish.length >= this._level.maxFish) return;
      const pool = this._level.pool || ['lantern', 'butterfly', 'turtle'];
      const type = pool[Math.floor(this._rng() * pool.length)];
      const dir = this._rng() < 0.5 ? 1 : -1;
      const x = dir > 0 ? -GAME.SPAWN_MARGIN : WORLD_W + GAME.SPAWN_MARGIN;
      const y = LAYOUT.FISH_TOP + this._rng() * (LAYOUT.FISH_BOTTOM - LAYOUT.FISH_TOP);
      s.fish.push(this._makeFish(type, x, y, dir));
      this._emit({ type: 'fishSpawn', fishType: type });
    },

    _spawnRareFish() {
      const s = this.state;
      const dir = this._rng() < 0.5 ? 1 : -1;
      const x = dir > 0 ? -GAME.SPAWN_MARGIN : WORLD_W + GAME.SPAWN_MARGIN;
      const y = LAYOUT.FISH_TOP + this._rng() * (LAYOUT.FISH_BOTTOM - LAYOUT.FISH_TOP);
      const f = this._makeFish('ghost', x, y, dir);
      f.rare = true;
      f.gold = f.gold * 2;
      s.fish.push(f);
      this._emit({ type: 'rareSpawn', fishType: 'ghost' });
    },

    _stepSpawning(dt) {
      const lv = this._level;
      this._spawnClock += dt;
      while (this._spawnClock >= lv.spawnInterval) {
        this._spawnClock -= lv.spawnInterval;
        this._spawnFish();
      }
    },

    _stepRare() {
      const lv = this._level;
      if (!lv.rare) return;
      const when = 8 + this.state._rareSpawned * 20;
      if (this.state._rareSpawned < lv.rare && this._clock >= when) {
        this.state._rareSpawned += 1;
        this._spawnRareFish();
      }
    },

    _stepCombo() {
      const s = this.state;
      if (!this._level.combo) return;
      if (s.combo > 0 && this._clock - this._lastCapture > GAME.COMBO_WINDOW) {
        s.combo = 0;
        s.comboMult = 1;
        this._emit({ type: 'comboLost' });
      }
    },

    _stepRelief(dt) {
      const s = this.state;
      if (s.coins >= 1) { this._reliefClock = 0; return; }
      if (!s.reliefUsed) {
        s.coins += GAME.RELIEF_GRANT;
        s.reliefUsed = true;
        this._reliefClock = 0;
        this._emit({ type: 'relief', amount: GAME.RELIEF_GRANT, coins: s.coins });
        return;
      }
      this._reliefClock += dt;
      if (this._reliefClock >= GAME.RELIEF_INTERVAL) {
        this._reliefClock -= GAME.RELIEF_INTERVAL;
        s.coins += GAME.RELIEF_TRICKLE;
        this._emit({ type: 'coinGain', amount: GAME.RELIEF_TRICKLE, coins: s.coins, source: 'relief' });
      }
    },

    _stepFish(dt) {
      const s = this.state;
      for (const f of s.fish) {
        const prevY = f.y;
        f.vx = f.dir * f.speed;
        const newY = f.baseY + Math.sin(f.x * f.freq + f.phase) * f.amp;
        f.vy = dt > 0 ? (newY - prevY) / dt : 0;
        f.x += f.vx * dt;
        f.y = newY;
        if (f.x < -GAME.SPAWN_MARGIN - 80 || f.x > WORLD_W + GAME.SPAWN_MARGIN + 80) {
          f.alive = false;
          this._emit({ type: 'fishExit', fishType: f.type });
        }
      }
      s.fish = s.fish.filter((f) => f.alive);
    },

    _stepBullets(dt) {
      const s = this.state;
      const R = GAME.BULLET_RADIUS;
      for (const b of s.bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // 反弹（穿屏前）
        if (b.bounces > 0) {
          if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); b.bounces -= 1; }
          else if (b.x > WORLD_W - R) { b.x = WORLD_W - R; b.vx = -Math.abs(b.vx); b.bounces -= 1; }
          if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); b.bounces -= 1; }
          else if (b.y > WORLD_H - R) { b.y = WORLD_H - R; b.vy = -Math.abs(b.vy); b.bounces -= 1; }
        }

        // 出界回收
        if (b.x < -60 || b.x > WORLD_W + 60 || b.y < -60 || b.y > WORLD_H + 60) {
          b.dead = true;
          this._emit({ type: 'miss' });
          continue;
        }

        // 暗礁挡弹
        let absorbed = false;
        for (const reef of (this._level.reef || [])) {
          if (dist(b.x, b.y, reef.x, reef.y) < reef.r + R) {
            b.dead = true;
            absorbed = true;
            s.effects.push({ kind: 'reefBlock', x: b.x, y: b.y, ttl: 0.35, dur: 0.35, color: '#9BB7C9' });
            this._emit({ type: 'reefBlock', x: b.x, y: b.y });
            break;
          }
        }
        if (absorbed) continue;

        // 命中鱼
        let hit = false;
        for (const f of s.fish) {
          if (!f.alive) continue;
          if (dist(b.x, b.y, f.x, f.y) < f.radius + R) {
            hit = true;
            b.dead = true;
            const hurt = rollDamage(b.power, this._rng);
            f.hp -= hurt;
            s.effects.push({ kind: 'netRipple', x: f.x, y: f.y, ttl: 0.45, dur: 0.45, color: f.color, big: false });
            this._emit({ type: 'hit', fishId: f.id, fishType: f.type, hurt, hp: Math.max(0, f.hp) });
            if (f.hp <= 0) this._capture(f);
            break;
          }
        }
        if (hit) continue;
      }
      s.bullets = s.bullets.filter((b) => !b.dead);
    },

    _capture(f) {
      const s = this.state;
      f.alive = false;
      const rareMult = f.rare ? 2 : 1;
      const comboMult = this._level.combo ? s.comboMult : 1;
      const reward = Math.max(1, Math.round(f.gold * rareMult * comboMult));
      s.score += reward;
      s.coins += reward;
      s.effects.push({ kind: 'lightShadow', x: f.x, y: f.y, ttl: 2.3, dur: 2.3, color: f.color, radius: f.radius });
      s.effects.push({ kind: 'netRipple', x: f.x, y: f.y, ttl: 0.7, dur: 0.7, color: f.color, big: true });
      if (this._level.combo) {
        s.combo += 1;
        s.comboMult = Math.min(GAME.COMBO_MAX_MULT, 1 + GAME.COMBO_STEP * s.combo);
        this._lastCapture = this._clock;
        this._emit({ type: 'comboUp', combo: s.combo, mult: s.comboMult });
      }
      this._emit({ type: 'capture', fishType: f.type, gold: reward, score: s.score, coins: s.coins, rare: !!f.rare });
      this._emit({ type: 'coinGain', amount: reward, coins: s.coins, source: 'capture' });
      if (s.score >= s.target) this._win();
    },

    _stepEffects(dt) {
      const s = this.state;
      for (const e of s.effects) e.ttl -= dt;
      s.effects = s.effects.filter((e) => e.ttl > 0);
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const stars = 1
        + (s.timeLeft >= s.initialTime * 0.3 ? 1 : 0)
        + (!s.reliefUsed ? 1 : 0);
      s.stars = stars;
      s.result = { won: true, stars, score: s.score, target: s.target, coins: s.coins, timeLeft: s.timeLeft };
      this._emit({ type: 'win', stars, score: s.score, coins: s.coins, timeLeft: s.timeLeft });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, score: s.score, target: s.target, coins: s.coins, timeLeft: s.timeLeft };
      this._emit({ type: 'lose', reason, score: s.score, target: s.target });
    },
  };

  // 初始鱼群 + 终局王
  for (let i = 0; i < 3; i += 1) run._spawnFish();
  if (level.boss) {
    const king = run._makeFish('king', -120, LAYOUT.FISH_TOP + 180, 1);
    run.state.fish.push(king);
    run._emit({ type: 'bossSpawn', fishType: 'king' });
  }
  run._emit({ type: 'levelStart', level: level.index });

  return run;
}

function rngAmp(rng) {
  return rng();
}
