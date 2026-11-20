// COLOR FLUX · 极光萤（球）渲染：发光核心 + 拖尾 + 双色光环
import { WORLD, COLORS, BALL } from '../../config/gameplay.js';

const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function drawBall(ctx, run, time) {
  const b = run.ball;
  const x = WORLD.BALL_X;
  const y = b.y;
  const color = COLORS[b.color];
  const dualActive = run.time < run.dualUntil;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // 大光晕
  const glow = ctx.createRadialGradient(x, y, 0, x, y, BALL.R * 4);
  glow.addColorStop(0, rgba(color.hex, 0.85));
  glow.addColorStop(0.4, rgba(color.hex, 0.25));
  glow.addColorStop(1, rgba(color.hex, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - BALL.R * 4, y - BALL.R * 4, BALL.R * 8, BALL.R * 8);

  // 核心
  ctx.beginPath();
  ctx.arc(x, y, BALL.R, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, BALL.R - 3, 0, TAU);
  ctx.fillStyle = color.hex;
  ctx.fill();

  // 双色光环（第二可用色）
  if (dualActive && run.dualColors.length === 2) {
    const second = COLORS[run.dualColors[1]];
    ctx.beginPath();
    ctx.arc(x, y, BALL.R + 10, 0, TAU);
    ctx.strokeStyle = rgba(second.hex, 0.8 + 0.2 * Math.sin(time * 10));
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // 悬浮表环
  if (b.hovering) {
    ctx.beginPath();
    ctx.arc(x, y, BALL.R + 16, 0, TAU * (b.hoverTank / 30));
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.restore();
}
