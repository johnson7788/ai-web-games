// CANDY CRUSH POP · Canvas 2D 渲染：霓虹街机背景 / 发光糖果 / 冰封岩石 / 交换·消除·下落动画。
// 只消费 run.state + view（fxQueue/hintCells/hoverCell/cursor/shake）。像素换算全部在此完成。
// 性能：糖果与岩石离屏渲染成 sprite 缓存，每帧只 drawImage（无逐帧 shadowBlur）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const BG_TOP = '#0a0716';
const BG_BOT = '#1a0f2e';
const GRID_LINE = 'rgba(120, 90, 200, 0.22)';
const SPRITE = 128; // 糖果 sprite 像素边长

// 6 种霓虹糖果：形状 + 颜色（剪影各异，眯眼可分）
export const CANDY = [
  { shape: 'circle', color: '#FF2E88' },
  { shape: 'triangle', color: '#00E5FF' },
  { shape: 'square', color: '#FFD52E' },
  { shape: 'diamond', color: '#3DFF6E' },
  { shape: 'star', color: '#FF8A2E' },
  { shape: 'hexagon', color: '#B26BFF' },
];

// ---- 静态背景离屏缓存 ----
let bgCache = null;

function getBackground() {
  if (bgCache) return bgCache;
  bgCache = document.createElement('canvas');
  bgCache.width = WORLD.WIDTH;
  bgCache.height = WORLD.HEIGHT;
  drawBackground(bgCache.getContext('2d'));
  return bgCache;
}

function drawBackground(g) {
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, BG_TOP);
  sky.addColorStop(0.6, '#150c2b');
  sky.addColorStop(1, BG_BOT);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  g.strokeStyle = 'rgba(180, 60, 255, 0.16)';
  g.lineWidth = 1;
  for (let y = H * 0.55; y < H; y += 26) {
    g.beginPath();
    for (let x = 0; x <= W; x += 18) {
      const yy = y + Math.sin(x * 0.02 + y * 0.05) * 4;
      if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }

  const glow = g.createRadialGradient(W * 0.78, H * 0.42, 20, W * 0.78, H * 0.42, 420);
  glow.addColorStop(0, 'rgba(178, 60, 255, 0.28)');
  glow.addColorStop(0.5, 'rgba(0, 160, 255, 0.12)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  const glow2 = g.createRadialGradient(W * 0.2, H * 0.75, 20, W * 0.2, H * 0.75, 360);
  glow2.addColorStop(0, 'rgba(255, 46, 136, 0.2)');
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow2;
  g.fillRect(0, 0, W, H);
}

// ---- 布局 ----
function computeLayout(state) {
  const { rows, cols } = state;
  const areaH = WORLD.HEIGHT - LAYOUT.BOARD_Y - 14;
  const areaW = LAYOUT.SIDE_X - LAYOUT.BOARD_X - 20;
  const cell = Math.min(LAYOUT.CELL_MAX, Math.floor(areaH / rows), Math.floor(areaW / cols));
  const gridW = cell * cols;
  const gridH = cell * rows;
  const gridX = LAYOUT.BOARD_X + Math.floor((areaW - gridW) / 2);
  const gridY = LAYOUT.BOARD_Y + Math.floor((areaH - gridH) / 2);
  return { cell, gridX, gridY, gridW, gridH };
}

// ---- 形状路径 ----
function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function starPath(g, cx, cy, spikes, outerR, innerR, rot) {
  g.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = rot + (i * Math.PI) / spikes - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}

function shapePath(g, cx, cy, r, shape) {
  switch (shape) {
    case 'circle': g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); break;
    case 'triangle':
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r * 0.9, cy + r * 0.7);
      g.lineTo(cx - r * 0.9, cy + r * 0.7);
      g.closePath(); break;
    case 'square': roundRectPath(g, cx - r, cy - r, r * 2, r * 2, r * 0.24); break;
    case 'diamond':
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath(); break;
    case 'star': starPath(g, cx, cy, 5, r, r * 0.46, -Math.PI / 2); break;
    case 'hexagon':
      g.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath(); break;
    default: g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
  }
}

// ---- Sprite 缓存（离屏渲染一次，之后只 drawImage）----
const candySprites = [];
const rockSprites = [null, null, null];

function makeCandySprite(type) {
  const c = document.createElement('canvas');
  c.width = SPRITE;
  c.height = SPRITE;
  const g = c.getContext('2d');
  const cx = SPRITE / 2;
  const cy = SPRITE / 2;
  const r = SPRITE * 0.38;
  const color = CANDY[type].color;
  g.shadowColor = color;
  g.shadowBlur = SPRITE * 0.16;
  g.fillStyle = color;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = SPRITE * 0.035;
  shapePath(g, cx, cy, r, CANDY[type].shape);
  g.fill();
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.beginPath();
  g.ellipse(cx - r * 0.28, cx - r * 0.32, r * 0.32, r * 0.2, -0.6, 0, Math.PI * 2);
  g.fill();
  return c;
}

function makeRockSprite(hp) {
  const c = document.createElement('canvas');
  c.width = SPRITE;
  c.height = SPRITE;
  const g = c.getContext('2d');
  const cx = SPRITE / 2;
  const r = SPRITE * 0.38;
  const a = hp >= 2 ? 0.7 : 0.52;
  g.fillStyle = `rgba(180, 220, 255, ${a})`;
  g.strokeStyle = 'rgba(235, 248, 255, 0.95)';
  g.lineWidth = SPRITE * 0.02;
  roundRectPath(g, cx - r * 0.82, cy - r * 0.82, r * 1.64, r * 1.64, r * 0.26);
  g.fill();
  g.stroke();
  g.strokeStyle = 'rgba(90, 140, 190, 0.9)';
  g.lineWidth = SPRITE * 0.015;
  g.beginPath();
  g.moveTo(cx - r * 0.5, cy - r * 0.6);
  g.lineTo(cx - r * 0.1, cy - r * 0.1);
  g.lineTo(cx + r * 0.3, cy - r * 0.35);
  g.moveTo(cx - r * 0.1, cy - r * 0.1);
  g.lineTo(cx + r * 0.1, cy + r * 0.5);
  g.stroke();
  if (hp >= 2) {
    g.strokeStyle = 'rgba(70, 110, 160, 0.85)';
    g.beginPath();
    g.moveTo(cx - r * 0.2, cy + r * 0.6);
    g.lineTo(cx - r * 0.55, cy + r * 0.1);
    g.moveTo(cx + r * 0.5, cy + r * 0.4);
    g.lineTo(cx + r * 0.2, cy - r * 0.1);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let i = 0; i < hp; i += 1) {
    g.beginPath();
    g.arc(cx - r * 0.55 + i * r * 0.5, cy - r * 0.62, r * 0.11, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function getCandySprite(type) {
  if (!candySprites[type]) candySprites[type] = makeCandySprite(type);
  return candySprites[type];
}

function getRockSprite(hp) {
  const i = Math.min(2, Math.max(0, hp));
  if (!rockSprites[i]) rockSprites[i] = makeRockSprite(i);
  return rockSprites[i];
}

function drawCandy(g, cx, cy, r, type) {
  g.drawImage(getCandySprite(type), cx - r, cy - r, r * 2, r * 2);
}

function drawRock(g, cx, cy, r, hp) {
  g.drawImage(getRockSprite(hp), cx - r * 1.16, cy - r * 1.16, r * 2.32, r * 2.32);
}

function cellCenter(L, r, c) {
  return {
    x: L.gridX + c * L.cell + L.cell / 2,
    y: L.gridY + r * L.cell + L.cell / 2,
  };
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
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
      cell: L.cell,
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground(), 0, 0);
    const xs = [180, 360, 540, 720, 900, 1080];
    for (let i = 0; i < 6; i += 1) {
      const cx = xs[i];
      const cy = 300 + Math.sin(clock * 1.4 + i * 1.1) * 26;
      const r = 46 + Math.sin(clock * 2.1 + i) * 4;
      drawCandy(ctx, cx, cy, r, i);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 64px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillText('POP', WORLD.WIDTH / 2, 560);
  }

  function draw(state, dt, view) {
    if (!state || !state.grid) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;

    const L = computeLayout(state);
    const { rows, cols, grid } = state;

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }
    ctx.drawImage(getBackground(), 0, 0);

    // 棋盘底板
    const bx = L.gridX - 6;
    const by = L.gridY - 6;
    ctx.fillStyle = 'rgba(10, 6, 24, 0.72)';
    roundRectPath(ctx, bx, by, L.gridW + 12, L.gridH + 12, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(178, 107, 255, 0.4)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, bx, by, L.gridW + 12, L.gridH + 12, 12);
    ctx.stroke();

    // 格线
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let r = 0; r <= rows; r += 1) {
      ctx.moveTo(L.gridX, L.gridY + r * L.cell);
      ctx.lineTo(L.gridX + L.gridW, L.gridY + r * L.cell);
    }
    for (let c = 0; c <= cols; c += 1) {
      ctx.moveTo(L.gridX + c * L.cell, L.gridY);
      ctx.lineTo(L.gridX + c * L.cell, L.gridY + L.gridH);
    }
    ctx.stroke();

    const swapProgress = state.action === 'swap' ? 1 - state.actionT / GAME.SWAP_TIME : 0;
    const clearProgress = state.action === 'clear' ? 1 - state.actionT / GAME.CLEAR_TIME : 0;
    const fallProgress = state.action === 'fall' ? 1 - state.actionT / GAME.FALL_TIME : 0;
    const clearing = new Set((state.clearCells || []).map((p) => `${p.r},${p.c}`));
    const falling = new Map((state.fallAnim || []).map((p) => [`${p.r},${p.c}`, p.fromR]));

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const cell = grid[r][c];
        if (!cell) continue;
        const k = `${r},${c}`;
        if (clearing.has(k)) continue;

        let drawR = r;
        let drawC = c;
        if (falling.has(k) && state.action === 'fall') {
          const fromR = falling.get(k);
          drawR = fromR + (r - fromR) * fallProgress;
        }
        if (state.swap) {
          const { a, b } = state.swap;
          const t = state.swap.back ? (1 - swapProgress) : swapProgress;
          if (a.r === r && a.c === c) { drawR = r + (b.r - r) * t; drawC = c + (b.c - c) * t; }
          else if (b.r === r && b.c === c) { drawR = r + (a.r - r) * t; drawC = c + (a.c - c) * t; }
        }

        const pt = { x: L.gridX + drawC * L.cell + L.cell / 2, y: L.gridY + drawR * L.cell + L.cell / 2 };
        const rr = L.cell * 0.38;
        drawCandy(ctx, pt.x, pt.y, rr, cell.type);
        if (cell.rock > 0) drawRock(ctx, pt.x, pt.y, rr, cell.rock);
      }
    }

    // 消除闪光
    if (state.clearCells && state.clearCells.length) {
      for (const p of state.clearCells) {
        const pt = cellCenter(L, p.r, p.c);
        const c = CANDY[grid[p.r][p.c] ? grid[p.r][p.c].type : 0];
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - clearProgress);
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, L.cell * 0.4 * (1 - clearProgress), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 粒子
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        const a = Math.max(0, fx.ttl / (fx.maxTtl || 0.5));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = fx.color;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r * (1 - a * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 提示高亮
    if (v.hintCells) {
      for (const hc of v.hintCells) {
        const x = L.gridX + hc.c * L.cell;
        const y = L.gridY + hc.r * L.cell;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, hc.ttl / 0.4));
        ctx.strokeStyle = '#FFD52E';
        ctx.lineWidth = 3;
        roundRectPath(ctx, x + 2, y + 2, L.cell - 4, L.cell - 4, 8);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 悬停高亮
    if (v.hoverCell && state.phase === 'playing') {
      const { r, c } = v.hoverCell;
      if (grid[r] && grid[r][c]) {
        const x = L.gridX + c * L.cell;
        const y = L.gridY + r * L.cell;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2.5;
        roundRectPath(ctx, x + 2, y + 2, L.cell - 4, L.cell - 4, 8);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function __drawTitle() { drawTitleScene(); }

  if (typeof window !== 'undefined') {
    window.__drawTitle = __drawTitle;
  }

  return { draw, debugLayout, resize, __drawTitle };
}
