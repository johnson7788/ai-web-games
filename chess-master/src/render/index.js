// Canvas 2D 渲染：背景（keyart/暖木渐变）+ 棋盘（程序化格/高亮）+ 棋子（sprite，回退 Unicode）。
import { WORLD, BOARD, COLORS } from '../../config/game.config.js';
import { art } from './art.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const FILES = 'abcdefgh';
const CELL = BOARD.CELL;

export function squareRect(r, c) {
  return { x: BOARD.X + c * CELL, y: BOARD.Y + r * CELL, w: CELL, h: CELL };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function drawCover(sprite, W, H) {
    const s = Math.max(W / sprite.w, H / sprite.h);
    const w = sprite.w * s;
    const h = sprite.h * s;
    ctx.drawImage(sprite.img, (W - w) / 2, (H - h) / 2, w, h);
  }

  function drawBackground(phase) {
    if (phase === 'title') {
      const keyart = art.get('keyart');
      if (keyart) { drawCover(keyart, WORLD.WIDTH, WORLD.HEIGHT); return; }
    }
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(400, 360, 60, 400, 360, 900);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawBoard(view) {
    const { run, selected, targets, checkPos } = view;
    const last = run.lastMove;
    // 1) 棋盘格底色（程序化，判定层不动）
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const { x, y } = squareRect(r, c);
        ctx.fillStyle = (r + c) % 2 === 0 ? COLORS.light : COLORS.dark;
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
    // 2) 木纹贴图铺在格子上（subtle 质感，不遮判定）
    const wood = art.get('board');
    if (wood) {
      ctx.globalAlpha = 0.22;
      ctx.drawImage(wood.img, BOARD.X, BOARD.Y, BOARD.N * CELL, BOARD.N * CELL);
      ctx.globalAlpha = 1;
    }
    // 3) 上一步/选中/将军高亮
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const { x, y } = squareRect(r, c);
        if (last && ((last.from.r === r && last.from.c === c) || (last.to.r === r && last.to.c === c))) {
          ctx.fillStyle = COLORS.last;
          ctx.fillRect(x, y, CELL, CELL);
        }
        if (selected && selected.r === r && selected.c === c) {
          ctx.fillStyle = COLORS.sel;
          ctx.fillRect(x, y, CELL, CELL);
        }
        if (checkPos && checkPos.r === r && checkPos.c === c) {
          ctx.fillStyle = COLORS.check;
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
    }
    // 4) 可走点
    if (targets) {
      for (const key of targets) {
        const [r, c] = key.split(',').map(Number);
        const { x, y } = squareRect(r, c);
        const cx = x + CELL / 2;
        const cy = y + CELL / 2;
        const occupied = run.state.board[r][c];
        if (occupied) {
          ctx.strokeStyle = COLORS.capture;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(cx, cy, CELL * 0.42, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = COLORS.move;
          ctx.beginPath();
          ctx.arc(cx, cy, CELL * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // 5) 坐标
    ctx.fillStyle = 'rgba(243,236,226,0.6)';
    ctx.font = `600 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < 8; c += 1) {
      ctx.fillText(FILES[c], BOARD.X + c * CELL + CELL / 2, BOARD.Y + 8 * CELL + 18);
    }
    ctx.textAlign = 'right';
    for (let r = 0; r < 8; r += 1) {
      ctx.fillText(String(8 - r), BOARD.X - 12, BOARD.Y + r * CELL + CELL / 2);
    }
  }

  function drawPieces(run) {
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const p = run.state.board[r][c];
        if (!p) continue;
        const { x, y } = squareRect(r, c);
        const cx = x + CELL / 2;
        const sprite = art.get(`piece:${p.color}:${p.type}`);
        if (sprite) {
          const h = CELL * 0.84;
          const w = h * sprite.w / sprite.h;
          const footY = y + CELL - 2; // pivot=bottom：脚底对齐格底
          ctx.drawImage(sprite.img, cx - w / 2, footY - h, w, h);
        } else {
          // 占位回退：Unicode 棋子
          const cy = y + CELL / 2 + 2;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `${CELL * 0.78}px ${FONT}`;
          ctx.lineWidth = 2.5;
          if (p.color === 'w') {
            ctx.fillStyle = COLORS.white;
            ctx.strokeStyle = 'rgba(43,33,24,0.9)';
          } else {
            ctx.fillStyle = COLORS.black;
            ctx.strokeStyle = 'rgba(248,244,236,0.5)';
          }
          ctx.strokeText(GLYPH[p.type], cx, cy);
          ctx.fillText(GLYPH[p.type], cx, cy);
        }
      }
    }
  }

  function drawLoading() {
    if (art.ready) return;
    const w = 260;
    const h = 8;
    const x = (WORLD.WIDTH - w) / 2;
    const y = WORLD.HEIGHT - 40;
    ctx.fillStyle = 'rgba(243,236,226,0.25)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x, y, w * Math.max(0.05, art.progress), h);
  }

  function render(view) {
    drawBackground(view.phase);
    if (view.run && view.phase !== 'title') {
      drawBoard(view);
      drawPieces(view.run);
    }
    drawLoading();
  }

  function hitSquare(x, y) {
    const c = Math.floor((x - BOARD.X) / CELL);
    const r = Math.floor((y - BOARD.Y) / CELL);
    if (r < 0 || r >= 8 || c < 0 || c >= 8) return null;
    return { r, c };
  }

  return { render, hitSquare, squareRect };
}
