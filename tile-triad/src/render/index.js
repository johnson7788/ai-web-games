// TILE TRIAD · Canvas 2D 渲染：三场景集市背景 / 12 类货品牌 / 收槽 / 掌柜小猫 / 香料烟尘。
// 只消费 run.state（契约 §3.4）+ view（hoverStack/catPulse/shake/particles）。
// 像素换算全部在此完成（sim 只给 stackId / col / row / slot 品类）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), spawnDust(x,y,color) }。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { tileIsFree } from '../game/board.js';

const SCENES = {
  'dawn-market': {
    skyTop: '#FFE9B4', skyMid: '#F6D79A', skyBot: '#EAC188',
    awningA: '#E8833A', awningB: '#F5E6D0',
    counter: '#8A5A38', counterDark: '#6B4226', counterLight: '#A97A52',
    glow: 'rgba(255,224,150,0.6)',
    night: false,
  },
  'afternoon-market': {
    skyTop: '#8FCBE8', skyMid: '#B9E0F0', skyBot: '#E8F2E0',
    awningA: '#E0537A', awningB: '#FFE9B4',
    counter: '#9A6238', counterDark: '#7A4A28', counterLight: '#C08850',
    glow: 'rgba(255,235,150,0.5)',
    night: false,
  },
  'night-market': {
    skyTop: '#0E1B3A', skyMid: '#1B2A52', skyBot: '#2A1E4A',
    awningA: '#B8324C', awningB: '#E8833A',
    counter: '#5A3A24', counterDark: '#3E2818', counterLight: '#7A5232',
    glow: 'rgba(255,150,80,0.4)',
    night: true,
  },
};

// 12 类货品：形状 + 颜色双编码（色盲可辨）
function drawIcon(g, type, cx, cy, s) {
  g.save();
  g.translate(cx, cy);
  g.lineWidth = Math.max(1.5, s * 0.08);
  switch (type) {
    case 0: { // 香料罐：高罐 + 盖
      g.fillStyle = '#C2472A';
      roundRect(g, -s * 0.5, -s * 0.25, s, s * 1.05, s * 0.18); g.fill();
      g.fillStyle = '#7A2A16';
      roundRect(g, -s * 0.34, -s * 0.52, s * 0.68, s * 0.3, s * 0.1); g.fill();
      g.fillStyle = '#F5E6D0';
      g.fillRect(-s * 0.5, s * 0.15, s, s * 0.22);
      break;
    }
    case 1: { // 干花束：扇形花头 + 茎
      g.strokeStyle = '#4E7A3A'; g.lineWidth = Math.max(1.5, s * 0.1);
      g.beginPath();
      for (let i = -1; i <= 1; i += 1) { g.moveTo(0, s * 0.9); g.lineTo(i * s * 0.42, -s * 0.1); }
      g.stroke();
      g.fillStyle = '#8A6BC4';
      for (let i = -1; i <= 1; i += 1) { g.beginPath(); g.arc(i * s * 0.42, -s * 0.24, s * 0.3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#5E3F9E';
      g.beginPath(); g.arc(0, -s * 0.5, s * 0.28, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#C9A24C'; g.lineWidth = s * 0.16;
      g.beginPath(); g.moveTo(-s * 0.4, s * 0.6); g.lineTo(s * 0.4, s * 0.9); g.stroke();
      break;
    }
    case 2: { // 果篮：篮身 + 提手 + 圆果
      g.strokeStyle = '#8A5A2A'; g.lineWidth = s * 0.14;
      g.beginPath(); g.arc(0, -s * 0.1, s * 0.62, Math.PI, 0); g.stroke();
      g.fillStyle = '#C98A3C';
      g.beginPath(); g.moveTo(-s * 0.55, -s * 0.1); g.lineTo(-s * 0.4, s * 0.7); g.lineTo(s * 0.4, s * 0.7); g.lineTo(s * 0.55, -s * 0.1); g.closePath(); g.fill();
      g.fillStyle = '#E0537A'; g.beginPath(); g.arc(-s * 0.2, -s * 0.35, s * 0.26, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#FFD84E'; g.beginPath(); g.arc(s * 0.22, -s * 0.4, s * 0.24, 0, Math.PI * 2); g.fill();
      break;
    }
    case 3: { // 蘑菇：伞盖 + 柄 + 斑点
      g.fillStyle = '#E8D9C8';
      roundRect(g, -s * 0.16, s * 0.05, s * 0.32, s * 0.6, s * 0.12); g.fill();
      g.fillStyle = '#C2472A';
      g.beginPath(); g.arc(0, -s * 0.05, s * 0.66, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = '#F5E6D0';
      g.beginPath(); g.arc(-s * 0.24, -s * 0.28, s * 0.12, 0, Math.PI * 2); g.arc(s * 0.22, -s * 0.2, s * 0.1, 0, Math.PI * 2); g.fill();
      break;
    }
    case 4: { // 葫芦：双球 + 蒂
      g.fillStyle = '#6E8F4E';
      g.beginPath(); g.arc(0, -s * 0.32, s * 0.34, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(0, s * 0.28, s * 0.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#4E6A36'; g.lineWidth = s * 0.1;
      g.beginPath(); g.moveTo(0, -s * 0.66); g.quadraticCurveTo(s * 0.1, -s * 0.8, 0, -s * 0.9); g.stroke();
      break;
    }
    case 5: { // 香草捆：竖捆 + 系带 + 叶尖
      g.fillStyle = '#5E8A46';
      roundRect(g, -s * 0.4, -s * 0.7, s * 0.8, s * 1.5, s * 0.14); g.fill();
      g.fillStyle = '#3E5E2E';
      for (let i = -1; i <= 1; i += 1) { g.beginPath(); g.moveTo(i * s * 0.2, -s * 0.7); g.lineTo(i * s * 0.4, -s * 0.98); g.lineTo(i * s * 0.12, -s * 0.66); g.closePath(); g.fill(); }
      g.fillStyle = '#C9A24C';
      g.fillRect(-s * 0.42, s * 0.1, s * 0.84, s * 0.22);
      break;
    }
    case 6: { // 蜡烛：柱 + 芯 + 火苗
      g.fillStyle = '#F0C860';
      roundRect(g, -s * 0.26, -s * 0.6, s * 0.52, s * 1.3, s * 0.1); g.fill();
      g.strokeStyle = '#B8933C'; g.lineWidth = s * 0.08;
      g.beginPath(); g.moveTo(0, -s * 0.62); g.lineTo(0, -s * 0.78); g.stroke();
      g.fillStyle = '#FF8A2E';
      g.beginPath(); g.ellipse(0, -s * 0.86, s * 0.14, s * 0.24, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 7: { // 茶饼：圆饼 + 内环 + 叶印
      g.fillStyle = '#8A5A34';
      g.beginPath(); g.arc(0, 0, s * 0.68, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#5E3A1E'; g.lineWidth = s * 0.1;
      g.beginPath(); g.arc(0, 0, s * 0.42, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#3E2A14';
      g.beginPath(); g.ellipse(0, 0, s * 0.16, s * 0.3, 0.5, 0, Math.PI * 2); g.fill();
      break;
    }
    case 8: { // 蜜罐：圆罐 + 口沿 + 勺柄
      g.fillStyle = '#E8A93C';
      g.beginPath(); g.arc(0, s * 0.1, s * 0.58, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#C98A2A';
      roundRect(g, -s * 0.34, -s * 0.6, s * 0.68, s * 0.28, s * 0.08); g.fill();
      g.strokeStyle = '#A96E1E'; g.lineWidth = s * 0.1;
      g.beginPath(); g.moveTo(s * 0.4, s * 0.1); g.lineTo(s * 0.7, -s * 0.5); g.stroke();
      break;
    }
    case 9: { // 干鱼：鱼身 + 尾 + 眼
      g.fillStyle = '#7FA8C8';
      g.beginPath(); g.ellipse(0, 0, s * 0.62, s * 0.38, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5E88A8';
      g.beginPath(); g.moveTo(-s * 0.6, 0); g.lineTo(-s * 0.98, -s * 0.4); g.lineTo(-s * 0.98, s * 0.4); g.closePath(); g.fill();
      g.fillStyle = '#1E3A4E'; g.beginPath(); g.arc(s * 0.34, -s * 0.08, s * 0.09, 0, Math.PI * 2); g.fill();
      break;
    }
    case 10: { // 灯笼：圆笼 + 肋条 + 流苏
      g.fillStyle = '#C2472A';
      g.beginPath(); g.ellipse(0, 0, s * 0.56, s * 0.66, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#7A2A16'; g.lineWidth = s * 0.06;
      for (let i = -1; i <= 1; i += 1) { g.beginPath(); g.moveTo(0, -s * 0.66); g.quadraticCurveTo(i * s * 0.4, 0, 0, s * 0.66); g.stroke(); }
      g.fillStyle = '#FFD84E';
      g.fillRect(-s * 0.16, -s * 0.82, s * 0.32, s * 0.16);
      g.strokeStyle = '#E0537A'; g.lineWidth = s * 0.08;
      g.beginPath(); g.moveTo(0, s * 0.66); g.lineTo(0, s * 0.98); g.stroke();
      break;
    }
    case 11: { // 钱袋：袋身 + 扎口 + 钱点
      g.fillStyle = '#2E9E8A';
      g.beginPath(); g.moveTo(0, -s * 0.7); g.quadraticCurveTo(s * 0.66, -s * 0.15, s * 0.5, s * 0.7); g.lineTo(-s * 0.5, s * 0.7); g.quadraticCurveTo(-s * 0.66, -s * 0.15, 0, -s * 0.7); g.closePath(); g.fill();
      g.strokeStyle = '#C9A24C'; g.lineWidth = s * 0.12;
      g.beginPath(); g.moveTo(-s * 0.34, -s * 0.36); g.lineTo(s * 0.34, -s * 0.36); g.stroke();
      g.fillStyle = '#FFE9B4'; g.beginPath(); g.arc(0, s * 0.1, s * 0.12, 0, Math.PI * 2); g.fill();
      break;
    }
    default: {
      g.fillStyle = '#999';
      g.beginPath(); g.arc(0, 0, s * 0.5, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

// ---- 静态背景离屏缓存 ----
const bgCache = new Map();
function getBackground(sceneKey) {
  let c = bgCache.get(sceneKey);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  drawBackground(c.getContext('2d'), SCENES[sceneKey] || SCENES['dawn-market']);
  bgCache.set(sceneKey, c);
  return c;
}

function seededRand(a, b, s) {
  const x = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawBackground(g, P) {
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (P.night) {
    drawLanterns(g, P);
  } else {
    const gx = P === SCENES['afternoon-market'] ? W - 200 : 200;
    const halo = g.createRadialGradient(gx, 150, 20, gx, 150, 300);
    halo.addColorStop(0, P.glow);
    halo.addColorStop(1, 'rgba(255,224,150,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, W, H);
  }

  // 摊位遮阳篷（顶部条纹）
  const awningY = 56;
  for (let i = 0; i < 16; i += 1) {
    g.fillStyle = i % 2 ? P.awningB : P.awningA;
    g.beginPath();
    g.moveTo(i * 80, awningY);
    g.lineTo(i * 80 + 80, awningY);
    g.lineTo(i * 80 + 60, awningY + 34);
    g.lineTo(i * 80 + 20, awningY + 34);
    g.closePath();
    g.fill();
  }

  // 木制台面
  g.fillStyle = P.counter;
  g.fillRect(0, LAYOUT.BOARD_BOTTOM, W, H - LAYOUT.BOARD_BOTTOM);
  const grd = g.createLinearGradient(0, LAYOUT.BOARD_BOTTOM, 0, H);
  grd.addColorStop(0, P.counterLight);
  grd.addColorStop(0.2, P.counter);
  grd.addColorStop(1, P.counterDark);
  g.fillStyle = grd;
  g.fillRect(0, LAYOUT.BOARD_BOTTOM, W, H - LAYOUT.BOARD_BOTTOM);
  g.strokeStyle = P.counterDark;
  g.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    const x = i * 180;
    g.beginPath(); g.moveTo(x, LAYOUT.BOARD_BOTTOM); g.lineTo(x - 20, H); g.stroke();
  }
}

function drawLanterns(g, P) {
  for (let i = 0; i < 10; i += 1) {
    const x = 80 + i * 124;
    const y = 30 + seededRand(i, 1, 3) * 24;
    const halo = g.createRadialGradient(x, y, 4, x, y, 70);
    halo.addColorStop(0, 'rgba(255,180,90,0.55)');
    halo.addColorStop(1, 'rgba(255,180,90,0)');
    g.fillStyle = halo;
    g.fillRect(x - 70, y - 70, 140, 140);
    g.fillStyle = '#C2472A';
    g.beginPath(); g.ellipse(x, y, 16, 20, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FFD84E';
    g.fillRect(x - 6, y - 28, 12, 8);
    g.strokeStyle = '#E0537A'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y + 20); g.lineTo(x, y + 34); g.stroke();
  }
}

// ---- 掌柜小猫（程序化） ----
function drawCat(g, x, y, size, pose, clock) {
  const s = size / 96;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const bounce = pose === 'cheer' ? Math.abs(Math.sin(clock * 8)) * -10 : 0;
  const tailSway = Math.sin(clock * 2.4) * 8;
  g.translate(0, bounce);

  g.fillStyle = '#6E4A36';
  g.beginPath(); g.ellipse(-30, 24 + tailSway * 0.3, 28, 14, -0.5, 0, Math.PI * 2); g.fill();

  g.fillStyle = '#8A6A4E';
  g.beginPath(); g.ellipse(0, 24, 24, 20, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#F0E0CC';
  g.beginPath(); g.ellipse(0, 32, 15, 11, 0, 0, Math.PI * 2); g.fill();

  g.fillStyle = '#8A6A4E';
  g.beginPath(); g.arc(0, -8, 24, 0, Math.PI * 2); g.fill();

  g.fillStyle = '#6E4A36';
  g.beginPath(); g.moveTo(-20, -26); g.lineTo(-26, -50); g.lineTo(-8, -36); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(20, -26); g.lineTo(26, -50); g.lineTo(8, -36); g.closePath(); g.fill();
  g.fillStyle = '#D9A47E';
  g.beginPath(); g.moveTo(-17, -28); g.lineTo(-22, -44); g.lineTo(-11, -35); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(17, -28); g.lineTo(22, -44); g.lineTo(11, -35); g.closePath(); g.fill();

  g.fillStyle = '#F0E0CC';
  g.beginPath(); g.ellipse(0, 2, 15, 12, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3A2412';
  g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2A1A0C';
  g.beginPath(); g.arc(-10, -10, 3.2, 0, Math.PI * 2); g.arc(10, -10, 3.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(-9, -11, 1.1, 0, Math.PI * 2); g.arc(11, -11, 1.1, 0, Math.PI * 2); g.fill();

  // 掌柜围裙
  if (pose === 'cheer') {
    g.fillStyle = '#E0537A';
    g.beginPath(); g.moveTo(-12, 20); g.lineTo(12, 20); g.lineTo(16, 44); g.lineTo(-16, 44); g.closePath(); g.fill();
  }
  g.restore();
}

// ---- 布局计算 ----
function computeLayout(state) {
  const W = WORLD.WIDTH;
  const boardW = W - LAYOUT.BOARD_MARGIN_X * 2;
  const boardH = LAYOUT.BOARD_BOTTOM - LAYOUT.BOARD_TOP;
  const cols = state.stacks && state.stacks.length ? Math.max(...state.stacks.map((s) => s.col)) + 1 : 1;
  const rows = state.stacks && state.stacks.length ? Math.max(...state.stacks.map((s) => s.row)) + 1 : 1;
  const cellW = boardW / cols;
  const cellH = boardH / rows;
  const slotCap = state.slotCap || 7;
  const slotTotalW = slotCap * LAYOUT.SLOT_W + (slotCap - 1) * LAYOUT.SLOT_GAP;
  const slotStartX = (W - slotTotalW) / 2;
  const slotRects = [];
  for (let i = 0; i < slotCap; i += 1) {
    slotRects.push({ x: slotStartX + i * (LAYOUT.SLOT_W + LAYOUT.SLOT_GAP), y: LAYOUT.SLOT_Y - LAYOUT.SLOT_H / 2, w: LAYOUT.SLOT_W, h: LAYOUT.SLOT_H });
  }
  const stackPos = (col, row) => ({
    x: LAYOUT.BOARD_MARGIN_X + (col + 0.5) * cellW,
    y: LAYOUT.BOARD_TOP + (row + 0.5) * cellH,
  });
  return {
    board: { x: LAYOUT.BOARD_MARGIN_X, y: LAYOUT.BOARD_TOP, w: boardW, h: boardH },
    slot: { x: slotStartX, y: LAYOUT.SLOT_Y - LAYOUT.SLOT_H / 2, w: slotTotalW, h: LAYOUT.SLOT_H },
    cellW, cellH, slotRects, stackPos,
  };
}

function drawCard(g, x, y, w, h, type, free, clock) {
  // 牌底
  const lift = free ? -4 : 0;
  const gx = x - w / 2, gy = y - h / 2 + lift;
  // 阴影
  g.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(g, gx + 3, gy + 4, w, h, 10); g.fill();
  if (free) {
    const grad = g.createLinearGradient(gx, gy, gx + w, gy + h);
    grad.addColorStop(0, '#FFF6DE');
    grad.addColorStop(1, '#F0DDB0');
    g.fillStyle = grad;
  } else {
    g.fillStyle = '#8a8a86';
  }
  roundRect(g, gx, gy, w, h, 10); g.fill();
  g.strokeStyle = free ? '#C9A24C' : '#6b6b67';
  g.lineWidth = 2;
  roundRect(g, gx, gy, w, h, 10); g.stroke();

  // 图标
  g.save();
  if (!free) g.filter = 'grayscale(1) brightness(0.85)';
  drawIcon(g, type, x, y + lift, Math.min(w, h) * 0.3);
  g.restore();

  // 遮罩（非自由牌更暗）
  if (!free) {
    g.fillStyle = 'rgba(30,26,22,0.28)';
    roundRect(g, gx, gy, w, h, 10); g.fill();
  }
}

function drawLock(g, x, y) {
  g.fillStyle = '#3A2A18';
  roundRect(g, x - 14, y - 12, 28, 22, 5); g.fill();
  g.strokeStyle = '#3A2A18'; g.lineWidth = 4;
  g.beginPath(); g.arc(x, y - 12, 8, Math.PI, 0); g.stroke();
  g.fillStyle = '#FFD84E';
  g.beginPath(); g.arc(x, y - 2, 3, 0, Math.PI * 2); g.fill();
}

function hitStack(state, px, py) {
  const L = computeLayout(state);
  const freeHits = [];
  let blockedTop = null;
  for (const st of state.stacks) {
    if (!st.tiles.length) continue;
    const i = st.tiles.length - 1;
    const base = L.stackPos(st.col, st.row);
    const jx = seededRand(st.id, i, 7) * LAYOUT.STACK_JITTER * 2 - LAYOUT.STACK_JITTER;
    const ty = base.y - i * LAYOUT.STACK_DY;
    const x = base.x + jx;
    const y = ty;
    if (px < x - LAYOUT.CARD_W / 2 || px > x + LAYOUT.CARD_W / 2) continue;
    if (py < y - LAYOUT.CARD_H / 2 || py > y + LAYOUT.CARD_H / 2) continue;
    if (tileIsFree(state.stacks, st.id)) freeHits.push(st.id);
    else blockedTop = st.id;
  }
  if (freeHits.length) return freeHits[freeHits.length - 1];
  return blockedTop; // 被压住 / 锁住的牌：返回其 stackId（main 用 feedback 区分）
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;
  const particles = [];

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('dawn-market'), 0, 0);
    drawCat(ctx, 100, 470, 96, 'idle', clock);
  }

  function draw(state, dt, view) {
    if (!state || !state.stacks) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;

    const L = computeLayout(state);
    const P = SCENES[state.scene] || SCENES['dawn-market'];

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }
    ctx.drawImage(getBackground(state.scene), 0, 0);

    // 牌堆（自底向上）
    for (const st of state.stacks) {
      const base = L.stackPos(st.col, st.row);
      for (let i = 0; i < st.tiles.length; i += 1) {
        const isTop = i === st.tiles.length - 1;
        const free = isTop && tileIsFree(state.stacks, st.id);
        const jx = seededRand(st.id, i, 7) * LAYOUT.STACK_JITTER * 2 - LAYOUT.STACK_JITTER;
        const ty = base.y - i * LAYOUT.STACK_DY;
        drawCard(ctx, base.x + jx, ty, LAYOUT.CARD_W, LAYOUT.CARD_H, st.tiles[i].type, free, clock);
        if (isTop && st.tiles[i].lockAnchor != null) {
          drawLock(ctx, base.x + jx + LAYOUT.CARD_W * 0.28, ty - LAYOUT.CARD_H * 0.28);
        }
        // 高亮 hover
        if (v.hoverStack === st.id && free) {
          ctx.strokeStyle = 'rgba(255,216,120,0.95)';
          ctx.lineWidth = 3;
          roundRect(ctx, base.x + jx - LAYOUT.CARD_W / 2 - 3, ty - LAYOUT.CARD_H / 2 - 3, LAYOUT.CARD_W + 6, LAYOUT.CARD_H + 6, 12);
          ctx.stroke();
        }
      }
    }

    // 收槽
    drawSlot(ctx, state, L);

    // 粒子（香料烟尘）
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color.replace('A', a.toFixed(2));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2); ctx.fill();
    }

    // 掌柜小猫（在左/右下角，避让棋盘）
    const catPose = (v.catPulse && v.catPulse > 0) ? 'cheer' : 'idle';
    drawCat(ctx, WORLD.WIDTH - 70, LAYOUT.BOARD_BOTTOM + 58, LAYOUT.CAT_W, catPose, clock);

    ctx.restore();
  }

  function drawSlot(ctx, state, L) {
    // 收槽底板（不透明，保证可读）
    ctx.fillStyle = 'rgba(40,26,16,0.92)';
    roundRect(ctx, L.slot.x - 16, L.slot.y - 14, L.slot.w + 32, L.slot.h + 28, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(255,233,180,0.4)';
    ctx.lineWidth = 2;
    roundRect(ctx, L.slot.x - 16, L.slot.y - 14, L.slot.w + 32, L.slot.h + 28, 16); ctx.stroke();

    for (let i = 0; i < state.slotCap; i += 1) {
      const r = L.slotRects[i];
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, r.x, r.y, r.w, r.h, 10); ctx.stroke();
    }
    // 槽内牌
    state.slot.forEach((e, i) => {
      const r = L.slotRects[i];
      drawCard(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.86, r.h * 0.9, e.type, true, clock);
    });
  }

  function debugLayout() {
    if (!lastState) return null;
    const L = computeLayout(lastState);
    return {
      board: L.board,
      slot: L.slot,
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
      cell: L.cellW,
    };
  }

  function spawnDust(x, y, color) {
    for (let i = 0; i < 14; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
        size: 2.5 + Math.random() * 3.5,
        color: color || 'rgba(200,160,90,A)',
      });
    }
  }

  function __renderDemo(sceneKey) {
    lastState = { stacks: [], slot: [], slotCap: 7, scene: SCENES[sceneKey] ? sceneKey : 'dawn-market' };
    draw(lastState, 0, { sceneKey });
  }

  if (typeof window !== 'undefined') {
    window.__renderDemo = __renderDemo;
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, spawnDust, hitStack, __renderDemo };
}
