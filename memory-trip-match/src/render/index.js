// MEMORY TRIP MATCH · Canvas 2D 渲染（霓虹街机风，纯程序化，零素材零外链）。
// 背景：深夜霓虹城市天际线 + 星点网格；卡牌：圆角霓虹牌，正面为发光几何符号。
import { WORLD } from '../../config/game.config.js';

const COLORS = ['#00f0ff', '#ff2bd6', '#ffe600', '#39ff6a', '#ff8a00', '#a06bff', '#ff5c8a', '#3d7bff'];
const SHAPE_NAMES = ['circle', 'ring', 'star', 'diamond', 'triangle', 'hex', 'square', 'heart', 'bolt', 'moon', 'cross', 'flower'];

const HUD_H = 56;
const MARGIN_X = 28;
const AREA_TOP = HUD_H + 20;
const AREA_BOTTOM = WORLD.HEIGHT - 30;

function shapeFor(symbol) {
  return {
    shape: SHAPE_NAMES[symbol % SHAPE_NAMES.length],
    color: COLORS[(symbol * 5) % COLORS.length],
  };
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawShape(ctx, cx, cy, r, color, shape) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const poly = (n, rot = -Math.PI / 2) => {
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const a = rot + (i * Math.PI * 2) / n;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  switch (shape) {
    case 'circle':
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); break;
    case 'ring':
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = Math.max(3, r * 0.32); ctx.stroke(); break;
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = cx + Math.cos(a) * rad;
        const py = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); break;
    }
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
      ctx.closePath(); ctx.fill(); break;
    case 'triangle':
      poly(3); ctx.fill(); break;
    case 'hex':
      poly(6); ctx.fill(); break;
    case 'square':
      ctx.beginPath(); ctx.rect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6); ctx.fill(); break;
    case 'heart': {
      const s = r * 0.55;
      ctx.beginPath();
      ctx.moveTo(cx, cy + r);
      ctx.bezierCurveTo(cx - r * 1.4, cy - s, cx - s, cy - r, cx, cy - s);
      ctx.bezierCurveTo(cx + s, cy - r, cx + r * 1.4, cy - s, cx, cy + r);
      ctx.fill(); break;
    }
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.2, cy - r);
      ctx.lineTo(cx - r * 0.7, cy + r * 0.25);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.25);
      ctx.lineTo(cx - r * 0.2, cy + r);
      ctx.lineTo(cx + r * 0.7, cy - r * 0.25);
      ctx.lineTo(cx + r * 0.1, cy - r * 0.25);
      ctx.closePath(); ctx.fill(); break;
    case 'moon':
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(cx + r * 0.5, cy - r * 0.3, r * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'cross':
      ctx.beginPath();
      ctx.fillRect(cx - r, cy - r * 0.28, r * 2, r * 0.56);
      ctx.fillRect(cx - r * 0.28, cy - r, r * 0.56, r * 2);
      break;
    case 'flower': {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(cx, cy);
        ctx.arc(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.42, a - 0.6, a + 0.6);
      }
      ctx.fill(); break;
    }
    default:
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBackground(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, '#0a0b1c');
  g.addColorStop(0.55, '#11132e');
  g.addColorStop(1, '#1a0f2e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 星点网格（缓慢漂移）
  ctx.fillStyle = 'rgba(0,240,255,0.10)';
  for (let y = 0; y < WORLD.HEIGHT; y += 46) {
    for (let x = 0; x < WORLD.WIDTH; x += 46) {
      const dx = ((x * 7 + y * 13) % 23) - 11;
      const dy = ((x * 5 + y * 3) % 17) - 8;
      ctx.beginPath();
      ctx.arc(x + dx * 0.4 + Math.sin(t * 0.4 + x) * 2, y + dy * 0.4, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 城市天际线剪影
  ctx.fillStyle = 'rgba(10,8,30,0.9)';
  const baseY = WORLD.HEIGHT - 46;
  ctx.fillRect(0, baseY, WORLD.WIDTH, 46);
  ctx.fillStyle = 'rgba(16,14,44,0.95)';
  let x = -20;
  let seed = 7;
  while (x < WORLD.WIDTH + 40) {
    const w = 30 + ((seed * 53) % 60);
    const h = 30 + ((seed * 97) % 90);
    ctx.fillRect(x, baseY - h, w, h);
    // 小窗灯光
    ctx.fillStyle = 'rgba(0,240,255,0.25)';
    for (let wy = baseY - h + 8; wy < baseY - 8; wy += 16) {
      for (let wx = x + 6; wx < x + w - 6; wx += 14) {
        if ((wx * 3 + wy * 5) % 3 === 0) ctx.fillRect(wx, wy, 4, 6);
      }
    }
    ctx.fillStyle = 'rgba(16,14,44,0.95)';
    x += w + 6;
    seed = (seed * 13 + 7) % 1000;
  }

  // 底部霓虹地线
  ctx.fillStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 12;
  ctx.fillRect(0, baseY, WORLD.WIDTH, 2);
  ctx.shadowBlur = 0;
}

function layout(state) {
  const cols = state.cols;
  const rows = state.rows;
  const areaW = WORLD.WIDTH - MARGIN_X * 2;
  const areaH = AREA_BOTTOM - AREA_TOP;
  const cell = Math.min(areaW / cols, areaH / rows);
  const gridW = cell * cols;
  const gridH = cell * rows;
  const gridX = MARGIN_X + (areaW - gridW) / 2;
  const gridY = AREA_TOP + (areaH - gridH) / 2;
  const cardW = cell * 0.86;
  const cardH = cell * 0.86;
  return { cols, rows, cell, gridX, gridY, cardW, cardH };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function cardRect(state, id) {
    const l = layout(state);
    const r = Math.floor(id / l.cols);
    const c = id % l.cols;
    const cx = l.gridX + c * l.cell + l.cell / 2;
    const cy = l.gridY + r * l.cell + l.cell / 2;
    return { x: cx - l.cardW / 2, y: cy - l.cardH / 2, w: l.cardW, h: l.cardH, cx, cy };
  }

  function drawCard(state, card, t) {
    const { x, y, w, h, cx, cy } = cardRect(state, card.id);
    const reveal = card.solved || card.revealed || state.phase === 'preview' || state.time < state.hintUntil;
    const { shape, color } = shapeFor(card.symbol);

    // 底
    rr(ctx, x, y, w, h, 10);
    if (card.solved) {
      ctx.fillStyle = 'rgba(20,20,40,0.95)';
      ctx.strokeStyle = 'rgba(255,214,0,0.7)';
      ctx.lineWidth = 2;
    } else if (reveal) {
      ctx.fillStyle = 'rgba(16,16,36,0.97)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
    } else if (card.kind === 'rock') {
      ctx.fillStyle = '#191b2c';
      ctx.strokeStyle = card.cracked ? '#8a8fb8' : '#5a5f85';
      ctx.lineWidth = 2;
    } else {
      ctx.fillStyle = '#14162a';
      ctx.strokeStyle = '#2e3356';
      ctx.lineWidth = 2;
    }
    ctx.fill();
    ctx.stroke();

    if (reveal) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = card.solved ? 6 : 14;
      drawShape(ctx, cx, cy, Math.min(w, h) * 0.32, color, shape);
      ctx.restore();
      if (card.solved) {
        ctx.globalAlpha = 0.55;
        drawShape(ctx, cx, cy, Math.min(w, h) * 0.32, color, shape);
        ctx.globalAlpha = 1;
      }
    } else if (card.kind === 'rock') {
      // 岩石纹理：裂纹
      ctx.strokeStyle = card.cracked ? '#cfd4ff' : '#8a8fb8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.24, cy - h * 0.26);
      ctx.lineTo(cx - w * 0.02, cy + h * 0.02);
      ctx.lineTo(cx + w * 0.22, cy - h * 0.08);
      ctx.moveTo(cx + w * 0.02, cy + h * 0.02);
      ctx.lineTo(cx + w * 0.18, cy + h * 0.28);
      ctx.stroke();
      if (card.cracked) {
        ctx.fillStyle = 'rgba(207,212,255,0.8)';
        ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.08, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // 背面徽记
      ctx.strokeStyle = 'rgba(120,130,200,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.16, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(120,130,200,0.35)';
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.06, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawEmptySlot(state, id) {
    const { x, y, w, h } = cardRect(state, id);
    rr(ctx, x, y, w, h, 10);
    ctx.fillStyle = 'rgba(16,18,38,0.5)';
    ctx.strokeStyle = 'rgba(46,51,86,0.35)';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
  }

  function drawFx(view, dt) {
    for (const fx of view.fx) {
      fx.age += dt;
      const k = fx.age / fx.ttl;
      if (k >= 1) continue;
      if (fx.type === 'spark') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = fx.color;
        ctx.beginPath();
        ctx.arc(fx.x + fx.vx * fx.age, fx.y + fx.vy * fx.age, Math.max(0.5, fx.r * (1 - k)), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (fx.type === 'pop') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r * (0.4 + k), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  return {
    draw(state, dt, view = { fx: [] }) {
      const t = state ? state.time : performance.now() / 1000;
      drawBackground(ctx, t);
      if (state) {
        for (const card of state.cards) drawCard(state, card, t);
        for (let id = state.cards.length; id < state.cols * state.rows; id += 1) drawEmptySlot(state, id);
        if (view.shake > 0) {
          const dx = (Math.random() - 0.5) * view.shake;
          const dy = (Math.random() - 0.5) * view.shake;
          ctx.save();
          ctx.translate(dx, dy);
        }
        drawFx(view, dt);
        if (view.shake > 0) ctx.restore();
      } else {
        // 标题屏氛围：一圈空牌剪影
        for (let i = 0; i < 10; i += 1) {
          const a = (i / 10) * Math.PI * 2 + t * 0.2;
          const cx = WORLD.WIDTH / 2 + Math.cos(a) * 300;
          const cy = WORLD.HEIGHT / 2 + Math.sin(a) * 130;
          rr(ctx, cx - 44, cy - 52, 88, 104, 10);
          ctx.fillStyle = 'rgba(20,22,44,0.8)';
          ctx.fill();
          ctx.strokeStyle = COLORS[i % COLORS.length];
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    },
    debugLayout(state) {
      return state ? layout(state) : layout;
    },
    cardRect,
    shapeFor,
  };
}
