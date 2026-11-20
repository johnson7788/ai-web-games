// CARD ROYALE · 渲染层（Canvas 2D，纯程序化，零外部素材）
// 职责：三场景包（烛光大厅/王家花园/藏宝地窖）、程序化宫廷牌面（K/Q/J/A 纹章 + 点数）、
//       牌阵/库存/弃牌堆几何、皇家连胜金线、冻结/藏宝/鬼牌标记。
// 契约：draw(state, dt, view) / debugLayout() / hitTest(x, y)。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { SUITS } from '../game/sim.js';

const CARD_W = LAYOUT.CARD_W;
const CARD_H = LAYOUT.CARD_H;
const R = 9; // 圆角

// 三场景色板（换章必换，一眼可分）
const SCENES = {
  'candle-hall': {
    bgTop: '#2a1a12', bgBottom: '#120a06',
    accent: '#e6a23c', accent2: '#f5d76e',
    table: '#4a2e1a', tableEdge: '#6b4423',
    cardFace: '#f7ecd8', cardBack: '#7a3b2e',
    decor: (ctx, t) => drawCandleHall(ctx, t),
  },
  'royal-garden': {
    bgTop: '#0f2f1c', bgBottom: '#06170e',
    accent: '#7cc46b', accent2: '#c9f0a0',
    table: '#2e4a24', tableEdge: '#3f6333',
    cardFace: '#eef7e0', cardBack: '#2f6b3a',
    decor: (ctx, t) => drawGarden(ctx, t),
  },
  'treasure-vault': {
    bgTop: '#1a1430', bgBottom: '#0a0818',
    accent: '#e0c060', accent2: '#8a7bf0',
    table: '#2c2350', tableEdge: '#453a75',
    cardFace: '#f2ead6', cardBack: '#3a2f6b',
    decor: (ctx, t) => drawVault(ctx, t),
  },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- 场景装饰 ----
function drawCandleHall(ctx, t) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  // 立柱
  for (const px of [40, 1240]) {
    const g = ctx.createLinearGradient(px, 120, px + 60, 720);
    g.addColorStop(0, '#5a4030'); g.addColorStop(1, '#241610');
    ctx.fillStyle = g; ctx.fillRect(px, 120, 60, 600);
  }
  ctx.globalAlpha = 0.9;
  // 吊灯蜡烛（闪烁）
  for (let i = 0; i < 5; i += 1) {
    const cx = 220 + i * 210;
    const flick = 0.75 + 0.25 * Math.sin(t * 9 + i * 1.7);
    ctx.fillStyle = `rgba(245,215,110,${0.5 + 0.4 * flick})`;
    ctx.beginPath(); ctx.arc(cx, 60, 14 + 3 * flick, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,120,0.9)';
    ctx.beginPath(); ctx.arc(cx, 56, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawGarden(ctx, t) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  // 灌木
  for (let i = 0; i < 9; i += 1) {
    const x = 80 + i * 140;
    ctx.fillStyle = '#1d4a20';
    ctx.beginPath(); ctx.arc(x, 640, 60, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 40, 640, 40, Math.PI, 0); ctx.fill();
  }
  // 花朵
  for (let i = 0; i < 12; i += 1) {
    const x = 70 + i * 105 + ((i * 37) % 60);
    const y = 600 + ((i * 53) % 50);
    ctx.fillStyle = i % 2 ? '#e6a23c' : '#d9638a';
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawVault(ctx, t) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  // 金币
  for (let i = 0; i < 20; i += 1) {
    const x = 40 + ((i * 97) % 1200);
    const y = 600 + ((i * 61) % 60);
    const r = 7 + (i % 3) * 3;
    ctx.fillStyle = '#e0c060';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6f30';
    ctx.beginPath(); ctx.arc(x - 1, y - 1, r * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---- 牌面：点数 pip ----
const PIP_POS = {
  2: [[0, -1], [0, 1]],
  3: [[0, -1], [0, 0], [0, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  7: [[-1, -1], [1, -1], [-1, 0], [1, 0], [0, 0], [-1, 1], [1, 1]],
  8: [[-1, -1], [1, -1], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, 1], [1, 1]],
  9: [[-1, -1], [1, -1], [-1, 0], [1, 0], [0, 0], [-1, 1], [1, 1], [-1, -0.5], [1, -0.5]],
  10: [[-1, -1], [1, -1], [-1, 0], [1, 0], [0, 0], [-1, 1], [1, 1], [-1, -0.5], [1, -0.5], [0, -1.5]],
};

function drawSuitGlyph(ctx, suit, x, y, size) {
  const s = SUITS[suit];
  ctx.fillStyle = s.color === 'red' ? '#c0392b' : '#1a1a1a';
  ctx.font = `${size}px "Georgia", "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.sym, x, y);
}

// 程序化宫廷人物（按点数）：K 国王 / Q 王后 / J 弄臣 / A 王冠
function drawCourtFigure(ctx, rank, suit, x, y, w, h) {
  const s = SUITS[suit];
  const color = s.color === 'red' ? '#c0392b' : '#1a1a1a';
  ctx.save();
  ctx.translate(x, y);
  const cx = w / 2;
  const cy = h / 2;
  if (rank === 13) { // King：皇冠 + 络腮胡
    drawCrown(ctx, cx, cy - 22, color);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy - 4, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0e0c0';
    ctx.fillRect(cx - 16, cy - 2, 32, 18);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy - 6, 12, 0, Math.PI); ctx.fill();
  } else if (rank === 12) { // Queen：皇冠 + 菱形项链
    drawCrown(ctx, cx, cy - 24, color);
    ctx.fillStyle = '#f0e0c0';
    ctx.beginPath(); ctx.arc(cx, cy - 4, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(cx, cy + 2); ctx.lineTo(cx - 8, cy + 16); ctx.lineTo(cx, cy + 22); ctx.lineTo(cx + 8, cy + 16); ctx.closePath(); ctx.fill();
  } else if (rank === 11) { // Jester：三尖帽 + 铃铛
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(cx - 14, cy + 6); ctx.lineTo(cx - 10, cy - 18); ctx.lineTo(cx - 2, cy - 8); ctx.lineTo(cx, cy - 22); ctx.lineTo(cx + 2, cy - 8); ctx.lineTo(cx + 10, cy - 18); ctx.lineTo(cx + 14, cy + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0e0c0';
    ctx.beginPath(); ctx.arc(cx, cy + 10, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    for (const bx of [-14, 14]) { ctx.beginPath(); ctx.arc(cx + bx, cy + 6, 3, 0, Math.PI * 2); ctx.fill(); }
  } else { // A：太阳王冠
    drawCrown(ctx, cx, cy - 10, color);
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26); ctx.stroke();
    }
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCrown(ctx, cx, cy, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx - 16, cy - 14);
  ctx.lineTo(cx - 8, cy - 4);
  ctx.lineTo(cx, cy - 16);
  ctx.lineTo(cx + 8, cy - 4);
  ctx.lineTo(cx + 16, cy - 14);
  ctx.lineTo(cx + 16, cy);
  ctx.closePath();
  ctx.fill();
}

function drawCardFace(ctx, card, x, y, w, h, scene) {
  // 底色
  ctx.fillStyle = scene.cardFace;
  roundRect(ctx, x, y, w, h, R);
  ctx.fill();
  ctx.strokeStyle = card.color === 'red' ? '#c0392b' : '#2a2a2a';
  ctx.lineWidth = 2;
  ctx.stroke();

  const s = SUITS[card.suit];
  const color = s.color === 'red' ? '#c0392b' : '#1a1a1a';
  const rankLabel = card.rank === 13 ? 'K' : card.rank === 12 ? 'Q' : card.rank === 11 ? 'J' : card.rank === 1 ? 'A' : String(card.rank);

  // 角标（左上 + 右下），字号加大以便重叠时仍可读
  ctx.fillStyle = color;
  ctx.font = 'bold 26px "Georgia", "Times New Roman", serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(rankLabel, x + 7, y + 4);
  ctx.font = '20px "Georgia", serif';
  ctx.fillText(s.sym, x + 7, y + 30);
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.font = 'bold 22px "Georgia", serif';
  ctx.fillText(rankLabel, x + w - 7, y + h - 4);

  // 中央图案
  if (card.rank >= 11 || card.rank === 1) {
    drawCourtFigure(ctx, card.rank, card.suit, x + w / 2, y + h / 2, w, h);
  } else {
    const pts = PIP_POS[card.rank] || [];
    for (const [px, py] of pts) {
      drawSuitGlyph(ctx, card.suit, x + w / 2 + px * (w * 0.28), y + h / 2 + py * (h * 0.3), 16);
    }
  }
}

function drawCardBack(ctx, x, y, w, h, scene) {
  ctx.fillStyle = scene.cardBack;
  roundRect(ctx, x, y, w, h, R);
  ctx.fill();
  ctx.strokeStyle = '#00000055';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 背面纹章
  ctx.strokeStyle = 'rgba(245,215,110,0.8)';
  ctx.lineWidth = 2;
  const cx = x + w / 2; const cy = y + h / 2;
  ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
}

// ---- 渲染器 ----
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let layout = { board: [], stock: null, waste: null, playable: null };

  function computeLayout(state) {
    const xUnit = CARD_W * 0.5;
    const maxC = state.board.reduce((m, c) => Math.max(m, c.c), -Infinity);
    const minC = state.board.reduce((m, c) => Math.min(m, c.c), Infinity);
    const rows = state.board.reduce((m, c) => Math.max(m, c.r), 0);
    // 原始坐标
    const raw = state.board.map((c) => ({
      id: c.id,
      card: c,
      x: minC * xUnit + c.c * xUnit + c.r * (xUnit / 2),
      y: (rows - c.r) * LAYOUT.CARD_OFFSET,
      w: CARD_W,
      h: CARD_H,
    }));
    const minX = Math.min(...raw.map((p) => p.x));
    const maxX = Math.max(...raw.map((p) => p.x + CARD_W));
    const minY = Math.min(...raw.map((p) => p.y));
    const maxY = Math.max(...raw.map((p) => p.y + CARD_H));
    const boardW = maxX - minX;
    const boardH = maxY - minY;
    // 居中到棋盘区（HUD 下、footer 上）
    const boardArea = { top: LAYOUT.HUD_H + 24, bottom: WORLD.HEIGHT - LAYOUT.FOOTER_H };
    const boardAreaH = boardArea.bottom - boardArea.top;
    const scale = Math.min(1, (WORLD.WIDTH - 60) / boardW, boardAreaH / boardH);
    const boardCX = WORLD.WIDTH / 2;
    const boardCY = (boardArea.top + boardArea.bottom) / 2;
    const board = raw.map((p) => {
      const x = boardCX + (p.x + CARD_W / 2 - (minX + boardW / 2)) * scale - CARD_W * scale / 2;
      const y = boardCY + (p.y + CARD_H / 2 - (minY + boardH / 2)) * scale - CARD_H * scale / 2;
      return { ...p, x, y, w: CARD_W * scale, h: CARD_H * scale, scale };
    });
    // 库存/弃牌堆
    const footerY = WORLD.HEIGHT - LAYOUT.FOOTER_H + 28;
    const stock = { x: 60, y: footerY, w: CARD_W, h: CARD_H };
    const waste = { x: 180, y: footerY, w: CARD_W, h: CARD_H };
    return { board, stock, waste, scale };
  }

  function drawStockWaste(ctx, state, lay, scene, view) {
    const s = scene;
    // 库存（牌背 + 张数）
    if (state.stock.length > 0) {
      drawCardBack(ctx, lay.stock.x, lay.stock.y, lay.stock.w, lay.stock.h, s);
    } else {
      ctx.strokeStyle = '#ffffff44';
      ctx.setLineDash([5, 5]);
      roundRect(ctx, lay.stock.x, lay.stock.y, lay.stock.w, lay.stock.h, R);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(String(state.stock.length), lay.stock.x + lay.stock.w / 2, lay.stock.y - 4);
    if (view.labels && view.labels.stock) {
      ctx.fillStyle = '#e8d9b0';
      ctx.font = '13px "Segoe UI", "PingFang SC", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(view.labels.stock, lay.stock.x + lay.stock.w / 2, lay.stock.y + lay.stock.h + 8);
      ctx.fillText(view.labels.active, lay.waste.x + lay.waste.w / 2, lay.waste.y + lay.waste.h + 8);
    }

    // 弃牌堆（底牌 + 金边高亮）
    const active = state.waste[state.waste.length - 1];
    if (active) {
      if (active.wild) {
        drawWildCard(ctx, active, lay.waste.x, lay.waste.y, lay.waste.w, lay.waste.h);
      } else {
        drawCardFace(ctx, active, lay.waste.x, lay.waste.y, lay.waste.w, lay.waste.h, s);
      }
      // 金边高亮当前底牌
      ctx.strokeStyle = '#f5d76e';
      ctx.lineWidth = 4;
      roundRect(ctx, lay.waste.x - 3, lay.waste.y - 3, lay.waste.w + 6, lay.waste.h + 6, R + 2);
      ctx.stroke();
    }
  }

  function drawWildCard(ctx, card, x, y, w, h) {
    ctx.fillStyle = '#3a2f6b';
    roundRect(ctx, x, y, w, h, R); ctx.fill();
    ctx.strokeStyle = '#e0c060'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#f5d76e';
    ctx.font = 'bold 26px "Georgia", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', x + w / 2, y + h / 2 - 4);
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.fillText('WILD', x + w / 2, y + h / 2 + 18);
  }

  function draw(run, dt, view) {
    if (!run) {
      drawScene(view && view.sceneKey ? view.sceneKey : 'candle-hall', (view && view.t) || 0);
      return;
    }
    const state = run.state;
    const sceneKey = (view && view.sceneKey) || 'candle-hall';
    drawScene(sceneKey, (view && view.t) || 0);
    const scene = SCENES[sceneKey] || SCENES['candle-hall'];
    const lay = computeLayout(state);
    const playableIds = new Set(run.playableCards().map((c) => c.id));
    for (const p of lay.board) p.playable = playableIds.has(p.id);
    layout = lay;

    // 牌桌
    ctx.fillStyle = scene.table;
    roundRect(ctx, 40, LAYOUT.HUD_H + 12, WORLD.WIDTH - 80, WORLD.HEIGHT - LAYOUT.HUD_H - LAYOUT.FOOTER_H - 12, 18);
    ctx.fill();
    ctx.strokeStyle = scene.tableEdge; ctx.lineWidth = 3; ctx.stroke();

    // 皇家连胜金线
    if (view.royalStreakTtl > 0) drawRoyalStreak(ctx, view);

    // 目标说明横幅（桌面上沿，不遮挡牌）
    if (view.labels && view.labels.goal) {
      ctx.save();
      ctx.font = 'bold 18px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
      const tw = ctx.measureText(view.labels.goal).width;
      const bx = WORLD.WIDTH / 2 - tw / 2 - 16;
      const by = LAYOUT.HUD_H + 14;
      ctx.fillStyle = 'rgba(10,6,2,0.72)';
      roundRect(ctx, bx, by, tw + 32, 34, 17);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,215,110,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#f5d76e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(view.labels.goal, WORLD.WIDTH / 2, by + 17);
      ctx.restore();
    }

    // 牌阵
    for (const p of lay.board) {
      const c = p.card;
      const hovered = view.hover && view.hover.id === c.id;
      if (c.frozen && !c.thawed) {
        drawFrozenCard(ctx, c, p.x, p.y, p.w, p.h, scene);
      } else {
        drawCardFace(ctx, c, p.x, p.y, p.w, p.h, scene);
      }
      // 藏宝标记
      if (c.treasure) {
        ctx.fillStyle = '#e0c060';
        ctx.font = 'bold 16px "Segoe UI", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('♛', p.x + p.w - 10, p.y + 4);
      }
      // 可出高亮：金边 + 发光 + 顶部箭头
      if (p.playable) {
        ctx.save();
        ctx.shadowColor = '#f5d76e';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#ffe08a';
        ctx.lineWidth = 4;
        roundRect(ctx, p.x - 3, p.y - 3, p.w + 6, p.h + 6, R + 2);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath();
        ctx.moveTo(p.x + p.w / 2 - 7, p.y - 2);
        ctx.lineTo(p.x + p.w / 2 + 7, p.y - 2);
        ctx.lineTo(p.x + p.w / 2, p.y - 11);
        ctx.closePath();
        ctx.fill();
      }
      if (hovered) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        roundRect(ctx, p.x - 3, p.y - 3, p.w + 6, p.h + 6, R + 2);
        ctx.stroke();
      }
    }

    drawStockWaste(ctx, state, lay, scene, view);
  }

  function drawScene(key, t) {
    const s = SCENES[key] || SCENES['candle-hall'];
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, s.bgTop); g.addColorStop(1, s.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    s.decor(ctx, t);
  }

  function drawFrozenCard(ctx, card, x, y, w, h, scene) {
    drawCardFace(ctx, card, x, y, w, h, scene);
    ctx.fillStyle = 'rgba(120,180,255,0.42)';
    roundRect(ctx, x, y, w, h, R); ctx.fill();
    ctx.fillStyle = '#eaf4ff';
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('❄', x + w / 2, y + h / 2);
  }

  function drawRoyalStreak(ctx, view) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, view.royalStreakTtl);
    const g = ctx.createLinearGradient(0, LAYOUT.HUD_H, 0, WORLD.HEIGHT - LAYOUT.FOOTER_H);
    g.addColorStop(0, '#f5d76e'); g.addColorStop(1, '#e6a23c');
    ctx.strokeStyle = g;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#f5d76e';
    ctx.shadowBlur = 18;
    // 一条贯穿牌桌的金色缎带
    ctx.beginPath();
    for (let x = 60; x <= WORLD.WIDTH - 60; x += 12) {
      const y = (LAYOUT.HUD_H + WORLD.HEIGHT - LAYOUT.FOOTER_H) / 2 + Math.sin(x * 0.02 + view.royalStreakTtl * 4) * 60;
      if (x === 60) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function hitTest(x, y) {
    const lay = layout;
    if (!lay) return null;
    for (const p of lay.board) {
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return { kind: 'card', id: p.id };
    }
    if (lay.stock && x >= lay.stock.x && x <= lay.stock.x + lay.stock.w && y >= lay.stock.y && y <= lay.stock.y + lay.stock.h) {
      return { kind: 'stock' };
    }
    return null;
  }

  function debugLayout() {
    return layout;
  }

  return { draw, debugLayout, hitTest };
}
