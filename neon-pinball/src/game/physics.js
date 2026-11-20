// src/game/physics.js — 2D 圆-线段 / 圆-圆碰撞（纯逻辑，零依赖）
// 全部输入/输出用标量，便于 node --test 单测能量衰减与反弹角。
import { clamp } from '../../config/gameplay.js';

/**
 * 圆 (cx,cy,r) 与线段 s={x1,y1,x2,y2} 的碰撞。
 * 返回 { hit, nx, ny, px, py, penetration }：
 *   (nx,ny) = 从线段指向圆心的单位法线；penetration = 重叠深度（r - 距离）。
 *   圆心恰在线段上时，取线段法线方向。
 */
export function circleSegment(cx, cy, r, s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 1e-9) t = ((cx - s.x1) * dx + (cy - s.y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const px = s.x1 + dx * t;
  const py = s.y1 + dy * t;
  let nx = cx - px;
  let ny = cy - py;
  const d = Math.hypot(nx, ny);
  if (d < 1e-9) {
    nx = -dy;
    ny = dx;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    return { hit: true, nx, ny, px, py, penetration: r, t };
  }
  if (d >= r) {
    return { hit: false, nx: nx / d, ny: ny / d, px, py, penetration: 0, t };
  }
  return { hit: true, nx: nx / d, ny: ny / d, px, py, penetration: r - d, t };
}

/**
 * 圆 (cx,cy,r) 与圆 (bx,by,br) 碰撞。
 */
export function circleCircle(cx, cy, r, bx, by, br) {
  const dx = cx - bx;
  const dy = cy - by;
  const d = Math.hypot(dx, dy);
  const minD = r + br;
  if (d >= minD || d < 1e-9) {
    return { hit: false, nx: d > 1e-9 ? dx / d : 1, ny: d > 1e-9 ? dy / d : 0, penetration: 0 };
  }
  return { hit: true, nx: dx / d, ny: dy / d, penetration: minD - d };
}

/**
 * 沿法线 (nx,ny) 反射速度（弹性 restitution + 可选表面速度 svx/svy）。
 * 只处理「正在撞向墙面」的情况（vn < 0），否则原样返回。
 */
export function bounce(vx, vy, nx, ny, restitution, svx = 0, svy = 0) {
  const rvx = vx - svx;
  const rvy = vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return { vx, vy };
  const j = -(1 + restitution) * vn;
  return { vx: vx + j * nx, vy: vy + j * ny };
}

/** 速度模长 */
export function speed(vx, vy) {
  return Math.hypot(vx, vy);
}
