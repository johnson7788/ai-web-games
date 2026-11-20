// src/render/index.js — 赛博牌桌 Canvas 2D 渲染（程序化，零素材）。
// 画：霓虹牌桌背景 / 卡牌（发光牌背 + 点数字面）/ 三家手牌 / 中央牌池 / 炸弹红光震屏。
import { WORLD } from '../../config/game.config.js';
import { rankLabel, SUIT_CHARS, SUIT_RED } from '../game/cards.js';

const CARD = { w: 76, h: 104, r: 8 };
const SMALL = { w: 46, h: 64, r: 6 };

// 人类手牌扇面布局（渲染与点击命中共用同一份几何）
export function handLayout(n) {
  const overlap = n > 16 ? 44 : 46;
  const totalW = Math.min(CARD.w + (n - 1) * overlap, 1100);
  const gap = (totalW - CARD.w) / Math.max(1, n - 1);
  const baseY = 500;
  return {
    n,
    w: CARD.w,
    h: CARD.h,
    baseY,
    totalW,
    gap,
    xOf(i) { return 640 - totalW / 2 + i * gap; },
  };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cardColor(rank, suit) {
  if (rank >= 16) return '#ff4fd8'; // 王：品红
  return SUIT_RED(suit) ? '#ff5d73' : '#7fe7ff';
}

function drawCardFace(ctx, x, y, w, h, card) {
  rr(ctx, x, y, w, h, 8);
  ctx.fillStyle = '#0d0a18';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(127,231,255,0.35)';
  ctx.stroke();

  const color = cardColor(card.rank, card.suit);
  const label = rankLabel(card.rank);
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.font = `700 ${Math.round(w * 0.28)}px 'Segoe UI', 'PingFang SC', monospace`;
  ctx.fillText(label, x + w * 0.10, y + h * 0.06);

  if (card.rank < 16) {
    ctx.font = `${Math.round(h * 0.34)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SUIT_CHARS[card.suit], x + w * 0.5, y + h * 0.52);
    ctx.textAlign = 'left';
  } else {
    ctx.font = `700 ${Math.round(w * 0.22)}px 'Segoe UI', monospace`;
    ctx.fillText(card.rank === 16 ? 'JOKER' : 'JOKER', x + w * 0.10, y + h * 0.40);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

function drawCardBack(ctx, x, y, w, h) {
  rr(ctx, x, y, w, h, 8);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#241238');
  g.addColorStop(1, '#0b0614');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,79,216,0.55)';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,79,216,0.22)';
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + w / 2 + i * 14, y + 6);
    ctx.lineTo(x + w / 2 + i * 14, y + h - 6);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,79,216,0.5)';
  ctx.font = `700 ${Math.round(w * 0.3)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('◈', x + w / 2, y + h / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawTable(ctx, t) {
  const grad = ctx.createRadialGradient(640, 360, 60, 640, 360, 720);
  grad.addColorStop(0, '#160b2a');
  grad.addColorStop(0.55, '#0d0618');
  grad.addColorStop(1, '#060309');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 霓虹网格
  ctx.strokeStyle = 'rgba(127,231,255,0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.WIDTH; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
  }
  for (let y = 0; y <= WORLD.HEIGHT; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
  }

  // 中央牌桌：软光晕（无硬边线，避免切到文字/牌）
  const glow = ctx.createRadialGradient(640, 340, 60, 640, 340, 430);
  const pulse = 0.08 + 0.03 * Math.sin(t * 1.6);
  glow.addColorStop(0, `rgba(255,79,216,${pulse})`);
  glow.addColorStop(0.6, 'rgba(255,79,216,0.03)');
  glow.addColorStop(1, 'rgba(255,79,216,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(640, 340, 430, 240, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const state = {
    t: 0,
    shakeUntil: 0,
    bombUntil: 0,
  };

  function seatCardPos(seat) {
    if (seat === 0) return { x: 640, y: 470 };
    if (seat === 1) return { x: 200, y: 150 };
    return { x: 1080, y: 150 };
  }

  function drawSeat(ctx, seat, hud, view) {
    const cp = seatCardPos(seat);

    // AI 牌背
    if (seat !== 0) {
      const count = hud.handCounts[seat];
      for (let i = 0; i < Math.min(count, 12); i += 1) {
        drawCardBack(ctx, cp.x - SMALL.w / 2 + (i - Math.min(count, 12) / 2) * 16, cp.y, SMALL.w, SMALL.h);
      }
    }

    // 各家已出的牌（带深色背板，避免与桌面色/状态栏重叠）
    const last = hud.lastPlay;
    if (last && last.seat === seat) {
      const n = last.cards.length;
      const totalW = n * 30 + 10;
      let sx = seat === 0 ? 640 - totalW / 2 : seat === 1 ? 330 - totalW / 2 : 950 - totalW / 2;
      const sy = seat === 0 ? 300 : 210;
      ctx.fillStyle = 'rgba(11,6,20,0.55)';
      rr(ctx, sx - 6, sy - 6, totalW + 12, SMALL.h + 12, 10);
      ctx.fill();
      for (const card of last.cards) {
        drawCardFace(ctx, sx, sy, SMALL.w, SMALL.h, card);
        sx += 30;
      }
    }
  }

  function drawHuman(ctx, hud, view) {
    const hand = hud.hand;
    const n = hand.length;
    if (!n) return;
    const L = handLayout(n);
    const sel = view.selectedIds || new Set();
    for (let i = 0; i < n; i += 1) {
      const card = hand[i];
      const raised = sel.has(card.id);
      const x = L.xOf(i);
      const y = L.baseY - (raised ? 28 : 0);
      if (raised) {
        ctx.save();
        ctx.shadowColor = '#ffc94a';
        ctx.shadowBlur = 18;
        drawCardFace(ctx, x, y, L.w, L.h, card);
        ctx.restore();
        ctx.strokeStyle = '#ffc94a';
        ctx.lineWidth = 4;
        rr(ctx, x - 3, y - 3, L.w + 6, L.h + 6, 12);
        ctx.stroke();
      } else {
        drawCardFace(ctx, x, y, L.w, L.h, card);
      }
    }
  }

  function drawHole(ctx, hud) {
    const hole = hud.hole;
    if (!hole) return;
    const reveal = hud.landlord >= 0;
    // 底牌区加一块深色背板，避免被中央光晕/网格线切到
    ctx.fillStyle = 'rgba(11,6,20,0.72)';
    rr(ctx, 640 - 100, 108, 200, 82, 12);
    ctx.fill();
    for (let i = 0; i < hole.length; i += 1) {
      const x = 640 + (i - 1) * 56 - SMALL.w / 2;
      const y = 120;
      if (reveal) drawCardFace(ctx, x, y, SMALL.w, SMALL.h, hole[i]);
      else drawCardBack(ctx, x, y, SMALL.w, SMALL.h);
    }
  }

  function drawEffects(ctx) {
    const now = performance.now();
    if (now < state.bombUntil) {
      const k = 1 - (state.bombUntil - now) / 500;
      const g = ctx.createRadialGradient(640, 360, 20, 640, 360, 760);
      g.addColorStop(0, `rgba(255,40,80,${0.55 * (1 - k)})`);
      g.addColorStop(1, 'rgba(255,40,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
  }

  function draw(view) {
    const now = performance.now();
    state.t = now / 1000;
    ctx.save();
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    drawTable(ctx, state.t);

    if (!view || !view.hud) {
      ctx.restore();
      return;
    }

    const hud = view.hud;
    drawHole(ctx, hud);
    for (const seat of [1, 2, 0]) drawSeat(ctx, seat, hud, view);
    drawHuman(ctx, hud, view);
    drawEffects(ctx);
    ctx.restore();
  }

  return {
    draw,
    bomb() {
      state.bombUntil = performance.now() + 500;
      state.shakeUntil = performance.now() + 320;
    },
    set t(v) { state.t = v; },
  };
}

export default createRender;
