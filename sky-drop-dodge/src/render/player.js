// src/render/player.js — 举伞跑者（程序化人物 + 能量伞开合）。
import { WORLD, PLAYER, hexToRgb, rgbCss } from './theme.js';

const TAU = Math.PI * 2;

export function drawPlayer(ctx, o) {
  const { x, blocking, shield, invuln, now, pal, blink } = o;
  const gy = WORLD.GROUND_Y;
  const bob = Math.abs(Math.sin(now * 0.006)) * 2;

  // 无敌闪烁
  if (invuln && blink) {
    ctx.globalAlpha = 0.45;
  }

  const tilt = blocking ? 0 : Math.sin(now * 0.008) * 0.06;

  ctx.save();
  ctx.translate(x, gy);
  ctx.rotate(tilt);

  // 腿部（简单剪影）
  ctx.strokeStyle = '#1c2230';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const step = Math.sin(now * 0.02) * 6;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(-7, -22 + step);
  ctx.moveTo(0, -2);
  ctx.lineTo(7, -22 - step);
  ctx.stroke();

  // 躯干
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.lineTo(9, -24);
  ctx.lineTo(-9, -24);
  ctx.closePath();
  ctx.fill();

  // 头
  ctx.fillStyle = '#ffd9b0';
  ctx.beginPath();
  ctx.arc(0, -68, 11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1c2230';
  ctx.beginPath();
  ctx.arc(0, -71, 7, Math.PI, 0);
  ctx.fill();

  // 手臂
  ctx.strokeStyle = '#1c2230';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(4, -50);
  ctx.lineTo(14, -38);
  ctx.moveTo(-4, -50);
  ctx.lineTo(blocking ? 0 : -14, blocking ? -92 : -38);
  ctx.stroke();

  ctx.restore();

  // 伞（独立，不随躯干倾斜）
  drawUmbrella(ctx, x, gy - 58, blocking, shield, now, pal);
}

function drawUmbrella(ctx, x, y, blocking, shield, now, pal) {
  ctx.save();
  ctx.translate(x, y);

  if (blocking) {
    // 撑开的能量伞：发光穹顶
    const R = PLAYER.umbrellaR;
    const g = ctx.createRadialGradient(0, -10, 8, 0, -10, R);
    g.addColorStop(0, rgbCss(hexToRgb(pal.glow), 0.9));
    g.addColorStop(0.7, rgbCss(hexToRgb(pal.accent), 0.45));
    g.addColorStop(1, rgbCss(hexToRgb(pal.accent), 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -8, R, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // 伞骨
    ctx.strokeStyle = 'rgba(20,22,30,0.7)';
    ctx.lineWidth = 3;
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(Math.cos(Math.PI / 2 + i * 0.34) * R * 0.9, -8 + Math.sin(Math.PI / 2 + i * 0.34) * -R * 0.9);
      ctx.stroke();
    }
  } else {
    // 收起的伞
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(0, -26);
    ctx.stroke();
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(9, -32);
    ctx.lineTo(-9, -32);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
