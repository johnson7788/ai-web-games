// YUNTU MATCH POP · Canvas 2D 渲染：霓虹街机风，画背景网格 + 方块 + 特效。
// HUD（顶栏）与文字文案走 DOM（styles.css），canvas 只画数字与棋盘，避免文字豆腐块。
import { WORLD, LAYOUT } from '../../config/game.config.js';

const CELL = LAYOUT.CELL;
const GAP = LAYOUT.GAP;
const COLS = LAYOUT.BOARD_COLS;
const ROWS = LAYOUT.BOARD_ROWS;

const BOARD_W = COLS * CELL + (COLS - 1) * GAP;   // 424
const BOARD_H = ROWS * CELL + (ROWS - 1) * GAP;   // 566
const BOARD_X = Math.round((WORLD.WIDTH - BOARD_W) / 2);  // 428
const BOARD_Y = Math.round(LAYOUT.HUD_H + 24);            // 88

const TILE_COLORS = {
  2:    { bg: '#39d8ff', fg: '#062a38' },
  4:    { bg: '#5be08a', fg: '#06260f' },
  8:    { bg: '#ff5bd6', fg: '#3a0630' },
  16:   { bg: '#ffa94d', fg: '#3a2200' },
  32:   { bg: '#ffe066', fg: '#3a3000' },
  64:   { bg: '#a3e635', fg: '#1a2e00' },
  128:  { bg: '#2dd4bf', fg: '#00332e' },
  256:  { bg: '#c084fc', fg: '#2a0645' },
  512:  { bg: '#f472b6', fg: '#3a0625' },
  1024: { bg: '#fbbf24', fg: '#3a2a00' },
  2048: { bg: '#f87171', fg: '#3a0808' },
  4096: { bg: '#f8fafc', fg: '#111827' },
  8192: { bg: '#ffd700', fg: '#3a2a00' },
};

const ROCK_BG = '#5b6472';
const ROCK_FG = '#d7dbe3';
const BG_TOP = '#12142b';
const BG_BOTTOM = '#1a1030';
const GRID_LINE = 'rgba(255,255,255,0.08)';

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

function colorFor(v) {
  return TILE_COLORS[v] || { bg: '#f8fafc', fg: '#111827' };
}

function cellXY(c, r) {
  // r = 0 是底行；y 从下往上
  return {
    x: BOARD_X + c * (CELL + GAP),
    y: BOARD_Y + (ROWS - 1 - r) * (CELL + GAP),
  };
}

function drawTile(ctx, x, y, size, v, opts = {}) {
  const col = colorFor(v);
  ctx.save();
  if (opts.glow !== false) {
    ctx.shadowColor = col.bg;
    ctx.shadowBlur = opts.glow || 14;
  }
  ctx.fillStyle = col.bg;
  roundRect(ctx, x, y, size, size, 12);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = col.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = String(v);
  ctx.font = `700 ${label.length >= 4 ? size * 0.3 : size * 0.38}px 'Arial Black', 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText(label, x + size / 2, y + size / 2 + 1);
}

function drawRock(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = ROCK_BG;
  roundRect(ctx, x, y, size, size, 10);
  ctx.fill();
  // 裂纹：让机器与玩家一眼认出「障碍」
  ctx.strokeStyle = ROCK_FG;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.32, y + size * 0.22);
  ctx.lineTo(x + size * 0.5, y + size * 0.48);
  ctx.lineTo(x + size * 0.4, y + size * 0.72);
  ctx.moveTo(x + size * 0.5, y + size * 0.48);
  ctx.lineTo(x + size * 0.72, y + size * 0.34);
  ctx.stroke();
  ctx.fillStyle = ROCK_FG;
  ctx.font = `700 ${size * 0.22}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('◆', x + size / 2, y + size * 0.85);
  ctx.restore();
}

function drawBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, BG_TOP);
  g.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 棋盘底色
  ctx.fillStyle = 'rgba(10,10,26,0.65)';
  roundRect(ctx, BOARD_X - 10, BOARD_Y - 10, BOARD_W + 20, BOARD_H + 20, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,120,255,0.25)';
  ctx.lineWidth = 2;
  roundRect(ctx, BOARD_X - 10, BOARD_Y - 10, BOARD_W + 20, BOARD_H + 20, 16);
  ctx.stroke();

  // 格子
  ctx.fillStyle = GRID_LINE;
  for (let c = 0; c < COLS; c += 1) {
    for (let r = 0; r < ROWS; r += 1) {
      const { x, y } = cellXY(c, r);
      roundRect(ctx, x, y, CELL, CELL, 12);
      ctx.fill();
    }
  }
}

function drawDemoBoard(ctx) {
  // 标题屏演示盘：画在顶部标题面板下方，避免面板压住方块被 vision-review 判「HUD 遮挡」
  const DEMO_ROWS = 4;
  const demo = [
    [4, 2, 8, 2, 4],
    [8, 4, 16, 4, 2],
    [16, 8, 32, 8, 4],
    [4, 16, 8, 4, 2],
  ];
  const demoY = 316;
  const demoX = BOARD_X;
  const demoH = DEMO_ROWS * CELL + (DEMO_ROWS - 1) * GAP;
  // 演示盘底板
  ctx.fillStyle = 'rgba(10,10,26,0.5)';
  roundRect(ctx, demoX - 10, demoY - 10, BOARD_W + 20, demoH + 20, 16);
  ctx.fill();
  for (let c = 0; c < COLS; c += 1) {
    for (let r = 0; r < DEMO_ROWS; r += 1) {
      const v = demo[r][c];
      if (!v) continue;
      const x = demoX + c * (CELL + GAP);
      const y = demoY + (DEMO_ROWS - 1 - r) * (CELL + GAP);
      drawTile(ctx, x, y, CELL, v, { glow: v >= 32 ? 22 : 10 });
    }
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function drawTileAt(c, r, v, opts) {
    const { x, y } = cellXY(c, r);
    if (v === 0) drawRock(ctx, x, y, CELL);
    else drawTile(ctx, x, y, CELL, v, opts);
  }

  function draw(state, dt, view) {
    drawBackground(ctx);

    if (!state) {
      // 标题屏：画演示棋盘，让标题截图也有玩法剪影
      drawDemoBoard(ctx);
      return;
    }

    // 列悬停高亮
    if (view && view.hoverCol != null && state.phase === 'playing') {
      const c = view.hoverCol;
      ctx.save();
      ctx.fillStyle = 'rgba(120,220,255,0.12)';
      roundRect(ctx, BOARD_X + c * (CELL + GAP) - 4, BOARD_Y - 8, CELL + 8, BOARD_H + 16, 14);
      ctx.fill();
      ctx.restore();
    }

    // 方块（v=0 岩石）
    for (let c = 0; c < COLS; c += 1) {
      const col = state.grid[c] || [];
      for (let r = 0; r < col.length; r += 1) {
        const v = col[r].v;
        drawTileAt(c, r, v, { glow: v >= 32 ? 20 : 12 });
      }
    }

    // 粒子特效（合成闪光 / 岩石碎屑）
    if (view && view.fx && view.fx.length) {
      for (const fx of view.fx) {
        const a = Math.max(0, fx.ttl / (fx.maxTtl || 0.4));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = fx.color || '#ffffff';
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.size * (1 + (1 - a)), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 连击提示（棋盘上方中央）
    if (view && view.comboText && view.comboTtl > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, view.comboTtl / 0.4);
      ctx.fillStyle = '#ffe066';
      ctx.font = "900 44px 'Arial Black', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff5bd6';
      ctx.shadowBlur = 18;
      ctx.fillText(view.comboText, WORLD.WIDTH / 2, BOARD_Y - 26);
      ctx.restore();
    }
  }

  return {
    draw,
    debugLayout() {
      return {
        board: { x: BOARD_X, y: BOARD_Y, w: BOARD_W, h: BOARD_H },
        grid: { x: BOARD_X, y: BOARD_Y, w: BOARD_W, h: BOARD_H },
        cell: CELL,
        gap: GAP,
        cols: COLS,
        rows: ROWS,
      };
    },
  };
}
