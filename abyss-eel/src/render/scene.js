// 背景渐变 + 远景装饰（水母 / 灯笼鱼剪影 / 热泉烟柱）+ 按 zone 过渡 1.5s。
import { WORLD, zone, hexToRgb, rgbCss, mixHex, clamp } from './theme.js';

const TAU = Math.PI * 2;

function hash2(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// 混合两个 zone 的色板（用于过渡）。
export function blendPalette(zi, zo, t) {
  const a = zone(zi);
  const b = zone(zo);
  const s = smooth(clamp(t, 0, 1));
  return {
    top: mixHex(a.top, b.top, s),
    mid: mixHex(a.mid, b.mid, s),
    bottom: mixHex(a.bottom, b.bottom, s),
    glow: mixHex(a.glow, b.glow, s),
    accent: mixHex(a.accent, b.accent, s),
    wallLow: mixHex(a.wallLow, b.wallLow, s),
    wallHigh: mixHex(a.wallHigh, b.wallHigh, s),
  };
}

// 预生成远景装饰：固定位置/相位，随时间缓慢漂移（视差）。
const DECOR = [];
{
  let n = 0;
  for (let i = 0; i < 5; i += 1) {
    DECOR.push({ type: 'jelly', x: 120 + i * 260 + hash2(n++, 1) * 80, y: 90 + hash2(n++, 2) * 200, s: 0.7 + hash2(n++, 3) * 0.9, ph: hash2(n++, 4) * TAU, sp: 0.2 + hash2(n++, 5) * 0.3 });
  }
  for (let i = 0; i < 6; i += 1) {
    DECOR.push({ type: 'lantern', x: 40 + i * 220 + hash2(n++, 6) * 120, y: 120 + hash2(n++, 7) * 360, s: 0.5 + hash2(n++, 8) * 0.8, ph: hash2(n++, 9) * TAU, sp: 0.15 + hash2(n++, 10) * 0.35 });
  }
  for (let i = 0; i < 4; i += 1) {
    DECOR.push({ type: 'vent', x: 180 + i * 300 + hash2(n++, 11) * 90, y: 600 + hash2(n++, 12) * 70, s: 0.8 + hash2(n++, 13) * 0.7, ph: hash2(n++, 14) * TAU, sp: 0.3 + hash2(n++, 15) * 0.4 });
  }
}

function jelly(ctx, d, now, accentRgb) {
  const x = d.x + Math.sin(now * 0.0003 * d.sp + d.ph) * 18;
  const y = d.y + Math.sin(now * 0.0005 * d.sp + d.ph) * 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(d.s, d.s);
  ctx.globalAlpha *= 0.5;
  // 伞帽剪影
  ctx.fillStyle = 'rgba(10,20,30,0.75)';
  ctx.beginPath();
  ctx.arc(0, 0, 26, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // 伞缘发光
  ctx.strokeStyle = rgbCss(accentRgb, 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 26, Math.PI, 0);
  ctx.stroke();
  // 触须
  ctx.strokeStyle = rgbCss(accentRgb, 0.35);
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 12, 4);
    for (let k = 1; k <= 4; k += 1) {
      ctx.lineTo(i * 12 + Math.sin(now * 0.0012 + k * 1.7 + i) * 6, 4 + k * 14);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function lantern(ctx, d, now, accentRgb) {
  const x = d.x + Math.sin(now * 0.0004 * d.sp + d.ph) * 26;
  const y = d.y + Math.cos(now * 0.00035 * d.sp + d.ph) * 14;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(d.s, d.s);
  ctx.globalAlpha *= 0.7;
  // 鱼身剪影
  ctx.fillStyle = 'rgba(8,14,24,0.8)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 7, -0.15, 0, TAU);
  ctx.fill();
  // 尾
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-22, -6);
  ctx.lineTo(-22, 6);
  ctx.closePath();
  ctx.fill();
  // 钓竿 + 发光饵
  ctx.strokeStyle = rgbCss(accentRgb, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, -4);
  ctx.quadraticCurveTo(16, -12, 18, -18);
  ctx.stroke();
  const bob = Math.sin(now * 0.004 + d.ph) * 2;
  ctx.fillStyle = '#ffd166';
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(18, -18 + bob, 2.4, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function vent(ctx, d, now, accentRgb) {
  const x = d.x;
  const y = d.y;
  ctx.save();
  ctx.translate(x, y);
  // 底部岩丘
  ctx.fillStyle = 'rgba(12,6,4,0.85)';
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.lineTo(-10, -12 * d.s);
  ctx.lineTo(10, -12 * d.s);
  ctx.lineTo(22, 0);
  ctx.closePath();
  ctx.fill();
  // 泉口红光
  const g = ctx.createRadialGradient(0, -14 * d.s, 0, 0, -14 * d.s, 24 * d.s);
  g.addColorStop(0, rgbCss(accentRgb, 0.5));
  g.addColorStop(1, rgbCss(accentRgb, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-28, -38 * d.s, 56, 30 * d.s);
  // 上升烟柱
  ctx.globalAlpha *= 0.4;
  for (let i = 0; i < 3; i += 1) {
    const ox = (i - 1) * 9 + Math.sin(now * 0.0008 + d.ph + i * 1.3) * 8;
    ctx.fillStyle = rgbCss([40, 18, 14], 0.5);
    ctx.beginPath();
    ctx.ellipse(ox, -32 * d.s - i * 6, 8, 22, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawDecorLayer(ctx, type, alpha, now, accentRgb) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const d of DECOR) {
    if (d.type !== type) continue;
    if (type === 'jelly') jelly(ctx, d, now, accentRgb);
    else if (type === 'lantern') lantern(ctx, d, now, accentRgb);
    else vent(ctx, d, now, accentRgb);
  }
  ctx.restore();
}

export function drawScene(ctx, o) {
  const pal = blendPalette(o.zoneFrom, o.zoneTo, o.fadeT);
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.55, pal.mid);
  g.addColorStop(1, pal.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  const fade = clamp(o.fadeT, 0, 1);
  const fromDecor = zone(o.zoneFrom).decor;
  const toDecor = zone(o.zoneTo).decor;
  if (fromDecor === toDecor) {
    drawDecorLayer(ctx, toDecor, 1, o.now, hexToRgb(zone(o.zoneTo).accent));
  } else {
    drawDecorLayer(ctx, fromDecor, 1 - fade, o.now, hexToRgb(zone(o.zoneFrom).accent));
    drawDecorLayer(ctx, toDecor, fade, o.now, hexToRgb(zone(o.zoneTo).accent));
  }
}
