// SNAKE NEON 2048 · 霓虹街机风 canvas 渲染（程序化，零素材零外链）。
// 职责：背景网格、棋盘/能量墙、蛇、核心（普通/黄金）、慢动作着色、粒子特效。
// 响应式：按实际 canvas 逻辑尺寸排版（移动端不再被 1280×720 固定坐标裁切）。
import { LAYOUT } from '../../config/game.config.js';

const COLORS = {
  bgTop: '#07030f',
  bgBottom: '#0d0630',
  grid: '#1b1140',
  cellA: 'rgba(20,14,50,0.55)',
  cellB: 'rgba(26,17,60,0.55)',
  wall: '#8b5cf6',
  wallGlow: 'rgba(139,92,246,0.6)',
  snakeHead: '#eafff4',
  snakeA: '#00ffa3',
  snakeB: '#00d4ff',
  snakeGlow: 'rgba(0,255,163,0.55)',
  fruit: '#ff4fd8',
  fruitGlow: 'rgba(255,79,216,0.85)',
  golden: '#ffd23b',
  goldenGlow: 'rgba(255,210,59,0.8)',
  slow: 'rgba(59,240,255,0.07)',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let W = 1280;
  let H = 720;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    W = canvas.width / dpr;
    H = canvas.height / dpr;
  }
  resize();
  window.addEventListener('resize', resize);

  const marginX = () => (W < 900 ? 10 : LAYOUT.MARGIN);
  const bottomSpace = () => (H < 500 ? 26 : LAYOUT.BOTTOM_SPACE);

  function boardGeometry(cols, rows) {
    const availW = W - marginX() * 2;
    const availH = H - LAYOUT.HUD_H - marginX() - bottomSpace();
    const cell = Math.max(10, Math.min(LAYOUT.CELL_MAX, Math.floor(availW / cols), Math.floor(availH / rows)));
    const w = cell * cols;
    const h = cell * rows;
    const x = Math.round((W - w) / 2);
    const y = Math.round(LAYOUT.HUD_H + marginX() + (availH - h) / 2);
    return { x, y, w, h, cell };
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(59,240,255,0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const pulse = 0.5 + 0.5 * Math.sin(t * 2);
    ctx.fillStyle = `rgba(120,60,255,${0.03 + 0.02 * pulse})`;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);
  }

  function cellRect(geo, x, y) {
    const pad = Math.max(1, Math.floor(geo.cell * 0.06));
    return {
      x: geo.x + x * geo.cell + pad,
      y: geo.y + y * geo.cell + pad,
      w: geo.cell - pad * 2,
      h: geo.cell - pad * 2,
    };
  }

  function drawGem(cx, cy, rad, color, glow) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - rad);
    ctx.lineTo(cx + rad * 0.82, cy);
    ctx.lineTo(cx, cy + rad);
    ctx.lineTo(cx - rad * 0.82, cy);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawBeacon(cx, cy, rad, t, color) {
    const p = (t % 1.1) / 1.1;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.8 * (1 - p);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad + 3 + p * 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBoard(state, t) {
    const geo = boardGeometry(state.cols, state.rows);
    ctx.fillStyle = 'rgba(5,2,18,0.6)';
    ctx.fillRect(geo.x - 6, geo.y - 6, geo.w + 12, geo.h + 12);

    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) {
        const r = cellRect(geo, x, y);
        const isWall = state.grid[y][x].type === 1;
        if (isWall) {
          ctx.save();
          ctx.shadowColor = COLORS.wallGlow;
          ctx.shadowBlur = 14;
          ctx.fillStyle = COLORS.wall;
          roundRect(ctx, r.x, r.y, r.w, r.h, 4);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.cellA : COLORS.cellB;
          roundRect(ctx, r.x, r.y, r.w, r.h, 3);
          ctx.fill();
        }
      }
    }

    if (state.fruit) {
      const r = cellRect(geo, state.fruit.x, state.fruit.y);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rad = r.w * 0.44 * (1 + 0.08 * Math.sin(t * 6));
      drawGem(cx, cy, rad, COLORS.fruit, COLORS.fruitGlow);
      drawBeacon(cx, cy, rad, t, COLORS.fruit);
    }

    if (state.golden) {
      const r = cellRect(geo, state.golden.x, state.golden.y);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rad = r.w * 0.42 * (1 + 0.1 * Math.sin(t * 8));
      drawGem(cx, cy, rad, COLORS.golden, COLORS.goldenGlow);
      drawBeacon(cx, cy, rad, t, COLORS.golden);
    }
  }

  function drawSnake(state, t) {
    const geo = boardGeometry(state.cols, state.rows);
    const n = state.snake.length;
    const center = (s) => {
      const r = cellRect(geo, s.x, s.y);
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    };

    // 连续蛇身：粗圆角折线（玩家 = 最粗最亮的一整条）
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.snakeA;
    ctx.lineWidth = Math.max(6, geo.cell * 0.6);
    ctx.shadowColor = COLORS.snakeGlow;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const p = center(state.snake[i]);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();

    // 蛇头：更大的亮球 + 眼睛（一眼看出是玩家）
    const head = state.snake[0];
    const hp = center(head);
    const hrad = geo.cell * 0.46;
    ctx.save();
    ctx.shadowColor = COLORS.snakeGlow;
    ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.snakeHead;
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, hrad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 方向「吻部」小三角，标明前进方向（代替眼睛，避免被读成笑脸）
    const ex = state.dir.x;
    const ey = state.dir.y;
    ctx.save();
    ctx.fillStyle = '#05020f';
    const tip = { x: hp.x + ex * hrad * 1.15, y: hp.y + ey * hrad * 1.15 };
    const base = { x: hp.x + ex * hrad * 0.35, y: hp.y + ey * hrad * 0.35 };
    const perp = { x: -ey, y: ex };
    const s = hrad * 0.55;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(base.x + perp.x * s, base.y + perp.y * s);
    ctx.lineTo(base.x - perp.x * s, base.y - perp.y * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGuide(state) {
    const target = state.golden || state.fruit;
    if (!target || !state.snake.length) return;
    const geo = boardGeometry(state.cols, state.rows);
    const a = state.snake[0];
    const b = target;
    const ca = cellRect(geo, a.x, a.y);
    const cb = cellRect(geo, b.x, b.y);
    const ax = ca.x + ca.w / 2;
    const ay = ca.y + ca.h / 2;
    const bx = cb.x + cb.w / 2;
    const by = cb.y + cb.h / 2;
    ctx.save();
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  }

  function drawFx(view) {
    if (!view.fx) return;
    for (const fx of view.fx) {
      if (fx.ttl <= 0) continue;
      const geo = boardGeometry(fx.cols || 12, fx.rows || 13);
      const r = cellRect(geo, fx.x, fx.y);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const a = Math.max(0, Math.min(1, fx.ttl / fx.maxTtl));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = fx.color || COLORS.fruitGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, r.w * (1.2 - a), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function draw(state, dt, view) {
    const t = performance.now() / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (view.shake > 0) {
      ctx.translate((Math.random() - 0.5) * view.shake * 2, (Math.random() - 0.5) * view.shake * 2);
    }

    drawBackground(t);

    if (state && (state.phase === 'running' || state.phase === 'idle' || state.phase === 'won' || state.phase === 'dead')) {
      drawBoard(state, t);
      drawSnake(state, t);
      drawGuide(state);
      drawFx(view);
      if (state.slowUntil > state.time && state.phase === 'running') {
        ctx.fillStyle = COLORS.slow;
        const geo = boardGeometry(state.cols, state.rows);
        ctx.fillRect(geo.x, geo.y, geo.w, geo.h);
      }
    }
  }

  function debugLayout() {
    const geo = boardGeometry(12, 13);
    return { grid: { x: geo.x, y: geo.y, w: geo.w, h: geo.h }, cell: geo.cell };
  }

  function layoutFor(state) {
    const geo = boardGeometry(state.cols, state.rows);
    return { grid: { x: geo.x, y: geo.y, w: geo.w, h: geo.h }, cell: geo.cell };
  }

  return { draw, debugLayout, layoutFor };
}
