// 霓虹街机 · 福州麻将 13 渲染器（Canvas 2D，程序化发光麻将牌）
import { WORLD } from '../../config/game.config.js';
import { tileFace, tileSuit, suitOf, rankOf } from '../game/tiles.js';

const SUIT_COLOR = {
  1: '#4dd8ff', // 筒 蓝
  2: '#ff5d8f', // 万 红
  3: '#7dff8a', // 条 绿
  4: '#c9a6ff', // 风箭 紫
  5: '#ffd24d', // 花 金
};

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

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0b0620');
    g.addColorStop(0.5, '#150b33');
    g.addColorStop(1, '#0b0620');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 霓虹桌布
    ctx.strokeStyle = 'rgba(180,120,255,0.16)';
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD.WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < WORLD.HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
  }

  function drawTileBack(x, y, w, h) {
    roundRect(ctx, x, y, w, h, 5);
    ctx.fillStyle = '#241645';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,220,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,170,255,0.5)';
    ctx.fillRect(x + w * 0.22, y + h * 0.22, w * 0.56, h * 0.56);
    ctx.strokeStyle = 'rgba(200,170,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + w * 0.22, y + h * 0.22, w * 0.56, h * 0.56);
  }

  function drawTileFace(x, y, w, h, tid, opts = {}) {
    const suit = suitOf(tid);
    const accent = SUIT_COLOR[suit] || '#eee';
    const glow = opts.glow ? 16 : 0;
    const joker = opts.joker === true;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = glow;
    }
    roundRect(ctx, x, y, w, h, 5);
    ctx.fillStyle = joker ? '#3a2a08' : '#f4efdf';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = joker ? '#ffd24d' : 'rgba(0,0,0,0.25)';
    ctx.lineWidth = joker ? 2 : 1;
    ctx.stroke();

    // 内框
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 3);
    ctx.strokeStyle = joker ? 'rgba(255,210,77,0.6)' : accent;
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;

    const face = tileFace(tid);
    const suitCh = tileSuit(tid);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (suitCh) {
      // 序数牌：数字居中偏上 + 花色居中偏下（避免角落裁切）
      ctx.font = `bold ${Math.round(h * 0.40)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = joker ? '#ffd24d' : '#201632';
      ctx.fillText(face, x + w / 2, y + h * 0.40);
      ctx.font = `bold ${Math.round(h * 0.22)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = joker ? '#ffd24d' : accent;
      ctx.fillText(suitCh, x + w / 2, y + h * 0.72);
    } else {
      // 风箭/花：大字单字（花/字用深色提升白底对比度）
      const dark = suit === 5 ? '#a5580a' : suit === 4 ? '#5b3d8f' : accent;
      ctx.font = `bold ${Math.round(h * 0.5)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = joker ? '#ffd24d' : dark;
      ctx.fillText(face, x + w / 2, y + h / 2);
    }
    ctx.restore();
  }

  function drawMelds(seat, area, dir) {
    const melds = seat.melds;
    let ox = area.x;
    let oy = area.y;
    const tw = 30;
    const th = 40;
    for (const m of melds) {
      for (const t of m.tiles) {
        drawTileFace(ox, oy, tw, th, t);
        if (dir === 'h') ox += tw + 3;
        else oy += th + 3;
      }
      if (dir === 'h') ox += 8;
      else oy += 8;
    }
    // 花牌
    for (const f of seat.flowers) {
      drawTileFace(ox, oy, 24, 32, f);
      if (dir === 'h') ox += 26;
      else oy += 34;
    }
  }

  function drawDiscards(state) {
    // 中央弃牌区按座位分四块
    const zones = {
      0: { x: 380, y: 470, cols: 8, tw: 34, th: 46 },
      1: { x: 880, y: 220, cols: 6, tw: 26, th: 36 },
      2: { x: 500, y: 128, cols: 8, tw: 26, th: 36 },
      3: { x: 360, y: 220, cols: 6, tw: 26, th: 36 },
    };
    for (let s = 0; s < 4; s += 1) {
      const z = zones[s];
      const discards = state.seats[s].discards;
      discards.forEach((t, i) => {
        const col = i % z.cols;
        const row = Math.floor(i / z.cols);
        const x = z.x + col * (z.tw + 3);
        const y = z.y + row * (z.th + 3);
        const isLast = s === state.lastDiscard.seat && i === discards.length - 1;
        drawTileFace(x, y, z.tw, z.th, t, { glow: isLast ? 12 : 0 });
      });
    }
  }

  function drawSeat(state) {
    const seats = state.seats;
    // 自己手牌（面朝上）
    const hand0 = seats[0].hand;
    const tw = 46;
    const th = 62;
    const gap = 4;
    const totalW = hand0.length * tw + (hand0.length - 1) * gap;
    let x = (WORLD.WIDTH - totalW) / 2;
    const y = WORLD.HEIGHT - th - 26;
    const hintDiscard = state.hint ? state.hint.discard : null;
    hand0.forEach((t, i) => {
      const joker = t === state.joker;
      const hint = t === hintDiscard;
      const canDiscard = state.stage === 'awaitDiscard' && state.actor === 0;
      drawTileFace(x, y, tw, th, t, { joker, glow: hint ? 14 : joker ? 8 : 0 });
      if (hint) {
        ctx.strokeStyle = '#7dff8a';
        ctx.lineWidth = 2.5;
        roundRect(ctx, x - 2, y - 2, tw + 4, th + 4, 7);
        ctx.stroke();
      }
      x += tw + gap;
    });
    // 自己副露/花
    drawMelds(seats[0], { x: 300, y: WORLD.HEIGHT - 120 }, 'h');

    // 三家 AI（暗牌背）
    const aiLayout = {
      1: { x: WORLD.WIDTH - 40, y: 150, dir: 'v', tw: 30, th: 40 },
      2: { x: 640, y: 84, dir: 'h', tw: 30, th: 40 },
      3: { x: 10, y: 150, dir: 'v', tw: 30, th: 40 },
    };
    for (let s = 1; s <= 3; s += 1) {
      const L = aiLayout[s];
      const hand = seats[s].hand;
      const turnGlow = state.currSeat === s && state.phase === 'playing';
      if (turnGlow) {
        ctx.save();
        ctx.shadowColor = '#ffd24d';
        ctx.shadowBlur = 12;
      }
      if (L.dir === 'v') {
        hand.forEach((_, i) => {
          drawTileBack(L.x, L.y + i * (L.th + 3), L.tw, L.th);
        });
        // 副露
        drawMelds(seats[s], { x: L.x - 34, y: L.y }, 'v');
      } else {
        const w = hand.length * (L.tw + 3);
        let xx = (WORLD.WIDTH - w) / 2;
        hand.forEach(() => {
          drawTileBack(xx, L.y, L.tw, L.th);
          xx += L.tw + 3;
        });
        drawMelds(seats[s], { x: 200, y: L.y + 50 }, 'h');
      }
      if (turnGlow) ctx.restore();
    }

    // 玩家 / AI 标识（提升剪影可读性：玩家最亮，AI 为暗色牌背）
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('YOU', 60, WORLD.HEIGHT - 100);
    ctx.fillStyle = 'rgba(201,166,255,0.72)';
    ctx.font = 'bold 12px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('AI', 30, 130);
    ctx.textAlign = 'right';
    ctx.fillText('AI', WORLD.WIDTH - 32, 130);
    ctx.textAlign = 'center';
    ctx.fillText('AI', WORLD.WIDTH / 2, 68);
  }

  function draw(state) {
    drawBackground();
    if (!state || state.phase === 'idle') return;
    drawDiscards(state);
    drawSeat(state);
  }

  return {
    draw,
    resize() {
      // 尺寸固定，无需处理
    },
  };
}
