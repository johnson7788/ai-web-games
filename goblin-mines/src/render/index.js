// src/render/index.js — GOBLIN MINES · Canvas2D 程序化渲染（发光矿洞 + 三套场景色板）。
// 只负责画面：背景 / 岩壁 / 矿石 / 灯笼光柱 / 矿车 / 粒子。所有数值/文案来自 config 与 run。
import { WORLD } from '../../config/game.config.js';
import { TILE, ORE_KEYS } from '../game/sim.js';
import { CHAPTERS, ORE_COLORS, chapterOf } from './theme.js';

const B = WORLD.BOARD;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function gemPath(ctx, x, y, s, type) {
  const r = s * 0.36;
  ctx.beginPath();
  switch (type) {
    case 0: ctx.arc(x, y, r, 0, Math.PI * 2); break;               // 红宝石 圆
    case 1: ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); break; // 蓝宝石 菱形
    case 2: ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.9, y + r * 0.8); ctx.lineTo(x - r * 0.9, y + r * 0.8); ctx.closePath(); break; // 紫晶 三角
    case 3: for (let i = 0; i < 6; i += 1) { const a = (Math.PI / 3) * i - Math.PI / 6; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } ctx.closePath(); break; // 绿宝石 六角
    case 4: ctx.moveTo(x, y - r); ctx.bezierCurveTo(x + r, y, x + r, y + r * 0.7, x, y + r); ctx.bezierCurveTo(x - r, y + r * 0.7, x - r, y, x, y - r); ctx.closePath(); break; // 燃料 水滴
    case 5: ctx.arc(x, y, r, 0, Math.PI * 2); break;               // 金块 圆（内圈另画）
    default: ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

export function createRender(canvas) {
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let shake = 0;
  let cart = { fill: 0, departAt: -1, time: 0 };
  const bgGradientCache = new Map();

  function burst(x, y, kind, color) {
    const n = kind === 'dig' ? 26 : kind === 'shaftClear' ? 40 : 12;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * (kind === 'shaftClear' ? 6 : 3.5);
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 1, decay: 0.02 + Math.random() * 0.03, color: color || '#ffd24d', size: 2 + Math.random() * 3 });
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }

  function departCart() {
    cart.departAt = cart.time;
  }

  function oreColor(type) { return ORE_COLORS[type] || '#ffffff'; }

  function drawBackground(chapter) {
    const th = chapterOf(chapter);
    let g = bgGradientCache.get(chapter);
    if (!g) {
      g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
      g.addColorStop(0, th.bg[0]);
      g.addColorStop(0.6, th.bg[1]);
      g.addColorStop(1, th.bg[2]);
      bgGradientCache.set(chapter, g);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 顶部钟乳石（构图随章节变化）
    ctx.fillStyle = th.wall;
    for (let i = 0; i < 14; i += 1) {
      const x = (i + 0.5) * (WORLD.WIDTH / 14) + Math.sin(i * 3.7) * 20;
      const h = 26 + ((i * 37) % 42);
      ctx.beginPath();
      ctx.moveTo(x - 14, 0);
      ctx.lineTo(x, h);
      ctx.lineTo(x + 14, 0);
      ctx.closePath();
      ctx.fill();
    }
    // 底部矿道地面
    ctx.fillStyle = th.wall;
    ctx.fillRect(0, B.y0 + B.rows * B.tile + 8, WORLD.WIDTH, WORLD.HEIGHT - B.y0 - B.rows * B.tile - 8);
  }

  function drawCell(run, c, r, litColumns, chapter) {
    const cell = run.board[c][r];
    const x = B.x0 + c * B.tile + B.tile / 2;
    const y = B.y0 + r * B.tile + B.tile / 2;
    const th = chapterOf(chapter);

    // 格底
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    roundRect(ctx, B.x0 + c * B.tile + 2, B.y0 + r * B.tile + 2, B.tile - 4, B.tile - 4, 8);
    ctx.fill();

    // 灯笼光柱（该列有地精）
    const lit = litColumns.has(c);
    if (lit) {
      const lg = ctx.createLinearGradient(0, B.y0, 0, B.y0 + B.rows * B.tile);
      lg.addColorStop(0, 'rgba(255,190,90,0.10)');
      lg.addColorStop(1, 'rgba(255,190,90,0.02)');
      ctx.fillStyle = lg;
      ctx.fillRect(B.x0 + c * B.tile, B.y0, B.tile, B.rows * B.tile);
    }

    if (cell.t === TILE.EMPTY) return;

    if (cell.t === TILE.ROCK || cell.t === TILE.BOSS) {
      const rockColor = cell.t === TILE.BOSS ? '#2a1520' : th.rock;
      const edge = cell.t === TILE.BOSS ? '#c2455a' : th.rockEdge;
      ctx.fillStyle = rockColor;
      roundRect(ctx, B.x0 + c * B.tile + 3, B.y0 + r * B.tile + 3, B.tile - 6, B.tile - 6, 6);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      roundRect(ctx, B.x0 + c * B.tile + 4, B.y0 + r * B.tile + 4, B.tile - 8, B.tile - 8, 5);
      ctx.stroke();
      if (cell.frozen) {
        ctx.fillStyle = 'rgba(140,200,255,0.45)';
        roundRect(ctx, B.x0 + c * B.tile + 3, B.y0 + r * B.tile + 3, B.tile - 6, B.tile - 6, 6);
        ctx.fill();
      }
      if (cell.hp > 1) {
        ctx.fillStyle = edge;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(cell.hp), x, y + 5);
      }
      if (cell.t === TILE.BOSS) {
        // 矿兽红眼
        ctx.fillStyle = '#ff5d5d';
        ctx.beginPath(); ctx.arc(x - 8, y - 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 8, y - 2, 3, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }

    // 矿石：廉价两层发光（外圈低透明 + 主体 + 高光）
    const col = oreColor(cell.t);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = col;
    gemPath(ctx, x, y, B.tile * 1.32, cell.t);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    gemPath(ctx, x, y, B.tile, cell.t);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    gemPath(ctx, x, y - 3, B.tile * 0.62, cell.t);
    ctx.fill();
    if (cell.t === TILE.GOLD) {
      ctx.strokeStyle = '#8a5a1a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, B.tile * 0.24, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawCart(run, alpha) {
    const th = chapterOf(run.getHud().chapter);
    const total = run.stats.totalOres + run.stats.coins;
    const target = Math.min(1, total / 60);
    cart.fill += (target - cart.fill) * 0.1;
    cart.time += 1 / 60;

    let x = WORLD.WIDTH / 2;
    if (cart.departAt >= 0) {
      const t = cart.time - cart.departAt;
      if (t < 1.6) x = WORLD.WIDTH / 2 + (t / 1.6) * (WORLD.WIDTH / 2 + 160);
      else { cart.departAt = -1; cart.fill = 0; }
      // 车灯拖尾（signature）
      if (cart.departAt >= 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(x - 140, 0, x, 0);
        g.addColorStop(0, 'rgba(255,200,80,0)');
        g.addColorStop(1, 'rgba(255,210,90,0.85)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 150, B.y0 + B.rows * B.tile + 14, 150, 34);
        ctx.restore();
      }
    }

    const cy = B.y0 + B.rows * B.tile + 30;
    // 车身
    ctx.fillStyle = th.rock;
    roundRect(ctx, x - 46, cy - 14, 92, 26, 6);
    ctx.fill();
    ctx.strokeStyle = th.rockEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, x - 46, cy - 14, 92, 26, 6);
    ctx.stroke();
    // 矿堆
    ctx.fillStyle = '#ffd24d';
    const h = Math.max(0, cart.fill) * 20;
    roundRect(ctx, x - 34, cy - 12 - h, 68, h, 3);
    ctx.fill();
    // 车轮
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(x - 28, cy + 14, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 28, cy + 14, 7, 0, Math.PI * 2); ctx.fill();
    // 车灯
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath(); ctx.arc(x + 42, cy - 4, 4, 0, Math.PI * 2); ctx.fill();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= p.decay;
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    particles = particles.filter((p) => p.life > 0);
  }

  function draw(run, alpha) {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.86;
    }

    const chapter = run ? run.getHud().chapter : 0;
    drawBackground(chapter);

    if (run && run.phase !== 'boot') {
      const litColumns = new Set(run.goblins.map((g) => g.col));
      for (let c = 0; c < B.cols; c += 1) for (let r = 0; r < B.rows; r += 1) drawCell(run, c, r, litColumns, chapter);
      drawCart(run, alpha);
    }
    drawParticles();
    ctx.restore();
  }

  return {
    draw,
    burst,
    departCart,
    shake: (n) => { shake = n; },
    get particles() { return particles; },
  };
}
