// CANNON ECHO · 场景渲染：天空 / 远山 / 崖壁 / 要塞底座（三场景包换色板 + 构图 + 装饰）
import { WORLD } from '../../config/game.config.js';
import { themeAt } from './theme.js';

export function drawScene(ctx, scene, time = 0) {
  const th = themeAt(scene);
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;

  // 天空渐变
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, th.skyTop);
  sky.addColorStop(1, th.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 太阳 / 月亮（随场景不同位置）
  const sunX = scene === 1 ? W * 0.78 : scene === 2 ? W * 0.5 : W * 0.22;
  const sunY = scene === 2 ? H * 0.30 : H * 0.20;
  const g = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120);
  g.addColorStop(0, th.sun);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(sunX - 130, sunY - 130, 260, 260);

  // 远山剪影（parallax 层次）
  drawMountainRange(ctx, th.farMountains, H * 0.42, H * 0.10, 0.5, scene, 0);
  drawMountainRange(ctx, th.nearMountains, H * 0.52, H * 0.12, 1.0, scene, 1);

  // 雾
  ctx.fillStyle = th.fog;
  ctx.fillRect(0, H * 0.36, W, H * 0.30);

  // 崖壁（左右）
  drawCliff(ctx, 0, 0, WORLD.WALL_L, H, th);
  drawCliff(ctx, WORLD.WALL_R, 0, W - WORLD.WALL_R, H, th);

  // 地面 / 要塞线
  ctx.fillStyle = th.groundGlow;
  ctx.fillRect(0, WORLD.FORTRESS_Y - 4, W, H - WORLD.FORTRESS_Y + 4);

  // 要塞底座平台
  const base = ctx.createLinearGradient(0, WORLD.FORTRESS_Y, 0, H);
  base.addColorStop(0, th.fortressLight);
  base.addColorStop(0.2, th.fortress);
  base.addColorStop(1, th.fortress);
  ctx.fillStyle = base;
  ctx.fillRect(0, WORLD.FORTRESS_Y, W, H - WORLD.FORTRESS_Y);

  // 平台顶沿高光
  ctx.strokeStyle = th.fortressLight;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, WORLD.FORTRESS_Y);
  ctx.lineTo(W, WORLD.FORTRESS_Y);
  ctx.stroke();
}

function drawMountainRange(ctx, color, baseY, amp, freq, scene, seed) {
  const W = WORLD.WIDTH;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  const n = 12;
  for (let i = 0; i <= n; i += 1) {
    const x = (i / n) * W;
    // 不同场景不同山形（snow 更尖，lava 更平缓带尖峰）
    const spike = scene === 1 ? Math.abs(Math.sin(i * freq + seed * 2.4)) : Math.sin(i * freq + seed * 1.7);
    const y = baseY - Math.abs(spike) * amp * (scene === 2 ? 1.4 : 1);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, baseY + 40);
  ctx.lineTo(0, baseY + 40);
  ctx.closePath();
  ctx.fill();
}

function drawCliff(ctx, x, y, w, h, th) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, th.cliff);
  g.addColorStop(1, th.cliffLight);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // 岩石纹理
  ctx.strokeStyle = th.cliffLight;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 10; i += 1) {
    const yy = 20 + i * 66;
    ctx.beginPath();
    const left = x === 0;
    ctx.moveTo(left ? x + 8 : x, yy);
    ctx.lineTo(left ? x + w - 6 : x + w - 8, yy + 18);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 崖壁内缘高光（回声弹反弹的那条边）
  ctx.strokeStyle = th.accent;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const edgeX = x === 0 ? w : x;
  ctx.moveTo(edgeX, 0);
  ctx.lineTo(edgeX, h);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
