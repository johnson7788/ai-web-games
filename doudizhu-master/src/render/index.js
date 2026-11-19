// DOUDIZHU MASTER · canvas 程序化渲染（霓虹街机风，零素材）
// 只画：背景/农民面板/底牌/牌桌/我的手牌/回合指示。文字除牌面符号外全部 ASCII，避免豆腐块。
// 提供 layout()/handCardAt() 供 main 命中检测与教程聚光。

import { RANK_LABELS, SUIT_SYMBOL, TYPES, TYPE_NAMES } from '../game/sim.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 52;

const CARD_W = 76;
const CARD_H = 108;
const MIN_GAP = 6;

const NEON = {
  bgTop: '#0a0e1e',
  bgBottom: '#101631',
  cyan: '#22d3ee',
  magenta: '#e879f9',
  amber: '#fbbf24',
  red: '#ff5d73',
  black: '#0b0e18',
  card: '#141a30',
  cardEdge: '#22315f',
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

function rankText(rank) {
  if (rank === 16) return 'JOK';
  if (rank === 17) return 'JOK';
  return RANK_LABELS[rank] ?? '?';
}

function isRedSuit(card) {
  return card.s === 1 || card.s === 2 || card.r >= 16;
}

function drawCard(ctx, x, y, w, h, card, opts = {}) {
  const { faceUp = true, selected = false, dim = false } = opts;
  ctx.save();
  if (selected) {
    ctx.shadowColor = NEON.amber;
    ctx.shadowBlur = 18;
  }
  roundRect(ctx, x, y, w, h, 8);
  if (!faceUp) {
    ctx.fillStyle = NEON.magenta;
    ctx.fill();
    ctx.strokeStyle = NEON.cyan;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(10,14,30,0.85)';
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 5);
    ctx.fill();
    ctx.fillStyle = NEON.cyan;
    ctx.font = `bold ${Math.floor(h * 0.28)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DDZ', x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }
  ctx.fillStyle = NEON.card;
  ctx.fill();
  ctx.strokeStyle = selected ? NEON.amber : NEON.cardEdge;
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (dim) { ctx.globalAlpha = 0.55; }

  const color = isRedSuit(card) ? NEON.red : '#e6ecff';
  const isJoker = card.r >= 16;
  // 左上角点数 + 花色
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.floor(h * 0.2)}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(rankText(card.r), x + 7, y + 6);
  if (!isJoker) {
    ctx.font = `${Math.floor(h * 0.16)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(SUIT_SYMBOL[card.s] || '', x + 7, y + 6 + h * 0.22);
  }
  // 中央大符号
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (isJoker) {
    ctx.fillStyle = card.r === 17 ? NEON.amber : NEON.cyan;
    ctx.font = `bold ${Math.floor(h * 0.24)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(card.r === 17 ? '★' : '☆', x + w / 2, y + h / 2);
  } else {
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.floor(h * 0.42)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(rankText(card.r), x + w / 2, y + h / 2 + 2);
  }
  ctx.restore();
}

function handGeometry(count, areaX, areaW, y, w = CARD_W, h = CARD_H) {
  if (count === 0) return [];
  let gap = MIN_GAP;
  let total = count * w + (count - 1) * gap;
  if (total > areaW) {
    w = Math.max(34, (areaW - (count - 1) * MIN_GAP) / count);
    h = w * (CARD_H / CARD_W);
    total = count * w + (count - 1) * MIN_GAP;
  }
  const x0 = areaX + (areaW - total) / 2;
  const rects = [];
  for (let i = 0; i < count; i += 1) {
    rects.push({ x: x0 + i * (w + MIN_GAP), y, w, h });
  }
  return rects;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize(dpr) {
    const scale = Math.min(dpr, 2);
    canvas.width = Math.floor(VIEW_W * scale);
    canvas.height = Math.floor(VIEW_H * scale);
    canvas.style.width = `${VIEW_W}px`;
    canvas.style.height = `${VIEW_H}px`;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function bg() {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, NEON.bgTop);
    g.addColorStop(1, NEON.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // 中央霓虹光晕
    const rg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.42, 40, VIEW_W / 2, VIEW_H * 0.42, 520);
    rg.addColorStop(0, 'rgba(34,211,238,0.10)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // 网格
    ctx.strokeStyle = 'rgba(34,211,238,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < VIEW_W; x += 64) { ctx.beginPath(); ctx.moveTo(x, HUD_H); ctx.lineTo(x, VIEW_H); ctx.stroke(); }
    for (let y = HUD_H; y < VIEW_H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); ctx.stroke(); }
  }

  function drawFarmerPanel(x, y, w, name, count, active, handSize) {
    ctx.save();
    roundRect(ctx, x, y, w, 96, 12);
    ctx.fillStyle = 'rgba(18,24,46,0.92)';
    ctx.fill();
    ctx.strokeStyle = active ? NEON.cyan : NEON.cardEdge;
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.stroke();
    // 头像
    ctx.fillStyle = NEON.magenta;
    ctx.beginPath();
    ctx.arc(x + 40, y + 40, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b0e18';
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AI', x + 40, y + 40);
    // 名字 + 张数
    ctx.fillStyle = '#e6ecff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(name, x + 72, y + 24);
    ctx.fillStyle = active ? NEON.amber : '#9aa6d0';
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`${count}`, x + 72, y + 52);
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('cards', x + 72, y + 72);
    // 剩余 ≤3 警示
    if (handSize <= 3 && handSize > 0) {
      ctx.fillStyle = NEON.red;
      ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('!', x + w - 22, y + 40);
    }
    ctx.restore();
  }

  function drawPlayed(move, playerName) {
    if (!move) return;
    const cards = move.cards;
    const w = 56;
    const h = 78;
    const gap = 8;
    const total = cards.length * w + (cards.length - 1) * gap;
    const x0 = VIEW_W / 2 - total / 2;
    const y = 212;
    // 牌型标签
    ctx.fillStyle = NEON.amber;
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${playerName} · ${TYPE_NAMES[move.type]}`, VIEW_W / 2, y - 8);
    for (let i = 0; i < cards.length; i += 1) {
      drawCard(ctx, x0 + i * (w + gap), y, w, h, cards[i], { faceUp: true });
    }
  }

  function drawBottomCards(cards) {
    const w = 44;
    const h = 62;
    const gap = 8;
    const total = cards.length * w + (cards.length - 1) * gap;
    const x0 = VIEW_W / 2 - total / 2;
    const y = 64;
    ctx.fillStyle = 'rgba(232,121,249,0.95)';
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('BOTTOM CARDS', VIEW_W / 2, y - 6);
    for (let i = 0; i < cards.length; i += 1) {
      drawCard(ctx, x0 + i * (w + gap), y, w, h, cards[i], { faceUp: true });
    }
  }

  function drawHand(state, view) {
    const hand = state.players[0].hand;
    const areaX = 40;
    const areaW = VIEW_W - 80;
    const y = VIEW_H - CARD_H - 26;
    const rects = handGeometry(hand.length, areaX, areaW, y);
    for (let i = 0; i < hand.length; i += 1) {
      const c = hand[i];
      const selected = state.selected.has(c.id);
      let lift = selected ? -14 : 0;
      if (view.hoverCard && view.hoverCard.id === c.id && !selected) lift = -6;
      drawCard(ctx, rects[i].x, rects[i].y + lift, rects[i].w, rects[i].h, c, { faceUp: true, selected });
    }
    return rects;
  }

  function drawGoalTag() {
    const text = 'EMPTY YOUR HAND = WIN';
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    const w = ctx.measureText(text).width + 40;
    const x = VIEW_W / 2 - w / 2;
    const y = VIEW_H - CARD_H - 50;
    ctx.fillStyle = 'rgba(10, 14, 30, 0.92)';
    roundRect(ctx, x, y - 16, w, 34, 17);
    ctx.fill();
    ctx.strokeStyle = NEON.cyan;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = NEON.cyan;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, VIEW_W / 2, y + 1);
  }

  function drawTitleScene() {
    // 标题屏背景：一张牌扇
    const fan = [{ r: 13, s: 1 }, { r: 14, s: 1 }, { r: 15, s: 3 }, { r: 16, s: -1 }, { r: 17, s: -1 }];
    const cx = VIEW_W / 2;
    const cy = VIEW_H * 0.5;
    for (let i = 0; i < fan.length; i += 1) {
      const angle = (i - (fan.length - 1) / 2) * 0.22;
      const rad = 250;
      const x = cx + Math.sin(angle) * rad - 34;
      const y = cy - Math.cos(angle) * rad - 54;
      ctx.save();
      ctx.translate(x + 34, y + 54);
      ctx.rotate(angle);
      drawCard(ctx, -34, -54, 68, 96, fan[i], { faceUp: true });
      ctx.restore();
    }
  }

  function layout(state) {
    const my = state ? state.players[0].hand : [];
    const myRects = state ? handGeometry(my.length, 40, VIEW_W - 80, VIEW_H - CARD_H - 26) : [];
    return {
      hand: myRects.map((r, i) => ({ ...r, card: my[i] })),
      farmers: [
        { x: 30, y: 70, w: 240, h: 96 },
        { x: VIEW_W - 270, y: 70, w: 240, h: 96 },
      ],
      center: { x: VIEW_W / 2 - 220, y: 212, w: 440, h: 90 },
      bottom: { x: VIEW_W / 2 - 80, y: 64, w: 160, h: 70 },
    };
  }

  function draw(state, dt, view) {
    bg();
    const shakeX = view.shake ? (Math.random() - 0.5) * view.shake : 0;
    const shakeY = view.shake ? (Math.random() - 0.5) * view.shake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    if (!state) {
      drawTitleScene();
      ctx.restore();
      return;
    }

    const active = state.phase === 'playing' ? state.turn : -1;
    const p1 = state.players[1];
    const p2 = state.players[2];
    drawFarmerPanel(30, 70, 240, 'FARMER 1', p1.hand.length, active === 1, p1.hand.length);
    drawFarmerPanel(VIEW_W - 270, 70, 240, 'FARMER 2', p2.hand.length, active === 2, p2.hand.length);

    drawBottomCards(state.bottomCards);
    const lastPlayerName = state.lastMove
      ? (state.lastPlayer === 0 ? 'YOU' : state.lastPlayer === 1 ? 'FARMER 1' : 'FARMER 2')
      : '';
    drawPlayed(state.lastMove, lastPlayerName);

    drawHand(state, view);
    drawGoalTag();

    if (view.flash > 0) {
      ctx.fillStyle = `rgba(232,121,249,${Math.min(0.5, view.flash)})`;
      ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H);
    }
    ctx.restore();
  }

  function handCardAt(x, y, state) {
    if (!state) return null;
    const rects = handGeometry(state.players[0].hand.length, 40, VIEW_W - 80, VIEW_H - CARD_H - 26);
    for (let i = rects.length - 1; i >= 0; i -= 1) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y - 14 && y <= r.y + r.h) {
        return state.players[0].hand[i];
      }
    }
    return null;
  }

  return { draw, layout, handCardAt, resize, debugLayout: () => layout(null) };
}
