// Hook & Gold · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：锚爪钟摆/发射/回收（重量决定回收速度）、物件生成、洋流、珍珠贝开合、
//       水母蜇伤、炸药桶连锁爆炸、弃钩炸药、目标金额判定、倒计时、事件表。
// 依赖：config/levels.js、config/game.config.js、config/objects.js。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVELS } from '../../config/levels.js';
import { GAME, LAYOUT } from '../../config/game.config.js';
import { OBJECT_TYPES, objectInstance } from '../../config/objects.js';

export const HOOK_STATE = { IDLE: 'idle', EXTEND: 'extend', RETURN: 'return' };

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

function pickCount(min, max, rng) {
  return min + Math.floor(rng() * (max - min + 1));
}

// ------------------------------------------------------------------ 物件生成
function buildObjects(level, rng) {
  const F = LAYOUT.FIELD;
  const counts = [];
  const add = (type, min, max) => counts.push([type, pickCount(min, max, rng)]);
  add('GOLD_INGOT', 1, 2);
  add('SILVER_BAR', 2, 3);
  add('ANTIQUE_VASE', 2, 3);
  add('DUMBBELL', 1, 2);
  if (level.clam) add('PEARL_SHELL', 2, 3);
  if (level.jelly) add('JELLYFISH', 2, 3);
  if (level.dynamite) add('DYNAMITE', 1, 2);
  if (level.blackPearl) add('BLACK_PEARL', 1, 2);

  if (level.dense && level.dense > 1) {
    for (const c of counts) c[1] = Math.max(c[1], Math.round(c[1] * level.dense));
  }

  // 保证总价值 ≥ target*1.6（给 greedy/玩家留出容错余量）
  let total = counts.reduce((s, [t, n]) => s + OBJECT_TYPES[t].value * n, 0);
  while (total < level.target * 1.6) {
    counts.push(['SILVER_BAR', 1]);
    total += OBJECT_TYPES.SILVER_BAR.value;
  }

  const objects = [];
  let id = 1;
  for (const [type, n] of counts) {
    for (let k = 0; k < n; k += 1) {
      const obj = objectInstance(type, 0, 0, rng);
      obj.id = id++;
      if (level.heavy) obj.mass = Math.round(obj.mass * 1.35); // 深海拖拽更慢
      obj.x = F.x0 + obj.r + rng() * (F.x1 - F.x0 - obj.r * 2);
      obj.y = F.y0 + obj.r + rng() * (F.y1 - F.y0 - obj.r * 2);
      // 简单排斥，避免全叠在一起（失败也保留位置，不影响判定）
      let placed = false;
      for (let attempt = 0; attempt < 60 && !placed; attempt += 1) {
        const x = F.x0 + obj.r + rng() * (F.x1 - F.x0 - obj.r * 2);
        const y = F.y0 + obj.r + rng() * (F.y1 - F.y0 - obj.r * 2);
        let ok = true;
        for (const o of objects) {
          const dx = o.x - x;
          const dy = o.y - y;
          const min = o.r + obj.r + 18;
          if (dx * dx + dy * dy < min * min) { ok = false; break; }
        }
        if (ok) { obj.x = x; obj.y = y; placed = true; }
      }
      objects.push(obj);
    }
  }
  return objects;
}

// ------------------------------------------------------------------ createRun
// greedy 目标选择：值钱且「价值/（重量×距离）」最高（纯逻辑，供 selfplay / autoPlay 复用）
export function pickTarget(state) {
  let best = null;
  let bestScore = -Infinity;
  for (const o of state.objects) {
    if (!o.alive || o.value <= 0) continue;
    if (o.hazard === 'clam' && !o.clamOpen) continue;
    const dx = o.x - LAYOUT.PIVOT.x;
    const dy = o.y - LAYOUT.PIVOT.y;
    const dist = Math.hypot(dx, dy) || 1;
    const score = o.value / (o.mass * (1 + dist / 400));
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best;
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const objects = buildObjects(level, rng);

  const state = {
    level: level.index,
    scene: level.scene,
    current: level.current || 0,
    phase: 'playing',          // playing | won | lost
    money: 0,
    target: level.target,
    timeLeft: level.time,
    initialTime: level.time,
    stars: 0,
    dynamite: level.dynamiteTool ?? GAME.DYNAMITE_PER_LEVEL,
    pulls: 0,
    stinged: 0,
    result: null,
    hook: {
      state: HOOK_STATE.IDLE,
      angleDeg: 0,             // 0 = 竖直向下
      swingT: 0,
      len: GAME.IDLE_LEN,
      hooked: [],              // 已钩住物件 id（最多 1 个）
      weight: 0,
      minDistToValue: Infinity, // 本钩距值钱物件的最近距离（nearMiss 用）
    },
    objects,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _lastSecond: Math.ceil(level.time),
    _swingTick: 0,
    _progTick: 0,
    _bubbleTick: 0,
    _clamPrev: new Map(),

    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;

      this._stepHook(dt);
      this._stepObjects(dt);
      this._stepCountdown(dt);
      this._checkEnd();
    },

    // ---------------- 锚爪 ----------------
    _headPos() {
      const h = this.state.hook;
      const a = h.angleDeg * Math.PI / 180;
      return {
        x: LAYOUT.PIVOT.x + Math.sin(a) * h.len,
        y: LAYOUT.PIVOT.y + Math.cos(a) * h.len,
      };
    },

    _hookWeight() {
      let w = 0;
      for (const id of this.state.hook.hooked) {
        const o = this._objectById(id);
        if (o) w += o.mass;
      }
      return w;
    },

    _objectById(id) {
      return this.state.objects.find((o) => o.id === id) || null;
    },

    _stepHook(dt) {
      const h = this.state.hook;

      if (h.state === HOOK_STATE.IDLE) {
        h.swingT += dt;
        h.angleDeg = GAME.ROTATE_RANGE_DEG * Math.cos(h.swingT * GAME.SWING_SPEED + Math.PI / 2);
        this._swingTick += dt;
        if (this._swingTick >= 0.45) {
          this._swingTick = 0;
          this._emit({ type: 'swingTick', angleDeg: Math.round(h.angleDeg) });
        }
        return;
      }

      if (h.state === HOOK_STATE.EXTEND) {
        h.len += GAME.EXTEND_SPEED * dt;
        const head = this._headPos();
        // nearMiss 追踪：距值钱物件最近距离
        for (const o of this.state.objects) {
          if (!o.alive || o.value <= 0) continue;
          const dx = o.x - head.x;
          const dy = o.y - head.y;
          const d = Math.hypot(dx, dy) - o.r;
          if (d < h.minDistToValue) h.minDistToValue = d;
        }
        if (h.len >= GAME.MAX_LEN) {
          h.len = GAME.MAX_LEN;
          h.state = HOOK_STATE.RETURN;
          this._emit({ type: 'hookOutOfRange' });
        } else {
          this._collide();
        }
      }

      if (h.state === HOOK_STATE.RETURN) {
        const speed = h.weight > 0
          ? GAME.RETURN_SPEED * (GAME.WEIGHT_NORM / h.weight)
          : GAME.RETURN_SPEED;
        h.len -= speed * dt;
        // 钩住物件跟随钩头
        const head = this._headPos();
        for (const id of h.hooked) {
          const o = this._objectById(id);
          if (o) { o.x = head.x; o.y = head.y; }
        }
        // 重物回收时冒气泡（signature 视觉事件）
        if (h.weight >= 260) {
          this._bubbleTick += dt;
          if (this._bubbleTick >= 0.16) {
            this._bubbleTick = 0;
            this._emit({ type: 'bubble', x: head.x, y: head.y, heavy: true });
          }
        }
        // 细粒度进度事件（死时间证据）
        this._progTick += dt;
        if (this._progTick >= 0.22) {
          this._progTick = 0;
          this._emit({ type: 'hookProgress', len: Math.round(h.len), weight: h.weight });
        }
        if (h.len <= GAME.MIN_LEN) this._hookEnd();
      }
    },

    _collide() {
      const h = this.state.hook;
      const head = this._headPos();
      for (const o of this.state.objects) {
        if (!o.alive) continue;
        if (h.hooked.includes(o.id)) continue;
        if (o.hazard === 'clam' && !o.clamOpen) continue; // 闭合钩空
        const dx = o.x - head.x;
        const dy = o.y - head.y;
        if (dx * dx + dy * dy <= (o.r + GAME.HOOK_RADIUS) * (o.r + GAME.HOOK_RADIUS)) {
          this._grab(o);
          break;
        }
      }
    },

    _grab(o) {
      const h = this.state.hook;
      h.state = HOOK_STATE.RETURN;
      this._emit({ type: 'grab', id: o.id, type2: o.type, value: o.value, mass: o.mass });

      if (o.hazard === 'boom') {
        this._explode(o); // 误钩炸药桶：就地引爆并清空周边
        return;
      }
      h.hooked = [o.id];
      h.weight = o.mass;

      if (o.hazard === 'sting') {
        this.state.stinged += 1;
        this.state.timeLeft = Math.max(0, this.state.timeLeft - GAME.STING_TIME);
        this._emit({ type: 'sting', x: o.x, y: o.y, timeLeft: this.state.timeLeft });
      }
    },

    _hookEnd() {
      const h = this.state.hook;
      let value = 0;
      for (const id of h.hooked) {
        const o = this._objectById(id);
        if (o) { value += o.value; o.alive = false; }
      }
      const empty = value === 0;
      const nearMiss = empty && h.minDistToValue < 62;
      this.state.money += value;
      this.state.pulls += 1;
      h.hooked = [];
      h.weight = 0;
      h.len = GAME.IDLE_LEN;
      h.state = HOOK_STATE.IDLE;
      h.minDistToValue = Infinity;

      this._emit({ type: 'hookEnd', value, money: this.state.money });
      if (value > 0) this._emit({ type: 'money', value, money: this.state.money });
      if (nearMiss) this._emit({ type: 'nearMiss' });
      this._checkEnd();
    },

    // ---------------- 物件动态 ----------------
    _stepObjects(dt) {
      const F = LAYOUT.FIELD;
      const s = this.state;
      const isHooked = (o) => s.hook.hooked.includes(o.id);

      for (const o of s.objects) {
        if (!o.alive || isHooked(o)) continue;

        // 洋流：恒定横向漂移 + 边界回卷
        if (this._level.current > 0) {
          o.x += this._level.current * dt;
          if (o.x > F.x1 - o.r) o.x = F.x0 + o.r;
          if (o.x < F.x0 + o.r) o.x = F.x1 - o.r;
        }
        // 水母上下浮动（路径干扰）
        if (o.type === 'JELLYFISH') {
          o.driftPhase += dt;
          o.y += Math.sin(o.driftPhase * 2.4) * 0.5;
          o.y = Math.max(F.y0 + o.r, Math.min(F.y1 - o.r, o.y));
        }
        // 珍珠贝开合
        if (o.hazard === 'clam') {
          const open = Math.sin(o.clamPhase + this._clock * 2.4) > 0;
          if (open !== o.clamOpen) {
            this._emit({ type: open ? 'clamOpen' : 'clamClose', id: o.id, x: o.x, y: o.y });
          }
          o.clamOpen = open;
        }
      }

    },

    _explode(barrel) {
      const s = this.state;
      barrel.alive = false;
      s.hook.hooked = s.hook.hooked.filter((id) => id !== barrel.id);
      s.hook.weight = this._hookWeight();
      this._emit({ type: 'explode', x: barrel.x, y: barrel.y });
      // 摧毁爆炸半径内的其它存活物件（不含已钩住的）
      for (const o of s.objects) {
        if (!o.alive || o.id === barrel.id) continue;
        if (s.hook.hooked.includes(o.id)) continue;
        const dx = o.x - barrel.x;
        const dy = o.y - barrel.y;
        if (dx * dx + dy * dy <= GAME.EXPLOSION_RADIUS * GAME.EXPLOSION_RADIUS) {
          o.alive = false;
          this._emit({ type: 'objectDestroyed', id: o.id, type2: o.type, x: o.x, y: o.y });
        }
      }
    },

    // ---------------- 倒计时 / 结算 ----------------
    _stepCountdown(dt) {
      const s = this.state;
      s.timeLeft -= dt;
      const sec = Math.ceil(s.timeLeft);
      if (sec < this._lastSecond && sec >= 0) {
        this._lastSecond = sec;
        this._emit({ type: 'countdownTick', timeLeft: sec });
      }
      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        this._lose('timeOut');
      }
    },

    _checkEnd() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      if (s.money >= s.target) this._win();
      else if (s.timeLeft <= 0) this._lose('timeOut');
    },

    _win() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'won';
      s.stars = 1
        + (s.timeLeft >= s.initialTime * 0.3 ? 1 : 0)
        + (s.timeLeft >= s.initialTime * 0.6 ? 1 : 0);
      s.result = { won: true, stars: s.stars, money: s.money, target: s.target, timeLeft: s.timeLeft };
      this._emit({ type: 'win', stars: s.stars, money: s.money, timeLeft: s.timeLeft });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'lost';
      s.stars = 0;
      s.result = { won: false, stars: 0, money: s.money, target: s.target, timeLeft: s.timeLeft, reason };
      this._emit({ type: 'lose', reason });
    },

    // ---------------- 玩家输入 ----------------
    fire() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.hook.state !== HOOK_STATE.IDLE) return { ok: false, reason: 'hooking' };
      s.hook.state = HOOK_STATE.EXTEND;
      s.hook.len = GAME.IDLE_LEN;
      s.hook.hooked = [];
      s.hook.weight = 0;
      s.hook.minDistToValue = Infinity;
      this._emit({ type: 'fire', angleDeg: Math.round(s.hook.angleDeg) });
      return { ok: true };
    },

    // 弃钩炸药：放弃当前钩住的物件（或取消伸出），快速回钩
    abort() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.hook.state === HOOK_STATE.IDLE) return { ok: false, reason: 'idle' };
      if (s.dynamite <= 0) return { ok: false, reason: 'noDynamite' };
      s.dynamite -= 1;
      const head = this._headPos();
      for (const id of s.hook.hooked) {
        const o = this._objectById(id);
        if (o) { o.alive = true; o.x = head.x; o.y = Math.max(LAYOUT.FIELD.y0, head.y + 30); o.fuseAt = null; }
      }
      s.hook.hooked = [];
      s.hook.weight = 0;
      s.hook.state = HOOK_STATE.RETURN;
      this._emit({ type: 'explode', x: head.x, y: head.y, abort: true });
      this._emit({ type: 'abort', dynamite: s.dynamite });
      return { ok: true };
    },

    // 调试/机器人辅助：直接把锚爪对准目标点（selfplay / verify 用，不进入正式玩法）
    _aim(x, y) {
      const dx = x - LAYOUT.PIVOT.x;
      const dy = y - LAYOUT.PIVOT.y;
      this.state.hook.angleDeg = Math.atan2(dx, dy) * 180 / Math.PI;
      return this.state.hook.angleDeg;
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        money: s.money,
        target: s.target,
        timeLeft: s.timeLeft,
        dynamite: s.dynamite,
        hookState: s.hook.state,
        hookWeight: s.hook.weight,
        pulls: s.pulls,
        objectsLeft: s.objects.filter((o) => o.alive).length,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    _emit(e) {
      this._events.push(e);
    },
  };

  return run;
}
