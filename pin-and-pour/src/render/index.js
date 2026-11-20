// Canvas 2D 渲染：PIN & POUR 蜜糖工坊分装台。
// 只消费 run.state + view（hoverCell/cursor/fxQueue/shake/sceneKey）。
// 像素换算全部在此完成（sim 只给 r,c）。契约 API：createRenderer(canvas) → { draw, debugLayout, resize }。
import { WORLD, LAYOUT } from '../../config/game.config.js';

const SCENE_PALETTES = {
  'dawn-apiary': {
    skyTop: '#FFF0C0', skyMid: '#F7C978', skyBot: '#E3A95C',
    ground: '#8FB95C', groundDark: '#6E9A48',
    frame: '#8A5A2B', frameDark: '#5C3A18', frameHi: '#C08A4E',
    wall: '#7A4E2A', wallDark: '#553518',
    comb: '#E8A33D', combDark: '#C07C22',
    glow: 'rgba(255,214,110,0.5)',
    accent: '#F2B84B',
  },
  'noon-workshop': {
    skyTop: '#F2C078', skyMid: '#D89A4A', skyBot: '#A8662E',
    ground: '#7A4E2A', groundDark: '#5C3A18',
    frame: '#6E4A2A', frameDark: '#4A3016', frameHi: '#9A6A3A',
    wall: '#5C3A22', wallDark: '#402A14',
    comb: '#D98A2E', combDark: '#B06A1A',
    glow: 'rgba(255,190,90,0.45)',
    accent: '#E89A3C',
  },
  'dusk-cellar': {
    skyTop: '#2A2140', skyMid: '#3A2A55', skyBot: '#1C1430',
    ground: '#241A34', groundDark: '#180F24',
    frame: '#4A3358', frameDark: '#2C1E38', frameHi: '#6A4E78',
    wall: '#3A2A50', wallDark: '#281C3A',
    comb: '#C08030', combDark: '#8A5A20',
    glow: 'rgba(255,200,90,0.4)',
    accent: '#FFC94D',
  },
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
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['dawn-apiary'];
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'dusk-cellar') {
    drawStars(g);
    drawMoon(g);
  } else if (sceneKey === 'noon-workshop') {
    drawWorkshop(g, P);
  } else {
    drawApiary(g, P);
  }

  g.fillStyle = P.ground;
  g.fillRect(0, H * 0.7, W, H * 0.3);
  const grd = g.createLinearGradient(0, H * 0.7, 0, H);
  grd.addColorStop(0, P.ground);
  grd.addColorStop(1, P.groundDark);
  g.fillStyle = grd;
  g.fillRect(0, H * 0.7, W, H * 0.3);
}

function drawStars(g) {
  for (let i = 0; i < 70; i += 1) {
    const x = ((i * 7919) % 1000) / 1000 * WORLD.WIDTH;
    const y = ((i * 104729) % 500) / 1000 * WORLD.HEIGHT * 0.6;
    g.fillStyle = `rgba(220,230,255,${0.3 + ((i * 31) % 10) / 16})`;
    g.beginPath();
    g.arc(x, y, 0.7 + ((i * 13) % 14) / 10, 0, Math.PI * 2);
    g.fill();
  }
}

function drawMoon(g) {
  const gx = WORLD.WIDTH - 180, gy = 120, r = 40;
  const halo = g.createRadialGradient(gx, gy, r * 0.5, gx, gy, r * 2.6);
  halo.addColorStop(0, 'rgba(255,214,150,0.4)');
  halo.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(gx, gy, r * 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#F5E3C0';
  g.beginPath(); g.arc(gx, gy, r, 0, Math.PI * 2); g.fill();
}

function drawApiary(g, P) {
  // 蜂箱与花朵只放在左右两侧，避免挡在分装台后面
  const boxes = [[30, 460], [1140, 470]];
  for (const [x, y] of boxes) {
    g.fillStyle = 'rgba(170,112,56,0.5)';
    g.fillRect(x, y, 100, 56);
    g.fillRect(x - 10, y - 30, 120, 36);
    g.fillStyle = 'rgba(110,72,38,0.5)';
    for (let k = 0; k < 4; k += 1) g.fillRect(x + 8 + k * 22, y + 8, 12, 40);
  }
  for (let i = 0; i < 14; i += 1) {
    const x = 30 + i * 92;
    const y = 640 + ((i * 37) % 5) * 7;
    g.fillStyle = i % 2 ? 'rgba(232,179,58,0.8)' : 'rgba(242,231,192,0.8)';
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
  }
}

function drawWorkshop(g, P) {
  // 木桶只放两侧
  const barrels = [[40, 470], [1120, 470]];
  for (const [x, y] of barrels) {
    g.fillStyle = 'rgba(120,75,40,0.55)';
    g.fillRect(x, y, 90, 120);
    g.strokeStyle = 'rgba(70,42,22,0.75)';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(x, y + 24); g.lineTo(x + 90, y + 24); g.stroke();
    g.beginPath(); g.moveTo(x, y + 60); g.lineTo(x + 90, y + 60); g.stroke();
  }
  // 底部木地板横纹
  for (let i = 0; i < 7; i += 1) {
    g.strokeStyle = 'rgba(60,36,18,0.4)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 610 + i * 16); g.lineTo(WORLD.WIDTH, 610 + i * 16); g.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- 布局 ----
function computeLayout(state) {
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const areaW = W - LAYOUT.MARGIN_X * 2;
  const areaH = H - LAYOUT.HUD_H - LAYOUT.MARGIN_Y * 2;
  const { rows, cols } = state;
  const cell = Math.min(areaW / cols, areaH / rows, LAYOUT.CELL_MAX);
  const gridW = cell * cols, gridH = cell * rows;
  const gridX = LAYOUT.MARGIN_X + Math.floor((areaW - gridW) / 2);
  const gridY = LAYOUT.HUD_H + LAYOUT.MARGIN_Y + Math.floor((areaH - gridH) / 2);
  return { cell, gridX, gridY, gridW, gridH, hudH: LAYOUT.HUD_H };
}

function cellRect(L, r, c) {
  return { x: L.gridX + c * L.cell, y: L.gridY + r * L.cell, w: L.cell, h: L.cell };
}

// ---- 绘制单个格子 ----
function drawCell(ctx, state, L, r, c, kind, clock, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['dawn-apiary'];
  const { x, y, w, h } = cellRect(L, r, c);
  const cx = x + w / 2, cy = y + h / 2;
  const inset = w * 0.06;

  if (kind === 'wall') {
    ctx.fillStyle = P.wall;
    roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, w * 0.12);
    ctx.fill();
    ctx.strokeStyle = P.wallDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(x + inset, y + h * 0.4); ctx.lineTo(x + w - inset, y + h * 0.4); ctx.stroke();
    return;
  }

  if (kind === 'gate') {
    // 木闸板：横条 + 把手
    ctx.fillStyle = P.frameDark;
    roundRect(ctx, x + inset, y + h * 0.34, w - inset * 2, h * 0.32, h * 0.1);
    ctx.fill();
    ctx.fillStyle = P.frame;
    roundRect(ctx, x + inset, y + h * 0.38, w - inset * 2, h * 0.24, h * 0.08);
    ctx.fill();
    ctx.fillStyle = P.frameHi;
    ctx.beginPath(); ctx.arc(cx, cy, w * 0.1, 0, Math.PI * 2); ctx.fill();
    return;
  }

  if (kind === 'comb') {
    // 蜂巢块（六边形）
    ctx.fillStyle = P.combDark;
    drawHex(ctx, cx, cy + 2, w * 0.4);
    ctx.fillStyle = P.comb;
    drawHex(ctx, cx, cy, w * 0.4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    drawHex(ctx, cx, cy, w * 0.4);
    ctx.stroke();
    return;
  }

  if (kind === 'screen') {
    // 滤网
    ctx.fillStyle = 'rgba(120,140,160,0.18)';
    roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, w * 0.1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,220,240,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 1; i <= 3; i += 1) {
      ctx.moveTo(x + inset, y + inset + i * (h - inset * 2) / 4);
      ctx.lineTo(x + w - inset, y + inset + i * (h - inset * 2) / 4);
      ctx.moveTo(x + inset + i * (w - inset * 2) / 4, y + inset);
      ctx.lineTo(x + inset + i * (w - inset * 2) / 4, y + h - inset);
    }
    ctx.stroke();
    return;
  }

  if (kind === 'bottle') {
    drawBottle(ctx, cx, cy, w, clock);
    return;
  }

  if (kind === 'drain') {
    // 深色排口格栅 + 气泡标记（「气泡要进这里」）
    ctx.fillStyle = '#1E1424';
    roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, w * 0.1);
    ctx.fill();
    ctx.strokeStyle = '#5A4468';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i <= 3; i += 1) {
      ctx.moveTo(x + inset, y + inset + i * (h - inset * 2) / 4);
      ctx.lineTo(x + w - inset, y + inset + i * (h - inset * 2) / 4);
    }
    ctx.stroke();
    // 中央一枚小气泡（紫色半透明圆）
    const bob = Math.sin((clock || 0) * 3.5) * 1.2;
    ctx.fillStyle = 'rgba(160,90,220,0.55)';
    ctx.beginPath(); ctx.arc(cx, cy + bob, w * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(220,190,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy + bob, w * 0.16, 0, Math.PI * 2); ctx.stroke();
    return;
  }

  // empty：淡色内格底 + 细描边，让网格结构清晰
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, w * 0.1);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, w * 0.1);
  ctx.stroke();
}

function drawHex(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawBottle(ctx, cx, cy, cell, clock) {
  const w = cell * 0.72, h = cell * 0.82;
  const bx = cx - w / 2, by = cy - h / 2 + cell * 0.06;
  const neck = cell * 0.16;
  const pulse = 0.5 + 0.5 * Math.sin((clock || 0) * 3.4);

  // 目标光环（金色脉冲环，一眼看出「蜂蜜要进这里」）
  ctx.strokeStyle = `rgba(255,216,78,${0.55 + 0.4 * pulse})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, cell * (0.44 + 0.06 * pulse), 0, Math.PI * 2); ctx.stroke();
  // 上方金色下箭头
  const ay = cy - cell * 0.46;
  ctx.fillStyle = '#FFD84E';
  ctx.beginPath();
  ctx.moveTo(cx, ay + cell * 0.1);
  ctx.lineTo(cx - cell * 0.1, ay - cell * 0.06);
  ctx.lineTo(cx + cell * 0.1, ay - cell * 0.06);
  ctx.closePath(); ctx.fill();

  // 玻璃瓶身
  ctx.fillStyle = 'rgba(210,240,238,0.24)';
  roundRect(ctx, bx, by + neck, w, h - neck, cell * 0.14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(210,240,238,0.85)';
  ctx.lineWidth = 2.5;
  roundRect(ctx, bx, by + neck, w, h - neck, cell * 0.14);
  ctx.stroke();
  // 瓶颈
  ctx.strokeStyle = 'rgba(210,240,238,0.85)';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.18, by + neck);
  ctx.lineTo(cx - w * 0.12, by);
  ctx.lineTo(cx + w * 0.12, by);
  ctx.lineTo(cx + w * 0.18, by + neck);
  ctx.stroke();
  // 琥珀光（目标标记：金色内芯）
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, cell * 0.5);
  glow.addColorStop(0, `rgba(255,214,110,${0.5 + 0.3 * pulse})`);
  glow.addColorStop(1, 'rgba(255,190,80,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, cell * 0.5, 0, Math.PI * 2); ctx.fill();
  // 瓶内一滴蜂蜜
  ctx.fillStyle = '#F5B31A';
  ctx.beginPath(); ctx.arc(cx, cy + cell * 0.02, cell * 0.16, 0, Math.PI * 2); ctx.fill();
}

// ---- 目标图例（顶部，明确「蜂蜜→瓶」「气泡→排口」）----
function drawLegend(ctx, state, L) {
  const honey = state.totalHoney > 0;
  const bubble = state.totalBubble > 0;
  if (!honey && !bubble) return;
  const items = [];
  if (honey) items.push({ label: 'HONEY', color: '#F5B31A', kind: 'honey' });
  if (bubble) items.push({ label: 'BUBBLES', color: '#B06FE0', kind: 'bubble' });
  const chipW = 190;
  const chipH = 34;
  const gap = 18;
  const totalW = items.length * chipW + (items.length - 1) * gap;
  let x = L.gridX + L.gridW / 2 - totalW / 2;
  const y = L.gridY - 44;

  for (const it of items) {
    ctx.fillStyle = 'rgba(18,10,4,0.82)';
    roundRect(ctx, x, y, chipW, chipH, chipH / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,216,120,0.4)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, chipW, chipH, chipH / 2);
    ctx.stroke();

    const cy = y + chipH / 2;
    // 图标
    if (it.kind === 'honey') {
      ctx.fillStyle = it.color;
      ctx.beginPath(); ctx.arc(x + 20, cy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,190,0.9)';
      ctx.beginPath(); ctx.arc(x + 18, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(160,90,220,0.7)';
      ctx.beginPath(); ctx.arc(x + 20, cy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(220,190,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + 20, cy, 8, 0, Math.PI * 2); ctx.stroke();
    }
    // 文字
    ctx.fillStyle = '#FFE9B4';
    ctx.font = '800 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.label, x + 34, cy);
    // 箭头
    ctx.strokeStyle = 'rgba(255,233,180,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + chipW - 52, cy); ctx.lineTo(x + chipW - 34, cy); ctx.stroke();
    ctx.fillStyle = '#FFE9B4';
    ctx.beginPath();
    ctx.moveTo(x + chipW - 30, cy);
    ctx.lineTo(x + chipW - 40, cy - 5);
    ctx.lineTo(x + chipW - 40, cy + 5);
    ctx.closePath(); ctx.fill();
    // 目标小图标
    if (it.kind === 'honey') {
      ctx.strokeStyle = 'rgba(210,240,238,0.9)';
      ctx.lineWidth = 2;
      roundRect(ctx, x + chipW - 26, cy - 8, 16, 16, 3);
      ctx.stroke();
      ctx.fillStyle = '#F5B31A';
      ctx.beginPath(); ctx.arc(x + chipW - 18, cy, 4, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#1E1424';
      roundRect(ctx, x + chipW - 26, cy - 8, 16, 16, 3);
      ctx.fill();
      ctx.strokeStyle = '#5A4468';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + chipW - 26, cy - 3); ctx.lineTo(x + chipW - 10, cy - 3);
      ctx.moveTo(x + chipW - 26, cy + 3); ctx.lineTo(x + chipW - 10, cy + 3);
      ctx.stroke();
    }
    x += chipW + gap;
  }
}

// ---- 珠子 ----
function drawBeads(ctx, state, L, clock) {
  const beads = state.beads;
  // 先画蜂蜜拉丝连线（相邻蜂蜜珠之间）
  for (const b of beads) {
    if (b.done || b.type !== 'honey') continue;
    // 找下方相邻格的蜂蜜珠（同列 r+1）
    const below = beads.find((x) => !x.done && x.type === 'honey' && x.c === b.c && x.r === b.r + 1);
    if (below) {
      const a = cellRect(L, b.r, b.c);
      const c2 = cellRect(L, below.r, below.c);
      const x = a.x + a.w / 2;
      const y1 = a.y + a.h / 2;
      const y2 = c2.y + c2.h / 2;
      ctx.strokeStyle = 'rgba(245,179,26,0.7)';
      ctx.lineWidth = L.cell * 0.16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.quadraticCurveTo(x + L.cell * 0.06, (y1 + y2) / 2, x, y2);
      ctx.stroke();
    }
  }

  for (const b of beads) {
    if (b.done) continue;
    const { x, y, w, h } = cellRect(L, b.r, b.c);
    const cx = x + w / 2, cy = y + h / 2;
    const r = w * 0.34;
    if (b.type === 'honey') {
      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2);
      glow.addColorStop(0, 'rgba(255,214,110,0.55)');
      glow.addColorStop(1, 'rgba(255,190,80,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, r * 2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#C97E12';
      ctx.beginPath(); ctx.arc(cx, cy + 2, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F5B31A';
      ctx.beginPath(); ctx.arc(cx, cy - 1, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,190,0.9)';
      ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.32, 0, Math.PI * 2); ctx.fill();
    } else {
      // 气泡
      const bob = Math.sin((clock || 0) * 4 + b.id.charCodeAt(1)) * 1.5;
      ctx.fillStyle = 'rgba(160,90,220,0.5)';
      ctx.beginPath(); ctx.arc(cx, cy + bob, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(220,190,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy + bob, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.3 + bob, r * 0.22, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;

  function debugLayout() {
    if (!lastState) return null;
    const L = computeLayout(lastState);
    const out = {
      grid: { x: L.gridX, y: L.gridY, w: L.gridW, h: L.gridH },
      cell: L.cell,
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: L.hudH },
      gate: null,
      bottle: null,
      drain: null,
    };
    const gates = lastState.gates.filter((g) => !g.pulled);
    if (gates.length) {
      const r = cellRect(L, gates[0].r, gates[0].c);
      out.gate = r;
    }
    for (let rr = 0; rr < lastState.rows && !out.bottle; rr += 1) {
      for (let cc = 0; cc < lastState.cols && !out.bottle; cc += 1) {
        if (lastState.grid[rr][cc].kind === 'bottle') out.bottle = cellRect(L, rr, cc);
      }
    }
    for (let rr = 0; rr < lastState.rows && !out.drain; rr += 1) {
      for (let cc = 0; cc < lastState.cols && !out.drain; cc += 1) {
        if (lastState.grid[rr][cc].kind === 'drain') out.drain = cellRect(L, rr, cc);
      }
    }
    return out;
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('dawn-apiary'), 0, 0);
    // 中央一瓶蜂蜜
    drawBottle(ctx, WORLD.WIDTH / 2, WORLD.HEIGHT / 2 + 60, 130, clock);
    drawHoneyBlob(ctx, WORLD.WIDTH / 2, WORLD.HEIGHT / 2 - 30, 60, clock);
  }

  function drawHoneyBlob(ctx, cx, cy, r, clock) {
    const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.2);
    glow.addColorStop(0, 'rgba(255,214,110,0.6)');
    glow.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F5B31A';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,190,0.9)';
    ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
  }

  function draw(state, dt, view) {
    if (!state || !state.grid) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.sceneKey || v.sceneKey || 'dawn-apiary';
    clock += dt || 0;
    lastState = state;

    const L = computeLayout(state);

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }
    ctx.drawImage(getBackground(sceneKey), 0, 0);

    // 容器内壁：不透明底板，把背景装饰挡在后面，让可交互区一眼可辨
    const P = SCENE_PALETTES[sceneKey];
    ctx.fillStyle = '#241808';
    roundRect(ctx, L.gridX - 8, L.gridY - 8, L.gridW + 16, L.gridH + 16, 12);
    ctx.fill();
    // 容器木框
    ctx.strokeStyle = P.frameHi;
    ctx.lineWidth = 4;
    roundRect(ctx, L.gridX - 8, L.gridY - 8, L.gridW + 16, L.gridH + 16, 12);
    ctx.stroke();
    ctx.strokeStyle = P.frameDark;
    ctx.lineWidth = 2;
    roundRect(ctx, L.gridX - 14, L.gridY - 14, L.gridW + 28, L.gridH + 28, 18);
    ctx.stroke();

    drawLegend(ctx, state, L);

    // 格子
    for (let r = 0; r < state.rows; r += 1) {
      for (let c = 0; c < state.cols; c += 1) {
        drawCell(ctx, state, L, r, c, state.grid[r][c].kind, clock, sceneKey);
      }
    }

    drawBeads(ctx, state, L, clock);

    // hover 高亮（闸板）
    if (v.hoverGate && state.gates.some((g) => g.id === v.hoverGate && !g.pulled)) {
      const g = state.gates.find((x) => x.id === v.hoverGate);
      const { x, y, w, h } = cellRect(L, g.r, g.c);
      ctx.strokeStyle = 'rgba(255,216,120,0.95)';
      ctx.lineWidth = 3;
      roundRect(ctx, x + 2, y + 2, w - 4, h - 4, w * 0.12);
      ctx.stroke();
    }

    ctx.restore();
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize: (w, h) => ({ w, h, world: { width: WORLD.WIDTH, height: WORLD.HEIGHT } }) };
}
