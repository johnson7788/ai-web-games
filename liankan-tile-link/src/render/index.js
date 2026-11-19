// Canvas 2D 渲染：霓虹街机记忆翻牌。纯程序化，无图片。
// 画：合成波网格背景 + 扫描线 + 卡牌网格（背面电路纹 / 正面霓虹符号）+ 粒子。
import { WORLD } from '../../config/game.config.js';
import { symbolById } from '../../config/levels.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

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

// ---------- 布局 ----------
function layoutFor(state) {
  const cols = state.cols;
  const rows = state.rows;
  const top = 84;
  const bottom = 650;
  const availW = W - 120;
  const availH = bottom - top;
  const cell = Math.min(availW / cols, availH / rows, 132);
  const boardW = cell * cols;
  const boardH = cell * rows;
  return {
    cell,
    boardX: (W - boardW) / 2,
    boardY: top + (availH - boardH) / 2,
    boardW,
    boardH,
    pad: Math.max(8, cell * 0.1),
  };
}

function cardRect(lay, r, c) {
  const size = lay.cell - lay.pad;
  return {
    x: lay.boardX + c * lay.cell + lay.pad / 2,
    y: lay.boardY + r * lay.cell + lay.pad / 2,
    size,
  };
}

// ---------- 符号 ----------
function drawGlyph(ctx, id, cx, cy, r) {
  switch (id) {
    case 'sun': {
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.64, cy + Math.sin(a) * r * 0.64);
        ctx.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
        ctx.stroke();
      }
      break;
    }
    case 'moon': {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.62, Math.PI * 0.5, Math.PI * 1.5, false);
      ctx.arc(cx + r * 0.34, cy, r * 0.5, Math.PI * 1.5, Math.PI * 0.5, true);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? r * 0.95 : r * 0.4;
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'bolt': {
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.1, cy - r * 0.9);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.15);
      ctx.lineTo(cx - r * 0.05, cy + r * 0.15);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.9);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.15);
      ctx.lineTo(cx + r * 0.05, cy - r * 0.15);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'diamond': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.9);
      ctx.lineTo(cx + r * 0.7, cy);
      ctx.lineTo(cx, cy + r * 0.9);
      ctx.lineTo(cx - r * 0.7, cy);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy); ctx.lineTo(cx, cy - r * 0.9); ctx.lineTo(cx + r * 0.7, cy);
      ctx.stroke();
      break;
    }
    case 'hex': {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const x = cx + Math.cos(a) * r * 0.85;
        const y = cy + Math.sin(a) * r * 0.85;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
      break;
    }
    case 'ring': {
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'tri': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.85);
      ctx.lineTo(cx + r * 0.85, cy + r * 0.6);
      ctx.lineTo(cx - r * 0.85, cy + r * 0.6);
      ctx.closePath(); ctx.stroke();
      break;
    }
    case 'square': {
      const s = r * 0.72;
      ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
      break;
    }
    case 'heart': {
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.8);
      ctx.bezierCurveTo(cx - r * 1.1, cy - r * 0.1, cx - r * 0.6, cy - r * 0.95, cx, cy - r * 0.35);
      ctx.bezierCurveTo(cx + r * 0.6, cy - r * 0.95, cx + r * 1.1, cy - r * 0.1, cx, cy + r * 0.8);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'drop': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.85);
      ctx.bezierCurveTo(cx + r * 0.6, cy - r * 0.1, cx + r * 0.6, cy + r * 0.6, cx, cy + r * 0.85);
      ctx.bezierCurveTo(cx - r * 0.6, cy + r * 0.6, cx - r * 0.6, cy - r * 0.1, cx, cy - r * 0.85);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'spiral': {
      ctx.beginPath();
      for (let i = 0; i < 16; i += 1) {
        const t = i / 15;
        const a = t * Math.PI * 2.6;
        const rad = r * 0.05 + t * r * 0.75;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case 'eye': {
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.8, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.26, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'crown': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.8, cy + r * 0.5);
      ctx.lineTo(cx - r * 0.8, cy - r * 0.3);
      ctx.lineTo(cx - r * 0.4, cy + r * 0.05);
      ctx.lineTo(cx, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.05);
      ctx.lineTo(cx + r * 0.8, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.8, cy + r * 0.5);
      ctx.closePath(); ctx.stroke();
      break;
    }
    case 'leaf': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.1, cy + r * 0.8);
      ctx.quadraticCurveTo(cx - r * 0.9, cy - r * 0.1, cx, cy - r * 0.8);
      ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 0.1, cx + r * 0.1, cy + r * 0.8);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.7); ctx.lineTo(cx, cy + r * 0.7); ctx.stroke();
      break;
    }
    case 'wave': {
      ctx.beginPath();
      for (let i = 0; i < 3; i += 1) {
        const y = cy + (i - 1) * r * 0.4;
        ctx.moveTo(cx - r * 0.8, y);
        ctx.bezierCurveTo(cx - r * 0.3, y - r * 0.4, cx + r * 0.3, y + r * 0.4, cx + r * 0.8, y);
      }
      ctx.stroke();
      break;
    }
    case 'gear': {
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
        ctx.lineTo(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'key': {
      ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.1, r * 0.32, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.12, cy + r * 0.1);
      ctx.lineTo(cx + r * 0.7, cy + r * 0.1);
      ctx.lineTo(cx + r * 0.7, cy + r * 0.45);
      ctx.moveTo(cx + r * 0.5, cy + r * 0.1);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.4);
      ctx.stroke();
      break;
    }
    case 'bell': {
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.05, r * 0.55, Math.PI, 0);
      ctx.lineTo(cx + r * 0.55, cy + r * 0.35);
      ctx.lineTo(cx - r * 0.55, cy + r * 0.35);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.35, r * 0.14, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'flame': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.9);
      ctx.bezierCurveTo(cx + r * 0.7, cy - r * 0.1, cx + r * 0.5, cy + r * 0.75, cx, cy + r * 0.8);
      ctx.bezierCurveTo(cx - r * 0.5, cy + r * 0.75, cx - r * 0.7, cy - r * 0.1, cx, cy - r * 0.9);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.2);
      ctx.bezierCurveTo(cx + r * 0.3, cy + r * 0.1, cx + r * 0.2, cy + r * 0.5, cx, cy + r * 0.5);
      ctx.bezierCurveTo(cx - r * 0.2, cy + r * 0.5, cx - r * 0.3, cy + r * 0.1, cx, cy - r * 0.2);
      ctx.fillStyle = '#1a1030'; ctx.fill(); ctx.fillStyle = '#fff';
      break;
    }
    case 'snow': {
      for (let i = 0; i < 6; i += 1) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * r * 0.8, cy - Math.sin(a) * r * 0.8);
        ctx.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
        ctx.stroke();
        const mx = cx + Math.cos(a) * r * 0.55;
        const my = cy + Math.sin(a) * r * 0.55;
        ctx.beginPath();
        ctx.moveTo(mx - Math.cos(a + 0.5) * r * 0.22, my - Math.sin(a + 0.5) * r * 0.22);
        ctx.lineTo(mx + Math.cos(a + 0.5) * r * 0.22, my + Math.sin(a + 0.5) * r * 0.22);
        ctx.stroke();
      }
      break;
    }
    case 'paw': {
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.35, r * 0.4, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 3; i += 1) {
        const x = cx + (i - 1) * r * 0.34;
        ctx.beginPath(); ctx.arc(x, cy - r * 0.15, r * 0.18, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'clover': {
      for (let i = 0; i < 4; i += 1) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4, r * 0.32, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.4); ctx.lineTo(cx, cy + r * 0.85); ctx.stroke();
      break;
    }
    case 'arrow': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.8, cy);
      ctx.lineTo(cx + r * 0.8, cy);
      ctx.moveTo(cx + r * 0.4, cy - r * 0.6);
      ctx.lineTo(cx + r * 0.8, cy);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.6);
      ctx.stroke();
      break;
    }
    default: {
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2); ctx.stroke();
      break;
    }
  }
}

function neonGlyph(ctx, id, cx, cy, r, color) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 外发光
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.5;
  drawGlyph(ctx, id, cx, cy, r);
  // 内亮芯
  ctx.globalAlpha = 1;
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  drawGlyph(ctx, id, cx, cy, r);
  ctx.restore();
}

// ---------- 背景 ----------
function drawBackground(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0614');
  g.addColorStop(0.5, '#120a22');
  g.addColorStop(1, '#0a0512');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 合成波网格（透视感）
  ctx.strokeStyle = 'rgba(120, 90, 220, 0.10)';
  ctx.lineWidth = 1;
  const horizon = H * 0.5;
  for (let i = 0; i <= 12; i += 1) {
    const y = horizon + Math.pow(i / 12, 2) * (H - horizon);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = -12; i <= 12; i += 1) {
    const x = W / 2 + i * 110;
    ctx.beginPath();
    ctx.moveTo(W / 2, horizon);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  // 远景发光带
  const glow = ctx.createLinearGradient(0, horizon - 60, 0, horizon + 20);
  glow.addColorStop(0, 'rgba(255, 60, 140, 0)');
  glow.addColorStop(1, 'rgba(255, 60, 140, 0.16)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizon - 60, W, 80);

  // 扫描线
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

  // 顶部霓虹光晕（缓动）
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  const tg = ctx.createRadialGradient(W / 2, 70, 20, W / 2, 70, 260);
  tg.addColorStop(0, `rgba(140, 90, 255, ${0.16 + pulse * 0.06})`);
  tg.addColorStop(1, 'rgba(140, 90, 255, 0)');
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, W, 300);
}

// ---------- 卡牌 ----------
function drawCard(ctx, lay, state, r, c, t) {
  const idx = r * state.cols + c;
  const card = state.cards[idx];
  const rect = cardRect(lay, r, c);
  const faceUp = card.matched || card.revealed || state.simTime < state.peekUntil;
  const selected = state.selected.includes(card.id);
  const peekActive = state.simTime < state.peekUntil && !card.matched && !card.revealed;

  let scale = 1;
  if (selected) scale = 1.06;
  const cx = rect.x + rect.size / 2;
  const cy = rect.y + rect.size / 2;
  const size = rect.size * scale;
  const x = cx - size / 2;
  const y = cy - size / 2;

  const color = symbolById(card.name).color;

  // 底面
  ctx.fillStyle = faceUp ? '#1a1030' : '#0d0718';
  roundRect(ctx, x, y, size, size, size * 0.14);
  ctx.fill();

  if (faceUp) {
    ctx.save();
    ctx.globalAlpha = peekActive ? 0.9 : 1;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? '#ffffff' : color;
    ctx.shadowColor = color;
    ctx.shadowBlur = selected ? 14 : (card.matched ? 6 : 0);
    roundRect(ctx, x, y, size, size, size * 0.14);
    ctx.stroke();
    ctx.shadowBlur = 0;
    neonGlyph(ctx, card.name, cx, cy, size * 0.30, color);
    if (card.matched) {
      // 已配对角标
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + size * 0.82, y + size * 0.82, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else {
    // 背面：电路纹（青蓝描边提升剪影辨识）
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(94, 240, 255, 0.85)';
    roundRect(ctx, x, y, size, size, size * 0.14);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(94, 240, 255, 0.45)';
    ctx.lineWidth = 1.5;
    const m = size * 0.5;
    roundRect(ctx, cx - m / 2, cy - m / 2, m, m, m * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - m / 2, cy);
    ctx.lineTo(cx + m / 2, cy);
    ctx.moveTo(cx, cy - m / 2);
    ctx.lineTo(cx, cy + m / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- 粒子 ----------
function drawFx(ctx, view) {
  for (const p of view.fx) {
    const k = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, p.size * k), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- 导出 ----------
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let time = 0;
  let lastLayout = null;

  return {
    draw(state, dt, view) {
      time += dt;
      drawBackground(ctx, time);

      ctx.save();
      if (view.shake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * view.shake * 2,
          (Math.random() - 0.5) * view.shake * 2,
        );
      }

      if (state && state.cards) {
        const lay = layoutFor(state);
        lastLayout = lay;
        for (let r = 0; r < state.rows; r += 1) {
          for (let c = 0; c < state.cols; c += 1) {
            drawCard(ctx, lay, state, r, c, time);
          }
        }
      } else {
        lastLayout = null;
      }

      ctx.restore();

      drawFx(ctx, view);

      if (view.flash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.5, view.flash);
        ctx.fillStyle = '#cfeaff';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    },

    debugLayout() {
      return lastLayout;
    },
  };
}
