// Depth Diver · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：垂直下潜跑酷——深度累积、上浮/下沉/水平微调、障碍/样本/热泉/追逐者、氧气、
//       撞击/缺氧判定、星级结算、事件表。
// 依赖：config/levels.js（LEVELS）、config/game.config.js（WORLD/LAYOUT/GAME）。
// 随机：注入 seed 的 mulberry32，可复现。
// 事件（供 fun-report 密度）：sonar(1s 心跳)/depthTick/层换 layerChange+scatter/thrust/steer/
//       dive/sample/sampleStar/nearMiss/oxygenLow/oxygenPickup/vent/chaser/shield/crush/suffocate/win。

import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';
import { WORLD, LAYOUT, GAME, MODULES } from '../../config/game.config.js';

export { LEVEL_COUNT };

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
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function normalizeModules(mods) {
  const m = mods && typeof mods === 'object' ? mods : {};
  const out = {};
  for (const def of MODULES) out[def.id] = !!m[def.id];
  return out;
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const modules = normalizeModules(opts.modules);

  // 派生数值（模块跨局成长在这里生效）
  const lightMult = (modules.headlight ? 1.4 : 1) * (modules.battery ? 1.2 : 1);
  const oxygenMax = level.oxygen * (modules.tank ? 1.25 : 1);
  const playerR = GAME.PLAYER_R * (modules.hull ? 0.94 : 1);

  // 样本固定深度（百分比处生成，保证采满本关升星目标可达）；第 1 颗在开局即放在玩家正下方。
  const sampleDepths = [];
  for (let i = 1; i < level.sampleTotal; i += 1) {
    sampleDepths.push(level.depthTarget * (i + 1) / (level.sampleTotal + 1));
  }
  // 氧气罐（样本≥4 的后期关卡在 55% 深度放一个）
  const oxygenDepth = level.sampleTotal >= 4 ? level.depthTarget * 0.55 : -1;

  const state = {
    level: level.index,
    phase: 'playing',            // playing | won | lost
    scene: level.scene,
    depth: 0,
    depthTarget: level.depthTarget,
    oxygen: oxygenMax,
    oxygenMax,
    samples: 0,
    sampleTotal: level.sampleTotal,
    stars: 0,
    result: null,
    lightRadius: Math.round(level.lightRadius * lightMult),
    diveSpeed: level.diveSpeed,
    current: (level.currentDir === 2 ? 1 : level.currentDir) * level.currentSpeed,
    modules,
    player: { x: (LAYOUT.PLAY_X0 + LAYOUT.PLAY_X1) / 2, y: 380, vx: 0, vy: 0, r: playerR },
    obstacles: [],   // {kind:'rock'|'mine'|'chaser', x, y, r, passed}
    pickups: [],     // {kind:'sample'|'oxygen', x, y, r, taken}
    vents: [],       // {kind:'vent', x, y, w, h}
    chaser: null,
    layer: 0,
  };

  // 开局样本：放在玩家正下方，保证首秒即有可采集目标（也服务 onboarding / 截图）
  state.pickups.push({ kind: 'sample', x: state.player.x, y: state.player.y + 140, r: 22, taken: false });

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _input: { thrust: false, left: false, right: false, dive: false },
    _spawnClock: 0,
    _ventClock: 0,
    _sonarClock: 0,
    _depthTickAt: 20,
    _nextSampleIdx: 1,
    _sampleDepths: sampleDepths,
    _oxygenSpawned: false,
    _chaserSpawned: false,
    _sampleStarEmitted: false,
    _oxygenLowEmitted: false,
    _lastBlockedLanes: [],

    // ---- 输入（main/selfplay 每帧调用；记录有效操作）----
    input(cmd) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const c = cmd || {};
      const prev = this._input;
      const next = {
        thrust: !!c.thrust,
        left: !!c.left,
        right: !!c.right,
        dive: !!c.dive,
      };
      this._input = next;
      if (next.thrust && !prev.thrust) this._emit({ type: 'thrust' });
      if (next.dive && !prev.dive) this._emit({ type: 'dive' });
      if (next.left !== prev.left || next.right !== prev.right) this._emit({ type: 'steer', left: next.left, right: next.right });
      return { ok: true };
    },

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 0.25) dt = 0.25; // 防大跳帧
      this._clock += dt;

      this._updateDepth(dt);
      this._updateOxygen(dt);
      this._updatePlayer(dt);
      this._updateSpawning(dt);
      this._moveEntities(dt);
      this._updateVents(dt);
      this._updateChaser(dt);
      this._checkCollisions(dt);
      this._checkWinLose();
      this._heartbeat(dt);
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        depth: Math.floor(s.depth),
        depthTarget: s.depthTarget,
        oxygen: Math.max(0, s.oxygen),
        oxygenMax: s.oxygenMax,
        samples: s.samples,
        sampleTotal: s.sampleTotal,
        phase: s.phase,
        lightRadius: s.lightRadius,
        current: s.current,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _updatePlayer(dt) {
      const s = this.state;
      const p = s.player;
      // 竖直：按住上浮，松开下沉；主动俯冲额外加速下潜
      let vy = this._input.thrust ? -GAME.RISE_SPEED : GAME.SINK_SPEED;
      if (this._input.dive) vy += s.diveSpeed * 0.5;
      p.vy = vy;
      p.y += vy * dt;
      // 水平：微调 + 洋流漂移（stabilizer 减半）
      let hx = 0;
      if (this._input.left) hx -= GAME.STEER_SPEED;
      if (this._input.right) hx += GAME.STEER_SPEED;
      const stab = s.modules.stabilizer ? 0.5 : 1;
      hx += s.current * stab;
      p.x += hx * dt;
      p.x = clamp(p.x, LAYOUT.PLAY_X0 + p.r, LAYOUT.PLAY_X1 - p.r);
      p.y = clamp(p.y, LAYOUT.PLAY_Y0 + p.r, LAYOUT.PLAY_Y1 - p.r);
    },

    _updateDepth(dt) {
      const s = this.state;
      s.depth += (s.diveSpeed / GAME.DEPTH_SCALE) * dt;
      if (s.depth >= this._depthTickAt) {
        this._emit({ type: 'depthTick', depth: Math.floor(s.depth) });
        this._depthTickAt += 20;
      }
      // 洋流（双洋流方向交替）
      const dir = this._level.currentDir === 2
        ? (Math.floor(this._clock / 6) % 2 === 0 ? 1 : -1)
        : this._level.currentDir;
      s.current = dir * this._level.currentSpeed;
      // 层切换（签名：头灯扫开黑暗 + 生物群被惊散）
      const newLayer = clamp(Math.floor(s.depth / (s.depthTarget / 3)), 0, 2);
      if (newLayer !== s.layer) {
        s.layer = newLayer;
        this._emit({ type: 'layerChange', layer: newLayer });
        this._emit({ type: 'scatter', layer: newLayer });
        this._emit({ type: 'sonar' });
      }
    },

    _updateOxygen(dt) {
      const s = this.state;
      const pressureMult = this._level.pressure
        ? 1 + this._level.pressureFactor * (s.depth / Math.max(1, s.depthTarget))
        : 1;
      s.oxygen -= GAME.OXYGEN_BASE_DRAIN * pressureMult * dt;
      if (!this._oxygenLowEmitted && s.oxygen > 0 && s.oxygen <= s.oxygenMax * 0.3) {
        this._oxygenLowEmitted = true;
        this._emit({ type: 'oxygenLow', oxygen: s.oxygen });
      }
    },

    _updateSpawning(dt) {
      const s = this.state;
      const lv = this._level;
      this._spawnClock += dt;
      if (this._spawnClock >= lv.spawnGap) {
        this._spawnClock = 0;
        this._spawnHazard();
      }
      // 样本按深度触发（到达即生成，保证本关样本数）
      if (this._nextSampleIdx < this._level.sampleTotal && s.depth >= this._sampleDepths[this._nextSampleIdx]) {
        this._spawnSample();
        this._nextSampleIdx += 1;
      }
      // 氧气罐
      if (!this._oxygenSpawned && oxygenDepth > 0 && s.depth >= oxygenDepth) {
        this._oxygenSpawned = true;
        this._spawnOxygen();
      }
      // 追逐者（40% 深度触发一次）
      if (lv.chaser && !this._chaserSpawned && s.depth >= s.depthTarget * 0.4) {
        this._chaserSpawned = true;
        this._spawnChaser();
      }
      // 热泉周期
      if (lv.vent) {
        this._ventClock += dt;
        if (this._ventClock >= 4.2) {
          this._ventClock = 0;
          this._spawnVent();
        }
      }
    },

    _blockedLaneSet(numBlocked) {
      const maxStart = GAME.LANE_X.length - numBlocked;
      const start = Math.floor(this._rng() * (maxStart + 1));
      const set = new Set();
      for (let i = start; i < start + numBlocked; i += 1) set.add(i);
      return set;
    },

    _spawnHazard() {
      const s = this.state;
      const lv = this._level;
      const numBlocked = 1 + Math.floor(this._rng() * lv.maxBlocked);
      const blocked = this._blockedLaneSet(numBlocked);
      this._lastBlockedLanes = [...blocked];
      const y = WORLD.HEIGHT + 60;
      for (const lane of blocked) {
        const x = GAME.LANE_X[lane] + (this._rng() * 2 - 1) * 26;
        let kind = lv.hazard;
        if (kind === 'mix') kind = this._rng() < 0.5 ? 'rock' : 'mine';
        if (kind === 'mine') {
          s.obstacles.push({ kind: 'mine', x, y, r: 24, passed: false });
          this._emit({ type: 'mine', x, y });
        } else {
          s.obstacles.push({ kind: 'rock', x, y, r: 50 + this._rng() * 18, passed: false });
        }
      }
    },

    _freeLane(preferNear = null) {
      const s = this.state;
      const blockedSet = new Set(this._lastBlockedLanes);
      const free = GAME.LANE_X.map((_, i) => i).filter((i) => !blockedSet.has(i));
      if (!free.length) return Math.floor(GAME.LANE_X.length / 2);
      if (preferNear != null) {
        free.sort((a, b) => Math.abs(GAME.LANE_X[a] - preferNear) - Math.abs(GAME.LANE_X[b] - preferNear));
      }
      return free[0];
    },

    _spawnSample() {
      const s = this.state;
      const lane = this._freeLane();
      const x = GAME.LANE_X[lane] + (this._rng() * 2 - 1) * 30;
      const y = WORLD.HEIGHT + 110;
      s.pickups.push({ kind: 'sample', x, y, r: 22, taken: false });
    },

    _spawnOxygen() {
      const s = this.state;
      const lane = this._freeLane();
      const x = GAME.LANE_X[lane];
      s.pickups.push({ kind: 'oxygen', x, y: WORLD.HEIGHT + 150, r: 20, taken: false });
    },

    _spawnChaser() {
      const s = this.state;
      s.chaser = { kind: 'chaser', x: GAME.LANE_X[2], y: WORLD.HEIGHT + 120, r: 34, passed: false };
      this._emit({ type: 'chaser' });
    },

    _spawnVent() {
      const s = this.state;
      const lane = Math.floor(this._rng() * GAME.LANE_X.length);
      const x = GAME.LANE_X[lane];
      s.vents.push({ kind: 'vent', x, y: WORLD.HEIGHT + 60, w: 92, h: 300, entered: false });
    },

    _moveEntities(dt) {
      const s = this.state;
      const scroll = s.diveSpeed;
      for (const o of s.obstacles) o.y -= scroll * dt;
      for (const p of s.pickups) p.y -= scroll * dt;
      for (const v of s.vents) v.y -= scroll * dt;
      // 清理出屏
      s.obstacles = s.obstacles.filter((o) => o.y > -120);
      s.pickups = s.pickups.filter((p) => p.y > -120 && !p.taken);
      s.vents = s.vents.filter((v) => v.y > -v.h);
    },

    _updateVents(dt) {
      const s = this.state;
      const p = s.player;
      for (const v of s.vents) {
        const inside = p.x >= v.x - v.w / 2 && p.x <= v.x + v.w / 2 && p.y >= v.y - v.h && p.y <= v.y;
        if (inside) {
          p.y -= GAME.VENT_FORCE * dt;
          if (!v.entered) { v.entered = true; this._emit({ type: 'vent' }); }
        } else if (v.entered && p.y < v.y - v.h) {
          v.entered = false;
        }
      }
    },

    _updateChaser(dt) {
      const s = this.state;
      if (!s.chaser) return;
      const c = s.chaser;
      c.y -= (s.diveSpeed + 70) * dt;
      c.x += clamp(s.player.x - c.x, -1, 1) * 130 * dt;
      c.x = clamp(c.x, LAYOUT.PLAY_X0, LAYOUT.PLAY_X1);
      if (c.y < -140) s.chaser = null;
    },

    _checkCollisions(dt) {
      const s = this.state;
      const p = s.player;
      // 拾取（样本 / 氧气罐；magnet 磁吸）
      for (const pk of s.pickups) {
        if (pk.taken) continue;
        const dx = pk.x - p.x;
        const dy = pk.y - p.y;
        const d = Math.hypot(dx, dy);
        if (s.modules.magnet && d < 130 && d > p.r + pk.r) {
          pk.x -= dx * 2.2 * dt;
          pk.y -= dy * 2.2 * dt;
        }
        if (d < p.r + pk.r) {
          pk.taken = true;
          if (pk.kind === 'sample') {
            s.samples += 1;
            this._emit({ type: 'sample', samples: s.samples });
            if (s.samples >= s.sampleTotal && !this._sampleStarEmitted) {
              this._sampleStarEmitted = true;
              this._emit({ type: 'sampleStar', samples: s.samples });
            }
          } else {
            s.oxygen = Math.min(s.oxygenMax, s.oxygen + s.oxygenMax * 0.35);
            this._emit({ type: 'oxygenPickup', oxygen: s.oxygen });
          }
        }
      }

      // 致命物碰撞 / 擦肩
      for (const o of [...s.obstacles]) {
        const d = dist(o.x, o.y, p.x, p.y);
        if (d < p.r + o.r) {
          if (s.modules.shield) {
            s.modules.shield = false;
            s.obstacles = s.obstacles.filter((x) => x !== o);
            this._emit({ type: 'shield' });
            continue;
          }
          this._lose('crush', o.x, o.y);
          return;
        }
        if (!o.passed && o.y <= p.y) {
          o.passed = true;
          if (Math.abs(o.x - p.x) < GAME.NEAR_MISS_DIST) this._emit({ type: 'nearMiss' });
        }
      }
      if (s.chaser) {
        const c = s.chaser;
        const d = dist(c.x, c.y, p.x, p.y);
        if (d < p.r + c.r) {
          if (s.modules.shield) {
            s.modules.shield = false;
            s.chaser = null;
            this._emit({ type: 'shield' });
          } else {
            this._lose('crush', c.x, c.y);
            return;
          }
        }
      }
    },

    _checkWinLose() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      if (s.oxygen <= 0) { this._lose('suffocation', null, null); return; }
      if (s.depth >= s.depthTarget) this._win();
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const stars = 1
        + (s.samples >= s.sampleTotal ? 1 : 0)
        + (s.oxygen >= s.oxygenMax * GAME.TIME_STAR_RATIO ? 1 : 0);
      s.stars = stars;
      s.result = { won: true, stars, samples: s.samples, sampleTotal: s.sampleTotal, depth: Math.floor(s.depth), oxygen: s.oxygen };
      this._emit({ type: 'win', stars, samples: s.samples, depth: Math.floor(s.depth) });
    },

    _lose(reason, x, y) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, samples: s.samples, sampleTotal: s.sampleTotal, depth: Math.floor(s.depth), oxygen: s.oxygen };
      this._emit({ type: reason === 'crush' ? 'crush' : 'suffocate', reason, x: x ?? null, y: y ?? null });
      this._emit({ type: 'lose', reason });
    },

    _heartbeat(dt) {
      // 声呐心跳：保证事件密度（maxEventGap ≤ ~1s）
      this._sonarClock += dt;
      if (this._sonarClock >= 1.0) {
        this._sonarClock = 0;
        this._emit({ type: 'sonar' });
      }
    },
  };

  return run;
}

// ------------------------------------------------------------------ 兼容别名
export function createSim() {
  return createRun(0, { seed: 1 });
}
