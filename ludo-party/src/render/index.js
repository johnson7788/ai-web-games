// Canvas 2D 渲染：飞行棋棋盘（方形跑道 + 基地 + home 列 + 中心）+ 棋子 + 骰子。
// 玩法层（格/编号/高亮/判定几何）全部程序化；AI 素材只做背景铺底与棋子/骰子贴图。
import { WORLD, BOARD, COLORS, PLAYERS, RULES } from '../../config/game.config.js';
import { trackPos } from '../game/sim.js';
import { art, artMeta } from './art.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const CX = BOARD.X + BOARD.SIZE / 2;
const CY = BOARD.Y + BOARD.SIZE / 2;
const LOOP = { left: BOARD.X + 70, top: BOARD.Y + 70, side: BOARD.SIZE - 140 };
const CELL = 32;
const TOKEN_H = 40; // 棋子显示高度，按 manifest 宽高比缩放

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

// 图片 cover 到目标矩形（保留比例、居中裁切）。
function cover(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function trackCellPos(i) {
  const { left, top, side } = LOOP;
  const P = 4 * side;
  const d = (i / RULES.trackLen) * P;
  const right = left + side;
  const bottom = top + side;
  if (d < side) return { x: left + d, y: top };
  if (d < 2 * side) return { x: right, y: top + (d - side) };
  if (d < 3 * side) return { x: right - (d - 2 * side), y: bottom };
  return { x: left, y: bottom - (d - 3 * side) };
}

function baseSlotPos(player, slot) {
  // 红基地左上，蓝基地右下
  const bx = player === 0 ? BOARD.X + 30 : BOARD.X + BOARD.SIZE - 130;
  const by = player === 0 ? BOARD.Y + 30 : BOARD.Y + BOARD.SIZE - 130;
  const col = slot % 2;
  const row = Math.floor(slot / 2);
  return { x: bx + 25 + col * 50, y: by + 25 + row * 50 };
}

function homeCellPos(player, homeIdx) {
  if (player === 0) return { x: CX, y: CY - 180 + homeIdx * 30 };
  return { x: CX, y: CY + 180 - homeIdx * 30 };
}

export function tokenPos(run, player, token) {
  const p = run.players[player].tokens[token];
  if (p === -1) return baseSlotPos(player, token);
  if (p === RULES.finish) return { x: CX + (player === 0 ? -20 : 20), y: CY + (token - 1.5) * 12 };
  if (p >= 51) return homeCellPos(player, p - 51);
  return trackCellPos(trackPos(player, p));
}

// 单枚棋子：sprite 贴图（center 对齐），缺素材回退圆形占位；编号徽章始终程序化。
function drawToken(ctx, x, y, img, m, color, num) {
  if (img && m) {
    const w = TOKEN_H * (m.w / m.h);
    ctx.drawImage(img, x - w / 2, y - TOKEN_H / 2, w, TOKEN_H);
  } else {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = `800 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), x, y + 0.5);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function update() {}

  function drawBoard(run, view) {
    // 底板：parchment 贴图（缺则纯色）
    const parch = art('boardParchment');
    if (parch) {
      ctx.save();
      roundRect(ctx, BOARD.X, BOARD.Y, BOARD.SIZE, BOARD.SIZE, 16);
      ctx.clip();
      cover(ctx, parch, BOARD.X, BOARD.Y, BOARD.SIZE, BOARD.SIZE);
      ctx.restore();
    } else {
      ctx.fillStyle = COLORS.board;
      roundRect(ctx, BOARD.X, BOARD.Y, BOARD.SIZE, BOARD.SIZE, 16);
      ctx.fill();
    }
    ctx.strokeStyle = COLORS.boardEdge;
    ctx.lineWidth = 4;
    roundRect(ctx, BOARD.X, BOARD.Y, BOARD.SIZE, BOARD.SIZE, 16);
    ctx.stroke();
    // 跑道格
    for (let i = 0; i < RULES.trackLen; i += 1) {
      const { x, y } = trackCellPos(i);
      const isStart = PLAYERS.some((p) => p.start === i);
      ctx.fillStyle = isStart ? COLORS.safe : COLORS.track;
      roundRect(ctx, x - CELL / 2, y - CELL / 2, CELL, CELL, 6);
      ctx.fill();
      ctx.strokeStyle = COLORS.trackEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // home 列
    for (let pl = 0; pl < 2; pl += 1) {
      for (let h = 0; h < RULES.homeLen; h += 1) {
        const { x, y } = homeCellPos(pl, h);
        ctx.fillStyle = PLAYERS[pl].color;
        ctx.globalAlpha = 0.35;
        roundRect(ctx, x - CELL / 2, y - CELL / 2, CELL, CELL, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = PLAYERS[pl].color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // 基地
    for (let pl = 0; pl < 2; pl += 1) {
      const bx = pl === 0 ? BOARD.X + 12 : BOARD.X + BOARD.SIZE - 142;
      const by = pl === 0 ? BOARD.Y + 12 : BOARD.Y + BOARD.SIZE - 142;
      ctx.fillStyle = PLAYERS[pl].color;
      ctx.globalAlpha = 0.2;
      roundRect(ctx, bx, by, 130, 130, 12);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PLAYERS[pl].color;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // 中心
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(CX, CY, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = `800 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', CX, CY);
  }

  function drawTokens(run, view) {
    const now = view.now || 0;
    const movable = view.movable || [];
    const planes = [art('redPlane'), art('bluePlane')];
    for (let pl = 0; pl < run.players.length; pl += 1) {
      for (let t = 0; t < run.players[pl].tokens.length; t += 1) {
        const { x, y } = tokenPos(run, pl, t);
        const isMovable = pl === run.turn && run.phase === 'move' && movable.includes(t) && PLAYERS[pl].human;
        if (isMovable) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 150);
          ctx.strokeStyle = COLORS.gold;
          ctx.globalAlpha = pulse;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(x, y, 20, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        drawToken(ctx, x, y, planes[pl], artMeta(pl === 0 ? 'redPlane' : 'bluePlane'), PLAYERS[pl].color, t + 1);
      }
    }
  }

  function drawBackground(state) {
    if (state === 'title') {
      const ka = art('keyart');
      if (ka) { cover(ctx, ka, 0, 0, WORLD.WIDTH, WORLD.HEIGHT); return; }
    }
    const bg = art('bgTable');
    if (bg) {
      cover(ctx, bg, 0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    } else {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      const g = ctx.createRadialGradient(360, 360, 60, 360, 360, 800);
      g.addColorStop(0, COLORS.bgGlow);
      g.addColorStop(1, COLORS.bg);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
    // 骰子装饰（真实骰数在面板 HTML，程序化显示）
    const die = art('die');
    if (die) {
      const dm = artMeta('die');
      const h = 48;
      const w = h * (dm.w / dm.h);
      ctx.drawImage(die, BOARD.X + BOARD.SIZE - w - 14, BOARD.Y + BOARD.SIZE + 8, w, h);
    }
  }

  function render(view) {
    drawBackground(view.state);
    if (view.run && view.state !== 'title') {
      drawBoard(view.run, view);
      drawTokens(view.run, view);
    }
  }

  function hitToken(x, y, run) {
    if (run.phase !== 'move' || !PLAYERS[run.turn].human) return null;
    for (const t of run.movable) {
      const pos = tokenPos(run, run.turn, t);
      if (Math.hypot(pos.x - x, pos.y - y) <= 22) return t;
    }
    return null;
  }

  return { render, update, hitToken, tokenPos };
}
