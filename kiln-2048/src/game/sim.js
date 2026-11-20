// KILN 2048 · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：投放釉球 → 重力下落堆叠 → 同值接触合并翻倍 → 达阈值出窑消除 → 堆过失败线判负。
// 依赖：config/levels.js（LEVELS/SPAWN_TABLES）、config/game.config.js（KILN/GAME）。
// 随机：注入 seed 的 mulberry32，可复现。
// 特性：distract（大值干扰）/ frozen（冰冻球，两次复烧解冻）/ dualGlaze（异色才能合，合并后翻色）/
//       narrow（窄窑腔）/ hammer（重锤砸碎任意球）。

import { KILN, GAME } from '../../config/game.config.js';
import { LEVELS, SPAWN_TABLES } from '../../config/levels.js';

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

// 球半径：随数值（对数）增长
export function radius(value) {
  return GAME.R_BASE * (1 + Math.log2(Math.max(2, value)) / 10);
}

function weightedPick(rng, table) {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rng() * total;
  for (const [v, w] of table) {
    r -= w;
    if (r <= 0) return v;
  }
  return table[0][0];
}

function effectiveKiln(level) {
  const inset = level.kilnInset || 0;
  return {
    left: KILN.LEFT + inset,
    right: KILN.RIGHT - inset,
    floorY: KILN.FLOOR_Y,
    failLineY: KILN.FAIL_LINE_Y,
    spawnY: KILN.SPAWN_Y,
  };
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const kiln = effectiveKiln(level);
  const spawnTable = SPAWN_TABLES[level.spawn] || SPAWN_TABLES.base;

  const state = {
    level: level.index,
    sceneKey: level.scene || 'morning-workshop',
    phase: 'playing', // 'playing' | 'won' | 'lost'
    balls: [],        // 已投放的球（不含持球）
    held: null,       // 当前持球（投放点，未下落）
    preview: [],      // 预览值数组（preview[0] = 持球值）
    score: 0,
    drops: 0,
    dropLimit: level.goal.dropLimit ?? Infinity,
    eliminated: 0,    // 出窑消除计数（≥ eliminateAt）
    maxValue: 2,      // 合成出的最大数值（不含直接投放）
    hammerLeft: level.hammer || 0,
    killList: [],     // 本帧消除的球（render 粒子用）
    kiln,
    goal: level.goal,
    features: level.features || {},
    eliminateAt: level.eliminateAt ?? GAME.ELIMINATE_AT,
    name: level.name || { en: '', zh: '' },
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _nextId: 1,
    _spawnClock: 0,
    _valueBuffer: [],
    _mergeCount: 0,
    _dropsExhausted: false,
    _exhaustedT: 0,

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;

      this._clock += dt;

      // 投放后延迟生成下一持球
      if (!s.held && this._spawnClock > 0) {
        this._spawnClock -= dt;
        if (this._spawnClock <= 0) this._spawnHeld();
      }

      const sub = GAME.SUBSTEPS;
      const h = dt / sub;
      for (let i = 0; i < sub; i += 1) this._physicsStep(h);

      this._resolveMerges();

      // 失败线判定
      this._checkFail(dt);

      // 投放耗尽后结算（仅 score 目标）
      if (this._dropsExhausted) {
        if (this._boardSettled()) {
          this._exhaustedT += dt;
          if (this._exhaustedT >= GAME.DROPS_OUT_GRACE) this._lose('dropsOut');
        } else {
          this._exhaustedT = 0;
        }
      }

      this._rebuildPreview();
    },

    // ---- 玩家操作 ----
    setDropX(x) {
      const s = this.state;
      if (s.phase !== 'playing' || !s.held) return { ok: false, reason: 'noHeld' };
      const k = s.kiln;
      const lo = k.left + s.held.r;
      const hi = k.right - s.held.r;
      const nx = Math.max(lo, Math.min(hi, x));
      const moved = Math.abs(nx - s.held.x) > 0.01;
      s.held.x = nx;
      if (moved) this._emit({ type: 'aim', id: s.held.id, x: nx });
      return { ok: true, x: nx };
    },

    drop() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (!s.held) return { ok: false, reason: 'noHeld' };
      const b = s.held;
      b.held = false;
      s.held = null;
      s.balls.push(b);
      s.drops += 1;
      this._spawnClock = GAME.SPAWN_DELAY;
      this._emit({ type: 'drop', id: b.id, value: b.value, x: b.x });

      // 限定投放数（score 目标）：最后一次投放后进入结算观察
      if (Number.isFinite(s.dropLimit) && s.drops >= s.dropLimit) {
        this._dropsExhausted = true;
        this._exhaustedT = 0;
      }
      return { ok: true };
    },

    smash(ballId) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.hammerLeft <= 0) return { ok: false, reason: 'noHammer' };
      const idx = s.balls.findIndex((b) => b.id === ballId);
      if (idx === -1) return { ok: false, reason: 'noBall' };
      const b = s.balls[idx];
      s.balls.splice(idx, 1);
      s.hammerLeft -= 1;
      s.killList.push({ x: b.x, y: b.y, value: b.value, hammer: true });
      this._emit({ type: 'hammer', id: b.id, value: b.value, x: b.x, y: b.y });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        score: s.score,
        drops: s.drops,
        dropLimit: s.dropLimit,
        hammerLeft: s.hammerLeft,
        maxValue: s.maxValue,
        eliminated: s.eliminated,
        goal: s.goal,
        preview: s.preview,
        heldValue: s.held ? s.held.value : null,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _ensureValues(n) {
      while (this._valueBuffer.length < n) {
        this._valueBuffer.push(weightedPick(this._rng, this._spawnTable()));
      }
    },
    _spawnTable() {
      return SPAWN_TABLES[this._level.spawn] || SPAWN_TABLES.base;
    },
    _consumeValue() {
      this._ensureValues(1);
      return this._valueBuffer.shift();
    },
    _peekValue(i) {
      this._ensureValues(i + 1);
      return this._valueBuffer[i];
    },

    _rollFrozen() {
      return !!(this.state.features.frozen && this._rng() < 0.18);
    },

    _spawnHeld() {
      const s = this.state;
      if (s.held) return;
      const value = this._consumeValue();
      const id = this._nextId++;
      const b = {
        id,
        value,
        x: (s.kiln.left + s.kiln.right) / 2,
        y: s.kiln.spawnY,
        vx: 0,
        vy: 0,
        r: radius(value),
        held: true,
        frozen: this._rollFrozen(),
        phase: id % 2,
        sleeping: false,
        sleepT: 0,
        stillT: 0,
        px: (s.kiln.left + s.kiln.right) / 2,
        py: s.kiln.spawnY,
        aboveT: 0,
        landed: false,
      };
      s.held = b;
      this._emit({ type: 'spawn', id: b.id, value, frozen: b.frozen });
      this._rebuildPreview();
    },

    _rebuildPreview() {
      const s = this.state;
      const n = Math.max(1, this._level.preview || 1);
      const list = [];
      if (s.held) list.push(s.held.value);
      while (list.length < n) list.push(this._peekValue(list.length));
      s.preview = list;
    },

    _physicsStep(h) {
      const s = this.state;
      // 重力 + 积分 + 空气阻尼
      const DAMP = 0.995;
      for (const b of s.balls) {
        if (b.sleeping) continue;
        b.vy += GAME.GRAVITY * h;
        b.vx *= DAMP;
        b.vy *= DAMP;
        b.x += b.vx * h;
        b.y += b.vy * h;
      }
      // 墙 / 底
      for (const b of s.balls) {
        if (b.sleeping) continue;
        const k = s.kiln;
        if (b.x - b.r < k.left) { b.x = k.left + b.r; if (b.vx < 0) b.vx = -b.vx * GAME.WALL_RESTITUTION; }
        if (b.x + b.r > k.right) { b.x = k.right - b.r; if (b.vx > 0) b.vx = -b.vx * GAME.WALL_RESTITUTION; }
        if (b.y + b.r > k.floorY) {
          b.y = k.floorY - b.r;
          if (b.vy > 0) {
            // 高速冲击才反弹，低速接触直接贴地（避免微弹跳永不静止）
            if (b.vy > 60) b.vy = -b.vy * GAME.RESTITUTION;
            else b.vy = 0;
            b.vx *= GAME.CONTACT_DRAG_X;
            if (!b.landed) {
              b.landed = true;
              this._emit({ type: 'land', id: b.id, value: b.value });
            }
          }
        }
      }
      // 球-球：先做位置修正（迭代），再做一次速度求解（避免逐迭代重复施加冲量）
      this._resolveBallCollisions();
      // 睡眠：按「位移」判定（速度极限环里位置几乎不动也能入睡）
      for (const b of s.balls) {
        if (b.held) continue;
        const moved = Math.abs(b.x - b.px) + Math.abs(b.y - b.py);
        b.px = b.x;
        b.py = b.y;
        if (moved < 0.25) {
          b.stillT += 1;
          if (b.stillT >= GAME.SLEEP_FRAMES && !b.sleeping) {
            b.sleeping = true;
            b.vx = 0;
            b.vy = 0;
            this._emit({ type: 'settle', id: b.id, value: b.value });
          }
        } else {
          b.stillT = 0;
          if (b.sleeping) { b.sleeping = false; }
        }
      }
    },

    _resolveBallCollisions() {
      const s = this.state;
      const bs = s.balls;
      const SLOP = 2.0; // 允许的静止重叠量（避免位置来回修正造成极限环）

      // 1) 位置修正（迭代，只改位置不改速度）：只把重叠压回 SLOP 以内
      for (let it = 0; it < GAME.COLLISION_ITERS; it += 1) {
        for (let i = 0; i < bs.length; i += 1) {
          for (let j = i + 1; j < bs.length; j += 1) {
            const a = bs[i];
            const b = bs[j];
            if (a.sleeping && b.sleeping) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            let dist = Math.hypot(dx, dy);
            const minDist = a.r + b.r;
            const overlap = minDist - dist;
            const correction = overlap - SLOP;
            if (correction <= 0) continue;
            if (dist < 1e-6) dist = 1e-6;
            const nx = dx / dist;
            const ny = dy / dist;
            const aMove = a.sleeping ? 0 : 1;
            const bMove = b.sleeping ? 0 : 1;
            const total = aMove + bMove || 1;
            const k = s.kiln;
            const clampB = (bb) => {
              if (bb.x - bb.r < k.left) bb.x = k.left + bb.r;
              if (bb.x + bb.r > k.right) bb.x = k.right - bb.r;
              if (bb.y + bb.r > k.floorY) bb.y = k.floorY - bb.r;
            };
            if (aMove) { a.x -= nx * correction * (aMove / total); a.y -= ny * correction * (aMove / total); clampB(a); }
            if (bMove) { b.x += nx * correction * (bMove / total); b.y += ny * correction * (bMove / total); clampB(b); }
            if (correction > 1.5) { a.sleeping = false; b.sleeping = false; }
          }
        }
      }

      // 2) 速度求解（每对一次）：冲击反弹 or 静止接触消法向速度
      for (let i = 0; i < bs.length; i += 1) {
        for (let j = i + 1; j < bs.length; j += 1) {
          const a = bs[i];
          const b = bs[j];
          if (a.sleeping && b.sleeping) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = a.r + b.r;
          if (dist >= minDist + 1) continue; // 未接触
          let nx = dist < 1e-6 ? 0 : dx / dist;
          let ny = dist < 1e-6 ? -1 : dy / dist;
          const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rvn >= 0) continue; // 分离中
          const aWake = !a.sleeping;
          const bWake = !b.sleeping;
          if (!aWake && !bWake) continue;
          const approach = -rvn;
          const e = approach > 60 ? GAME.RESTITUTION : 0; // 低速贴住，不反弹
          const invMass = (aWake ? 1 : 0) + (bWake ? 1 : 0);
          const jimp = -(1 + e) * rvn / invMass;
          if (aWake) { a.vx -= jimp * nx; a.vy -= jimp * ny; a.vx *= GAME.CONTACT_DRAG_X; }
          if (bWake) { b.vx += jimp * nx; b.vy += jimp * ny; b.vx *= GAME.CONTACT_DRAG_X; }
        }
      }
    },

    _mergeable(a, b) {
      if (a.frozen || b.frozen) return false;
      if (this.state.features.dualGlaze) return a.phase !== b.phase;
      return true;
    },

    _resolveMerges() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      const bs = s.balls;
      if (bs.length < 2) return;

      // 找出本帧可合并的配对（每球最多参与一次）
      const used = new Set();
      const ops = [];
      for (let i = 0; i < bs.length; i += 1) {
        const a = bs[i];
        if (used.has(a.id)) continue;
        for (let j = i + 1; j < bs.length; j += 1) {
          const b = bs[j];
          if (used.has(b.id)) continue;
          if (a.value !== b.value) continue;
          if (!this._mergeable(a, b)) continue;
          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          if (dist > (a.r + b.r) + 4) continue;
          const surv = a.id < b.id ? a : b;
          const other = a.id < b.id ? b : a;
          ops.push({ surv, other });
          used.add(a.id);
          used.add(b.id);
          break;
        }
      }
      if (!ops.length) return;

      const removedIds = new Set();
      const elimAt = s.eliminateAt;

      for (const op of ops) {
        const surv = op.surv;
        const other = op.other;
        if (removedIds.has(surv.id) || removedIds.has(other.id)) continue;
        if (!this._mergeable(surv, other)) continue;

        const newValue = Math.min(GAME.MAX_VALUE, surv.value * 2);
        surv.value = newValue;
        surv.r = radius(newValue);
        surv.sleeping = false;
        surv.sleepT = 0;
        surv.stillT = 0;
        surv.px = surv.x;
        surv.py = surv.y;
        surv.landed = true;
        if (s.features.dualGlaze) surv.phase = 1 - surv.phase;
        removedIds.add(other.id);

        s.score += newValue;
        if (newValue > s.maxValue) s.maxValue = newValue;
        this._mergeCount += 1;
        this._emit({ type: 'merge', id: surv.id, value: newValue, x: surv.x, y: surv.y });

        // 出窑消除（天青出窑 signature）
        if (newValue >= elimAt) {
          removedIds.add(surv.id);
          s.score += newValue; // 出窑奖励
          s.eliminated += 1;
          s.killList.push({ x: surv.x, y: surv.y, value: newValue });
          this._emit({ type: 'eliminate', id: surv.id, value: newValue, x: surv.x, y: surv.y });
        }

        // 解冻：两次复烧后解冻
        if (s.features.frozen) {
          for (const b of bs) {
            if (b.frozen) {
              b.freezeLeft = (b.freezeLeft ?? 2) - 1;
              if (b.freezeLeft <= 0) {
                b.frozen = false;
                this._emit({ type: 'thaw', id: b.id, value: b.value, x: b.x, y: b.y });
              }
            }
          }
        }

        this._checkWin();
        if (s.phase !== 'playing') break;
      }

      if (removedIds.size) {
        s.balls = s.balls.filter((b) => !removedIds.has(b.id));
      }
    },

    _checkFail(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      // 任何球心越过失败线并停留超过宽限期 → 判负（不依赖是否入睡，避免极限环卡死）
      for (const b of s.balls) {
        if (b.y < s.kiln.failLineY) {
          b.aboveT += dt;
          if (b.aboveT >= GAME.FAIL_GRACE) {
            this._lose('overflow');
            return;
          }
        } else {
          b.aboveT = 0;
        }
      }
    },

    _checkWin() {
      const s = this.state;
      const g = s.goal;
      if (g.type === 'mergeTo') {
        if (s.maxValue >= g.target) this._win();
      } else if (g.type === 'eliminate') {
        if (s.eliminated >= g.count) this._win();
      } else if (g.type === 'score') {
        if (s.score >= g.target) this._win();
      }
    },

    _boardSettled() {
      const s = this.state;
      if (s.held) return false;
      return s.balls.every((b) => b.sleeping);
    },

    _win() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'won';
      s.result = { won: true, score: s.score, maxValue: s.maxValue, drops: s.drops, eliminated: s.eliminated };
      this._emit({ type: 'win', score: s.score, maxValue: s.maxValue });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'lost';
      s.result = { won: false, score: s.score, maxValue: s.maxValue, drops: s.drops, reason };
      this._emit({ type: 'lose', reason, score: s.score });
    },
  };

  // 初始持球
  run._spawnHeld();

  return run;
}

// ------------------------------------------------------------------ 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
