// Canvas 2D 渲染：Oasis Pipeworks 场景 / 管件 / 水流 / 队列 / 小狐狸。
// 只消费 run.state（契约 §3.4）+ view（hoverCell/selectedPiece/cursor/fxQueue/shake/sceneKey）。
// 像素换算全部在此完成（sim 只给 r,c 与归一化进度 t）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { SCENES, createMockState, seededRand } from './mock.js';

const WATER = '#7FD8E8';
const WATER_GLOW = 'rgba(127,216,232,0.55)';
const CAVITY = '#3B2412';

const SCENE_PALETTES = {
  'dawn-desert': {
    skyTop: '#FFE9B4', skyMid: '#E8C78A', skyBot: '#D9A85F',
    duneFar: '#C99A5C', duneNear: '#B8884C', ground: '#E3B877',
    tile: '#EBD098', tileBorder: '#C99A5C', tileCrack: '#C79B5E',
    rock: '#A98354', rockDark: '#8A6A40', rockHi: '#C7A06A',
    glow: 'rgba(255,224,150,0.55)',
  },
  'dusk-canyon': {
    skyTop: '#C4552D', skyMid: '#9A3E3F', skyBot: '#6B2D5C',
    duneFar: '#7A3A55', duneNear: '#5C2A44', ground: '#8A4438',
    tile: '#A85A3E', tileBorder: '#7A3A55', tileCrack: '#7A3A55',
    rock: '#6E4A44', rockDark: '#55363B', rockHi: '#8A5A4E',
    glow: 'rgba(255,150,80,0.45)',
  },
  'night-oasis': {
    skyTop: '#0E3B43', skyMid: '#123C5A', skyBot: '#0B2E38',
    duneFar: '#0F3240', duneNear: '#0C2834', ground: '#123C45',
    tile: '#1B4A55', tileBorder: '#16404A', tileCrack: '#1A4E5C',
    rock: '#2A4A50', rockDark: '#1F3A42', rockHi: '#3A5A60',
    glow: 'rgba(127,216,232,0.18)',
  },
};

const EDGE_DIR = { top: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

// ---- 静态背景离屏缓存（每帧只 drawImage 一次） ----
const bgCache = new Map();

function getBackground(sceneKey) {
  let c = bgCache.get(sceneKey);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  drawBackground(c.getContext('2d'), sceneKey);
  bgCache.set(sceneKey, c);
  return c;
}

function drawBackground(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['dawn-desert'];
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'night-oasis') {
    drawStars(g);
    drawMoon(g);
  } else if (sceneKey === 'dusk-canyon') {
    drawSunsetGlow(g, P);
  } else {
    drawSunGlow(g, P);
  }

  drawDunes(g, P, W, H);

  g.fillStyle = P.ground;
  g.fillRect(0, H * 0.66, W, H * 0.34);
  const grd = g.createLinearGradient(0, H * 0.66, 0, H);
  grd.addColorStop(0, P.ground);
  grd.addColorStop(1, P.skyBot);
  g.fillStyle = grd;
  g.fillRect(0, H * 0.66, W, H * 0.34);

  if (sceneKey === 'dawn-desert') { drawPalm(g, 90, 470, 1.0); drawPalm(g, 1190, 500, 0.8); }
  if (sceneKey === 'dusk-canyon') drawPillars(g, P, W, H);
  if (sceneKey === 'night-oasis') drawRipples(g, P, W, H);
}

function drawStars(g) {
  for (let i = 0; i < 90; i += 1) {
    const x = seededRand(i, 1, 3) * WORLD.WIDTH;
    const y = seededRand(i, 2, 5) * WORLD.HEIGHT * 0.6;
    const r = 0.6 + seededRand(i, 3, 7) * 1.4;
    g.fillStyle = `rgba(220,240,255,${0.4 + seededRand(i, 4, 9) * 0.6})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

function drawMoon(g) {
  const gx = WORLD.WIDTH - 200, gy = 120, r = 44;
  const halo = g.createRadialGradient(gx, gy, r * 0.5, gx, gy, r * 2.6);
  halo.addColorStop(0, 'rgba(210,235,255,0.5)');
  halo.addColorStop(1, 'rgba(210,235,255,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(gx, gy, r * 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#E8F2FF';
  g.beginPath(); g.arc(gx, gy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(160,190,220,0.5)';
  g.beginPath();
  g.arc(gx - 14, gy - 8, r * 0.22, 0, Math.PI * 2);
  g.arc(gx + 10, gy + 12, r * 0.16, 0, Math.PI * 2);
  g.fill();
}

function drawSunGlow(g, P) {
  const gx = 170, gy = 150;
  const halo = g.createRadialGradient(gx, gy, 20, gx, gy, 300);
  halo.addColorStop(0, P.glow);
  halo.addColorStop(1, 'rgba(255,224,150,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
}

function drawSunsetGlow(g, P) {
  const gx = WORLD.WIDTH - 220, gy = 210;
  const halo = g.createRadialGradient(gx, gy, 20, gx, gy, 340);
  halo.addColorStop(0, P.glow);
  halo.addColorStop(1, 'rgba(255,150,80,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
}

function drawDunes(g, P, W, H) {
  const farY = H * 0.66, nearY = H * 0.78;
  g.fillStyle = P.duneFar;
  g.beginPath();
  g.moveTo(0, farY);
  for (let i = 0; i <= 6; i += 1) {
    const x = (W / 6) * i;
    g.lineTo(x, farY - Math.sin(i * 1.7 + 0.5) * 70 - 20);
  }
  g.lineTo(W, farY + 60); g.lineTo(0, farY + 60); g.closePath(); g.fill();

  g.fillStyle = P.duneNear;
  g.beginPath();
  g.moveTo(0, nearY);
  for (let i = 0; i <= 7; i += 1) {
    const x = (W / 7) * i;
    g.lineTo(x, nearY - Math.sin(i * 2.1 + 2.0) * 50 - 14);
  }
  g.lineTo(W, nearY + 50); g.lineTo(0, nearY + 50); g.closePath(); g.fill();
}

function drawPalm(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = '#7A5A38'; g.lineWidth = 10; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(14, -80, 8, -150); g.stroke();
  g.fillStyle = '#6E8F4E';
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.5;
    g.save(); g.rotate(a);
    g.beginPath(); g.ellipse(0, -150, 14, 46, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.restore();
}

function drawPillars(g, P, W, H) {
  g.fillStyle = P.duneNear;
  for (let i = 0; i < 4; i += 1) {
    const x = 260 + i * 250 + seededRand(i, 7, 11) * 40;
    const w = 60 + seededRand(i, 9, 13) * 40;
    const h = 220 + seededRand(i, 5, 17) * 120;
    g.beginPath();
    g.moveTo(x, H); g.lineTo(x, H - h); g.lineTo(x + w, H - h + 40); g.lineTo(x + w, H); g.closePath(); g.fill();
  }
}

function drawRipples(g, P, W, H) {
  g.strokeStyle = 'rgba(127,216,232,0.16)';
  g.lineWidth = 2;
  for (let i = 0; i < 9; i += 1) {
    const y = H * 0.72 + i * 22;
    g.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const yy = y + Math.sin(x * 0.02 + i * 1.4) * 3;
      if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }
}

// ---- 管件几何 ----
function opens(piece) {
  switch (piece) {
    case 'E': return ['left', 'right'];
    case 'N': return ['top', 'down'];
    case 'UL': return ['left', 'top'];
    case 'UR': return ['top', 'right'];
    case 'LL': return ['left', 'down'];
    case 'LR': return ['down', 'right'];
    case 'X': return ['left', 'right', 'top', 'down'];
    default: return ['left', 'right'];
  }
}

function pipeSegments(piece, cx, cy, h) {
  switch (piece) {
    case 'E': return [{ type: 'line', x1: cx - h, y1: cy, x2: cx + h, y2: cy }];
    case 'N': return [{ type: 'line', x1: cx, y1: cy - h, x2: cx, y2: cy + h }];
    case 'UL': return [{ type: 'arc', cx, cy, r: h, a0: Math.PI, a1: Math.PI * 1.5 }];
    case 'UR': return [{ type: 'arc', cx, cy, r: h, a0: Math.PI * 1.5, a1: Math.PI * 2 }];
    case 'LL': return [{ type: 'arc', cx, cy, r: h, a0: Math.PI / 2, a1: Math.PI }];
    case 'LR': return [{ type: 'arc', cx, cy, r: h, a0: 0, a1: Math.PI / 2 }];
    case 'X': return [
      { type: 'line', x1: cx - h, y1: cy, x2: cx + h, y2: cy },
      { type: 'line', x1: cx, y1: cy - h, x2: cx, y2: cy + h },
    ];
    default: return [{ type: 'line', x1: cx - h, y1: cy, x2: cx + h, y2: cy }];
  }
}

function strokeSeg(ctx, seg, width, style, inset = 0) {
  ctx.lineWidth = width;
  ctx.strokeStyle = style;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (seg.type === 'line') {
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
    const len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * inset, py = (dx / len) * inset;
    ctx.moveTo(seg.x1 + px, seg.y1 + py);
    ctx.lineTo(seg.x2 + px, seg.y2 + py);
  } else {
    ctx.arc(seg.cx, seg.cy, seg.r + inset, seg.a0, seg.a1);
  }
  ctx.stroke();
}

function drawFlange(ctx, cx, cy, h, edge, cell) {
  const d = EDGE_DIR[edge] || EDGE_DIR.top;
  const px = cx + d.x * h, py = cy + d.y * h;
  const perp = { x: -d.y, y: d.x };
  const len = cell * 0.62;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7B3F15';
  ctx.lineWidth = cell * 0.2;
  ctx.beginPath();
  ctx.moveTo(px - perp.x * len / 2, py - perp.y * len / 2);
  ctx.lineTo(px + perp.x * len / 2, py + perp.y * len / 2);
  ctx.stroke();
  ctx.strokeStyle = '#D2691E';
  ctx.lineWidth = cell * 0.13;
  ctx.beginPath();
  ctx.moveTo(px - perp.x * len / 2, py - perp.y * len / 2);
  ctx.lineTo(px + perp.x * len / 2, py + perp.y * len / 2);
  ctx.stroke();
}

function pipeGradient(ctx, cx, cy, cell) {
  const h = cell / 2;
  const grad = ctx.createLinearGradient(cx - h, cy - h, cx + h, cy + h);
  grad.addColorStop(0, '#B0603A');
  grad.addColorStop(0.55, '#A0522D');
  grad.addColorStop(1, '#8B4513');
  return grad;
}

function drawPipe(ctx, cx, cy, cell, piece, opts = {}) {
  const h = cell / 2;
  const outerW = cell * 0.46;
  const cavityW = cell * 0.26;
  const segs = pipeSegments(piece, cx, cy, h);
  const outer = pipeGradient(ctx, cx, cy, cell);

  for (const seg of segs) strokeSeg(ctx, seg, outerW, outer);
  const cav = opts.cavity || CAVITY;
  for (const seg of segs) strokeSeg(ctx, seg, cavityW, cav);

  if (piece === 'X') {
    strokeSeg(ctx, segs[1], outerW, 'rgba(0,0,0,0.12)');
    strokeSeg(ctx, segs[1], cavityW, cav);
  }

  if (!opts.noHighlight) {
    for (const seg of segs) strokeSeg(ctx, seg, outerW * 0.4, 'rgba(255,255,255,0.16)', outerW * 0.18);
  }

  for (const e of opens(piece)) drawFlange(ctx, cx, cy, h, e, cell);
}

// ---- 小狐狸（程序化，≤25 图元） ----
function drawFox(ctx, x, y, size, pose, clock) {
  const s = size / 96;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const breathe = Math.sin(clock * 2.4) * 2;
  const jump = pose === 'cheer' ? Math.abs(Math.sin(clock * 6)) * -8 : 0;
  const tailSway = Math.sin(clock * 3.0) * 6;
  ctx.translate(0, breathe + jump);

  ctx.fillStyle = '#E8833A';
  ctx.beginPath(); ctx.ellipse(-34, 26 + tailSway * 0.3, 30, 16, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#F5E6D0';
  ctx.beginPath(); ctx.ellipse(-52, 20 + tailSway, 12, 8, -0.5, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#E8833A';
  ctx.beginPath(); ctx.ellipse(0, 26, 26, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#F5E6D0';
  ctx.beginPath(); ctx.ellipse(0, 34, 16, 12, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#E8833A';
  ctx.beginPath(); ctx.arc(0, -8, 26, 0, Math.PI * 2); ctx.fill();

  const earUp = pose === 'carry' ? -6 : 0;
  ctx.fillStyle = '#C96A2E';
  ctx.beginPath(); ctx.moveTo(-20, -28 + earUp); ctx.lineTo(-26, -52 + earUp); ctx.lineTo(-8, -38 + earUp); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(20, -28 + earUp); ctx.lineTo(26, -52 + earUp); ctx.lineTo(8, -38 + earUp); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#F0A060';
  ctx.beginPath(); ctx.moveTo(-17, -30 + earUp); ctx.lineTo(-22, -46 + earUp); ctx.lineTo(-11, -37 + earUp); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(17, -30 + earUp); ctx.lineTo(22, -46 + earUp); ctx.lineTo(11, -37 + earUp); ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#F5E6D0';
  ctx.beginPath(); ctx.ellipse(0, 4, 16, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3A2412';
  ctx.beginPath(); ctx.arc(0, 2, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2A1A0C';
  ctx.beginPath(); ctx.arc(-11, -10, 3.4, 0, Math.PI * 2); ctx.arc(11, -10, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-10, -11, 1.2, 0, Math.PI * 2); ctx.arc(12, -11, 1.2, 0, Math.PI * 2); ctx.fill();

  if (pose === 'carry') {
    ctx.fillStyle = '#B0603A';
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -58, 13, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  ctx.restore();
}

// ---- 花朵 / 岩石 ----
function drawFlower(ctx, cx, cy, cell, watered, clock) {
  const r = cell * 0.28;
  if (!watered) {
    // 未浇水的花：白色光环提示「这是目标」
    const g = 0.3 + 0.18 * Math.sin((clock || 0) * 3);
    ctx.strokeStyle = `rgba(255,255,255,${g})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.3, r * 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#5E8A46';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy + r); ctx.lineTo(cx, cy - r * 0.3); ctx.stroke();
    ctx.fillStyle = '#E0735E';
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.4, r * 0.55, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8E4A3A';
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.3, r * 0.3, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const pulse = 1 + Math.sin(clock * 5) * 0.06;
  ctx.fillStyle = '#E0537A';
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, r * 0.5, r * 0.9 * pulse, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#FFD84E';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2); ctx.fill();
}

function drawRock(ctx, cx, cy, cell, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['dawn-desert'];
  const r = cell * 0.4;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx + 3, cy + r * 0.8, r, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, P.rockHi);
  grad.addColorStop(1, P.rockDark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy + r * 0.3);
  ctx.lineTo(cx - r * 0.5, cy - r);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.8);
  ctx.lineTo(cx + r, cy + r * 0.2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = P.rockDark;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ---- 网格底板（龟裂地纹） ----
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGridBase(ctx, state, layout, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['dawn-desert'];
  const { rows, cols } = state;
  const { cell, gridX, gridY } = layout;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = gridX + c * cell, y = gridY + r * cell;
      ctx.fillStyle = P.tile;
      roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, Math.max(4, cell * 0.12));
      ctx.fill();
      ctx.strokeStyle = P.tileBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = P.tileCrack;
      ctx.lineWidth = 1;
      const rr = (a, b, s) => seededRand(r, c, a) * (b - a) + a;
      if (seededRand(r, c, 21) > 0.35) {
        ctx.beginPath();
        ctx.moveTo(x + rr(3, cell - 3, 31), y + rr(3, cell - 3, 32));
        ctx.lineTo(x + rr(3, cell - 3, 33), y + rr(3, cell - 3, 34));
        ctx.stroke();
      }
      if (seededRand(r, c, 41) > 0.55) {
        ctx.beginPath();
        ctx.moveTo(x + rr(3, cell - 3, 51), y + rr(3, cell - 3, 52));
        ctx.lineTo(x + rr(3, cell - 3, 53), y + rr(3, cell - 3, 54));
        ctx.stroke();
      }
    }
  }
}

// ---- 水流 ----
const PIECE_PORTS = {
  E: { type: 'line', a: { edge: 'left' }, b: { edge: 'right' } },
  N: { type: 'line', a: { edge: 'top' }, b: { edge: 'down' } },
  UL: { type: 'arc', a: { edge: 'left', ang: Math.PI }, b: { edge: 'top', ang: Math.PI * 1.5 } },
  UR: { type: 'arc', a: { edge: 'top', ang: Math.PI * 1.5 }, b: { edge: 'right', ang: Math.PI * 2 } },
  LL: { type: 'arc', a: { edge: 'down', ang: Math.PI / 2 }, b: { edge: 'left', ang: Math.PI } },
  LR: { type: 'arc', a: { edge: 'right', ang: 0 }, b: { edge: 'down', ang: Math.PI / 2 } },
};

function portPoint(cx, cy, h, edge) {
  const d = EDGE_DIR[edge] || EDGE_DIR.top;
  return { x: cx + d.x * h, y: cy + d.y * h };
}

function edgeFromTo(from, to) {
  if (to.c < from.c) return 'left';
  if (to.c > from.c) return 'right';
  if (to.r < from.r) return 'top';
  return 'down';
}

function lerpPt(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function drawPartialWater(ctx, cx, cy, cell, piece, entranceEdge, t) {
  const pp = PIECE_PORTS[piece];
  if (!pp) return null;
  const h = cell / 2;
  const cavityW = cell * 0.26;
  ctx.strokeStyle = WATER;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = cavityW;
  ctx.lineCap = 'round';
  let front = null;

  if (pp.type === 'line') {
    const pa = portPoint(cx, cy, h, pp.a.edge);
    const pb = portPoint(cx, cy, h, pp.b.edge);
    const start = entranceEdge === pp.a.edge ? pa : pb;
    const end = entranceEdge === pp.a.edge ? pb : pa;
    front = lerpPt(start, end, t);
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(front.x, front.y); ctx.stroke();
  } else {
    const fwd = entranceEdge === pp.a.edge;
    const startAng = fwd ? pp.a.ang : pp.b.ang;
    const endAng = fwd ? pp.b.ang : pp.a.ang;
    const curAng = startAng + (endAng - startAng) * t;
    front = { x: cx + Math.cos(curAng) * h, y: cy + Math.sin(curAng) * h };
    ctx.beginPath(); ctx.arc(cx, cy, h, startAng, curAng, !fwd); ctx.stroke();
  }

  ctx.globalAlpha = 1;
  return front;
}

function drawWater(ctx, state, layout) {
  const { water } = state;
  if (!water || !water.cells || water.cells.length === 0) return;
  const { cell, gridX, gridY } = layout;
  const head = Math.min(water.head, water.cells.length - 1);

  if (head >= 0 && head < water.cells.length) {
    const cur = water.cells[head];
    const g = state.grid[cur.r] && state.grid[cur.r][cur.c];
    if (g && (g.kind === 'pipe' || g.kind === 'end')) {
      const cx = gridX + cur.c * cell + cell / 2;
      const cy = gridY + cur.r * cell + cell / 2;
      const prev = water.cells[Math.max(0, head - 1)];
      const entrance = cur.enter || edgeFromTo(cur, prev);
      const t = water.t != null ? Math.min(1, Math.max(0, water.t)) : 0;
      const front = drawPartialWater(ctx, cx, cy, cell, g.piece, entrance, t);
      if (front && t > 0.02) {
        const glow = ctx.createRadialGradient(front.x, front.y, 2, front.x, front.y, cell * 0.34);
        glow.addColorStop(0, 'rgba(255,255,255,0.95)');
        glow.addColorStop(0.4, WATER_GLOW);
        glow.addColorStop(1, 'rgba(127,216,232,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(front.x, front.y, cell * 0.34, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

// ---- 等待区队列 ----
function drawQueue(ctx, state, layout, clock) {
  const { queue, queueCap } = state;
  const { queueX, queueY, queueSlotH, queueW, cell } = layout;
  const slotW = Math.min(cell * 0.9, queueW - 12);

  for (let i = 0; i < queueCap; i += 1) {
    const item = queue[queueCap - 1 - i]; // index 0 = 底槽
    const x = queueX + (queueW - slotW) / 2;
    const y = queueY + (queueCap - 1 - i) * queueSlotH;
    const offset = item ? -item.offsetT * queueSlotH : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(ctx, x - 6, y - queueSlotH / 2 + 4, slotW + 12, queueSlotH - 12, 10);
    ctx.fill();

    if (item && item.piece) {
      drawPipe(ctx, x + slotW / 2, y + offset, slotW * 0.7, item.piece);
      if (item.locked) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        roundRect(ctx, x + slotW / 2 - 18, y + offset - 18, 36, 36, 8);
        ctx.fill();
        ctx.fillStyle = '#FFD84E';
        ctx.font = '700 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒', x + slotW / 2, y + offset + 1);
      }
    }
  }

  // NEXT 标签：胶囊底衬，保证任何场景下可读
  const nx = queueX + queueW / 2, ny = queueY - queueSlotH / 2 - 10;
  ctx.fillStyle = 'rgba(20,16,8,0.82)';
  roundRect(ctx, nx - 34, ny - 12, 68, 24, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, nx - 34, ny - 12, 68, 24, 12);
  ctx.stroke();
  ctx.fillStyle = '#FFE9B4';
  ctx.font = '800 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEXT', nx, ny + 1);
  ctx.beginPath();
  ctx.moveTo(queueX + queueW / 2, queueY - queueSlotH / 2 + 2);
  ctx.lineTo(queueX + queueW / 2 - 8, queueY - queueSlotH / 2 - 4);
  ctx.lineTo(queueX + queueW / 2 + 8, queueY - queueSlotH / 2 - 4);
  ctx.closePath(); ctx.fill();
}

// ---- 进出水箭头 ----
function arrow(ctx, x, y, dx, dy, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.6);
  ctx.lineTo(0, -size * 0.6);
  ctx.lineTo(size * 0.7, -size * 0.1);
  ctx.lineTo(size * 0.7, size * 0.1);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawArrows(ctx, state, layout, clock) {
  const { cell, gridX, gridY } = layout;
  const s = state.start, e = state.end;
  const scx = gridX + s.c * cell + cell / 2, scy = gridY + s.r * cell + cell / 2;
  const ecx = gridX + e.c * cell + cell / 2, ecy = gridY + e.r * cell + cell / 2;
  // 起点：水从 entrance 边进入（箭头朝内）+ 脉冲供水环
  const sd = EDGE_DIR[s.entrance] || EDGE_DIR.top;
  arrow(ctx, scx + sd.x * cell * 0.7, scy + sd.y * cell * 0.7, -sd.x, -sd.y, cell * 0.5, '#4FB3D0');
  const sp = (clock || 0) * 2;
  ctx.strokeStyle = `rgba(79,179,208,${0.35 + 0.2 * Math.sin(sp)})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(scx, scy, cell * 0.52, 0, Math.PI * 2); ctx.stroke();
  // 终点：出口箭头 + 绿洲目标徽记（脉冲金环 + 旗标 + 水池点）
  const ed = EDGE_DIR[e.exit] || EDGE_DIR.down;
  arrow(ctx, ecx + ed.x * cell * 0.7, ecy + ed.y * cell * 0.7, ed.x, ed.y, cell * 0.5, '#FFD84E');
  const pulse = 0.5 + 0.5 * Math.sin((clock || 0) * 3.2);
  ctx.strokeStyle = `rgba(255,216,78,${0.55 + 0.35 * pulse})`;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(ecx, ecy, cell * (0.5 + 0.1 * pulse), 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = `rgba(255,216,78,${0.25 + 0.2 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ecx, ecy, cell * (0.62 + 0.12 * pulse), 0, Math.PI * 2); ctx.stroke();
  // 终点小旗
  ctx.fillStyle = '#2E9E5B';
  ctx.strokeStyle = '#FFF6DE';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ecx - cell * 0.08, ecy + cell * 0.18);
  ctx.lineTo(ecx - cell * 0.08, ecy - cell * 0.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ecx - cell * 0.08, ecy - cell * 0.22);
  ctx.lineTo(ecx + cell * 0.26, ecy - cell * 0.1);
  ctx.lineTo(ecx - cell * 0.08, ecy + cell * 0.02);
  ctx.closePath();
  ctx.fill();
}

// ---- 布局（契约 §3.1，render 从 config 计算，sim 不依赖像素） ----
function computeLayout(state) {
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const gridAreaW = W - LAYOUT.MARGIN_X * 2 - LAYOUT.QUEUE_W - LAYOUT.QUEUE_GAP;
  const gridAreaH = H - LAYOUT.HUD_H - LAYOUT.MARGIN_Y * 2;
  const { rows, cols } = state;
  const cell = Math.min(gridAreaW / cols, gridAreaH / rows, LAYOUT.CELL_MAX);
  const gridW = cell * cols, gridH = cell * rows;
  const gridX = LAYOUT.MARGIN_X + Math.floor((gridAreaW - gridW) / 2);
  const gridY = LAYOUT.HUD_H + LAYOUT.MARGIN_Y + Math.floor((gridAreaH - gridH) / 2);
  const queueX = W - LAYOUT.MARGIN_X - LAYOUT.QUEUE_W;
  const queueW = LAYOUT.QUEUE_W;
  const queueSlotH = Math.min(cell * 0.9, 92);
  const queueH = state.queueCap * queueSlotH;
  const queueY = gridY + Math.floor((gridH - queueH) / 2);
  const fox = {
    size: LAYOUT.FOX_W,
    x: Math.max(6, gridX - LAYOUT.FOX_W + 12),
    y: gridY + gridH - LAYOUT.FOX_W + 10,
  };
  return { cell, gridX, gridY, gridW, gridH, queueX, queueY, queueSlotH, queueW, fox, hudH: LAYOUT.HUD_H };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;

  function resize(w, h) {
    return { w, h, world: { width: WORLD.WIDTH, height: WORLD.HEIGHT } };
  }

  function debugLayout() {
    if (!lastState) return null;
    const L = computeLayout(lastState);
    return {
      grid: { x: L.gridX, y: L.gridY, w: L.gridW, h: L.gridH },
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: L.hudH },
      queue: { x: L.queueX, y: L.queueY, w: L.queueW, h: L.queueSlotH * lastState.queueCap },
      cell: L.cell,
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('dawn-desert'), 0, 0);
    drawFox(ctx, WORLD.WIDTH / 2, 560, 120, 'idle', clock);
  }

  function draw(state, dt, view) {
    if (!state || !state.grid) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.sceneKey || v.sceneKey || 'dawn-desert';
    clock += dt || 0;
    lastState = state;

    const L = computeLayout(state);

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);

    if (sceneKey === 'night-oasis') {
      for (let i = 0; i < 8; i += 1) {
        const fx = seededRand(i, 1, 13) * WORLD.WIDTH;
        const fy = WORLD.HEIGHT * 0.5 + Math.sin(clock * 1.2 + i * 2.1) * 90 + seededRand(i, 2, 17) * 80;
        const a = 0.3 + Math.sin(clock * 2.6 + i) * 0.25;
        ctx.fillStyle = `rgba(190,255,160,${Math.max(0, a)})`;
        ctx.beginPath(); ctx.arc(fx, fy, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }

    drawGridBase(ctx, state, L, sceneKey);

    const { rows, cols, grid } = state;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const g = grid[r][c];
        if (!g) continue;
        const cx = L.gridX + c * L.cell + L.cell / 2;
        const cy = L.gridY + r * L.cell + L.cell / 2;
        if (g.kind === 'rock') {
          drawRock(ctx, cx, cy, L.cell, sceneKey);
        } else if (g.kind === 'bloom' || g.bloom) {
          drawFlower(ctx, cx, cy, L.cell, g.watered, clock);
        }
        if (g.kind === 'pipe' || g.kind === 'start' || g.kind === 'end') {
          const filled = g.watered && g.waterT >= 1;
          drawPipe(ctx, cx, cy, L.cell, g.piece, { cavity: filled ? WATER : CAVITY });
        }
      }
    }

    // hover 高亮（digMode 时偏红提示）
    if (v.hoverCell) {
      const { r, c } = v.hoverCell;
      if (grid[r] && grid[r][c]) {
        const x = L.gridX + c * L.cell, y = L.gridY + r * L.cell;
        ctx.strokeStyle = v.digMode ? 'rgba(255,120,100,0.95)' : 'rgba(255,216,120,0.95)';
        ctx.lineWidth = 3;
        roundRect(ctx, x + 2, y + 2, L.cell - 4, L.cell - 4, Math.max(4, L.cell * 0.12));
        ctx.stroke();
      }
    }

    // cellWatered 泛光特效（fxQueue）
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.type === 'waterFlash' && fx.ttl > 0 && grid[fx.r] && grid[fx.r][fx.c]) {
          const x = L.gridX + fx.c * L.cell, y = L.gridY + fx.r * L.cell;
          ctx.fillStyle = `rgba(127,216,232,${(fx.ttl / 0.4) * 0.5})`;
          roundRect(ctx, x, y, L.cell, L.cell, Math.max(4, L.cell * 0.12));
          ctx.fill();
        }
      }
    }

    drawWater(ctx, state, L);
    drawArrows(ctx, state, L, clock);
    drawQueue(ctx, state, L, clock);

    if (v.selectedPiece && v.cursor) {
      drawPipe(ctx, v.cursor.x, v.cursor.y, L.cell * 0.7, v.selectedPiece);
    }

    const pose = state.phase === 'won' ? 'cheer' : (state.selected || v.selectedPiece ? 'carry' : 'idle');
    drawFox(ctx, L.fox.x + L.fox.size / 2, L.fox.y + L.fox.size / 2, L.fox.size, pose, clock);

    ctx.restore();
  }

  // 调试入口：--eval 驱动三场景截图（render-demo 契约）
  function __renderDemo(sceneKey) {
    const key = SCENES.includes(sceneKey) ? sceneKey : 'dawn-desert';
    lastState = createMockState(key);
    draw(lastState, 0, { sceneKey: key });
  }

  if (typeof window !== 'undefined') {
    window.__renderDemo = __renderDemo;
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize, __renderDemo };
}
