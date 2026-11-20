// MOSAIC SLIDE · Canvas 2D 渲染：三场景背景 / 琉璃棋盘 / 参考图面板 / 完成点亮。
// 只消费 run.state + view（hoverCell/cursor/fxQueue/shake/goalLabel 等）。
// 像素换算全部在此完成（sim 只给 r,c 与碎片 id）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';
import { createPattern, mulberry32 } from '../game/pattern.js';
import { indexToRC } from '../game/solver.js';

const SCENE_BG = {
  'workshop-dawn': { top: '#FFE9B4', mid: '#E8C78A', bot: '#C9935C', accent: '#8E5B3B' },
  'glass-afternoon': { top: '#8FD3E8', mid: '#6FB7D4', bot: '#3E7C8C', accent: '#2E5A6B' },
  'candle-night': { top: '#2A2150', mid: '#1E1838', bot: '#120D24', accent: '#3E2A6B' },
};

// ---- 静态背景离屏缓存 ----
const bgCache = new Map();
function getBackground(sceneKey) {
  let c = bgCache.get(sceneKey);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  drawBackground(c.getContext('2d'), sceneKey);
  bgCache.set(sceneKey, c);
  return c;
}

function drawBackground(g, sceneKey) {
  const P = SCENE_BG[sceneKey] || SCENE_BG['workshop-dawn'];
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.top);
  sky.addColorStop(0.6, P.mid);
  sky.addColorStop(1, P.bot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'candle-night') {
    drawStars(g);
    for (const [x, y] of [[90, H - 70], [W - 90, H - 70]]) drawCandle(g, x, y);
  } else if (sceneKey === 'glass-afternoon') {
    drawSun(g, W - 190, 130);
    drawClouds(g);
    drawArch(g, P);
  } else {
    drawLightShafts(g);
    drawWorkbench(g, P);
  }
}

function drawStars(g) {
  const rnd = mulberry32(42);
  for (let i = 0; i < 110; i += 1) {
    const x = rnd() * WORLD.WIDTH;
    const y = rnd() * WORLD.HEIGHT * 0.6;
    g.fillStyle = `rgba(230,235,255,${0.25 + rnd() * 0.7})`;
    g.beginPath();
    g.arc(x, y, 0.6 + rnd() * 1.5, 0, Math.PI * 2);
    g.fill();
  }
}

function drawCandle(g, x, y) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#2A1E12';
  g.beginPath();
  g.moveTo(-10, 0); g.lineTo(10, 0); g.lineTo(7, -46); g.lineTo(-7, -46); g.closePath(); g.fill();
  g.fillStyle = '#C7794A';
  g.beginPath();
  g.moveTo(-4, -46); g.lineTo(4, -46); g.lineTo(2, -58); g.lineTo(-2, -58); g.closePath(); g.fill();
  const fl = g.createRadialGradient(0, -58, 2, 0, -66, 26);
  fl.addColorStop(0, 'rgba(255,214,120,0.95)');
  fl.addColorStop(1, 'rgba(255,160,60,0)');
  g.fillStyle = fl;
  g.beginPath(); g.arc(0, -66, 26, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawSun(g, x, y) {
  const halo = g.createRadialGradient(x, y, 8, x, y, 200);
  halo.addColorStop(0, 'rgba(255,244,190,0.9)');
  halo.addColorStop(1, 'rgba(255,244,190,0)');
  g.fillStyle = halo;
  g.fillRect(x - 200, y - 200, 400, 400);
  g.fillStyle = '#FFF6D6';
  g.beginPath(); g.arc(x, y, 44, 0, Math.PI * 2); g.fill();
}

function drawClouds(g) {
  const rnd = mulberry32(7);
  for (let i = 0; i < 5; i += 1) {
    const x = rnd() * WORLD.WIDTH;
    const y = 60 + rnd() * 130;
    g.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.3})`;
    g.beginPath();
    g.ellipse(x, y, 70 + rnd() * 60, 16 + rnd() * 12, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function drawArch(g, P) {
  g.strokeStyle = P.accent;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(WORLD.WIDTH - 260, WORLD.HEIGHT, 230, Math.PI, Math.PI * 1.5);
  g.stroke();
  g.beginPath();
  g.moveTo(WORLD.WIDTH - 260, WORLD.HEIGHT - 230);
  g.lineTo(WORLD.WIDTH - 260, WORLD.HEIGHT);
  g.lineTo(WORLD.WIDTH - 30, WORLD.HEIGHT);
  g.stroke();
}

function drawLightShafts(g) {
  for (let i = 0; i < 4; i += 1) {
    const x = 160 + i * 300;
    g.fillStyle = 'rgba(255,236,170,0.16)';
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 150, 0);
    g.lineTo(x + 60, WORLD.HEIGHT);
    g.lineTo(x - 60, WORLD.HEIGHT);
    g.closePath();
    g.fill();
  }
}

function drawWorkbench(g, P) {
  g.fillStyle = P.accent;
  g.fillRect(0, WORLD.HEIGHT - 26, WORLD.WIDTH, 26);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, WORLD.HEIGHT - 26, WORLD.WIDTH, 6);
}

// ---- 圆角矩形 ----
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- 瓷砖多边形（方 / 六边形近似） ----
function tilePath(ctx, cx, cy, cell, hex, inset) {
  if (hex) {
    const R = cell * 0.56 - inset;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    roundRect(ctx, cx - cell / 2 + inset, cy - cell / 2 + inset, cell - inset * 2, cell - inset * 2, Math.max(4, cell * 0.1));
  }
}

// ---- 纹样（带朝向，旋转关旋转会改变其朝向） ----
function drawMotif(ctx, cx, cy, cell, p, rot) {
  const s = cell / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rot || 0) * Math.PI / 2);
  ctx.fillStyle = p.accent;
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = Math.max(1, cell * 0.02);
  const m = p.motif;
  if (m === 0) {
    // 中心花蕊：四瓣 + 一点
    for (let i = 0; i < 4; i += 1) {
      ctx.save();
      ctx.rotate((Math.PI / 2) * i);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.28, s * 0.14, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = p.fill;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2); ctx.fill();
  } else if (m === 1) {
    // 花瓣：三片朝向
    for (let i = 0; i < 3; i += 1) {
      ctx.save();
      ctx.rotate((Math.PI * 2 / 3) * i);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.42, s * 0.22, s * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (m === 2) {
    // 面板：顶部菱形 + 底弧
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.32, 0); ctx.lineTo(0, s * 0.4); ctx.lineTo(-s * 0.32, 0);
    ctx.closePath(); ctx.fill();
  } else {
    // 角饰：对角纹
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.2); ctx.lineTo(s * 0.5, -s * 0.2);
    ctx.lineTo(s * 0.2, s * 0.5); ctx.lineTo(-s * 0.2, s * 0.5);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---- 绘制一片琉璃碎片 ----
function drawTile(ctx, cx, cy, cell, p, opts = {}) {
  const hex = opts.hex;
  ctx.save();
  tilePath(ctx, cx, cy, cell, hex, cell * 0.03);
  ctx.clip();

  const g = ctx.createLinearGradient(cx - cell / 2, cy - cell / 2, cx + cell / 2, cy + cell / 2);
  g.addColorStop(0, shade(p.fill, 0.18));
  g.addColorStop(0.5, p.fill);
  g.addColorStop(1, shade(p.fill, -0.16));
  ctx.fillStyle = g;
  ctx.fillRect(cx - cell / 2, cy - cell / 2, cell, cell);

  drawMotif(ctx, cx, cy, cell, p, opts.rot);

  // 光泽高光
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, cell * 0.03);
  ctx.beginPath();
  ctx.moveTo(cx - cell * 0.32, cy - cell * 0.32);
  ctx.lineTo(cx + cell * 0.14, cy - cell * 0.32);
  ctx.stroke();

  ctx.restore();

  // 铅条描边
  ctx.save();
  tilePath(ctx, cx, cy, cell, hex, cell * 0.02);
  ctx.strokeStyle = p.lead;
  ctx.lineWidth = Math.max(2, cell * 0.06);
  ctx.lineJoin = 'round';
  ctx.stroke();
  // 归位辉光
  if (opts.correct) {
    tilePath(ctx, cx, cy, cell, hex, cell * 0.0);
    ctx.strokeStyle = 'rgba(255,240,180,0.9)';
    ctx.lineWidth = Math.max(2, cell * 0.045);
    ctx.stroke();
  }
  ctx.restore();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + Math.round(amt * 255)));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + Math.round(amt * 255)));
  const b = Math.max(0, Math.min(255, (n & 0xff) + Math.round(amt * 255)));
  return `rgb(${r},${g},${b})`;
}

// ---- 参考图（完整花窗缩略） ----
function drawWindowPattern(ctx, cx, cy, size, pattern, opts = {}) {
  const { rows, cols } = pattern.level;
  const cw = size / cols;
  const ch = size / rows;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.clip();
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const p = pattern.cell(r, c);
      if (opts.filterVariant != null && p.variant !== opts.filterVariant) continue;
      const px = cx - size / 2 + c * cw;
      const py = cy - size / 2 + r * ch;
      ctx.fillStyle = p.fill;
      ctx.fillRect(px, py, cw + 1, ch + 1);
      // 小纹样
      drawMotif(ctx, px + cw / 2, py + ch / 2, Math.min(cw, ch) * 1.6, p, 0);
    }
  }
  // 铅条网格
  ctx.strokeStyle = pattern.cell(0, 0).lead;
  ctx.lineWidth = Math.max(1, size * 0.008);
  for (let r = 0; r <= rows; r += 1) {
    ctx.beginPath();
    ctx.moveTo(cx - size / 2, cy - size / 2 + r * ch);
    ctx.lineTo(cx + size / 2, cy - size / 2 + r * ch);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c += 1) {
    ctx.beginPath();
    ctx.moveTo(cx - size / 2 + c * cw, cy - size / 2);
    ctx.lineTo(cx - size / 2 + c * cw, cy + size / 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ---- 布局 ----
function computeLayout(state) {
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const boardAreaW = W - LAYOUT.MARGIN_X * 2 - LAYOUT.REF_W - LAYOUT.REF_GAP;
  const boardAreaH = H - LAYOUT.HUD_H - LAYOUT.MARGIN_Y * 2;
  const { rows, cols } = state;
  const cell = Math.min(boardAreaW / cols, boardAreaH / rows, LAYOUT.CELL_MAX);
  const boardW = cell * cols;
  const boardH = cell * rows;
  const gridX = LAYOUT.MARGIN_X + Math.floor((boardAreaW - boardW) / 2);
  const gridY = LAYOUT.HUD_H + LAYOUT.MARGIN_Y + Math.floor((boardAreaH - boardH) / 2);
  const refX = W - LAYOUT.MARGIN_X - LAYOUT.REF_W;
  const refY = LAYOUT.HUD_H + LAYOUT.MARGIN_Y;
  return { cell, gridX, gridY, gridW: boardW, gridH: boardH, refX, refY, refW: LAYOUT.REF_W, hudH: LAYOUT.HUD_H };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;
  let override = null; // 'icon' 时固定渲染花窗（供 icon/poster 物料）
  const patternCache = new Map();

  function patternFor(level) {
    const k = `${level.index}`;
    let p = patternCache.get(k);
    if (!p) { p = createPattern(level); patternCache.set(k, p); }
    return p;
  }

  function resize(w, h) { return { w, h, world: { width: WORLD.WIDTH, height: WORLD.HEIGHT } }; }

  function debugLayout() {
    if (!lastState) return null;
    const L = computeLayout(lastState);
    return {
      grid: { x: L.gridX, y: L.gridY, w: L.gridW, h: L.gridH },
      goal: { x: L.refX, y: L.refY, w: L.refW, h: L.refW },
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: L.hudH },
      cell: L.cell,
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('workshop-dawn'), 0, 0);
    const lvl = { index: 1, scene: 'workshop-dawn', rows: 5, cols: 5, dual: false };
    const pat = createPattern(lvl); // 标题独立图案，不污染关卡缓存
    drawWindowPattern(ctx, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 430, pat);
    ctx.strokeStyle = 'rgba(74,46,28,0.8)';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 240, 0, Math.PI * 2); ctx.stroke();
  }

  function draw(state, dt, view) {
    if (override === 'icon') { drawIconScene(); return; }
    if (!state || !state.board) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;
    const L = computeLayout(state);
    const sceneKey = state.scene || 'workshop-dawn';
    const level = { index: state.level, scene: sceneKey, rows: state.rows, cols: state.cols, dual: state.dual };
    const pat = patternFor(level);

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }
    ctx.drawImage(getBackground(sceneKey), 0, 0);

    // 棋盘外框
    const frameX = L.gridX - LAYOUT.FRAME, frameY = L.gridY - LAYOUT.FRAME;
    const frameW = L.gridW + LAYOUT.FRAME * 2, frameH = L.gridH + LAYOUT.FRAME * 2;
    ctx.fillStyle = 'rgba(20,12,6,0.55)';
    roundRect(ctx, frameX, frameY, frameW, frameH, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,235,190,0.5)';
    ctx.lineWidth = 2;
    roundRect(ctx, frameX, frameY, frameW, frameH, 18);
    ctx.stroke();

    // 碎片
    for (let r = 0; r < state.rows; r += 1) {
      for (let c = 0; c < state.cols; c += 1) {
        const cell = r * state.cols + c;
        const t = state.board[cell];
        if (t === 0) continue; // 缺口另画
        const home = indexToRC(t, state.cols);
        const p = pat.cell(home.r, home.c);
        const cx = L.gridX + c * L.cell + L.cell / 2;
        const cy = L.gridY + r * L.cell + L.cell / 2;
        const correct = (t === cell) && (state.rot[cell] === state.homeRot[t]);
        drawTile(ctx, cx, cy, L.cell, p, { hex: state.hex, rot: state.rot[cell], correct });
      }
    }

    // 缺口（缺片）：暗格 + 内光
    {
      const { r, c } = indexToRC(state.blank, state.cols);
      const cx = L.gridX + c * L.cell + L.cell / 2;
      const cy = L.gridY + r * L.cell + L.cell / 2;
      ctx.save();
      tilePath(ctx, cx, cy, L.cell, state.hex, L.cell * 0.02);
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, L.cell * 0.6);
      g.addColorStop(0, 'rgba(120,90,50,0.9)');
      g.addColorStop(1, 'rgba(30,18,10,0.95)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,224,150,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 缺口脉冲高亮 + 中心光点：明确「这里可以滑入」
      const pulse = 0.5 + 0.5 * Math.sin(clock * 3.2);
      tilePath(ctx, cx, cy, L.cell, state.hex, L.cell * 0.02);
      ctx.strokeStyle = `rgba(255,232,170,${0.45 + 0.4 * pulse})`;
      ctx.lineWidth = 3 + pulse * 2;
      ctx.stroke();
      ctx.fillStyle = `rgba(255,240,190,${0.35 + 0.3 * pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy, L.cell * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // hover 高亮（可滑入缺口的碎片）
    if (v.hoverCell) {
      const { r, c } = v.hoverCell;
      const cell = r * state.cols + c;
      if (state.board[cell] !== 0 && neighborsOf(state.blank, state.rows, state.cols).includes(cell)) {
        const cx = L.gridX + c * L.cell + L.cell / 2;
        const cy = L.gridY + r * L.cell + L.cell / 2;
        ctx.save();
        tilePath(ctx, cx, cy, L.cell, state.hex, L.cell * 0.0);
        ctx.strokeStyle = 'rgba(255,240,180,0.95)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 完成点亮（signature：阳光透入整幅花窗）
    if (state.phase === 'won') {
      const bloom = Math.min(1, state.wonClock / GAME.LIGHT_BLOOM_SECONDS);
      const cx = L.gridX + L.gridW / 2, cy = L.gridY + L.gridH / 2;
      const rad = Math.max(L.gridW, L.gridH) * (0.5 + bloom * 0.3);
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, rad);
      glow.addColorStop(0, `rgba(255,244,200,${0.55 * bloom})`);
      glow.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(L.gridX - 40, L.gridY - 40, L.gridW + 80, L.gridH + 80);
      ctx.fillStyle = `rgba(255,250,220,${0.28 * bloom})`;
      roundRect(ctx, frameX, frameY, frameW, frameH, 18);
      ctx.fill();
    }

    // 参考图面板
    drawReference(ctx, state, pat, L, v);

    ctx.restore();
  }

  function drawReference(ctx, state, pat, L, v) {
    const { refX, refY, refW } = L;
    const label = (v.goalLabel || 'Goal');
    const pad = 10;

    ctx.save();
    ctx.fillStyle = 'rgba(16,10,4,0.72)';
    roundRect(ctx, refX, refY, refW, refW + 64, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,235,190,0.45)';
    ctx.lineWidth = 2;
    roundRect(ctx, refX, refY, refW, refW + 64, 14);
    ctx.stroke();

    ctx.fillStyle = '#FFE9B4';
    ctx.font = '800 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, refX + pad, refY + 20);

    const cx = refX + refW / 2;
    const cy = refY + 24 + (refW - 24) / 2;

    if (!state.reference.visible) {
      ctx.fillStyle = 'rgba(30,20,10,0.85)';
      ctx.beginPath(); ctx.arc(cx, cy, (refW - 24) / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#E8C77A';
      ctx.font = '800 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', cx, cy);
    } else if (state.dual) {
      // 两幅纹样并排，active 高亮
      const half = (refW - 24 - 8) / 2;
      const variants = state.reference.mode === 'a' ? [0, 1] : [1, 0];
      variants.forEach((vv, i) => {
        const sx = refX + pad + 6 + (half / 2) + i * (half + 8);
        drawWindowPattern(ctx, sx, cy, half, pat, { filterVariant: vv });
        if (i === 0) {
          ctx.strokeStyle = 'rgba(255,240,180,0.95)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(sx, cy, half / 2 + 4, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx, cy, half / 2 + 4, 0, Math.PI * 2); ctx.stroke();
        }
      });
    } else {
      drawWindowPattern(ctx, cx, cy, refW - 24, pat);
    }

    // 盲拼偷看次数 / 旋转提示
    let hint = '';
    if (state.blind && state.peekLeft > 0) hint = `${v.peekLabel || 'Peek'} ×${state.peekLeft}`;
    else if (state.rotate) hint = `${v.rotateLabel || 'Rotate'}`;
    if (hint) {
      ctx.fillStyle = '#FFE9B4';
      ctx.font = '700 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hint, cx, refY + refW + 34);
    }
    ctx.restore();
  }

  function drawIconScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const bg = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 60, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 640);
    bg.addColorStop(0, '#3E2A6B');
    bg.addColorStop(1, '#140d20');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const pat = createPattern({ index: 12, scene: 'candle-night', rows: 6, cols: 6, dual: false });
    drawWindowPattern(ctx, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 700, pat);
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => { override = null; drawTitleScene(); };
    window.__drawIcon = () => { override = 'icon'; drawIconScene(); };
  }

  return { draw, debugLayout, resize };
}

function neighborsOf(cell, rows, cols) {
  const r = Math.floor(cell / cols), c = cell % cols;
  const out = [];
  if (r > 0) out.push((r - 1) * cols + c);
  if (r < rows - 1) out.push((r + 1) * cols + c);
  if (c > 0) out.push(r * cols + c - 1);
  if (c < cols - 1) out.push(r * cols + c + 1);
  return out;
}
