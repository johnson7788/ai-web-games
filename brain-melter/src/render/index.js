// BRAIN MELTER · Canvas 2D 渲染（程序化霓虹街机风，无任何图片素材）
import { WORLD } from '../../config/game.config.js';
import { LEVELS, PALETTE } from '../../config/levels.js';

const PLAY = { x: 90, y: 158, w: 1100, h: 420 };

export function layoutItems(level) {
  const n = level.items.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cellW = PLAY.w / cols;
  const cellH = PLAY.h / rows;
  const r = Math.max(30, Math.min(54, Math.min(cellW, cellH) / 2 - 14));
  return level.items.map((it, i) => {
    const c = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: it.id,
      x: PLAY.x + cellW * (c + 0.5),
      y: PLAY.y + cellH * (row + 0.5),
      r,
    };
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawShape(ctx, shape, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  switch (shape) {
    case 'triangle':
      ctx.moveTo(x, y - r * 0.9);
      ctx.lineTo(x + r * 0.9, y + r * 0.7);
      ctx.lineTo(x - r * 0.9, y + r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'square':
      ctx.rect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
      ctx.fill();
      break;
    case 'diamond':
      ctx.moveTo(x, y - r * 0.9);
      ctx.lineTo(x + r * 0.75, y);
      ctx.lineTo(x, y + r * 0.9);
      ctx.lineTo(x - r * 0.75, y);
      ctx.closePath();
      ctx.fill();
      break;
    case 'hex':
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * 0.85 * Math.cos(a);
        const py = y + r * 0.85 * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'star': {
      const spikes = 5;
      const outer = r * 0.9;
      const inner = r * 0.42;
      for (let i = 0; i < spikes * 2; i += 1) {
        const rad = i % 2 === 0 ? outer : inner;
        const a = (Math.PI / spikes) * i - Math.PI / 2;
        const px = x + rad * Math.cos(a);
        const py = y + rad * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'arrow': {
      // 箭头默认朝上（rot=0 = 朝上）
      ctx.moveTo(x, y - r * 0.9);
      ctx.lineTo(x + r * 0.7, y + r * 0.7);
      ctx.lineTo(x + r * 0.28, y + r * 0.28);
      ctx.lineTo(x - r * 0.28, y + r * 0.28);
      ctx.lineTo(x - r * 0.7, y + r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'circle':
    default:
      ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0a0618');
    g.addColorStop(0.55, '#160b2e');
    g.addColorStop(1, '#2a0f4d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 合成波地平线 + 太阳
    const horizon = 470;
    const sunX = WORLD.WIDTH / 2;
    const sunY = horizon - 20;
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 240);
    glow.addColorStop(0, 'rgba(255, 110, 190, 0.85)');
    glow.addColorStop(0.5, 'rgba(255, 45, 120, 0.35)');
    glow.addColorStop(1, 'rgba(255, 45, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 260, sunY - 260, 520, 520);

    ctx.fillStyle = '#ff7ad9';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 96, 0, Math.PI * 2);
    ctx.fill();

    // 太阳条纹
    ctx.fillStyle = '#160b2e';
    for (let i = 0; i < 6; i += 1) {
      const yy = sunY + 14 + i * 16;
      const ww = 96 - i * 9;
      ctx.fillRect(sunX - ww, yy, ww * 2, 4 + i);
    }

    // 地面网格
    ctx.strokeStyle = 'rgba(180, 120, 255, 0.28)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 16; i += 1) {
      const tx = i / 16;
      const x0 = WORLD.WIDTH / 2 + (tx - 0.5) * WORLD.WIDTH * 1.4;
      const yBottom = WORLD.HEIGHT;
      const yTop = horizon + 60;
      ctx.beginPath();
      ctx.moveTo(WORLD.WIDTH / 2 + (tx - 0.5) * 140, horizon + 20);
      ctx.lineTo(x0, yBottom);
      ctx.stroke();
    }
    for (let i = 0; i <= 8; i += 1) {
      const y = horizon + 20 + i * ((WORLD.HEIGHT - horizon - 20) / 8);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }

    // 漂浮粒子（节拍感）
    const seed = Math.floor(t * 2);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.6)';
    for (let i = 0; i < 26; i += 1) {
      const px = ((seed * 37 + i * 97) % 1280);
      const py = 60 + ((seed * 13 + i * 53) % 360);
      ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.fillRect(px, py, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawItem(it, lay, state, view, t) {
    const { x, y, r } = lay;
    const color = PALETTE[it.color || 0];
    const dim = state.cleared.includes(it.id)
      || (state.type === 'sequence' && (it.order || 0) <= state.seq);
    const picked = state.picked.includes(it.id);
    const pulse = 1 + 0.05 * Math.sin(t * 4 + (it.id.charCodeAt(0) || 0));

    // 底板
    ctx.save();
    ctx.globalAlpha = dim ? 0.32 : 1;
    ctx.fillStyle = 'rgba(10, 8, 24, 0.72)';
    ctx.strokeStyle = picked ? '#ffffff' : color;
    ctx.lineWidth = picked ? 4 : 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = picked ? 24 : 12;
    roundRect(ctx, x - r * pulse, y - r * pulse, r * 2 * pulse, r * 2 * pulse, r * 0.34);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 内容
    ctx.save();
    ctx.globalAlpha = dim ? 0.35 : 1;
    if (state.type === 'sequence' || state.type === 'sum') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(r * 1.05)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.label || '', x, y + 2);
    } else if (state.type === 'rotation') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(((state.rot[it.id] || 0) * Math.PI) / 180);
      drawShape(ctx, 'arrow', 0, 0, r, color);
      ctx.restore();
      // 目标朝向刻度（顶部小三角）
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(x, y - r - 6);
      ctx.lineTo(x - 6, y - r - 16);
      ctx.lineTo(x + 6, y - r - 16);
      ctx.closePath();
      ctx.fill();
    } else {
      drawShape(ctx, it.shape || 'circle', x, y, r, color);
    }
    ctx.restore();

    // 提示高亮 / 正确错误闪光
    const hitFx = view.fx.find((f) => f.id === it.id && (f.type === 'hint' || f.type === 'flash'));
    if (hitFx) {
      ctx.strokeStyle = hitFx.type === 'hint' ? '#ffffff' : (hitFx.color || '#ffffff');
      ctx.lineWidth = hitFx.type === 'hint' ? 5 : 6;
      ctx.globalAlpha = Math.max(0, hitFx.ttl / 0.8);
      ctx.beginPath();
      ctx.arc(x, y, r + 8 + (hitFx.type === 'hint' ? 6 * Math.sin(t * 10) : 0), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function draw(state, dt, view) {
    const t = view.time || 0;
    drawBackground(t);
    if (!state) return;

    const level = LEVELS[state.levelIndex] || LEVELS[0];
    const lays = layoutItems(level);

    // 目标提示（画布内，清晰可见）
    if (state.phase === 'playing' || state.phase === 'paused') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '600 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(view.goalText || '', WORLD.WIDTH / 2, PLAY.y - 46);
    }

    for (let i = 0; i < level.items.length; i += 1) {
      drawItem(level.items[i], lays[i], state, view, t);
    }
  }

  function debugLayout() {
    return { play: PLAY, items: layoutItems(LEVELS[0]) };
  }

  return { draw, debugLayout, layoutItems: (level) => layoutItems(level) };
}
