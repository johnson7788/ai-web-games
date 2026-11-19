// Canvas 2D 渲染：霓虹街机 match-3 棋盘 / 宝石 / 岩石 / 选中高亮 / 消除闪光 / 震屏。
// 只消费 run.state + view(hoverCell/selected/fxQueue/shake)。
// 像素换算全部在此完成（sim 只给 r,c 与颜色整数）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, LAYOUT, GEM_COLORS } from '../../config/game.config.js';

const NEON = {
  skyTop: '#0a0618',
  skyMid: '#120a26',
  skyBot: '#05030f',
  grid: 'rgba(167,139,250,0.10)',
  gridGlow: 'rgba(45,226,230,0.06)',
  tile: 'rgba(20,14,40,0.85)',
  tileBorder: 'rgba(167,139,250,0.25)',
};

const RAINBOW = ['#FF2E63', '#FF8A3D', '#FFD166', '#4ADE80', '#2DE2E6', '#A78BFA'];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx) {
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, NEON.skyTop);
  sky.addColorStop(0.55, NEON.skyMid);
  sky.addColorStop(1, NEON.skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 霓虹网格
  ctx.strokeStyle = NEON.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // 中央辉光
  const glow = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 560);
  glow.addColorStop(0, 'rgba(120,80,255,0.16)');
  glow.addColorStop(1, 'rgba(120,80,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function computeLayout(state) {
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const { rows, cols } = state;
  const availW = W - LAYOUT.MARGIN_X * 2;
  const availH = H - LAYOUT.HUD_H - LAYOUT.MARGIN_Y * 2;
  const cell = Math.min(availW / cols, availH / rows, LAYOUT.CELL_MAX);
  const gridW = cell * cols;
  const gridH = cell * rows;
  const gridX = Math.floor((W - gridW) / 2);
  const gridY = LAYOUT.HUD_H + LAYOUT.MARGIN_Y + Math.floor((availH - gridH) / 2);
  return { cell, gridX, gridY, gridW, gridH, hudH: LAYOUT.HUD_H };
}

function gemColor(gem) {
  if (gem.color >= 0 && gem.color < GEM_COLORS.length) return GEM_COLORS[gem.color];
  return '#fff';
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawGem(ctx, cx, cy, cell, gem, clock) {
  const pad = cell * 0.08;
  const size = cell - pad * 2;
  const x = cx - size / 2, y = cy - size / 2;
  const r = size * 0.28;
  const pulse = gem.special === 'bird' ? 1 + Math.sin(clock * 4) * 0.05 : 1;

  // 底光晕
  const glowR = size * 0.72;
  const glow = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, glowR);
  const base = gemColor(gem);
  glow.addColorStop(0, gem.special === 'bird' ? 'rgba(255,255,255,0.5)' : `${base}55`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.translate(-cx, -cy);

  if (gem.special === 'bird') {
    // 彩虹宝石
    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    RAINBOW.forEach((c, i) => grad.addColorStop(i / (RAINBOW.length - 1), c));
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createRadialGradient(x + size * 0.3, y + size * 0.3, size * 0.1, x + size / 2, y + size / 2, size * 0.75);
    grad.addColorStop(0, shade(base, 70));
    grad.addColorStop(0.6, base);
    grad.addColorStop(1, shade(base, -60));
    ctx.fillStyle = grad;
  }
  roundRect(ctx, x, y, size, size, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(x + size * 0.32, y + size * 0.28, size * 0.2, size * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // 特殊标记
  if (gem.special === 'line' || gem.special === 'column') {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = size * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (gem.special === 'line') { ctx.moveTo(x + size * 0.2, cy); ctx.lineTo(x + size * 0.8, cy); }
    else { ctx.moveTo(cx, y + size * 0.2); ctx.lineTo(cx, y + size * 0.8); }
    ctx.stroke();
  } else if (gem.special === 'wrap') {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = size * 0.1;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  } else if (gem.special === 'bird') {
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(size * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', cx, cy + 1);
  }
  ctx.restore();
}

function drawRock(ctx, cx, cy, cell, clock) {
  const size = cell * 0.72;
  const x = cx - size / 2, y = cy - size / 2;
  const grad = ctx.createRadialGradient(cx - size * 0.2, cy - size * 0.2, size * 0.1, cx, cy, size * 0.7);
  grad.addColorStop(0, '#4a4a5e');
  grad.addColorStop(1, '#191924');
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, size, size, size * 0.2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,138,61,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 石面高光
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.ellipse(x + size * 0.32, y + size * 0.28, size * 0.22, size * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // 石纹斑点（避免成字母/符号）
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.arc(x + size * 0.62, y + size * 0.4, size * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + size * 0.38, y + size * 0.66, size * 0.05, 0, Math.PI * 2); ctx.fill();
}

function drawBoard(ctx, state, layout, view, clock) {
  const { rows, cols, grid } = state;
  const { cell, gridX, gridY } = layout;

  // 底板
  const boardPad = cell * 0.28;
  roundRect(ctx, gridX - boardPad, gridY - boardPad, cell * cols + boardPad * 2, cell * rows + boardPad * 2, 20);
  ctx.fillStyle = 'rgba(10,6,24,0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(167,139,250,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 格子
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = gridX + c * cell, y = gridY + r * cell;
      ctx.fillStyle = NEON.tile;
      roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, Math.max(4, cell * 0.12));
      ctx.fill();
      ctx.strokeStyle = NEON.tileBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // 消除闪光
  if (view && view.fxQueue) {
    for (const fx of view.fxQueue) {
      if (fx.ttl > 0 && grid[fx.r] && grid[fx.r][fx.c]) {
        const x = gridX + fx.c * cell, y = gridY + fx.r * cell;
        ctx.fillStyle = `rgba(255,255,255,${(fx.ttl / 0.35) * 0.55})`;
        roundRect(ctx, x + 1, y + 1, cell - 2, cell - 2, Math.max(4, cell * 0.12));
        ctx.fill();
      }
    }
  }

  // 宝石 / 岩石
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const g = grid[r][c];
      if (!g) continue;
      const cx = gridX + c * cell + cell / 2;
      const cy = gridY + r * cell + cell / 2;
      if (g.kind === 'rock') drawRock(ctx, cx, cy, cell, clock);
      else drawGem(ctx, cx, cy, cell, g, clock);
    }
  }

  // 选中高亮
  if (state.selected) {
    const { r, c } = state.selected;
    const x = gridX + c * cell, y = gridY + r * cell;
    const a = 0.6 + Math.sin(clock * 5) * 0.25;
    ctx.strokeStyle = `rgba(255,209,102,${a})`;
    ctx.lineWidth = 3;
    roundRect(ctx, x + 1, y + 1, cell - 2, cell - 2, Math.max(4, cell * 0.12));
    ctx.stroke();
  }

  // hover 高亮
  if (view && view.hoverCell && grid[view.hoverCell.r] && grid[view.hoverCell.r][view.hoverCell.c]) {
    const { r, c } = view.hoverCell;
    const x = gridX + c * cell, y = gridY + r * cell;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, Math.max(4, cell * 0.12));
    ctx.stroke();
  }
}

function drawTitleScene(ctx) {
  drawBackground(ctx);
  // 装饰性宝石列
  const colors = [0, 1, 2, 3, 4, 5];
  const cy = WORLD.HEIGHT * 0.62;
  const step = 74;
  const startX = WORLD.WIDTH / 2 - (colors.length - 1) * step / 2;
  colors.forEach((c, i) => {
    const gem = { color: c, special: 'none' };
    drawGem(ctx, startX + i * step, cy + Math.sin(i * 1.3) * 18, 60, gem, 0);
  });
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;

  function resize() {
    return { w: WORLD.WIDTH, h: WORLD.HEIGHT };
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

  function draw(state, dt, view) {
    clock += dt || 0;
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (view && view.shake && view.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * view.shake, (Math.random() * 2 - 1) * view.shake);
    }
    drawBackground(ctx);
    if (!state || !state.grid) {
      drawTitleScene(ctx);
      ctx.restore();
      return;
    }
    lastState = state;
    const L = computeLayout(state);
    drawBoard(ctx, state, L, view, clock);
    ctx.restore();
  }

  return { draw, debugLayout, resize };
}
