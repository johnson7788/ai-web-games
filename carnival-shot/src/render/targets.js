// 目标绘制：纸鸢 / 提灯鸭 / 金鸭 / 红灯鸭 / 小鬼灯 / 移动靶纸。
// 所有目标都带发光光晕，确保在夜色背景里剪影清晰（vision-review 的 goal_visible / silhouette）。
import { scene } from './theme.js';

function glow(ctx, x, y, r, color, alpha = 0.5) {
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDuck(ctx, x, y, body, head, lanternColor) {
  // 身体
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y, 22, 16, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // 头
  ctx.beginPath();
  ctx.arc(x + 17, y - 11, 10, 0, Math.PI * 2);
  ctx.fill();
  // 嘴
  ctx.fillStyle = '#ff9f3f';
  ctx.beginPath();
  ctx.moveTo(x + 26, y - 13);
  ctx.lineTo(x + 38, y - 9);
  ctx.lineTo(x + 26, y - 7);
  ctx.closePath();
  ctx.fill();
  // 眼
  ctx.fillStyle = '#1a0d05';
  ctx.beginPath();
  ctx.arc(x + 20, y - 13, 2, 0, Math.PI * 2);
  ctx.fill();
  // 尾
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x - 20, y - 2);
  ctx.lineTo(x - 32, y - 10);
  ctx.lineTo(x - 28, y + 4);
  ctx.closePath();
  ctx.fill();
  // 提灯
  if (lanternColor) {
    ctx.fillStyle = lanternColor;
    ctx.beginPath();
    ctx.arc(x - 4, y + 22, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 10);
    ctx.lineTo(x - 4, y + 22);
    ctx.stroke();
  }
}

function drawKite(ctx, x, y, color, dir) {
  // 纸鸢菱形 + 尾巴
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 20);
  ctx.lineTo(x + 16, y);
  ctx.lineTo(x, y + 20);
  ctx.lineTo(x - 16, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 尾巴
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 20);
  const s = dir >= 0 ? -1 : 1;
  for (let k = 1; k <= 3; k += 1) {
    ctx.quadraticCurveTo(x + s * 8 * k, y + 20 + 8 * k, x - s * 4, y + 20 + 14 * k);
  }
  ctx.stroke();
}

function drawGhost(ctx, x, y) {
  ctx.fillStyle = 'rgba(232,236,255,0.85)';
  ctx.beginPath();
  ctx.arc(x, y, 16, Math.PI, 0);
  ctx.lineTo(x + 16, y + 16);
  for (let k = 4; k >= 0; k -= 1) {
    const gx = x + 16 - k * 6.4;
    const gy = y + 16 - (k % 2) * 6;
    ctx.lineTo(gx, gy);
  }
  ctx.closePath();
  ctx.fill();
  // 眼睛
  ctx.fillStyle = '#2a1430';
  ctx.beginPath();
  ctx.arc(x - 6, y - 3, 2.5, 0, Math.PI * 2);
  ctx.arc(x + 6, y - 3, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // 小鬼灯
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(x, y + 10, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawBullseye(ctx, x, y) {
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 5;
  for (const r of [22, 15, 8]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff5a5a';
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

export function drawTargets(ctx, targets, now) {
  for (const t of targets) {
    if (t.dead) continue;
    const x = t.x;
    const y = t.y;
    const dir = t.vx >= 0 ? 1 : -1;

    switch (t.kind) {
      case 'kite':
        glow(ctx, x, y, 40, 'rgba(255,209,102,0.9)', 0.4);
        drawKite(ctx, x, y, '#f6e7c0', dir);
        break;
      case 'lantern':
        glow(ctx, x, y, 44, 'rgba(255,179,71,0.9)', 0.5);
        drawDuck(ctx, x, y, '#6b3a20', '#8a4a28', '#ffd166');
        break;
      case 'golden':
        glow(ctx, x, y, 52, 'rgba(255,210,63,0.95)', 0.6);
        drawKite(ctx, x, y, '#ffd23f', dir);
        break;
      case 'red':
        glow(ctx, x, y, 50, 'rgba(255,90,90,0.95)', 0.6);
        drawDuck(ctx, x, y, '#d7263d', '#ff5a5a', '#ffb3b3');
        break;
      case 'ghost':
        glow(ctx, x, y, 38, 'rgba(155,208,255,0.8)', 0.4);
        drawGhost(ctx, x, y);
        break;
      case 'dive':
        glow(ctx, x, y, 40, 'rgba(255,209,102,0.9)', 0.4);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(0.7);
        drawKite(ctx, 0, 0, '#ffe08a', 1);
        ctx.restore();
        break;
      case 'moving':
        glow(ctx, x, y, 42, 'rgba(255,255,255,0.85)', 0.4);
        drawBullseye(ctx, x, y);
        break;
      default:
        glow(ctx, x, y, 40, 'rgba(255,209,102,0.9)', 0.4);
        drawKite(ctx, x, y, '#f6e7c0', dir);
    }
  }
}
