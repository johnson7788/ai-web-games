// FISH FRENZY · 鱼绘制：发光深海种（径向辉光 + 椭圆身 + 三角尾 + 眼睛）。
// 方向由当前路径段决定；Boss 更大更红。
import { FISH_COLORS, clamp } from './theme.js';

function makeGlow(radius, core) {
  const size = Math.max(2, Math.ceil(radius * 2));
  const s = document.createElement('canvas');
  s.width = size;
  s.height = size;
  const c = s.getContext('2d');
  const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, core);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return s;
}

const GLOW_CACHE = new Map();

function glowFor(color) {
  if (!GLOW_CACHE.has(color)) GLOW_CACHE.set(color, makeGlow(46, color));
  return GLOW_CACHE.get(color);
}

export function fishDirection(f) {
  const path = f.path;
  if (!path || f.seg >= path.length - 1) return f._dir || 0;
  const p0 = path[f.seg];
  const p1 = path[f.seg + 1];
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  return Math.atan2(dy, dx);
}

export function drawFish(ctx, f, now = 0) {
  const col = FISH_COLORS[f.species] || FISH_COLORS[1];
  const dir = fishDirection(f);
  f._dir = dir;

  const r = f.radius;
  const fl = clamp(Math.abs(Math.sin(now * 6 + f.phase * 3)), 0.3, 1); // 摆尾

  // 辉光
  ctx.drawImage(glowFor(col.glow), f.x - 46, f.y - 46, 92, 92);

  ctx.save();
  ctx.translate(f.x + f.sway * 0.0, f.y); // 摆动已加到位置里，这里不再偏移
  ctx.rotate(dir);

  // 尾巴
  const tailLen = r * (f.boss ? 1.5 : 1.2);
  ctx.fillStyle = col.body;
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, 0);
  ctx.lineTo(-r * 0.8 - tailLen, -r * 0.7 * fl);
  ctx.lineTo(-r * 0.8 - tailLen, r * 0.7 * fl);
  ctx.closePath();
  ctx.fill();

  // 身体（椭圆）
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.15, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fillStyle = col.body;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 眼睛
  ctx.fillStyle = '#0b1020';
  ctx.beginPath();
  ctx.arc(r * 0.55, -r * 0.1, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(r * 0.6, -r * 0.14, r * 0.06, 0, Math.PI * 2);
  ctx.fill();

  // Boss 额外轮廓
  if (f.boss) {
    ctx.strokeStyle = 'rgba(255,61,61,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.4, r * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
