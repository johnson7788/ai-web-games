// src/render/items.js — 程序化物品渲染：把 config/items.js 的 shape 配方画成 Canvas。
// 坐标单位 = item.s（调用前 translate/scale）。variant=1 = 孪生诱饵：省略带 a:1 的细节 shape。
import { itemById } from '../../config/items.js';

function strokeIf(ctx, sh) {
  if (sh.s) {
    ctx.lineWidth = sh.w ?? 0.06;
    ctx.strokeStyle = sh.s;
    ctx.stroke();
  }
}

function fillIf(ctx, sh) {
  if (sh.f) {
    ctx.fillStyle = sh.f;
    ctx.fill();
  }
}

function tracePoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** 画单个物品。variant 0 = 正品；variant 1 = 诱饵（省略 accent 细节）。 */
export function drawItem(ctx, id, x, y, s, variant = 0) {
  const item = itemById(id);
  if (!item) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const sh of item.shapes) {
    if (variant === 1 && sh.a) continue; // 孪生诱饵：少一个细节
    if (sh.k === 'c') {
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, sh.r, 0, Math.PI * 2);
      fillIf(ctx, sh);
      strokeIf(ctx, sh);
    } else if (sh.k === 'e') {
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, sh.rx, sh.ry, sh.rot || 0, 0, Math.PI * 2);
      fillIf(ctx, sh);
      strokeIf(ctx, sh);
    } else if (sh.k === 'r') {
      const x = sh.x - sh.w / 2;
      const y = sh.y - sh.h / 2;
      if (sh.rx) roundedRect(ctx, x, y, sh.w, sh.h, sh.rx);
      else { ctx.beginPath(); ctx.rect(x, y, sh.w, sh.h); }
      fillIf(ctx, sh);
      strokeIf(ctx, sh);
    } else if (sh.k === 'p') {
      tracePoly(ctx, sh.pts);
      fillIf(ctx, sh);
      strokeIf(ctx, sh);
    } else if (sh.k === 'l') {
      ctx.beginPath();
      ctx.moveTo(sh.x1, sh.y1);
      ctx.lineTo(sh.x2, sh.y2);
      strokeIf(ctx, sh);
    } else if (sh.k === 'a') {
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, sh.r, sh.a0, sh.a1);
      strokeIf(ctx, sh);
    }
  }
  ctx.restore();
}

/** 画一个小缩略图到独立 canvas（清单 HUD 用）。返回 canvas。 */
export function drawThumb(id, size = 34, variant = 0) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const item = itemById(id);
  if (!item) return c;
  const s = (size / 2) * 0.82;
  drawItem(ctx, id, size / 2, size / 2, s, variant);
  return c;
}
