// Canvas 2D 渲染：DUNE TAC TOE 沙漠场景 / 3×3 棋盘 / 仙人掌 & 蝎子棋子 / 胜线。
// 只消费 run.state（board/turn/mode/scene）+ view（hoverCell/fxQueue/shake/sceneKey）。
// 像素换算全部在此完成（sim 只给 0..8 的格子索引）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { X, O, winningLine } from '../game/sim.js';

const SCENE_PALETTES = {
  'dawn': {
    skyTop: '#FFE9B4', skyMid: '#F0C98A', skyBot: '#D9A85F',
    duneFar: '#C99A5C', duneNear: '#B8884C', ground: '#E3B877',
    tile: '#EDD2A0', tileBorder: '#C99A5C', tileCrack: '#C79B5E',
    glow: 'rgba(255,224,150,0.55)',
  },
  'dusk': {
    skyTop: '#C4552D', skyMid: '#9A3E3F', skyBot: '#6B2D5C',
    duneFar: '#7A3A55', duneNear: '#5C2A44', ground: '#8A4438',
    tile: '#B46A48', tileBorder: '#7A3A55', tileCrack: '#7A3A55',
    glow: 'rgba(255,150,80,0.45)',
  },
  'night': {
    skyTop: '#0E3B43', skyMid: '#123C5A', skyBot: '#0B2E38',
    duneFar: '#0F3240', duneNear: '#0C2834', ground: '#123C45',
    tile: '#1E4E5A', tileBorder: '#16404A', tileCrack: '#1A4E5C',
    glow: 'rgba(127,216,232,0.18)',
  },
};

// ---- 稳定伪随机（装饰用） ----
function seededRand(a, b, s = 7) {
  let h = (a * 73856093) ^ (b * 19349663) ^ (s * 83492791);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.dawn;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'night') { drawStars(g); drawMoon(g); }
  else if (sceneKey === 'dusk') { drawSunsetGlow(g, P); }
  else { drawSunGlow(g, P); }

  drawDunes(g, P, W, H);

  g.fillStyle = P.ground;
  g.fillRect(0, H * 0.66, W, H * 0.34);
  const grd = g.createLinearGradient(0, H * 0.66, 0, H);
  grd.addColorStop(0, P.ground);
  grd.addColorStop(1, P.skyBot);
  g.fillStyle = grd;
  g.fillRect(0, H * 0.66, W, H * 0.34);

  if (sceneKey === 'dawn') { drawCactusSilhouette(g, 90, 500, 1.0); drawCactusSilhouette(g, 1180, 520, 0.7); }
  if (sceneKey === 'dusk') drawPillars(g, P, W, H);
  if (sceneKey === 'night') drawRipples(g, P, W, H);
}

function drawStars(g) {
  for (let i = 0; i < 90; i += 1) {
    const x = seededRand(i, 1, 3) * WORLD.WIDTH;
    const y = seededRand(i, 2, 5) * WORLD.HEIGHT * 0.6;
    const r = 0.6 + seededRand(i, 3, 7) * 1.4;
    g.fillStyle = `rgba(220,240,255,${0.4 + seededRand(i, 4, 9) * 0.6})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
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
  g.beginPath(); g.arc(gx - 14, gy - 8, r * 0.22, 0, Math.PI * 2); g.arc(gx + 10, gy + 12, r * 0.16, 0, Math.PI * 2); g.fill();
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

function drawCactusSilhouette(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(60,120,70,0.55)';
  g.beginPath(); g.ellipse(0, 0, 16, 90, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(-34, -10, 11, 40, 0.6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(34, -6, 11, 38, -0.6, 0, Math.PI * 2); g.fill();
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

// ---- 布局：3×3 棋盘居中 ----
function computeLayout() {
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const board = Math.min(LAYOUT.BOARD_SIDE, W - LAYOUT.MARGIN_X * 2, H - LAYOUT.HUD_H - LAYOUT.MARGIN_Y * 2);
  const cell = Math.floor(board / 3);
  const gridW = cell * 3, gridH = cell * 3;
  const gridX = Math.floor((W - gridW) / 2);
  const gridY = LAYOUT.HUD_H + Math.floor((H - LAYOUT.HUD_H - gridH) / 2);
  return {
    grid: { x: gridX, y: gridY, w: gridW, h: gridH },
    cell,
    hud: { x: 0, y: 0, w: W, h: LAYOUT.HUD_H },
  };
}

function cellCenter(lay, idx) {
  const r = Math.floor(idx / 3), c = idx % 3;
  return { x: lay.grid.x + c * lay.cell + lay.cell / 2, y: lay.grid.y + r * lay.cell + lay.cell / 2 };
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

function drawBoard(ctx, lay, sceneKey, clock) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.dawn;
  const { cell } = lay;
  for (let i = 0; i < 9; i += 1) {
    const r = Math.floor(i / 3), c = i % 3;
    const x = lay.grid.x + c * cell, y = lay.grid.y + r * cell;
    ctx.fillStyle = P.tile;
    roundRect(ctx, x + 3, y + 3, cell - 6, cell - 6, Math.max(4, cell * 0.12));
    ctx.fill();
    ctx.strokeStyle = P.tileBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    // 龟裂纹装饰（短横线、低对比度，避免被误认为可交互斜线）
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = P.tileCrack;
    ctx.lineWidth = 1;
    const rr = (a, b, s) => seededRand(r, c, s) * (b - a) + a;
    if (seededRand(r, c, 21) > 0.35) {
      const cy = y + rr(6, cell - 6, 32);
      const cx = x + rr(6, cell - 14, 31);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + rr(4, 10, 33), cy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// 仙人掌（X）：绿色柱状 + 两臂，形状与颜色双编码
function drawCactus(ctx, x, y, cell, clock) {
  const s = cell / 160;
  const grow = Math.min(1, 0.25 + (clock || 0) * 0.0); // 占位：后续用动画 scale-in 由 fx 处理
  const scale = 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * scale, s * scale);
  const body = '#3E9B4F', dark = '#2E6E3A', hi = '#6ECF7A';

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(4, 46, 34, 12, 0, 0, Math.PI * 2); ctx.fill();

  // 两臂
  ctx.strokeStyle = dark; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-30, -8); ctx.lineTo(-30, -34); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(30, 0); ctx.lineTo(30, -30); ctx.stroke();
  ctx.strokeStyle = body; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-30, -8); ctx.lineTo(-30, -34); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(30, 0); ctx.lineTo(30, -30); ctx.stroke();

  // 主干
  ctx.fillStyle = dark;
  roundRect(ctx, -18, -44, 36, 88, 18); ctx.fill();
  ctx.fillStyle = body;
  roundRect(ctx, -14, -44, 28, 84, 16); ctx.fill();

  // 高光
  ctx.fillStyle = hi;
  ctx.beginPath(); ctx.ellipse(-5, -24, 3, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// 蝎子（O）：琥珀色，身体 + 双螯 + 弯尾毒针，形状与颜色双编码
function drawScorpion(ctx, x, y, cell, clock) {
  const s = cell / 160;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const body = '#E0A23E', dark = '#A9741F', hi = '#F6C768';

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(4, 44, 36, 12, 0, 0, Math.PI * 2); ctx.fill();

  // 弯尾（弧形毒针）
  ctx.strokeStyle = dark; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 20); ctx.quadraticCurveTo(44, 16, 40, -28); ctx.stroke();
  ctx.strokeStyle = body; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(0, 20); ctx.quadraticCurveTo(44, 16, 40, -28); ctx.stroke();
  // 毒针
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(40, -28); ctx.lineTo(50, -34); ctx.lineTo(40, -20); ctx.closePath(); ctx.fill();

  // 身体
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.ellipse(0, 14, 22, 34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 14, 18, 30, 0, 0, Math.PI * 2); ctx.fill();
  // 体节
  ctx.strokeStyle = dark; ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath(); ctx.moveTo(-16, i * 8 + 14); ctx.lineTo(16, i * 8 + 14); ctx.stroke();
  }

  // 双螯
  ctx.strokeStyle = dark; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-34, -24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(34, -24); ctx.stroke();
  ctx.strokeStyle = body; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-34, -24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(34, -24); ctx.stroke();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(-38, -26, 8, 0, Math.PI * 2); ctx.arc(38, -26, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(-38, -26, 5, 0, Math.PI * 2); ctx.arc(38, -26, 5, 0, Math.PI * 2); ctx.fill();

  // 高光
  ctx.fillStyle = hi;
  ctx.beginPath(); ctx.ellipse(-6, 0, 4, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPiece(ctx, lay, idx, piece, clock) {
  const { x, y } = cellCenter(lay, idx);
  if (piece === X) drawCactus(ctx, x, y, lay.cell, clock);
  else drawScorpion(ctx, x, y, lay.cell, clock);
}

function drawWinLine(ctx, lay, board) {
  const line = winningLine(board);
  if (!line) return;
  const a = cellCenter(lay, line[0]);
  const b = cellCenter(lay, line[2]);
  ctx.save();
  ctx.strokeStyle = '#FFD84E';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255,216,78,0.8)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;

  function resize(w, h) {
    return { w, h, world: { width: WORLD.WIDTH, height: WORLD.HEIGHT } };
  }

  function debugLayout() {
    return computeLayout();
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('dawn'), 0, 0);
    // 标题屏装饰：一对棋子
    const lay = computeLayout();
    drawCactus(ctx, WORLD.WIDTH / 2 - 120, 430, 150, clock);
    drawScorpion(ctx, WORLD.WIDTH / 2 + 120, 430, 150, clock);
  }

  function draw(state, dt, view) {
    if (!state || !state.board) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.scene || v.sceneKey || 'dawn';
    clock += dt || 0;

    const lay = computeLayout();
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);
    drawBoard(ctx, lay, sceneKey, clock);

    // 落子
    for (let i = 0; i < 9; i += 1) {
      if (state.board[i]) drawPiece(ctx, lay, i, state.board[i], clock);
    }

    // 悬停高亮
    if (v.hoverCell != null && !state.board[v.hoverCell] && state.phase === 'playing') {
      const { x, y } = cellCenter(lay, v.hoverCell);
      const r = lay.cell / 2 - 6;
      ctx.strokeStyle = 'rgba(255,216,120,0.95)';
      ctx.lineWidth = 3;
      roundRect(ctx, x - r, y - r, r * 2, r * 2, 14);
      ctx.stroke();
    }

    // 特效队列（落子沙尘/闪光）
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.type === 'place' && fx.ttl > 0) {
          const { x, y } = cellCenter(lay, fx.cell);
          ctx.fillStyle = `rgba(255,236,170,${(fx.ttl / 0.4) * 0.5})`;
          ctx.beginPath(); ctx.arc(x, y, lay.cell * 0.42, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    drawWinLine(ctx, lay, state.board);

    ctx.restore();
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize };
}
