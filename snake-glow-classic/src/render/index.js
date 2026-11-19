// src/render/index.js — Canvas 2D 霓虹街机渲染。
// 固定逻辑坐标 1280×720；DPR ≤2；光效用少量 shadowBlur（食物/头/金色球）保证 60fps。
import { WORLD, STAGES } from '../../config/game.config.js';

const CX = (x) => WORLD.BOARD_X + (x + 0.5) * WORLD.CELL;
const CY = (y) => WORLD.BOARD_Y + (y + 0.5) * WORLD.CELL;

const C = {
  bg0: '#07060f',
  bg1: '#0c0b1a',
  grid: 'rgba(80, 200, 255, 0.10)',
  border: 'rgba(25, 230, 255, 0.35)',
  head: '#22e6ff',
  tail: '#ff3ec8',
  headCore: '#a9f6ff',
  eye: '#0a0a14',
  food: '#ffb347',
  foodCore: '#fff7e0',
  foodRing: '#ffffff',
  gold: '#ffd34d',
  goldCore: '#fff4c2',
  rock: '#b44dff',
  rockCore: '#e6c8ff',
};

function hexA(hex, a) {
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function lerpColor(a, b, t) {
  const A = a.slice(1);
  const B = b.slice(1);
  const r = Math.round(parseInt(A.slice(0, 2), 16) + (parseInt(B.slice(0, 2), 16) - parseInt(A.slice(0, 2), 16)) * t);
  const g = Math.round(parseInt(A.slice(2, 4), 16) + (parseInt(B.slice(2, 4), 16) - parseInt(A.slice(2, 4), 16)) * t);
  const bl = Math.round(parseInt(A.slice(4, 6), 16) + (parseInt(B.slice(4, 6), 16) - parseInt(A.slice(4, 6), 16)) * t);
  return `rgb(${r},${g},${bl})`;
}

function makeBackground() {
  const c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  grad.addColorStop(0, C.bg0);
  grad.addColorStop(1, C.bg1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 网格
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.COLS; x += 1) {
    ctx.beginPath();
    ctx.moveTo(WORLD.BOARD_X + x * WORLD.CELL, WORLD.BOARD_Y);
    ctx.lineTo(WORLD.BOARD_X + x * WORLD.CELL, WORLD.BOARD_Y + WORLD.BOARD_H);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD.ROWS; y += 1) {
    ctx.beginPath();
    ctx.moveTo(WORLD.BOARD_X, WORLD.BOARD_Y + y * WORLD.CELL);
    ctx.lineTo(WORLD.BOARD_X + WORLD.BOARD_W, WORLD.BOARD_Y + y * WORLD.CELL);
    ctx.stroke();
  }

  // 棋盘外框 glow
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(WORLD.BOARD_X, WORLD.BOARD_Y, WORLD.BOARD_W, WORLD.BOARD_H);

  // 四角微光
  const corners = [
    [WORLD.BOARD_X, WORLD.BOARD_Y],
    [WORLD.BOARD_X + WORLD.BOARD_W, WORLD.BOARD_Y],
    [WORLD.BOARD_X, WORLD.BOARD_Y + WORLD.BOARD_H],
    [WORLD.BOARD_X + WORLD.BOARD_W, WORLD.BOARD_Y + WORLD.BOARD_H],
  ];
  for (const [x, y] of corners) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 90);
    g.addColorStop(0, 'rgba(34,230,255,0.18)');
    g.addColorStop(1, 'rgba(34,230,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 90, y - 90, 180, 180);
  }

  // 扫描线（柔和，营造街机感）
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let y = 2; y < WORLD.HEIGHT; y += 3) ctx.fillRect(0, y, WORLD.WIDTH, 1);

  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = makeBackground();

  function glow(color, blur = 14) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
  function noGlow() {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  function starPath(x, y, outer, inner, points = 5) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // 拾取物：大范围柔光晕 + 明亮五角星 + 白色脉冲环，让「目标」一眼可见
  function drawPickup(x, y, radius, color, core, pulse) {
    const r = radius * pulse;
    const now = performance.now() / 1000;
    // 大范围柔光晕（让目标在缩小的移动端仍醒目）
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    g.addColorStop(0, 'rgba(255,255,255,0.40)');
    g.addColorStop(0.35, hexA(color, 0.30));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    // 白色脉冲环
    const R = r + 9 + 3 * Math.sin(now * 6);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // 星
    glow(color, 16);
    ctx.fillStyle = color;
    starPath(x, y, r, r * 0.5);
    ctx.fill();
    noGlow();
    ctx.fillStyle = core;
    starPath(x, y, r * 0.46, r * 0.22);
    ctx.fill();
  }

  function drawRock(cell, t) {
    const x = CX(cell.x);
    const y = CY(cell.y);
    const s = WORLD.CELL * 0.36;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(cell.x * 1.7 + cell.y * 2.3);
    glow(C.rock, 10);
    ctx.fillStyle = C.rock;
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.5);
    ctx.lineTo(s * 0.4, s);
    ctx.lineTo(s, -s * 0.2);
    ctx.lineTo(0, -s);
    ctx.closePath();
    ctx.fill();
    noGlow();
    ctx.strokeStyle = C.rockCore;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function render(run, fx = {}, opts = {}) {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(bg, 0, 0);

    if (!run) return;
    const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;

    // 岩石
    for (const r of run.rocks) drawRock(r, t);

    // 拖尾（冲刺更亮）
    if (Array.isArray(fx.trail)) {
      for (let i = 0; i < fx.trail.length; i += 1) {
        const p = fx.trail[i];
        const a = (i / Math.max(1, fx.trail.length)) * (run.boosting ? 0.30 : 0.16);
        ctx.fillStyle = `rgba(34,230,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, WORLD.CELL * 0.18 * (0.4 + 0.6 * (i / fx.trail.length)), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 身体：分段连线成一条连续蛇身（round cap/join），避免「一串球」的误读
    const n = run.snake.length;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 柔光底层
    for (let i = 0; i < n - 1; i += 1) {
      const a = run.snake[i];
      const b = run.snake[i + 1];
      const k = n <= 1 ? 0 : i / (n - 1);
      const color = lerpColor(C.head, C.tail, k);
      const w = WORLD.CELL * (0.78 - 0.20 * k);
      ctx.strokeStyle = color.replace('rgb', 'rgba').replace(')', ',0.20)');
      ctx.lineWidth = w + 9;
      ctx.beginPath();
      ctx.moveTo(CX(a.x), CY(a.y));
      ctx.lineTo(CX(b.x), CY(b.y));
      ctx.stroke();
    }
    // 实体层
    for (let i = 0; i < n - 1; i += 1) {
      const a = run.snake[i];
      const b = run.snake[i + 1];
      const k = n <= 1 ? 0 : i / (n - 1);
      const color = lerpColor(C.head, C.tail, k);
      const w = WORLD.CELL * (0.78 - 0.20 * k);
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(CX(a.x), CY(a.y));
      ctx.lineTo(CX(b.x), CY(b.y));
      ctx.stroke();
    }

    // 头（朝运动方向 + 眼睛）
    {
      const head = run.snake[0];
      const x = CX(head.x);
      const y = CY(head.y);
      glow(C.head, 20);
      ctx.fillStyle = C.headCore;
      ctx.beginPath();
      ctx.arc(x, y, WORLD.CELL * 0.44, 0, Math.PI * 2);
      ctx.fill();
      noGlow();
      const dx = run.dir.x;
      const dy = run.dir.y;
      const ex = x + dx * 9;
      const ey = y + dy * 9;
      const px = -dy * 9;
      const py = dx * 9;
      ctx.fillStyle = C.eye;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(ex + px * sgn * 0.5, ey + py * sgn * 0.5, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(ex + px * sgn * 0.5 + dx * 1.5, ey + py * sgn * 0.5 + dy * 1.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 食物（目标）：琥珀五角星 + 柔光晕 + 白色脉冲环
    if (run.food) drawPickup(CX(run.food.x), CY(run.food.y), WORLD.CELL * 0.48, C.food, C.foodCore, 0.92 + 0.08 * Math.sin(t * 6));

    // 金色球
    if (run.gold) {
      const blink = 1 + 0.12 * Math.sin(t * 10);
      drawPickup(CX(run.gold.x), CY(run.gold.y), WORLD.CELL * 0.52 * blink, C.gold, C.goldCore, 1);
    }

    // 粒子
    if (Array.isArray(fx.particles)) {
      for (const p of fx.particles) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = `rgba(${p.color},${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 阶段横幅（切段瞬间由 UI 负责，渲染只画一个极淡的段位色）
    if (run.stage >= 2 && !opts.noStageHint) {
      const sc = run.stage === 3 ? C.gold : C.rock;
      ctx.strokeStyle = sc;
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 2));
      ctx.lineWidth = 1.5;
      ctx.strokeRect(WORLD.BOARD_X + 2, WORLD.BOARD_Y + 2, WORLD.BOARD_W - 4, WORLD.BOARD_H - 4);
      ctx.globalAlpha = 1;
    }
  }

  return { render, canvas };
}
