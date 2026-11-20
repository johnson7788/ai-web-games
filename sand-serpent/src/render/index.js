// Canvas 2D 渲染：Sand Serpent 沙漠三场景 / 网格 / 沙蟒 / 食物 / 流沙波纹 / 沙暴。
// 只消费 run.state（sim 契约）+ view（shake/fxQueue/hoverCell）。
// 像素换算全部在此完成（sim 只给 r,c）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, LAYOUT } from '../../config/game.config.js';

// ------------------------------------------------------------------ 场景色板
const SCENE_PALETTES = {
  dunes: {
    skyTop: '#FFE3A8', skyMid: '#F2C078', skyBot: '#DFA255',
    duneFar: '#DCA45E', duneNear: '#C08842', ground: '#E8BC7A',
    tile: '#EED49A', tileBorder: '#C99A5C', tileDark: '#E2C083',
    wall: '#8A5A2E', wallHi: '#B87A3E',
    cactus: '#4E8A3E', cactusDark: '#2F6B2C',
    hard: '#6E5A44', hardHi: '#8A7258',
    boost: '#E0A23A', boostHi: '#FFD97A',
    glow: 'rgba(255,226,160,0.55)',
  },
  oasis: {
    skyTop: '#C2EBD9', skyMid: '#8FD0B0', skyBot: '#5AA97F',
    duneFar: '#7FB995', duneNear: '#5E9A76', ground: '#8FCBA0',
    tile: '#B8DFC0', tileBorder: '#6FA97F', tileDark: '#A8D6B4',
    wall: '#3E7A55', wallHi: '#5A9A72',
    cactus: '#3F7A3E', cactusDark: '#2A5C2C',
    hard: '#5E6E52', hardHi: '#78906A',
    boost: '#E0A23A', boostHi: '#FFD97A',
    glow: 'rgba(160,230,200,0.55)',
  },
  starlight: {
    skyTop: '#101A3C', skyMid: '#1B1E4E', skyBot: '#2A1E55',
    duneFar: '#232A50', duneNear: '#1A2038', ground: '#202A4A',
    tile: '#2E3760', tileBorder: '#232A4A', tileDark: '#28304F',
    wall: '#3A3358', wallHi: '#5A4A78',
    cactus: '#3E7A5C', cactusDark: '#2A5C44',
    hard: '#46405A', hardHi: '#5E5478',
    boost: '#D08A2E', boostHi: '#FFD97A',
    glow: 'rgba(150,180,255,0.30)',
  },
};

const BODY_OUTLINE = '#5A2E12';
const BODY_MAIN = '#F0A548';
const BODY_LIGHT = '#FFD97A';
const HEAD_MAIN = '#FFC65C';

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededRand(r, c, seed = 7) {
  return mulberry((r * 73856093) ^ (c * 19349663) ^ (seed * 83492791))();
}

// ------------------------------------------------------------------ 背景缓存
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
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.dunes;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'starlight') { drawStars(g); drawMoon(g); }
  else if (sceneKey === 'oasis') { drawSun(g, '#FFF6C8'); drawWaterPool(g); }
  else { drawSun(g, '#FFF0B0'); }

  drawDunes(g, P, W, H);

  g.fillStyle = P.ground;
  g.fillRect(0, H * 0.66, W, H * 0.34);

  if (sceneKey === 'dunes') { drawPalm(g, 60, 440, 1.0); drawPalm(g, 1230, 470, 0.7); }
  if (sceneKey === 'oasis') drawReeds(g, W, H);
  if (sceneKey === 'starlight') drawRocks(g, W, H);
}

function drawStars(g) {
  for (let i = 0; i < 120; i += 1) {
    const x = seededRand(i, 1, 3) * WORLD.WIDTH;
    const y = seededRand(i, 2, 5) * WORLD.HEIGHT * 0.6;
    const r = 0.5 + seededRand(i, 3, 7) * 1.5;
    g.fillStyle = `rgba(220,235,255,${0.35 + seededRand(i, 4, 9) * 0.6})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}
function drawMoon(g) {
  const x = WORLD.WIDTH - 200, y = 120, r = 42;
  const halo = g.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6);
  halo.addColorStop(0, 'rgba(210,235,255,0.4)');
  halo.addColorStop(1, 'rgba(210,235,255,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(x, y, r * 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#EAF3FF';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}
function drawSun(g, color) {
  const x = 160, y = 140;
  const halo = g.createRadialGradient(x, y, 16, x, y, 300);
  halo.addColorStop(0, color);
  halo.addColorStop(1, 'rgba(255,240,180,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  g.fillStyle = color;
  g.beginPath(); g.arc(x, y, 46, 0, Math.PI * 2); g.fill();
}
function drawDunes(g, P, W, H) {
  const farY = H * 0.66, nearY = H * 0.78;
  g.fillStyle = P.duneFar;
  g.beginPath();
  g.moveTo(0, farY);
  for (let i = 0; i <= 6; i += 1) {
    const x = (W / 6) * i;
    g.lineTo(x, farY - Math.sin(i * 1.7 + 0.5) * 70 - 20);
  }
  g.lineTo(W, farY + 60); g.lineTo(0, farY + 60); g.closePath(); g.fill();

  g.fillStyle = P.duneNear;
  g.beginPath();
  g.moveTo(0, nearY);
  for (let i = 0; i <= 7; i += 1) {
    const x = (W / 7) * i;
    g.lineTo(x, nearY - Math.sin(i * 2.1 + 2.0) * 50 - 14);
  }
  g.lineTo(W, nearY + 50); g.lineTo(0, nearY + 50); g.closePath(); g.fill();
}
function drawPalm(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = '#7A5A38'; g.lineWidth = 10; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(14, -80, 8, -150); g.stroke();
  g.fillStyle = '#6E8F4E';
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.5;
    g.save(); g.rotate(a);
    g.beginPath(); g.ellipse(0, -150, 14, 46, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.restore();
}
function drawWaterPool(g) {
  const x = WORLD.WIDTH - 260, y = 470, w = 180, h = 40;
  g.fillStyle = '#4FA8C8';
  g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3;
  g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 - 8, h / 2 - 6, 0, 0, Math.PI * 2); g.stroke();
}
function drawReeds(g, W, H) {
  g.strokeStyle = '#3F7A3E'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 8; i += 1) {
    const x = 60 + i * 24;
    const y = H - 20 - seededRand(i, 3, 9) * 40;
    g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + 4, y, x + 6, y - 30); g.stroke();
  }
}
function drawRocks(g, W, H) {
  g.fillStyle = '#1A2038';
  for (let i = 0; i < 5; i += 1) {
    const x = 120 + i * 240 + seededRand(i, 3, 7) * 40;
    const y = H - 30 - seededRand(i, 5, 9) * 40;
    g.beginPath(); g.ellipse(x, y, 40 + seededRand(i, 2, 5) * 20, 20, 0, 0, Math.PI * 2); g.fill();
  }
}

// ------------------------------------------------------------------ 网格
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGridBase(ctx, state, L, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.dunes;
  const { rows, cols } = state;
  const { cell, gridX, gridY } = L;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = gridX + c * cell, y = gridY + r * cell;
      const kind = state.grid[r][c].kind;
      const checker = (r + c) % 2 === 0;
      ctx.fillStyle = checker ? P.tile : P.tileDark;
      roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, Math.max(4, cell * 0.14));
      ctx.fill();

      if (kind === 'wall') {
        ctx.fillStyle = P.wall;
        roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, Math.max(4, cell * 0.14)); ctx.fill();
        ctx.fillStyle = P.wallHi;
        roundRect(ctx, x + 6, y + 4, cell - 12, cell * 0.28, 4); ctx.fill();
      } else if (kind === 'cactus') {
        drawCactus(ctx, x + cell / 2, y + cell / 2, cell, P);
      } else if (kind === 'hard') {
        ctx.fillStyle = P.hard;
        roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, Math.max(4, cell * 0.14)); ctx.fill();
        ctx.strokeStyle = P.hardHi; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + cell * 0.4); ctx.lineTo(x + cell * 0.4, y + cell - 8);
        ctx.moveTo(x + cell * 0.5, y + 8); ctx.lineTo(x + cell - 8, y + cell * 0.6);
        ctx.stroke();
      } else if (kind === 'boost') {
        drawBoost(ctx, x + cell / 2, y + cell / 2, cell, P);
      } else {
        // 沙纹细线
        ctx.strokeStyle = P.tileBorder;
        ctx.lineWidth = 1;
        if (seededRand(r, c, 21) > 0.5) {
          ctx.beginPath();
          ctx.moveTo(x + cell * 0.2, y + cell * 0.6);
          ctx.lineTo(x + cell * 0.8, y + cell * 0.6);
          ctx.stroke();
        }
      }
    }
  }
}

function drawCactus(ctx, cx, cy, cell, P) {
  const s = cell / 60;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = P.cactus;
  ctx.beginPath(); ctx.roundRect(-14, -24, 28, 48, 12); ctx.fill();
  ctx.fillStyle = P.cactusDark;
  ctx.beginPath(); ctx.roundRect(-10, -20, 20, 40, 9); ctx.fill();
  // 双臂
  ctx.fillStyle = P.cactus;
  ctx.beginPath(); ctx.roundRect(-26, -8, 14, 8, 4); ctx.fill();
  ctx.beginPath(); ctx.roundRect(-26, -30, 8, 20, 4); ctx.fill();
  ctx.beginPath(); ctx.roundRect(12, -2, 14, 8, 4); ctx.fill();
  ctx.beginPath(); ctx.roundRect(18, -22, 8, 18, 4); ctx.fill();
  ctx.restore();
}

function drawBoost(ctx, cx, cy, cell, P) {
  ctx.fillStyle = P.boost;
  roundRect(ctx, cx - cell * 0.4, cy - cell * 0.4, cell * 0.8, cell * 0.8, cell * 0.2);
  ctx.fill();
  ctx.fillStyle = P.boostHi;
  // 双箭头
  const s = cell * 0.14;
  for (const dx of [-cell * 0.14, cell * 0.06]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx - s, cy - s);
    ctx.lineTo(cx + dx + s * 0.6, cy);
    ctx.lineTo(cx + dx - s, cy + s);
    ctx.closePath(); ctx.fill();
  }
}

// ------------------------------------------------------------------ 流沙波纹（签名：蛇身过处）
function drawRippleTrail(ctx, trail, L) {
  for (const t of trail) {
    const a = Math.max(0, 1 - t.age / 1.4) * 0.32;
    const cx = L.gridX + t.c * L.cell + L.cell / 2;
    const cy = L.gridY + t.r * L.cell + L.cell / 2;
    ctx.strokeStyle = `rgba(255,240,205,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, L.cell * 0.36, L.cell * 0.30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,240,205,${a * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, L.cell * 0.24, L.cell * 0.19, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ 蛇
function drawSnake(ctx, state, L, clock) {
  const { cell, gridX, gridY } = L;
  const segs = state.snake;
  if (!segs.length) return;

  const cx = (p) => gridX + p.c * cell + cell / 2;
  const cy = (p) => gridY + p.r * cell + cell / 2;

  // 身体：连续粗线
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = BODY_OUTLINE;
  ctx.lineWidth = cell * 0.74;
  ctx.beginPath();
  segs.forEach((p, i) => { const x = cx(p), y = cy(p); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();

  ctx.strokeStyle = BODY_MAIN;
  ctx.lineWidth = cell * 0.56;
  ctx.beginPath();
  segs.forEach((p, i) => { const x = cx(p), y = cy(p); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();

  // 背中线（更亮的腹部线）
  ctx.strokeStyle = 'rgba(255,217,122,0.55)';
  ctx.lineWidth = cell * 0.16;
  ctx.beginPath();
  segs.forEach((p, i) => { const x = cx(p), y = cy(p); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();

  // 鳞片刻痕
  ctx.strokeStyle = 'rgba(90,46,18,0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i < segs.length - 1; i += 1) {
    const a = segs[i], b = segs[i + 1];
    const mx = (cx(a) + cx(b)) / 2, my = (cy(a) + cy(b)) / 2;
    ctx.beginPath(); ctx.moveTo(mx - cell * 0.18, my - cell * 0.18); ctx.lineTo(mx + cell * 0.18, my + cell * 0.18);
    ctx.stroke();
  }

  // 头
  const head = segs[0];
  const hx = cx(head), hy = cy(head);
  ctx.fillStyle = BODY_OUTLINE;
  ctx.beginPath(); ctx.arc(hx, hy, cell * 0.44, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = HEAD_MAIN;
  ctx.beginPath(); ctx.arc(hx, hy, cell * 0.36, 0, Math.PI * 2); ctx.fill();

  // 眼睛（朝当前方向）
  const dir = state.dir || { dr: 0, dc: 1 };
  const perp = { x: -dir.dc, y: dir.dr };
  const fwd = { x: dir.dc, y: dir.dr };
  for (const side of [-1, 1]) {
    const ex = hx + fwd.x * cell * 0.14 + perp.x * side * cell * 0.18;
    const ey = hy + fwd.y * cell * 0.14 + perp.y * side * cell * 0.18;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex, ey, cell * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1A0E04';
    ctx.beginPath(); ctx.arc(ex + fwd.x * 2, ey + fwd.y * 2, cell * 0.05, 0, Math.PI * 2); ctx.fill();
  }
  // 舌头
  const tx = hx + fwd.x * cell * 0.42, ty = hy + fwd.y * cell * 0.42;
  const flick = Math.sin(clock * 8) > 0 ? cell * 0.10 : cell * 0.02;
  ctx.strokeStyle = '#E0533A';
  ctx.lineWidth = cell * 0.06;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + fwd.x * flick, ty + fwd.y * flick);
  ctx.moveTo(tx + fwd.x * flick, ty + fwd.y * flick);
  ctx.lineTo(tx + fwd.x * flick + perp.x * cell * 0.06, ty + fwd.y * flick + perp.y * cell * 0.06);
  ctx.moveTo(tx + fwd.x * flick, ty + fwd.y * flick);
  ctx.lineTo(tx + fwd.x * flick - perp.x * cell * 0.06, ty + fwd.y * flick - perp.y * cell * 0.06);
  ctx.stroke();
}

// ------------------------------------------------------------------ 食物
function drawFood(ctx, state, L, clock) {
  const { cell, gridX, gridY } = L;
  for (const f of state.food) {
    const cx = gridX + f.c * cell + cell / 2;
    const cy = gridY + f.r * cell + cell / 2;
    const pulse = 0.5 + 0.5 * Math.sin(clock * 4);
    // 目标光环
    ctx.strokeStyle = `rgba(255,233,160,${0.5 + 0.4 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, cell * (0.34 + 0.06 * pulse), 0, Math.PI * 2); ctx.stroke();

    if (f.type === 'beetle') drawBeetle(ctx, cx, cy, cell);
    else if (f.type === 'scorpion') drawScorpion(ctx, cx, cy, cell);
    else drawThorn(ctx, cx, cy, cell);
  }
}

function drawBeetle(ctx, cx, cy, cell) {
  const s = cell / 60;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = '#2E1A0A';
  ctx.beginPath(); ctx.ellipse(0, 0, 17, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8A5A2E'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 16); ctx.stroke();
  // 腿
  ctx.strokeStyle = '#2E1A0A'; ctx.lineWidth = 2;
  for (const [dx, dy] of [[-16, -8], [16, -8], [-18, 2], [18, 2], [-16, 10], [16, 10]]) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx, dy); ctx.stroke();
  }
  // 触角
  ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(-12, -30); ctx.moveTo(4, -18); ctx.lineTo(12, -30); ctx.stroke();
  ctx.restore();
}

function drawScorpion(ctx, cx, cy, cell) {
  const s = cell / 60;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = '#E0533A';
  ctx.beginPath(); ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
  // 尾（向后卷）
  ctx.strokeStyle = '#C2382A'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 10); ctx.quadraticCurveTo(6, 20, 0, 28); ctx.quadraticCurveTo(-6, 34, -2, 40); ctx.stroke();
  ctx.fillStyle = '#8E1F16';
  ctx.beginPath(); ctx.arc(-2, 40, 4, 0, Math.PI * 2); ctx.fill();
  // 钳
  ctx.strokeStyle = '#C2382A'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(-28, -12); ctx.moveTo(-14, 4); ctx.lineTo(-26, 6); ctx.stroke();
  ctx.restore();
}

function drawThorn(ctx, cx, cy, cell) {
  const s = cell / 60;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.strokeStyle = '#7FBF4D'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, -22); ctx.stroke();
  // 尖刺
  for (const [dx, dy] of [[-8, -14], [8, -18], [-12, 2], [12, -2]]) {
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(dx, dy); ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ 特效
function drawFx(ctx, view, L, clock) {
  if (!view || !view.fxQueue) return;
  for (const fx of view.fxQueue) {
    if (fx.type === 'sandBurst') {
      const a = Math.max(0, fx.ttl / 0.4);
      const cx = L.gridX + fx.c * L.cell + L.cell / 2;
      const cy = L.gridY + fx.r * L.cell + L.cell / 2;
      for (let i = 0; i < 8; i += 1) {
        const ang = (i / 8) * Math.PI * 2 + (fx.seed || 0);
        const d = (1 - a) * L.cell * 0.8;
        ctx.fillStyle = `rgba(255,226,150,${a})`;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, L.cell * 0.06 * a + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (fx.type === 'speedLines') {
      const a = Math.max(0, fx.ttl / 0.5);
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.6})`;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i += 1) {
        const y = WORLD.HEIGHT * (0.1 + 0.14 * i);
        ctx.beginPath();
        ctx.moveTo(WORLD.WIDTH * 0.1, y);
        ctx.lineTo(WORLD.WIDTH * 0.9 - (1 - a) * 200, y - 20);
        ctx.stroke();
      }
    }
  }
}

// ------------------------------------------------------------------ 沙暴
function drawSandstorm(ctx, clock) {
  ctx.fillStyle = 'rgba(210,168,95,0.30)';
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  ctx.fillStyle = 'rgba(196,146,74,0.5)';
  for (let i = 0; i < 24; i += 1) {
    const y = seededRand(i, 1, 13) * WORLD.HEIGHT;
    const x = ((seededRand(i, 3, 17) * WORLD.WIDTH + clock * 320) % (WORLD.WIDTH + 120)) - 60;
    ctx.beginPath();
    ctx.ellipse(x, y, 70 + seededRand(i, 5, 9) * 30, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ 布局
function computeLayout(state) {
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const gridAreaW = W - LAYOUT.MARGIN_X * 2 - LAYOUT.SIDE_W - LAYOUT.SIDE_GAP;
  const gridAreaH = H - LAYOUT.HUD_H - LAYOUT.MARGIN_Y * 2;
  const { rows, cols } = state;
  const cell = Math.min(gridAreaW / cols, gridAreaH / rows, LAYOUT.CELL_MAX);
  const gridW = cell * cols, gridH = cell * rows;
  const gridX = LAYOUT.MARGIN_X + Math.floor((gridAreaW - gridW) / 2);
  const gridY = LAYOUT.HUD_H + LAYOUT.MARGIN_Y + Math.floor((gridAreaH - gridH) / 2);
  const sideX = W - LAYOUT.MARGIN_X - LAYOUT.SIDE_W;
  const sideY = HUD_Y();
  const sideH = H - sideY - LAYOUT.MARGIN_Y;
  return { cell, gridX, gridY, gridW, gridH, sideX, sideY, sideW: LAYOUT.SIDE_W, sideH, hudH: LAYOUT.HUD_H };
}

function HUD_Y() { return LAYOUT.HUD_H; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;
  let trail = [];
  let lastHeadKey = null;

  function resize(w, h) {
    return { w, h, world: { width: WORLD.WIDTH, height: WORLD.HEIGHT } };
  }

  function debugLayout() {
    if (!lastState) return null;
    const L = computeLayout(lastState);
    return {
      grid: { x: L.gridX, y: L.gridY, w: L.gridW, h: L.gridH },
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: L.hudH },
      side: { x: L.sideX, y: L.sideY, w: L.sideW, h: L.sideH },
      cell: L.cell,
    };
  }

  function drawTitleSerpent() {
    const pts = [];
    const N = 22;
    for (let i = 0; i <= N; i += 1) {
      const t = i / N;
      pts.push([200 + t * 880, 560 + Math.sin(t * Math.PI * 2) * 70 - t * 30]);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = BODY_OUTLINE;
    ctx.lineWidth = 66;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = BODY_MAIN;
    ctx.lineWidth = 48;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,217,122,0.5)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    // 头
    const [hx, hy] = pts[pts.length - 1];
    ctx.fillStyle = BODY_OUTLINE;
    ctx.beginPath(); ctx.arc(hx, hy, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HEAD_MAIN;
    ctx.beginPath(); ctx.arc(hx, hy, 32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx + 10, hy - 10, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1A0E04';
    ctx.beginPath(); ctx.arc(hx + 12, hy - 10, 4, 0, Math.PI * 2); ctx.fill();
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('dunes'), 0, 0);
    drawTitleSerpent();
  }

  function draw(state, dt, view) {
    if (!state || !state.grid) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.sceneKey || v.sceneKey || 'dunes';
    clock += dt || 0;
    lastState = state;

    const L = computeLayout(state);

    // 流沙波纹轨迹
    const head = state.snake[0];
    const headKey = head ? `${head.r},${head.c}` : null;
    if (headKey && headKey !== lastHeadKey) {
      trail.push({ r: head.r, c: head.c, age: 0 });
      lastHeadKey = headKey;
    }
    for (const t of trail) t.age += (dt || 0);
    trail = trail.filter((t) => t.age < 1.4);

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);
    drawGridBase(ctx, state, L, sceneKey);
    drawRippleTrail(ctx, trail, L);
    drawFood(ctx, state, L, clock);
    drawSnake(ctx, state, L, clock);
    drawFx(ctx, v, L, clock);
    if (state.sandActive) drawSandstorm(ctx, clock);

    ctx.restore();
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize };
}
