// COLOR PIPES FLOW · Canvas 2D 渲染（霓虹街机主题）
// 只消费 run.state + view（hoverCell/hintPulse）。像素换算全部在此完成。
// 契约：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, GAME } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const MARGIN_X = 24;
const MARGIN_Y = 20;
const CELL_MAX = 100;

// 霓虹街机配色
const BG = { top: '#0B1026', mid: '#101635', bot: '#1A0F33' };
const CELL_BG = '#141A38';
const CELL_BORDER = '#232B55';
const ROCK = '#0C1224';
const ROCK_HI = '#2A3458';

let bgCache = null;

function makeBackground() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, BG.top);
  grad.addColorStop(0.5, BG.mid);
  grad.addColorStop(1, BG.bot);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // 电路点阵（远背景）
  for (let y = 0; y < H; y += 44) {
    for (let x = 0; x < W; x += 44) {
      g.fillStyle = 'rgba(120,140,255,0.06)';
      g.beginPath();
      g.arc(x + ((y / 44) % 2) * 22, y, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 横向扫光线
  const scan = g.createLinearGradient(0, H * 0.2, 0, H * 0.9);
  scan.addColorStop(0, 'rgba(80,220,255,0.05)');
  scan.addColorStop(0.5, 'rgba(120,90,255,0.04)');
  scan.addColorStop(1, 'rgba(255,77,109,0.05)');
  g.fillStyle = scan;
  g.fillRect(0, 0, W, H);
  return c;
}

function getBackground() {
  if (!bgCache) bgCache = makeBackground();
  return bgCache;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function computeLayout(state) {
  const { rows, cols } = state;
  const gridAreaW = W - MARGIN_X * 2;
  const gridAreaH = H - GAME.HUD_H - MARGIN_Y * 2;
  const cell = Math.min(gridAreaW / cols, gridAreaH / rows, CELL_MAX);
  const gridW = cell * cols;
  const gridH = cell * rows;
  const gridX = MARGIN_X + Math.floor((gridAreaW - gridW) / 2);
  const gridY = GAME.HUD_H + MARGIN_Y + Math.floor((gridAreaH - gridH) / 2);
  return { cell, gridX, gridY, gridW, gridH };
}

function cellCenter(layout, r, c) {
  return { x: layout.gridX + c * layout.cell + layout.cell / 2, y: layout.gridY + r * layout.cell + layout.cell / 2 };
}

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawPort(g, x, y, r, color, connected, clock, active, phase) {
  // 呼吸相位：同色两端同相，视觉上把一对端口「配对」；已连通则整体亮起
  const breathe = connected ? (0.5 + 0.5 * Math.sin((clock || 0) * 4)) : (0.5 + 0.5 * Math.sin((clock || 0) * 2.4 + phase));

  // 端口外圈光晕
  const glow = g.createRadialGradient(x, y, r * 0.2, x, y, r * 2.2);
  glow.addColorStop(0, hexToRgba(color, 0.5 + 0.2 * breathe));
  glow.addColorStop(1, hexToRgba(color, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.arc(x, y, r * 2.2, 0, Math.PI * 2);
  g.fill();

  // 端口主体
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();

  // 内圈暗芯 + 白点
  g.fillStyle = 'rgba(6,8,20,0.85)';
  g.beginPath();
  g.arc(x, y, r * 0.55, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(x, y, r * 0.22, 0, Math.PI * 2);
  g.fill();

  // 外环：连通=亮白脉冲环；未连通=呼吸白环（同色同步）
  const ringA = connected ? (0.5 + 0.4 * breathe) : (0.3 + 0.25 * breathe);
  g.strokeStyle = `rgba(255,255,255,${ringA})`;
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(x, y, r * (connected ? 1.35 : 1.4) + breathe * 2, 0, Math.PI * 2);
  g.stroke();

  if (active) {
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, r * 1.7, 0, Math.PI * 2);
    g.stroke();
  }
}

function drawPath(g, cells, layout, color, active, clock) {
  if (!cells || cells.length < 2) return;
  const pts = cells.map(([r, c]) => cellCenter(layout, r, c));
  const alpha = active ? 1 : 0.9;

  // 底层光晕
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = hexToRgba(color, 0.28 * alpha);
  g.lineWidth = layout.cell * 0.52;
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i].x, pts[i].y);
  g.stroke();

  // 主体管壁
  g.strokeStyle = color;
  g.globalAlpha = alpha;
  g.lineWidth = layout.cell * 0.3;
  g.stroke();

  // 高光细线
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = layout.cell * 0.09;
  g.stroke();
  g.restore();

  // 活动路径头部节点
  if (active) {
    const head = pts[pts.length - 1];
    const pulse = 0.5 + 0.5 * Math.sin((clock || 0) * 8);
    g.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * pulse})`;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(head.x, head.y, layout.cell * 0.34 + pulse * 3, 0, Math.PI * 2);
    g.stroke();
  }
}

function drawRock(g, x, y, cell) {
  const r = cell * 0.42;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(x + 2, y + r * 0.8, r, r * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  const grad = g.createLinearGradient(x - r, y - r, x + r, y + r);
  grad.addColorStop(0, '#4A5680');
  grad.addColorStop(0.55, '#2A3458');
  grad.addColorStop(1, '#141A38');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x - r, y + r * 0.22);
  g.lineTo(x - r * 0.55, y - r);
  g.lineTo(x + r * 0.52, y - r * 0.78);
  g.lineTo(x + r, y + r * 0.12);
  g.closePath();
  g.fill();
  g.strokeStyle = '#7A8AC8';
  g.lineWidth = 2;
  g.stroke();
  // 裂纹
  g.strokeStyle = 'rgba(6,10,24,0.95)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x - r * 0.4, y - r * 0.1);
  g.lineTo(x + r * 0.08, y + r * 0.24);
  g.lineTo(x - r * 0.12, y + r * 0.52);
  g.stroke();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  let clock = 0;
  let lastState = null;

  function resize(w, h) {
    return { w, h, world: { width: W, height: H } };
  }

  function debugLayout() {
    if (!lastState) return null;
    const L = computeLayout(lastState);
    return {
      grid: { x: L.gridX, y: L.gridY, w: L.gridW, h: L.gridH },
      hud: { x: 0, y: 0, w: W, h: GAME.HUD_H },
      cell: L.cell,
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(getBackground(), 0, 0);
    // 标题屏装饰：几条飘动的霓虹管道
    const demoColors = ['#FF4D6D', '#3DE8A8', '#4FC3F7', '#B98CFF'];
    for (let i = 0; i < 4; i += 1) {
      const y = 140 + i * 130 + Math.sin(clock * 1.2 + i * 1.7) * 26;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = hexToRgba(demoColors[i], 0.4);
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-40, y);
      ctx.bezierCurveTo(W * 0.3, y - 90, W * 0.6, y + 90, W + 40, y + Math.sin(clock * 0.9 + i) * 30);
      ctx.stroke();
      ctx.strokeStyle = demoColors[i];
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    }
  }

  function draw(state, dt, view) {
    const v = view || {};
    if (!state || !state.grid) {
      clock += dt || 0;
      drawTitleScene();
      return;
    }
    clock += dt || 0;
    lastState = state;

    const L = computeLayout(state);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(getBackground(), 0, 0);

    // 网格底板
    for (let r = 0; r < state.rows; r += 1) {
      for (let c = 0; c < state.cols; c += 1) {
        const x = L.gridX + c * L.cell;
        const y = L.gridY + r * L.cell;
        const g = state.grid[r][c];
        if (g.rock) continue;
        roundRect(ctx, x + 3, y + 3, L.cell - 6, L.cell - 6, Math.max(4, L.cell * 0.14));
        ctx.fillStyle = CELL_BG;
        ctx.fill();
        ctx.strokeStyle = CELL_BORDER;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // 空格内 faint 插孔，提示「这里待填」
        if (g.dot === -1 && g.owner === -1) {
          ctx.fillStyle = 'rgba(150,175,255,0.12)';
          ctx.beginPath();
          ctx.arc(x + L.cell / 2, y + L.cell / 2, L.cell * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 岩石
    for (let r = 0; r < state.rows; r += 1) {
      for (let c = 0; c < state.cols; c += 1) {
        if (state.grid[r][c].rock) {
          const p = cellCenter(L, r, c);
          drawRock(ctx, p.x, p.y, L.cell);
        }
      }
    }

    // 已画路径
    for (let id = 0; id < state.pairs.length; id += 1) {
      const path = state.paths[id];
      if (!path || path.length < 2) continue;
      drawPath(ctx, path, L, state.pairs[id].color, id === state.activeColor, clock);
    }

    // 提示格脉冲
    if (state.hintCell) {
      const hc = state.hintCell;
      if (state.grid[hc[0]] && state.grid[hc[0]][hc[1]] && state.grid[hc[0]][hc[1]].hinted) {
        const p = cellCenter(L, hc[0], hc[1]);
        const pulse = 0.5 + 0.5 * Math.sin(clock * 6);
        ctx.strokeStyle = `rgba(255,216,78,${0.6 + 0.4 * pulse})`;
        ctx.lineWidth = 4;
        roundRect(ctx, p.x - L.cell * 0.42, p.y - L.cell * 0.42, L.cell * 0.84, L.cell * 0.84, 8);
        ctx.stroke();
      }
    }

    // 端口
    for (let id = 0; id < state.pairs.length; id += 1) {
      const pair = state.pairs[id];
      const connected = state.paths[id] && state.paths[id].length >= 2 &&
        ((state.paths[id][0][0] === pair.a[0] && state.paths[id][0][1] === pair.a[1] &&
          state.paths[id][state.paths[id].length - 1][0] === pair.b[0] && state.paths[id][state.paths[id].length - 1][1] === pair.b[1]) ||
         (state.paths[id][0][0] === pair.b[0] && state.paths[id][0][1] === pair.b[1] &&
          state.paths[id][state.paths[id].length - 1][0] === pair.a[0] && state.paths[id][state.paths[id].length - 1][1] === pair.a[1]));
      const active = id === state.activeColor;
      const phase = id * 1.7;
      const pa = cellCenter(L, pair.a[0], pair.a[1]);
      const pb = cellCenter(L, pair.b[0], pair.b[1]);
      drawPort(ctx, pa.x, pa.y, L.cell * 0.34, pair.color, connected, clock, active, phase);
      drawPort(ctx, pb.x, pb.y, L.cell * 0.34, pair.color, connected, clock, active, phase);
    }

    // 顶部 HUD 底部压一条柔光，保证 HUD 可读
    const hudGrad = ctx.createLinearGradient(0, 0, 0, GAME.HUD_H + 4);
    hudGrad.addColorStop(0, 'rgba(6,8,20,0.85)');
    hudGrad.addColorStop(1, 'rgba(6,8,20,0)');
    ctx.fillStyle = hudGrad;
    ctx.fillRect(0, 0, W, GAME.HUD_H + 4);
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize };
}
