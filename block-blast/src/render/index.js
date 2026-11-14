// Canvas 2D 渲染：霓虹棋盘 + 托盘 + 拖拽幽灵 + 爆破粒子/连击浮字。
// 全部程序化绘制，无外部图片。逻辑坐标 1280×720。
import { WORLD, BOARD, TRAY, COLORS, RULES } from '../../config/game.config.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const SIZE = BOARD.SIZE;
const CELL = BOARD.CELL;

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

export function cellRect(r, c) {
  return { x: BOARD.X + c * CELL, y: BOARD.Y + r * CELL, w: CELL, h: CELL };
}

export function traySlotRect(i) {
  const slotH = TRAY.H / TRAY.SLOTS;
  return { x: TRAY.X, y: TRAY.Y + i * slotH, w: TRAY.W, h: slotH };
}

export function trayPieceRect(piece, i) {
  const slot = traySlotRect(i);
  const w = piece.w * TRAY.CELL;
  const h = piece.h * TRAY.CELL;
  return { x: slot.x + (slot.w - w) / 2, y: slot.y + (slot.h - h) / 2, w, h };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const particles = [];
  const popups = [];
  let shakeT = 0;
  let shakeMag = 0;

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 220;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.5 + Math.random() * 0.35, t: 0, color, size: 3 + Math.random() * 4,
      });
    }
  }

  function popup(text, x, y, color = COLORS.accent, big = false) {
    popups.push({ text, x, y, color, t: 0, life: big ? 1.1 : 0.85, big });
  }

  function shake(mag = 8) {
    shakeMag = Math.max(shakeMag, mag);
    shakeT = 0.28;
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      const p = popups[i];
      p.t += dt;
      if (p.t >= p.life) popups.splice(i, 1);
    }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    else shakeMag = 0;
  }

  // ---- 绘制 helpers ----
  function drawBlock(x, y, s, color, glow = 0) {
    const pad = Math.max(2, s * 0.06);
    const bx = x + pad;
    const by = y + pad;
    const bs = s - pad * 2;
    if (glow > 0) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
    }
    const g = ctx.createLinearGradient(bx, by, bx, by + bs);
    g.addColorStop(0, lighten(color, 0.28));
    g.addColorStop(0.5, color);
    g.addColorStop(1, darken(color, 0.22));
    ctx.fillStyle = g;
    roundRect(ctx, bx, by, bs, bs, bs * 0.2);
    ctx.fill();
    if (glow > 0) ctx.restore();
    // 顶部高光
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(ctx, bx + bs * 0.12, by + bs * 0.1, bs * 0.76, bs * 0.18, bs * 0.09);
    ctx.fill();
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(640, 300, 80, 640, 360, 820);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawBoard(sim) {
    const bw = SIZE * CELL;
    // 外框
    ctx.fillStyle = COLORS.boardFrame;
    roundRect(ctx, BOARD.X - 14, BOARD.Y - 14, bw + 28, bw + 28, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(94,234,212,0.18)';
    ctx.lineWidth = 2;
    roundRect(ctx, BOARD.X - 14, BOARD.Y - 14, bw + 28, bw + 28, 18);
    ctx.stroke();

    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const { x, y } = cellRect(r, c);
        ctx.fillStyle = COLORS.cellEmpty;
        roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.fill();
        ctx.strokeStyle = COLORS.cellEdge;
        ctx.lineWidth = 1;
        ctx.stroke();
        const v = sim.grid[r][c];
        if (v !== 0) drawBlock(x, y, CELL, COLORS.blocks[v], 6);
      }
    }
  }

  function drawGhost(sim, drag) {
    if (!drag || drag.targetRow == null) return;
    const piece = sim.tray[drag.pieceIndex];
    if (!piece) return;
    const color = drag.valid ? COLORS.ghostOk : COLORS.ghostBad;
    for (const [r, c] of piece.cells) {
      const rr = drag.targetRow + r;
      const cc = drag.targetCol + c;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
      const { x, y } = cellRect(rr, cc);
      ctx.fillStyle = color;
      roundRect(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 8);
      ctx.fill();
    }
    // 落点描边
    if (drag.valid) {
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 2;
      for (const [r, c] of piece.cells) {
        const rr = drag.targetRow + r;
        const cc = drag.targetCol + c;
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
        const { x, y } = cellRect(rr, cc);
        roundRect(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 8);
        ctx.stroke();
      }
    }
  }

  function drawTray(sim, drag) {
    for (let i = 0; i < TRAY.SLOTS; i += 1) {
      const slot = traySlotRect(i);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      roundRect(ctx, slot.x + 8, slot.y + 8, slot.w - 16, slot.h - 16, 16);
      ctx.fill();
      const piece = sim.tray[i];
      if (!piece) continue;
      if (drag && drag.pieceIndex === i) {
        // 被拖走：画一个淡占位
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        const rect = trayPieceRect(piece, i);
        roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
        ctx.fill();
        continue;
      }
      const rect = trayPieceRect(piece, i);
      for (const [r, c] of piece.cells) {
        drawBlock(rect.x + c * TRAY.CELL, rect.y + r * TRAY.CELL, TRAY.CELL, COLORS.blocks[piece.color], 0);
      }
    }
  }

  function drawDragged(sim, drag) {
    if (!drag) return;
    const piece = sim.tray[drag.pieceIndex];
    if (!piece) return;
    const left = drag.x - drag.grabDX;
    const top = drag.y - drag.grabDY - drag.lift;
    ctx.save();
    ctx.globalAlpha = 0.95;
    for (const [r, c] of piece.cells) {
      drawBlock(left + c * CELL, top + r * CELL, CELL, COLORS.blocks[piece.color], 14);
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.color;
      roundRect(ctx, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, 1.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of popups) {
      const k = p.t / p.life;
      const alpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      const rise = k * 46;
      const scale = p.big ? 1 + 0.15 * Math.sin(Math.min(1, k * 3) * Math.PI) : 1;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `800 ${(p.big ? 46 : 26) * scale}px ${FONT}`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y - rise);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function render(view) {
    const { sim, drag, now } = view;
    ctx.save();
    if (shakeT > 0 && shakeMag > 0) {
      const m = shakeMag * (shakeT / 0.28);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawBackground();
    if (sim) {
      drawBoard(sim);
      drawGhost(sim, drag);
      drawTray(sim, drag);
      drawDragged(sim, drag);
    }
    drawParticles();
    drawPopups();
    ctx.restore();
  }

  // ---- 命中 / 坐标 ----
  function hitTestTray(x, y, sim) {
    for (let i = 0; i < TRAY.SLOTS; i += 1) {
      if (!sim.tray[i]) continue;
      const slot = traySlotRect(i);
      if (x >= slot.x && x <= slot.x + slot.w && y >= slot.y && y <= slot.y + slot.h) return i;
    }
    return -1;
  }

  function clearEffects() {
    particles.length = 0;
    popups.length = 0;
    shakeT = 0;
    shakeMag = 0;
  }

  return {
    render, update, burst, popup, shake, hitTestTray, clearEffects,
    cellRect, trayPieceRect, traySlotRect,
  };
}

// ---- 颜色工具 ----
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function lighten(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`;
}
function darken(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
}