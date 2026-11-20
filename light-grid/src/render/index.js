// src/render/index.js — 电路点灯 Canvas 渲染：棋盘 / 节点 / 格型符号 / 走线 / 签名走线动画。
// 程序化发光风格，三套场景色板由 src/render/theme.js 提供；不引任何外部素材。
import { WORLD } from '../../config/gameplay.js';
import { LEVELS } from '../../config/levels.js';
import { themeFor } from './theme.js';

const TOP = 78;      // HUD 预留
const BOTTOM = 42;   // 底部预留
const SIDE = 24;     // 左右预留

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const state = {
    hover: null,       // [r,c] | null
    hint: null,        // [r,c] | null
    signature: null,   // { order, start }
    demo: null,        // 标题屏演示盘面 { board, types, N, chapter }
  };

  function demoBoard() {
    if (!state.demo) {
      const lvl = LEVELS[0];
      state.demo = { board: lvl.board, types: lvl.types, N: lvl.size, chapter: lvl.chapter };
    }
    return state.demo;
  }

  function geometry(N) {
    const availH = WORLD.HEIGHT - TOP - BOTTOM;
    const availW = WORLD.WIDTH - SIDE * 2;
    const cell = Math.max(24, Math.floor(Math.min(availH / N, availW / N)));
    const size = cell * N;
    const x = (WORLD.WIDTH - size) / 2;
    const y = TOP + (availH - size) / 2;
    return { cell, size, x, y };
  }

  function cellCenter(geo, r, c) {
    return {
      x: geo.x + c * geo.cell + geo.cell / 2,
      y: geo.y + r * geo.cell + geo.cell / 2,
    };
  }

  function cellAt(px, py) {
    // 点击命中：优先真实 run 棋盘；标题屏（无 run）回落到 demo 盘
    const src = (typeof window !== 'undefined' && window.G && window.G.run) || state.demo;
    if (!src) return null;
    const N = src.N;
    const geo = geometry(N);
    if (px < geo.x || py < geo.y || px >= geo.x + geo.size || py >= geo.y + geo.size) return null;
    const c = Math.floor((px - geo.x) / geo.cell);
    const r = Math.floor((py - geo.y) / geo.cell);
    if (r < 0 || c < 0 || r >= N || c >= N) return null;
    return [r, c];
  }

  function drawBackground(theme, now) {
    const g = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 60, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 760);
    g.addColorStop(0, theme.bg);
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 主板扫描纹（轻量装饰，随章节色板变化）
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = theme.trace;
    ctx.lineWidth = 1;
    for (let y = 0; y < WORLD.HEIGHT; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y + ((now * 0.01) % 22));
      ctx.lineTo(WORLD.WIDTH, y + ((now * 0.01) % 22));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoardPanel(geo, theme) {
    ctx.save();
    ctx.fillStyle = theme.board;
    roundRect(ctx, geo.x - 14, geo.y - 14, geo.size + 28, geo.size + 28, 16);
    ctx.fill();
    ctx.strokeStyle = theme.boardEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawTrace(geo, theme) {
    ctx.save();
    ctx.strokeStyle = theme.trace;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    for (let r = 0; r < state.demo?.N || 0; r += 1) {
      for (let c = 0; c < (state.demo?.N || 0); c += 1) {
        const p = cellCenter(geo, r, c);
        if (c + 1 < (state.demo?.N || 0)) {
          const q = cellCenter(geo, r, c + 1);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
        if (r + 1 < (state.demo?.N || 0)) {
          const q = cellCenter(geo, r + 1, c);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawGlyph(cx, cy, s, type, lit, theme, now) {
    const inner = s * 0.7;
    ctx.save();
    ctx.translate(cx, cy);

    if (lit) {
      ctx.shadowColor = theme.glow + '0.9)';
      ctx.shadowBlur = 16;
      ctx.fillStyle = theme.on;
      ctx.strokeStyle = theme.accent;
    } else {
      ctx.fillStyle = theme.off;
      ctx.strokeStyle = theme.offEdge;
    }
    ctx.lineWidth = 2;

    if (type === 'relay') {
      ctx.beginPath();
      ctx.arc(0, 0, inner / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 对角交叉
      ctx.strokeStyle = lit ? theme.accent : theme.offEdge;
      ctx.beginPath(); ctx.moveTo(-inner / 2, -inner / 2); ctx.lineTo(inner / 2, inner / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(inner / 2, -inner / 2); ctx.lineTo(-inner / 2, inner / 2); ctx.stroke();
    } else if (type === 'capacitor') {
      roundRect(ctx, -inner / 2, -inner / 2, inner, inner, inner * 0.22);
      ctx.fill();
      ctx.stroke();
      // 双极板
      ctx.strokeStyle = lit ? theme.accent : theme.offEdge;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-inner * 0.14, -inner * 0.3); ctx.lineTo(-inner * 0.14, inner * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(inner * 0.14, -inner * 0.3); ctx.lineTo(inner * 0.14, inner * 0.3); ctx.stroke();
    } else if (type === 'diode') {
      roundRect(ctx, -inner / 2, -inner / 2, inner, inner, inner * 0.22);
      ctx.fill();
      ctx.stroke();
      // 向下的三角形箭头
      ctx.fillStyle = lit ? theme.accent : theme.offEdge;
      ctx.beginPath();
      ctx.moveTo(0, inner * 0.28);
      ctx.lineTo(-inner * 0.22, -inner * 0.18);
      ctx.lineTo(inner * 0.22, -inner * 0.18);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'insulator') {
      roundRect(ctx, -inner / 2, -inner / 2, inner, inner, inner * 0.16);
      ctx.fillStyle = theme.off;
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = lit ? theme.accent : theme.offEdge;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-inner / 2, -inner / 2); ctx.lineTo(inner / 2, inner / 2); ctx.stroke();
    } else {
      // node：圆角方块 + 中心亮核
      roundRect(ctx, -inner / 2, -inner / 2, inner, inner, inner * 0.22);
      ctx.fill();
      ctx.stroke();
      if (lit) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(0, 0, inner * 0.14, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  function drawBoard(run, now, alpha) {
    const src = run || state.demo;
    if (!src) return;
    const theme = themeFor(src.chapter);
    const N = src.N;
    const geo = geometry(N);
    drawBoardPanel(geo, theme);
    drawTrace(geo, theme);

    for (let r = 0; r < N; r += 1) {
      for (let c = 0; c < N; c += 1) {
        const p = cellCenter(geo, r, c);
        const lit = src.board[r][c] === 1;
        drawGlyph(p.x, p.y, geo.cell, src.types[r][c], lit, theme, now);
      }
    }

    // hover 高亮
    if (state.hover) {
      const [r, c] = state.hover;
      const p = cellCenter(geo, r, c);
      ctx.save();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      ctx.shadowColor = theme.glow + '0.8)';
      ctx.shadowBlur = 10;
      roundRect(ctx, p.x - geo.cell * 0.4, p.y - geo.cell * 0.4, geo.cell * 0.8, geo.cell * 0.8, 8);
      ctx.stroke();
      ctx.restore();
    }

    // hint 高亮（提示的格）
    if (state.hint) {
      const [r, c] = state.hint;
      const p = cellCenter(geo, r, c);
      ctx.save();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.globalAlpha = 0.9;
      roundRect(ctx, p.x - geo.cell * 0.44, p.y - geo.cell * 0.44, geo.cell * 0.88, geo.cell * 0.88, 10);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSignature(now) {
    const sig = state.signature;
    if (!sig) return;
    const board = state.demo || { N: 5, chapter: 'motherboard' };
    const theme = themeFor(board.chapter || 'motherboard');
    const N = board.N || 5;
    const geo = geometry(N);
    const t = Math.min(1, (now - sig.start) / 1400);
    if (t >= 1) { state.signature = null; return; }
    const idx = Math.floor(t * sig.order.length);
    const pts = sig.order.slice(0, idx + 1).map(([r, c]) => cellCenter(geo, r, c));
    if (pts.length >= 2) {
      ctx.save();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = theme.glow + '1)';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      // 电流头部
      const head = pts[pts.length - 1];
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(head.x, head.y, geo.cell * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function draw(run, alpha = 1, now = 0) {
    const board = run || state.demo;
    const theme = themeFor(board?.chapter || 'motherboard');
    drawBackground(theme, now);
    drawBoard(run, now, alpha);
    drawSignature(now);
  }

  function flashSolved(order) {
    state.signature = { order, start: performance.now() };
  }

  function serpentineOrder(N) {
    const order = [];
    for (let r = 0; r < N; r += 1) {
      if (r % 2 === 0) for (let c = 0; c < N; c += 1) order.push([r, c]);
      else for (let c = N - 1; c >= 0; c -= 1) order.push([r, c]);
    }
    return order;
  }

  return {
    draw,
    cellAt,
    geometry,
    serpentineOrder,
    setHover(rc) { state.hover = rc; },
    setHint(rc) { state.hint = rc; },
    clearHint() { state.hint = null; },
    flashSolved,
    get demo() { return demoBoard(); },
  };
}
