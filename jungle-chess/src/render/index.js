// Canvas 2D 渲染：翡翠雨林棋盘 + 萌系兽首徽章（形状+颜色双编码）+ 吃子藤蔓签名动画 + 右侧信息面板。
// 只消费 run.state + view（hover/fxQueue/shake）。像素换算全部在此完成。
// 契约：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize() }。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { ROWS, COLS, BLUE, RED, ANIMALS, RAT, CAT, DOG, WOLF, LEOPARD, TIGER, LION, ELEPHANT, DEN, pieceSide, pieceRank, rOf, cOf, isWater, trapsOf, initialBoard } from '../game/rules.js';
import { t } from '../core/i18n.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

// 三个场景包：晨雾林 / 雨季林 / 夜鸣林（色板+装饰互异）
const SCENE_PALETTES = {
  'dawn-mist': {
    skyTop: '#DCEFC7', skyMid: '#B7DCA0', skyBot: '#8FC37A',
    fog: 'rgba(235,250,225,0.5)',
    tile: '#E7D9A8', tileBorder: '#BBA36F', tileMark: '#A98F58',
    land: '#D8C99A', water: '#6FC7D8', waterDark: '#4AA3B8',
    den: '#7A4A2B', trap: '#5C3A22', accent: '#3E7A3E',
    panel: 'rgba(24,48,32,0.90)', panelText: '#EAF6DF',
  },
  'monsoon': {
    skyTop: '#5FA87F', skyMid: '#3E7E5E', skyBot: '#2A5A44',
    fog: 'rgba(220,240,255,0.22)',
    tile: '#C8D6A0', tileBorder: '#8AA566', tileMark: '#7A9458',
    land: '#A9C08A', water: '#5AB6CC', waterDark: '#3B8EA6',
    den: '#6B3E22', trap: '#4A2C18', accent: '#2E6E4A',
    panel: 'rgba(18,42,32,0.92)', panelText: '#EAF6DF',
  },
  'night-song': {
    skyTop: '#12323E', skyMid: '#0D2836', skyBot: '#071C27',
    fog: 'rgba(160,220,180,0.10)',
    tile: '#2E5A54', tileBorder: '#1E4642', tileMark: '#1B413D',
    land: '#23484A', water: '#2E7F94', waterDark: '#1E5E70',
    den: '#7A4A2B', trap: '#4A2C18', accent: '#7FD8A0',
    panel: 'rgba(10,22,26,0.92)', panelText: '#D8F0E0',
  },
};

function sceneOf(state) {
  return SCENE_PALETTES[state?.scene] || SCENE_PALETTES['dawn-mist'];
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t2 = Math.imul(a ^ (a >>> 15), 1 | a);
    t2 = (t2 + Math.imul(t2 ^ (t2 >>> 7), 61 | t2)) ^ t2;
    return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296;
  };
}
const seededRand = (r, c, seed) => mulberry32((r * 73856093) ^ (c * 19349663) ^ (seed * 83492791))();

// ---------- 背景缓存 ----------
const bgCache = new Map();
function getBackground(sceneKey) {
  let c = bgCache.get(sceneKey);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = W; c.height = H;
  drawBackground(c.getContext('2d'), sceneKey);
  bgCache.set(sceneKey, c);
  return c;
}

function drawBackground(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['dawn-mist'];
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.6, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'night-song') drawFireflies(g, P);
  if (sceneKey === 'dawn-mist') drawMist(g, P);
  if (sceneKey === 'monsoon') drawRain(g, P);

  // 藤蔓/树影装饰（左右边缘）
  drawFoliage(g, P, 40, 120);
  drawFoliage(g, P, 940, 90);
  drawFoliage(g, P, 150, H - 40);
}

function drawMist(g, P) {
  g.fillStyle = P.fog;
  for (let i = 0; i < 5; i += 1) {
    const y = 90 + i * 120 + Math.sin(i * 1.7) * 20;
    g.beginPath();
    g.ellipse(640, y, 760, 46, 0, 0, Math.PI * 2);
    g.fill();
  }
}
function drawRain(g) {
  g.strokeStyle = 'rgba(210,240,255,0.28)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 60; i += 1) {
    const x = seededRand(i, 1, 7) * W;
    const y = seededRand(i, 2, 13) * H;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 6, y + 16);
    g.stroke();
  }
}
function drawFireflies(g, P) {
  for (let i = 0; i < 26; i += 1) {
    const x = seededRand(i, 3, 17) * W;
    const y = seededRand(i, 5, 23) * H;
    const r = 1.2 + seededRand(i, 7, 31) * 1.6;
    g.fillStyle = `rgba(190,255,170,${0.3 + seededRand(i, 9, 37) * 0.7})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}
function drawFoliage(g, P, x, y) {
  g.save();
  g.translate(x, y);
  g.strokeStyle = P.accent;
  g.lineWidth = 6;
  g.lineCap = 'round';
  for (let i = 0; i < 4; i += 1) {
    const a = -1.1 + i * 0.5;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(Math.cos(a) * 40, Math.sin(a) * 40 - 30, Math.cos(a) * 90, Math.sin(a) * 90 - 70);
    g.stroke();
    g.fillStyle = P.accent;
    g.beginPath();
    g.ellipse(Math.cos(a) * 90, Math.sin(a) * 90 - 70, 16, 7, a, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// ---------- 布局 ----------
function computeLayout() {
  const boardH = H - LAYOUT.HUD_H - LAYOUT.MARGIN_Y * 2;
  const cell = Math.min(Math.floor(boardH / ROWS), LAYOUT.CELL_MAX);
  const gridW = cell * COLS;
  const gridH = cell * ROWS;
  const panelW = LAYOUT.SIDE_W;
  const leftW = W - LAYOUT.MARGIN_X * 2 - panelW - 18;
  const gridX = LAYOUT.MARGIN_X + Math.floor((leftW - gridW) / 2);
  const gridY = LAYOUT.HUD_H + LAYOUT.MARGIN_Y + Math.floor((boardH - gridH) / 2);
  const panelX = W - LAYOUT.MARGIN_X - panelW;
  return { cell, gridX, gridY, gridW, gridH, panelX, panelW };
}

function cellCenter(L, i) {
  const r = rOf(i); const c = cOf(i);
  return { x: L.gridX + c * L.cell + L.cell / 2, y: L.gridY + r * L.cell + L.cell / 2 };
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

// ---------- 棋盘格 ----------
function drawBoard(g, state, L) {
  const P = sceneOf(state);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const x = L.gridX + c * L.cell;
      const y = L.gridY + r * L.cell;
      const i = r * COLS + c;
      const water = isWater(i);
      if (water) {
        g.fillStyle = P.water;
        roundRect(g, x + 1, y + 1, L.cell - 2, L.cell - 2, 8);
        g.fill();
        // 波纹
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x + L.cell * 0.2, y + L.cell * 0.5);
        g.quadraticCurveTo(x + L.cell * 0.5, y + L.cell * 0.35, x + L.cell * 0.8, y + L.cell * 0.5);
        g.stroke();
      } else {
        g.fillStyle = P.tile;
        roundRect(g, x + 1, y + 1, L.cell - 2, L.cell - 2, 8);
        g.fill();
        g.strokeStyle = P.tileBorder;
        g.lineWidth = 1.4;
        g.stroke();
      }
      // 陷阱
      if (trapsOf(BLUE).has(i) || trapsOf(RED).has(i)) {
        drawTrapMark(g, x, y, L.cell, P);
      }
      // 兽穴
      if (i === DEN[BLUE] || i === DEN[RED]) {
        drawDenMark(g, x, y, L.cell, i === DEN[BLUE] ? BLUE : RED, P);
      }
    }
  }
}

function drawTrapMark(g, x, y, cell, P) {
  const cx = x + cell / 2;
  const cy = y + cell / 2;
  const r = cell * 0.3;
  g.fillStyle = P.trap;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,230,180,0.6)';
  g.lineWidth = 1.5;
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.lineTo(cx + Math.cos(a + 0.4) * r * 0.4, cy + Math.sin(a + 0.4) * r * 0.4);
    g.stroke();
  }
}

function drawDenMark(g, x, y, cell, side, P) {
  const cx = x + cell / 2;
  const cy = y + cell / 2;
  const col = side === BLUE ? '#3E7AA6' : '#C2492E';
  g.fillStyle = P.den;
  g.beginPath(); g.arc(cx, cy, cell * 0.34, 0, Math.PI * 2); g.fill();
  g.strokeStyle = col;
  g.lineWidth = 3;
  g.beginPath(); g.arc(cx, cy, cell * 0.34, 0, Math.PI * 2); g.stroke();
  // 巢穴门
  g.fillStyle = col;
  g.beginPath();
  g.arc(cx, cy, cell * 0.18, 0, Math.PI * 2);
  g.fill();
}

// ---------- 兽首徽章 ----------
const BLUE_BADGE = { a: '#3E86C9', b: '#1B4F86', rim: '#0E3560', face: '#F7F1E3', dark: '#2A1A0C' };
const RED_BADGE = { a: '#E0583A', b: '#A8341F', rim: '#6E1D0E', face: '#F7E9D6', dark: '#2A1A0C' };

function drawPiece(g, animal, side, cx, cy, size, opts = {}) {
  const badge = side === BLUE ? BLUE_BADGE : RED_BADGE;
  const r = size / 2;
  const grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, badge.a);
  grad.addColorStop(1, badge.b);
  g.save();
  // 红方用菱形、蓝方用圆形：形状+颜色双编码阵营
  g.beginPath();
  if (side === RED) {
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r, cy);
    g.lineTo(cx, cy + r);
    g.lineTo(cx - r, cy);
    g.closePath();
  } else {
    g.arc(cx, cy, r, 0, Math.PI * 2);
  }
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = badge.rim;
  g.stroke();

  // 头像
  drawAnimalFace(g, animal, cx, cy, r * 0.82, badge, opts);

  // 等级数字徽记（1=鼠 … 8=象）
  if (!opts.noRank) {
    const rank = ANIMALS.indexOf(animal) + 1;
    const bx = cx + r * 0.68;
    const by = cy + r * 0.68;
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.arc(bx, by, r * 0.36, 0, Math.PI * 2); g.fill();
    g.strokeStyle = badge.rim;
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = '#2A1A0C';
    g.font = `800 ${Math.round(r * 0.56)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(rank), bx, by + 1);
  }
  g.restore();
}

function drawAnimalFace(g, animal, cx, cy, r, badge, opts) {
  const F = badge.face;
  const D = badge.dark;
  g.fillStyle = F;
  g.strokeStyle = D;
  g.lineWidth = Math.max(1.4, r * 0.08);

  const ear = (ang) => {
    // 小三角耳
    const ex = cx + Math.cos(ang) * r * 0.6;
    const ey = cy + Math.sin(ang) * r * 0.6;
    g.beginPath();
    g.moveTo(ex - r * 0.16, ey - r * 0.1);
    g.lineTo(ex, ey - r * 0.34);
    g.lineTo(ex + r * 0.16, ey - r * 0.1);
    g.closePath();
    g.fill();
  };

  switch (animal) {
    case 'rat': {
      // 大圆耳 + 尖脸 + 尾
      for (const a of [-2.3, -0.84]) {
        g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.3, 0, Math.PI * 2); g.fill();
      }
      g.beginPath(); g.arc(cx, cy + r * 0.08, r * 0.42, 0, Math.PI * 2); g.fill();
      g.fillStyle = D;
      g.beginPath(); g.arc(cx - r * 0.14, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + r * 0.14, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx, cy + r * 0.14, r * 0.09, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'cat': {
      ear(-2.3); ear(-0.84);
      g.beginPath(); g.arc(cx, cy + r * 0.04, r * 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = D;
      g.beginPath(); g.arc(cx - r * 0.15, cy + r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + r * 0.15, cy + r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(cx, cy + r * 0.12); g.lineTo(cx - r * 0.06, cy + r * 0.24); g.lineTo(cx + r * 0.06, cy + r * 0.24); g.closePath(); g.fill();
      break;
    }
    case 'dog': {
      // 垂耳
      g.beginPath(); g.ellipse(cx - r * 0.5, cy - r * 0.1, r * 0.22, r * 0.34, 0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx + r * 0.5, cy - r * 0.1, r * 0.22, r * 0.34, -0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx, cy, r * 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = D;
      g.beginPath(); g.arc(cx - r * 0.14, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + r * 0.14, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx, cy + r * 0.16, r * 0.14, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'wolf': {
      ear(-2.35); ear(-0.79);
      // 尖吻
      g.beginPath();
      g.moveTo(cx, cy + r * 0.4);
      g.lineTo(cx + r * 0.3, cy - r * 0.2);
      g.lineTo(cx, cy - r * 0.1);
      g.lineTo(cx - r * 0.3, cy - r * 0.2);
      g.closePath();
      g.fill();
      g.fillStyle = D;
      g.beginPath(); g.arc(cx - r * 0.12, cy - r * 0.05, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + r * 0.12, cy - r * 0.05, r * 0.1, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'leopard': {
      ear(-2.3); ear(-0.84);
      g.beginPath(); g.arc(cx, cy, r * 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = D;
      for (const [dx, dy] of [[-0.18, -0.2], [0.18, -0.2], [0, 0], [-0.2, 0.16], [0.2, 0.16]]) {
        g.beginPath(); g.arc(cx + dx * r, cy + dy * r, r * 0.07, 0, Math.PI * 2); g.fill();
      }
      g.beginPath(); g.arc(cx - r * 0.14, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + r * 0.14, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'tiger': {
      ear(-2.3); ear(-0.84);
      g.beginPath(); g.arc(cx, cy, r * 0.4, 0, Math.PI * 2); g.fill();
      // 王字纹
      g.fillStyle = D;
      g.fillRect(cx - r * 0.14, cy - r * 0.22, r * 0.28, r * 0.07);
      g.fillRect(cx - r * 0.03, cy - r * 0.16, r * 0.06, r * 0.2);
      g.beginPath(); g.arc(cx - r * 0.14, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + r * 0.14, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'lion': {
      // 鬃毛
      g.fillStyle = badge.rim;
      for (let k = 0; k < 10; k += 1) {
        const a = (k / 10) * Math.PI * 2;
        g.beginPath();
        g.arc(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.16, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = F;
      g.beginPath(); g.arc(cx, cy, r * 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = D;
      g.beginPath(); g.arc(cx - r * 0.14, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + r * 0.14, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(cx - r * 0.05, cy + r * 0.12); g.lineTo(cx + r * 0.05, cy + r * 0.12); g.lineTo(cx, cy + r * 0.24); g.closePath(); g.fill();
      break;
    }
    case 'elephant': {
      // 大耳 + 长鼻
      g.beginPath(); g.ellipse(cx - r * 0.42, cy - r * 0.1, r * 0.24, r * 0.3, 0.2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx + r * 0.42, cy - r * 0.1, r * 0.24, r * 0.3, -0.2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx, cy, r * 0.36, 0, Math.PI * 2); g.fill();
      // 长鼻
      g.strokeStyle = F;
      g.lineWidth = r * 0.2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx, cy + r * 0.06);
      g.quadraticCurveTo(cx + r * 0.1, cy + r * 0.3, cx, cy + r * 0.4);
      g.stroke();
      g.fillStyle = D;
      g.beginPath(); g.arc(cx - r * 0.12, cy - r * 0.04, r * 0.09, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + r * 0.12, cy - r * 0.04, r * 0.09, 0, Math.PI * 2); g.fill();
      break;
    }
    default: {
      g.beginPath(); g.arc(cx, cy, r * 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = D;
      g.beginPath(); g.arc(cx - r * 0.13, cy, r * 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + r * 0.13, cy, r * 0.1, 0, Math.PI * 2); g.fill();
    }
  }
}

// ---------- 藤蔓吃子签名动画 ----------
function drawVines(g, cx, cy, cell, t) {
  const n = 5;
  for (let k = 0; k < n; k += 1) {
    const a = (k / n) * Math.PI * 2 + 0.5;
    const grow = Math.min(1, t * 2) * cell * 0.42;
    g.strokeStyle = `rgba(94,178,90,${0.5 + 0.5 * Math.sin(t * 8 + k)})`;
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx, cy);
    const mx = cx + Math.cos(a) * grow * 0.6;
    const my = cy + Math.sin(a) * grow * 0.6;
    g.quadraticCurveTo(mx, my, cx + Math.cos(a) * grow, cy + Math.sin(a) * grow);
    g.stroke();
    // 小叶
    g.fillStyle = 'rgba(120,200,110,0.9)';
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * grow, cy + Math.sin(a) * grow, cell * 0.09, cell * 0.05, a, 0, Math.PI * 2);
    g.fill();
  }
}

// ---------- 信息面板 ----------
function drawPanel(g, state, L, clock) {
  const P = sceneOf(state);
  const x = L.panelX;
  const y = L.gridY;
  const w = L.panelW;
  const h = L.gridH;
  g.fillStyle = P.panel;
  roundRect(g, x, y, w, h, 16);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.14)';
  g.lineWidth = 1.5;
  g.stroke();

  g.textBaseline = 'middle';
  let ty = y + 26;

  // 回合
  g.fillStyle = P.panelText;
  g.font = '800 15px sans-serif';
  g.textAlign = 'left';
  g.fillText(t('turn'), x + 16, ty);
  const isBlue = state.sideToMove === BLUE;
  const dotCol = isBlue ? '#4FA8E0' : '#E0583A';
  g.fillStyle = dotCol;
  g.beginPath(); g.arc(x + w - 22, ty, 8, 0, Math.PI * 2); g.fill();
  const turnTxt = state.thinking ? t('thinking') : (isBlue ? t('yourTurn') : t('ai') + ' · ' + t(aiTierNameOf(state)));
  g.fillStyle = isBlue ? '#CFEAFF' : '#FFD8CE';
  g.font = '700 13px sans-serif';
  g.fillText(turnTxt, x + 16, ty + 26);

  ty += 62;

  // 目标
  g.fillStyle = P.panelText;
  g.font = '800 14px sans-serif';
  g.fillText(t('goal'), x + 16, ty);
  g.fillStyle = '#FFF6D8';
  g.font = '700 12.5px sans-serif';
  const goalTxt = state.goal && state.goal.type === 'piece'
    ? t('goalPiece', { p: t(ANIMALS[state.goal.animal]) })
    : t('goalDen');
  const goalLines = wrapToWidth(g, goalTxt, w - 34);
  goalLines.forEach((line, li) => g.fillText(line, x + 16, ty + 22 + li * 17));
  ty += 54 + (goalLines.length - 1) * 17;

  // 移动计数 / 预算
  g.fillStyle = P.panelText;
  g.font = '700 13px sans-serif';
  const mvTxt = state.kind === 'puzzle'
    ? `${t('moves')}: ${state.blueMoves}/${state.movesToWin ?? '—'}`
    : `${t('moves')}: ${state.moveCount}`;
  g.fillText(mvTxt, x + 16, ty);
  if (state.aiTier) {
    g.fillStyle = '#C9E8C0';
    g.font = '700 12.5px sans-serif';
    g.fillText(t('tier') + ': ' + t(aiTierNameOf(state)), x + 16, ty + 22);
  }
  ty += 52;

  // 被吃子列表（蓝吃到红 / 红吃到蓝）
  ty = drawCapturedRow(g, t('you'), state.capturedByBlue, BLUE, x, ty, w, P);
  ty = drawCapturedRow(g, t('ai'), state.capturedByRed, RED, x, ty, w, P);

  ty += 14;

  // 兽类等级图例
  g.fillStyle = P.panelText;
  g.font = '800 13px sans-serif';
  g.textAlign = 'left';
  g.fillText(t('legend'), x + 16, ty);
  ty += 20;
  for (let rank = ELEPHANT; rank >= RAT; rank -= 1) {
    const rowY = ty + (ELEPHANT - rank) * 22;
    drawPiece(g, ANIMALS[rank], BLUE, x + 22, rowY, 20, { noRank: true });
    g.fillStyle = P.panelText;
    g.font = '700 12px sans-serif';
    g.textAlign = 'left';
    g.fillText(String(rank + 1) + ' ' + t(ANIMALS[rank]), x + 40, rowY + 1);
  }
}

function aiTierNameOf(state) {
  switch (state.aiTier) {
    case 'senior': return 'tierSenior';
    case 'elder': return 'tierElder';
    case 'perfect': return 'tierPerfect';
    default: return 'tierNovice';
  }
}

function drawCapturedRow(g, label, ranks, side, x, ty, w, P) {
  g.fillStyle = P.panelText;
  g.font = '700 12px sans-serif';
  g.textAlign = 'left';
  g.fillText(label, x + 16, ty);
  let px = x + 16 + g.measureText(label).width + 10;
  for (const rank of ranks) {
    if (px > x + w - 22) break;
    drawPiece(g, ANIMALS[rank], side, px, ty, 16);
    px += 20;
  }
  return ty + 22;
}

function wrapToWidth(g, s, maxWidth) {
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (g.measureText(t).width <= maxWidth || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- 主渲染 ----------
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
    const L = computeLayout();
    return {
      grid: { x: L.gridX, y: L.gridY, w: L.gridW, h: L.gridH },
      board: { x: L.gridX, y: L.gridY, w: L.gridW, h: L.gridH },
      cell: L.cell,
      panel: { x: L.panelX, y: L.gridY, w: L.panelW, h: L.gridH },
      hud: { x: 0, y: 0, w: W, h: LAYOUT.HUD_H },
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(getBackground('dawn-mist'), 0, 0);
    // 展示初始棋盘
    drawStaticBoard(initialBoard(), 'dawn-mist');
  }

  function drawIcon(animal, side) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(getBackground('dawn-mist'), 0, 0);
    const a = ANIMALS.includes(animal) ? animal : 'lion';
    drawPiece(ctx, a, side === RED ? RED : BLUE, W / 2, H / 2, 200);
  }

  function drawStaticBoard(board, sceneKey) {
    const state = { board, scene: sceneKey, sideToMove: BLUE, capturedByBlue: [], capturedByRed: [], aiTier: null, moveCount: 0, kind: 'game', goal: { type: 'den' } };
    const L = computeLayout();
    const P = SCENE_PALETTES[sceneKey];
    drawBoard(ctx, state, L);
    for (let i = 0; i < board.length; i += 1) {
      const v = board[i];
      if (v === 0) continue;
      const p = cellCenter(L, i);
      drawPiece(ctx, ANIMALS[pieceRank(v)], pieceSide(v), p.x, p.y, L.cell * 0.8);
    }
  }

  function draw(state, dt, view) {
    if (!state || !state.board) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;
    const L = computeLayout();
    const P = sceneOf(state);

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }
    ctx.drawImage(getBackground(state.scene), 0, 0);

    drawBoard(ctx, state, L);

    // 合法走法提示（绿点）
    if (state.phase === 'playing' && state.sideToMove === BLUE && state.selected != null) {
      for (const m of state.legalMoves) {
        const p = cellCenter(L, m.to);
        ctx.fillStyle = m.outcome === 'capture' || m.outcome === 'mutual' ? 'rgba(255,90,70,0.9)' : 'rgba(120,220,120,0.9)';
        ctx.beginPath(); ctx.arc(p.x, p.y, L.cell * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 棋子（走子动画期间跳过终点，改为插值绘制）
    const anim = state.anim;
    const skipTo = anim ? anim.to : -1;
    for (let i = 0; i < state.board.length; i += 1) {
      const v = state.board[i];
      if (v === 0) continue;
      if (i === skipTo) continue;
      const p = cellCenter(L, i);
      drawPiece(ctx, ANIMALS[pieceRank(v)], pieceSide(v), p.x, p.y, L.cell * 0.8);
    }

    // 走子动画
    if (anim) {
      const from = cellCenter(L, anim.from);
      const to = cellCenter(L, anim.to);
      const k = easeOut(Math.min(1, Math.max(0, anim.t)));
      const mx = from.x + (to.x - from.x) * k;
      const my = from.y + (to.y - from.y) * k;
      // 吃子藤蔓（在目标格生长）
      if (anim.kind === 'capture') {
        drawVines(ctx, to.x, to.y, L.cell, anim.t);
      }
      // 移动子（其终态已在 board[anim.to]）
      if (state.board[anim.to] !== 0) {
        drawPiece(ctx, ANIMALS[pieceRank(state.board[anim.to])], anim.mover, mx, my, L.cell * 0.8);
      }
    }

    // 选中高亮环
    if (state.selected != null) {
      const p = cellCenter(L, state.selected);
      ctx.strokeStyle = 'rgba(255,230,120,0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, L.cell * 0.5, 0, Math.PI * 2); ctx.stroke();
    }

    // hover 高亮
    if (v.hoverCell) {
      const p = cellCenter(L, v.hoverCell.r * COLS + v.hoverCell.c);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, L.cell * 0.46, 0, Math.PI * 2); ctx.stroke();
    }

    // fxQueue（吃子藤蔓持续）
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.type === 'vine' && fx.ttl > 0) {
          const p = cellCenter(L, fx.r * COLS + fx.c);
          drawVines(ctx, p.x, p.y, L.cell, 1 - fx.ttl);
        }
      }
    }

    drawPanel(ctx, state, L, clock);

    ctx.restore();
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  if (typeof window !== 'undefined') window.__drawIcon = drawIcon;

  return { draw, debugLayout, resize, _drawTitle: drawTitleScene, _drawIcon: drawIcon };
}
