// MEOW MIAO · 渲染层（纯 canvas 2D，程序化霓虹街机风，零素材零外链）
// 职责：霓虹网格背景 / 岩石 / 牌堆（顶视网格+层偏移）/ 等待架 / 粒子 / 可拿高亮。
// 预渲染方块贴图到离屏 canvas，帧内只 blit，保证 60fps。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const SPR = 128; // 贴图分辨率
const MARGIN = 20;

// 8 种花色（霓虹色 + 字形名）+ 万能
export const SYMBOLS = [
  { color: '#35e0ff', glyph: 'circle' },
  { color: '#ff4fd8', glyph: 'triangle' },
  { color: '#9dff57', glyph: 'square' },
  { color: '#ffc53d', glyph: 'diamond' },
  { color: '#ff6ea6', glyph: 'star' },
  { color: '#5f8bff', glyph: 'hex' },
  { color: '#c17bff', glyph: 'moon' },
  { color: '#ff7a4a', glyph: 'bolt' },
];
export const WILD_COLOR = '#f5f0ff';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawGlyph(ctx, name, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (name) {
    case 'circle':
      ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
      break;
    case 'triangle': {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7); ctx.lineTo(r * 0.66, r * 0.5); ctx.lineTo(-r * 0.66, r * 0.5);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'square':
      roundRect(ctx, -r * 0.55, -r * 0.55, r * 1.1, r * 1.1, r * 0.2); ctx.fill();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7); ctx.lineTo(r * 0.62, 0); ctx.lineTo(0, r * 0.7); ctx.lineTo(-r * 0.62, 0);
      ctx.closePath(); ctx.fill();
      break;
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const rad = i % 2 === 0 ? r * 0.72 : r * 0.32;
        const px = Math.cos(a) * rad; const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'hex': {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = -Math.PI / 2 + i * Math.PI / 3;
        const px = Math.cos(a) * r * 0.68; const py = Math.sin(a) * r * 0.68;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'moon':
      ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(8,10,24,0.9)';
      ctx.beginPath(); ctx.arc(r * 0.26, -r * 0.14, r * 0.56, 0, Math.PI * 2); ctx.fill();
      break;
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(r * 0.16, -r * 0.72); ctx.lineTo(-r * 0.42, r * 0.12); ctx.lineTo(r * 0.02, r * 0.12);
      ctx.lineTo(-r * 0.16, r * 0.72); ctx.lineTo(r * 0.42, -r * 0.12); ctx.lineTo(-r * 0.02, -r * 0.12);
      ctx.closePath(); ctx.fill();
      break;
    case 'wild': {
      // 万能：白色圈内五星
      ctx.fillStyle = WILD_COLOR;
      ctx.strokeStyle = WILD_COLOR;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const rad = i % 2 === 0 ? r * 0.52 : r * 0.22;
        const px = Math.cos(a) * rad; const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function makeTileSprite(symbol, free) {
  const c = document.createElement('canvas');
  c.width = SPR; c.height = SPR;
  const ctx = c.getContext('2d');
  const pad = SPR * 0.10;
  const x = pad; const y = pad; const w = SPR - pad * 2; const h = SPR - pad * 2;
  const color = symbol === -1 ? WILD_COLOR : SYMBOLS[symbol].color;

  // 底
  roundRect(ctx, x, y, w, h, SPR * 0.16);
  ctx.fillStyle = free ? '#1c2440' : '#161c30';
  ctx.fill();
  ctx.lineWidth = Math.max(2, SPR * 0.022);
  ctx.strokeStyle = free ? color : 'rgba(140,150,190,0.55)';
  if (free) {
    ctx.shadowColor = color;
    ctx.shadowBlur = SPR * 0.10;
  }
  ctx.stroke();

  // 字形
  const glyph = symbol === -1 ? 'wild' : SYMBOLS[symbol].glyph;
  ctx.shadowColor = color;
  ctx.shadowBlur = SPR * 0.16;
  drawGlyph(ctx, glyph, SPR / 2, SPR / 2, SPR * 0.36, color);
  return c;
}

function makeRockSprite() {
  const c = document.createElement('canvas');
  c.width = SPR; c.height = SPR;
  const ctx = c.getContext('2d');
  const pad = SPR * 0.12;
  const x = pad; const y = pad + SPR * 0.10; const w = SPR - pad * 2; const h = SPR - pad * 2;
  ctx.fillStyle = '#3a3f55';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w * 0.1, y + h * 0.45);
  ctx.lineTo(x + w * 0.4, y);
  ctx.lineTo(x + w * 0.75, y + h * 0.12);
  ctx.lineTo(x + w, y + h * 0.5);
  ctx.lineTo(x + w * 0.82, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = Math.max(2, SPR * 0.022);
  ctx.strokeStyle = '#6a7090';
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.4, y);
  ctx.lineTo(x + w * 0.75, y + h * 0.12);
  ctx.lineTo(x + w, y + h * 0.5);
  ctx.lineTo(x + w * 0.75, y + h * 0.5);
  ctx.lineTo(x + w * 0.4, y + h * 0.18);
  ctx.closePath();
  ctx.fill();
  return c;
}

const spriteCache = new Map();
function tileSprite(symbol, free) {
  const k = `${symbol}:${free ? 1 : 0}`;
  if (!spriteCache.has(k)) spriteCache.set(k, makeTileSprite(symbol, free));
  return spriteCache.get(k);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const rockSprite = makeRockSprite();
  const reducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let dpr = 1;
  let lastRect = new Map(); // tileId -> {x,y,w,h}
  const particles = [];
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: Math.random() * WORLD.WIDTH, y: Math.random() * WORLD.HEIGHT, r: Math.random() * 1.4 + 0.3, p: Math.random() * Math.PI * 2 });
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(WORLD.WIDTH * dpr);
    canvas.height = Math.floor(WORLD.HEIGHT * dpr);
  }
  resize();

  function computeLayout(state) {
    const cols = state.cols || 1;
    const rows = state.rows || 1;
    let maxY = 0;
    for (const t of state.tiles) if (t.onBoard && t.y > maxY) maxY = t.y;
    const availW = WORLD.WIDTH - MARGIN * 2;
    const availH = WORLD.HEIGHT - LAYOUT.HUD_H - LAYOUT.SHELF_H - MARGIN * 2;
    const liftRatio = 0.20;
    let tile = Math.min(LAYOUT.TILE_MAX, Math.max(LAYOUT.TILE_MIN,
      Math.min(availW / cols, availH / (rows + maxY * liftRatio))));
    const lift = tile * liftRatio;
    const boardW = cols * tile;
    const boardH = rows * tile + maxY * lift;
    const ox = (WORLD.WIDTH - boardW) / 2;
    const oy = LAYOUT.HUD_H + MARGIN + Math.max(0, (availH - boardH) / 2);
    const shelfTile = Math.min(tile * 0.9, LAYOUT.TILE_MAX * 0.82);
    const shelfSlot = shelfTile + 10;
    const shelfW = GAME.SHELF_CAP * shelfSlot + 12;
    const shelfX = (WORLD.WIDTH - shelfW) / 2;
    const shelfY = WORLD.HEIGHT - LAYOUT.SHELF_H / 2 - shelfTile / 2;
    return { tile, lift, ox, oy, shelfTile, shelfSlot, shelfX, shelfY };
  }

  function tilePos(l, t) {
    return {
      x: l.ox + t.x * l.tile,
      y: l.oy + t.z * l.tile - t.y * l.lift,
      w: l.tile,
      h: l.tile,
    };
  }

  function drawBackground(now) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#080a18');
    g.addColorStop(0.6, '#0b1024');
    g.addColorStop(1, '#060814');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 霓虹网格
    ctx.strokeStyle = 'rgba(90,110,200,0.10)';
    ctx.lineWidth = 1;
    const step = 64;
    for (let x = -WORLD.HEIGHT; x < WORLD.WIDTH + step; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + WORLD.HEIGHT, WORLD.HEIGHT); ctx.stroke();
    }
    for (let x = 0; x < WORLD.WIDTH + step; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - WORLD.HEIGHT, WORLD.HEIGHT); ctx.stroke();
    }

    // 星点
    for (const s of stars) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(now * 1.6 + s.p));
      ctx.fillStyle = `rgba(190,220,255,${a.toFixed(3)})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
  }

  function drawBoard(state, l, freeIds, now) {
    // 岩石（底部地形）
    for (const [rx, rz] of state.rocks) {
      const px = l.ox + rx * l.tile;
      const py = l.oy + rz * l.tile;
      ctx.drawImage(rockSprite, px, py, l.tile, l.tile);
    }

    const order = state.tiles.slice().sort((a, b) => a.y - b.y || (a.x + a.z) - (b.x + b.z));
    lastRect.clear();
    for (const t of order) {
      if (!t.onBoard) continue;
      const p = tilePos(l, t);
      const free = freeIds.has(t.id);
      const img = tileSprite(t.symbol, free);
      if (!free) {
        ctx.globalAlpha = 0.38;
        ctx.drawImage(img, p.x, p.y, p.w, p.h);
        ctx.globalAlpha = 1;
      } else {
        ctx.drawImage(img, p.x, p.y, p.w, p.h);
        // 可拿高亮：脉冲白圈，明确「这块可以点」
        const pulse = 0.5 + 0.5 * Math.sin((now || 0) / 180 + t.id * 1.7);
        roundRect(ctx, p.x - 1, p.y - 1, p.w + 2, p.h + 2, 13);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = `rgba(255,255,255,${(0.45 + 0.4 * pulse).toFixed(3)})`;
        ctx.stroke();
      }
      lastRect.set(t.id, { x: p.x, y: p.y, w: p.w, h: p.h });
    }
  }

  function drawShelf(state, l, view) {
    // 目标提示：等待架正上方居中，明确「凑三个消除」
    if (view && view.goalText) {
      ctx.save();
      ctx.font = '700 20px "Segoe UI", "PingFang SC", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(110, 243, 255, 0.8)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#bff6ff';
      ctx.fillText(view.goalText, WORLD.WIDTH / 2, l.shelfY - 14);
      ctx.restore();
    }
    for (let i = 0; i < GAME.SHELF_CAP; i += 1) {
      const x = l.shelfX + i * l.shelfSlot;
      roundRect(ctx, x, l.shelfY, l.shelfTile, l.shelfTile, 10);
      ctx.fillStyle = 'rgba(20,26,48,0.85)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(120,135,200,0.35)';
      ctx.stroke();
    }
    state.shelf.forEach((t, i) => {
      const x = l.shelfX + i * l.shelfSlot;
      const img = tileSprite(t.symbol, true);
      ctx.drawImage(img, x, l.shelfY, l.shelfTile, l.shelfTile);
    });
    // 溢出预警：第 7 格亮红边
    if (state.shelf.length >= GAME.SHELF_CAP) {
      const x = l.shelfX + (GAME.SHELF_CAP - 1) * l.shelfSlot;
      roundRect(ctx, x - 3, l.shelfY - 3, l.shelfTile + 6, l.shelfTile + 6, 12);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,90,90,0.9)';
      ctx.stroke();
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(state, dt, view, now) {
    const t = now ?? performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(t);
    if (!state) return;
    const l = computeLayout(state);
    const freeIds = view?.freeIds || new Set();
    drawBoard(state, l, freeIds, t);
    drawShelf(state, l, view);
    if (!reducedMotion) drawParticles(dt);
    lastLayout = l;
  }

  let lastLayout = null;

  function hitTest(x, y) {
    // 从顶层往下找：命中矩形即可（牌堆无重叠矩形时取 y 大者）
    let best = null;
    for (const [id, r] of lastRect) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        if (!best || best.y < r.y) best = { id, y: r.y };
      }
    }
    return best ? best.id : null;
  }

  function burst(x, y, color, n = 14) {
    if (reducedMotion) return;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        color, size: 2 + Math.random() * 3, life: 0.5 + Math.random() * 0.4, maxLife: 0.9,
      });
    }
    if (particles.length > 220) particles.splice(0, particles.length - 220);
  }

  function debugLayout(state) {
    if (!state) return { board: null, shelf: null, tile: () => null };
    const l = computeLayout(state);
    return {
      board: { x: l.ox, y: l.oy, w: state.cols * l.tile, h: state.rows * l.tile },
      shelf: { x: l.shelfX, y: l.shelfY, w: GAME.SHELF_CAP * l.shelfSlot, h: l.shelfTile },
      tile: (id) => lastRect.get(id) || null,
      tileSize: l.tile,
    };
  }

  return { draw, resize, hitTest, burst, debugLayout, tileSprite, SYMBOLS, WILD_COLOR };
}
