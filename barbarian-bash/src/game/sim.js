// BARBARIAN BASH · 纯逻辑物理模拟（无 DOM，Node 可测 / selfplay 可跑）
// 坐标系 y 向下，重力 +y。玩家站在地面左端，拖拽瞄准投掷岩石，砸爆霓虹机器人。
// 事件流：level / aim / throw / hit / crit / kill / break / explode / bounce /
//         combo / captiveHit / win / lose（main 消费 → 音频 + 特效 + 教程推进）。
import { WORLD, STEP, THROW, PLAYER, COMBO } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 从手 (hx,hy) 以固定飞行时间 T 求解恰好命中 (tx,ty) 的初速（y 向下重力 +G）
function solveVelocity(hx, hy, tx, ty) {
  const dx = tx - hx;
  const dy = ty - hy;
  const dist = Math.hypot(dx, dy);
  const T = clamp(dist / 900, 0.35, 1.7);
  const vx = dx / T;
  const vy = dy / T - 0.5 * WORLD.GRAVITY * T;
  return { vx, vy };
}

function makeEnemy(cfg, id) {
  const cy = WORLD.GROUND_Y - cfg.h / 2;
  return {
    id,
    kind: 'enemy',
    cx: cfg.cx,
    cy,
    w: cfg.w,
    h: cfg.h,
    hp: cfg.hp,
    hpMax: cfg.hp,
    boss: !!cfg.boss,
    core: { dx: cfg.core.dx, dy: cfg.core.dy, r: cfg.core.r },
    alive: true,
    deadTimer: 0,
    // 移动巡逻（可选）
    moving: !!cfg.moving,
    moveX0: cfg.moveX0 ?? cfg.cx,
    moveX1: cfg.moveX1 ?? cfg.cx,
    moveSpeed: cfg.moveSpeed ?? 0,
    moveDir: cfg.moveDir ?? 1,
    flash: 0,
  };
}

function makeBarrier(cfg, id) {
  return {
    id,
    kind: 'barrier',
    type: cfg.type,
    cx: cfg.cx,
    cy: WORLD.GROUND_Y - cfg.h / 2,
    w: cfg.w,
    h: cfg.h,
    blastR: cfg.blastR || 0,
    alive: true,
    breakTimer: 0,
    flash: 0,
  };
}

function makeCaptive(cfg) {
  if (!cfg) return null;
  return {
    kind: 'captive',
    cx: cfg.cx,
    cy: WORLD.GROUND_Y - cfg.h / 2,
    w: cfg.w,
    h: cfg.h,
    alive: true,
    flash: 0,
  };
}

export function createRun(levelIndex, { seed = 1 } = {}) {
  const level = LEVELS[levelIndex];
  const rng = mulberry32(seed);
  const enemies = level.enemies.map(makeEnemy);
  const barriers = level.barriers.map(makeBarrier);
  const captive = makeCaptive(level.captive);

  const state = {
    level: levelIndex + 1,
    levelIndex,
    phase: 'playing',          // playing | won | lost
    ammoTotal: level.ammo,
    ammoLeft: level.ammo,
    timeLeft: level.timeLimit,
    score: 0,
    streak: 0,                 // 连击（连续击杀，未命中清零）
    bestStreak: 0,
    kills: 0,
    crits: 0,
    stars: 0,
    enemies,
    barriers,
    captive,
    boulders: [],              // 飞行中的岩石
    aim: { active: false, dx: 0, dy: 0, power: 0 },
    pending: null,             // bot/自瞄：{vx,vy}
    settleTimer: -1,           // 最后一名敌人死亡后的收尾计时
    events: [],
    result: null,
    rng,
  };

  const events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload });

  emit('level', { level: state.level });

  const hand = () => ({ x: PLAYER.HX, y: PLAYER.HY });

  function enemyAliveCount() {
    return state.enemies.filter((e) => e.alive).length;
  }

  function boulderRect() {
    return { r: THROW.BOULDER_R };
  }

  function hitEnemy(enemy, crit) {
    enemy.flash = 0.12;
    emit('hit', { id: enemy.id, crit, cx: enemy.cx, cy: enemy.cy });
    if (crit) {
      emit('crit', { id: enemy.id, cx: enemy.cx, cy: enemy.cy });
      enemy.hp = 0;
    } else {
      enemy.hp -= 1;
    }
    if (enemy.hp <= 0 && enemy.alive) {
      enemy.alive = false;
      enemy.deadTimer = 0.9;
      state.kills += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      const gain = COMBO.BASE + (state.streak - 1) * COMBO.PER_STREAK + (crit ? COMBO.CRIT_BONUS : 0);
      state.score += gain;
      if (crit) state.crits += 1;
      emit('kill', { id: enemy.id, cx: enemy.cx, cy: enemy.cy, streak: state.streak, gain, crit });
      if (state.streak >= 2) emit('combo', { combo: state.streak });
      if (enemyAliveCount() === 0) state.settleTimer = 0.55;
    }
  }

  function damageArea(cx, cy, radius, source) {
    // 对范围内敌人造成 1 点伤害；人质在范围内则死亡
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.cx - cx, e.cy - cy);
      if (d <= radius + Math.max(e.w, e.h) / 2) {
        hitEnemy(e, false);
      }
    }
    if (state.captive && state.captive.alive) {
      const d = Math.hypot(state.captive.cx - cx, state.captive.cy - cy);
      if (d <= radius + 40) {
        state.captive.alive = false;
        emit('captiveHit', { cx: state.captive.cx, cy: state.captive.cy });
        lose('captiveLost');
      }
    }
  }

  function breakBarrier(bar) {
    if (!bar.alive) return;
    bar.alive = false;
    bar.breakTimer = 0.6;
    if (bar.type === 'tnt') {
      emit('explode', { cx: bar.cx, cy: bar.cy, r: bar.blastR });
      // 连锁：范围内的其它 TNT 也被引爆
      const chain = state.barriers.filter((b) => b.alive && b.type === 'tnt' && b !== bar &&
        Math.hypot(b.cx - bar.cx, b.cy - bar.cy) <= bar.blastR + 40);
      for (const b of chain) breakBarrier(b);
      damageArea(bar.cx, bar.cy, bar.blastR, bar);
    } else {
      emit('break', { id: bar.id, barrierType: bar.type, cx: bar.cx, cy: bar.cy });
    }
  }

  function lose(reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'lost';
    state.result = { won: false, reason };
    emit('lose', { reason });
  }

  function win() {
    if (state.phase !== 'playing') return;
    state.phase = 'won';
    state.stars = starsForAmmo(state.ammoLeft);
    state.result = { won: true, stars: state.stars };
    emit('win', { stars: state.stars, score: state.score });
  }

  function starsForAmmo(left) {
    const lv = LEVELS[state.levelIndex];
    if (left >= lv.ammo - lv.tripleStar) return 3;
    if (left >= lv.ammo - lv.doubleStar) return 2;
    if (left >= lv.ammo - lv.singleStar) return 1;
    return 0;
  }

  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  }

  function removeBoulder(b) {
    if (b.kills === 0) state.streak = 0;   // 空投未命中 → 连击断
  }

  function stepBoulder(b, dt) {
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vy += WORLD.GRAVITY * dt;
    b.life -= dt;

    // 左右墙反弹
    if (b.x - THROW.BOULDER_R < 0) { b.x = THROW.BOULDER_R; b.vx = Math.abs(b.vx) * THROW.WALL_BOUNCE; emit('bounce', { wall: 'left' }); }
    else if (b.x + THROW.BOULDER_R > WORLD.WIDTH) { b.x = WORLD.WIDTH - THROW.BOULDER_R; b.vx = -Math.abs(b.vx) * THROW.WALL_BOUNCE; emit('bounce', { wall: 'right' }); }
    // 天花板反弹
    if (b.y - THROW.BOULDER_R < 0) { b.y = THROW.BOULDER_R; b.vy = Math.abs(b.vy) * THROW.WALL_BOUNCE; emit('bounce', { wall: 'top' }); }
    // 地面：高速反弹一次，低速落地消亡
    if (b.y + THROW.BOULDER_R > WORLD.GROUND_Y) {
      b.y = WORLD.GROUND_Y - THROW.BOULDER_R;
      if (Math.abs(b.vy) > 260) { b.vy = -Math.abs(b.vy) * THROW.FLOOR_BOUNCE; emit('bounce', { wall: 'floor' }); }
      else { b.vy = 0; b.life = Math.min(b.life, 0.25); }
    }

    // 敌人碰撞
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (circleRect(b.x, b.y, THROW.BOULDER_R, e.cx - e.w / 2, e.cy - e.h / 2, e.w, e.h)) {
        const cx = e.cx + e.core.dx;
        const cy = e.cy + e.core.dy;
        // 暴击 = 岩石速度线（延长线）穿过核心圆：瞄准发光核心即暴击
        const vel = Math.hypot(b.vx, b.vy) || 1;
        const cross = Math.abs(b.vx * (cy - b.y) - b.vy * (cx - b.x));
        const perp = cross / vel;
        const crit = perp <= e.core.r + THROW.BOULDER_R;
        b.kills += 1;
        hitEnemy(e, crit);
        b.life = 0;
        return;
      }
    }

    // 障碍碰撞
    for (const bar of state.barriers) {
      if (!bar.alive) continue;
      if (circleRect(b.x, b.y, THROW.BOULDER_R, bar.cx - bar.w / 2, bar.cy - bar.h / 2, bar.w, bar.h)) {
        breakBarrier(bar);
        b.life = 0;
        return;
      }
    }

    // 人质碰撞
    if (state.captive && state.captive.alive) {
      const c = state.captive;
      if (circleRect(b.x, b.y, THROW.BOULDER_R, c.cx - c.w / 2, c.cy - c.h / 2, c.w, c.h)) {
        c.alive = false;
        emit('captiveHit', { cx: c.cx, cy: c.cy });
        b.life = 0;
        lose('captiveLost');
        return;
      }
    }
  }

  function step(dt) {
    if (state.phase !== 'playing') return;

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) { state.timeLeft = 0; lose('timeOut'); return; }

    // 收尾计时（最后一名敌人死亡 → 结算胜利）
    if (state.settleTimer > 0) {
      state.settleTimer -= dt;
      if (state.settleTimer <= 0) { win(); return; }
    }

    // 移动敌人巡逻
    for (const e of state.enemies) {
      if (!e.alive || !e.moving) continue;
      e.cx += e.moveDir * e.moveSpeed * dt;
      if (e.cx < e.moveX0) { e.cx = e.moveX0; e.moveDir = 1; }
      else if (e.cx > e.moveX1) { e.cx = e.moveX1; e.moveDir = -1; }
    }

    // 岩石推进
    for (const b of state.boulders) {
      if (b.life > 0) stepBoulder(b, dt);
      else removeBoulder(b);
    }
    state.boulders = state.boulders.filter((b) => b.life > 0);

    // 各种计时
    for (const e of state.enemies) {
      if (e.flash > 0) e.flash -= dt;
      if (!e.alive && e.deadTimer > 0) e.deadTimer -= dt;
    }
    for (const bar of state.barriers) {
      if (bar.flash > 0) bar.flash -= dt;
      if (!bar.alive && bar.breakTimer > 0) bar.breakTimer -= dt;
    }
    if (state.captive && state.captive.flash > 0) state.captive.flash -= dt;

    // 失败：弹药耗尽且无飞行岩石且敌人尚存
    if (state.phase === 'playing' && enemyAliveCount() > 0 &&
        state.ammoLeft === 0 && state.boulders.length === 0 && state.settleTimer <= 0) {
      lose('outOfAmmo');
    }
  }

  function throwNow() {
    if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
    if (state.ammoLeft <= 0) return { ok: false, reason: 'noAmmo' };
    let vx;
    let vy;
    if (state.pending) {
      vx = state.pending.vx;
      vy = state.pending.vy;
      state.pending = null;
    } else if (state.aim.active) {
      const mag = Math.hypot(state.aim.dx, state.aim.dy);
      if (mag < THROW.DEAD_ZONE) return { ok: false, reason: 'tooShort' };
      const nx = state.aim.dx / mag;
      const ny = state.aim.dy / mag;
      const speed = THROW.SPEED * state.aim.power;
      vx = nx * speed;
      vy = ny * speed;
      state.aim.active = false;
    } else {
      return { ok: false, reason: 'noAim' };
    }
    state.ammoLeft -= 1;
    const h = hand();
    state.boulders.push({
      x: h.x, y: h.y, vx, vy, r: THROW.BOULDER_R, life: THROW.LIFE, kills: 0,
    });
    emit('throw', { vx, vy });
    return { ok: true };
  }

  const run = {
    state,
    step,
    drainEvents() {
      const out = state.events.concat(events);
      state.events.length = 0;
      events.length = 0;
      return out;
    },
    // 人类：拖拽瞄准
    aimStart() { if (state.phase === 'playing') { state.aim.active = true; state.aim.dx = 0; state.aim.dy = 0; state.aim.power = 0; } },
    aimMove(px, py) {
      if (state.phase !== 'playing' || !state.aim.active) return;
      const h = hand();
      const dx = px - h.x;
      const dy = py - h.y;
      const mag = Math.hypot(dx, dy);
      state.aim.dx = dx;
      state.aim.dy = dy;
      state.aim.power = clamp((mag - THROW.DEAD_ZONE) / (THROW.FULL_DRAG - THROW.DEAD_ZONE), 0, 1) *
        (THROW.POWER_MAX - THROW.POWER_MIN) + THROW.POWER_MIN;
    },
    aimCancel() { state.aim.active = false; },
    throw: throwNow,
    // bot/自瞄：直接瞄准 (tx,ty)（恰好命中的抛射），供 selfplay 与 __ll.debug
    aim(tx, ty) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      const h = hand();
      state.pending = solveVelocity(h.x, h.y, tx, ty);
      state.aim.active = false;
      emit('aim', { tx, ty });
      return { ok: true };
    },
    getHud() {
      return {
        level: state.level,
        ammoLeft: state.ammoLeft,
        ammoTotal: state.ammoTotal,
        timeLeft: Math.max(0, Math.ceil(state.timeLeft)),
        score: state.score,
        streak: state.streak,
        enemiesLeft: enemyAliveCount(),
      };
    },
  };

  return run;
}
