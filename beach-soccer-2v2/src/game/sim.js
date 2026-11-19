// BEACH SOCCER 2V2 · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 玩法：拖拽球 → 松手踢出 → 球受重力/反弹/弹力垫飞行 → 沿途吃星/吃能量球 → 落入球门获胜。
// 失败：踢球次数（par）用完仍未进球。
// 随机：seed 注入 mulberry32（本作关卡静态，RNG 预留给未来地形抖动）。
// 契约：createRun(levelIndex, opts) / run.step(dt) / run.flick(vx,vy) / run.drainEvents() / run.getHud()。

import { WORLD, PHYS, RULES } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';

const R = WORLD.BALL_R;

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

// 圆 vs 矩形（中心 + 全宽/高）：把球推出并反射。返回是否发生碰撞。
function collideCircleRect(b, rc) {
  const hw = rc.w / 2;
  const hh = rc.h / 2;
  const cx = clamp(b.x, rc.x - hw, rc.x + hw);
  const cy = clamp(b.y, rc.y - hh, rc.y + hh);
  let dx = b.x - cx;
  let dy = b.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= R * R) return false;
  const d = Math.sqrt(d2);
  let nx;
  let ny;
  if (d > 1e-6) {
    nx = dx / d;
    ny = dy / d;
    b.x = cx + nx * R;
    b.y = cy + ny * R;
  } else {
    // 球心在矩形内部：沿最小穿透方向推出
    const pl = (rc.x + hw) - b.x;
    const pr = b.x - (rc.x - hw);
    const pt = b.y - (rc.y - hh);
    const pb = (rc.y + hh) - b.y;
    const m = Math.min(pl, pr, pt, pb);
    if (m === pl) { nx = -1; ny = 0; }
    else if (m === pr) { nx = 1; ny = 0; }
    else if (m === pt) { nx = 0; ny = 1; }
    else { nx = 0; ny = -1; }
    b.x = rc.x + nx * (hw + R);
    b.y = rc.y + ny * (hh + R);
  }
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + PHYS.RESTITUTION) * vn * nx;
    b.vy -= (1 + PHYS.RESTITUTION) * vn * ny;
  }
  return true;
}

// 圆 vs 圆（弹力垫）：推出并放大速度。
function collideCircle(b, c) {
  const rr = R + c.r;
  let dx = b.x - c.x;
  let dy = b.y - c.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return false;
  const d = Math.sqrt(d2) || 1e-6;
  let nx = dx / d;
  let ny = dy / d;
  // 球心重合时给个向上法向兜底
  if (d2 < 1e-6) { nx = 0; ny = 1; }
  b.x = c.x + nx * rr;
  b.y = c.y + ny * rr;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + PHYS.RESTITUTION) * vn * nx;
    b.vy -= (1 + PHYS.RESTITUTION) * vn * ny;
  }
  // 弹力垫：放大速度（封顶）
  let sp = Math.hypot(b.vx, b.vy);
  sp = Math.min(PHYS.MAX_SPEED, sp * PHYS.BOUNCE_BOOST);
  const cur = Math.hypot(b.vx, b.vy) || 1;
  b.vx = (b.vx / cur) * sp;
  b.vy = (b.vy / cur) * sp;
  return true;
}

function insideRect(x, y, rc) {
  return x >= rc.x - rc.w / 2 && x <= rc.x + rc.w / 2 &&
         y >= rc.y - rc.h / 2 && y <= rc.y + rc.h / 2;
}

// ---- 单步物理推进（供 run.step 与模拟解算器共用，保证解算与真实完全一致）----
// b: { x, y, vx, vy, active, slowFrames, flight }
// level: LEVELS[i]（带派生几何）
// out: 事件数组（push {type,...}）；返回 'fly' | 'goal' | 'settle'
function stepBall(b, level, dt, out) {
  b.vy -= PHYS.GRAVITY * dt;
  b.vx *= PHYS.AIR_DRAG;
  b.vy *= PHYS.AIR_DRAG;

  let sp = Math.hypot(b.vx, b.vy);
  if (sp > PHYS.MAX_SPEED) { const k = PHYS.MAX_SPEED / sp; b.vx *= k; b.vy *= k; sp = PHYS.MAX_SPEED; }

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.flight += dt;

  // 地面（沙面）
  if (b.y < WORLD.GROUND_Y + R) {
    b.y = WORLD.GROUND_Y + R;
    if (b.vy < 0) {
      b.vy = -b.vy * PHYS.RESTITUTION;
      if (Math.abs(b.vy) > 24) out.push({ type: 'bounce', surface: 'ground' });
    }
    b.vx *= PHYS.ROLL_DRAG;
  }

  // 世界边界（左右/顶）
  const HW = WORLD.WIDTH / 2;
  const HH = WORLD.HEIGHT / 2;
  if (b.x < -HW + R) { b.x = -HW + R; if (b.vx < 0) { b.vx = -b.vx * PHYS.RESTITUTION; out.push({ type: 'bounce', surface: 'wall' }); } }
  if (b.x > HW - R) { b.x = HW - R; if (b.vx > 0) { b.vx = -b.vx * PHYS.RESTITUTION; out.push({ type: 'bounce', surface: 'wall' }); } }
  if (b.y > HH - R) { b.y = HH - R; if (b.vy > 0) { b.vy = -b.vy * PHYS.RESTITUTION; out.push({ type: 'bounce', surface: 'wall' }); } }

  // 实心障碍
  for (const w of level.walls) {
    if (collideCircleRect(b, w)) out.push({ type: 'bounce', surface: 'box' });
  }

  // 弹力垫
  for (const c of level.bumpers) {
    if (collideCircle(b, c)) out.push({ type: 'bumper' });
  }

  // 球门触发
  if (insideRect(b.x, b.y, level.goal)) return 'goal';

  // 停球判定
  if (sp < PHYS.SETTLE_SPEED) {
    b.slowFrames += 1;
    if (b.slowFrames >= PHYS.SETTLE_FRAMES) return 'settle';
  } else {
    b.slowFrames = 0;
  }
  if (b.flight >= PHYS.MAX_FLIGHT) return 'settle';

  return 'fly';
}

// ---- 把一记球的轨迹模拟出来（解算器/自对弈用，纯几何、无事件语义）----
export function simulateShot(level, x0, y0, vx0, vy0, opts = {}) {
  const dt = opts.dt || (1 / 60);
  const maxT = opts.maxT || PHYS.MAX_FLIGHT;
  const b = { x: x0, y: y0, vx: vx0, vy: vy0, active: true, slowFrames: 0, flight: 0 };
  const stars = level.stars.map((s) => ({ ...s, taken: false }));
  const mega = level.mega.map((m) => ({ ...m, taken: false }));
  const res = { reachedGoal: false, stars: 0, starsHit: [], mega: false, bumper: false, settleX: x0, settleY: y0, t: 0, bounces: 0, watchDist: Infinity, watchHit: false };
  const watch = opts.watch || null;
  const out = [];
  let status = 'fly';
  for (let t = 0; t < maxT; t += dt) {
    status = stepBall(b, level, dt, out);
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      if (!s.taken && Math.hypot(b.x - s.x, b.y - s.y) < R + s.r) { s.taken = true; res.stars += 1; res.starsHit.push(i); }
    }
    for (const m of mega) {
      if (!m.taken && Math.hypot(b.x - m.x, b.y - m.y) < R + m.r) { m.taken = true; res.mega = true; }
    }
    for (const e of out) { if (e.type === 'bumper') res.bumper = true; if (e.type === 'bounce') res.bounces += 1; }
    out.length = 0;
    if (watch) {
      const d = Math.hypot(b.x - watch.x, b.y - watch.y) - R - watch.r;
      if (d < res.watchDist) res.watchDist = d;
      if (d <= 0) res.watchHit = true;
    }
    if (status === 'goal') { res.reachedGoal = true; break; }
    if (status === 'settle') break;
  }
  res.settleX = b.x;
  res.settleY = b.y;
  res.t = Math.min(maxT, b.flight);
  return res;
}

// ---- createRun ----
export function createRun(levelIndex = 0, opts = {}) {
  const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, levelIndex | 0));
  const level = LEVELS[idx];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    level: idx + 1,           // 1 基
    phase: 'playing',         // playing | won | lost
    ball: {
      x: level.tee.x,
      y: level.tee.y,
      vx: 0,
      vy: 0,
      active: false,
      slowFrames: 0,
      flight: 0,
    },
    shotsUsed: 0,
    shotsLeft: level.par,
    stars: 0,
    starTotal: level.stars.length,
    combo: 0,
    bestCombo: 0,
    lastStarTime: -9e9,
    mega: false,
    time: 0,
    starScore: 0,
    timeStars: 0,
    total: 0,
    result: null,
  };

  const run = {
    state,
    // 每局独立的关卡副本：星/能量球要按局记 taken，不能污染共享 LEVELS
    _level: {
      ...level,
      stars: level.stars.map((s) => ({ ...s, taken: false })),
      mega: level.mega.map((m) => ({ ...m, taken: false })),
    },
    _rng: rng,
    _events: [],
    _pendingAim: null,

    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      s.time += dt;

      const b = s.ball;
      if (!b.active) return;

      const status = stepBall(b, this._level, dt, this._events);

      // 吃星
      for (const star of this._level.stars) {
        if (star.taken) continue;
        if (Math.hypot(b.x - star.x, b.y - star.y) < R + star.r) {
          star.taken = true;
          s.stars += 1;
          if (s.time - s.lastStarTime <= RULES.COMBO_WINDOW) s.combo += 1;
          else s.combo = 1;
          s.lastStarTime = s.time;
          if (s.combo > s.bestCombo) s.bestCombo = s.combo;
          s.starScore += RULES.STAR_SCORE * s.combo;
          this._events.push({ type: 'star', stars: s.stars, combo: s.combo, starScore: s.starScore });
          this._events.push({ type: 'combo', combo: s.combo });
        }
      }
      // 吃能量球
      for (const m of this._level.mega) {
        if (m.taken) continue;
        if (Math.hypot(b.x - m.x, b.y - m.y) < R + m.r) {
          m.taken = true;
          s.mega = true;
          this._events.push({ type: 'mega' });
        }
      }

      if (status === 'goal') this._win();
      else if (status === 'settle') {
        b.active = false;
        b.vx = 0;
        b.vy = 0;
        b.slowFrames = 0;
        b.flight = 0;
        this._events.push({ type: 'settle', x: b.x, y: b.y });
        // 用尽踢球次数且未进球 → 失败
        if (s.shotsLeft <= 0) this._lose();
      }
    },

    // 拖拽目标向量（发射速度）；带能量球时 ×2
    aim(vx, vy) {
      if (this.state.phase !== 'playing') return { ok: false, reason: 'phase' };
      this._pendingAim = { vx, vy };
      return { ok: true };
    },

    // 踢球：消耗一次机会并发射。返回 ok 与发射速度。
    flick(vx, vy) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.ball.active) return { ok: false, reason: 'inFlight' };
      if (s.shotsLeft <= 0) return { ok: false, reason: 'noShots' };
      const v = this._pendingAim || { vx, vy };
      let fvx = v.vx;
      let fvy = v.vy;
      let wasMega = false;
      if (s.mega) { fvx *= 2; fvy *= 2; s.mega = false; wasMega = true; }
      const sp = Math.hypot(fvx, fvy);
      if (sp < 20) return { ok: false, reason: 'tooWeak' };
      const cap = PHYS.MAX_SPEED;
      if (sp > cap) { const k = cap / sp; fvx *= k; fvy *= k; }
      s.ball.vx = fvx;
      s.ball.vy = fvy;
      s.ball.active = true;
      s.ball.slowFrames = 0;
      s.ball.flight = 0;
      s.shotsUsed += 1;
      s.shotsLeft -= 1;
      this._pendingAim = null;
      this._events.push({ type: 'shot', vx: fvx, vy: fvy, shotsLeft: s.shotsLeft });
      if (wasMega) this._events.push({ type: 'megaShot', mega: true });
      return { ok: true, vx: fvx, vy: fvy };
    },

    // 结算星级（完赛时调用）：时间星 + 星数（参考原作：时间星与收集星合并显示）
    _timeStarCount() {
      for (const t of RULES.TIME_STARS) if (this.state.time <= t.max) return t.stars;
      return 0;
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.ball.active = false;
      s.ball.vx = 0;
      s.ball.vy = 0;
      s.timeStars = this._timeStarCount();
      s.total = s.starScore + s.timeStars * RULES.STAR_SCORE;
      s.result = { won: true, stars: s.stars, starTotal: s.starTotal, timeStars: s.timeStars, total: s.total, time: s.time, combo: s.bestCombo };
      this._events.push({ type: 'win', stars: s.stars, timeStars: s.timeStars, total: s.total, time: s.time });
    },

    _lose() {
      const s = this.state;
      s.phase = 'lost';
      s.ball.active = false;
      s.ball.vx = 0;
      s.ball.vy = 0;
      s.result = { won: false, stars: s.stars, starTotal: s.starTotal, timeStars: 0, total: s.starScore, time: s.time, combo: s.bestCombo };
      this._events.push({ type: 'lose', stars: s.stars, reason: 'outOfShots' });
    },

    // 放弃/超时：用尽机会（自对弈 random 用）
    exhaust() {
      if (this.state.phase !== 'playing') return { ok: false };
      this.state.shotsLeft = 0;
      this._lose();
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        time: s.time,
        stars: s.stars,
        starTotal: s.starTotal,
        shotsLeft: s.shotsLeft,
        combo: s.combo,
        bestCombo: s.bestCombo,
        mega: s.mega,
        ballActive: s.ball.active,
        ball: { x: s.ball.x, y: s.ball.y },
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // 验收辅助：把球直接放进球门结算（仅用于截图/自测，不参与玩法路径）
    debugWin() {
      if (this.state.phase !== 'playing') return { ok: false };
      this.state.ball.x = this._level.goal.x;
      this.state.ball.y = this._level.goal.y;
      this.state.ball.active = false;
      this._win();
      return { ok: true };
    },
  };

  return run;
}

export { LEVEL_COUNT, LEVELS };
