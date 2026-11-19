// TAICHI FLOW · Canvas 2D 渲染：霓虹街机气质，阴阳棋盘 + 目标标记 + 特效。
// 只依赖 config（WORLD/LAYOUT）与 run.state；标题屏（state=null）画装饰性太极盘。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { SIZE } from '../../config/levels.js';

const CELL = LAYOUT.CELL_MAX;
const GAP = 4;
const BOARD = SIZE * CELL + (SIZE - 1) * GAP;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  const bgGrad = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  bgGrad.addColorStop(0, '#0a0d1c');
  bgGrad.addColorStop(0.55, '#131433');
  bgGrad.addColorStop(1, '#1c1240');

  // 网格几何（供 main 命格 / 教程 spotlight / 验收 layout()）
  function layout() {
    const x = Math.round((WORLD.WIDTH - BOARD) / 2);
    const y = Math.round(LAYOUT.HUD_H + (WORLD.HEIGHT - LAYOUT.HUD_H - BOARD) / 2);
    return { grid: { x, y, cell: CELL, gap: GAP, board: BOARD }, cell: CELL };
  }

  function cellRect(i) {
    const { grid } = layout();
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    return {
      x: grid.x + c * (CELL + GAP),
      y: grid.y + r * (CELL + GAP),
      w: CELL,
      h: CELL,
      cx: grid.x + c * (CELL + GAP) + CELL / 2,
      cy: grid.y + r * (CELL + GAP) + CELL / 2,
    };
  }

  function glow(color, blur, alpha) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.globalAlpha = alpha;
  }

  function noGlow() {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function roundedRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawYinYang(cx, cy, r, t) {
    // 装饰性太极圆（标题屏）
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(t * 0.4) * 0.12);
    glow('#5cf0ff', 24, 1);
    ctx.fillStyle = '#0e1220';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    noGlow();

    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0e1220';
    ctx.beginPath();
    ctx.arc(0, -r / 2, r / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath();
    ctx.arc(0, r / 2, r / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0e1220';
    ctx.beginPath();
    ctx.arc(0, r / 2, r / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath();
    ctx.arc(0, -r / 2, r / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBackground(t) {
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 星点
    ctx.fillStyle = 'rgba(120,160,255,0.16)';
    for (let i = 0; i < 40; i += 1) {
      const x = ((i * 137.5 + 53) % WORLD.WIDTH);
      const y = ((i * 211.3 + 97) % WORLD.HEIGHT);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i));
      ctx.globalAlpha = tw * 0.5;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawCell(state, i, t, view) {
    const c = state.cells[i];
    const rect = cellRect(i);
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i * 0.6);
    const isTarget = state.targetMask[i];
    const hover = view && view.hoverCell === i;

    // 锁石（障碍：画 ✕ 叉号，明确「不可点不可动」）
    if (!c.movable) {
      roundedRect(rect.x, rect.y, rect.w, rect.h, 12);
      ctx.fillStyle = '#2a2e42';
      ctx.fill();
      ctx.strokeStyle = c.color === 'yin' ? '#5cf0ff' : '#ffcf6a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#9aa4c8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(rect.x + 16, rect.y + 16);
      ctx.lineTo(rect.x + rect.w - 16, rect.y + rect.h - 16);
      ctx.moveTo(rect.x + rect.w - 16, rect.y + 16);
      ctx.lineTo(rect.x + 16, rect.y + rect.h - 16);
      ctx.stroke();
      return;
    }

    const yin = c.color === 'yin';
    // 格子底
    roundedRect(rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fillStyle = yin ? '#10142a' : '#efe3c2';
    ctx.fill();
    if (c.flash > 0) {
      ctx.fillStyle = yin ? 'rgba(92,240,255,0.35)' : 'rgba(255,207,106,0.35)';
      ctx.fill();
    }
    // 边框
    ctx.lineWidth = hover ? 3 : 2;
    ctx.strokeStyle = yin ? '#49e6ff' : '#ffd27a';
    if (yin) glow('#49e6ff', hover ? 14 : 8, 0.9);
    else glow('#ffcf6a', hover ? 12 : 6, 0.8);
    ctx.stroke();
    noGlow();

    // 目标标记：始终青色的发光圆环 = 目标位置；满足时中心亮绿点。
    if (isTarget) {
      const satisfied = c.color === 'yin';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#5cf0ff';
      glow('#5cf0ff', 12 + pulse * 6, 0.95);
      ctx.beginPath();
      ctx.arc(rect.cx, rect.cy, CELL * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      noGlow();
      ctx.fillStyle = satisfied ? '#7dffb8' : 'rgba(92, 240, 255, 0.9)';
      glow(satisfied ? '#7dffb8' : '#5cf0ff', 8, 0.95);
      ctx.beginPath();
      ctx.arc(rect.cx, rect.cy, satisfied ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      noGlow();
    }
  }

  function drawBoard(state, t, view) {
    const { grid } = layout();
    roundedRect(grid.x - 14, grid.y - 14, BOARD + 28, BOARD + 28, 20);
    ctx.fillStyle = 'rgba(20,24,48,0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    for (let i = 0; i < SIZE * SIZE; i += 1) {
      drawCell(state, i, t, view);
    }
  }

  function drawCombo(state, view) {
    if (state.bestCombo < 2) return;
    const { grid } = layout();
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd27a';
    glow('#ffcf6a', 8, 0.9);
    ctx.fillText('×' + state.bestCombo, grid.x + BOARD - 20, grid.y - 24);
    noGlow();
  }

  return {
    debugLayout: layout,
    cellRect,
    draw(state, dt, view) {
      const t = (view && view.time) || (dt || 0);
      drawBackground(t);
      if (!state) {
        drawYinYang(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 190, t);
        return;
      }
      if (view && view.shake > 0) {
        ctx.save();
        ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
        drawBoard(state, t, view);
        drawCombo(state, view);
        ctx.restore();
      } else {
        drawBoard(state, t, view);
        drawCombo(state, view);
      }
    },
  };
}
