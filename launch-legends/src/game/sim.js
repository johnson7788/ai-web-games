// LAUNCH LEGENDS · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：烟花弹自动弹跳、左右横移、撞层判定（云絮得分/充能、钢棚死亡或烧穿）、
//       炽热态、贴墙反弹、阵雨减速、移动云台、迷你烟花事件、星级结算、事件表。
// 依赖：config/levels.js（LEVELS）、config/game.config.js（WORLD/GAME）、./level.js（generateLevel）。
// 契约：createRun(levelIndex, opts) → run；run.step(dt)/setInput(dir)/getHud()/drainEvents()/revive()。
// 随机：关卡由 seed 注入 generateLevel，可复现。

import { WORLD, GAME } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';
import { generateLevel, mulberry32 } from './level.js';

export { mulberry32 } from './level.js';

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const gen = generateLevel(levelIndex, seed);

  const state = {
    level: level.index,
    levelIndex,
    scene: level.scene,
    phase: 'playing',        // 'playing' | 'won' | 'lost'
    x: WORLD.WIDTH / 2,
    dir: 0,                  // -1 左 / 0 / 1 右
    height: 0,               // 已爬升高度（米 = 分数）
    layerIndex: 0,           // 下一层待判定索引
    layers: gen.layers,
    corridor: gen.corridor,
    cols: gen.cols,
    segW: gen.segW,
    targetHeight: level.targetHeight,
    bounceT: 0,              // 0..1 弹跳相位（0/1=底，0.5=顶点=撞层判定）
    bounceDuration: GAME.BASE_BOUNCE,
    clouds: 0,
    combo: 0,
    bestCombo: 0,
    fuse: 0,                 // 0..FUSE_MAX 引信蓄能
    incandescent: false,     // 炽热态（无敌、可烧穿钢棚）
    incandescentT: 0,
    revived: false,
    wallBoostNow: false,
    cloudShift: 0,
    clock: 0,
    stars: 0,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _gen: gen,
    _events: [],
    _resolvedThisBounce: false,

    // ---- 横移输入（main 每帧调用；dir ∈ {-1,0,1}） ----
    setInput(dir) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const d = dir > 0 ? 1 : dir < 0 ? -1 : 0;
      if (d === s.dir) return { ok: false, reason: 'same' };
      s.dir = d;
      return { ok: true, dir: d };
    },

    // ---- 时间推进（固定步长由 main 累加器调用） ----
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 0.5) dt = 0.5; // 防大跳帧
      s.clock += dt;

      // 炽热态计时（结束 → 引信归零）
      if (s.incandescent) {
        s.incandescentT -= dt;
        if (s.incandescentT <= 0) {
          s.incandescent = false;
          s.incandescentT = 0;
          s.fuse = 0;
          this._emit({ type: 'incandescentEnd' });
        }
      }

      // 横移：输入 + 横风
      const wind = this._windAt();
      let nx = s.x + s.dir * GAME.MOVE_SPEED * dt + wind * dt;
      if (nx < 0) nx = 0;
      if (nx > WORLD.WIDTH) nx = WORLD.WIDTH;
      s.x = nx;

      // 移动云台水平偏移（供 render 与撞层判定共用）
      s.cloudShift = this._cloudShift();

      // 贴墙反弹判定（贴墙弹更高）
      s.wallBoostNow = !!(this._level.wallBounce && (s.x <= GAME.WALL_ZONE || s.x >= WORLD.WIDTH - GAME.WALL_ZONE));

      // 弹跳推进：中点为撞层判定
      const dur = this._bounceDuration();
      s.bounceT += dt / dur;
      if (!this._resolvedThisBounce && s.bounceT >= 0.5) {
        this._resolvedThisBounce = true;
        this._resolveLayer();
      }
      if (s.bounceT >= 1) {
        s.bounceT -= 1;
        this._resolvedThisBounce = false;
        if (s.phase === 'playing') this._emit({ type: 'bounce', height: s.height });
      }
    },

    // ---- 复活（SDK showRewarded 成功后 main 调用）：重新点燃并继续攀升 ----
    revive() {
      const s = this.state;
      if (s.phase !== 'lost') return { ok: false, reason: 'phase' };
      s.phase = 'playing';
      s.revived = true;
      s.incandescent = true;
      s.incandescentT = GAME.INCANDESCENT;
      s.fuse = GAME.FUSE_MAX;
      s.bounceT = 0.25;
      this._resolvedThisBounce = false;
      s.wallBoostNow = false;
      this._emit({ type: 'revive' });
      return { ok: true };
    },

    // ---- 供 selfplay / debug 使用的贪心自动驾驶：朝安全通道列对齐 ----
    autopilotStep() {
      const s = this.state;
      const col = s.corridor[s.layerIndex] ?? Math.floor(s.cols / 2);
      const cx = col * s.segW + s.segW / 2 + this._cloudShift();
      const dx = cx - s.x;
      const dead = s.segW * 0.12;
      let dir = 0;
      if (dx > dead) dir = 1;
      else if (dx < -dead) dir = -1;
      this.setInput(dir);
      return dir;
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        height: s.height,
        targetHeight: s.targetHeight,
        clouds: s.clouds,
        bestCombo: s.bestCombo,
        fuse: s.fuse,
        incandescent: s.incandescent,
        incandescentT: s.incandescentT,
        phase: s.phase,
        bouncePhase: s.bounceT,
        stars: s.stars,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _windAt() {
      return this._level.wind || 0;
    },

    _inRain(alt) {
      const bands = this._level.rainBands || [];
      return bands.some(([a, b]) => alt >= a && alt <= b);
    },

    _bounceDuration() {
      let dur = this.state.bounceDuration;
      if (this._inRain(this.state.layerIndex)) dur *= GAME.RAIN_SLOW;
      return Math.max(0.2, dur);
    },

    _cloudShift() {
      if (!this._level.movingClouds) return 0;
      return Math.sin(this.state.clock * GAME.CLOUD_SHIFT_RATE) * GAME.CLOUD_SHIFT_AMP;
    },

    _ignite() {
      const s = this.state;
      s.fuse = GAME.FUSE_MAX;
      s.incandescent = true;
      s.incandescentT = GAME.INCANDESCENT;
      this._emit({ type: 'fuseFull' });
      this._emit({ type: 'ignite' });
    },

    _resolveLayer() {
      const s = this.state;
      if (s.layerIndex >= s.layers.length) return;
      const layer = s.layers[s.layerIndex] || [];
      const shift = this._cloudShift();
      let col = Math.floor((s.x - shift) / s.segW);
      col = Math.max(0, Math.min(s.cols - 1, col));
      const seg = layer[col] ?? 'empty';
      const wallBoost = s.wallBoostNow ? 1 : 0;

      if (seg === 'empty') {
        this._emit({ type: 'pass', layer: s.layerIndex, height: s.height });
        s.combo = 0;
      } else if (seg === 'cloud') {
        s.clouds += 1;
        s.combo += 1;
        if (s.combo > s.bestCombo) s.bestCombo = s.combo;
        s.fuse = Math.min(GAME.FUSE_MAX, s.fuse + GAME.FUSE_PER_CLOUD);
        s.bounceDuration = Math.max(GAME.MIN_BOUNCE, s.bounceDuration * GAME.BOUNCE_STEP);
        this._emit({ type: 'cloudBreak', layer: s.layerIndex, x: s.x, clouds: s.clouds, combo: s.combo });
        if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo });
        if (s.fuse >= GAME.FUSE_MAX && !s.incandescent) this._ignite();
      } else {
        // steel
        if (s.incandescent) {
          this._emit({ type: 'steelBreak', layer: s.layerIndex, x: s.x });
        } else {
          this._emit({ type: 'crash', layer: s.layerIndex, x: s.x, height: s.height });
          this._lose('crash');
          return;
        }
      }

      s.layerIndex += 1;
      s.height += 1 + wallBoost;
      if (wallBoost) this._emit({ type: 'wallBounce', height: s.height });
      if (s.height > 0 && s.height % GAME.FIREWORK_EVERY === 0) this._emit({ type: 'firework', height: s.height });
      if (s.height > 0 && s.height % 10 === 0) this._emit({ type: 'height10', height: s.height });
      if (s.layerIndex >= s.targetHeight) this._win();
    },

    _stars() {
      const s = this.state;
      const cloudNeed = Math.ceil(this._level.targetHeight * GAME.STAR_CLOUD_RATIO);
      let stars = 1; // 通关
      if (s.clouds >= cloudNeed) stars += 1;
      if (!s.revived) stars += 1;
      return stars;
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.stars = this._stars();
      s.result = { won: true, height: s.height, clouds: s.clouds, stars: s.stars, bestCombo: s.bestCombo, revived: s.revived };
      this._emit({ type: 'win', height: s.height, clouds: s.clouds, stars: s.stars });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.stars = 0;
      s.result = { won: false, height: s.height, clouds: s.clouds, stars: 0, bestCombo: s.bestCombo, revived: s.revived };
      this._emit({ type: 'lose', reason, height: s.height });
    },
  };

  return run;
}
