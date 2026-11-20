// src/render/index.js — CELL WARS · Canvas 渲染（培养皿显微镜视角）。
// 纯 Canvas 2D：皿底 / 网格菌落 / 营养滴 / 光丝蔓延特效 / hover / 标题吸引盘。
// 玩家恒蓝、敌方恒红；场景包换皿底/琼脂/中立格/装饰（theme.js）。
import { WORLD } from '../../config/game.config.js';
import { OWNER, FX } from '../../config/gameplay.js';
import { themeAt } from './theme.js';
import { buildBoard, resolveInfect, listFrontier, countAdjacentOwned } from '../game/board.js';
import { mulberry32, randInt } from '../game/rng.js';

const TOP_PX = 96;
const BOTTOM_PX = 40;
const SIDE_PX = 64;

export function getLayout(size) {
  const avail = Math.min(WORLD.WIDTH - SIDE_PX * 2, WORLD.HEIGHT - TOP_PX - BOTTOM_PX);
  const cellPx = Math.floor(avail / size);
  const boardPx = cellPx * size;
  const originX = Math.round((WORLD.WIDTH - boardPx) / 2);
  const originY = Math.round(TOP_PX + (avail - boardPx) / 2);
  return { cellPx, boardPx, originX, originY };
}

export function cellAt(size, x, y) {
  const { cellPx, originX, originY } = getLayout(size);
  const c = Math.floor((x - originX) / cellPx);
  const r = Math.floor((y - originY) / cellPx);
  if (r < 0 || r >= size || c < 0 || c >= size) return null;
  return { r, c };
}

function cellCenter(layout, r, c) {
  return {
    x: layout.originX + c * layout.cellPx + layout.cellPx / 2,
    y: layout.originY + r * layout.cellPx + layout.cellPx / 2,
  };
}

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

// 静态「吸引盘」：标题屏背后画一个中局棋盘（固定种子，无 DOM/无 sim 依赖）
function buildAttractBoard() {
  const size = 8;
  const rng = mulberry32(20261119);
  const board = buildBoard({ size, fortressCount: 3, fortressDef: 2, enemyStartDef: 1, holes: [], scatter: 0 }, rng);
  for (let i = 0; i < 9; i += 1) {
    const side = i % 2 === 0 ? OWNER.PLAYER : OWNER.ENEMY;
    const frontier = listFrontier(board, size, side);
    let best = null;
    for (const [r, c] of frontier) {
      const adj = countAdjacentOwned(board, size, r, c, side);
      if (!best || adj > best.adj) best = { r, c, adj };
    }
    if (best) resolveInfect(board, size, best.r, best.c, side, 0);
  }
  return { board, size };
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const attract = buildAttractBoard();

  function drawBackground(theme) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, theme.bgTop);
    g.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 装饰漂浮粒子（显微镜浮游物）
    ctx.save();
    for (let i = 0; i < 26; i += 1) {
      const x = (i * 173.3) % WORLD.WIDTH;
      const y = (i * 97.7) % WORLD.HEIGHT;
      const rad = 1 + (i % 3);
      ctx.fillStyle = theme.deco;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDish(theme, layout) {
    const pad = 20;
    const x = layout.originX - pad;
    const y = layout.originY - pad;
    const w = layout.boardPx + pad * 2;
    const h = layout.boardPx + pad * 2;
    const r = 34;
    ctx.save();
    ctx.shadowColor = theme.rimGlow;
    ctx.shadowBlur = 30;
    ctx.fillStyle = theme.rim;
    roundedRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();

    const inner = 8;
    const g = ctx.createRadialGradient(WORLD.WIDTH / 2, layout.originY + layout.boardPx / 2, 40, WORLD.WIDTH / 2, layout.originY + layout.boardPx / 2, layout.boardPx);
    g.addColorStop(0, theme.agarInner);
    g.addColorStop(1, theme.agar);
    ctx.fillStyle = g;
    roundedRect(ctx, x + inner, y + inner, w - inner * 2, h - inner * 2, r - 8);
    ctx.fill();
  }

  function drawCell(theme, layout, r, c, o, d, pulse) {
    const { x, y } = cellCenter(layout, r, c);
    const size = layout.cellPx;
    const inset = Math.max(3, Math.floor(size * 0.14));
    const w = size - inset * 2;
    const h = size - inset * 2;
    const cx = x - w / 2;
    const cy = y - h / 2;
    const grow = pulse ? 1 + Math.sin(pulse) * 0.04 : 1;
    const gw = w * grow;
    const gh = h * grow;

    let fill;
    let edge;
    if (o === OWNER.PLAYER) { fill = theme.player; edge = theme.playerGlow; }
    else if (o === OWNER.ENEMY) { fill = theme.enemy; edge = theme.enemyGlow; }
    else if (o === OWNER.NEUTRAL) { fill = theme.neutral; edge = theme.neutralEdge; }
    else return; // VOID 不画

    ctx.save();
    if (o === OWNER.PLAYER || o === OWNER.ENEMY) {
      ctx.shadowColor = edge;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = fill;
    roundedRect(ctx, x - gw / 2, y - gh / 2, gw, gh, Math.min(10, gw / 2));
    ctx.fill();
    ctx.restore();

    // 防御等级：缺口环（形状冗余，不只靠颜色）
    if (d > 0 && (o === OWNER.ENEMY || o === OWNER.NEUTRAL)) {
      ctx.strokeStyle = o === OWNER.ENEMY ? 'rgba(255,255,255,0.85)' : 'rgba(20,40,50,0.7)';
      ctx.lineWidth = Math.max(2, Math.floor(size * 0.06));
      ctx.beginPath();
      for (let i = 0; i < d; i += 1) {
        ctx.arc(x, y, w * 0.38, (i / Math.max(1, d)) * Math.PI * 2, ((i + 0.75) / Math.max(1, d)) * Math.PI * 2);
      }
      ctx.stroke();
    }
  }

  function drawGrid(theme, layout, size) {
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i += 1) {
      const px = layout.originX + i * layout.cellPx;
      ctx.beginPath();
      ctx.moveTo(px, layout.originY);
      ctx.lineTo(px, layout.originY + layout.boardPx);
      ctx.stroke();
      const py = layout.originY + i * layout.cellPx;
      ctx.beginPath();
      ctx.moveTo(layout.originX, py);
      ctx.lineTo(layout.originX + layout.boardPx, py);
      ctx.stroke();
    }
  }

  function drawAura(theme, layout, aura) {
    for (let r = 0; r < aura.length; r += 1) {
      for (let c = 0; c < aura[r].length; c += 1) {
        if (aura[r][c] <= 0) continue;
        const { x, y } = cellCenter(layout, r, c);
        ctx.save();
        ctx.fillStyle = theme.aura;
        ctx.shadowColor = theme.aura;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y + layout.cellPx * 0.18, Math.max(3, layout.cellPx * 0.09), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawFx(theme, layout, fx, time) {
    for (const f of fx) {
      const age = time - f.born;
      if (f.kind === 'spread') {
        const t = Math.min(1, age / FX.SPREAD_SEC);
        const alpha = 1 - t;
        const src = cellCenter(layout, f.r, f.c);
        for (const [cr, cc] of f.cells) {
          const dst = cellCenter(layout, cr, cc);
          ctx.save();
          ctx.strokeStyle = theme.playerGlow;
          ctx.globalAlpha = alpha * 0.8;
          ctx.lineWidth = 2;
          ctx.shadowColor = theme.playerGlow;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(dst.x, dst.y);
          ctx.stroke();
          ctx.restore();
          // 捕获环
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = theme.playerGlow;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(dst.x, dst.y, layout.cellPx * (0.25 + t * 0.25), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      } else if (f.kind === 'wipe') {
        const t = Math.min(1, age / 0.4);
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = theme.aura;
        for (const [cr, cc] of f.cells) {
          const { x, y } = cellCenter(layout, cr, cc);
          ctx.fillRect(x - layout.cellPx / 2, y - layout.cellPx / 2, layout.cellPx, layout.cellPx);
        }
        ctx.restore();
      }
    }
  }

  function drawBoard(state, layout, theme, pulse) {
    for (let r = 0; r < state.size; r += 1) {
      for (let c = 0; c < state.size; c += 1) {
        const cell = state.board[r][c];
        drawCell(theme, layout, r, c, cell.o, cell.d, pulse);
      }
    }
    drawAura(theme, layout, state.aura || []);
    drawFx(theme, layout, state.fx || [], state.time);
  }

  function drawHover(theme, layout, hover, validTargets) {
    if (hover) {
      const { x, y } = cellCenter(layout, hover.r, hover.c);
      ctx.save();
      ctx.strokeStyle = theme.aura;
      ctx.lineWidth = 3;
      ctx.shadowColor = theme.aura;
      ctx.shadowBlur = 10;
      roundedRect(ctx, x - layout.cellPx / 2 + 2, y - layout.cellPx / 2 + 2, layout.cellPx - 4, layout.cellPx - 4, 10);
      ctx.stroke();
      ctx.restore();
    }
    if (validTargets) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      for (const t of validTargets) {
        const { x, y } = cellCenter(layout, t.r, t.c);
        roundedRect(ctx, x - layout.cellPx / 2 + 5, y - layout.cellPx / 2 + 5, layout.cellPx - 10, layout.cellPx - 10, 8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  return {
    getLayout,
    cellAt: (x, y, size) => cellAt(size, x, y),

    draw(run, opts = {}) {
      const theme = run ? themeAt(run.level.scenePack) : themeAt(0);
      drawBackground(theme);

      if (run) {
        const layout = getLayout(run.size);
        drawDish(theme, layout);
        drawGrid(theme, layout, run.size);
        drawBoard(run, layout, theme, run.time);
        drawHover(theme, layout, opts.hover, opts.validTargets);
      } else {
        // 标题/结算背后的吸引盘
        const layout = getLayout(attract.size);
        drawDish(theme, layout);
        drawGrid(theme, layout, attract.size);
        drawBoard(attract, layout, theme, 0);
      }
    },
  };
}

export default createRender;
