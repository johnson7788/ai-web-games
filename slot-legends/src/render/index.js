// src/render/index.js — Canvas 2D 渲染：3 场景包 / 5×3 滚动轮 / 8 个程序化符号 / 粒子。
// 坐标固定 1280×720；DOM HUD 由 src/ui 负责，canvas 只画场景 + 轮盘 + 符号 + 特效。
import { WORLD } from '../../config/game.config.js';
import {
  REELS, ROWS, SYMBOLS, PAYLINES, PAYLINES_EXTRA, sceneFor,
} from '../../config/gameplay.js';
import { themeFor } from './theme.js';

const LAYOUT = {
  reel: { x: 180, y: 150, w: 920, h: 318, cols: 5, rows: 3 },
};
const CELL_W = LAYOUT.reel.w / LAYOUT.reel.cols;
const CELL_H = LAYOUT.reel.h / LAYOUT.reel.rows;

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ---------------------------------------------------------------- 符号（形状 + 颜色，一眼可分）
function drawShield(ctx, s) {
  ctx.fillStyle = '#4a6f9e';
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, -s * 0.5);
  ctx.lineTo(s * 0.42, -s * 0.5);
  ctx.lineTo(s * 0.42, s * 0.08);
  ctx.quadraticCurveTo(s * 0.42, s * 0.5, 0, s * 0.62);
  ctx.quadraticCurveTo(-s * 0.42, s * 0.5, -s * 0.42, s * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e6edf5';
  ctx.beginPath(); ctx.arc(0, -s * 0.06, s * 0.14, 0, Math.PI * 2); ctx.fill();
}

function drawWheel(ctx, s) {
  ctx.strokeStyle = '#b5782c';
  ctx.lineWidth = s * 0.12;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = s * 0.07;
  for (let i = 0; i < 5; i += 1) {
    const a = (Math.PI * 2 * i) / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4);
    ctx.lineTo(0, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#e0a13e';
  ctx.beginPath(); ctx.arc(0, 0, s * 0.13, 0, Math.PI * 2); ctx.fill();
}

function drawGourd(ctx, s) {
  ctx.fillStyle = '#3d8b6f';
  ctx.beginPath(); ctx.arc(0, -s * 0.14, s * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, s * 0.22, s * 0.34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2f6a55';
  ctx.fillRect(-s * 0.06, -s * 0.5, s * 0.12, s * 0.22);
}

function drawMask(ctx, s) {
  ctx.fillStyle = '#6a4296';
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, -s * 0.16);
  ctx.quadraticCurveTo(-s * 0.26, -s * 0.4, 0, -s * 0.28);
  ctx.quadraticCurveTo(s * 0.26, -s * 0.4, s * 0.5, -s * 0.16);
  ctx.quadraticCurveTo(s * 0.28, s * 0.12, 0, s * 0.06);
  ctx.quadraticCurveTo(-s * 0.28, s * 0.12, -s * 0.5, -s * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#140a1e';
  ctx.beginPath(); ctx.arc(-s * 0.24, -s * 0.14, s * 0.11, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.24, -s * 0.14, s * 0.11, 0, Math.PI * 2); ctx.fill();
}

function drawBlade(ctx, s) {
  ctx.fillStyle = '#a8322e';
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, -s * 0.46);
  ctx.quadraticCurveTo(s * 0.34, -s * 0.5, s * 0.2, s * 0.1);
  ctx.quadraticCurveTo(s * 0.1, s * 0.4, -s * 0.3, s * 0.5);
  ctx.quadraticCurveTo(-s * 0.5, s * 0.3, -s * 0.42, -s * 0.46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a2410';
  ctx.fillRect(-s * 0.34, s * 0.34, s * 0.18, s * 0.18);
}

function drawIngot(ctx, s) {
  ctx.fillStyle = '#e8b32e';
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, -s * 0.12);
  ctx.quadraticCurveTo(0, -s * 0.5, s * 0.5, -s * 0.12);
  ctx.quadraticCurveTo(s * 0.34, s * 0.16, s * 0.26, s * 0.4);
  ctx.lineTo(-s * 0.26, s * 0.4);
  ctx.quadraticCurveTo(-s * 0.34, s * 0.16, -s * 0.5, -s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3c0';
  ctx.fillRect(-s * 0.2, -s * 0.06, s * 0.4, s * 0.2);
}

function drawToken(ctx, s) {
  ctx.fillStyle = '#b06a2f';
  ctx.beginPath(); ctx.arc(0, 0, s * 0.44, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a4f1e';
  ctx.fillRect(-s * 0.18, -s * 0.18, s * 0.36, s * 0.36);
  ctx.fillStyle = '#f0d9a8';
  ctx.fillRect(-s * 0.1, -s * 0.1, s * 0.2, s * 0.2);
}

function drawWild(ctx, s) {
  ctx.fillStyle = '#7fd4e0';
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (Math.PI * 2 * i) / 5;
    const a2 = a + Math.PI / 5;
    if (i === 0) ctx.moveTo(Math.cos(a) * s * 0.52, Math.sin(a) * s * 0.52);
    else ctx.lineTo(Math.cos(a) * s * 0.52, Math.sin(a) * s * 0.52);
    ctx.lineTo(Math.cos(a2) * s * 0.24, Math.sin(a2) * s * 0.24);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#eaffff';
  ctx.beginPath(); ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2); ctx.fill();
}

const SYMBOL_DRAW = {
  official: drawShield,
  escort: drawWheel,
  wine: drawGourd,
  thief: drawMask,
  blade: drawBlade,
  ingot: drawIngot,
  token: drawToken,
  wild: drawWild,
};

function drawSymbol(ctx, id, cx, cy, size) {
  const s = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  const fn = SYMBOL_DRAW[id];
  if (fn) fn(ctx, s);
  ctx.restore();
}

// ---------------------------------------------------------------- 场景背景装饰
function drawDecor(ctx, theme, scene) {
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  if (scene === 'tavern') {
    // 木质横板
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    for (let y = 60; y < 700; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let i = 0; i < 4; i += 1) {
      const x = 150 + i * 320;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x, 60, 6, 620);
    }
  } else if (scene === 'stronghold') {
    // 石墙块 + 绿旗
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    for (let y = 0; y < H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let x = 0; x < W; x += 96) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (const x of [60, W - 120]) {
      ctx.fillStyle = '#2f6a4f';
      ctx.fillRect(x, 40, 16, 90);
      ctx.fillStyle = '#7fd4a0';
      ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x + 90, 40); ctx.lineTo(x + 16, 78); ctx.closePath(); ctx.fill();
    }
  } else {
    // 夜市：红灯笼 + 星点
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 173) % W;
      const y = (i * 97) % 200;
      ctx.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 7; i += 1) {
      const x = 70 + i * 190;
      const y = 70 + (i % 2) * 26;
      ctx.fillStyle = theme.lantern;
      ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 22); ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- 粒子（金雨 / 中奖）
export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];

  function burst(x, y, kind) {
    const n = kind === 'gold' ? 40 : 14;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = kind === 'gold' ? 60 + Math.random() * 260 : 40 + Math.random() * 160;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (kind === 'gold' ? 80 : 30),
        life: 0,
        ttl: kind === 'gold' ? 1.4 + Math.random() * 0.8 : 0.5 + Math.random() * 0.4,
        kind,
        size: kind === 'gold' ? 2 + Math.random() * 4 : 1.5 + Math.random() * 3,
      });
    }
  }

  function tick(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.ttl) { particles.splice(i, 1); continue; }
      p.vy += (p.kind === 'gold' ? 320 : 140) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function rollingSymbol(c, row, spinTime) {
    const pool = ['official', 'escort', 'wine', 'thief', 'blade', 'ingot'];
    return pool[Math.abs((c * 5 + row * 3 + Math.floor(spinTime * 20))) % pool.length];
  }

  function drawReelCell(cx, cy, id, theme) {
    roundedRect(ctx, cx - CELL_W / 2 + 3, cy - CELL_H / 2 + 3, CELL_W - 6, CELL_H - 6, 10);
    ctx.fillStyle = theme.cell;
    ctx.fill();
    ctx.strokeStyle = theme.cellBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawSymbol(ctx, id, cx, cy, Math.min(CELL_W, CELL_H) * 0.72);
  }

  function draw(run, alpha = 1) {
    const scene = run ? sceneFor(run.level) : 'tavern';
    const theme = themeFor(scene);

    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, theme.bgTop);
    g.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    drawDecor(ctx, theme, scene);

    // 轮盘外框
    const r = LAYOUT.reel;
    roundedRect(ctx, r.x - 16, r.y - 16, r.w + 32, r.h + 32, 18);
    ctx.fillStyle = theme.frame;
    ctx.fill();
    ctx.strokeStyle = theme.frameEdge;
    ctx.lineWidth = 3;
    ctx.stroke();
    roundedRect(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 12);
    ctx.fillStyle = theme.frameLight;
    ctx.fill();

    if (!run) return;

    // 滚轮
    for (let c = 0; c < REELS; c += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        const cx = r.x + c * CELL_W + CELL_W / 2;
        const cy = r.y + row * CELL_H + CELL_H / 2;
        if (run.reelStopped[c]) {
          drawReelCell(cx, cy, run.target[c][row], theme);
        } else {
          // 滚动中：模糊色块 + 滚动符号
          roundedRect(ctx, cx - CELL_W / 2 + 3, cy - CELL_H / 2 + 3, CELL_W - 6, CELL_H - 6, 10);
          ctx.fillStyle = '#e8dcc0';
          ctx.fill();
          ctx.strokeStyle = theme.cellBorder;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 0.85;
          drawSymbol(ctx, rollingSymbol(c, row, run.spinTime), cx, cy, Math.min(CELL_W, CELL_H) * 0.7);
          ctx.globalAlpha = 1;
        }
      }
    }

    // 中奖线高亮（连一条亮线贯穿中奖格，清楚示意「这一条线中了」）
    if (run.winLines && run.winLines.length && (run.phase === 'settle' || run.phase === 'idle')) {
      const lines = run.level >= 6 ? PAYLINES.concat(PAYLINES_EXTRA) : PAYLINES;
      for (const wl of run.winLines) {
        const line = lines[wl.li];
        if (!line || wl.count < 3) continue;
        const pts = [];
        for (let c = 0; c < wl.count; c += 1) {
          pts.push({ x: r.x + c * CELL_W + CELL_W / 2, y: r.y + line[c] * CELL_H + CELL_H / 2 });
        }
        ctx.save();
        ctx.strokeStyle = theme.glow;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    // 粒子
    for (const p of particles) {
      const k = p.life / p.ttl;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = p.kind === 'gold' ? '#ffd84a' : theme.glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    void alpha;
  }

  return { draw, burst, tick, particles };
}

export default createRender;
