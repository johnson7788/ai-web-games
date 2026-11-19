// SPIN PINGPONG · Canvas 程序化渲染（霓虹街机，零素材）
// 棋盘 + 棱镜 + 光子 + 出口门，全部 canvas 手绘；DPR ≤2；reduced-motion 关闭大幅动效。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { DIR, createRun } from '../game/sim.js';

const C = {
  bgTop: '#08080f',
  bgBottom: '#101024',
  gridLine: 'rgba(120,130,255,0.10)',
  boardFrame: '#2a2a4a',
  boardFrameGlow: 'rgba(99,102,241,0.35)',
  empty: 'rgba(255,255,255,0.03)',
  void: '#12060f',
  voidRing: '#a855f7',
  mirrorA: '#22d3ee',   // "/" 青
  mirrorB: '#f472b6',   // "\" 品红
  start: '#4ade80',     // 起点箭头绿
  gate: '#fbbf24',      // 出口门琥珀
  gateGlow: 'rgba(251,191,36,0.5)',
  ball: '#f8fafc',
  ballGlow: 'rgba(34,211,238,0.8)',
  path: 'rgba(34,211,238,0.45)',
  text: '#e5e7eb',
};

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

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  let demoState = null;

  function resize() {
    dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
    canvas.width = WORLD.WIDTH * dpr;
    canvas.height = WORLD.HEIGHT * dpr;
    canvas.style.width = `${WORLD.WIDTH}px`;
    canvas.style.height = `${WORLD.HEIGHT}px`;
  }
  resize();

  function layout(state) {
    const size = state ? state.size : 4;
    const availW = WORLD.WIDTH - LAYOUT.MARGIN_X * 2;
    const availH = WORLD.HEIGHT - LAYOUT.HUD_H - LAYOUT.MARGIN_Y * 2;
    const boardSize = Math.max(120, Math.min(availW, availH, LAYOUT.BOARD_MAX));
    const cell = boardSize / size;
    const board = {
      x: (WORLD.WIDTH - boardSize) / 2,
      y: LAYOUT.HUD_H + (WORLD.HEIGHT - LAYOUT.HUD_H - boardSize) / 2,
      w: boardSize,
      h: boardSize,
    };
    return { board, cell, size };
  }

  function cellRect(board, cell, x, y) {
    return { x: board.x + x * cell, y: board.y + y * cell, w: cell, h: cell };
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, C.bgTop);
    g.addColorStop(1, C.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 扫描线
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    for (let y = 0; y < WORLD.HEIGHT; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(WORLD.WIDTH, y + 0.5);
      ctx.stroke();
    }
  }

  function drawMirror(rect, mirror) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const r = rect.w * 0.34;
    const color = mirror === 1 ? C.mirrorA : C.mirrorB;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, rect.w * 0.09);
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    if (mirror === 1) {
      ctx.moveTo(cx - r, cy + r);
      ctx.lineTo(cx + r, cy - r);
    } else {
      ctx.moveTo(cx - r, cy - r);
      ctx.lineTo(cx + r, cy + r);
    }
    ctx.stroke();
    // 两端小圆点
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx - r, cy + (mirror === 1 ? r : -r), 3, 0, Math.PI * 2);
    ctx.arc(cx + r, cy + (mirror === 1 ? -r : r), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawVoid(rect) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const r = rect.w * 0.3;
    ctx.save();
    ctx.fillStyle = C.void;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.voidRing;
    ctx.lineWidth = 2;
    ctx.shadowColor = C.voidRing;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  function arrowAngle(dir) {
    if (dir === DIR.RIGHT) return 0;
    if (dir === DIR.BOTTOM) return Math.PI / 2;
    if (dir === DIR.LEFT) return Math.PI;
    return -Math.PI / 2;
  }

  function drawArrow(rect, dir) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(arrowAngle(dir));
    ctx.fillStyle = C.start;
    ctx.shadowColor = C.start;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(rect.w * 0.32, 0);
    ctx.lineTo(-rect.w * 0.16, -rect.w * 0.24);
    ctx.lineTo(-rect.w * 0.16, rect.w * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBoard(state, view, dt, lay) {
    const { board, cell, size } = lay;
    // 外框
    ctx.save();
    ctx.strokeStyle = C.boardFrame;
    ctx.lineWidth = 3;
    ctx.shadowColor = C.boardFrameGlow;
    ctx.shadowBlur = 18;
    roundedRect(ctx, board.x - 4, board.y - 4, board.w + 8, board.h + 8, 10);
    ctx.stroke();
    ctx.restore();

    const showMirrors = state.mirrorsVisible || state.phase === 'resolving' || state.phase === 'won' || state.phase === 'lost';

    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        const c = state.grid[x][y];
        const r = cellRect(board, cell, x, y);
        if (c.kind === 'corner') continue;
        if (c.kind === 'gate') {
          const isStart = c.start === true;
          const isEnd = c.end === true;
          const isCorrect = state.phase === 'lost' && isEnd;
          const hover = view.hoverCell && view.hoverCell.x === x && view.hoverCell.y === y;
          // 门底（predict 阶段高亮填充，便于一眼识别可点出口）
          ctx.fillStyle = isCorrect ? 'rgba(248,113,113,0.6)' : (isStart ? 'rgba(74,222,128,0.18)' : (state.phase === 'predict' ? 'rgba(251,191,36,0.28)' : 'rgba(251,191,36,0.12)'));
          roundedRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 6);
          ctx.fill();
          if (state.phase === 'predict') {
            const pulse = view.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(performance.now() / 240 + x * 0.7 + y * 0.9);
            ctx.strokeStyle = `rgba(251,191,36,${(0.55 + pulse * 0.4).toFixed(3)})`;
            ctx.lineWidth = hover ? 3.5 : 2.5;
            ctx.shadowColor = C.gateGlow;
            ctx.shadowBlur = hover ? 18 : 10;
            roundedRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 6);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          if (isStart) drawArrow(r, state.arrow);
        } else if (c.kind === 'mirror') {
          if (showMirrors) drawMirror(r, c.mirror);
          else {
            ctx.fillStyle = C.empty;
            roundedRect(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 4);
            ctx.fill();
          }
        } else if (c.kind === 'void') {
          drawVoid(r);
        } else {
          ctx.fillStyle = C.empty;
          roundedRect(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 4);
          ctx.fill();
        }
      }
    }

    // 网格线
    ctx.strokeStyle = C.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i += 1) {
      ctx.beginPath();
      ctx.moveTo(board.x + i * cell, board.y);
      ctx.lineTo(board.x + i * cell, board.y + board.h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(board.x, board.y + i * cell);
      ctx.lineTo(board.x + board.w, board.y + i * cell);
      ctx.stroke();
    }

    // 反弹火花
    for (let i = view.sparks.length - 1; i >= 0; i -= 1) {
      const s = view.sparks[i];
      const r = cellRect(board, cell, s.x, s.y);
      const a = Math.max(0, s.ttl);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#7dd3fc';
      ctx.shadowColor = '#7dd3fc';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w * (0.1 + (1 - a) * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      s.ttl -= dt * 2.2;
      if (s.ttl <= 0) view.sparks.splice(i, 1);
    }
  }

  function cellCenter(state, x, y) {
    const lay = layout(state);
    const r = cellRect(lay.board, lay.cell, x, y);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  function drawBall(state, view, dt, lay) {
    if (!state.ball) return;
    const b = state.ball;
    const path = state.path;
    const a = path[b.i];
    const bcell = path[Math.min(b.i + 1, path.length - 1)];
    const ac = cellCenter(state, a.x, a.y);
    const bc = cellCenter(state, bcell.x, bcell.y);
    const t = Math.max(0, Math.min(1, b.t));
    const px = ac.x + (bc.x - ac.x) * t;
    const py = ac.y + (bc.y - ac.y) * t;

    // 路径线（从球当前位置到终点）
    ctx.save();
    ctx.strokeStyle = C.path;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let i = b.i + 1; i < path.length; i += 1) {
      const c = cellCenter(state, path[i].x, path[i].y);
      ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 球体 + 光晕
    const radius = lay.cell * 0.22;
    ctx.save();
    const g = ctx.createRadialGradient(px, py, 0, px, py, radius * 3);
    g.addColorStop(0, 'rgba(248,250,252,0.95)');
    g.addColorStop(0.35, C.ballGlow);
    g.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, radius * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ball;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(state, dt, view) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    if (!state) {
      // 标题屏：渲染一块真实示例盘作为背景（避免纯菜单截图）
      if (!demoState) {
        try { demoState = { ...createRun(2, { seed: 123 }).state, phase: 'memorize', mirrorsVisible: true }; } catch { demoState = null; }
      }
      if (demoState) drawBoard(demoState, view, 0, layout(demoState));
      return;
    }
    const lay = layout(state);
    if (view.shake > 0) {
      ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    }
    drawBoard(state, view, dt, lay);
    if (state.phase === 'resolving' || state.phase === 'won' || state.phase === 'lost') {
      drawBall(state, view, dt, lay);
    }
  }

  function debugLayout(state) {
    if (!state) return null;
    const lay = layout(state);
    return { board: lay.board, cell: lay.cell, size: lay.size };
  }

  return { draw, debugLayout, layout };
}
