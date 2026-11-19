// WANHAO CASINO · Canvas 2D 渲染（霓虹街机风格，全程序化，零素材）
// 布局：顶部 HUD(DOM 60px) / 底部动作条(DOM 100px) 之外全是 canvas 牌桌。
// 牌桌：上方庄家 + 骰子；下方三门（太阳/月亮/星），每门一叠筹码 + 两张牌。

import { WORLD, GAME, DOORS, HAND_ORDER } from '../../config/game.config.js';
import { tileLabel } from '../game/sim.js';
import { t } from '../core/i18n.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

// 门面板布局（供点击命中与视觉一致）
export function doorLayouts() {
  const top = 258;
  const bottom = 596;
  const cols = [
    { key: 'sun', cx: 220, w: 330 },
    { key: 'moon', cx: 640, w: 330 },
    { key: 'star', cx: 1060, w: 330 },
  ];
  return cols.map((c) => ({ key: c.key, x: c.cx - c.w / 2, y: top, w: c.w, h: bottom - top, cx: c.cx }));
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

function drawTile(ctx, x, y, w, h, tile, faceUp, color) {
  ctx.save();
  rr(ctx, x, y, w, h, 10);
  if (!faceUp) {
    ctx.fillStyle = '#241c46';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4a3f8a';
    ctx.stroke();
    ctx.fillStyle = '#8a7fd0';
    ctx.font = `bold ${Math.floor(h * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + w / 2, y + h / 2 + 2);
  } else {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#fff7e8');
    grad.addColorStop(1, '#ffd98a');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = '#1a1030';
    ctx.font = `bold ${Math.floor(h * 0.52)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = tileLabel(tile);
    ctx.fillText(label === 'J' ? '★' : label, x + w / 2, y + h / 2 + 2);
    if (label === 'J') {
      ctx.font = `bold ${Math.floor(h * 0.22)}px system-ui, sans-serif`;
      ctx.fillText('JOKER', x + w / 2, y + h * 0.78);
    }
  }
  ctx.restore();
}

function drawDice(ctx, x, y, s, val) {
  ctx.save();
  rr(ctx, x, y, s, s, 8);
  ctx.fillStyle = val > 0 ? '#ffd54f' : '#241c46';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffb300';
  ctx.stroke();
  if (val > 0) {
    ctx.fillStyle = '#1a1030';
    ctx.font = `bold ${Math.floor(s * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(val), x + s / 2, y + s / 2 + 2);
  }
  ctx.restore();
}

function drawChipStack(ctx, x, y, amount, color) {
  // 按筹码数量画 1~5 层
  const layers = Math.min(5, Math.max(1, Math.ceil(amount / 2000)));
  const r = 24;
  for (let i = 0; i < layers; i += 1) {
    ctx.beginPath();
    ctx.ellipse(x, y - i * 7, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? color : '#f6e7c8';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a1030';
    ctx.stroke();
  }
}

function fmtChips(n) {
  if (n >= 10000) return `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}K`;
  return String(n);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  function bg() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d0b1a');
    g.addColorStop(0.5, '#171233');
    g.addColorStop(1, '#0d0b1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 霓虹桌面网格
    ctx.strokeStyle = 'rgba(90, 70, 180, 0.18)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, WORLD.HUD_H); ctx.lineTo(x, H - WORLD.ACTION_H); ctx.stroke();
    }
    for (let y = WORLD.HUD_H; y <= H - WORLD.ACTION_H; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawHouse(state) {
    const cy = 150;
    const faceUp = state && state.phase !== 'betting' && state.phase !== 'rolling' && state.hands.house;
    const hand = state ? state.hands.house : null;
    // 庄家铭牌
    ctx.fillStyle = '#d8d4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('house').toUpperCase(), 640, 76);
    const tw = 96; const th = 128; const gap = 18;
    const x0 = 640 - tw - gap / 2;
    drawTile(ctx, x0, cy, tw, th, hand ? hand.t1 : 1, faceUp, '#c9c4ff');
    drawTile(ctx, x0 + tw + gap, cy, tw, th, hand ? hand.t2 : 1, faceUp, '#c9c4ff');
    if (faceUp && hand) {
      ctx.fillStyle = '#e8e4ff';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(kindLabel(hand), 640, cy + th + 18);
    }
  }

  function kindLabel(hand) {
    if (!hand) return '';
    if (hand.kind === 'doubleJoker') return t('doubleJoker');
    if (hand.kind === 'pair') return `${t('pair')} ${hand.power - 20}`;
    return `${t('point')} ${hand.power}`;
  }

  function drawDoors(state) {
    for (const d of doorLayouts()) {
      const door = DOORS.find((x) => x.key === d.key);
      const hand = state ? state.hands[d.key] : null;
      const bet = state ? state.bets[d.key] : 0;
      const faceUp = state && state.phase !== 'betting' && state.phase !== 'rolling' && hand;
      // 面板
      rr(ctx, d.x, d.y, d.w, d.h, 18);
      ctx.fillStyle = 'rgba(20, 14, 44, 0.55)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = door.color;
      if (bet > 0) {
        ctx.save();
        ctx.shadowColor = door.glow;
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.stroke();
      }
      // 门名
      ctx.fillStyle = door.color;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t(door.key).toUpperCase(), d.cx, d.y + 26);
      // 迷雾门
      if (state && state.shadowDoor === d.key && (state.phase === 'betting')) {
        ctx.fillStyle = 'rgba(10, 8, 22, 0.7)';
        rr(ctx, d.x + 10, d.y + 44, d.w - 20, d.h - 120, 12);
        ctx.fill();
        ctx.fillStyle = '#9f96d8';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.fillText('···', d.cx, d.y + d.h / 2 + 20);
      }
      // 两张牌
      const tw = 88; const th = 116; const gap = 16;
      const tx0 = d.cx - tw - gap / 2;
      const ty = d.y + 60;
      drawTile(ctx, tx0, ty, tw, th, hand ? hand.t1 : 1, faceUp, door.color);
      drawTile(ctx, tx0 + tw + gap, ty, tw, th, hand ? hand.t2 : 1, faceUp, door.color);
      // 结算标记
      const res = state && state.results[d.key];
      if (res) {
        ctx.fillStyle = res === 'win' ? '#7dffa8' : '#ff6b6b';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText(res === 'win' ? '▲' : '▼', d.cx, ty + th + 24);
      }
      // 筹码堆
      if (bet > 0) {
        drawChipStack(ctx, d.cx, d.y + d.h - 46, bet, door.color);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.fillText(fmtChips(bet), d.cx, d.y + d.h - 18);
      }
    }
  }

  function drawDiceRow(state) {
    const d1 = state ? state.dice[0] : 0;
    const d2 = state ? state.dice[1] : 0;
    drawDice(ctx, 1050, 66, 52, d1);
    drawDice(ctx, 1116, 66, 52, d2);
    ctx.fillStyle = '#9f96d8';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DICE', 1110, 140);
  }

  function drawBanners(state) {
    if (!state) return;
    let by = WORLD.HUD_H + 8;
    if (state.mult > 1 || state.streak >= 1) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 180, 40, 0.16)';
      rr(ctx, 24, by, 190, 34, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffb300';
      ctx.lineWidth = 1.5;
      rr(ctx, 24, by, 190, 34, 8);
      ctx.stroke();
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${t('streakOn')}${state.streak}`, 40, by + 18);
      ctx.restore();
      by += 44;
    }
    if (state.comboBonus > 0) {
      ctx.fillStyle = '#ff4fd8';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${t('combo')} +${fmtChips(state.comboBonus)}`, 640, 208);
    }
  }

  function drawPhaseHint(state) {
    if (!state) return;
    let msg = '';
    if (state.phase === 'betting') msg = t('betHint');
    else if (state.phase === 'rolling') msg = t('rolling');
    else if (state.phase === 'reveal') msg = t('revealing');
    if (msg) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(msg, 640, H - WORLD.ACTION_H - 14);
    }
  }

  return {
    draw(state, dt, view) {
      ctx.clearRect(0, 0, W, H);
      bg();
      drawHouse(state);
      drawDiceRow(state);
      drawBanners(state);
      drawDoors(state);
      drawPhaseHint(state);
    },
    debugLayout() {
      return { doors: doorLayouts() };
    },
    doorLayouts,
  };
}

export { doorLayouts as _doorLayouts };
