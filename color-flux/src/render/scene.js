// COLOR FLUX · 背景场景：极光帘幕 / 日辉光晕 / 霓虹雨 + 远景装饰（按场景切换）
import { WORLD, SCENES, hexToRgb, rgbCss, blendScene, clamp } from './theme.js';

const TAU = Math.PI * 2;

function hash(a) {
  let h = (Math.imul(a, 374761393) + 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// 极光帘幕（极夜）：顶部摇曳的发光带
function drawAurora(ctx, now, accentRgb) {
  for (let k = 0; k < 3; k += 1) {
    const baseY = 60 + k * 90;
    const hue = accentRgb;
    ctx.save();
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(now * 0.0006 + k);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgbCss(hue, 1);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= WORLD.WIDTH; x += 40) {
      const y = baseY + Math.sin(x * 0.008 + now * 0.0008 + k * 1.7) * 34;
      ctx.lineTo(x, y);
    }
    for (let x = WORLD.WIDTH; x >= 0; x -= 40) {
      const y = baseY + 90 + Math.sin(x * 0.008 + now * 0.0008 + k * 1.7) * 30;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// 日辉：顶部大光晕 + 放射线
function drawSun(ctx, now, accentRgb) {
  const cx = WORLD.WIDTH / 2;
  const cy = 90;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 340);
  g.addColorStop(0, rgbCss(accentRgb, 0.55));
  g.addColorStop(1, rgbCss(accentRgb, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, 420);
  // 放射线
  ctx.strokeStyle = rgbCss(accentRgb, 0.12);
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * TAU + now * 0.0001;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60);
    ctx.lineTo(cx + Math.cos(a) * 360, cy + Math.sin(a) * 360);
    ctx.stroke();
  }
  ctx.restore();
}

// 霓虹雨：青粉斜向雨丝
function drawRain(ctx, now, accentRgb) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgbCss(accentRgb, 0.18);
  ctx.lineWidth = 2;
  for (let i = 0; i < 60; i += 1) {
    const x = hash(i * 7) * WORLD.WIDTH;
    const speed = 320 + hash(i * 13) * 420;
    const y = ((hash(i * 3) * WORLD.HEIGHT + now * speed / 1000) % (WORLD.HEIGHT + 120)) - 60;
    const len = 22 + hash(i * 5) * 30;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 14, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

const DECOR = [];
{
  let n = 0;
  for (let i = 0; i < 26; i += 1) {
    DECOR.push({
      x: hash(n++) * WORLD.WIDTH,
      y: hash(n++) * WORLD.HEIGHT,
      s: 0.4 + hash(n++) * 1.2,
      ph: hash(n++) * TAU,
      sp: 0.2 + hash(n++) * 0.5,
    });
  }
}

// 星光点
function drawStars(ctx, now, accentRgb) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const d of DECOR) {
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.001 * d.sp + d.ph));
    ctx.fillStyle = rgbCss(accentRgb, 0.25 * tw);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.s, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawScene(ctx, o) {
  const pal = blendScene(o.sceneFrom, o.sceneTo, o.fadeT);
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.55, pal.mid);
  g.addColorStop(1, pal.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  const accent = hexToRgb(pal.accent);
  drawStars(ctx, o.now, accent);

  const decor = pal.decor;
  if (decor === 'aurora') drawAurora(ctx, o.now, accent);
  else if (decor === 'sun') drawSun(ctx, o.now, accent);
  else drawRain(ctx, o.now, accent);
}
