// Canvas 2D 渲染：霓虹街机风蛇梯棋盘 + 棋子（程序化，零素材）。
// 静态棋盘（格子/梯子/蛇/岩石/树）缓存到离屏 canvas，每帧只画动态元素，保证帧率。
import { WORLD } from '../../config/game.config.js';
import { BOARD, cellToRC, LEVELS } from '../../config/levels.js';

const ROWS = BOARD.ROWS;
const COLS = BOARD.COLS;
const MAX = BOARD.MAX;

const CELL = 82;
const BOARD_X = 30;
const BOARD_Y = 96;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;

const COLORS = {
  bg0: '#0a0618',
  bg1: '#120a2e',
  cellA: '#1a1040',
  cellB: '#241655',
  grid: '#2a1c52',
  text: '#c9bfff',
  num: '#a89fe0',
  ladder: '#ffd23f',
  snake: '#3cff8f',
  snakeHead: '#ff4d6d',
  rock: '#8a7a5a',
  rockHi: '#c0ad88',
  gem: '#38e6ff',
  tree: '#5bff9d',
  dest: '#ffcf5e',
  start: '#5ef2ff',
  human: '#ffd23f',
  ai: ['#ff4d6d', '#4da3ff'],
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cellCenter(cell) {
  const { r, col } = cellToRC(cell);
  const x = BOARD_X + col * CELL + CELL / 2;
  const y = BOARD_Y + (ROWS - 1 - r) * CELL + CELL / 2;
  return { x, y };
}

function drawLadder(ctx, from, to) {
  const a = cellCenter(from);
  const b = cellCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const off = 10;
  ctx.strokeStyle = COLORS.ladder;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.9;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(a.x + nx * off * s, a.y + ny * off * s);
    ctx.lineTo(b.x + nx * off * s, b.y + ny * off * s);
    ctx.stroke();
  }
  const rungs = 5;
  for (let i = 1; i < rungs; i += 1) {
    const t = i / rungs;
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    ctx.beginPath();
    ctx.moveTo(cx + nx * off, cy + ny * off);
    ctx.lineTo(cx - nx * off, cy - ny * off);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSnake(ctx, from, to) {
  const a = cellCenter(from);
  const b = cellCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const nx = -dy / (Math.hypot(dx, dy) || 1);
  const ny = dx / (Math.hypot(dx, dy) || 1);
  ctx.strokeStyle = COLORS.snake;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  const wave = 16;
  ctx.bezierCurveTo(
    a.x + dx * 0.3 + nx * wave, a.y + dy * 0.3 + ny * wave,
    a.x + dx * 0.7 - nx * wave, a.y + dy * 0.7 - ny * wave,
    b.x, b.y,
  );
  ctx.stroke();
  ctx.fillStyle = COLORS.snakeHead;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRock(ctx, cell) {
  const { x, y } = cellCenter(cell);
  ctx.save();
  ctx.translate(x, y);
  const s = CELL * 0.3;
  ctx.fillStyle = COLORS.rock;
  ctx.beginPath();
  ctx.moveTo(-s, s * 0.6);
  ctx.lineTo(-s * 0.5, -s * 0.2);
  ctx.lineTo(s * 0.1, -s * 0.9);
  ctx.lineTo(s, -s * 0.1);
  ctx.lineTo(s * 0.7, s * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLORS.rockHi;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawGem(ctx, cell, time) {
  const { x, y } = cellCenter(cell);
  const pulse = 0.6 + 0.4 * Math.sin(time * 4 + cell);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  const s = CELL * 0.22 * (0.85 + 0.15 * pulse);
  ctx.fillStyle = COLORS.gem;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = '#a9f4ff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.restore();
}

function drawTree(ctx, cell) {
  const { x, y } = cellCenter(cell);
  ctx.fillStyle = '#6a4b2f';
  ctx.fillRect(x - 4, y - 2, 8, CELL * 0.22);
  ctx.fillStyle = COLORS.tree;
  ctx.beginPath();
  ctx.moveTo(x, y - CELL * 0.5);
  ctx.lineTo(x - CELL * 0.28, y);
  ctx.lineTo(x + CELL * 0.28, y);
  ctx.closePath();
  ctx.fill();
}

function drawStar(ctx, x, y, rr, color, pulse = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? rr : rr * 0.46;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff4d6';
  ctx.lineWidth = 1.5 * pulse;
  ctx.stroke();
  ctx.restore();
}

function drawDest(ctx, cell, time) {
  const { x, y } = cellCenter(cell);
  const pulse = 0.7 + 0.3 * Math.sin(time * 3);
  ctx.strokeStyle = COLORS.dest;
  ctx.lineWidth = 3;
  roundRect(ctx, x - CELL / 2 + 3, y - CELL / 2 + 3, CELL - 6, CELL - 6, 8);
  ctx.stroke();
  drawStar(ctx, x, y - 12, CELL * 0.24, COLORS.dest, pulse);
  ctx.fillStyle = COLORS.dest;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FINISH', x, y + CELL * 0.28);
}

function drawToken(ctx, seat, kind, x, y, time, active) {
  const color = kind === 'human' ? COLORS.human : COLORS.ai[seat % COLORS.ai.length];
  const r = kind === 'human' ? CELL * 0.3 : CELL * 0.24;
  // 外圈（活跃玩家高亮）
  if (active) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 + Math.sin(time * 6) * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 光晕（半透明圆，不用 shadowBlur；玩家更大更亮）
  ctx.fillStyle = kind === 'human' ? 'rgba(255,210,63,0.3)' : 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.arc(x, y, r + 7, 0, Math.PI * 2);
  ctx.fill();
  // 本体
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 'human') {
    // 玩家：白色粗描边 + YOU 标签
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#120a2e';
    ctx.font = `bold ${Math.round(CELL * 0.22)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', x, y + 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('YOU', x, y + r + 14);
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#120a2e';
    ctx.font = `bold ${Math.round(CELL * 0.2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(seat === 1 ? 'A' : 'B', x, y + 1);
  }
}

const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.5], [0.72, 0.5], [0.28, 0.72], [0.72, 0.72]],
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  canvas.style.width = `${WORLD.WIDTH}px`;
  canvas.style.height = `${WORLD.HEIGHT}px`;
  ctx.scale(dpr, dpr);

  const tokenPos = {};
  let cache = null;
  let cacheLevel = -1;

  function drawStaticBoard(lvl) {
    const c = document.createElement('canvas');
    c.width = WORLD.WIDTH * dpr;
    c.height = WORLD.HEIGHT * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);

    const grad = g.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    grad.addColorStop(0, COLORS.bg0);
    grad.addColorStop(1, COLORS.bg1);
    g.fillStyle = grad;
    g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    g.fillStyle = '#0e0724';
    roundRect(g, BOARD_X - 10, BOARD_Y - 10, BOARD_W + 20, BOARD_H + 20, 14);
    g.fill();

    for (let cell = 0; cell <= MAX; cell += 1) {
      const { r, col } = cellToRC(cell);
      const x = BOARD_X + col * CELL;
      const y = BOARD_Y + (ROWS - 1 - r) * CELL;
      g.fillStyle = (r + col) % 2 === 0 ? COLORS.cellA : COLORS.cellB;
      roundRect(g, x + 2, y + 2, CELL - 4, CELL - 4, 8);
      g.fill();
      g.strokeStyle = COLORS.grid;
      g.lineWidth = 1;
      roundRect(g, x + 2, y + 2, CELL - 4, CELL - 4, 8);
      g.stroke();
      g.fillStyle = COLORS.num;
      g.font = 'bold 11px monospace';
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillText(String(cell), x + 6, y + 5);
    }

    g.fillStyle = COLORS.start;
    g.font = 'bold 12px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const st = cellCenter(0);
    g.fillText('START', st.x, st.y - CELL * 0.34);

    const ev = lvl.events;
    for (const k of Object.keys(ev)) {
      const cell = Number(k);
      const e = ev[k];
      if (e.type === 'ladder' && e.to > cell) drawLadder(g, cell, e.to);
    }
    for (const k of Object.keys(ev)) {
      const cell = Number(k);
      const e = ev[k];
      if (e.type === 'snake' && e.to < cell) drawSnake(g, cell, e.to);
    }
    for (const k of Object.keys(ev)) {
      const cell = Number(k);
      const e = ev[k];
      if (e.type === 'rock') drawRock(g, cell);
      else if (e.type === 'tree') drawTree(g, cell);
    }
    return c;
  }

  function drawSidePanel(sim, labels) {
    if (!sim || !labels) return;
    // 骰子
    const dx = 760;
    const dy = 104;
    const dw = 250;
    ctx.fillStyle = '#120a28';
    ctx.strokeStyle = '#5b4a9e';
    ctx.lineWidth = 3;
    roundRect(ctx, dx, dy, dw, dw, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const v = sim.state.dice;
    if (!v || v < 1 || v > 6) {
      ctx.font = 'bold 90px monospace';
      ctx.fillText('?', dx + dw / 2, dy + dw / 2 + 4);
    } else {
      const r = 26;
      for (const [px, py] of PIPS[v]) {
        ctx.beginPath();
        ctx.arc(dx + dw * px, dy + dw * py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#7f6fc0';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(labels.dice, dx, dy + dw + 12);

    // 排名列表
    const listX = 720;
    let listY = 400;
    const rowH = 76;
    const p = sim.state.players;
    const activeSeat = sim.state.phase === 'playing' ? sim.state.turn : -1;
    for (const pl of p) {
      const active = pl.seat === activeSeat;
      ctx.fillStyle = active ? 'rgba(255, 210, 63, 0.14)' : 'rgba(255, 255, 255, 0.04)';
      roundRect(ctx, listX, listY, 536, rowH - 10, 12);
      ctx.fill();
      if (active) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; roundRect(ctx, listX, listY, 536, rowH - 10, 12); ctx.stroke(); }
      const color = pl.kind === 'human' ? COLORS.human : COLORS.ai[pl.seat % COLORS.ai.length];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(listX + 26, listY + 30, 12, 0, Math.PI * 2);
      ctx.fill();
      const name = pl.kind === 'human' ? labels.you : (pl.seat === 1 ? labels.rival1 : labels.rival2);
      ctx.fillStyle = '#e6dcff';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, listX + 48, listY + 30);
      ctx.textAlign = 'right';
      ctx.fillStyle = pl.finished ? '#5effa8' : '#ffd23f';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(pl.finished ? labels.finished : `${pl.pos}/47`, listX + 470, listY + 30);
      if (pl.gems > 0) {
        ctx.fillStyle = '#38e6ff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`◆ ${pl.gems}`, listX + 518, listY + 30);
      }
      listY += rowH;
    }
  }

  return {
    render(sim, dt = 1 / 60, labels = null) {
      const lvl = sim ? sim.level : LEVELS[0];
      if (!cache || cacheLevel !== lvl.index) {
        cache = drawStaticBoard(lvl);
        cacheLevel = lvl.index;
      }
      ctx.drawImage(cache, 0, 0, WORLD.WIDTH, WORLD.HEIGHT);

      // 动态装饰：终点 + 宝石
      if (sim) {
        const time = sim.state.time;
        drawDest(ctx, MAX, time);
        for (const k of Object.keys(lvl.events)) {
          const cell = Number(k);
          if (lvl.events[k].type === 'gem') drawGem(ctx, cell, time);
        }
        // 棋子（lerp 平滑）
        const activeSeat = sim.state.phase === 'playing' ? sim.state.turn : -1;
        for (const p of sim.state.players) {
          const target = cellCenter(p.pos);
          if (!tokenPos[p.seat]) tokenPos[p.seat] = { x: target.x, y: target.y };
          const tp = tokenPos[p.seat];
          const k = Math.min(1, dt * 20);
          tp.x += (target.x - tp.x) * k;
          tp.y += (target.y - tp.y) * k;
          drawToken(ctx, p.seat, p.kind, tp.x, tp.y, time, p.seat === activeSeat);
        }
        drawSidePanel(sim, labels);
      }
    },
    resetTokens() { for (const k of Object.keys(tokenPos)) delete tokenPos[k]; },
    resetCache() { cache = null; cacheLevel = -1; },
  };
}
