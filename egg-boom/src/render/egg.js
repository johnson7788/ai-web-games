// EGG BOOM · 弹簧蛋绘制（蓄力挤压 / 跳跃拉伸 / 蛋壳 / 蛋黄就绪辉光）
import { WORLD, EGG } from '../../config/gameplay.js';

export function drawEgg(ctx, run, th, time) {
  const egg = run.egg;
  const x = WORLD.EGG_X;
  const y = egg.y;
  const r = EGG.R;

  // 蓄力挤压 / 跳跃拉伸
  let sx = 1;
  let sy = 1;
  if (egg.charging && egg.onGround) {
    sx = 1 + egg.charge * 0.22;
    sy = 1 - egg.charge * 0.22;
  } else if (!egg.onGround) {
    const stretch = Math.min(0.22, Math.abs(egg.vy) / 2200);
    if (egg.vy < 0) { sx = 1 - stretch * 0.6; sy = 1 + stretch; }
    else { sx = 1 + stretch * 0.5; sy = 1 - stretch * 0.5; }
  }

  ctx.save();
  ctx.translate(x, y);

  // 蛋黄就绪辉光
  if (run.yolkReady) {
    const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.9);
    g.addColorStop(0, 'rgba(255,214,90,0.55)');
    g.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // 地面阴影
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, EGG.REST_Y - y + r * 0.6, r * 1.05, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(sx, sy);

  // 蛋身
  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r * 1.15);
  body.addColorStop(0, th.eggBody);
  body.addColorStop(1, th.eggShade);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 1.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.42, r * 0.28, r * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // 蛋壳（护甲）：顶部壳帽
  if (egg.shell > 0) {
    ctx.fillStyle = th.shellColor;
    ctx.beginPath();
    ctx.arc(0, -r * 0.18, r * 0.78, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r * 0.5, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    // 壳裂纹
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.4);
    ctx.lineTo(0, -r * 0.12);
    ctx.lineTo(r * 0.24, -r * 0.5);
    ctx.stroke();
  }

  // 弹簧纹（底部）
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, r * 0.72);
  ctx.lineTo(r * 0.5, r * 0.72);
  ctx.stroke();

  // 眼睛（朝向右侧）
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(r * 0.28, -r * 0.18, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(r * 0.32, -r * 0.22, r * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // 嘴（小喙/微笑）
  ctx.strokeStyle = '#e07830';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(r * 0.5, r * 0.1, r * 0.3, -0.4, 0.7);
  ctx.stroke();

  ctx.restore();

  // 蓄力条（在蛋下方台面附近）
  if (egg.charging && egg.onGround) {
    const w = 64;
    const cx = x;
    const cy = y + r + 18;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, cx - w / 2, cy, w, 8, 4);
    ctx.fill();
    ctx.fillStyle = egg.charge >= 1 ? '#ffcf4d' : th.accent;
    roundRect(ctx, cx - w / 2, cy, w * egg.charge, 8, 4);
    ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
