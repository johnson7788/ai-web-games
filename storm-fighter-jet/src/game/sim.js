// STORM FIGHTER JET · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：喷气战机、追踪/直线导弹、岩石、金币、护盾、连击、碰撞、事件表。
// 依赖：config/levels.js（LEVELS）、config/game.config.js（GAME/WORLD）。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVELS } from '../../config/levels.js';
import { WORLD, GAME } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const MARGIN = 26;          // 战机不贴边的最小距离
const PI = Math.PI;
const TAU = PI * 2;

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

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function norm(x, y) {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > PI) d -= TAU;
  if (d < -PI) d += TAU;
  return d;
}

// ------------------------------------------------------------------ 工具
function pickMissileType(level, rng) {
  const types = level.missileTypes;
  let total = 0;
  for (const t of types) total += t.weight;
  let r = rng() * total;
  for (const t of types) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return types[0];
}

// ------------------------------------------------------------------ createRun
export function createRun(seed = 1) {
  const rng = mulberry32((seed >>> 0) || 1);
  const level0 = LEVELS[0];

  const state = {
    phase: 'playing',         // 'playing' | 'over'
    level: 1,                 // 1 基难度层
    score: 0,
    combo: 0,
    comboMult: 1,
    comboWindow: 0,
    time: 0,                  // 本局累计秒
    levelTime: 0,             // 当前难度层已进行秒
    shield: false,
    invuln: 0,                // 护盾消耗后的无敌秒
    deaths: 0,
    stars: 0,
    plane: {
      x: W / 2,
      y: H * 0.66,
      heading: -PI / 2,       // 初始向上
      vx: 0,
      vy: -level0.planeSpeed,
      speed: level0.planeSpeed,
      turnRate: level0.turnRate,
      target: null,           // 期望方向（未归一化）
    },
    missiles: [],             // {x,y,vx,vy,type,speed,turn,life,nearFlag,warn}
    rocks: [],                // {x,y,vx,vy,r,rot,vr}
    coins: [],                // {x,y,vx,vy}
    shields: [],              // {x,y,vx,vy}
    missileTimer: 1.0,        // 首颗导弹 1s 后出
    coinTimer: 0.4,
    shieldTimer: 6,
    rockTimer: 4,
    straightTimer: 5,
    tickAcc: 0,
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    _level: level0,
    _steered: false,

    // ---- 转向输入（main / bot 调用；返回是否被接受）----
    steer(dx, dy) {
      if (this.state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (dx === 0 && dy === 0) { this.state.plane.target = null; return { ok: true }; }
      const n = norm(dx, dy);
      this.state.plane.target = { x: n.x, y: n.y };
      if (!this._steered) {
        this._steered = true;
        this._emit({ type: 'first_input' });
      } else {
        this._emit({ type: 'steer' });
      }
      return { ok: true };
    },

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      s.time += dt;
      s.levelTime += dt;
      if (s.invuln > 0) s.invuln -= dt;
      if (s.comboWindow > 0) {
        s.comboWindow -= dt;
        if (s.comboWindow <= 0) { s.combo = 0; s.comboMult = 1; }
      }

      // 每秒存活得分
      s.tickAcc += dt;
      while (s.tickAcc >= 1) {
        s.tickAcc -= 1;
        s.score += GAME.TICK_SCORE;
        this._emit({ type: 'tick', score: s.score });
      }

      this._stepPlane(dt);
      this._stepSpawns(dt);
      this._stepMissiles(dt);
      this._stepRocks(dt);
      this._stepCoins(dt);
      this._stepShields(dt);
      this._collide();
      this._levelUp();
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        score: Math.floor(s.score),
        combo: s.combo,
        comboMult: s.comboMult,
        shield: s.shield,
        threats: s.missiles.length + s.rocks.length,
        phase: s.phase,
        time: s.time,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---- 内部 ----
    _emit(e) { this._events.push(e); },

    _levelConfig() {
      const lv = LEVELS[Math.min(this.state.level, LEVELS.length) - 1] || LEVELS[LEVELS.length - 1];
      this._level = lv;
      return lv;
    },

    _stepPlane(dt) {
      const s = this.state;
      const p = s.plane;
      const target = p.target;
      let targetAngle = p.heading;
      if (target) {
        targetAngle = Math.atan2(target.y, target.x);
        const d = angDiff(p.heading, targetAngle);
        const maxTurn = p.turnRate * dt;
        if (Math.abs(d) <= maxTurn) p.heading = targetAngle;
        else p.heading += Math.sign(d) * maxTurn;
      }
      p.vx = Math.cos(p.heading) * p.speed;
      p.vy = Math.sin(p.heading) * p.speed;
      p.x = clamp(p.x + p.vx * dt, MARGIN, W - MARGIN);
      p.y = clamp(p.y + p.vy * dt, LAYOUT_TOP, H - MARGIN);
    },

    _stepSpawns(dt) {
      const s = this.state;
      const lv = this._levelConfig();

      s.missileTimer -= dt;
      if (s.missileTimer <= 0 && s.missiles.length < lv.missileMax) {
        s.missileTimer = lv.missileInterval;
        this._spawnMissile();
      }

      s.coinTimer -= dt;
      if (s.coinTimer <= 0 && s.coins.length < 24) {
        s.coinTimer = 1.6;
        this._spawnCoinCluster();
      }

      s.shieldTimer -= dt;
      if (s.shieldTimer <= 0 && !s.shield && s.shields.length === 0) {
        s.shieldTimer = GAME.SHIELD_SPAWN_EVERY;
        this._spawnShield();
      }

      if (lv.rockInterval > 0) {
        s.rockTimer -= dt;
        if (s.rockTimer <= 0 && s.rocks.length < lv.rockMax) {
          s.rockTimer = lv.rockInterval;
          this._spawnRock();
        }
      }

      if (lv.straightInterval > 0) {
        s.straightTimer -= dt;
        if (s.straightTimer <= 0) {
          s.straightTimer = lv.straightInterval;
          this._spawnStraightSalvo(lv.straightBurst || 1);
        }
      }
    },

    _edgeSpawn() {
      const r = this._rng;
      const edge = Math.floor(r() * 3);
      if (edge === 0) return { x: 30 + r() * (W - 60), y: -40 };       // 上
      if (edge === 1) return { x: -40, y: 60 + r() * (H - 120) };     // 左
      return { x: W + 40, y: 60 + r() * (H - 120) };                  // 右
    },

    _spawnMissile() {
      const s = this.state;
      const lv = this._level;
      const type = pickMissileType(lv, this._rng);
      const p = this._edgeSpawn();
      const toPlane = norm(s.plane.x - p.x, s.plane.y - p.y);
      s.missiles.push({
        x: p.x, y: p.y,
        vx: toPlane.x * type.speed, vy: toPlane.y * type.speed,
        type: type.type, speed: type.speed, turn: type.turn,
        life: 18, nearFlag: false, warn: type.type === 3,
      });
      this._emit({ type: 'missileSpawn', kind: type.type });
    },

    _spawnStraightSalvo(n) {
      const s = this.state;
      const lv = this._level;
      // 沿对角线封路的直线导弹（仿原版 ZhiXianDaoDan 路径）
      const dirs = [
        [1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0.4], [0.4, 1],
      ];
      const used = [];
      for (let i = 0; i < n; i += 1) {
        let idx = Math.floor(this._rng() * dirs.length);
        let guard = 0;
        while (used.includes(idx) && guard++ < 12) idx = Math.floor(this._rng() * dirs.length);
        used.push(idx);
        const d = norm(dirs[idx][0], dirs[idx][1]);
        const speed = 300 + this._rng() * 60;
        const spawn = this._edgeSpawn();
        s.missiles.push({
          x: spawn.x, y: spawn.y,
          vx: d.x * speed, vy: d.y * speed,
          type: 0, speed, turn: 0, straight: true,
          life: 20, nearFlag: false, warn: false,
        });
      }
      this._emit({ type: 'missileShot', count: n });
    },

    _spawnRock() {
      const s = this.state;
      const p = this._edgeSpawn();
      const d = norm(W / 2 - p.x + (this._rng() * 200 - 100), H / 2 - p.y + (this._rng() * 200 - 100));
      const speed = 60 + this._rng() * 50;
      s.rocks.push({
        x: p.x, y: p.y,
        vx: d.x * speed, vy: d.y * speed,
        r: GAME.ROCK_RADIUS_MIN + this._rng() * (GAME.ROCK_RADIUS_MAX - GAME.ROCK_RADIUS_MIN),
        rot: this._rng() * TAU, vr: (this._rng() - 0.5) * 2,
      });
      this._emit({ type: 'rockSpawn' });
    },

    _spawnCoinCluster() {
      const s = this.state;
      const p = this._edgeSpawn();
      const shape = GAME.COIN_CLUSTERS[Math.floor(this._rng() * GAME.COIN_CLUSTERS.length)];
      const drift = norm(W / 2 - p.x + (this._rng() * 160 - 80), H / 2 - p.y + (this._rng() * 160 - 80));
      for (const off of shape) {
        s.coins.push({ x: p.x + off.x, y: p.y + off.y, vx: drift.x * 40, vy: drift.y * 40 });
      }
    },

    _spawnShield() {
      const s = this.state;
      const p = this._edgeSpawn();
      const drift = norm(W / 2 - p.x, H / 2 - p.y);
      s.shields.push({ x: p.x, y: p.y, vx: drift.x * 30, vy: drift.y * 30 });
    },

    _stepMissiles(dt) {
      const s = this.state;
      const arr = s.missiles;
      for (let i = arr.length - 1; i >= 0; i -= 1) {
        const m = arr[i];
        if (!m.straight) {
          const toPlane = norm(s.plane.x - m.x, s.plane.y - m.y);
          const desired = Math.atan2(toPlane.y, toPlane.x);
          const cur = Math.atan2(m.vy, m.vx);
          const d = angDiff(cur, desired);
          const maxTurn = m.turn * dt;
          const a = Math.abs(d) <= maxTurn ? desired : cur + Math.sign(d) * maxTurn;
          m.vx = Math.cos(a) * m.speed;
          m.vy = Math.sin(a) * m.speed;
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.life -= dt;
        // 擦肩而过（near-miss 重玩钩子）
        const dist = Math.hypot(m.x - s.plane.x, m.y - s.plane.y);
        if (!m.nearFlag && dist < GAME.NEAR_MISS_RADIUS && dist > GAME.HIT_RADIUS) {
          m.nearFlag = true;
          this._emit({ type: 'nearMiss', dist: Math.round(dist) });
        }
        if (m.life <= 0 || m.x < -220 || m.x > W + 220 || m.y < -220 || m.y > H + 220) {
          arr.splice(i, 1);
        }
      }
    },

    _stepRocks(dt) {
      const s = this.state;
      for (let i = s.rocks.length - 1; i >= 0; i -= 1) {
        const rk = s.rocks[i];
        rk.x += rk.vx * dt;
        rk.y += rk.vy * dt;
        rk.rot += rk.vr * dt;
        if (rk.x < -260 || rk.x > W + 260 || rk.y < -260 || rk.y > H + 260) s.rocks.splice(i, 1);
      }
    },

    _stepCoins(dt) {
      const s = this.state;
      for (let i = s.coins.length - 1; i >= 0; i -= 1) {
        const c = s.coins[i];
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.x < -80 || c.x > W + 80 || c.y < -80 || c.y > H + 80) s.coins.splice(i, 1);
      }
    },

    _stepShields(dt) {
      const s = this.state;
      for (let i = s.shields.length - 1; i >= 0; i -= 1) {
        const sh = s.shields[i];
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        if (sh.x < -80 || sh.x > W + 80 || sh.y < -80 || sh.y > H + 80) s.shields.splice(i, 1);
      }
    },

    _collide() {
      const s = this.state;
      const p = s.plane;

      // 战机 vs 导弹 / 岩石
      for (let i = s.missiles.length - 1; i >= 0; i -= 1) {
        const m = s.missiles[i];
        if (Math.hypot(m.x - p.x, m.y - p.y) <= GAME.HIT_RADIUS + GAME.MISSILE_RADIUS * 0.5) {
          s.missiles.splice(i, 1);
          this._hit();
          return;
        }
      }
      for (let i = s.rocks.length - 1; i >= 0; i -= 1) {
        const rk = s.rocks[i];
        if (Math.hypot(rk.x - p.x, rk.y - p.y) <= GAME.HIT_RADIUS + rk.r * 0.5) {
          s.rocks.splice(i, 1);
          this._hit();
          return;
        }
      }

      // 战机 vs 金币
      for (let i = s.coins.length - 1; i >= 0; i -= 1) {
        const c = s.coins[i];
        if (Math.hypot(c.x - p.x, c.y - p.y) <= GAME.PICKUP_RADIUS) {
          s.coins.splice(i, 1);
          s.combo += 1;
          s.comboWindow = GAME.COMBO_WINDOW;
          s.comboMult = Math.min(GAME.COMBO_MAX_MULT, 1 + Math.floor(s.combo / GAME.COMBO_STEP));
          s.score += GAME.COIN_SCORE * s.comboMult;
          this._emit({ type: 'coin', combo: s.combo, mult: s.comboMult, score: Math.floor(s.score) });
          return; // 一帧最多吃一枚，避免连帧穿透
        }
      }

      // 战机 vs 护盾
      for (let i = s.shields.length - 1; i >= 0; i -= 1) {
        const sh = s.shields[i];
        if (Math.hypot(sh.x - p.x, sh.y - p.y) <= GAME.PICKUP_RADIUS) {
          s.shields.splice(i, 1);
          if (!s.shield) {
            s.shield = true;
            this._emit({ type: 'shield' });
          }
          return;
        }
      }

      // 导弹 vs 导弹 / 岩石（互毁，纯视觉+音效，不加分）
      for (let i = 0; i < s.missiles.length; i += 1) {
        const a = s.missiles[i];
        for (let j = i + 1; j < s.missiles.length; j += 1) {
          const b = s.missiles[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) <= GAME.MISSILE_MISSILE_RADIUS) {
            s.missiles.splice(j, 1);
            s.missiles.splice(i, 1);
            this._emit({ type: 'explosion', x: a.x, y: a.y });
            return;
          }
        }
      }
      for (let i = s.missiles.length - 1; i >= 0; i -= 1) {
        const m = s.missiles[i];
        for (let j = s.rocks.length - 1; j >= 0; j -= 1) {
          const rk = s.rocks[j];
          if (Math.hypot(m.x - rk.x, m.y - rk.y) <= GAME.MISSILE_MISSILE_RADIUS + rk.r * 0.5) {
            s.missiles.splice(i, 1);
            s.rocks.splice(j, 1);
            this._emit({ type: 'explosion', x: m.x, y: m.y });
            return;
          }
        }
      }
    },

    _hit() {
      const s = this.state;
      if (s.invuln > 0) return;
      if (s.shield) {
        s.shield = false;
        s.invuln = GAME.SHIELD_INVULN;
        s.combo = 0;
        s.comboMult = 1;
        this._emit({ type: 'shieldBreak' });
        return;
      }
      this._die();
    },

    _die() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'over';
      s.deaths += 1;
      s.stars = this._computeStars(s.score);
      this._emit({ type: 'die', score: Math.floor(s.score) });
      this._emit({ type: 'over', score: Math.floor(s.score), stars: s.stars, level: s.level });
    },

    _computeStars(score) {
      let n = 0;
      for (const th of GAME.STAR_SCORES) if (score >= th) n += 1;
      return n;
    },

    _levelUp() {
      const s = this.state;
      const lv = this._level;
      if (s.levelTime >= lv.duration) {
        s.levelTime = 0;
        if (s.level < LEVELS.length) s.level += 1;
        const next = this._levelConfig();
        s.plane.speed = next.planeSpeed;
        s.plane.turnRate = next.turnRate;
        this._emit({ type: 'levelUp', level: s.level });
      }
    },
  };

  return run;
}

// 供 sim 内部使用的顶部边界（避免战机压到 HUD：HUD 52 + 机身半径 ≈30 + 余量）
const LAYOUT_TOP = 52 + 40;

// 兼容骨架别名
export function createSim() {
  return createRun(1);
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
