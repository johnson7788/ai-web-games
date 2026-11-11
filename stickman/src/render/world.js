import { WORLD } from '../../config/game.config.js';
import { TAU, clamp, noise, createPaper, inkPath, inkLine, inkArc, inkCircle, inkBlob, inkDrop, roughRect, roughPolygon, hatch } from './ink.js';

function canvasLayer() {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD.w;
  canvas.height = WORLD.h;
  return canvas;
}

function text(ctx, value, x, y, options = {}) {
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.fillStyle = options.color ?? '#222';
  ctx.font = options.font ?? '12px monospace';
  ctx.textAlign = options.align ?? 'left';
  ctx.textBaseline = options.baseline ?? 'alphabetic';
  if (options.rotate) {
    ctx.translate(x, y);
    ctx.rotate(options.rotate);
    ctx.fillText(value, 0, 0);
  } else {
    ctx.fillText(value, x, y);
  }
  ctx.restore();
}

function arrow(ctx, x1, y1, x2, y2, options) {
  inkLine(ctx, x1, y1, x2, y2, options);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  for (const [x, y, a] of [[x1, y1, angle], [x2, y2, angle + Math.PI]]) {
    inkLine(ctx, x, y, x + Math.cos(a + 0.5) * 8, y + Math.sin(a + 0.5) * 8, { ...options, segments: 8, seed: options.seed + 1 });
    inkLine(ctx, x, y, x + Math.cos(a - 0.5) * 8, y + Math.sin(a - 0.5) * 8, { ...options, segments: 8, seed: options.seed + 2 });
  }
}

function draftBase(ctx, map) {
  const p = map.palette;
  inkLine(ctx, 60, 280, 420, 34, { color: p.inkSoft, width: 1, alpha: 0.13, seed: 10, segments: 14, jitter: 0.3 });
  inkArc(ctx, 160, 180, 128, 128, -1.2, 1.45, { color: p.inkSoft, width: 1, alpha: 0.15, seed: 11, segments: 14, jitter: 0.25 });
  inkArc(ctx, 160, 180, 78, 78, -1.5, 0.8, { color: p.inkSoft, width: 0.8, alpha: 0.12, seed: 12, segments: 12, jitter: 0.25 });
  text(ctx, 'FIG. 01  /  UNTITLED CITY', 60, 56, { color: p.inkSoft, alpha: 0.32, font: '11px monospace' });
  text(ctx, 'graphite on paper · 1280 × 720', 60, 76, { color: p.inkSoft, alpha: 0.2, font: '10px monospace' });
  for (let y = 96; y < WORLD.h; y += 96) {
    inkLine(ctx, 0, y, WORLD.w, y + 1, { color: p.inkSoft, width: 0.45, alpha: 0.035, seed: 20 + y, segments: 14, jitter: 0.18 });
  }
}

function blueprintBase(ctx, map) {
  const p = map.palette;
  for (let x = 0; x <= WORLD.w; x += 32) {
    const edge = Math.abs(x - WORLD.w / 2) / (WORLD.w / 2);
    inkLine(ctx, x, 0, x, WORLD.h, { color: p.grid, width: x % 160 === 0 ? 0.9 : 0.55, alpha: 0.4 + edge * 0.5, seed: 100 + x, segments: 8, jitter: 0.08 });
  }
  for (let y = 0; y <= WORLD.h; y += 32) {
    const edge = Math.abs(y - WORLD.h / 2) / (WORLD.h / 2);
    inkLine(ctx, 0, y, WORLD.w, y, { color: p.grid, width: y % 160 === 0 ? 0.9 : 0.55, alpha: 0.35 + edge * 0.5, seed: 200 + y, segments: 8, jitter: 0.08 });
  }
  roughRect(ctx, 20, 20, WORLD.w - 40, WORLD.h - 40, { color: p.ink, width: 1.1, alpha: 0.55, seed: 301, segments: 14, jitter: 0.12 });
  roughRect(ctx, 26, 26, WORLD.w - 52, WORLD.h - 52, { color: p.inkSoft, width: 0.55, alpha: 0.38, seed: 302, segments: 14, jitter: 0.1 });
  roughRect(ctx, 948, 642, 292, 40, { color: p.ink, width: 0.8, alpha: 0.6, seed: 303, segments: 12, jitter: 0.1 });
  inkLine(ctx, 1060, 642, 1060, 682, { color: p.ink, width: 0.7, alpha: 0.55, seed: 304, segments: 8, jitter: 0.1 });
  text(ctx, 'LAST LINE', 962, 659, { color: p.ink, alpha: 0.72, font: '10px monospace' });
  text(ctx, 'SHEET 02 / 1:1', 1074, 659, { color: p.ink, alpha: 0.72, font: '10px monospace' });
  text(ctx, 'DO NOT ERASE', 962, 675, { color: p.inkSoft, alpha: 0.55, font: '8px monospace' });
  text(ctx, 'N', 74, 61, { color: p.ink, alpha: 0.85, font: '14px monospace', align: 'center' });
  inkCircle(ctx, 74, 105, 27, { color: p.ink, width: 1, alpha: 0.6, seed: 310, segments: 14, jitter: 0.12 });
  roughPolygon(ctx, [{ x: 74, y: 72 }, { x: 66, y: 112 }, { x: 74, y: 105 }, { x: 82, y: 112 }], { color: p.ink, width: 1.3, alpha: 0.8, seed: 311, segments: 12, jitter: 0.15 });
  for (const y of [180, 360, 540]) {
    inkCircle(ctx, 12, y, 5, { color: p.inkSoft, width: 1, alpha: 0.45, seed: 320 + y, segments: 10, jitter: 0.15 });
  }
}

function neonBase(ctx, map) {
  const p = map.palette;
  inkLine(ctx, 0, 610, WORLD.w, 610, { color: p.accent2, width: 1, alpha: 0.06, seed: 400, segments: 14, jitter: 0.3 });
  text(ctx, 'NIGHT STUDY / WET INK', 52, 58, { color: p.inkSoft, alpha: 0.3, font: '10px monospace' });
}

function washBase(ctx, map) {
  const p = map.palette;
  for (let i = 0; i < 9; i += 1) {
    inkBlob(ctx, 80 + i * 155, 8 + noise(i) * 25, 130, 36 + noise(i + 4) * 25, {
      color: p.inkSoft, fill: p.inkSoft, alpha: 0.025, fillAlpha: 0.022,
      width: 8, seed: 500 + i, jitter: 2.4, dry: 0.8,
    });
    inkBlob(ctx, 30 + i * 160, 710 - noise(i + 8) * 20, 150, 38, {
      color: p.ink, fill: p.ink, alpha: 0.025, fillAlpha: 0.025,
      width: 10, seed: 520 + i, jitter: 2, dry: 0.85,
    });
  }
  text(ctx, '墨分五色', 62, 64, { color: p.inkSoft, alpha: 0.28, font: '15px serif' });
}

function blankBase(ctx, map) {
  const p = map.palette;
  inkCircle(ctx, 640, 328, 214, { color: p.inkSoft, width: 1.2, alpha: 0.035, seed: 600, segments: 14, jitter: 1.2, dry: 0.8 });
  text(ctx, '05 / NOTHING LEFT TO ERASE', 54, 58, { color: p.inkSoft, alpha: 0.16, font: '10px monospace' });
}

function drawTape(ctx, d, p, t) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.s * -0.18);
  roughPolygon(ctx, [{ x: -54, y: -12 }, { x: 52, y: -15 }, { x: 57, y: 13 }, { x: -50, y: 16 }], {
    color: '#b9a778', fill: '#d8c896', fillAlpha: 0.28 * d.a,
    width: 0.7, alpha: 0.25 * d.a, seed: d.x, time: t, jitter: 0.8, dry: 0.65,
  });
  for (let x = -44; x < 48; x += 12) inkLine(ctx, x, -11, x + 5, 13, { color: '#9f8e66', width: 0.5, alpha: 0.12, seed: x, segments: 8, jitter: 0.2 });
  ctx.restore();
}

function drawStain(ctx, d, t) {
  const color = '#835b3f';
  for (let i = 0; i < 3; i += 1) {
    inkArc(ctx, d.x, d.y, 47 * d.s + i * 2, 43 * d.s - i, 0.1 + i * 0.03, TAU - 0.18, {
      color, width: 2.2 - i * 0.5, alpha: d.a * (0.32 - i * 0.06),
      seed: 700 + i, time: t * 0.1, segments: 14, jitter: 1.8, dry: 0.55,
    });
  }
  for (let i = 0; i < 7; i += 1) {
    const a = noise(i * 4.2) * TAU;
    inkDrop(ctx, d.x + Math.cos(a) * (58 + noise(i) * 28), d.y + Math.sin(a) * (54 + noise(i + 2) * 25), 1 + noise(i + 9) * 2.4, color, d.a * 0.24, 710 + i);
  }
}

function drawConstruction(ctx, d, p, t) {
  arrow(ctx, d.x - 190, d.y + 105, d.x + 190, d.y + 105, { color: p.inkSoft, width: 0.8, alpha: d.a, seed: 730, time: t, segments: 14, jitter: 0.2 });
  inkLine(ctx, d.x - 190, d.y + 94, d.x - 190, d.y + 116, { color: p.inkSoft, width: 0.8, alpha: d.a, seed: 731, segments: 8 });
  inkLine(ctx, d.x + 190, d.y + 94, d.x + 190, d.y + 116, { color: p.inkSoft, width: 0.8, alpha: d.a, seed: 732, segments: 8 });
  text(ctx, '380  /  BODY OF WORK', d.x, d.y + 96, { color: p.inkSoft, alpha: d.a * 1.4, font: '9px monospace', align: 'center' });
}

function drawGhostFigure(ctx, x, y, s, p, seed, t) {
  const o = { color: p.inkSoft, width: 1.2, alpha: 0.1, time: t, segments: 10, jitter: 0.5, dry: 0.4 };
  inkCircle(ctx, x, y - 52 * s, 10 * s, { ...o, seed });
  inkLine(ctx, x, y - 42 * s, x, y - 5 * s, { ...o, seed: seed + 1 });
  inkLine(ctx, x, y - 35 * s, x - 24 * s, y - 12 * s, { ...o, seed: seed + 2 });
  inkLine(ctx, x, y - 35 * s, x + 25 * s, y - 20 * s, { ...o, seed: seed + 3 });
  inkLine(ctx, x, y - 5 * s, x - 18 * s, y + 32 * s, { ...o, seed: seed + 4 });
  inkLine(ctx, x, y - 5 * s, x + 20 * s, y + 32 * s, { ...o, seed: seed + 5 });
}

function drawTower(ctx, d, p, t, blueprint) {
  const h = 160 * d.s;
  const w = 76 * d.s;
  const o = { color: p.ink, width: 1, alpha: d.a, time: t, segments: 10, jitter: 0.25 };
  roughRect(ctx, d.x - w / 2, d.y - h, w, h, { ...o, seed: d.x });
  for (let y = d.y - h + 18; y < d.y - 12; y += 22) {
    inkLine(ctx, d.x - w / 2 + 8, y, d.x + w / 2 - 8, y, { ...o, seed: y, segments: 8 });
  }
  if (blueprint) {
    inkLine(ctx, d.x, d.y - h, d.x, d.y - h - 70, { ...o, seed: d.x + 2 });
    inkLine(ctx, d.x - 58, d.y - h - 60, d.x + 100, d.y - h - 60, { ...o, seed: d.x + 3 });
    inkLine(ctx, d.x + 72, d.y - h - 60, d.x + 72, d.y - h - 15, { ...o, seed: d.x + 4 });
  }
}

const signSprites = new Map();

function drawSign(ctx, d, p, t, quality) {
  const label = d.x > 600 ? '墨 / INK' : '24H';
  const color = d.x > 600 ? p.accent : p.accent2;
  const key = `${label}:${color}:${quality}`;
  if (!signSprites.has(key)) {
    const sprite = document.createElement('canvas');
    sprite.width = 220;
    sprite.height = 140;
    const sctx = sprite.getContext('2d');
    sctx.translate(110, 70);
    sctx.rotate(d.s * 0.035);
    if (quality === 'high') {
      sctx.shadowColor = color;
      sctx.shadowBlur = 20;
    }
    roughRect(sctx, -65, -31, 130, 62, { color, width: 7, alpha: 0.08, seed: d.x, time: 0, segments: 14, jitter: 0.35 });
    roughRect(sctx, -65, -31, 130, 62, { color, width: 2.2, alpha: 0.9, seed: d.x + 1, time: 0, segments: 14, jitter: 0.35 });
    sctx.shadowBlur = quality === 'high' ? 14 : 0;
    text(sctx, label, 0, 9, { color, alpha: 0.95, font: label === '24H' ? '28px monospace' : '23px serif', align: 'center' });
    signSprites.set(key, sprite);
  }
  const flicker = Math.sin(t * 0.83 + d.x) > 0.985 ? 0.25 : 1;
  ctx.save();
  ctx.globalAlpha = flicker * (d.a ?? 1);
  ctx.drawImage(signSprites.get(key), d.x - 110, d.y - 70);
  ctx.restore();
}

function drawMountains(ctx, d, p, t, drift) {
  for (let layer = 0; layer < 3; layer += 1) {
    const baseY = d.y + 100 + layer * 60;
    const points = [];
    for (let i = 0; i <= 12; i += 1) {
      const x = -100 + i * 130 + drift * (0.3 + layer * 0.25);
      const peak = Math.sin(i * 1.7 + layer * 2) * 55 + noise(i + layer * 20) * 80;
      points.push({ x, y: baseY - peak });
    }
    const polygon = [...points, { x: 1480 + drift, y: 635 }, { x: -100 + drift, y: 635 }];
    roughPolygon(ctx, polygon, {
      color: p.ink, fill: p.inkSoft, fillAlpha: 0.045 + layer * 0.035,
      width: 5 + layer * 2.5, alpha: d.a * (0.2 + layer * 0.12),
      seed: 800 + layer, time: t * 0.15, segments: 14, jitter: 2.2, dry: 0.82,
    });
  }
  const branch = { color: p.ink, width: 3.2, alpha: 0.25, time: t, segments: 12, jitter: 0.7, dry: 0.65 };
  inkPath(ctx, [{ x: 118 + drift, y: 540 }, { x: 150 + drift, y: 440 }, { x: 134 + drift, y: 360 }, { x: 172 + drift, y: 290 }], { ...branch, seed: 820 });
  inkPath(ctx, [{ x: 143 + drift, y: 420 }, { x: 205 + drift, y: 386 }, { x: 234 + drift, y: 340 }], { ...branch, seed: 821, width: 2.1 });
  inkPath(ctx, [{ x: 137 + drift, y: 380 }, { x: 93 + drift, y: 348 }, { x: 75 + drift, y: 310 }], { ...branch, seed: 822, width: 1.7 });
}

function drawSeal(ctx, d, p, t) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(0.045);
  roughRect(ctx, -25, -25, 50, 50, { color: p.accent, width: 4, alpha: d.a, seed: 840, time: t, segments: 14, jitter: 0.8, dry: 0.45 });
  const strokes = [
    [{ x: -15, y: -15 }, { x: -2, y: -15 }, { x: -2, y: -3 }, { x: -15, y: -3 }, { x: -15, y: 15 }],
    [{ x: 7, y: -16 }, { x: 17, y: -16 }, { x: 17, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 16 }],
    [{ x: -13, y: 8 }, { x: -3, y: 8 }], [{ x: 8, y: 10 }, { x: 18, y: 10 }],
  ];
  strokes.forEach((path, i) => inkPath(ctx, path, { color: p.accent, width: 3.1, alpha: d.a * 0.9, seed: 841 + i, time: t, segments: 10, jitter: 0.45, dry: 0.35 }));
  ctx.restore();
}

function drawFragment(ctx, d, p, t) {
  ctx.save();
  ctx.translate(d.x + Math.sin(t * 0.2 + d.x) * 12, d.y + Math.cos(t * 0.17 + d.x) * 8);
  ctx.rotate(d.s * 0.18 + Math.sin(t * 0.12 + d.x) * 0.09);
  const points = [{ x: -54, y: -35 }, { x: 46, y: -46 }, { x: 60, y: 20 }, { x: 27, y: 16 }, { x: 19, y: 31 }, { x: 7, y: 22 }, { x: -9, y: 37 }, { x: -50, y: 25 }];
  roughPolygon(ctx, points, { color: p.inkSoft, fill: '#ffffff', fillAlpha: 0.45, width: 0.8, alpha: d.a * 0.35, seed: d.x, time: t, segments: 14, jitter: 1, dry: 0.6 });
  inkLine(ctx, -32, -15, 28, -24, { color: p.inkSoft, width: 0.8, alpha: 0.08, seed: d.x + 1, time: t, segments: 10, dry: 0.6 });
  ctx.restore();
}

function drawDecor(ctx, d, map, t, quality, drift) {
  const p = map.palette;
  const a = d.a ?? 1;
  switch (d.type) {
    case 'stain': drawStain(ctx, d, t); break;
    case 'tape': drawTape(ctx, d, p, t); break;
    case 'fold':
      inkLine(ctx, d.x, 0, d.x + 4, WORLD.h, { color: p.inkSoft, width: 2, alpha: a * 0.12, seed: d.x, time: t, segments: 14, jitter: 0.4 });
      inkLine(ctx, d.x + 4, 0, d.x + 11, WORLD.h, { color: '#ffffff', width: 4, alpha: a * 0.16, seed: d.x + 1, time: t, segments: 14, jitter: 0.4 });
      break;
    case 'shaving':
      for (let i = 0; i < 6; i += 1) inkArc(ctx, d.x + i * 7, d.y - 5 - noise(i) * 8, 4 + noise(i + 2) * 4, 2.5, 0, Math.PI * 1.5, { color: p.inkSoft, width: 1, alpha: a * 0.45, seed: d.x + i, time: t, segments: 8, jitter: 0.35 });
      break;
    case 'construction': drawConstruction(ctx, d, p, t); break;
    case 'dimension':
      arrow(ctx, d.x - 180, d.y, d.x + 180, d.y, { color: p.ink, width: 0.8, alpha: a, seed: d.x, time: t, segments: 14, jitter: 0.12 });
      text(ctx, '360  /  CLEARANCE', d.x, d.y - 8, { color: p.ink, alpha: a, font: '9px monospace', align: 'center' });
      break;
    case 'stamp':
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(-0.14);
      roughRect(ctx, -72, -23, 144, 46, { color: p.accent2, width: 2.4, alpha: a * 0.7, seed: d.x, time: t, segments: 14, jitter: 0.45, dry: 0.4 });
      text(ctx, 'APPROVED', 0, 7, { color: p.accent2, alpha: a * 0.75, font: 'bold 20px monospace', align: 'center' });
      ctx.restore();
      break;
    case 'rivet':
      inkCircle(ctx, d.x, d.y, 5, { color: p.ink, width: 1, alpha: a, seed: d.x, time: t, segments: 10, jitter: 0.15 });
      inkLine(ctx, d.x - 3, d.y, d.x + 3, d.y, { color: p.ink, width: 0.8, alpha: a, seed: d.x + 1, segments: 8 });
      break;
    case 'cable':
      inkPath(ctx, [{ x: 0, y: d.y }, { x: d.x * 0.5, y: d.y + 55 }, { x: d.x, y: d.y + 25 }, { x: WORLD.w, y: d.y + 70 }], { color: map.id === 'neon' ? p.inkSoft : p.ink, width: 1.3, alpha: a * 0.45, seed: d.x, time: t, segments: 14, jitter: 0.4 });
      break;
    case 'tower': drawTower(ctx, { ...d, x: d.x + drift }, p, t, map.id === 'blueprint'); break;
    case 'sign': drawSign(ctx, d, p, t, quality); break;
    case 'moon':
      ctx.save();
      if (quality === 'high') { ctx.shadowColor = p.accent; ctx.shadowBlur = 26; }
      inkArc(ctx, d.x, d.y, 48, 48, -Math.PI / 3, Math.PI * 1.3, { color: p.accent, width: 5, alpha: a * 0.85, seed: d.x, time: t, segments: 14, jitter: 0.4 });
      inkArc(ctx, d.x, d.y, 43, 43, -Math.PI / 3, Math.PI * 1.3, { color: p.accent, width: 1.2, alpha: a, seed: d.x + 1, time: t, segments: 14, jitter: 0.25 });
      ctx.restore();
      break;
    case 'puddle':
      for (let i = 0; i < 9; i += 1) {
        const y = d.y + i * 5;
        const width = (90 - i * 6) * d.s;
        inkLine(ctx, d.x - width, y, d.x + width, y + noise(i) * 2, { color: i % 2 ? p.accent : p.accent2, width: 2.2, alpha: a * (0.09 - i * 0.006), seed: d.x + i, time: t, segments: 12, jitter: 0.8, dry: 0.45 });
      }
      break;
    case 'mountain': drawMountains(ctx, d, p, t, drift); break;
    case 'seal': drawSeal(ctx, d, p, t); break;
    case 'petal':
      inkBlob(ctx, d.x + Math.sin(t * 0.4 + d.x) * 16, d.y + Math.cos(t * 0.3 + d.x) * 12, 5 * d.s, 2.5 * d.s, { color: p.accent, fill: p.accent, alpha: a * 0.55, fillAlpha: a * 0.3, width: 0.8, seed: d.x, time: t, jitter: 0.5 });
      break;
    case 'brushmark':
      inkPath(ctx, [{ x: d.x - 250 * d.s, y: d.y + 20 }, { x: d.x - 80 * d.s, y: d.y - 10 }, { x: d.x + 120 * d.s, y: d.y + 8 }, { x: d.x + 270 * d.s, y: d.y - 18 }], { color: p.ink, width: 22 * Math.abs(d.s), alpha: a, seed: d.x, time: t * 0.2, segments: 14, jitter: 2.4, dry: 0.88 });
      break;
    case 'fragment': drawFragment(ctx, d, p, t); break;
    default:
      inkLine(ctx, d.x - 20, d.y, d.x + 20, d.y, { color: p.inkSoft, width: 1, alpha: a * 0.3, seed: d.x, time: t, segments: 10, dry: 0.4 });
      break;
  }
}

const citySprites = new Map();

function neonCity(layer, p) {
  if (!citySprites.has(layer)) {
    const sprite = document.createElement('canvas');
    sprite.width = 1536;
    sprite.height = WORLD.h;
    const ctx = sprite.getContext('2d');
    for (let i = 0; i < 14; i += 1) {
      const w = 74 + noise(i + layer * 20) * 74;
      const h = 90 + noise(i * 3 + layer) * (170 - layer * 35);
      const x = i * 104 + 50;
      ctx.save();
      ctx.globalAlpha = 0.42 + layer * 0.2;
      ctx.fillStyle = layer ? '#100b20' : '#0b0818';
      ctx.fillRect(x, WORLD.groundY - h, w, h);
      ctx.restore();
      if (layer) {
        for (let wy = WORLD.groundY - h + 18; wy < WORLD.groundY - 20; wy += 28) {
          inkLine(ctx, x + 12, wy, x + 18, wy, { color: i % 3 ? p.accent : p.accent2, width: 1.2, alpha: 0.12, seed: i + wy, time: 0, segments: 8 });
        }
      }
    }
    citySprites.set(layer, sprite);
  }
  return citySprites.get(layer);
}

function drawMidground(ctx, map, t, drift) {
  const p = map.palette;
  if (map.id === 'draft') {
    drawGhostFigure(ctx, 390 + drift, 430, 1.25, p, 900, t);
    drawGhostFigure(ctx, 890 + drift, 390, 0.9, p, 910, t);
    arrow(ctx, 480 + drift, 238, 590 + drift, 185, { color: p.inkSoft, width: 1, alpha: 0.12, seed: 920, time: t, segments: 12, jitter: 0.25 });
    text(ctx, 'move this line?', 468 + drift, 254, { color: p.inkSoft, alpha: 0.17, font: 'italic 13px serif', rotate: -0.12 });
  } else if (map.id === 'blueprint') {
    inkArc(ctx, 640 + drift, 400, 310, 310, Math.PI * 1.08, Math.PI * 1.88, { color: p.ink, width: 1, alpha: 0.18, seed: 930, time: t, segments: 14, jitter: 0.18 });
    arrow(ctx, 640 + drift, 400, 860 + drift, 185, { color: p.inkSoft, width: 0.8, alpha: 0.2, seed: 931, time: t, segments: 12, jitter: 0.15 });
    text(ctx, 'R 310', 788 + drift, 268, { color: p.ink, alpha: 0.28, font: '10px monospace', rotate: -0.72 });
    inkPath(ctx, [{ x: 300 + drift, y: 510 }, { x: 470 + drift, y: 420 }, { x: 650 + drift, y: 510 }, { x: 830 + drift, y: 420 }, { x: 1010 + drift, y: 510 }], { color: p.ink, width: 1.3, alpha: 0.18, seed: 932, time: t, segments: 14, jitter: 0.18 });
  } else if (map.id === 'neon') {
    for (let layer = 0; layer < 2; layer += 1) {
      const offset = drift * (0.35 + layer * 0.45);
      ctx.drawImage(neonCity(layer, p), -100 + offset, 0);
    }
    inkLine(ctx, 752, 182, 788, 182, { color: p.accent2, width: 4, alpha: 0.6, seed: 940, time: t, segments: 8 });
    inkLine(ctx, 800, 184, 824, 190, { color: p.accent2, width: 4, alpha: 0.16, seed: 941, time: t, segments: 8, dry: 0.8 });
  }
}

function drawGround(ctx, map, t) {
  const p = map.palette;
  const y = WORLD.groundY;
  if (map.id === 'neon') {
    ctx.save();
    if (map.id === 'neon') { ctx.shadowColor = p.accent2; ctx.shadowBlur = 8; }
    inkLine(ctx, -10, y, WORLD.w + 10, y, { color: p.accent2, width: 2.4, alpha: 0.55, seed: 1000, time: t, segments: 14, jitter: 0.4 });
    ctx.restore();
    for (let i = 0; i < 14; i += 1) {
      const x = 30 + i * 94;
      inkLine(ctx, x, y + 14, x + 50, WORLD.h, { color: i % 2 ? p.accent : p.accent2, width: 5, alpha: 0.045, seed: 1001 + i, time: t, segments: 10, dry: 0.8 });
    }
  } else if (map.id === 'blank') {
    inkLine(ctx, 0, y, WORLD.w, y, { color: p.inkSoft, width: 1, alpha: 0.16, seed: 1002, time: t, segments: 14, jitter: 0.45, dry: 0.75 });
  } else {
    inkLine(ctx, -8, y, WORLD.w + 8, y, { color: p.ink, width: map.id === 'wash' ? 4.5 : 1.8, alpha: map.id === 'wash' ? 0.42 : 0.55, seed: 1003, time: t, segments: 14, jitter: map.id === 'wash' ? 1.4 : 0.45, dry: map.id === 'wash' ? 0.7 : 0.15 });
    inkLine(ctx, 0, y + 5, WORLD.w, y + 6, { color: p.inkSoft, width: 1, alpha: 0.12, seed: 1004, time: t, segments: 14, jitter: 0.5, dry: 0.5 });
  }
}

function drawPlatform(ctx, plat, map, t, index, quality) {
  const p = map.palette;
  const { x, y, w, h } = plat;
  const seed = 1100 + index * 20;
  if (map.id === 'blueprint') {
    inkLine(ctx, x, y, x + w, y, { color: p.ink, width: 2.2, alpha: 0.85, seed, time: t, segments: 12, jitter: 0.18 });
    inkLine(ctx, x, y + h, x + w, y + h, { color: p.ink, width: 1.8, alpha: 0.75, seed: seed + 1, time: t, segments: 12, jitter: 0.18 });
    for (let bx = x; bx < x + w - 20; bx += 32) {
      inkLine(ctx, bx, y + 2, Math.min(bx + 30, x + w), y + h - 2, { color: p.inkSoft, width: 0.8, alpha: 0.65, seed: seed + bx, time: t, segments: 8, jitter: 0.12 });
    }
    for (const rx of [x + 5, x + w - 5]) inkCircle(ctx, rx, y + h / 2, 1.8, { color: p.ink, width: 0.8, alpha: 0.8, seed: rx, segments: 8 });
  } else if (map.id === 'neon') {
    ctx.save();
    if (quality === 'high') { ctx.shadowColor = index % 2 ? p.accent : p.accent2; ctx.shadowBlur = 14; }
    inkLine(ctx, x, y + 2, x + w, y + 2, { color: index % 2 ? p.accent : p.accent2, width: 7, alpha: 0.12, seed, time: t, segments: 12, jitter: 0.2 });
    inkLine(ctx, x, y + 2, x + w, y + 2, { color: index % 2 ? p.accent : p.accent2, width: 2.5, alpha: 0.9, seed: seed + 1, time: t, segments: 12, jitter: 0.18 });
    inkLine(ctx, x + 4, y + 1, x + w - 4, y + 1, { color: '#ffffff', width: 0.8, alpha: 0.8, seed: seed + 2, time: t, segments: 12, jitter: 0.12 });
    ctx.restore();
  } else if (map.id === 'wash') {
    const points = [{ x: x - 4, y }, { x: x + w + 5, y: y + 1 }, { x: x + w - 8, y: y + h + 7 }, { x: x + w * 0.65, y: y + h + 3 }, { x: x + w * 0.4, y: y + h + 9 }, { x: x + 4, y: y + h + 3 }];
    roughPolygon(ctx, points, { color: p.ink, fill: p.inkSoft, fillAlpha: 0.09, width: 4.5, alpha: 0.55, seed, time: t, segments: 14, jitter: 1.5, dry: 0.78 });
    inkLine(ctx, x + 5, y + h + 7, x + w - 10, y + h + 12, { color: p.inkSoft, width: 7, alpha: 0.08, seed: seed + 1, time: t, segments: 12, jitter: 2, dry: 0.8 });
  } else if (map.id === 'blank') {
    const points = [{ x: x - 8, y: y - 4 }, { x: x + w + 8, y: y - 2 }, { x: x + w - 3, y: y + h + 9 }, { x: x + w * 0.75, y: y + h + 3 }, { x: x + w * 0.56, y: y + h + 12 }, { x: x + w * 0.31, y: y + h + 5 }, { x: x + 3, y: y + h + 10 }];
    roughPolygon(ctx, points, { color: p.inkSoft, fill: '#ffffff', fillAlpha: 0.65, width: 0.9, alpha: 0.32, seed, time: t, segments: 14, jitter: 0.8, dry: 0.5 });
  } else {
    inkLine(ctx, x - 6, y, x + w + 6, y, { color: p.ink, width: 1.8, alpha: 0.75, seed, time: t, segments: 12, jitter: 0.3 });
    inkLine(ctx, x, y + h, x + w, y + h, { color: p.inkSoft, width: 0.8, alpha: 0.35, seed: seed + 1, time: t, segments: 12, jitter: 0.25 });
    inkLine(ctx, x + 4, y + h + 5, x + w + 8, y + h + 6, { color: p.inkSoft, width: 2, alpha: 0.08, seed: seed + 2, time: t, segments: 12, jitter: 0.5 });
    for (let tx = x + 12; tx < x + w; tx += 24) inkLine(ctx, tx, y, tx, y + 4, { color: p.inkSoft, width: 0.6, alpha: 0.4, seed: tx, segments: 8, jitter: 0.12 });
  }
}

function drawHazards(ctx, map, t) {
  const p = map.palette;
  for (let i = 0; i < (map.hazards || []).length; i += 1) {
    const hz = map.hazards[i];
    const eraser = hz.type === 'eraser';
    roughPolygon(ctx, [
      { x: hz.x, y: hz.y - hz.h }, { x: hz.x + hz.w, y: hz.y - hz.h + 1 },
      { x: hz.x + hz.w - 4, y: hz.y }, { x: hz.x + 3, y: hz.y + 2 },
    ], {
      color: eraser ? '#ffffff' : p.accent,
      fill: eraser ? '#ffffff' : p.ink,
      fillAlpha: eraser ? 0.72 : 0.14,
      width: 2, alpha: eraser ? 0.8 : 0.32,
      seed: 1200 + i, time: t, segments: 12, jitter: 1.1, dry: 0.6,
    });
  }
}

function drawAmbient(ctx, map, t, quality) {
  const p = map.palette;
  const high = quality === 'high';
  const count = map.id === 'neon' ? (high ? 48 : 20) : map.id === 'wash' ? (high ? 16 : 7) : (high ? 22 : 9);
  for (let i = 0; i < count; i += 1) {
    const nx = noise(i * 5.3 + map.act * 11);
    const ny = noise(i * 8.7 + map.act * 17);
    if (map.ambient === 'rain') {
      const x = ((nx * WORLD.w - t * 72) % WORLD.w + WORLD.w) % WORLD.w;
      const y = (ny * WORLD.h + t * (230 + noise(i) * 170)) % WORLD.h;
      inkLine(ctx, x, y, x - 7, y + 19, { color: i % 4 ? p.accent : p.accent2, width: 0.75, alpha: 0.18 + noise(i) * 0.2, seed: i, time: t, segments: 8, jitter: 0.12 });
    } else if (map.ambient === 'petal') {
      const x = (nx * WORLD.w + Math.sin(t * 0.3 + i) * 35 + WORLD.w) % WORLD.w;
      const y = (ny * WORLD.h + t * (4 + noise(i) * 7)) % WORLD.h;
      if (i % 4 === 0) inkBlob(ctx, x, y, 3.5, 1.8, { color: p.accent, fill: p.accent, alpha: 0.35, fillAlpha: 0.22, width: 0.6, seed: i, time: t, jitter: 0.35 });
      else inkDrop(ctx, x, y, 0.8 + noise(i) * 1.2, p.inkSoft, 0.18, i);
    } else {
      const x = (nx * WORLD.w + t * (2 + noise(i) * 5)) % WORLD.w;
      const y = ny * WORLD.h + Math.sin(t * 0.35 + i) * 12;
      ctx.save();
      ctx.globalAlpha = map.id === 'blank' ? 0.5 : 0.25;
      ctx.fillStyle = map.id === 'blank' ? '#ffffff' : p.dust;
      ctx.beginPath();
      ctx.arc(x, y, map.id === 'blank' ? 1.8 : 0.7 + noise(i) * 0.9, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
}

export function drawPickups(ctx, pickups, palette, t, alpha) {
  for (let i = 0; i < pickups.length; i += 1) {
    const item = pickups[i];
    const x = item.x;
    const y = (item.py ?? item.y) + ((item.y - (item.py ?? item.y)) * alpha) + Math.sin(t * 3 + i) * 3;
    if (item.kind === 'weapon') {
      roughRect(ctx, x - 13, y - 10, 26, 20, { color: palette.ink, width: 1.5, alpha: 0.8, seed: 1300 + i, time: t, segments: 12, jitter: 0.35 });
      inkLine(ctx, x - 8, y + 4, x + 9, y - 5, { color: palette.accent, width: 3, alpha: 0.9, seed: 1310 + i, time: t, segments: 10 });
    } else if (item.kind === 'lore') {
      roughPolygon(ctx, [{ x: x - 10, y: y - 13 }, { x: x + 9, y: y - 11 }, { x: x + 11, y: y + 13 }, { x: x - 11, y: y + 10 }], { color: palette.inkSoft, fill: palette.bg2, fillAlpha: 0.8, width: 1, alpha: 0.75, seed: 1320 + i, time: t, segments: 12 });
      inkLine(ctx, x - 6, y - 4, x + 5, y - 3, { color: palette.inkSoft, width: 0.8, alpha: 0.5, seed: 1321 + i, segments: 8 });
      inkLine(ctx, x - 6, y + 2, x + 3, y + 3, { color: palette.inkSoft, width: 0.8, alpha: 0.5, seed: 1322 + i, segments: 8 });
    } else {
      inkDrop(ctx, x, y, 6, palette.accent, 0.9, 1330 + i);
      inkArc(ctx, x - 1, y - 1, 2, 3, Math.PI, Math.PI * 1.7, { color: palette.bg, width: 1, alpha: 0.7, seed: 1331 + i, segments: 8 });
    }
  }
}

export function createWorldRenderer() {
  const bases = new Map();
  const sceneries = new Map();

  function base(map) {
    if (!bases.has(map.id)) {
      const canvas = canvasLayer();
      const ctx = canvas.getContext('2d');
      ctx.drawImage(createPaper(map), 0, 0);
      if (map.id === 'draft') draftBase(ctx, map);
      else if (map.id === 'blueprint') blueprintBase(ctx, map);
      else if (map.id === 'neon') neonBase(ctx, map);
      else if (map.id === 'wash') washBase(ctx, map);
      else blankBase(ctx, map);
      bases.set(map.id, canvas);
    }
    return bases.get(map.id);
  }

  function scenery(map, quality) {
    const key = `${map.id}:${quality}`;
    if (!sceneries.has(key)) {
      const canvas = canvasLayer();
      const ctx = canvas.getContext('2d');
      for (const decor of map.decor || []) {
        if (!['tower', 'sign', 'mountain', 'petal', 'fragment'].includes(decor.type)) drawDecor(ctx, decor, map, 0, quality, 0);
      }
      drawGround(ctx, map, 0);
      (map.platforms || []).forEach((plat, i) => drawPlatform(ctx, plat, map, 0, i, quality));
      drawHazards(ctx, map, 0);
      sceneries.set(key, canvas);
    }
    return sceneries.get(key);
  }

  function draw(ctx, map, options) {
    const { t, quality, focusX = WORLD.w / 2 } = options;
    const drift = clamp((focusX - WORLD.w / 2) * -0.025, -16, 16);
    ctx.drawImage(base(map), 0, 0);
    drawMidground(ctx, map, t, drift);
    for (const decor of map.decor || []) {
      if (['tower', 'sign', 'mountain', 'petal', 'fragment'].includes(decor.type)) drawDecor(ctx, decor, map, t, quality, drift);
    }
    ctx.drawImage(scenery(map, quality), 0, 0);
    drawAmbient(ctx, map, t, quality);
  }

  function drawForeground(ctx, map, boss, t) {
    if (map.id !== 'blank' || !boss) return;
    const hp = clamp((boss.hp ?? 1) / (boss.maxHp || 1));
    if (hp >= 0.995) return;
    const amount = hp < 0.33 ? 0.2 : (1 - hp) * 0.16;
    const side = WORLD.w * amount;
    const vertical = WORLD.h * amount * 0.55;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let y = 0; y <= WORLD.h; y += 40) ctx.lineTo(side + Math.sin(y * 0.07 + t) * 13 + noise(y) * 14, y);
    ctx.lineTo(0, WORLD.h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(WORLD.w, 0);
    for (let y = 0; y <= WORLD.h; y += 40) ctx.lineTo(WORLD.w - side + Math.cos(y * 0.06 + t) * 13 - noise(y + 4) * 14, y);
    ctx.lineTo(WORLD.w, WORLD.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(0, 0, WORLD.w, vertical);
    ctx.fillRect(0, WORLD.h - vertical, WORLD.w, vertical);
    ctx.restore();
    inkLine(ctx, side, 0, side + 4, WORLD.h, { color: '#ffffff', width: 14, alpha: 0.75, seed: 1400, time: t, segments: 14, jitter: 4, dry: 0.6 });
    inkLine(ctx, WORLD.w - side, 0, WORLD.w - side - 4, WORLD.h, { color: '#ffffff', width: 14, alpha: 0.75, seed: 1401, time: t, segments: 14, jitter: 4, dry: 0.6 });
  }

  return { draw, drawForeground, clear: () => { bases.clear(); sceneries.clear(); } };
}
