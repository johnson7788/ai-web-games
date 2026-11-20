// src/render/scene.js — 背景绘制：场景渐变 + 传送带轨道 + 程序化糖果装饰（随深度滚动）
import { WORLD } from '../../config/game.config.js';
import { sceneById } from './theme.js';

// 确定性伪随机（装饰位置稳定，随深度平移）
function hash(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function drawScene(ctx, sceneId, depth) {
  const s = sceneById(sceneId);
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;

  // 背景渐变
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, s.top);
  g.addColorStop(0.5, s.mid);
  g.addColorStop(1, s.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 顶部发光（糖果车间天光）
  const glow = ctx.createRadialGradient(W / 2, -80, 20, W / 2, -80, 560);
  glow.addColorStop(0, s.accent + '44');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 420);

  drawRails(ctx, s, depth);
  drawDecor(ctx, s, depth);
}

function drawRails(ctx, s, depth) {
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  const railY = H - 60;
  ctx.strokeStyle = s.rail;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, railY);
  ctx.lineTo(W, railY);
  ctx.stroke();

  // 传送带刻度（随深度滚动）
  const period = 90;
  const off = depth % period;
  ctx.fillStyle = s.accent + '55';
  for (let x = -off; x < W + period; x += period) {
    ctx.fillRect(x, railY - 2, 26, 4);
  }
}

function drawDecor(ctx, s, depth) {
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  const count = 14;
  for (let i = 0; i < count; i += 1) {
    const h = hash(i * 13.7);
    const span = 1600;
    const y = ((h * span + depth * 0.5) % span) - 180;
    if (y < -40 || y > H + 40) continue;
    const x = hash(i * 7.3) * W;
    const r = 8 + hash(i * 3.1) * 20;
    const color = s.decor[Math.floor(hash(i * 5.9) * s.decor.length)];
    ctx.save();
    ctx.globalAlpha = 0.14 + hash(i * 2.3) * 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // 糖果高光
    ctx.globalAlpha *= 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
