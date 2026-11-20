// src/render/rings.js — 彩环绘制：横向色条（每格一色，移动环 marquee wrap），同色安全格高亮。
import { WORLD } from '../../config/game.config.js';
import { BALL } from '../../config/gameplay.js';
import { cellHex, dyeHex, WOOD_HEX, WOOD_DEEP, WHITE_HEX } from './theme.js';

const RING_H = 46;

function cellColorFor(ring, i) {
  return ring.colors[i];
}

export function drawRing(ctx, run, ring, scene) {
  const screenY = WORLD.BALL_Y + (run.depth - ring.worldY);
  if (screenY < -RING_H * 2 || screenY > WORLD.HEIGHT + RING_H * 2) return;

  const W = WORLD.WIDTH;
  const xOffset = ring.xOffset || 0;
  const cellW = ring.cellW;

  ctx.save();
  ctx.translate(0, screenY);

  // 环底（金属轨道）
  ctx.fillStyle = scene.ring;
  roundRect(ctx, 0, -RING_H / 2, W, RING_H, 12);
  ctx.fill();

  // 每格颜色（wrap 绘制，移动环平移）
  for (let i = 0; i < ring.cellsCount; i += 1) {
    const color = cellColorFor(ring, i);
    const start = ((i * cellW + xOffset) % W + W) % W;
    drawCell(ctx, start, cellW, color, run.dye);
  }

  // 内阴影分割线
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, RING_H / 2 - 1);
  ctx.lineTo(W, RING_H / 2 - 1);
  ctx.stroke();

  ctx.restore();
}

function drawCell(ctx, start, cellW, color, dye) {
  const hex = cellHex(color);
  const isDye = color === dye;
  const isWhite = color === -1;
  const isWood = color === -2;
  const W = ctx.canvas.width;

  // 主色块（可 wrap 成两段）
  const pieces = start + cellW > W
    ? [[start, W - start], [0, start + cellW - W]]
    : [[start, cellW]];
  for (const [x, w] of pieces) {
    if (w < 3) continue;
    ctx.fillStyle = hex;
    roundRect(ctx, x + 1, -RING_H / 2 + 3, w - 2, RING_H - 6, 8);
    ctx.fill();
  }

  // 同色安全格：亮环高亮（玩家的目标）
  if (isDye) {
    for (const [x, w] of pieces) {
      if (w < 10) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      roundRect(ctx, x + 4, -RING_H / 2 + 6, w - 8, RING_H - 12, 6);
      ctx.stroke();
    }
  }
  // 白格：柔光
  if (isWhite) {
    for (const [x, w] of pieces) {
      if (w < 10) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      roundRect(ctx, x + 4, -RING_H / 2 + 8, w - 8, RING_H - 16, 6);
      ctx.fill();
    }
  }
  // 木格：纹理点
  if (isWood) {
    for (const [x, w] of pieces) {
      if (w < 6) continue;
      ctx.fillStyle = WOOD_DEEP + '66';
      const n = Math.max(1, Math.floor(w / 14));
      for (let k = 0; k < n; k += 1) {
        const px = x + 6 + k * 14;
        ctx.beginPath();
        ctx.arc(px, (k % 2 ? 6 : -6), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  if (w <= 0 || h <= 0) return;
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawBall(ctx, run, scene) {
  const b = run.ball;
  const hex = dyeHex(run.dye);
  const deep = dyeHex(run.dye);

  ctx.save();
  ctx.translate(b.x, WORLD.BALL_Y);
  ctx.rotate(b.angle);

  // 光晕
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, BALL.R * 2.2);
  halo.addColorStop(0, hex + '66');
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, BALL.R * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // 球体
  const body = ctx.createRadialGradient(-BALL.R * 0.35, -BALL.R * 0.4, 1, 0, 0, BALL.R);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.25, hex);
  body.addColorStop(1, deep);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, BALL.R, 0, Math.PI * 2);
  ctx.fill();

  // 糖果螺旋条纹
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, BALL.R * 0.55, -0.6, 2.2);
  ctx.stroke();

  // 深色描边：把糖球从同色系背景里“抠”出来（剪影可读性）
  ctx.strokeStyle = 'rgba(24,8,16,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, BALL.R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export function drawBallTrail(ctx, run) {
  // 短尾：由当前球的 vx 方向画一段淡出的弧
  const b = run.ball;
  if (Math.abs(b.vx) < 4) return;
  ctx.save();
  ctx.strokeStyle = dyeHex(run.dye) + '55';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.x, WORLD.BALL_Y + BALL.R);
  ctx.lineTo(b.x - b.vx * 0.05, WORLD.BALL_Y + BALL.R + 16);
  ctx.stroke();
  ctx.restore();
}
