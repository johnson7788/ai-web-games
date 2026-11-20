// src/render/objects.js — 掉落物（花盆/水瓶/家具/冰箱/无人机）+ 地面预警标记。
import { WORLD, ITEM_COLORS, rgbCss, hexToRgb } from './theme.js';

const TAU = Math.PI * 2;

function shadow(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(10,10,20,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.9, r * 0.34, 0, 0, TAU);
  ctx.fill();
}

function outline(ctx, x, y, r, color) {
  ctx.strokeStyle = rgbCss(hexToRgb(color), 0.9);
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawWarning(ctx, item, now) {
  const x = item.x;
  const y = WORLD.GROUND_Y;
  const pulse = 0.6 + 0.4 * Math.sin(now * 0.01 + item.id);
  const R = item.isBig ? 34 : 26;
  const c = item.isBig ? '255,90,90' : '255,180,60';
  ctx.save();
  // 坠落列虚线导引
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = `rgba(${c},${0.28 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 170);
  ctx.lineTo(x, y - R);
  ctx.stroke();
  ctx.setLineDash([]);
  // 落点危险圈
  ctx.strokeStyle = `rgba(${c},${pulse})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = `rgba(${c},0.9)`;
  ctx.font = 'bold 24px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', x, y);
  ctx.restore();
}

// 每种物品的形状（程序化，无外链素材）
function drawShape(ctx, item, now) {
  const { x, y, r } = item;
  const c = ITEM_COLORS[item.kind] || '#cccccc';
  ctx.fillStyle = c;
  ctx.strokeStyle = 'rgba(15,15,25,0.55)';
  ctx.lineWidth = 2.5;

  switch (item.kind) {
    case 'bottle': {
      const w = r * 1.3;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(item.id) * 0.4);
      ctx.fillRect(-w / 2, -r * 1.2, w, r * 1.2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-w / 2, -r * 1.2, w, r * 0.35);
      ctx.restore();
      break;
    }
    case 'pot': {
      ctx.beginPath();
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y - r);
      ctx.lineTo(x + r * 0.7, y + r);
      ctx.lineTo(x - r * 0.7, y + r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(60,40,30,0.6)';
      ctx.fillRect(x - r * 1.1, y - r * 1.4, r * 2.2, r * 0.5);
      break;
    }
    case 'cup': {
      ctx.fillRect(x - r * 0.8, y - r, r * 1.6, r * 2);
      ctx.strokeRect(x - r * 0.8, y - r, r * 1.6, r * 2);
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(x + r * 0.9, y, r * 0.5, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      break;
    }
    case 'can': {
      ctx.fillRect(x - r * 0.8, y - r, r * 1.6, r * 2);
      ctx.strokeRect(x - r * 0.8, y - r, r * 1.6, r * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - r * 0.8, y - r * 0.4, r * 1.6, r * 0.5);
      break;
    }
    case 'drone': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(now * 0.01 + item.id) * 0.2);
      ctx.fillStyle = '#2a3240';
      ctx.fillRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
      ctx.fillStyle = '#ff6b81';
      ctx.fillRect(-r * 1.4, -r * 0.5, r * 0.7, r);
      ctx.fillRect(r * 0.7, -r * 0.5, r * 0.7, r);
      ctx.fillStyle = 'rgba(255,107,129,0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, TAU);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'fridge': {
      ctx.fillRect(x - r * 0.9, y - r * 1.2, r * 1.8, r * 2.4);
      ctx.strokeRect(x - r * 0.9, y - r * 1.2, r * 1.8, r * 2.4);
      ctx.strokeStyle = 'rgba(15,15,25,0.5)';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.9, y - r * 0.1);
      ctx.lineTo(x + r * 0.9, y - r * 0.1);
      ctx.stroke();
      break;
    }
    case 'sofa': {
      ctx.fillRect(x - r, y - r * 0.7, r * 2, r * 1.4);
      ctx.strokeRect(x - r, y - r * 0.7, r * 2, r * 1.4);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x - r, y - r * 1.2, r * 2, r * 0.5);
      break;
    }
    case 'tv': {
      ctx.fillRect(x - r * 0.95, y - r * 0.8, r * 1.9, r * 1.5);
      ctx.strokeRect(x - r * 0.95, y - r * 0.8, r * 1.9, r * 1.5);
      ctx.fillStyle = 'rgba(30,60,90,0.9)';
      ctx.fillRect(x - r * 0.72, y - r * 0.6, r * 1.44, r * 1.1);
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }
}

export function drawItems(ctx, run, pal) {
  for (const item of run.items) {
    if (!item.active) {
      drawWarning(ctx, item, run.time);
      continue;
    }
    // 地面影子（随高度缩小、透明度变化）
    const t = Math.max(0, Math.min(1, (WORLD.GROUND_Y - item.y) / 300));
    if (item.y < WORLD.GROUND_Y - 20) {
      ctx.save();
      ctx.globalAlpha = 0.25 + t * 0.25;
      shadow(ctx, item.x, WORLD.GROUND_Y, item.r * (0.5 + t * 0.5));
      ctx.restore();
    }
    // 坠落速度线 + 危险描边（让坠物读作威胁）
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = item.isBig ? 'rgba(255,90,90,0.7)' : 'rgba(255,180,60,0.7)';
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k += 1) {
      ctx.beginPath();
      ctx.moveTo(item.x + k * item.r * 0.5, item.y - item.r - 22);
      ctx.lineTo(item.x + k * item.r * 0.5, item.y - item.r - 6);
      ctx.stroke();
    }
    ctx.restore();

    drawShape(ctx, item, run.time);

    ctx.save();
    ctx.strokeStyle = item.isBig ? 'rgba(255,90,90,0.9)' : 'rgba(255,180,60,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.r + 3, 0, TAU);
    ctx.stroke();
    ctx.restore();

    if (item.tracking) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,107,129,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(item.x, item.y + item.r);
      ctx.lineTo(item.x + item.vx * 0.2, item.y + item.r + 22);
      ctx.stroke();
      ctx.restore();
    }
  }
}
