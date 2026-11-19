// render/index.js — Canvas 2D 霓虹轨道渲染（程序化，零素材）。
import { WORLD, PALETTE } from '../../config/game.config.js';
import { DX, DY, opposite } from '../game/track.js';

function shapeOf(cell) {
  if (!cell) return null;
  if (cell.type === 'straight' || cell.type === 'curve') return { kind: cell.type, rot: cell.rot };
  if (cell.type === 'switch') return cell.states[cell.stateIndex] || null;
  return null;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let layout = null;
  let shakePx = 0;

  function computeLayout(state) {
    if (!state) return null;
    const cols = state.cols;
    const rows = state.rows;
    const boardW = WORLD.WIDTH - 140;
    const boardH = WORLD.BOARD_BOTTOM - WORLD.BOARD_TOP;
    const cell = Math.max(20, Math.min(boardW / cols, boardH / rows, 66));
    const w = cols * cell;
    const h = rows * cell;
    const x0 = (WORLD.WIDTH - w) / 2;
    const y0 = WORLD.BOARD_TOP + (boardH - h) / 2;
    return { cell, x0, y0, w, h };
  }

  function px(cx, cy) {
    return {
      x: layout.x0 + cx * layout.cell + layout.cell / 2,
      y: layout.y0 + cy * layout.cell + layout.cell / 2,
    };
  }

  function glow(color, alpha = 1) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * alpha;
  }
  function noGlow() {
    ctx.shadowBlur = 0;
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

  function drawTrack(x, y, shape, color) {
    const c = layout.cell;
    const thick = c * 0.34;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = thick;
    glow(PALETTE.railGlow, 0.8);
    const half = c * 0.30;
    if (shape.kind === 'straight') {
      const h = shape.rot === 0;
      ctx.beginPath();
      if (h) { ctx.moveTo(x - half, y); ctx.lineTo(x + half, y); }
      else { ctx.moveTo(x, y - half); ctx.lineTo(x, y + half); }
      ctx.stroke();
    } else if (shape.kind === 'curve') {
      // 从方向 rot 连到 (rot+1)%4 的弧线
      const a = shape.rot % 4;
      const b = (shape.rot + 1) % 4;
      const p1 = { x: x + DX[a] * half, y: y + DY[a] * half };
      const p2 = { x: x + DX[b] * half, y: y + DY[b] * half };
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(x, y, p2.x, p2.y);
      ctx.stroke();
    }
    noGlow();
  }

  function drawSwitch(x, y, cell, now) {
    const c = layout.cell;
    const pulse = 0.5 + 0.5 * Math.sin(now / 220);
    // 道岔本体（用当前形状画灰亮轨，再加黄色边框提示可交互）
    const shape = shapeOf(cell);
    drawTrack(x, y, shape, '#9aa0c8');
    ctx.save();
    ctx.strokeStyle = PALETTE.switchBadge;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.globalAlpha = 0.55 + 0.4 * pulse;
    roundRect(x - c * 0.38, y - c * 0.38, c * 0.76, c * 0.76, 6);
    ctx.stroke();
    ctx.restore();
    // 中心黄点（白描边提高辨识度）
    glow(PALETTE.switchBadge, 1);
    ctx.fillStyle = PALETTE.switchBadge;
    ctx.beginPath();
    ctx.arc(x, y, c * 0.12 * (0.8 + 0.4 * pulse), 0, Math.PI * 2);
    ctx.fill();
    noGlow();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, c * 0.14, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawRock(x, y) {
    const c = layout.cell;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.3);
    ctx.fillStyle = PALETTE.rockCore;
    glow(PALETTE.rock, 0.6);
    roundRect(-c * 0.32, -c * 0.26, c * 0.64, c * 0.52, 5);
    ctx.fill();
    noGlow();
    ctx.fillStyle = PALETTE.rock;
    roundRect(-c * 0.26, -c * 0.32, c * 0.52, c * 0.46, 4);
    ctx.fill();
    ctx.restore();
  }

  function drawCargo(x, y, color) {
    const c = layout.cell;
    const col = color === 'red' ? PALETTE.red : PALETTE.blue;
    // 白色外环让核心更醒目
    glow(col, 1.4);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, c * 0.24, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, c * 0.24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, c * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTerminal(x, y, color) {
    const c = layout.cell;
    const col = color === 'red' ? PALETTE.red : PALETTE.blue;
    glow(col, 1.5);
    ctx.fillStyle = col;
    ctx.beginPath();
    const s = c * 0.32;
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();
    noGlow();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    // 中心白点提示「送达点」
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, c * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTrain(train, now) {
    const c = layout.cell;
    const col = train.color === 'red' ? PALETTE.red : PALETTE.blue;
    const dim = train.color === 'red' ? PALETTE.redDim : PALETTE.blueDim;
    const hx = train.x + (train.nx - train.x) * train.t;
    const hy = train.y + (train.ny - train.y) * train.t;
    const p = px(hx, hy);
    const dirx = DX[train.dir];
    const diry = DY[train.dir];
    const n = 2; // 车头后挂 2 节车厢
    ctx.save();
    ctx.translate(p.x, p.y);
    // 车厢（沿行进方向向后排列）
    for (let i = n; i >= 1; i -= 1) {
      const segX = -dirx * c * (0.34 + (i - 1) * 0.5);
      const segY = -diry * c * (0.34 + (i - 1) * 0.5);
      glow(col, 0.7);
      ctx.fillStyle = i % 2 === 0 ? dim : col;
      roundRect(segX - c * 0.18, segY - c * 0.18, c * 0.36, c * 0.36, 6);
      ctx.fill();
    }
    noGlow();
    // 车头（最亮）
    glow(col, 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, c * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, c * 0.15, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
    ctx.restore();
  }

  function draw(state, dt, view) {
    layout = computeLayout(state);
    const now = (view && view.now) || performance.now();

    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 背景网格
    ctx.strokeStyle = PALETTE.gridLine;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < WORLD.WIDTH; gx += 48) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, WORLD.HEIGHT); ctx.stroke();
    }
    for (let gy = 0; gy < WORLD.HEIGHT; gy += 48) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(WORLD.WIDTH, gy); ctx.stroke();
    }

    if (!state) return;

    const shx = (view && view.shake) ? (Math.random() - 0.5) * view.shake : 0;
    const shy = (view && view.shake) ? (Math.random() - 0.5) * view.shake : 0;
    ctx.save();
    ctx.translate(shx, shy);

    // 铁轨（先画底，再画开关）
    for (let r = 0; r < state.rows; r += 1) {
      for (let cc = 0; cc < state.cols; cc += 1) {
        const cell = state.grid[r][cc];
        const p = px(cc, r);
        const shape = shapeOf(cell);
        if (cell.type === 'rock') drawRock(p.x, p.y);
        else if (shape && cell.type !== 'switch') drawTrack(p.x, p.y, shape, PALETTE.rail);
      }
    }
    // 开关层
    for (let r = 0; r < state.rows; r += 1) {
      for (let cc = 0; cc < state.cols; cc += 1) {
        const cell = state.grid[r][cc];
        if (cell.type === 'switch') drawSwitch(px(cc, r).x, px(cc, r).y, cell, now);
      }
    }
    // 核心（货物）与终端
    for (const cargo of state.cargos) {
      const p = px(cargo.c, cargo.r);
      drawCargo(p.x, p.y, cargo.color);
    }
    for (const term of state.terminals) {
      const p = px(term.c, term.r);
      drawTerminal(p.x, p.y, term.color);
    }
    // 列车
    for (const train of state.trains) drawTrain(train, now);

    // 霜冻减速覆盖层
    if (state.frost && state.frost.active > 0) {
      ctx.fillStyle = 'rgba(53, 214, 255, 0.10)';
      ctx.fillRect(layout.x0, layout.y0, layout.w, layout.h);
      ctx.strokeStyle = 'rgba(53, 214, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(layout.x0, layout.y0, layout.w, layout.h);
    }

    ctx.restore();
  }

  function debugLayout() {
    if (!layout) return null;
    return {
      grid: { x: layout.x0, y: layout.y0, cell: layout.cell, w: layout.w, h: layout.h },
      cell: layout.cell,
    };
  }

  return { draw, debugLayout, computeLayout };
}
