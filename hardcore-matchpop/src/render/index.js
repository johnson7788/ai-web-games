// HARDCORE MATCHPOP · Canvas 2D 程序化渲染（霓虹街机，零素材）
// 全程序化：背景渐变 + 网格 + 5 色霓虹晶石（含发光，预渲染 sprite）+ 岩块 + 粒子/漂浮分数/震屏。
// DPR ≤2；发光烘焙进离屏 sprite，帧内只 drawImage，保证 ≥50fps。

import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';
import { ROCK, EMPTY } from '../game/sim.js';

const GEM_COLORS = [
  { main: '#22D3EE', glow: '#22D3EE', core: '#CFFAFE', rim: '#0E7490' }, // 0 cyan circle
  { main: '#E879F9', glow: '#E879F9', core: '#FBE8FF', rim: '#A21CAF' }, // 1 magenta diamond
  { main: '#FACC15', glow: '#FACC15', core: '#FEF9C3', rim: '#A16207' }, // 2 yellow hexagon
  { main: '#4ADE80', glow: '#4ADE80', core: '#DCFCE7', rim: '#15803D' }, // 3 lime square
  { main: '#FB7185', glow: '#FB7185', core: '#FFE4E6', rim: '#BE123C' }, // 4 coral triangle
];

const BOARD = LAYOUT.BOARD;
const CELL = LAYOUT.CELL;
const BOARD_X = (WORLD.WIDTH - BOARD) / 2;   // 360
const BOARD_Y = LAYOUT.HUD_H + 54;            // 106

function shape(ctx, idx, s) {
  const c = s / 2;
  ctx.beginPath();
  switch (idx) {
    case 0: // circle
      ctx.arc(c, c, s * 0.36, 0, Math.PI * 2);
      break;
    case 1: { // diamond
      ctx.moveTo(c, s * 0.14);
      ctx.lineTo(s * 0.86, c);
      ctx.lineTo(c, s * 0.86);
      ctx.lineTo(s * 0.14, c);
      ctx.closePath();
      break;
    }
    case 2: { // hexagon
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = c + Math.cos(a) * s * 0.4;
        const y = c + Math.sin(a) * s * 0.4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 3: { // rounded square
      const r = s * 0.16;
      const p = s * 0.16;
      ctx.moveTo(p + r, p);
      ctx.arcTo(s - p, p, s - p, s - p, r);
      ctx.arcTo(s - p, s - p, p, s - p, r);
      ctx.arcTo(p, s - p, p, p, r);
      ctx.arcTo(p, p, s - p, p, r);
      ctx.closePath();
      break;
    }
    default: { // triangle
      ctx.moveTo(c, s * 0.14);
      ctx.lineTo(s * 0.88, s * 0.82);
      ctx.lineTo(s * 0.12, s * 0.82);
      ctx.closePath();
      break;
    }
  }
  return ctx;
}

function makeGemSprite(idx, size) {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  const col = GEM_COLORS[idx % GEM_COLORS.length];
  const s = size;
  const c = s / 2;
  // 发光
  ctx.shadowColor = col.glow;
  ctx.shadowBlur = s * 0.22;
  ctx.fillStyle = col.main;
  shape(ctx, idx, s);
  ctx.fill();
  ctx.shadowBlur = 0;
  // 边缘
  ctx.strokeStyle = col.rim;
  ctx.lineWidth = s * 0.035;
  ctx.stroke();
  // 高光核
  ctx.fillStyle = col.core;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(c, c, s * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  return cv;
}

function makeRockSprite(size) {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  const s = size;
  const c = s / 2;
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = '#FB923C';
  ctx.lineWidth = s * 0.05;
  // 六角岩块
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i;
    const x = c + Math.cos(a) * s * 0.42;
    const y = c + Math.sin(a) * s * 0.42;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 裂纹
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(c - s * 0.16, c - s * 0.1);
  ctx.lineTo(c + s * 0.02, c);
  ctx.lineTo(c - s * 0.1, c + s * 0.14);
  ctx.moveTo(c + s * 0.12, c - s * 0.16);
  ctx.lineTo(c + s * 0.18, c + s * 0.06);
  ctx.stroke();
  return cv;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  const SPRITE_SIZE = 96;
  const gemSprites = GEM_COLORS.map((_, i) => makeGemSprite(i, SPRITE_SIZE));
  const rockSprite = makeRockSprite(SPRITE_SIZE);

  const fx = [];       // {type:'ring'|'spark', x,y, ttl, max, color, size, vx, vy}
  const floats = [];   // {x, y, text, ttl, max, color, size}
  const colFlash = []; // {c, ttl, max}
  let shake = 0;
  let bgT = 0;

  function boardRect() {
    return { x: BOARD_X, y: BOARD_Y, cell: CELL, board: BOARD };
  }

  function cellXY(r, c) {
    return { x: BOARD_X + c * CELL + CELL / 2, y: BOARD_Y + r * CELL + CELL / 2 };
  }

  function drawBackground() {
    // 深空渐变
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0B1026');
    g.addColorStop(0.55, '#11163A');
    g.addColorStop(1, '#0B1026');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 缓慢漂移的星点
    ctx.fillStyle = 'rgba(148, 163, 255, 0.35)';
    for (let i = 0; i < 60; i += 1) {
      const x = ((i * 37) % WORLD.WIDTH);
      const y = ((i * 53 + Math.floor(bgT * 8)) % WORLD.HEIGHT);
      ctx.globalAlpha = 0.2 + 0.25 * Math.sin(bgT * 2 + i);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawBoardBackdrop() {
    ctx.fillStyle = 'rgba(8, 11, 28, 0.72)';
    ctx.fillRect(BOARD_X - 8, BOARD_Y - 8, BOARD + 16, BOARD + 16);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(BOARD_X - 8, BOARD_Y - 8, BOARD + 16, BOARD + 16);
    // 网格线
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    for (let i = 1; i < GAME.N; i += 1) {
      const x = BOARD_X + i * CELL;
      const y = BOARD_Y + i * CELL;
      ctx.beginPath();
      ctx.moveTo(x, BOARD_Y);
      ctx.lineTo(x, BOARD_Y + BOARD);
      ctx.moveTo(BOARD_X, y);
      ctx.lineTo(BOARD_X + BOARD, y);
      ctx.stroke();
    }
  }

  function drawTitleBackdrop() {
    drawBoardBackdrop();
    // 装饰晶石盘（标题屏也能一眼看出是消除游戏）
    for (let r = 0; r < GAME.N; r += 1) {
      for (let c = 0; c < GAME.N; c += 1) {
        const idx = (r * 3 + c * 5 + (Math.floor(bgT * 1.2) % 5)) % 5;
        if ((r + c) % 7 === 3) {
          drawRock(r, c);
        } else {
          const p = cellXY(r, c);
          ctx.drawImage(gemSprites[idx], p.x - CELL * 0.42, p.y - CELL * 0.42, CELL * 0.84, CELL * 0.84);
        }
      }
    }
  }

  function drawGem(r, c, idx) {
    const p = cellXY(r, c);
    ctx.drawImage(gemSprites[idx], p.x - CELL * 0.42, p.y - CELL * 0.42, CELL * 0.84, CELL * 0.84);
  }

  function drawRock(r, c) {
    const p = cellXY(r, c);
    ctx.drawImage(rockSprite, p.x - CELL * 0.44, p.y - CELL * 0.44, CELL * 0.88, CELL * 0.88);
  }

  function drawBoard(state) {
    drawBoardBackdrop();
    for (let r = 0; r < GAME.N; r += 1) {
      for (let c = 0; c < GAME.N; c += 1) {
        const v = state.grid[r][c];
        if (v === ROCK) drawRock(r, c);
        else if (v !== EMPTY) drawGem(r, c, v);
      }
    }
    // 列闪光
    for (const f of colFlash) {
      const x = BOARD_X + f.c * CELL;
      const a = Math.max(0, f.ttl / f.max);
      ctx.fillStyle = `rgba(56, 189, 248, ${0.16 * a})`;
      ctx.fillRect(x, BOARD_Y, CELL, BOARD);
    }
  }

  function drawFx(dt) {
    // 粒子
    for (const p of fx) {
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      const a = Math.max(0, p.ttl / p.max);
      if (p.type === 'ring') {
        const radius = p.size * (1 - a) + p.size * 0.4;
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a * 0.9;
        ctx.lineWidth = 3 * a + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
    }
    ctx.globalAlpha = 1;
    // 漂浮分数
    for (const f of floats) {
      const a = Math.max(0, f.ttl / f.max);
      const y = f.y - (1 - a) * 34;
      ctx.globalAlpha = a;
      ctx.font = `800 ${f.size}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 10;
      ctx.fillText(f.text, f.x, y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function draw(state, dt, _view) {
    bgT += dt;
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 26);
      const sx = (Math.random() * 2 - 1) * shake;
      const sy = (Math.random() * 2 - 1) * shake;
      ctx.save();
      ctx.translate(sx, sy);
      renderInner(state, dt);
      ctx.restore();
    } else {
      renderInner(state, dt);
    }
  }

  function renderInner(state, dt) {
    drawBackground();
    if (state && (state.phase === 'playing' || state.phase === 'paused' || state.phase === 'won' || state.phase === 'lost')) {
      drawBoard(state);
    } else {
      drawTitleBackdrop();
    }
    drawFx(dt);
    // 衰减
    for (const p of fx) p.ttl -= dt;
    for (const f of floats) f.ttl -= dt;
    for (const f of colFlash) f.ttl -= dt;
    fx.splice(0, fx.length, ...fx.filter((p) => p.ttl > 0));
    floats.splice(0, floats.length, ...floats.filter((f) => f.ttl > 0));
    colFlash.splice(0, colFlash.length, ...colFlash.filter((f) => f.ttl > 0));
  }

  return {
    draw,
    boardRect,
    cellXY,
    debugLayout() {
      return {
        grid: { x: BOARD_X, y: BOARD_Y },
        board: BOARD,
        cell: CELL,
        boardX: BOARD_X,
        boardY: BOARD_Y,
      };
    },
    burst(cells, colorIdx, gain) {
      const col = GEM_COLORS[colorIdx % GEM_COLORS.length].main;
      const ringCells = cells.slice(0, 24);   // 粒子上限分档：超大组不逐格全画环
      let sparks = 0;
      for (const [r, c] of ringCells) {
        const p = cellXY(r, c);
        fx.push({ type: 'ring', x: p.x, y: p.y, ttl: 0.35, max: 0.35, color: col, size: CELL * 0.5 });
        for (let k = 0; k < 4 && sparks < 120; k += 1) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 60 + Math.random() * 120;
          fx.push({
            type: 'spark', x: p.x, y: p.y, ttl: 0.4, max: 0.4, color: col,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          });
          sparks += 1;
        }
      }
      if (gain > 0) shake = Math.min(8, shake + (cells.length >= 5 ? 3 : 1.5));
    },
    floatAt(r, c, text, color) {
      const p = cellXY(r, c);
      floats.push({ x: p.x, y: p.y, text, ttl: 0.9, max: 0.9, color, size: 20 });
    },
    flashColumn(c) {
      colFlash.push({ c, ttl: 0.35, max: 0.35 });
    },
    shakeAmt(n) {
      shake = Math.max(shake, n);
    },
  };
}
