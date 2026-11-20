// Canvas 2D 渲染：纸灯笼节三场景 / 灯笼网格 / 特殊标记 / 爆破粒子 / 孔明灯升空。
// 只消费 run.state（契约）+ view（cursor/hoverCell/fx/rises/glow/shake/sceneKey）。
// 像素换算全部在此完成（sim 只给 r,c）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, LAYOUT } from '../../config/game.config.js';

// 灯笼配色：main=主体，glow=光晕，hi=高光
const COLORS = {
  coral: { main: '#FF6B5E', dark: '#D9473B', hi: '#FFC0B8', glow: 'rgba(255,107,94,0.55)' },
  amber: { main: '#FF9F2E', dark: '#D97A14', hi: '#FFD8A0', glow: 'rgba(255,159,46,0.55)' },
  gold: { main: '#FFC93E', dark: '#D9A013', hi: '#FFF0B0', glow: 'rgba(255,201,62,0.6)' },
  jade: { main: '#3FC77C', dark: '#22995A', hi: '#B8F0D0', glow: 'rgba(63,199,124,0.55)' },
  sky: { main: '#42A9E8', dark: '#1F7FB8', hi: '#B8E2FF', glow: 'rgba(66,169,232,0.55)' },
  violet: { main: '#9A6BE8', dark: '#6F45B8', hi: '#D8C2FF', glow: 'rgba(154,107,232,0.55)' },
};

// 三场景色板（黄昏集会 / 夜空灯节 / 晨雾山谷）
const SCENES = {
  dusk: {
    skyTop: '#FF9E5E', skyMid: '#E8694E', skyBot: '#7A3A55',
    far: '#C4552D', near: '#7A3A55',
    tile: 'rgba(40,22,34,0.55)', tileBorder: 'rgba(255,210,150,0.5)',
    glow: 'rgba(255,180,90,0.35)',
    name: 'dusk',
  },
  night: {
    skyTop: '#0B1630', skyMid: '#12244A', skyBot: '#1B3A5E',
    far: '#0E1E38', near: '#0A1628',
    tile: 'rgba(8,12,26,0.5)', tileBorder: 'rgba(120,180,255,0.4)',
    glow: 'rgba(120,190,255,0.2)',
    name: 'night',
  },
  mist: {
    skyTop: '#BFE3E0', skyMid: '#9CC8C8', skyBot: '#6B9FA6',
    far: '#8FBFBE', near: '#5E8F94',
    tile: 'rgba(40,70,74,0.4)', tileBorder: 'rgba(220,255,250,0.5)',
    glow: 'rgba(200,255,240,0.35)',
    name: 'mist',
  },
};

// ---- 静态背景离屏缓存 ----
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

function seeded(n, seed) {
  let a = (n * 2654435761 + seed * 40503) >>> 0;
  a = (a ^ (a >>> 13)) >>> 0;
  a = (a * 2654435761) >>> 0;
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}

function drawBackground(g, sceneKey) {
  const P = SCENES[sceneKey] || SCENES.dusk;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'night') {
    drawStars(g);
    drawMoon(g);
    drawFireworks(g);
  } else if (sceneKey === 'dusk') {
    drawSun(g, P);
    drawStalls(g, P);
  } else {
    drawMistHills(g, P);
  }

  drawLanternString(g, sceneKey);

  // 底部地面
  g.fillStyle = P.near;
  g.fillRect(0, H * 0.72, W, H * 0.28);
  const grd = g.createLinearGradient(0, H * 0.72, 0, H);
  grd.addColorStop(0, P.near);
  grd.addColorStop(1, P.skyBot);
  g.fillStyle = grd;
  g.fillRect(0, H * 0.72, W, H * 0.28);
}

function drawStars(g) {
  for (let i = 0; i < 110; i += 1) {
    const x = seeded(i, 1) * WORLD.WIDTH;
    const y = seeded(i, 2) * WORLD.HEIGHT * 0.62;
    const r = 0.5 + seeded(i, 3) * 1.3;
    g.fillStyle = `rgba(220,240,255,${0.35 + seeded(i, 4) * 0.6})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

function drawMoon(g) {
  const gx = WORLD.WIDTH - 190, gy = 120, r = 42;
  const halo = g.createRadialGradient(gx, gy, r * 0.5, gx, gy, r * 2.6);
  halo.addColorStop(0, 'rgba(210,235,255,0.5)');
  halo.addColorStop(1, 'rgba(210,235,255,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(gx, gy, r * 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#E8F2FF';
  g.beginPath(); g.arc(gx, gy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(160,190,220,0.5)';
  g.beginPath();
  g.arc(gx - 13, gy - 8, r * 0.22, 0, Math.PI * 2);
  g.arc(gx + 10, gy + 12, r * 0.16, 0, Math.PI * 2);
  g.fill();
}

function drawSun(g, P) {
  const gx = 210, gy = 150;
  const halo = g.createRadialGradient(gx, gy, 20, gx, gy, 300);
  halo.addColorStop(0, 'rgba(255,230,150,0.7)');
  halo.addColorStop(1, 'rgba(255,180,90,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
}

function drawFireworks(g) {
  const cols = ['rgba(255,200,90,', 'rgba(255,120,120,', 'rgba(120,220,255,', 'rgba(190,160,255,'];
  for (let i = 0; i < 4; i += 1) {
    const x = 140 + i * 330 + seeded(i, 9) * 120;
    const y = 90 + seeded(i, 10) * 150;
    const col = cols[i % cols.length];
    const r = 18 + seeded(i, 11) * 22;
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2;
      const lx = x + Math.cos(a) * r;
      const ly = y + Math.sin(a) * r;
      g.strokeStyle = col + '0.5)';
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(lx, ly); g.stroke();
      g.fillStyle = col + '0.8)';
      g.beginPath(); g.arc(lx, ly, 1.6, 0, Math.PI * 2); g.fill();
    }
  }
}

function drawStalls(g, P) {
  g.fillStyle = P.far;
  for (let i = 0; i < 5; i += 1) {
    const x = 120 + i * 260;
    const w = 120;
    const h = 150 + seeded(i, 7) * 60;
    g.beginPath();
    g.moveTo(x, WORLD.HEIGHT); g.lineTo(x, WORLD.HEIGHT - h);
    g.lineTo(x + w, WORLD.HEIGHT - h + 30); g.lineTo(x + w, WORLD.HEIGHT);
    g.closePath(); g.fill();
    // 棚顶小旗
    g.fillStyle = 'rgba(255,210,150,0.8)';
    for (let j = 0; j < 3; j += 1) {
      g.beginPath();
      g.moveTo(x + 14 + j * 34, WORLD.HEIGHT - h);
      g.lineTo(x + 24 + j * 34, WORLD.HEIGHT - h - 26);
      g.lineTo(x + 34 + j * 34, WORLD.HEIGHT - h);
      g.closePath(); g.fill();
    }
    g.fillStyle = P.far;
  }
}

function drawMistHills(g, P) {
  g.fillStyle = P.far;
  for (let i = 0; i < 4; i += 1) {
    const y = WORLD.HEIGHT * (0.55 + i * 0.06);
    g.globalAlpha = 0.35 + i * 0.12;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= WORLD.WIDTH; x += 40) {
      g.lineTo(x, y - Math.sin(x * 0.006 + i * 1.9) * 60 - 20);
    }
    g.lineTo(WORLD.WIDTH, WORLD.HEIGHT); g.lineTo(0, WORLD.HEIGHT);
    g.closePath(); g.fill();
  }
  g.globalAlpha = 1;
}

// 顶部悬挂灯笼串
function drawLanternString(g, sceneKey) {
  const hangColors = ['coral', 'gold', 'jade', 'amber', 'sky'];
  g.strokeStyle = 'rgba(60,40,30,0.5)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(WORLD.WIDTH / 2, 60, WORLD.WIDTH, 0);
  g.stroke();
  for (let i = 0; i < 16; i += 1) {
    const x = (WORLD.WIDTH / 16) * i + 20;
    const t = i / 16;
    const y = 28 + Math.sin(t * Math.PI) * 34;
    const c = COLORS[hangColors[i % hangColors.length]];
    g.fillStyle = c.main;
    g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.beginPath(); g.arc(x - 2, y - 2, 2.5, 0, Math.PI * 2); g.fill();
  }
}

// ---- 网格底板 ----
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGridBase(ctx, state, L, sceneKey) {
  const P = SCENES[sceneKey] || SCENES.dusk;
  const { rows, cols, grid } = state;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = L.gridX + c * L.cell;
      const y = L.gridY + r * L.cell;
      ctx.fillStyle = P.tile;
      roundRect(ctx, x + 2, y + 2, L.cell - 4, L.cell - 4, Math.max(4, L.cell * 0.14));
      ctx.fill();
      ctx.strokeStyle = P.tileBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// ---- 灯笼 ----
function drawLantern(ctx, cx, cy, cell, cellData, clock, opts = {}) {
  const color = COLORS[cellData.color] || COLORS.gold;
  const r = cell * 0.34;
  const cracked = !!cellData.cracked;

  // 光晕
  const glowPulse = 1 + Math.sin((clock || 0) * 2.4) * 0.08;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.8 * glowPulse);
  glow.addColorStop(0, color.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.8 * glowPulse, 0, Math.PI * 2); ctx.fill();

  // 纸灯笼主体（上下略窄）
  ctx.fillStyle = color.main;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, cy - r * 0.85);
  ctx.quadraticCurveTo(cx - r, cy, cx, cy + r);
  ctx.quadraticCurveTo(cx + r, cy, cx + r * 0.7, cy - r * 0.85);
  ctx.quadraticCurveTo(cx, cy - r * 1.05, cx - r * 0.7, cy - r * 0.85);
  ctx.closePath();
  ctx.fill();
  // 深色边框 + 竖向骨架
  ctx.strokeStyle = color.dark;
  ctx.lineWidth = Math.max(1, cell * 0.02);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(1, cell * 0.015);
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(cx + i * r * 0.3, cy - r * 0.72);
    ctx.lineTo(cx + i * r * 0.34, cy + r * 0.78);
    ctx.stroke();
  }
  // 顶部提梁 + 高光
  ctx.strokeStyle = color.dark;
  ctx.lineWidth = Math.max(1, cell * 0.022);
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 1.05); ctx.lineTo(cx, cy - r * 1.22); ctx.stroke();
  ctx.fillStyle = color.hi;
  ctx.beginPath(); ctx.ellipse(cx - r * 0.32, cy - r * 0.4, r * 0.22, r * 0.34, -0.4, 0, Math.PI * 2); ctx.fill();

  if (cracked) {
    ctx.strokeStyle = 'rgba(20,12,8,0.8)';
    ctx.lineWidth = Math.max(1, cell * 0.02);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy - r * 0.5); ctx.lineTo(cx, cy + r * 0.1); ctx.lineTo(cx + r * 0.4, cy - r * 0.6);
    ctx.stroke();
  }

  drawSpecialMark(ctx, cx, cy, r, cellData, clock);
}

function drawSpecialMark(ctx, cx, cy, r, cellData, clock) {
  const t = cellData.type;
  ctx.font = `${Math.max(10, r * 0.8)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (t === 'metal') {
    ctx.strokeStyle = '#E8E8F0';
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = cx + Math.cos(a) * r * 0.55;
      const py = cy - r * 0.1 + Math.sin(a) * r * 0.5;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
  } else if (t === 'fire') {
    ctx.fillStyle = '#FF7A3C';
    ctx.beginPath();
    const fy = cy - r * 0.9;
    ctx.moveTo(cx, fy - r * 0.5);
    ctx.quadraticCurveTo(cx + r * 0.4, fy, cx, fy + r * 0.3);
    ctx.quadraticCurveTo(cx - r * 0.4, fy, cx, fy - r * 0.5);
    ctx.fill();
  } else if (t === 'chained') {
    ctx.strokeStyle = '#FFE9B4';
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    ctx.arc(cx - r * 0.28, cy + r * 0.75, r * 0.2, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.28, cy + r * 0.75, r * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.08, cy + r * 0.75); ctx.lineTo(cx + r * 0.08, cy + r * 0.75); ctx.stroke();
  } else if (t === 'shifting') {
    const hue = ((clock || 0) * 120) % 360;
    ctx.strokeStyle = `hsl(${hue},80%,65%)`;
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.85, r * 0.42, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (t === 'bomb') {
    ctx.fillStyle = '#3A2A18';
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.82, r * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFC93E';
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.82); ctx.quadraticCurveTo(cx + r * 0.3, cy + r * 0.4, cx + r * 0.15, cy + r * 0.15); ctx.stroke();
    ctx.fillStyle = '#FF7A3C';
    ctx.beginPath(); ctx.arc(cx + r * 0.15, cy + r * 0.12, r * 0.14, 0, Math.PI * 2); ctx.fill();
  } else if (t === 'timeBonus') {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.78, r * 0.34, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.78);
    ctx.lineTo(cx, cy - r * 1.0);
    ctx.moveTo(cx, cy - r * 0.78);
    ctx.lineTo(cx + r * 0.22, cy - r * 0.68);
    ctx.stroke();
  } else if (t === 'double') {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${Math.max(12, r * 0.85)}px sans-serif`;
    ctx.fillText('×2', cx, cy + r * 0.1);
  }
}

function drawStone(ctx, cx, cy, cell) {
  const r = cell * 0.38;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(cx + 3, cy + r * 0.7, r, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, '#8A9AA8');
  grad.addColorStop(1, '#4A5A66');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy + r * 0.3);
  ctx.lineTo(cx - r * 0.5, cy - r);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.8);
  ctx.lineTo(cx + r, cy + r * 0.2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#33404A';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ---- 布局 ----
function computeLayout(state) {
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const availW = W - LAYOUT.MARGIN_X * 2;
  const availH = H - LAYOUT.HUD_H - LAYOUT.MARGIN_Y * 2;
  const { rows, cols } = state;
  const cell = Math.min(availW / cols, availH / rows, LAYOUT.CELL_MAX);
  const gridW = cell * cols, gridH = cell * rows;
  const gridX = LAYOUT.MARGIN_X + Math.floor((availW - gridW) / 2);
  const gridY = LAYOUT.HUD_H + LAYOUT.MARGIN_Y + Math.floor((availH - gridH) / 2);
  return { cell, gridX, gridY, gridW, gridH, hudH: LAYOUT.HUD_H };
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
      cell: L.cell,
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('night'), 0, 0);
    // 标题屏中央一串升空灯笼
    for (let i = 0; i < 7; i += 1) {
      const x = WORLD.WIDTH / 2 + Math.sin(i * 1.3) * 200 + seeded(i, 20) * 30;
      const y = 400 + Math.cos(i * 0.9) * 120 - i * 26;
      drawRiseLantern(ctx, x, y, 0.8 + seeded(i, 21) * 0.4, i, clock);
    }
  }

  function drawRiseLantern(ctx, x, y, s, seed, t) {
    const c = COLORS[['gold', 'coral', 'amber', 'jade', 'sky'][seed % 5]];
    const bob = Math.sin(t * 1.6 + seed) * 8;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(s, s);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
    glow.addColorStop(0, c.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.moveTo(-16, -14);
    ctx.quadraticCurveTo(-24, 0, 0, 22);
    ctx.quadraticCurveTo(24, 0, 16, -14);
    ctx.quadraticCurveTo(0, -22, -16, -14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-7, -6, 5, 8, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw(state, dt, view) {
    if (!state || !state.grid) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.sceneKey || v.sceneKey || 'dusk';
    clock += dt || 0;
    lastState = state;

    const L = computeLayout(state);
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);
    drawGridBase(ctx, state, L, sceneKey);

    const { rows, cols, grid } = state;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const g = grid[r][c];
        if (!g || g.kind === 'empty') continue;
        const cx = L.gridX + c * L.cell + L.cell / 2;
        const cy = L.gridY + r * L.cell + L.cell / 2;
        if (g.kind === 'stone') drawStone(ctx, cx, cy, L.cell);
        else drawLantern(ctx, cx, cy, L.cell, g, clock);
      }
    }

    // hover 高亮
    if (v.hoverCell && grid[v.hoverCell.r] && grid[v.hoverCell.r][v.hoverCell.c] && grid[v.hoverCell.r][v.hoverCell.c].kind !== 'empty') {
      const { r, c } = v.hoverCell;
      const x = L.gridX + c * L.cell, y = L.gridY + r * L.cell;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      roundRect(ctx, x + 2, y + 2, L.cell - 4, L.cell - 4, Math.max(4, L.cell * 0.14));
      ctx.stroke();
    }

    // 爆破粒子
    if (v.fx) {
      for (const fx of v.fx) {
        if (fx.type === 'pop' && fx.ttl > 0) {
          const x = L.gridX + fx.c * L.cell + L.cell / 2;
          const y = L.gridY + fx.r * L.cell + L.cell / 2;
          const k = 1 - fx.ttl / fx.max;
          const col = COLORS[fx.color] || COLORS.gold;
          ctx.globalAlpha = Math.max(0, fx.ttl / fx.max);
          ctx.strokeStyle = col.main;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x, y, L.cell * (0.3 + k * 0.9), 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < 5; i += 1) {
            const a = i * 1.26 + fx.seed;
            const rr = L.cell * 0.4 * k * 1.8;
            ctx.fillStyle = col.hi;
            ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 3, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    // 升空孔明灯
    if (v.rises) {
      for (const r of v.rises) {
        if (r.ttl <= 0) continue;
        const k = 1 - r.ttl / r.max;
        drawRiseLantern(ctx, r.x, r.y - k * 220, r.s, r.seed, clock);
      }
    }

    ctx.restore();

    // 全屏暖光（大场面）
    if (v.glow && v.glow > 0) {
      const g = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 100, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 700);
      g.addColorStop(0, `rgba(255,200,90,${0.25 * v.glow})`);
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize };
}
