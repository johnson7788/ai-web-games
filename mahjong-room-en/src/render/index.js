// MAHJONG ROOM · Canvas 2D 渲染（霓虹街机风，全程序化，无素材文件）
// 画：霓虹桌面、四家手牌（自家亮牌、三家盖牌）、弃牌池、碰/杠面子、结算光效。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { tSuit, tRank } from '../game/sim.js';

const TILE_W = LAYOUT.TILE_W;
const TILE_H = LAYOUT.TILE_H;
const SM = LAYOUT.TILE_SMALL;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FONT = '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans", sans-serif';

function drawBamboo(ctx, n, x, y, w, h, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, w * 0.055);
  ctx.lineCap = 'round';
  if (n === 1) {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h * 0.78);
    ctx.lineTo(x + w * 0.5, y + h * 0.22);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.16, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const rows = n <= 3 ? 1 : n <= 6 ? 2 : 3;
    const per = Math.ceil(n / rows);
    const cells = rows * per;
    const padX = w * 0.14;
    const padY = h * 0.16;
    const cw = (w - padX * 2) / per;
    const ch = (h - padY * 2) / rows;
    for (let i = 0; i < n; i += 1) {
      const c = i % per;
      const r = Math.floor(i / per);
      const cx = x + padX + cw * (c + 0.5);
      const cy = y + padY + ch * (r + 0.5);
      ctx.beginPath();
      ctx.moveTo(cx, cy + ch * 0.32);
      ctx.lineTo(cx, cy - ch * 0.32);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawDots(ctx, n, x, y, w, h, color) {
  ctx.save();
  ctx.fillStyle = color;
  const r = Math.max(3, w * 0.075);
  const pos = [];
  const rows = n <= 3 ? 1 : n <= 6 ? 2 : 3;
  const per = Math.ceil(n / rows);
  const padX = w * 0.16;
  const padY = h * 0.18;
  const cw = (w - padX * 2) / per;
  const ch = (h - padY * 2) / rows;
  for (let i = 0; i < n; i += 1) {
    const c = i % per;
    const rr = Math.floor(i / per);
    // 居中：每行实际数量可能少于 per
    const rowCount = Math.min(per, n - rr * per);
    const off = (per - rowCount) * 0.5;
    pos.push([x + padX + cw * (c + 0.5 + off), y + padY + ch * (rr + 0.5)]);
  }
  for (const [cx, cy] of pos) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTileFace(ctx, t, x, y, w, h) {
  const suit = tSuit(t);
  const rank = tRank(t);
  ctx.save();
  ctx.beginPath();
  rr(ctx, x, y, w, h, 5);
  ctx.clip();
  if (suit === 3 && rank === 7) {
    // 白板：空白 + 蓝框
    ctx.fillStyle = '#f4efe0';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#3aa6ff';
    ctx.lineWidth = Math.max(2, w * 0.06);
    ctx.strokeRect(x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.6);
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#f4efe0';
  ctx.fillRect(x, y, w, h);

  if (suit === 0) {
    // 万：红数字 + 小萬
    ctx.fillStyle = '#d81b3f';
    ctx.font = `800 ${Math.floor(h * 0.44)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(rank), x + w * 0.5, y + h * 0.5);
    ctx.font = `600 ${Math.floor(h * 0.16)}px ${FONT}`;
    ctx.fillText('萬', x + w * 0.5, y + h * 0.82);
  } else if (suit === 1) {
    drawBamboo(ctx, rank, x, y, w, h, '#0f9d58');
  } else if (suit === 2) {
    drawDots(ctx, rank, x, y, w, h, '#2b6ee0');
  } else {
    // 风牌 E/S/W/N，箭牌 中/發
    const map = { 1: 'E', 2: 'S', 3: 'W', 4: 'N', 5: '中', 6: '發' };
    const ch = map[rank];
    const colors = { 1: '#2de2ff', 2: '#2dffb0', 3: '#a06bff', 4: '#9aa0d0', 5: '#d81b3f', 6: '#0f9d58' };
    ctx.fillStyle = colors[rank] || '#222';
    ctx.font = `800 ${Math.floor(h * 0.5)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x + w * 0.5, y + h * 0.52);
  }
  ctx.restore();
}

function drawTileBack(ctx, x, y, w, h, neon) {
  ctx.save();
  ctx.beginPath();
  rr(ctx, x, y, w, h, 4);
  ctx.fillStyle = '#2c2060';
  ctx.fill();
  ctx.strokeStyle = neon || '#a06bff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  rr(ctx, x + w * 0.16, y + h * 0.16, w * 0.68, h * 0.68, 3);
  ctx.fillStyle = '#3c2c7c';
  ctx.fill();
  ctx.strokeStyle = neon || '#2de2ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 中心菱形标记，眯眼也能认出是牌
  ctx.fillStyle = neon || '#2de2ff';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.28);
  ctx.lineTo(x + w * 0.72, y + h * 0.5);
  ctx.lineTo(x + w * 0.5, y + h * 0.72);
  ctx.lineTo(x + w * 0.28, y + h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTile(ctx, t, x, y, w, h, opts = {}) {
  ctx.save();
  if (opts.raised) y -= 16;
  if (opts.glow) {
    ctx.shadowColor = '#2de2ff';
    ctx.shadowBlur = 14;
  }
  if (t == null) drawTileBack(ctx, x, y, w, h, opts.neon);
  else drawTileFace(ctx, t, x, y, w, h);
  ctx.restore();
  return { x, y, w, h };
}

function handLayout(count, startX, y, w, h, gap) {
  const total = count * w + (count - 1) * gap;
  const x0 = startX - total / 2;
  const rects = [];
  for (let i = 0; i < count; i += 1) rects.push({ x: x0 + i * (w + gap), y, w, h });
  return rects;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const selfRects = [];

  function drawTable() {
    // 桌面毛毡
    ctx.fillStyle = 'rgba(12, 10, 30, 0.4)';
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    ctx.beginPath();
    rr(ctx, 200, 60, 880, 520, 34);
    ctx.fillStyle = 'rgba(16, 18, 42, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 107, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    rr(ctx, 216, 76, 848, 488, 26);
    ctx.strokeStyle = 'rgba(45, 226, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 桌面中央淡提示：说明弃牌区用途
    ctx.fillStyle = 'rgba(160, 107, 255, 0.28)';
    ctx.font = '700 22px "Segoe UI", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DISCARD  ·  PENG  ·  GANG  ·  HU', 640, 336);
    ctx.restore();
  }

  function drawDiscards(state) {
    // 各家的弃牌池
    const grids = {
      0: { x: 420, y: 430, dx: SM + 4, dy: 0, cols: 7, dir: 'up' },
      2: { x: 420, y: 150, dx: SM + 4, dy: 0, cols: 7, dir: 'down' },
      3: { x: 260, y: 250, dx: 0, dy: SM + 4, cols: 5, dir: 'right' },
      1: { x: 940, y: 250, dx: 0, dy: SM + 4, cols: 5, dir: 'right' },
    };
    for (let p = 0; p < 4; p += 1) {
      const cards = state.discards[p] || [];
      const g = grids[p];
      cards.forEach((t, i) => {
        let px;
        let py;
        if (p === 0 || p === 2) {
          const c = i % g.cols;
          const r = Math.floor(i / g.cols);
          px = g.x + c * g.dx;
          py = p === 0 ? g.y - r * (SM + 4) : g.y + r * (SM + 4);
        } else {
          const c = i % g.cols;
          const r = Math.floor(i / g.cols);
          py = g.y + c * g.dy;
          px = g.x + r * (SM + 4);
        }
        drawTile(ctx, t, px, py, SM, SM + 12);
      });
    }
  }

  function drawMelds(state) {
    const spots = {
      0: { x: 180, y: 520 },
      2: { x: 220, y: 60 },
      3: { x: 240, y: 200 },
      1: { x: 880, y: 200 },
    };
    for (let p = 0; p < 4; p += 1) {
      const melds = state.melds[p] || [];
      const s = spots[p];
      melds.forEach((m, i) => {
        const n = m.kind === 'gang' ? 4 : 3;
        const off = (p === 0 || p === 2) ? i * (n * (SM + 2) + 10) : i * 58;
        for (let k = 0; k < n; k += 1) {
          if (p === 0 || p === 2) {
            drawTile(ctx, m.kind === 'gang' && m.hidden && k === 0 ? null : m.t, s.x + off + k * (SM + 2), s.y, SM, SM + 12, { neon: '#2dffb0' });
          } else {
            drawTile(ctx, m.kind === 'gang' && m.hidden && k === 0 ? null : m.t, s.x, s.y + off + k * (SM + 2), SM, SM + 12, { neon: '#2dffb0' });
          }
        }
      });
    }
  }

  function drawOpponents(state) {
    // 对家（上）
    const across = state.hands[2] || [];
    const l1 = handLayout(across.length, 640, 150, SM, SM + 12, 3);
    across.forEach((t, i) => drawTileBack(ctx, l1[i].x, l1[i].y, SM, SM + 12, '#a06bff'));
    // 左家（竖排）
    const left = state.hands[3] || [];
    const l3 = handLayout(left.length, 300, 260, SM + 12, SM, 3);
    left.forEach((t, i) => drawTileBack(ctx, l3[i].x, l3[i].y, SM + 12, SM, '#2de2ff'));
    // 右家（竖排）
    const right = state.hands[1] || [];
    const l1r = handLayout(right.length, 980, 260, SM + 12, SM, 3);
    right.forEach((t, i) => drawTileBack(ctx, l1r[i].x, l1r[i].y, SM + 12, SM, '#ff2d78'));
  }

  function drawSelf(state, view) {
    const hand = state.hands[0] || [];
    const gap = hand.length > 12 ? 2 : 3;
    const w = hand.length > 12 ? 43 : TILE_W;
    const rects = handLayout(hand.length, 640, LAYOUT.SELF_Y, w, TILE_H, gap);
    selfRects.length = 0;
    hand.forEach((t, i) => {
      const raised = view.selectedTile === i;
      const hover = view.hoverTile === i;
      const r = drawTile(ctx, t, rects[i].x, rects[i].y, w, TILE_H, { raised, glow: hover || raised });
      selfRects.push({ index: i, t, ...r, w, h: TILE_H });
    });
  }

  function drawTurnGlow(state) {
    // 当前出牌方名字位置加一圈霓虹提示
    if (state.phase !== 'playing' || state.decider == null) return;
    const pos = state.decider;
    const marks = {
      0: [640, 650],
      2: [640, 92],
      3: [300, 300],
      1: [980, 300],
    };
    const [x, y] = marks[pos];
    ctx.save();
    ctx.strokeStyle = pos === 0 ? '#2de2ff' : '#ff2d78';
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  return {
    draw(state, view) {
      drawTable();
      drawDiscards(state);
      drawMelds(state);
      drawOpponents(state);
      drawSelf(state, view);
      drawTurnGlow(state);
    },
    hitSelfTile(x, y) {
      for (const r of selfRects) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.index;
      }
      return -1;
    },
    debugLayout() {
      return {
        selfHand: { x: 280, y: LAYOUT.SELF_Y, w: 720, h: TILE_H },
        selfDiscard: { x: 420, y: 400, w: 400, h: 100 },
        table: { x: 200, y: 60, w: 880, h: 520 },
      };
    },
  };
}
