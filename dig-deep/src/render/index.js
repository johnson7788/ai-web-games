// src/render/index.js — DIG DEEP Canvas2D 渲染（letterbox 世界 1280×720）
import { WORLD } from '../../config/game.config.js';
import { themeFor } from './theme.js';

const { WIDTH, HEIGHT, COLS, CELL, SHAFT_X, SHAFT_W } = WORLD;
const FRONT_Y = 150;   // 当前挖掘行（frontier）的屏幕 y
const RIG_Y = 118;     // 钻机中心 y

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cellScreenY(run, r) {
  return FRONT_Y + (r - run.depth) * CELL;
}

function cellColor(theme, cell) {
  switch (cell.type) {
    case 'rock': return theme.rock;
    case 'diamond': return theme.diamond;
    case 'fossil': return theme.fossil;
    case 'fault': return theme.fault;
    case 'lava': return '#ff5a20';
    default: {
      const idx = cell.rubble ? 1 : (cell.hard > 1 ? 1 : 0);
      return theme.dirt[idx % theme.dirt.length];
    }
  }
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const particles = [];

  function burst(x, y, kind) {
    const theme = themeFor(0);
    const color = kind === 'diamond' ? theme.diamond : kind === 'fossil' ? theme.fossil : kind === 'collapse' ? theme.rock : theme.accent;
    const n = kind === 'collapse' ? 14 : kind === 'diamond' || kind === 'fossil' ? 8 : 5;
    for (let i = 0; i < n; i += 1) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * (kind === 'collapse' ? 260 : 120),
        vy: (Math.random() - 0.5) * 120 - 40,
        life: 0.4 + Math.random() * 0.3,
        age: 0,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  function drawBackground(theme) {
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, theme.bgTop);
    g.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // 地层装饰条
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = theme.strata[i % theme.strata.length];
      const y = (i * 130 + 40) % HEIGHT;
      ctx.fillRect(0, y, WIDTH, 22 + (i % 3) * 10);
    }
    ctx.restore();
  }

  function drawShaft(theme) {
    ctx.fillStyle = theme.shaftDark;
    ctx.fillRect(SHAFT_X - 20, 0, SHAFT_W + 40, HEIGHT);
    // 永久竖井壁
    ctx.fillStyle = theme.shaftWall;
    ctx.fillRect(SHAFT_X - 20, 0, 20, HEIGHT);
    ctx.fillRect(SHAFT_X + SHAFT_W, 0, 20, HEIGHT);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(SHAFT_X - 20, 0, 6, HEIGHT);
    ctx.fillRect(SHAFT_X + SHAFT_W + 14, 0, 6, HEIGHT);
  }

  function drawFlood(theme, run) {
    if (!run) return;
    const floodY = FRONT_Y + (run.flood - run.depth) * CELL;
    if (floodY <= 0) return;
    const top = Math.max(0, floodY - 40);
    const g = ctx.createLinearGradient(0, top, 0, floodY);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, theme.flood);
    ctx.fillStyle = g;
    ctx.fillRect(SHAFT_X - 20, top, SHAFT_W + 40, floodY - top);
    ctx.fillStyle = theme.floodGlow;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(SHAFT_X - 20, floodY - 4, SHAFT_W + 40, 4);
    ctx.globalAlpha = 1;
  }

  function drawCell(theme, run, col, r, cell) {
    const y = cellScreenY(run, r);
    const x = SHAFT_X + col * CELL;
    if (y + CELL < 0 || y > HEIGHT) return;
    // 已挖掉的格子 = 空（隧道）
    if (!cell.alive) {
      ctx.fillStyle = theme.shaftDark;
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      return;
    }
    const isFront = r === run.depth && col === run.col;
    ctx.fillStyle = cellColor(theme, cell);
    roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (cell.type === 'rock') {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.moveTo(x + 20, y + 30); ctx.lineTo(x + 40, y + 56); ctx.lineTo(x + 62, y + 40);
      ctx.stroke();
    } else if (cell.type === 'lava') {
      ctx.fillStyle = '#ffd060';
      ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, 14, 0, Math.PI * 2); ctx.fill();
    } else if (cell.type === 'diamond') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x + CELL / 2, y + 14); ctx.lineTo(x + CELL - 18, y + CELL / 2);
      ctx.lineTo(x + CELL / 2, y + CELL - 14); ctx.lineTo(x + 18, y + CELL / 2);
      ctx.closePath(); ctx.fill();
    } else if (cell.type === 'fossil') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = 'bold 30px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🦴', x + CELL / 2, y + CELL / 2);
    } else if (cell.type === 'fault') {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 18, y + 20); ctx.lineTo(x + CELL / 2, y + CELL / 2); ctx.lineTo(x + CELL - 20, y + CELL - 18);
      ctx.stroke();
    }

    // 硬度数字
    if (cell.hard !== Infinity && cell.hard > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.font = 'bold 26px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cell.hard), x + CELL / 2, y + CELL / 2 + 1);
    }

    // 当前列高亮
    if (isFront) {
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 4;
      roundRect(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 8);
      ctx.stroke();
    }
  }

  function drawRig(theme, run) {
    if (!run) return;
    const x = SHAFT_X + run.col * CELL + CELL / 2;
    ctx.save();
    ctx.translate(x, RIG_Y);
    // 钻杆
    ctx.strokeStyle = theme.rigDark;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(0, FRONT_Y - RIG_Y + 20);
    ctx.stroke();
    // 机身
    ctx.fillStyle = theme.rig;
    roundRect(ctx, -34, -30, 68, 52, 10);
    ctx.fill();
    ctx.strokeStyle = theme.rigDark;
    ctx.lineWidth = 3;
    ctx.stroke();
    // 座舱窗
    ctx.fillStyle = 'rgba(10,10,14,0.85)';
    roundRect(ctx, -16, -18, 32, 26, 6);
    ctx.fill();
    // 钻头
    ctx.fillStyle = theme.rigDark;
    ctx.beginPath();
    ctx.moveTo(-14, FRONT_Y - RIG_Y + 20);
    ctx.lineTo(14, FRONT_Y - RIG_Y + 20);
    ctx.lineTo(0, FRONT_Y - RIG_Y + 38);
    ctx.closePath(); ctx.fill();
    // 灯光
    ctx.fillStyle = theme.accent;
    ctx.beginPath(); ctx.arc(0, 20, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawParticles(dt) {
    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      const k = Math.max(0, 1 - p.age / p.life);
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].age >= particles[i].life) particles.splice(i, 1);
    }
  }

  function draw(run, alpha = 1, dt = 1 / 60) {
    const theme = themeFor(run ? run.getHud().theme : 0);
    drawBackground(theme);
    drawShaft(theme);
    drawFlood(theme, run);
    if (run) {
      const hud = run.getHud();
      const from = Math.max(0, Math.floor(hud.depth) - 0);
      const to = hud.depth + 8;
      for (let r = from; r <= to; r += 1) {
        const row = run.peek(r);
        for (let c = 0; c < COLS; c += 1) {
          drawCell(theme, run, c, r, row[c]);
        }
      }
      drawRig(theme, run);
    }
    drawParticles(dt);
  }

  return { draw, burst };
}
