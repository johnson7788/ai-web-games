// Sprout Hop · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 玩法：拖拽蓄力瞄准 → 松手豌豆沿抛物线跳出 → 落台得分（中心完美判定）→ 落水/出界判负。
// 世界水平滚动：每次成功落台后 camX 平移，使当前平台回到 ANCHOR.X。
// 依赖：config/game.config.js（PHYS/ANCHOR/TOP0/WATER_Y/PLAY）、config/levels.js（LEVELS/BOOST）、level.js。
// 随机：注入 seed（mulberry32），可复现。
// 契约：docs/DELIVERY.md 与 README 描述 createRun API / state 形状 / 事件表。

import { LEVELS, BOOST } from '../../config/levels.js';
import { PHYS, ANCHOR, TOP0, WATER_Y, PLAY, STEP } from '../../config/game.config.js';
import { generatePlatforms, platformScreenX, platformTopY, clampSpeed, LAND_TOL } from './level.js';

const EDGE = 6; // 平台左右各留的落点安全边（px）

// ---------------------------------------------------------------- createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const platforms = generatePlatforms(level, seed);

  const state = {
    level: level.index,
    scene: level.scene,
    phase: 'aiming',          // 'aiming' | 'flying' | 'won' | 'lost'
    score: 0,
    jumps: 0,                 // 本关成功落台数
    goalJumps: level.goalJumps,
    combo: 0,
    perfects: 0,
    relivesUsed: 0,
    maxRelives: PLAY.MAX_RELIVES,
    nextBoost: 1,             // 上一平台落地后的下一跳倍率
    wind: level.wind ?? 1,
    platforms,
    cur: 0,                   // 当前平台下标
    camX: ANCHOR.X,           // 首平台 wx=0 → 屏幕 x = ANCHOR.X
    pea: { x: ANCHOR.X, y: ANCHOR.Y, vx: 0, vy: 0, prevY: ANCHOR.Y },
    aiming: { active: false, drag: { x: 0, y: 0 }, power: 0 },
    collapseT: 0,             // 断藤倒计时
    collapsed: false,         // 当前平台是否已塌
    stars: 0,
    result: null,
    clock: 0,
  };

  const run = {
    state,
    _level: level,
    _events: [],
    _flightTickAcc: 0,
    _eventSeq: 0,

    // ---- 拖拽蓄力（human 输入边沿）----
    aimStart() {
      const s = this.state;
      if (s.phase !== 'aiming') return { ok: false, reason: 'phase' };
      s.aiming.active = true;
      s.aiming.drag = { x: 0, y: 0 };
      s.aiming.power = 0;
      this._emit({ type: 'aim' });
      return { ok: true };
    },

    aimSet(drag) {
      const s = this.state;
      if (!s.aiming.active || s.phase !== 'aiming') return { ok: false, reason: 'phase' };
      let dx = Number(drag?.x) || 0;
      let dy = Number(drag?.y) || 0;
      const len = Math.hypot(dx, dy);
      if (len > PHYS.MAX_DRAG) {
        const k = PHYS.MAX_DRAG / len;
        dx *= k;
        dy *= k;
      }
      s.aiming.drag = { x: dx, y: dy };
      s.aiming.power = Math.min(1, Math.hypot(dx, dy) / PHYS.MAX_DRAG);
      return { ok: true, power: s.aiming.power };
    },

    // ---- 松手跳（speed 为原始初速度，内部再乘 nextBoost × wind）----
    launch(speed) {
      const s = this.state;
      if (s.phase !== 'aiming') return { ok: false, reason: 'phase' };
      const raw = clampSpeed({ x: Number(speed?.x) || 0, y: Number(speed?.y) || 0 });
      if (raw.x <= PHYS.MIN_FORWARD) return { ok: false, reason: 'backward' };
      const boost = s.nextBoost ?? 1;
      const wind = s.wind ?? 1;
      const vx = raw.x * boost * wind;
      const vy = raw.y * boost * wind;
      s.pea.vx = vx;
      s.pea.vy = vy;
      s.pea.prevY = s.pea.y;
      s.nextBoost = 1;
      s.collapseT = 0;
      s.collapsed = false;
      s.aiming.active = false;
      s.aiming.power = 0;
      s.phase = 'flying';
      this._flightTickAcc = 0;
      this._emit({ type: 'launch', vx: Math.round(vx), vy: Math.round(vy) });
      return { ok: true };
    },

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      s.clock += dt;

      if (s.phase === 'aiming') {
        if (s.collapseT > 0) {
          s.collapseT -= dt;
          if (s.collapseT <= 0) this._collapse();
        }
        return;
      }

      // flying：抛物线积分
      const p = s.pea;
      p.prevY = p.y;
      p.vy += PHYS.GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 细粒度飞行反馈（保持事件密度、视觉水花同步）
      this._flightTickAcc += dt;
      while (this._flightTickAcc >= 0.1) {
        this._flightTickAcc -= 0.1;
        this._emit({ type: 'flightTick', x: Math.round(p.x), y: Math.round(p.y) });
      }

      // 落台判定（只判前进方向 cur 之后的平台）
      for (let i = s.cur + 1; i < s.platforms.length; i += 1) {
        if (this._tryLand(i)) return;
      }

      // 落水 / 出界
      if (p.y >= WATER_Y) return this._lose(s.collapsed ? 'collapse' : 'water');
      if (p.x < 30 || p.x > 1250) return this._lose('oob');
    },

    // ---- 复活 / 放弃 ----
    revive() {
      const s = this.state;
      if (s.phase !== 'lost') return { ok: false, reason: 'phase' };
      if (s.relivesUsed >= s.maxRelives) return { ok: false, reason: 'max' };
      s.relivesUsed += 1;
      this._resetPea();
      s.phase = 'aiming';
      s.collapsed = false;
      s.collapseT = 0;
      this._emit({ type: 'revive', relivesUsed: s.relivesUsed });
      return { ok: true };
    },

    denyRevive() {
      const s = this.state;
      if (s.phase !== 'lost') return { ok: false, reason: 'phase' };
      s.result = { won: false, stars: 0, score: s.score, jumps: s.jumps, reason: s.result?.reason || 'water' };
      this._emit({ type: 'gameOver', reason: s.result.reason });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        score: s.score,
        jumps: s.jumps,
        goalJumps: s.goalJumps,
        combo: s.combo,
        perfects: s.perfects,
        relivesLeft: Math.max(0, s.maxRelives - s.relivesUsed),
        nextBoost: s.nextBoost,
        wind: s.wind,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) {
      e.seq = this._eventSeq++;
      this._events.push(e);
    },

    _resetPea() {
      const s = this.state;
      const wy = s.platforms[s.cur].wy;
      s.camX = ANCHOR.X - s.platforms[s.cur].wx;
      s.pea.x = ANCHOR.X;
      s.pea.y = TOP0 + wy - PHYS.PEA_R;
      s.pea.vx = 0;
      s.pea.vy = 0;
      s.pea.prevY = s.pea.y;
      s.nextBoost = 1;
    },

    _collapse() {
      const s = this.state;
      s.collapsed = true;
      s.collapseT = 0;
      s.platforms[s.cur].broken = true; // 渲染层据此画「塌陷」
      s.pea.vx = 0;
      s.pea.vy = 0;
      s.pea.prevY = s.pea.y;
      s.phase = 'flying';
      this._emit({ type: 'collapse' });
    },

    _tryLand(i) {
      const s = this.state;
      const plat = s.platforms[i];
      const sx = platformScreenX(plat, s.camX, s.clock);
      const topY = platformTopY(plat);
      const restY = topY - PHYS.PEA_R;
      const half = plat.w / 2 - EDGE;
      const p = s.pea;
      if (p.x < sx - half || p.x > sx + half) return false;
      if (p.vy < 0) return false;                       // 上升段不落台
      // 落台宽容带：中心进入静止线 ±LAND_TOL 即落台（对浅弧/边缘更宽容，也抵消离散积分误差）
      if (p.y < restY - LAND_TOL) return false;          // 仍明显高于平台
      if (p.y > restY + LAND_TOL) return false;          // 明显低于平台（从下方穿过不算）

      const centerOff = Math.abs(p.x - sx);
      this._land(i, centerOff, plat);
      return true;
    },

    _land(i, centerOff, plat) {
      const s = this.state;
      const w = plat.w;
      const perfect = centerOff <= w * PLAY.PERFECT_RATIO;
      const near = !perfect && centerOff <= w * PLAY.NEAR_RATIO;

      s.jumps += 1;
      s.cur = i;
      s.camX = ANCHOR.X - plat.wx;

      // 先按飞行落点算分，再吸附到锚点
      let gained = PLAY.BASE_SCORE;
      if (perfect) {
        gained += PLAY.PERFECT_BONUS;
        s.combo += 1;
        s.perfects += 1;
        this._emit({ type: 'perfect', combo: s.combo, centerOff: Math.round(centerOff) });
      } else {
        s.combo = 0;
      }
      if (near) {
        gained += PLAY.NEAR_BONUS;
        this._emit({ type: 'nearMiss', centerOff: Math.round(centerOff) });
      }
      s.score += gained;
      this._emit({ type: 'land', i, perfect, near, gained, score: s.score, kind: plat.kind });
      this._emit({ type: 'score', score: s.score });
      if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo });

      // 平台特性：南瓜回弹 / 竹筐吸力 / 断藤倒计时
      s.nextBoost = BOOST[plat.kind] ?? 1;
      if (plat.broken) {
        s.collapseT = PLAY.COLLAPSE_S;
        this._emit({ type: 'brokenLanded' });
      }

      // 吸附
      s.pea.x = ANCHOR.X;
      s.pea.y = TOP0 + plat.wy - PHYS.PEA_R;
      s.pea.vx = 0;
      s.pea.vy = 0;
      s.pea.prevY = s.pea.y;
      s.aiming.active = false;
      s.phase = 'aiming';

      if (s.jumps >= s.goalJumps) this._win();
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      let stars = 1;
      if (s.relivesUsed === 0) stars += 1;
      if (s.perfects >= (this._level.perfectGoal ?? 1)) stars += 1;
      s.stars = stars;
      s.result = { won: true, stars, score: s.score, jumps: s.jumps, perfects: s.perfects };
      this._emit({ type: 'win', stars, score: s.score, perfects: s.perfects });
      this._emit({ type: 'levelClear', level: s.level, stars });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, score: s.score, jumps: s.jumps, reason };
      this._emit({ type: 'lose', reason, score: s.score, jumps: s.jumps });
    },
  };

  return run;
}

export { STEP };
