// POKER RUSH 7 · Canvas 2D 渲染（霓虹街机）：背景网格 / 四泳道 / 卡牌 / 粒子 / 标题场景。
// 只消费 run.state + view（fxQueue/shake）。像素换算全部在此完成（sim 只给 lane + x）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout() }。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';
import { SUITS, RANKS, COLORS } from '../game/sim.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const LANE_H = (LAYOUT.LANE_BOTTOM - LAYOUT.LANE_TOP) / GAME.LANE_COUNT;

// ---- 背景离屏缓存 ----
let bgCache = null;
function getBackground() {
  if (bgCache) return bgCache;
  bgCache = document.createElement('canvas');
  bgCache.width = W;
  bgCache.height = H;
  const g = bgCache.getContext('2d');

  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b0b22');
  sky.addColorStop(0.5, '#0f1030');
  sky.addColorStop(1, '#16093a');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // 远景霓虹光斑
  const glow = g.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.42, 620);
  glow.addColorStop(0, 'rgba(180,92,255,0.20)');
  glow.addColorStop(0.5, 'rgba(77,124,255,0.10)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  // 地平线网格（透视感）
  g.strokeStyle = 'rgba(120,120,255,0.14)';
  g.lineWidth = 1;
  for (let x = -H; x < W; x += 64) {
    g.beginPath(); g.moveTo(x, H); g.lineTo(x + H * 0.6, LAYOUT.LANE_TOP); g.stroke();
  }
  g.strokeStyle = 'rgba(120,120,255,0.10)';
  for (let y = LAYOUT.LANE_TOP; y <= H; y += 40) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
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

function laneCenterY(lane) {
  return LAYOUT.LANE_TOP + lane * LANE_H + LANE_H / 2;
}

// ---- 单张卡 ----
function drawCard(g, card, x, y, clock) {
  const w = LAYOUT.CARD_W;
  const h = LAYOUT.CARD_H;
  g.save();

  if (card.rock) {
    // 岩石卡：灰色石体 + 裂纹 + 红色叹号
    const grad = g.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#5a5f78');
    grad.addColorStop(1, '#34384c');
    g.fillStyle = grad;
    roundRect(g, x, y, w, h, 10);
    g.fill();
    g.strokeStyle = '#8b90ad';
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = 'rgba(20,20,32,0.8)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x + w * 0.28, y + h * 0.2);
    g.lineTo(x + w * 0.6, y + h * 0.5);
    g.lineTo(x + w * 0.42, y + h * 0.82);
    g.stroke();
    // 红色叹号徽章
    g.fillStyle = '#ff3b5c';
    g.beginPath();
    g.arc(x + w * 0.78, y + h * 0.78, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = '900 16px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', x + w * 0.78, y + h * 0.79);
    g.restore();
    return;
  }

  // 底色（目标匹配的关键属性）
  const color = COLORS[card.colorIdx] || COLORS[0];
  const neon = g.createLinearGradient(x, y, x, y + h);
  neon.addColorStop(0, color.hex);
  neon.addColorStop(1, shade(color.hex, -0.22));
  g.fillStyle = neon;
  roundRect(g, x, y, w, h, 10);
  g.fill();

  // 发光描边
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 2;
  roundRect(g, x, y, w, h, 10);
  g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 1;
  roundRect(g, x + 2, y + 2, w - 4, h - 4, 8);
  g.stroke();

  // 点数（左上角）+ 花色符号（中央）
  const suit = SUITS[card.suitIdx];
  const rank = RANKS[card.rankIdx];
  g.fillStyle = 'rgba(255,255,255,0.98)';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.font = '900 20px system-ui, sans-serif';
  g.fillText(rank, x + 8, y + 7);
  g.font = '22px system-ui, sans-serif';
  g.fillText(suit ? suit.sym : '', x + 8, y + 27);

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '44px system-ui, sans-serif';
  g.fillText(suit ? suit.sym : '', x + w / 2, y + h * 0.58);

  // 已点对的卡：绿色对勾 + 轻微压暗
  if (card.use) {
    g.fillStyle = 'rgba(8,20,14,0.35)';
    roundRect(g, x, y, w, h, 10);
    g.fill();
    g.strokeStyle = '#4dff88';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(x + w * 0.28, y + h * 0.52);
    g.lineTo(x + w * 0.44, y + h * 0.68);
    g.lineTo(x + w * 0.74, y + h * 0.34);
    g.stroke();
  }
  g.restore();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let gg = (n >> 8) & 255;
  let b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + r * amt)));
  gg = Math.max(0, Math.min(255, Math.round(gg + gg * amt)));
  b = Math.max(0, Math.min(255, Math.round(b + b * amt)));
  return `rgb(${r},${gg},${b})`;
}

function drawTitleScene(g, clock) {
  g.drawImage(getBackground(), 0, 0);
  // 漂浮的霓虹卡
  const demo = [
    { x: 210, y: 240, c: 0, s: 0, r: 11 },
    { x: 430, y: 300, c: 2, s: 1, r: 0 },
    { x: 650, y: 200, c: 4, s: 2, r: 7 },
    { x: 880, y: 320, c: 5, s: 3, r: 12 },
    { x: 1060, y: 240, c: 1, s: 0, r: 5 },
  ];
  for (const d of demo) {
    const bob = Math.sin(clock * 1.6 + d.x) * 6;
    drawCard(g, { ok: true, use: false, rock: false, suitIdx: d.s, rankIdx: d.r, colorIdx: d.c }, d.x, d.y + bob, clock);
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;

  function debugLayout() {
    return {
      target: { x: W / 2 - 200, y: LAYOUT.HUD_H + 8, w: 400, h: LAYOUT.TARGET_H - 8 },
      lanes: { x: 0, y: LAYOUT.LANE_TOP, w: W, h: LAYOUT.LANE_BOTTOM - LAYOUT.LANE_TOP },
    };
  }

  function draw(state, dt, view) {
    clock += dt || 0;
    const v = view || {};
    lastState = state;
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    if (!state) {
      drawTitleScene(ctx, clock);
      ctx.restore();
      return;
    }

    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(), 0, 0);

    // 泳道分隔（虚线）
    ctx.strokeStyle = 'rgba(120,120,255,0.14)';
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 12]);
    for (let i = 1; i < GAME.LANE_COUNT; i += 1) {
      const y = LAYOUT.LANE_TOP + i * LANE_H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 卡牌（按 lane 分组，稳定 z 顺序）
    for (const card of state.cards) {
      const y = laneCenterY(card.lane) - LAYOUT.CARD_H / 2;
      drawCard(ctx, card, card.x, y, clock);
    }

    // 粒子特效
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.ttl <= 0) continue;
        const a = Math.max(0, fx.ttl / fx.life);
        if (fx.type === 'correct') {
          ctx.fillStyle = `rgba(77,255,136,${a})`;
          ctx.font = '900 22px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`+${fx.score}`, fx.x, fx.y - (1 - a) * 30);
        } else if (fx.type === 'wrong') {
          ctx.fillStyle = `rgba(255,59,92,${a})`;
          ctx.font = '900 20px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✕', fx.x, fx.y - (1 - a) * 26);
        }
      }
    }

    ctx.restore();
  }

  return { draw, debugLayout };
}
