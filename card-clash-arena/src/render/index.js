// Canvas 2D 渲染：霓虹竞技场 + 对手卡 + 属性徽章 + 手牌（程序化，零素材）
// 主题：霓虹街机。所有卡片/背景/特效均为代码绘制。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';
import { CARDS, ATTR_KEYS } from '../../config/cards.js';
import { t } from '../core/i18n.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

const ATTR_COLOR = ['#ff5b6e', '#2ee6a8', '#2fd8ff']; // POWER / VITALITY / SPEED
const ATTR_DIM = ['rgba(255,91,110,0.16)', 'rgba(46,230,168,0.16)', 'rgba(47,216,255,0.16)'];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function font(ctx, size, weight = 'bold') {
  ctx.font = `${weight} ${size}px "PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", "Segoe UI", "Microsoft YaHei", sans-serif`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbStr(hex, a = 1) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// 手牌布局（供点击命中与教程高亮共用）
export function handLayout(state) {
  const n = state ? state.hand.length : 0;
  const cw = 220;
  const ch = 140;
  const gap = 14;
  const total = n * cw + (n - 1) * gap;
  const x0 = (W - total) / 2;
  const y = LAYOUT.HAND_Y;
  return state.hand.map((cardId, i) => ({ cardId, x: x0 + i * (cw + gap), y, w: cw, h: ch }));
}

function drawSigil(ctx, cardId, cx, cy, size, color, t) {
  const shapes = ['diamond', 'circle', 'triangle', 'hex'];
  const s = shapes[cardId % 4];
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16 + Math.sin(t * 3 + cardId) * 4;
  ctx.fillStyle = rgbStr(color, 0.9);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.translate(cx, cy);
  if (s === 'diamond') {
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-size * 0.36, -size * 0.36, size * 0.72, size * 0.72);
    ctx.strokeRect(-size * 0.36, -size * 0.36, size * 0.72, size * 0.72);
  } else if (s === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (s === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.45);
    ctx.lineTo(size * 0.45, size * 0.4);
    ctx.lineTo(-size * 0.45, size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = Math.cos(a) * size * 0.45;
      const py = Math.sin(a) * size * 0.45;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawCard(ctx, { x, y, w, h, cardId, attr, faceDown = false, selected = false, hover = false, lift = 0 }) {
  ctx.save();
  if (lift) ctx.translate(0, -lift);
  if (selected) {
    ctx.shadowColor = '#ffd84e';
    ctx.shadowBlur = 26;
  } else if (hover) {
    ctx.shadowColor = '#ffd84e';
    ctx.shadowBlur = 14;
  }

  const color = faceDown ? '#4a4f6a' : CARDS[cardId].color;

  // 卡体
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, faceDown ? '#20243a' : '#141828');
  grad.addColorStop(1, faceDown ? '#161a2c' : '#0c0f1c');
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = selected ? 4 : 3;
  ctx.strokeStyle = selected ? '#ffd84e' : color;
  roundRect(ctx, x, y, w, h, 12);
  ctx.stroke();

  if (faceDown) {
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    font(ctx, Math.max(22, Math.round(Math.min(w, h) * 0.34)));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }

  // 名字（顶部，随卡宽缩放）
  const nameFont = w >= 190 ? 15 : 13;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  font(ctx, nameFont);
  ctx.fillText(CARDS[cardId].name.en, x + 12, y + nameFont + 8);

  // 徽记（中上）
  const sigSize = Math.min(w, h) * 0.26;
  drawSigil(ctx, cardId, x + w / 2, y + h * 0.42, sigSize, color, 0);

  // 三属性（底部三行，整宽，当前属性整行高亮）
  const attrs = [
    { key: 'statPower', v: CARDS[cardId].stats[0], c: ATTR_COLOR[0] },
    { key: 'statVitality', v: CARDS[cardId].stats[1], c: ATTR_COLOR[1] },
    { key: 'statSpeed', v: CARDS[cardId].stats[2], c: ATTR_COLOR[2] },
  ];
  const rowH = h >= 200 ? 22 : 17;
  const statFont = w >= 190 ? 14 : 12;
  const startY = y + h - rowH * 3 - 8;
  for (let i = 0; i < 3; i += 1) {
    const a = attrs[i];
    const isCur = i === attr;
    const rowTop = startY + i * rowH;
    if (isCur) {
      roundRect(ctx, x + 6, rowTop, w - 12, rowH - 3, 5);
      ctx.fillStyle = ATTR_DIM[i];
      ctx.fill();
      ctx.strokeStyle = a.c;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x + 6, rowTop, w - 12, rowH - 3, 5);
      ctx.stroke();
    }
    ctx.fillStyle = isCur ? a.c : 'rgba(255,255,255,0.6)';
    font(ctx, isCur ? statFont : statFont, isCur ? 'bold' : 'normal');
    ctx.fillText(`${t(a.key)} ${a.v}`, x + 12, rowTop + rowH * 0.68);
  }

  ctx.restore();
}

function buildBackground() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  // 暗底
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0e1c');
  g.addColorStop(0.55, '#10142a');
  g.addColorStop(1, '#180f2e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 霓虹地平线辉光
  const glowY = H * 0.52;
  const hg = ctx.createRadialGradient(W / 2, glowY, 40, W / 2, glowY, 520);
  hg.addColorStop(0, 'rgba(255,45,120,0.20)');
  hg.addColorStop(0.5, 'rgba(47,216,255,0.10)');
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, H);

  // 透视网格地面
  ctx.strokeStyle = 'rgba(120,80,255,0.28)';
  ctx.lineWidth = 1;
  const horizon = H * 0.52;
  for (let i = 0; i < 12; i += 1) {
    const t = i / 12;
    const y = horizon + Math.pow(t, 1.7) * (H - horizon);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,80,255,0.18)';
  for (let i = -8; i <= 8; i += 1) {
    const x = W / 2 + i * 120;
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 40, horizon);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // 扫描线
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const bg = buildBackground();

  return {
    layoutHand: handLayout,
    draw(state, dt, view) {
      const time = view.time;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(bg, 0, 0);

      if (!state) {
        // 标题屏演示：避开标题文字/按钮，放在中下部空白区
        drawCard(ctx, { x: 190, y: 340, w: 160, h: 220, cardId: 0, attr: 0, faceDown: false });
        drawAttrBadge(ctx, 0, 500, 400, time);
        drawCard(ctx, { x: 850, y: 360, w: 200, h: 140, cardId: 6, attr: 0 });
        drawCard(ctx, { x: 1070, y: 360, w: 200, h: 140, cardId: 12, attr: 0 });
        return;
      }

      // 对手卡（结算后翻面）
      const revealEnemy = state.phase === 'resolving' || state.phase === 'won' || state.phase === 'lost';
      drawCard(ctx, {
        x: 555, y: 76, w: 170, h: 232, cardId: state.enemyPlayed != null ? state.enemyPlayed : 1,
        attr: state.roundAttribute, faceDown: !revealEnemy, big: false,
      });
      // 对手名
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff7b8f';
      font(ctx, 15);
      ctx.fillText(t('hpRival'), 640, 64);

      // 我方已出牌（结算期显示）
      if (state.phase === 'resolving' || state.phase === 'won' || state.phase === 'lost') {
        if (state.playerPlayed != null) {
          drawCard(ctx, { x: 300, y: 150, w: 150, h: 200, cardId: state.playerPlayed, attr: state.roundAttribute, lift: 0 });
          ctx.textAlign = 'center';
          ctx.fillStyle = '#7ef0c0';
          font(ctx, 15);
          ctx.fillText(t('hpYou'), 375, 138);
        }
      }

      // 属性徽章
      drawAttrBadge(ctx, state.roundAttribute, W / 2, state.phase === 'resolving' ? 470 : 372, time);

      // 连击火焰
      if (state.combo >= 2) drawCombo(ctx, state.combo, 640, 420, time);

      // 伤害浮字
      for (const fx of view.fx) drawFx(ctx, fx);

      // 手牌
      const cards = handLayout(state);
      for (const c of cards) {
        const isPlayed = state.phase !== 'reveal' && state.phase !== 'playerTurn' && c.cardId === state.playerPlayed;
        drawCard(ctx, {
          x: c.x, y: c.y, w: c.w, h: c.h, cardId: c.cardId, attr: state.roundAttribute,
          selected: view.selectedCard === c.cardId, hover: view.hoverCard === c.cardId,
          lift: (view.selectedCard === c.cardId || view.hoverCard === c.cardId) ? 8 : 0,
        });
      }

      // 回合提示
      if (state.phase === 'reveal') {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        font(ctx, 18);
        ctx.fillText(t('tapToPlay'), W / 2, 470);
      }
    },

    debugLayout() {
      return { handY: LAYOUT.HAND_Y, handH: LAYOUT.HAND_H };
    },
  };

  function drawAttrBadge(ctx, attr, x, y, time) {
    const label = t(['attrPower', 'attrVitality', 'attrSpeed'][attr]);
    const color = ATTR_COLOR[attr];
    const pulse = 1 + Math.sin(time * 4) * 0.03;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    roundRect(ctx, -120, -30, 240, 60, 30);
    ctx.fillStyle = 'rgba(10,12,24,0.9)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    roundRect(ctx, -120, -30, 240, 60, 30);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    font(ctx, 26);
    ctx.fillText(label, 0, 2);
    ctx.restore();
  }

  function drawCombo(ctx, combo, x, y, time) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffb020';
    ctx.shadowColor = '#ff7a00';
    ctx.shadowBlur = 18;
    font(ctx, 24);
    const flick = combo >= GAME.COMBO_BONUS_2_AT ? '🔥🔥' : '🔥';
    ctx.fillText(`${flick} ${t('comboOn', { n: combo })}`, x, y);
    ctx.restore();
  }

  function drawFx(ctx, fx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, fx.ttl / fx.maxTtl));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = fx.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = fx.color;
    font(ctx, 34);
    ctx.fillText(fx.text, fx.x, fx.y - (1 - fx.ttl / fx.maxTtl) * 30);
    ctx.restore();
  }
}
