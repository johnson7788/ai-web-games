// KLOTSKI NUMBERS · Canvas 2D 渲染（霓虹街机，纯程序化，零素材零外链）
// 职责：画背景、棋盘、数字块、目标缩略图、提示高亮。几何由 debugLayout() 暴露给输入与教程。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const GOAL_W = 260;  // 目标缩略图面板宽
const GAP = 24;

const COLORS = {
  bgTop: '#0b0618',
  bgBottom: '#1c0b33',
  grid: 'rgba(123,47,247,0.14)',
  frame: '#00e5ff',
  frameGlow: 'rgba(0,229,255,0.55)',
  tileFillA: '#2a1540',
  tileFillB: '#170a26',
  tileHomeFillA: '#12314a',
  tileHomeFillB: '#0a1a2e',
  tileBorder: '#ff2d78',
  tileHomeBorder: '#00e5ff',
  number: '#ffffff',
  blankFill: '#0a0614',
  blankBorder: 'rgba(255,255,255,0.08)',
  hint: '#ffd166',
  goalPanel: 'rgba(10,6,20,0.72)',
  goalCell: 'rgba(0,229,255,0.16)',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(GAME.DPR_CAP, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  let t = 0;

  function roundRectPath(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function layout(n) {
    const availW = WORLD.WIDTH - LAYOUT.MARGIN_X * 2 - GOAL_W - GAP;
    const availH = WORLD.HEIGHT - LAYOUT.HUD_H - LAYOUT.MARGIN_Y * 2;
    const cell = Math.min(LAYOUT.CELL_MAX, LAYOUT.BOARD_MAX_W / n, availH / n);
    const board = n * cell;
    const grid = {
      x: LAYOUT.MARGIN_X + (availW - board) / 2,
      y: LAYOUT.HUD_H + LAYOUT.MARGIN_Y + (availH - board) / 2,
      w: board,
      h: board,
    };
    const goalW = Math.min(GOAL_W, WORLD.WIDTH - LAYOUT.MARGIN_X - (grid.x + board) - GAP);
    const gcell = Math.min(26, goalW / n);
    const goal = {
      x: WORLD.WIDTH - LAYOUT.MARGIN_X - gcell * n,
      y: LAYOUT.HUD_H + LAYOUT.MARGIN_Y,
      w: gcell * n,
      h: gcell * n,
      cell: gcell,
    };
    return { grid, cell, goal };
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 合成波地平线网格
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let y = 0; y < WORLD.HEIGHT; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(y / 120 + t * 0.4) * 6);
      ctx.lineTo(WORLD.WIDTH, y + Math.sin(y / 120 + t * 0.4) * 6);
      ctx.stroke();
    }
    for (let x = 0; x < WORLD.WIDTH; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.HEIGHT);
      ctx.stroke();
    }
  }

  function drawTile(x, y, w, value, home, blank, hintPulse) {
    if (blank) {
      roundRectPath(ctx, x, y, w, w, w * 0.14);
      ctx.fillStyle = COLORS.blankFill;
      ctx.fill();
      ctx.save();
      ctx.shadowColor = 'rgba(0,229,255,0.45)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(0,229,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      // 空格标识点：告诉玩家这是滑动目标
      ctx.fillStyle = 'rgba(0,229,255,0.5)';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + w / 2, Math.max(2, w * 0.06), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const pad = Math.max(2, w * 0.05);
    const xx = x + pad;
    const yy = y + pad;
    const ww = w - pad * 2;
    roundRectPath(ctx, xx, yy, ww, ww, ww * 0.16);

    const fill = ctx.createLinearGradient(xx, yy, xx, yy + ww);
    if (home) {
      fill.addColorStop(0, COLORS.tileHomeFillA);
      fill.addColorStop(1, COLORS.tileHomeFillB);
    } else {
      fill.addColorStop(0, COLORS.tileFillA);
      fill.addColorStop(1, COLORS.tileFillB);
    }
    ctx.fillStyle = fill;
    ctx.fill();

    const border = hintPulse ? COLORS.hint : (home ? COLORS.tileHomeBorder : COLORS.tileBorder);
    ctx.save();
    ctx.shadowColor = hintPulse ? COLORS.hint : (home ? COLORS.frameGlow : 'rgba(255,45,120,0.55)');
    ctx.shadowBlur = home || hintPulse ? 14 : 6;
    ctx.strokeStyle = border;
    ctx.lineWidth = home ? 2 : 1.5;
    ctx.stroke();
    ctx.restore();

    // 数字
    ctx.fillStyle = COLORS.number;
    ctx.font = `700 ${Math.round(w * 0.42)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = home ? COLORS.tileHomeBorder : 'rgba(255,255,255,0.35)';
    ctx.shadowBlur = 8;
    ctx.fillText(String(value), xx + ww / 2, yy + ww / 2 + w * 0.01);
    ctx.shadowBlur = 0;
  }

  function drawGoal(goal, n) {
    const { x, y, w, h, cell } = goal;
    roundRectPath(ctx, x - 12, y - 12, w + 24, h + 24, 14);
    ctx.fillStyle = COLORS.goalPanel;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,229,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 15px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('GOAL', x, y - 12 + 2);
    ctx.textAlign = 'right';
    ctx.fillText('1 → ' + (n * n - 1), x + w, y - 12 + 2);

    for (let i = 0; i < n * n; i += 1) {
      const r = Math.floor(i / n);
      const c = i % n;
      const cx = x + c * cell;
      const cy = y + r * cell;
      const isBlank = i === n * n - 1;
      roundRectPath(ctx, cx + 1, cy + 1, cell - 2, cell - 2, 3);
      ctx.fillStyle = isBlank ? COLORS.blankFill : COLORS.goalCell;
      ctx.fill();
      if (!isBlank) {
        ctx.fillStyle = 'rgba(0,229,255,0.9)';
        ctx.font = `600 ${Math.round(cell * 0.5)}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), cx + cell / 2, cy + cell / 2 + 1);
      }
    }
  }

  return {
    debugLayout(n) {
      return layout(n);
    },

    draw(state, dt, view) {
      t += dt || 0;
      drawBackground();
      const n = state ? state.size : 3;
      const { grid, cell, goal } = layout(n);

      // 棋盘外框
      roundRectPath(ctx, grid.x - 10, grid.y - 10, grid.w + 20, grid.h + 20, 18);
      ctx.fillStyle = 'rgba(6,3,12,0.55)';
      ctx.fill();
      ctx.save();
      ctx.shadowColor = COLORS.frameGlow;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = COLORS.frame;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      const hintIdx = state ? state.hint : null;
      for (let i = 0; i < n * n; i += 1) {
        const r = Math.floor(i / n);
        const c = i % n;
        const v = state ? state.cells[i] : 0;
        const isBlank = v === 0;
        const isHome = !isBlank && i === v - 1;
        const hintPulse = hintIdx === i;
        const pulse = hintPulse ? (0.5 + 0.5 * Math.sin(t * 8)) : 0;
        if (hintPulse) {
          ctx.save();
          ctx.globalAlpha = 0.25 + pulse * 0.3;
          roundRectPath(ctx, grid.x + c * cell, grid.y + r * cell, cell, cell, cell * 0.14);
          ctx.fillStyle = COLORS.hint;
          ctx.fill();
          ctx.restore();
        }
        drawTile(grid.x + c * cell, grid.y + r * cell, cell, v, isHome, isBlank, hintPulse);
      }

      drawGoal(goal, n);
    },
  };
}
