// UNBLOCK CARS · 渲染层（Canvas 程序化，霓虹街机风格，零素材零外链）
// 职责：合成背景、棋盘、车辆（霓虹描边+辉光）、岩石、出口、提示、粒子。
// 全游戏统一气质：霓虹街机（synthwave 深紫/青/粉/黄）。

import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const PALETTE = [
  { body: '#ff3ea5', glow: '#ff3ea5', accent: '#ffd1ec' }, // 粉
  { body: '#ff9e00', glow: '#ff9e00', accent: '#ffe4b3' }, // 橙
  { body: '#3dff8f', glow: '#3dff8f', accent: '#c6ffdf' }, // 绿
  { body: '#b16bff', glow: '#b16bff', accent: '#e4ccff' }, // 紫
  { body: '#ffd23e', glow: '#ffd23e', accent: '#fff2bd' }, // 黄
  { body: '#3ea6ff', glow: '#3ea6ff', accent: '#cfe9ff' }, // 蓝
];
const HERO = { body: '#1ffcff', glow: '#1ffcff', accent: '#e6ffff' };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(WORLD.WIDTH * dpr);
    canvas.height = Math.round(WORLD.HEIGHT * dpr);
    canvas.style.width = `${WORLD.WIDTH}px`;
    canvas.style.height = `${WORLD.HEIGHT}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function layout() {
    const hudH = LAYOUT.HUD_H;
    const boardTop = 66;            // HUD 下方固定上边，留出清晰间距
    const cardReserve = 178;        // 底部留给教程卡，避免遮挡棋盘
    const boardBottomMax = WORLD.HEIGHT - cardReserve;
    const boardSize = Math.min(
      LAYOUT.CELL_MAX * GAME.COLS,
      boardBottomMax - boardTop,
      WORLD.WIDTH - LAYOUT.BOARD_PAD * 2,
    );
    const cell = boardSize / GAME.COLS;
    const x = Math.round((WORLD.WIDTH - boardSize) / 2);
    const y = boardTop;
    return { board: { x, y, w: boardSize, h: boardSize }, cell, hudH };
  }

  function cellRect(l, row, col, len, o) {
    const { board, cell } = l;
    const w = o === 'H' ? len * cell : cell;
    const h = o === 'H' ? cell : len * cell;
    return { x: board.x + col * cell, y: board.y + row * cell, w, h };
  }

  // ---------------- 背景 ----------------

  function drawBackground(dt, reduced) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0b0518');
    g.addColorStop(0.55, '#1a0b33');
    g.addColorStop(0.82, '#3a0d4d');
    g.addColorStop(1, '#0b2a4d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 太阳
    const sunX = WORLD.WIDTH * 0.5;
    const sunY = WORLD.HEIGHT * 0.62;
    const sunR = 150;
    const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sg.addColorStop(0, '#ff9e00');
    sg.addColorStop(0.6, '#ff3ea5');
    sg.addColorStop(1, '#2b0a4d');
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sg;
    ctx.fill();
    // 太阳条纹
    ctx.clip();
    ctx.fillStyle = 'rgba(11,5,24,0.5)';
    for (let i = 0; i < 6; i += 1) {
      const yy = sunY - sunR + (i * 2 * sunR) / 6 + (reduced ? 0 : Math.sin(dt * 0.4 + i) * 4);
      ctx.fillRect(sunX - sunR, yy, sunR * 2, 4 + i * 3);
    }
    ctx.restore();

    // 透视地面网格
    ctx.strokeStyle = 'rgba(31,252,255,0.16)';
    ctx.lineWidth = 1;
    const horizon = WORLD.HEIGHT * 0.62;
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      const y = horizon + t * t * (WORLD.HEIGHT - horizon);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
    const vx = WORLD.WIDTH / 2;
    for (let i = -8; i <= 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(vx + i * 20, horizon);
      ctx.lineTo(vx + i * 220, WORLD.HEIGHT);
      ctx.stroke();
    }

    // 星星
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const t = Math.floor(dt * 4);
    for (let i = 0; i < 46; i += 1) {
      const sx = (i * 977 + 101) % WORLD.WIDTH;
      const sy = (i * 613 + 7) % Math.floor(horizon);
      const tw = reduced ? 0.6 : 0.4 + 0.6 * Math.abs(Math.sin(dt * (0.8 + (i % 5) * 0.3) + i));
      ctx.globalAlpha = tw;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- 棋盘与车辆 ----------------

  function drawBoard(state, dt, view) {
    const l = layout();
    const { board, cell } = l;

    ctx.fillStyle = 'rgba(8,5,20,0.72)';
    ctx.strokeStyle = 'rgba(31,252,255,0.5)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(31,252,255,0.6)';
    ctx.shadowBlur = 16;
    roundRect(board.x - 4, board.y - 4, board.w + 8, board.h + 8, 12);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 网格线
    ctx.strokeStyle = 'rgba(120,120,200,0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GAME.COLS; i += 1) {
      ctx.beginPath();
      ctx.moveTo(board.x + i * cell, board.y);
      ctx.lineTo(board.x + i * cell, board.y + board.h);
      ctx.stroke();
    }
    for (let i = 1; i < GAME.ROWS; i += 1) {
      ctx.beginPath();
      ctx.moveTo(board.x, board.y + i * cell);
      ctx.lineTo(board.x + board.w, board.y + i * cell);
      ctx.stroke();
    }

    // 岩石
    for (const [r, c] of state.rocks) {
      drawRock(l, r, c);
    }

    // 出口
    drawExit(l, state, dt, view.reducedMotion);

    // 车辆（hero 最后画，置顶）
    const sorted = [...state.cars].sort((a, b) => (a.hero ? 1 : 0) - (b.hero ? 1 : 0));
    for (const car of sorted) {
      const dragging = view.drag && view.drag.carId === car.id;
      drawCar(l, car, dragging ? view.drag : null, view);
    }

    // 提示高亮
    if (state.hint && !view.drag) drawHint(l, state, dt);
  }

  function drawRock(l, r, c) {
    const { board, cell } = l;
    const x = board.x + c * cell;
    const y = board.y + r * cell;
    const pad = cell * 0.08;
    ctx.fillStyle = '#221a2e';
    ctx.strokeStyle = '#6d5a8a';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(180,120,255,0.4)';
    ctx.shadowBlur = 8;
    roundRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2, 6);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 斜条纹
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + pad, y + pad, cell - pad * 2, cell - pad * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,210,62,0.35)';
    ctx.lineWidth = 3;
    for (let i = -1; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + pad + i * cell * 0.5, y + cell);
      ctx.lineTo(x + pad + i * cell * 0.5 + cell * 0.4, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawExit(l, state, dt, reduced) {
    const { board, cell } = l;
    const row = state.heroRow;
    const y = board.y + row * cell;
    const x = board.x + board.w;
    const w = LAYOUT.EXIT_W;
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(dt * 4));

    // 主车行绿色走廊：把主车和出口连起来
    ctx.fillStyle = 'rgba(61,255,143,0.10)';
    ctx.fillRect(board.x, y, board.w, cell);

    // 走廊上的右向 chevron（脉冲，向出口流动）
    ctx.fillStyle = `rgba(61,255,143,${0.25 + 0.4 * pulse})`;
    const hero = state.cars.find((c) => c.hero);
    const fromX = board.x + (hero ? (hero.col + hero.len) * cell : 0);
    const cy = y + cell / 2;
    const span = (x - 6) - fromX;
    if (span > 12) {
      const n = Math.max(1, Math.floor(span / (cell * 0.8)));
      for (let i = 0; i < n; i += 1) {
        const cx = fromX + 10 + (i / n) * span + (reduced ? 0 : ((dt * 30 + i * 14) % 18));
        chevron(cx, cy, 8, 1);
      }
    }

    // 出口门体（醒目绿 + 脉动辉光）
    ctx.save();
    ctx.shadowColor = '#3dff8f';
    ctx.shadowBlur = 24;
    ctx.fillStyle = `rgba(61,255,143,${0.8 + 0.2 * pulse})`;
    roundRect(x, y + cell * 0.08, w, cell * 0.84, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b6ffd8';
    ctx.lineWidth = 2;
    roundRect(x, y + cell * 0.08, w, cell * 0.84, 8);
    ctx.stroke();

    // 大箭头
    ctx.fillStyle = '#06281a';
    const ax = x + w / 2;
    ctx.beginPath();
    ctx.moveTo(ax + 10, cy);
    ctx.lineTo(ax - 2, cy - 12);
    ctx.lineTo(ax + 1, cy);
    ctx.lineTo(ax - 2, cy + 12);
    ctx.closePath();
    ctx.fill();

    // EXIT 标签
    ctx.fillStyle = '#b6ffd8';
    ctx.font = `bold ${Math.round(cell * 0.24)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', x + w + 24, cy);
    ctx.restore();
  }

  function chevron(cx, cy, s, dir) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * s * 0.6, cy - s);
    ctx.lineTo(cx + dir * s, cy);
    ctx.lineTo(cx + dir * s * 0.6, cy + s);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawCar(l, car, drag, view) {
    const { board, cell } = l;
    const color = car.hero ? HERO : PALETTE[car.id % PALETTE.length];
    let row = car.row;
    let col = car.col;
    if (drag) {
      // 拖动预览：沿车道偏移
      if (car.o === 'H') col = drag.to;
      else row = drag.to;
    }
    const r = cellRect(l, row, col, car.len, car.o);
    const pad = cell * 0.08;
    const bodyX = r.x + pad;
    const bodyY = r.y + pad;
    const bodyW = r.w - pad * 2;
    const bodyH = r.h - pad * 2;

    ctx.save();
    ctx.shadowColor = color.glow;
    ctx.shadowBlur = car.hero ? 26 : 14;
    ctx.fillStyle = 'rgba(8,5,20,0.9)';
    ctx.strokeStyle = color.body;
    ctx.lineWidth = car.hero ? 3 : 2.4;
    roundRect(bodyX, bodyY, bodyW, bodyH, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 内芯填充
    ctx.fillStyle = car.hero ? 'rgba(31,252,255,0.22)' : 'rgba(255,255,255,0.06)';
    roundRect(bodyX + 3, bodyY + 3, bodyW - 6, bodyH - 6, 5);
    ctx.fill();

    // 车灯
    ctx.fillStyle = color.accent;
    if (car.o === 'H') {
      ctx.fillRect(bodyX + 2, bodyY + bodyH * 0.18, 4, bodyH * 0.24);
      ctx.fillRect(bodyX + 2, bodyY + bodyH * 0.58, 4, bodyH * 0.24);
      ctx.fillRect(bodyX + bodyW - 6, bodyY + bodyH * 0.18, 4, bodyH * 0.24);
      ctx.fillRect(bodyX + bodyW - 6, bodyY + bodyH * 0.58, 4, bodyH * 0.24);
    } else {
      ctx.fillRect(bodyX + bodyW * 0.18, bodyY + 2, bodyW * 0.24, 4);
      ctx.fillRect(bodyX + bodyW * 0.58, bodyY + 2, bodyW * 0.24, 4);
      ctx.fillRect(bodyX + bodyW * 0.18, bodyY + bodyH - 6, bodyW * 0.24, 4);
      ctx.fillRect(bodyX + bodyW * 0.58, bodyY + bodyH - 6, bodyW * 0.24, 4);
    }

    // hero 车顶标志
    if (car.hero) {
      ctx.fillStyle = '#e6ffff';
      ctx.font = `bold ${Math.round(cell * 0.28)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲', bodyX + bodyW / 2, bodyY + bodyH / 2);
    }

    // 悬停高亮
    if (view.hoverCar === car.id && !drag) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      roundRect(bodyX - 3, bodyY - 3, bodyW + 6, bodyH + 6, 10);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawHint(l, state, dt) {
    const { cell } = l;
    const car = state.cars.find((c) => c.id === state.hint.carId);
    if (!car) return;
    const r = cellRect(l, car.row, car.col, car.len, car.o);
    const pulse = 0.6 + 0.4 * Math.sin(dt * 8);
    ctx.save();
    ctx.strokeStyle = `rgba(255,210,62,${pulse})`;
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ffd23e';
    ctx.shadowBlur = 18;
    roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 10);
    ctx.stroke();
    // 方向箭头
    ctx.fillStyle = `rgba(255,210,62,${pulse})`;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const dir = car.o === 'H' ? (state.hint.to > car.col ? 1 : -1) : (state.hint.to > car.row ? 1 : -1);
    ctx.beginPath();
    if (car.o === 'H') {
      ctx.moveTo(cx + dir * cell * 0.3, cy);
      ctx.lineTo(cx + dir * cell * 0.1, cy - 7);
      ctx.lineTo(cx + dir * cell * 0.14, cy);
      ctx.lineTo(cx + dir * cell * 0.1, cy + 7);
    } else {
      ctx.moveTo(cx, cy + dir * cell * 0.3);
      ctx.lineTo(cx - 7, cy + dir * cell * 0.1);
      ctx.lineTo(cx, cy + dir * cell * 0.14);
      ctx.lineTo(cx + 7, cy + dir * cell * 0.1);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(view) {
    for (const p of view.fx) {
      ctx.globalAlpha = Math.max(0, p.ttl / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.ttl / p.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  return {
    resize,
    draw(state, dt, view) {
      drawBackground(dt, !!view.reducedMotion);
      if (state && state.cars) drawBoard(state, dt, view);
      drawParticles(view);
    },
    debugLayout() {
      const l = layout();
      return {
        board: l.board,
        cell: l.cell,
        hudH: l.hudH,
        carRect: (car) => {
          const r = cellRect(l, car.row, car.col, car.len, car.o);
          return { x: r.x, y: r.y, w: r.w, h: r.h };
        },
        cellRect: (row, col) => {
          const r = cellRect(l, row, col, 1, 'H');
          return { x: r.x, y: r.y, w: r.w, h: r.h };
        },
      };
    },
  };
}
