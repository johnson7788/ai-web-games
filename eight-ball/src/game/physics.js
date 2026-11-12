// 俯视 2D 台球物理：位移积分 → 落袋判定 → 库边反弹 → 球球弹性碰撞 → 摩擦减速。
// 就地修改传入的 world.balls，不碰 DOM / Date / Math.random。
import { BALL, PHYSICS, PLAY, POCKETS, TABLE } from '../../config/game.config.js';
import { pocketAt } from './balls.js';

const R = BALL.R;
const DIAM = BALL.DIAM;
const MOUTH = TABLE.POCKET_R + R + PHYSICS.MOUTH_PAD;
const OUT_LIMIT = TABLE.POCKET_R;

export function speed(b) {
  return Math.hypot(b.vx, b.vy);
}

export function anyMoving(balls) {
  for (const b of balls) {
    if (b.alive && (b.vx !== 0 || b.vy !== 0)) return true;
  }
  return false;
}

// 袋口喇叭区：球心落入该区域时对应库边不再反弹，球才滚得进袋口。
// 角袋吞掉两条库边（axes='xy'），中袋只吞长库边（axes='y'）。
export function jawAt(x, y) {
  let best = null;
  let bestD = MOUTH;
  for (const p of POCKETS) {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function nearestPocket(x, y) {
  let best = POCKETS[0];
  let bestD = Infinity;
  for (const p of POCKETS) {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function pot(b, pocket, out) {
  b.alive = false;
  b.vx = 0;
  b.vy = 0;
  out.push({ type: 'pocket', id: b.id, x: b.x, y: b.y, pocket: { x: pocket.x, y: pocket.y } });
}

function capturePass(balls, out) {
  for (const b of balls) {
    if (!b.alive) continue;
    const p = pocketAt(b.x, b.y);
    if (p) pot(b, p, out);
  }
}

function cushionPass(balls, out) {
  for (const b of balls) {
    if (!b.alive) continue;
    const jaw = jawAt(b.x, b.y);
    const inMouthX = !!jaw && jaw.axes.indexOf('x') >= 0;
    const inMouthY = !!jaw && jaw.axes.indexOf('y') >= 0;
    let hit = false;
    if (!inMouthX) {
      if (b.x < PLAY.left + R) {
        b.x = PLAY.left + R;
        b.vx = -b.vx * PHYSICS.CUSHION;
        hit = true;
      } else if (b.x > PLAY.right - R) {
        b.x = PLAY.right - R;
        b.vx = -b.vx * PHYSICS.CUSHION;
        hit = true;
      }
    }
    if (!inMouthY) {
      if (b.y < PLAY.top + R) {
        b.y = PLAY.top + R;
        b.vy = -b.vy * PHYSICS.CUSHION;
        hit = true;
      } else if (b.y > PLAY.bottom - R) {
        b.y = PLAY.bottom - R;
        b.vy = -b.vy * PHYSICS.CUSHION;
        hit = true;
      }
    }
    if (hit) out.push({ type: 'cushion', id: b.id });

    // 越过袋口还继续外滑（理论上只可能发生在喇叭区）→ 判定落袋，避免卡木框
    if (
      b.x < PLAY.left - OUT_LIMIT ||
      b.x > PLAY.right + OUT_LIMIT ||
      b.y < PLAY.top - OUT_LIMIT ||
      b.y > PLAY.bottom + OUT_LIMIT
    ) {
      pot(b, nearestPocket(b.x, b.y), out);
    }
  }
}

// 等质量完全非旋球碰撞：法线冲量交换，动量守恒。
export function collide(a, b, out) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d >= DIAM) return false;
  const nx = d < 1e-6 ? 1 : dx / d;
  const ny = d < 1e-6 ? 0 : dy / d;
  const overlap = DIAM - d;
  a.x -= (nx * overlap) / 2;
  a.y -= (ny * overlap) / 2;
  b.x += (nx * overlap) / 2;
  b.y += (ny * overlap) / 2;

  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (vn <= 0) return false;
  const j = (-(1 + PHYSICS.RESTITUTION) * vn) / 2;
  a.vx += j * nx;
  a.vy += j * ny;
  b.vx -= j * nx;
  b.vy -= j * ny;
  out.push({ type: 'hit', a: a.id, b: b.id, impulse: Math.abs(vn) });
  return true;
}

function pairPass(balls, out) {
  for (let i = 0; i < balls.length; i += 1) {
    const a = balls[i];
    if (!a.alive) continue;
    for (let k = i + 1; k < balls.length; k += 1) {
      const b = balls[k];
      if (!b.alive) continue;
      collide(a, b, out);
    }
  }
}

// 推进一帧，事件累加进 out 并返回 out。
export function stepPhysics(world, dt, out = []) {
  const balls = world.balls;
  let maxSpeed = 0;
  for (const b of balls) if (b.alive) maxSpeed = Math.max(maxSpeed, speed(b));
  const sub = Math.min(
    PHYSICS.MAX_SUBSTEPS,
    Math.max(1, Math.ceil((maxSpeed * dt) / PHYSICS.SUBSTEP_PX)),
  );
  const h = dt / sub;
  for (let i = 0; i < sub; i += 1) {
    for (const b of balls) {
      if (!b.alive) continue;
      b.x += b.vx * h;
      b.y += b.vy * h;
      if (b.spin === undefined) b.spin = 0;
      b.spin += (Math.hypot(b.vx, b.vy) * h) / R; // 供渲染层旋转号码贴面
    }
    capturePass(balls, out);
    cushionPass(balls, out);
    pairPass(balls, out);
  }

  const k = Math.pow(PHYSICS.FRICTION, dt * 60);
  for (const b of balls) {
    if (!b.alive) continue;
    b.vx *= k;
    b.vy *= k;
    if (Math.hypot(b.vx, b.vy) < PHYSICS.STOP_SPEED) {
      b.vx = 0;
      b.vy = 0;
      const jaw = jawAt(b.x, b.y); // 停在袋口的球算滚进袋
      if (jaw) pot(b, jaw, out);
    }
  }
  return out;
}
