// FISH FRENZY · 场景绘制：三场景包背景 + 程序化装饰（珊瑚/岩石/热泉）+ 环境气泡。
// 装饰在模块加载时用固定伪随机生成一次，帧间不抖。
import { scenePalette, clamp } from './theme.js';

// 固定伪随机（mulberry32 简化版）
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DECOR = [null, [], [], []];

function buildDecor() {
  for (let s = 1; s <= 3; s += 1) {
    const rnd = prng(1000 + s);
    const items = [];
    const count = 9;
    for (let i = 0; i < count; i += 1) {
      items.push({
        kind: s === 1 ? 'coral' : s === 2 ? 'rock' : 'vent',
        x: rnd() * 1280,
        y: 430 + rnd() * 270,
        s: 0.6 + rnd() * 1.2,
        hue: rnd(),
      });
    }
    DECOR[s] = items;
  }
}
buildDecor();

function drawCoral(ctx, x, y, s) {
  ctx.strokeStyle = 'rgba(94,234,212,0.5)';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  for (let b = 0; b < 3; b += 1) {
    const bx = x + (b - 1) * 10 * s;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx + 14 * s, y - 34 * s, bx + 6 * s, y - 60 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 6 * s, y - 40 * s);
    ctx.quadraticCurveTo(bx + 26 * s, y - 52 * s, bx + 20 * s, y - 72 * s);
    ctx.stroke();
  }
}

function drawRock(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(20,34,54,0.85)';
  ctx.strokeStyle = 'rgba(111,216,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 26 * s, y);
  ctx.lineTo(x - 16 * s, y - 30 * s);
  ctx.lineTo(x + 8 * s, y - 40 * s);
  ctx.lineTo(x + 24 * s, y - 20 * s);
  ctx.lineTo(x + 26 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawVent(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(20,8,6,0.9)';
  ctx.strokeStyle = 'rgba(255,93,62,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 18 * s, y);
  ctx.lineTo(x - 12 * s, y - 40 * s);
  ctx.lineTo(x + 12 * s, y - 40 * s);
  ctx.lineTo(x + 18 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 顶部热光
  const g = ctx.createRadialGradient(x, y - 42 * s, 2, x, y - 42 * s, 18 * s);
  g.addColorStop(0, 'rgba(255,180,95,0.7)');
  g.addColorStop(1, 'rgba(255,180,95,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 20 * s, y - 62 * s, 40 * s, 40 * s);
}

export function drawScene(ctx, sceneIdx, now = 0) {
  const pal = scenePalette(sceneIdx);
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // 背景渐变
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.5, pal.mid);
  g.addColorStop(1, pal.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 水纹光带
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = pal.glow;
  for (let i = 0; i < 5; i += 1) {
    const yy = 60 + i * 130 + Math.sin(now * 0.4 + i) * 14;
    ctx.beginPath();
    ctx.ellipse(640, yy, 900, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 装饰
  for (const d of DECOR[sceneIdx] || []) {
    if (d.kind === 'coral') drawCoral(ctx, d.x, d.y, d.s);
    else if (d.kind === 'rock') drawRock(ctx, d.x, d.y, d.s);
    else drawVent(ctx, d.x, d.y, d.s);
  }

  // 环境气泡（程序化，缓慢上升）
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 18; i += 1) {
    const bx = ((i * 137.5 + 31) % 1280);
    const by = 720 - ((now * 26 + i * 173) % 720);
    const r = 1.5 + (i % 4);
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
