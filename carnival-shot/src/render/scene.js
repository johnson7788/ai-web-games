// 场景背景：三场景包（灯会 / 河灯 / 烟花夜）程序化绘制。
// 换章必换：色板 + 构图 + 装饰（灯笼串 / 河灯莲灯 / 烟花）。
import { WORLD, scene } from './theme.js';

// 确定性伪随机（仅装饰用，保证截图稳定）
function srand(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function drawScene(ctx, sceneKey, now, reduceMotion) {
  const pal = scene(sceneKey);
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;

  // 天空渐变
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(0.5, pal.skyMid);
  sky.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  if (pal.decor === 'lanterns') drawLanternFair(ctx, pal, now, reduceMotion);
  else if (pal.decor === 'lotus') drawRiver(ctx, pal, now, reduceMotion);
  else drawFireworks(ctx, pal, now, reduceMotion);
}

function drawLanternFair(ctx, pal, now, reduceMotion) {
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  // 星星
  ctx.fillStyle = 'rgba(255,220,180,0.7)';
  for (let i = 0; i < 46; i += 1) {
    const x = srand(i) * W;
    const y = srand(i + 100) * 260;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.001 + i));
    ctx.globalAlpha = tw * 0.7;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // 顶部两串灯笼
  drawLanternStrings(ctx, pal, now, 40, 0);
  drawLanternStrings(ctx, pal, now, 96, 1);

  // 远处摊位剪影（屋檐 + 灯光）
  drawBooths(ctx, pal, now);

  // 地面
  ctx.fillStyle = pal.booth;
  ctx.fillRect(0, H - 60, W, 60);
  ctx.fillStyle = pal.boothLit;
  for (let i = 0; i < 12; i += 1) {
    const x = i * 110 + 30;
    const w = 60;
    ctx.globalAlpha = 0.5 + 0.3 * Math.abs(Math.sin(now * 0.002 + i));
    ctx.fillRect(x, H - 56, w, 5);
  }
  ctx.globalAlpha = 1;
}

function drawLanternStrings(ctx, pal, now, y, phase) {
  const W = WORLD.WIDTH;
  const count = 9;
  const seg = W / count;
  for (let i = 0; i < count; i += 1) {
    const cx = i * seg + seg / 2;
    const sway = Math.sin(now * 0.0012 + i * 1.3 + phase) * 8;
    const x = cx + sway;
    const r = 13;
    // 灯身
    const g = ctx.createRadialGradient(x, y, 2, x, y, r + 8);
    g.addColorStop(0, 'rgba(255,236,170,0.95)');
    g.addColorStop(0.5, pal.glow);
    g.addColorStop(1, 'rgba(255,120,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.fillRect(x - r * 0.7, y - r * 1.4, r * 1.4, r * 2.8);
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // 灯线
    ctx.strokeStyle = 'rgba(255,200,140,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + sway, y * 0.5, x, y - r * 1.6);
    ctx.stroke();
  }
}

function drawBooths(ctx, pal, now) {
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  // 一排摊位屋顶（锯齿）
  ctx.fillStyle = pal.booth;
  ctx.beginPath();
  ctx.moveTo(0, H);
  const n = 16;
  const seg = W / n;
  for (let i = 0; i <= n; i += 1) {
    const x = i * seg;
    const y = H - 150 - (i % 2) * 26;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // 摊位上亮灯
  for (let i = 0; i < n; i += 1) {
    const x = i * seg + seg / 2;
    const y = H - 150 - (i % 2) * 26 + 14;
    const g = ctx.createRadialGradient(x, y, 1, x, y, 16);
    g.addColorStop(0, 'rgba(255,230,160,0.9)');
    g.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRiver(ctx, pal, now, reduceMotion) {
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  // 水面
  const water = ctx.createLinearGradient(0, H * 0.55, 0, H);
  water.addColorStop(0, pal.skyMid);
  water.addColorStop(1, pal.water);
  ctx.fillStyle = water;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  // 水纹
  ctx.strokeStyle = 'rgba(160,230,255,0.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i += 1) {
    const y = H * 0.6 + i * 20;
    const off = Math.sin(now * 0.001 + i) * 14;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 40) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + i + now * 0.001) * 3 + off);
    }
    ctx.stroke();
  }

  // 河灯（莲灯漂浮）
  for (let i = 0; i < 12; i += 1) {
    const x = srand(i + 7) * W;
    const y = H * 0.62 + srand(i + 30) * (H * 0.3);
    const bob = Math.sin(now * 0.0016 + i) * 4;
    drawLotus(ctx, pal, x, y + bob, now);
  }

  // 远岸剪影
  ctx.fillStyle = pal.booth;
  ctx.fillRect(0, H * 0.5, W, H * 0.06);
}

function drawLotus(ctx, pal, x, y, now) {
  const r = 12;
  const g = ctx.createRadialGradient(x, y, 1, x, y, r + 10);
  g.addColorStop(0, 'rgba(255,240,200,0.95)');
  g.addColorStop(0.5, pal.glow);
  g.addColorStop(1, 'rgba(90,220,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r + 10, 0, Math.PI * 2);
  ctx.fill();
  // 花瓣
  ctx.fillStyle = pal.accent;
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.5, 6, 3, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff6df';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawFireworks(ctx, pal, now, reduceMotion) {
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  // 星星 + 烟花
  ctx.fillStyle = 'rgba(255,225,190,0.7)';
  for (let i = 0; i < 50; i += 1) {
    const x = srand(i) * W;
    const y = srand(i + 200) * 300;
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.001 + i));
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // 烟花（周期性爆开）
  const period = 2600;
  const t = now % period;
  for (let b = 0; b < 3; b += 1) {
    const bx = srand(b + 5) * W * 0.8 + W * 0.1;
    const by = 120 + srand(b + 9) * 200;
    const bt = (t + b * (period / 3)) % period;
    if (bt < 600) {
      const p = bt / 600;
      drawBurst(ctx, pal, bx, by, p);
    }
  }
  drawBooths(ctx, pal, now);
  ctx.fillStyle = pal.booth;
  ctx.fillRect(0, H - 60, W, 60);
}

function drawBurst(ctx, pal, x, y, p) {
  const r = 20 + p * 90;
  ctx.strokeStyle = pal.accent2;
  ctx.lineWidth = 2;
  const rays = 24;
  ctx.globalAlpha = 1 - p;
  for (let k = 0; k < rays; k += 1) {
    const a = (k / rays) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
