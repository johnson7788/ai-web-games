// Canvas 2D 渲染：牌桌 + 摸牌/弃牌堆 + AI 手牌 + 玩家手牌（可出高亮）+ 当前色。
// 美术件（背景/牌面/头像）走 art.js 的 AI 素材；玩法层（牌号/高亮/当前色/浮字/命中几何）保留程序化。
import { WORLD, CARD, LAYOUT, COLORS, COLOR_KEYS } from '../../config/game.config.js';
import { topCard } from '../game/sim.js';
import { get as art, spec as artSpec } from './art.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function valueGlyph(value) {
  if (value === 'skip') return '⊘';
  if (value === 'reverse') return '⇄';
  if (value === 'draw2') return '+2';
  if (value === 'wild') return '★';
  if (value === 'wild4') return '+4';
  return value;
}

// 按 manifest pivot 对齐画 sprite（center 中心 / bottom 脚底 / top 左上）。无素材返回 false。
function drawSprite(ctx, key, cx, cy, w, h) {
  const img = art(key);
  if (!img) return false;
  const s = artSpec(key) || {};
  let x = cx - w / 2;
  let y = cy - h / 2;
  if (s.pivot === 'top') y = cy;
  else if (s.pivot === 'bottom') y = cy - h;
  ctx.drawImage(img, x, y, w, h);
  return true;
}

function drawCard(ctx, x, y, c, faceUp, highlight, scale = 1) {
  const w = CARD.W * scale;
  const h = CARD.H * scale;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  if (highlight) {
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 16;
  }

  if (!faceUp) {
    if (!drawSprite(ctx, 'card-back', cx, cy, w, h)) {
      ctx.fillStyle = COLORS.cardBack;
      roundRect(ctx, x, y, w, h, CARD.R * scale);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3 * scale;
      roundRect(ctx, x + 3 * scale, y + 3 * scale, w - 6 * scale, h - 6 * scale, (CARD.R - 2) * scale);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `900 ${22 * scale}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CC', cx, cy);
    ctx.restore();
    return;
  }

  // 面牌：sprite 提供边框/底色/椭圆面板（wild 的四色轮已烘焙）；牌号（玩法层）程序化叠加。
  const key = c.color === 'wild' ? 'card-wild' : `card-${c.color}`;
  const spriteOk = drawSprite(ctx, key, cx, cy, w, h);
  if (!spriteOk) {
    ctx.fillStyle = c.color === 'wild' ? COLORS.wild : COLORS[c.color];
    roundRect(ctx, x, y, w, h, CARD.R * scale);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3 * scale;
    roundRect(ctx, x + 3 * scale, y + 3 * scale, w - 6 * scale, h - 6 * scale, (CARD.R - 2) * scale);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.32, h * 0.4, -0.4, 0, Math.PI * 2);
    ctx.fill();
    if (c.color === 'wild') {
      const r = w * 0.2;
      const quad = [COLORS.red, COLORS.yellow, COLORS.green, COLORS.blue];
      for (let i = 0; i < 4; i += 1) {
        ctx.fillStyle = quad[i];
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, (i * Math.PI) / 2, ((i + 1) * Math.PI) / 2);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.shadowBlur = 0;
  // 中心牌号
  ctx.fillStyle = c.color === 'wild' ? (spriteOk ? '#1f2937' : '#fff') : COLORS[c.color];
  ctx.font = `900 ${34 * scale}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(valueGlyph(c.value), cx, cy + 1);
  // 角标（sprite 上是奶油色 pip，用深色；回退色块用白色）
  ctx.fillStyle = spriteOk ? '#1f2937' : '#fff';
  ctx.font = `800 ${15 * scale}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(valueGlyph(c.value), x + 8 * scale, y + 16 * scale);
  ctx.restore();
}

export function handCardRects(run) {
  const hand = run.hands[0];
  const n = hand.length;
  if (n === 0) return [];
  const maxW = 1000;
  const spacing = Math.min(CARD.W + 10, maxW / n);
  const totalW = spacing * (n - 1) + CARD.W;
  const startX = LAYOUT.hand.cx - totalW / 2;
  return hand.map((c, i) => ({ x: startX + i * spacing, y: LAYOUT.hand.y, w: CARD.W, h: CARD.H, index: i }));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const popups = [];

  function popup(text, x, y, color = COLORS.ink) {
    popups.push({ text, x, y, color, t: 0, life: 0.9 });
  }
  function update(dt) {
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      popups[i].t += dt;
      if (popups[i].t >= popups[i].life) popups.splice(i, 1);
    }
  }

  function drawBackground() {
    if (!drawSprite(ctx, 'bg-table', WORLD.WIDTH / 2, 0, WORLD.WIDTH, WORLD.HEIGHT)) {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      const g = ctx.createRadialGradient(640, 320, 80, 640, 360, 820);
      g.addColorStop(0, COLORS.bgGlow);
      g.addColorStop(1, COLORS.bg);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
  }

  function drawPiles(run, view) {
    // 摸牌堆
    drawCard(ctx, LAYOUT.draw.x - CARD.W / 2, LAYOUT.draw.y - CARD.H / 2, null, false, false);
    ctx.fillStyle = 'rgba(242,246,242,0.7)';
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${view.drawLabel || 'Draw'} (${run.deck.length})`, LAYOUT.draw.x, LAYOUT.draw.y + CARD.H / 2 + 22);
    // 弃牌堆
    const top = topCard(run);
    drawCard(ctx, LAYOUT.discard.x - CARD.W / 2, LAYOUT.discard.y - CARD.H / 2, top, true, false);
    // 当前色
    ctx.fillStyle = COLORS[run.color];
    ctx.beginPath();
    ctx.arc(LAYOUT.discard.x + CARD.W / 2 + 30, LAYOUT.discard.y - CARD.H / 2 + 10, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawAI(run, view) {
    for (let p = 1; p < run.hands.length; p += 1) {
      const pos = LAYOUT.ai[p - 1];
      const count = run.hands[p].length;
      const isTurn = run.turn === p;
      // 头像：sprite 按 manifest 高宽比缩放到 80px 高，缺失画圆块占位
      const avKey = `avatar-${p}`;
      const avH = 80;
      const sp = artSpec(avKey) || {};
      const avW = avH * (sp.w / sp.h || 0.85);
      if (!drawSprite(ctx, avKey, pos.x - 100, pos.y - 3, avW, avH)) {
        ctx.fillStyle = 'rgba(242,246,242,0.15)';
        ctx.beginPath();
        ctx.arc(pos.x - 100, pos.y - 3, avH / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // 几张牌背
      const show = Math.min(count, 5);
      for (let i = 0; i < show; i += 1) {
        drawCard(ctx, pos.x - 60 + i * 16, pos.y - 40, null, false, false, 0.6);
      }
      ctx.fillStyle = isTurn ? COLORS.accent : 'rgba(242,246,242,0.85)';
      ctx.font = `800 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${view.botLabel || 'Bot'} ${p} · ${count}`, pos.x, pos.y + 50);
      if (isTurn) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = `600 14px ${FONT}`;
        ctx.fillText(view.thinkingLabel || 'thinking…', pos.x, pos.y + 72);
      }
    }
  }

  function drawHand(run, view) {
    const rects = handCardRects(run);
    const playable = view.playable || new Set();
    rects.forEach((r) => {
      const c = run.hands[0][r.index];
      const isPlay = playable.has(r.index);
      const lift = isPlay ? 18 : 0;
      drawCard(ctx, r.x, r.y - lift, c, true, isPlay && view.playerTurn);
    });
    // 回合提示
    ctx.fillStyle = view.playerTurn ? COLORS.accent : 'rgba(242,246,242,0.6)';
    ctx.font = `800 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(view.playerTurn ? (view.yourTurnLabel || 'Your turn') : '', LAYOUT.hand.cx, LAYOUT.hand.y - 50);
  }

  function drawPopups() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of popups) {
      const k = p.t / p.life;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.font = `800 26px ${FONT}`;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - k * 40);
    }
    ctx.globalAlpha = 1;
  }

  function render(view) {
    const { run } = view;
    drawBackground();
    if (run) {
      drawPiles(run, view);
      drawAI(run, view);
      drawHand(run, view);
    }
    drawPopups();
  }

  function hitHand(x, y, run) {
    const rects = handCardRects(run);
    for (let i = rects.length - 1; i >= 0; i -= 1) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y - 24 && y <= r.y + r.h) return r.index;
    }
    return -1;
  }
  function hitDraw(x, y) {
    return Math.abs(x - LAYOUT.draw.x) <= CARD.W / 2 + 8 && Math.abs(y - LAYOUT.draw.y) <= CARD.H / 2 + 8;
  }

  function clearEffects() { popups.length = 0; }

  return { render, update, popup, hitHand, hitDraw, handCardRects, clearEffects };
}
