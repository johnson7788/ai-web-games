// AABB × 瓦片碰撞：分轴求解 + 竖直子步进。零依赖，可在 node 里跑。
import { P } from '../../config/game.config.js';
import { T } from './level.js';

const EPS = 1e-6;

export function makeBody({ x, y, w, h, vx = 0, vy = 0 }) {
  return { x, y, hw: w / 2, hh: h / 2, vx, vy, grounded: false, hitCeil: false, onOneWay: false };
}

function moveX(b, lv, dx) {
  if (dx === 0) return;
  b.x += dx;
  const left = b.x - b.hw;
  const right = b.x + b.hw;
  const ty0 = Math.floor(b.y - b.hh + EPS);
  const ty1 = Math.floor(b.y + b.hh - EPS);
  if (dx > 0) {
    const tx = Math.floor(right - EPS);
    for (let ty = ty0; ty <= ty1; ty++) {
      const wall = tx >= lv.w || lv.isSolid(tx, ty) || lv.tileAt(tx, ty) === T.ONEWAY;   // 右边界当实心墙
      if (wall) { b.x = tx - b.hw; b.vx = 0; return; }
    }
  } else {
    const tx = Math.floor(left + EPS);
    for (let ty = ty0; ty <= ty1; ty++) {
      const wall = tx < 0 || lv.isSolid(tx, ty) || lv.tileAt(tx, ty) === T.ONEWAY;       // 左边界当实心墙
      if (wall) { b.x = tx + 1 + b.hw; b.vx = 0; return; }
    }
  }
}

function moveY(b, lv, dy) {
  if (dy === 0) return;
  const prevBottom = b.y - b.hh;
  b.y += dy;
  const tx0 = Math.floor(b.x - b.hw + EPS);
  const tx1 = Math.floor(b.x + b.hw - EPS);
  const bottom = b.y - b.hh;
  const top = b.y + b.hh;

  if (dy < 0) {
    const ty = Math.floor(bottom + EPS);
    for (let tx = tx0; tx <= tx1; tx++) {
      const oneWay = lv.tileAt(tx, ty) === T.ONEWAY && prevBottom >= ty + 1 - 1e-4;
      if (lv.isSolid(tx, ty) || oneWay) {
        b.y = ty + 1 + b.hh;
        b.vy = 0;
        b.grounded = true;
        return;
      }
    }
  } else {
    const ty = Math.floor(top - EPS);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (lv.isSolid(tx, ty)) {
        b.y = ty - b.hh;
        b.vy = 0;
        b.hitCeil = true;
        b.hitTile = { tx, ty };
        return;
      }
    }
  }
}

/** 一步物理：重力先结算，再水平、再竖直（子步进） */
export function stepBody(b, lv, dt) {
  b.grounded = false;
  b.hitCeil = false;
  b.hitTile = null;
  b.vy -= (b.vy > 0 ? P.gravityRise : P.gravityFall) * dt;
  b.vy = Math.max(b.vy, -P.maxFall);

  moveX(b, lv, b.vx * dt);

  const dy = b.vy * dt;
  const n = Math.max(1, Math.ceil(Math.abs(dy) / 0.5));
  for (let i = 0; i < n; i++) moveY(b, lv, dy / n);
  if (b.grounded) b.vy = 0;
}
