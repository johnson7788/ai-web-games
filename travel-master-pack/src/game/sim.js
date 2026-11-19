// Travel Master Pack · 模拟层（纯逻辑，零 DOM / window / Date.now / canvas）
// 玩法骨架 1:1 复刻参考源码（远行达人）：
//   四车道无尽跑酷，路障下落（同车道撞击即死）、包裹下落（同车道接住得分）、
//   速度随时间升档、单车道最多连续 3 个路障、包裹避开最近路障车道。
// 原创新机制：
//   连击乘数（每 10 连击 +1 档，最高 ×3，漏包裹清零）、护盾（挡一次撞击）、星级结算（1-3 星）。
// 随机：注入 seed 的 mulberry32，可复现（node --test 与 tools/selfplay.mjs 直接用）。

import { GAME, WORLD } from '../../config/game.config.js';

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ------------------------------------------------------------------ 速度曲线（P0 1:1）
export function speedOf(gameTime) {
  if (gameTime < 10) {
    return { interval: GAME.BARRIER_INTERVAL_0, fall: GAME.FALL_TIME_0 };
  }
  let interval = 1050 - Math.floor(gameTime / 10) * 50;
  let fall = 5 - Math.floor(gameTime / 10) * 0.3;
  if (interval < GAME.SPEED_MIN_INTERVAL) interval = GAME.SPEED_MIN_INTERVAL;
  if (fall < GAME.SPEED_MIN_FALL) fall = GAME.SPEED_MIN_FALL;
  return { interval, fall };
}

// ------------------------------------------------------------------ createRun
export function createRun(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    phase: 'playing',           // 'playing' | 'over'
    lane: 1,                    // 0..3
    score: 0,
    combo: 0,
    comboMult: 1,
    shield: 0,
    gameTime: 0,
    level: 1,
    entities: [],               // { kind, lane, y, speed, thing, resolved, removed, nearFired }
    lastBarrierLane: -1,
    hasBarrier: [0, 0, 0, 0],   // 每车道连续路障计数
    spawnAcc: 0,
    spawnInterval: GAME.BARRIER_INTERVAL_0,
    fallTime: GAME.FALL_TIME_0,
    stats: { dodged: 0, collected: 0, missed: 0, shieldsGot: 0, shieldsUsed: 0, nearMiss: 0 },
    result: null,
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    _clock: 0,
    _lastInterval: -1,

    // ---- 时间推进（固定步长，main 每 STEP 调一次）----
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;
      s.gameTime += dt;

      // 生成（路障 / 包裹 / 护盾）
      s.spawnAcc += dt * 1000;
      while (s.spawnAcc >= s.spawnInterval) {
        s.spawnAcc -= s.spawnInterval;
        this._spawnBarrier();
        const gp = this._rng();
        if (s.gameTime > GAME.GOODS_AFTER_SEC && gp < GAME.GOODS_PROB) {
          this._spawnGoods(1);
          if (gp < GAME.DOUBLE_GOODS_PROB) this._spawnGoods(2);
        }
        if (s.gameTime > GAME.SHIELD_AFTER_SEC && this._rng() < GAME.SHIELD_PROB) {
          this._spawnShield();
        }
        this._updateSpeed();
      }

      // 实体下落 + 碰撞判定
      for (const e of s.entities) {
        if (e.removed) continue;
        e.y += e.speed * dt;
        if (!e.passed && e.y >= GAME.PLAYER_Y - GAME.PLAYER_BAND) {
          e.passed = true;
          if (e.lane === s.lane) {
            this._resolve(e);
          } else if (e.kind === 'barrier' && Math.abs(e.lane - s.lane) === 1) {
            s.stats.nearMiss += 1;
            this._emit({ type: 'nearMiss', lane: e.lane });
          }
        }
        if (!e.removed && e.y >= GAME.END_Y) {
          this._atEnd(e);
          e.removed = true;
        }
      }
      s.entities = s.entities.filter((e) => !e.removed);
    },

    // ---- 换道（输入）----
    move(dir) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (dir !== -1 && dir !== 1) return { ok: false, reason: 'dir' };
      const next = s.lane + dir;
      if (next < 0 || next >= GAME.LANE_COUNT) return { ok: false, reason: 'bounds' };
      s.lane = next;
      this._emit({ type: 'move', lane: next, dir });
      return { ok: true, lane: next };
    },

    getHud() {
      const s = this.state;
      return {
        score: s.score,
        combo: s.combo,
        comboMult: s.comboMult,
        shield: s.shield,
        level: s.level,
        gameTime: s.gameTime,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _randLane() { return Math.floor(this._rng() * GAME.LANE_COUNT); },

    // 从除 exclude（可多个）外的车道里随机挑一条
    _pickLaneExcluding(...exclude) {
      const lanes = [];
      for (let i = 0; i < GAME.LANE_COUNT; i += 1) if (!exclude.includes(i)) lanes.push(i);
      return lanes[Math.floor(this._rng() * lanes.length)];
    },

    _entitySpeed() {
      return (GAME.END_Y - GAME.SPAWN_Y) / Math.max(0.05, this.state.fallTime);
    },

    _spawnBarrier() {
      const s = this.state;
      let num = this._randLane();
      // 单车道最多连续 3 个路障：第 4 个强制换道并重置连记
      if (s.hasBarrier[num] >= GAME.MAX_BARRIER_STREAK) {
        let guard = 0;
        do { num = this._randLane(); } while (num === s.lastBarrierLane && guard++ < 16);
        s.hasBarrier = [0, 0, 0, 0];
      }
      s.hasBarrier[num] += 1;
      s.lastBarrierLane = num;
      const thing = Math.floor(this._rng() * 3); // 0 锥 / 1 潭 / 2 路障
      s.entities.push({
        kind: 'barrier', lane: num, thing,
        y: GAME.SPAWN_Y, speed: this._entitySpeed(),
        resolved: false, removed: false, passed: false,
      });
      this._emit({ type: 'spawn', kind: 'barrier', lane: num, thing });
    },

    _spawnGoods(count) {
      const s = this.state;
      let num = this._randLane();
      if (num === s.lastBarrierLane) num = this._pickLaneExcluding(s.lastBarrierLane);
      const thing = Math.floor(this._rng() * 3);
      s.entities.push({
        kind: 'goods', lane: num, thing,
        y: GAME.SPAWN_Y, speed: this._entitySpeed(),
        resolved: false, removed: false, passed: false,
      });
      this._emit({ type: 'spawn', kind: 'goods', lane: num, thing });
      if (count === 2) {
        const num2 = this._pickLaneExcluding(s.lastBarrierLane, num);
        s.entities.push({
          kind: 'goods', lane: num2, thing: Math.floor(this._rng() * 3),
          y: GAME.SPAWN_Y, speed: this._entitySpeed(),
          resolved: false, removed: false, passed: false,
        });
        this._emit({ type: 'spawn', kind: 'goods', lane: num2, thing: s.entities[s.entities.length - 1].thing });
      }
    },

    _spawnShield() {
      const s = this.state;
      const num = this._randLane();
      s.entities.push({
        kind: 'shield', lane: num, thing: 0,
        y: GAME.SPAWN_Y, speed: this._entitySpeed(),
        resolved: false, removed: false, passed: false,
      });
      this._emit({ type: 'spawn', kind: 'shield', lane: num });
    },

    _updateSpeed() {
      const s = this.state;
      const { interval, fall } = speedOf(s.gameTime);
      s.spawnInterval = interval;
      s.fallTime = fall;
      if (interval !== this._lastInterval) {
        const prev = this._lastInterval;
        this._lastInterval = interval;
        if (prev >= 0 && interval < prev) {
          this._emit({ type: 'speedUp', interval, fall });
        }
      }
    },

    _addScore(base) {
      const s = this.state;
      s.score += base * s.comboMult;
      this._afterScore();
    },

    _afterScore() {
      const s = this.state;
      const mult = Math.min(GAME.COMBO_MAX_MULT, 1 + Math.floor(s.combo / GAME.COMBO_STEP));
      if (mult > s.comboMult) {
        s.comboMult = mult;
        this._emit({ type: 'combo', mult, combo: s.combo });
      }
      const level = 1 + Math.floor(s.score / GAME.LEVEL_SCORE_STEP);
      if (level > s.level) {
        s.level = level;
        this._emit({ type: 'levelUp', level });
      }
    },

    _resolve(e) {
      const s = this.state;
      if (e.kind === 'barrier') {
        if (s.shield > 0) {
          s.shield -= 1;
          s.stats.shieldsUsed += 1;
          e.removed = true;
          this._emit({ type: 'shieldBlock', shield: s.shield, lane: e.lane });
        } else {
          this._lose('crash', e.lane);
        }
      } else if (e.kind === 'goods') {
        e.removed = true;
        s.combo += 1;
        s.stats.collected += 1;
        this._addScore(2);
        this._emit({ type: 'collect', score: s.score, combo: s.combo, thing: e.thing });
      } else if (e.kind === 'shield') {
        e.removed = true;
        if (s.shield < GAME.SHIELD_MAX) {
          s.shield += 1;
          s.stats.shieldsGot += 1;
        }
        this._emit({ type: 'shieldGet', shield: s.shield, lane: e.lane });
      }
    },

    _atEnd(e) {
      const s = this.state;
      if (e.kind === 'barrier') {
        s.combo += 1;
        s.stats.dodged += 1;
        this._addScore(1);
        this._emit({ type: 'dodge', score: s.score, combo: s.combo });
      } else if (e.kind === 'goods') {
        s.combo = 0;
        s.comboMult = 1;
        s.stats.missed += 1;
        this._emit({ type: 'miss', combo: 0 });
      }
      // shield 掉到底部：不处理（无惩罚）
    },

    _lose(reason, lane) {
      const s = this.state;
      s.phase = 'over';
      s.result = { won: false, reason, score: s.score, level: s.level, stars: this._starsFor(s.score) };
      this._emit({ type: 'lose', reason, lane: lane ?? null, score: s.score });
    },

    _starsFor(score) {
      let stars = 0;
      for (const t of GAME.STARS) if (score >= t) stars += 1;
      return stars;
    },
  };

  // 开局事件（遥测首事件锚点）
  run._lastInterval = GAME.BARRIER_INTERVAL_0;
  run._emit({ type: 'start' });
  return run;
}

// 兼容别名（供其它脚本直接 import createSim）
export function createSim() { return createRun({ seed: 1 }); }
export function updateSim(sim, _input) { sim.step(1 / 60); return sim; }
