// 几何工具：线段遮挡、射线求交（瞄准预测与 AI 线路共用）。纯函数。
import { BALL, PLAY } from '../../config/game.config.js';

const R = BALL.R;

export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// 线段 a→b 是否被 obstacles 中的球挡住（触球半径 radius，默认两球相碰）。
export function segmentBlocked(ax, ay, bx, by, obstacles, radius = BALL.DIAM) {
  for (const o of obstacles) {
    if (!o.alive) continue;
    if (distToSegment(o.x, o.y, ax, ay, bx, by) < radius) return true;
  }
  return false;
}

// 白球沿 dir 前进，最早撞到的球（返回接触时白球位置与球）。
export function castBall(ox, oy, dirX, dirY, balls, maxDist = 4000) {
  let best = null;
  for (const b of balls) {
    if (!b.alive || b.id === BALL.CUE_ID) continue;
    const ex = b.x - ox;
    const ey = b.y - oy;
    const proj = ex * dirX + ey * dirY;
    if (proj <= 0) continue;
    const perp2 = ex * ex + ey * ey - proj * proj;
    const rr = BALL.DIAM * BALL.DIAM;
    if (perp2 > rr) continue;
    const t = proj - Math.sqrt(rr - perp2);
    if (t < 0 || t > maxDist) continue;
    if (!best || t < best.t) best = { t, ball: b };
  }
  return best;
}

// 射线到库边鼻线的距离（白球没碰到球时预测撞库点）。
export function castCushion(ox, oy, dirX, dirY) {
  let t = Infinity;
  if (dirX > 0) t = Math.min(t, (PLAY.right - R - ox) / dirX);
  if (dirX < 0) t = Math.min(t, (PLAY.left + R - ox) / dirX);
  if (dirY > 0) t = Math.min(t, (PLAY.bottom - R - oy) / dirY);
  if (dirY < 0) t = Math.min(t, (PLAY.top + R - oy) / dirY);
  return Number.isFinite(t) && t > 0 ? t : 0;
}

export function clampToPlay(x, y, pad = R) {
  return {
    x: Math.max(PLAY.left + pad, Math.min(PLAY.right - pad, x)),
    y: Math.max(PLAY.top + pad, Math.min(PLAY.bottom - pad, y)),
  };
}

export function insidePlay(x, y, pad = R) {
  return (
    x >= PLAY.left + pad && x <= PLAY.right - pad && y >= PLAY.top + pad && y <= PLAY.bottom - pad
  );
}
