// 背景渐变 + 远景装饰（荒漠雷达站 / 极光基地 / 城市天际线）+ 按章过渡。
import { WORLD, chapter, hexToRgb, rgbCss, mixHex, clamp } from './theme.js';

const TAU = Math.PI * 2;

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function blendPalette(ci, co, t) {
  const a = chapter(ci);
  const b = chapter(co);
  const s = smooth(clamp(t, 0, 1));
  return {
    top: mixHex(a.top, b.top, s),
    mid: mixHex(a.mid, b.mid, s),
    bottom: mixHex(a.bottom, b.bottom, s),
    glow: mixHex(a.glow, b.glow, s),
    accent: mixHex(a.accent, b.accent, s),
  };
}

function hash2(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------- 装饰：荒漠雷达站 ----------
function drawDesert(ctx, now, accentRgb) {
  // 地面
  ctx.fillStyle = 'rgba(20, 12, 6, 0.9)';
  ctx.fillRect(0, WORLD.HEIGHT - 90, WORLD.WIDTH, 90);
  // 沙丘剪影
  ctx.fillStyle = 'rgba(60, 36, 16, 0.85)';
  ctx.beginPath();
  ctx.moveTo(0, WORLD.HEIGHT - 70);
  for (let x = 0; x <= WORLD.WIDTH; x += 40) {
    ctx.lineTo(x, WORLD.HEIGHT - 70 - 22 * Math.sin(x * 0.012 + 1.2));
  }
  ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT);
  ctx.lineTo(0, WORLD.HEIGHT);
  ctx.closePath();
  ctx.fill();
  // 雷达天线（远景，弱化避免被误认为可交互物）
  const rx = 1050;
  const ry = WORLD.HEIGHT - 170;
  ctx.save();
  ctx.translate(rx, ry);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = rgbCss(accentRgb, 0.9);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 120);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 28, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  const a = (now * 0.0004) % TAU;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(a) * 24, -Math.sin(a) * 24);
  ctx.stroke();
  ctx.restore();
}

// ---------- 装饰：极光基地 ----------
function drawAurora(ctx, now, accentRgb) {
  // 雪原
  ctx.fillStyle = 'rgba(4, 20, 26, 0.9)';
  ctx.fillRect(0, WORLD.HEIGHT - 70, WORLD.WIDTH, 70);
  // 极光带
  for (let k = 0; k < 3; k += 1) {
    ctx.save();
    ctx.globalAlpha = 0.16 + k * 0.03;
    ctx.strokeStyle = rgbCss(accentRgb, 0.5);
    ctx.lineWidth = 40 - k * 8;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.WIDTH; x += 20) {
      const y = 120 + k * 50 + Math.sin(x * 0.006 + now * 0.0003 + k * 1.7) * 46;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }
  // 基地塔楼剪影
  ctx.fillStyle = 'rgba(6, 30, 40, 0.9)';
  for (let i = 0; i < 5; i += 1) {
    const x = 120 + i * 260 + hash2(i, 1) * 60;
    const h = 120 + hash2(i, 2) * 90;
    ctx.fillRect(x, WORLD.HEIGHT - 70 - h, 46, h);
    ctx.fillRect(x - 8, WORLD.HEIGHT - 70 - h - 12, 62, 12);
    ctx.fillStyle = rgbCss(accentRgb, 0.6);
    ctx.fillRect(x + 6, WORLD.HEIGHT - 70 - h + 12, 8, 8);
    ctx.fillStyle = 'rgba(6, 30, 40, 0.9)';
  }
}

// ---------- 装饰：城市天际线 ----------
function drawCity(ctx, now, accentRgb) {
  // 地面网格
  ctx.fillStyle = 'rgba(8, 10, 26, 0.9)';
  ctx.fillRect(0, WORLD.HEIGHT - 60, WORLD.WIDTH, 60);
  // 天际线剪影
  ctx.fillStyle = 'rgba(16, 20, 48, 0.92)';
  for (let i = 0; i < 14; i += 1) {
    const w = 60 + hash2(i, 3) * 70;
    const h = 130 + hash2(i, 4) * 220;
    const x = i * 96 - 20 + hash2(i, 5) * 20;
    ctx.fillRect(x, WORLD.HEIGHT - 60 - h, w, h);
  }
  // 亮窗
  ctx.fillStyle = rgbCss(accentRgb, 0.7);
  for (let i = 0; i < 40; i += 1) {
    const bx = 40 + hash2(i, 6) * (WORLD.WIDTH - 80);
    const by = WORLD.HEIGHT - 60 - 30 - hash2(i, 7) * 260;
    ctx.fillRect(bx, by, 6, 9);
  }
}

const DECOR = {
  desert: drawDesert,
  aurora: drawAurora,
  city: drawCity,
};

function drawDecorLayer(ctx, type, alpha, now, accentRgb) {
  if (alpha <= 0.001 || !DECOR[type]) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  DECOR[type](ctx, now, accentRgb);
  ctx.restore();
}

export function drawScene(ctx, o) {
  const pal = blendPalette(o.chapterFrom, o.chapterTo, o.fadeT);
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.55, pal.mid);
  g.addColorStop(1, pal.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  const fade = clamp(o.fadeT, 0, 1);
  const fromDecor = chapter(o.chapterFrom).decor;
  const toDecor = chapter(o.chapterTo).decor;
  const accentFrom = hexToRgb(chapter(o.chapterFrom).accent);
  const accentTo = hexToRgb(chapter(o.chapterTo).accent);
  if (fromDecor === toDecor) {
    drawDecorLayer(ctx, toDecor, 1, o.now, accentTo);
  } else {
    drawDecorLayer(ctx, fromDecor, 1 - fade, o.now, accentFrom);
    drawDecorLayer(ctx, toDecor, fade, o.now, accentTo);
  }
}
