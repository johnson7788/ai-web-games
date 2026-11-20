// src/render/index.js — Canvas 2D 程序化渲染：10×10 矿脉棋盘 + 三套场景包（萤石洞紫/铜矿坑橙/极光冰洞青）。
// 性能：宝石/岩块/冰封贴片全部预渲染到离屏 canvas（sprite 缓存），每帧只 drawImage，避免逐格 shadowBlur。
// 导出 createRender(canvas) → { draw(run, interp), resize(), burst(x,y,kind), setPickMode(bool), setHover(cells) }。
import { WORLD } from '../../config/game.config.js';
import { GRID } from '../../config/gameplay.js';

const COLS = GRID.COLS;
const ROWS = GRID.ROWS;
const ROCK = -1;
const GEM_PAD = 5;

// ---------- 三场景包色板 ----------
const THEMES = {
  1: {
    bgTop: '#12081f', bgBottom: '#241238',
    accent: '#b06cff',
    rock: '#3a2c4d',
    frame: 'rgba(176,108,255,0.35)',
    colors: ['#b06cff', '#5fd9c7', '#ff6ab3', '#ffd24a', '#5a9cff', '#8dff8d'],
  },
  2: {
    bgTop: '#1c0f06', bgBottom: '#3a1f0c',
    accent: '#ff9a3d',
    rock: '#4a2f1a',
    frame: 'rgba(255,154,61,0.4)',
    colors: ['#ff9a3d', '#d7ff3d', '#ff5b3d', '#6ad7ff', '#c7ff9a', '#ff6a4d'],
  },
  3: {
    bgTop: '#04121a', bgBottom: '#0a2c33',
    accent: '#52f0ff',
    rock: '#23424d',
    frame: 'rgba(82,240,255,0.38)',
    colors: ['#52f0ff', '#a6f6ff', '#7dff9a', '#b98cff', '#eaffff', '#7dffc0'],
  },
};

const DPR_CAP = 2;
const SPRITE_SIZE = 64; // 预渲染分辨率（2x 显示尺寸，保证高分屏不糊）

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = clamp(Math.round(r + r * amt), 0, 255);
  g = clamp(Math.round(g + g * amt), 0, 255);
  b = clamp(Math.round(b + b * amt), 0, 255);
  return `rgb(${r},${g},${b})`;
}

// ---------- 预渲染贴片 ----------
const spriteCache = new Map();

function makeGemSprite(color) {
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g = c.getContext('2d');
  const cx = SPRITE_SIZE / 2;
  const cy = SPRITE_SIZE / 2;
  const r = SPRITE_SIZE * 0.42;
  g.shadowColor = color;
  g.shadowBlur = 12;
  g.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  const grad = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.15);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.28, color);
  grad.addColorStop(1, shade(color, -0.45));
  g.fillStyle = grad;
  g.fill();
  g.shadowBlur = 0;
  g.beginPath();
  g.moveTo(cx, cy - r * 0.55);
  g.lineTo(cx + r * 0.32, cy + r * 0.1);
  g.lineTo(cx - r * 0.32, cy + r * 0.1);
  g.closePath();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 1;
  g.stroke();
  return c;
}

function makeFrozenSprite(color) {
  const base = makeGemSprite(color);
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g = c.getContext('2d');
  g.drawImage(base, 0, 0);
  const r = SPRITE_SIZE * 0.5;
  g.beginPath();
  g.arc(SPRITE_SIZE / 2, SPRITE_SIZE / 2, r, 0, Math.PI * 2);
  g.fillStyle = 'rgba(200,240,255,0.4)';
  g.fill();
  g.strokeStyle = 'rgba(230,250,255,0.9)';
  g.lineWidth = 2;
  g.stroke();
  return c;
}

function makeRockSprite(color) {
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(6, SPRITE_SIZE - 5);
  g.lineTo(SPRITE_SIZE * 0.2, 6);
  g.lineTo(SPRITE_SIZE * 0.55, 3);
  g.lineTo(SPRITE_SIZE - 4, SPRITE_SIZE * 0.25);
  g.lineTo(SPRITE_SIZE - 6, SPRITE_SIZE - 5);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(SPRITE_SIZE * 0.28, SPRITE_SIZE * 0.24, SPRITE_SIZE * 0.3, SPRITE_SIZE * 0.12);
  return c;
}

function sprite(theme, kind, color) {
  const key = `${theme}:${kind}:${color}`;
  let s = spriteCache.get(key);
  if (!s) {
    s = kind === 'rock' ? makeRockSprite(color)
      : kind === 'frozen' ? makeFrozenSprite(color)
        : makeGemSprite(color);
    spriteCache.set(key, s);
  }
  return s;
}

// ---------- 场景装饰（换章必换构图 + 装饰） ----------
function drawDecoration(ctx, theme, now) {
  const t = now / 1000;
  if (theme === 1) {
    ctx.fillStyle = 'rgba(176,108,255,0.12)';
    for (let i = 0; i < 7; i += 1) {
      const x = 140 + i * 170 + Math.sin(t * 0.4 + i) * 10;
      const h = 60 + (i % 3) * 40;
      ctx.beginPath();
      ctx.moveTo(x - 34, 0);
      ctx.lineTo(x, h);
      ctx.lineTo(x + 34, 0);
      ctx.closePath();
      ctx.fill();
    }
  } else if (theme === 2) {
    ctx.strokeStyle = 'rgba(255,154,61,0.18)';
    ctx.lineWidth = 14;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 380 - 60, WORLD.HEIGHT);
      ctx.lineTo(i * 380 + 220, 0);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,154,61,0.25)';
    for (let i = 0; i < 5; i += 1) {
      const x = 90 + i * 270 + Math.sin(t * 0.3 + i) * 8;
      ctx.beginPath();
      ctx.arc(x, 40 + (i % 2) * 30, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let k = 0; k < 3; k += 1) {
      ctx.strokeStyle = ['#52f0ff', '#7dff9a', '#b98cff'][k];
      ctx.lineWidth = 26;
      ctx.beginPath();
      for (let x = 0; x <= WORLD.WIDTH; x += 16) {
        const y = 30 + k * 34 + Math.sin(x / 90 + t * 0.7 + k * 1.7) * 22;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------- 粒子 ----------
function createParticles() {
  const list = [];
  return {
    burst(x, y, kind, color) {
      const n = kind === 'avalanche' ? 26 : 12;
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = kind === 'avalanche' ? 120 + Math.random() * 220 : 60 + Math.random() * 160;
        list.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: kind === 'avalanche' ? 0.7 + Math.random() * 0.5 : 0.4 + Math.random() * 0.3,
          max: 1,
          color,
          size: kind === 'avalanche' ? 4 : 3,
        });
      }
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 220 * dt;
      }
    },
    draw(ctx) {
      for (const p of list) {
        ctx.save();
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.restore();
      }
    },
  };
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const particles = createParticles();
  let hover = null;
  let pickMode = false;
  let shakeMag = 0;
  let lastNow = 0;
  let theme = 1;

  function resize() {
    const dpr = clamp(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1, DPR_CAP);
    const cssW = canvas.clientWidth || WORLD.WIDTH;
    const cssH = canvas.clientHeight || WORLD.HEIGHT;
    const scale = Math.min(cssW / WORLD.WIDTH, cssH / WORLD.HEIGHT);
    const ox = (cssW - WORLD.WIDTH * scale) / 2;
    const oy = (cssH - WORLD.HEIGHT * scale) / 2;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  }

  function setHover(cells) { hover = cells || null; }
  function setPickMode(v) { pickMode = !!v; }

  function burst(x, y, kind) {
    const c = THEMES[theme]?.accent || '#ffffff';
    particles.burst(x, y, kind, c);
    if (kind === 'avalanche' && !reduceMotion) shakeMag = Math.max(shakeMag, 9);
  }

  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;

    const hud = run && typeof run.getHud === 'function' ? run.getHud() : null;
    const th = hud ? (hud.theme || 1) : 1;
    theme = th;
    const pal = THEMES[th] || THEMES[1];

    particles.update(dt);
    shakeMag *= Math.max(0, 1 - 6 * dt);
    if (shakeMag < 0.1) shakeMag = 0;
    const shx = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;
    const shy = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;

    const bg = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    bg.addColorStop(0, pal.bgTop);
    bg.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    drawDecoration(ctx, th, now);

    if (!run) return;

    ctx.save();
    ctx.translate(shx, shy);

    const boardX = WORLD.BOARD_X - 8;
    const boardY = WORLD.BOARD_Y - 8;
    const boardSize = WORLD.CELL * COLS + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(boardX, boardY, boardSize, boardSize);
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = 2;
    ctx.strokeRect(boardX, boardY, boardSize, boardSize);

    if (hover) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      for (const [hx, hy] of hover) {
        ctx.fillRect(WORLD.BOARD_X + hx * WORLD.CELL, WORLD.BOARD_Y + hy * WORLD.CELL, WORLD.CELL, WORLD.CELL);
      }
    }

    const gsize = WORLD.CELL - GEM_PAD * 2;
    for (let x = 0; x < COLS; x += 1) {
      for (let y = 0; y < ROWS; y += 1) {
        const v = run.grid[x][y];
        if (v == null) continue;
        const px = WORLD.BOARD_X + x * WORLD.CELL + GEM_PAD;
        const py = WORLD.BOARD_Y + y * WORLD.CELL + GEM_PAD;
        if (v === ROCK) {
          ctx.drawImage(sprite(th, 'rock', pal.rock), px, py, gsize, gsize);
        } else {
          const color = pal.colors[v % pal.colors.length];
          const frozen = !!run.frozen[x][y];
          ctx.drawImage(sprite(th, frozen ? 'frozen' : 'gem', color), px, py, gsize, gsize);
        }
      }
    }

    if (pickMode) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now / 90);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(boardX + 2, boardY + 2, boardSize - 4, boardSize - 4);
      ctx.restore();
    }

    particles.draw(ctx);
    ctx.restore();
  }

  resize();
  return { draw, resize, burst, setHover, setPickMode, get theme() { return theme; } };
}
