// src/render/index.js — Canvas 2D 程序化渲染：4 套场景包 + 机关道具 + 丘比特角色。
// 全矢量绘制，零外部素材。draw(run, opts)：run=null 时只画背景（标题屏氛围）。
// opts = { lang, expression, drag: {id, x, y} }（expression: neutral | happy | pout）
import { WORLD } from '../../config/game.config.js';
import { sceneOf } from './theme.js';

const FONT = "'PingFang SC', 'Hiragino Sans', 'Segoe UI', 'Microsoft YaHei', 'Courier New', monospace";

const GLYPH_COLOR = {
  bottle: '#ff9ec4', bulb: '#ffd166', person: '#f4978e', plant: '#8fe36a',
  bird: '#6a8fe3', star: '#ffd166', cloud: '#ffffff', sun: '#ffb347',
  moon: '#e8d7a0', key: '#d9b36a', gear: '#e0a0d0', card: '#b39df0',
  cup: '#ff9ec4', rect: '#a5c8ff', circle: '#ffb36a', arrow: '#ff6b6b',
  heart: '#ff5d8f', lips: '#ff4d6d', ring: '#7fd8f0', letter: '#ffd166',
  rose: '#ff5d8f', crown: '#ffd166', bell: '#ffd166', gem: '#8ee3f5',
  choco: '#b07a4e', gift: '#ff6fa5', candle: '#ff9ec4', mirror: '#c0d4ff',
  mask: '#b39df0',
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof r !== 'number') r = Math.min(12, w / 4, h / 4);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx, x, y, r, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function heartPath(ctx, cx, cy, s) {
  const u = s / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + u * 0.9);
  ctx.bezierCurveTo(cx - u * 1.1, cy + u * 0.1, cx - u * 0.55, cy - u * 0.75, cx, cy - u * 0.35);
  ctx.bezierCurveTo(cx + u * 0.55, cy - u * 0.75, cx + u * 1.1, cy + u * 0.1, cx, cy + u * 0.9);
  ctx.closePath();
}

function drawGlyph(ctx, glyph, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const cx = x;
  const cy = y;
  const u = s / 2;

  if (glyph === 'circle') {
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.62, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (glyph === 'rect') {
    rr(ctx, cx - u * 0.6, cy - u * 0.4, u * 1.2, u * 0.8, 4); ctx.fill(); ctx.stroke();
  } else if (glyph === 'star') {
    starPath(ctx, cx, cy, u * 0.75); ctx.fill(); ctx.stroke();
  } else if (glyph === 'cloud') {
    ctx.beginPath();
    ctx.arc(cx - u * 0.5, cy + u * 0.1, u * 0.4, 0, Math.PI * 2);
    ctx.arc(cx, cy - u * 0.15, u * 0.5, 0, Math.PI * 2);
    ctx.arc(cx + u * 0.5, cy + u * 0.1, u * 0.42, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else if (glyph === 'sun') {
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * u * 0.65, cy + Math.sin(a) * u * 0.65);
      ctx.lineTo(cx + Math.cos(a) * u * 0.95, cy + Math.sin(a) * u * 0.95);
      ctx.stroke();
    }
  } else if (glyph === 'moon') {
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(cx + u * 0.4, cy - u * 0.15, u * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.6, 0, Math.PI * 2); ctx.stroke();
  } else if (glyph === 'bottle') {
    rr(ctx, cx - u * 0.28, cy - u * 0.35, u * 0.56, u * 0.75, 3); ctx.fill(); ctx.stroke();
    rr(ctx, cx - u * 0.12, cy - u * 0.62, u * 0.24, u * 0.3, 2); ctx.fill(); ctx.stroke();
  } else if (glyph === 'person') {
    ctx.beginPath(); ctx.arc(cx, cy - u * 0.3, u * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + u * 0.3, u * 0.45, Math.PI, 0); ctx.fill(); ctx.stroke();
  } else if (glyph === 'plant') {
    ctx.beginPath(); ctx.moveTo(cx, cy + u * 0.5); ctx.quadraticCurveTo(cx - u * 0.2, cy, cx - u * 0.55, cy - u * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + u * 0.5); ctx.quadraticCurveTo(cx + u * 0.2, cy, cx + u * 0.55, cy - u * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - u * 0.35, u * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (glyph === 'bird') {
    ctx.beginPath(); ctx.ellipse(cx, cy, u * 0.55, u * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + u * 0.4, cy - u * 0.05); ctx.lineTo(cx + u * 0.7, cy - u * 0.25); ctx.lineTo(cx + u * 0.5, cy + u * 0.1); ctx.closePath(); ctx.fill();
  } else if (glyph === 'key') {
    ctx.beginPath(); ctx.arc(cx - u * 0.3, cy, u * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + u * 0.7, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + u * 0.4, cy); ctx.lineTo(cx + u * 0.4, cy - u * 0.25); ctx.stroke();
  } else if (glyph === 'gear') {
    starPath(ctx, cx, cy, u * 0.7, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
  } else if (glyph === 'card') {
    rr(ctx, cx - u * 0.6, cy - u * 0.4, u * 1.2, u * 0.8, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - u * 0.6, cy - u * 0.1); ctx.lineTo(cx + u * 0.6, cy - u * 0.1); ctx.stroke();
  } else if (glyph === 'cup') {
    ctx.beginPath();
    ctx.moveTo(cx - u * 0.5, cy - u * 0.4); ctx.lineTo(cx + u * 0.5, cy - u * 0.4);
    ctx.lineTo(cx + u * 0.3, cy + u * 0.45); ctx.lineTo(cx - u * 0.3, cy + u * 0.45);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (glyph === 'bulb') {
    ctx.beginPath(); ctx.arc(cx, cy - u * 0.1, u * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    rr(ctx, cx - u * 0.18, cy + u * 0.28, u * 0.36, u * 0.3, 2); ctx.fill(); ctx.stroke();
  } else if (glyph === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - u * 0.6); ctx.lineTo(cx + u * 0.55, cy + u * 0.2);
    ctx.lineTo(cx + u * 0.15, cy + u * 0.1); ctx.lineTo(cx + u * 0.15, cy + u * 0.6);
    ctx.lineTo(cx - u * 0.15, cy + u * 0.6); ctx.lineTo(cx - u * 0.15, cy + u * 0.1);
    ctx.lineTo(cx - u * 0.55, cy + u * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (glyph === 'heart') {
    heartPath(ctx, cx, cy, s); ctx.fill(); ctx.stroke();
  } else if (glyph === 'lips') {
    ctx.beginPath();
    ctx.moveTo(cx - u * 0.75, cy - u * 0.15);
    ctx.quadraticCurveTo(cx - u * 0.35, cy - u * 0.7, cx, cy - u * 0.15);
    ctx.quadraticCurveTo(cx + u * 0.35, cy - u * 0.7, cx + u * 0.75, cy - u * 0.15);
    ctx.quadraticCurveTo(cx, cy + u * 0.7, cx - u * 0.75, cy - u * 0.15);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (glyph === 'ring') {
    ctx.beginPath(); ctx.arc(cx, cy + u * 0.1, u * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - u * 0.2, cy - u * 0.3); ctx.lineTo(cx, cy - u * 0.7); ctx.lineTo(cx + u * 0.2, cy - u * 0.3); ctx.closePath(); ctx.fill();
  } else if (glyph === 'letter') {
    rr(ctx, cx - u * 0.65, cy - u * 0.4, u * 1.3, u * 0.8, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - u * 0.65, cy - u * 0.4); ctx.lineTo(cx, cy); ctx.lineTo(cx + u * 0.65, cy - u * 0.4); ctx.stroke();
  } else if (glyph === 'rose') {
    ctx.beginPath(); ctx.arc(cx, cy - u * 0.15, u * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - u * 0.15, u * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.moveTo(cx, cy + u * 0.3); ctx.lineTo(cx, cy + u * 0.75); ctx.stroke();
  } else if (glyph === 'crown') {
    ctx.beginPath();
    ctx.moveTo(cx - u * 0.7, cy + u * 0.4);
    ctx.lineTo(cx - u * 0.7, cy - u * 0.3);
    ctx.lineTo(cx - u * 0.3, cy + u * 0.1);
    ctx.lineTo(cx, cy - u * 0.6);
    ctx.lineTo(cx + u * 0.3, cy + u * 0.1);
    ctx.lineTo(cx + u * 0.7, cy - u * 0.3);
    ctx.lineTo(cx + u * 0.7, cy + u * 0.4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (glyph === 'bell') {
    ctx.beginPath();
    ctx.arc(cx, cy - u * 0.15, u * 0.55, Math.PI, 0);
    ctx.lineTo(cx + u * 0.6, cy + u * 0.3);
    ctx.lineTo(cx - u * 0.6, cy + u * 0.3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + u * 0.4, u * 0.16, 0, Math.PI * 2); ctx.fill();
  } else if (glyph === 'gem') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - u * 0.8); ctx.lineTo(cx + u * 0.6, cy - u * 0.1);
    ctx.lineTo(cx, cy + u * 0.8); ctx.lineTo(cx - u * 0.6, cy - u * 0.1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (glyph === 'choco') {
    rr(ctx, cx - u * 0.55, cy - u * 0.35, u * 1.1, u * 0.7, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - u * 0.35); ctx.lineTo(cx, cy + u * 0.35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - u * 0.55, cy); ctx.lineTo(cx + u * 0.55, cy); ctx.stroke();
  } else if (glyph === 'gift') {
    rr(ctx, cx - u * 0.6, cy - u * 0.35, u * 1.2, u * 0.75, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - u * 0.12, cy - u * 0.35, u * 0.24, u * 0.75);
    ctx.fillRect(cx - u * 0.6, cy - u * 0.08, u * 1.2, u * 0.16);
    ctx.beginPath(); ctx.arc(cx - u * 0.25, cy - u * 0.5, u * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + u * 0.25, cy - u * 0.5, u * 0.22, 0, Math.PI * 2); ctx.fill();
  } else if (glyph === 'candle') {
    rr(ctx, cx - u * 0.25, cy - u * 0.1, u * 0.5, u * 0.7, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.ellipse(cx, cy - u * 0.45, u * 0.16, u * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  } else if (glyph === 'mirror') {
    rr(ctx, cx - u * 0.5, cy - u * 0.55, u, u * 1.1, 16); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - u * 0.15, cy + u * 0.55); ctx.lineTo(cx - u * 0.15, cy + u * 0.9); ctx.lineTo(cx + u * 0.15, cy + u * 0.9); ctx.lineTo(cx + u * 0.15, cy + u * 0.55); ctx.stroke();
  } else if (glyph === 'mask') {
    ctx.beginPath();
    ctx.moveTo(cx - u * 0.8, cy - u * 0.2);
    ctx.quadraticCurveTo(cx - u * 0.5, cy - u * 0.55, cx, cy - u * 0.25);
    ctx.quadraticCurveTo(cx + u * 0.5, cy - u * 0.55, cx + u * 0.8, cy - u * 0.2);
    ctx.quadraticCurveTo(cx + u * 0.4, cy + u * 0.25, cx, cy + u * 0.1);
    ctx.quadraticCurveTo(cx - u * 0.4, cy + u * 0.25, cx - u * 0.8, cy - u * 0.2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(cx - u * 0.3, cy - u * 0.12, u * 0.16, u * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + u * 0.3, cy - u * 0.12, u * 0.16, u * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function drawObject(ctx, o, scene, lang, time, highlight, badge) {
  const color = GLYPH_COLOR[o.glyph] || GLYPH_COLOR.rect;
  const x = o.x;
  const y = o.y;
  const dark = scene.name === 'moon';

  ctx.save();
  ctx.shadowColor = dark ? 'rgba(0,0,0,0.4)' : 'rgba(120,40,80,0.18)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  rr(ctx, x - o.w / 2, y - o.h / 2, o.w, o.h, 14);
  ctx.fillStyle = dark ? 'rgba(24,14,48,0.78)' : 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = highlight ? scene.accent : (dark ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)');
  ctx.lineWidth = highlight ? 3 : 2;
  rr(ctx, x - o.w / 2, y - o.h / 2, o.w, o.h, 14);
  ctx.stroke();
  if (highlight) {
    const pulse = 0.6 + 0.4 * Math.sin(time * 4);
    ctx.strokeStyle = `rgba(255, 111, 165, ${0.55 + 0.4 * pulse})`;
    ctx.lineWidth = 5;
    rr(ctx, x - o.w / 2 - 5, y - o.h / 2 - 5, o.w + 10, o.h + 10, 18);
    ctx.stroke();
  }

  // 图标
  drawGlyph(ctx, o.glyph, x, y - o.h * 0.16, Math.min(o.w, o.h) * 0.62, color);

  // 标签
  ctx.fillStyle = dark ? '#ffe3ee' : '#6b2b44';
  ctx.strokeStyle = dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  const label = o.label[lang] || o.label.en;
  ctx.font = `bold ${Math.max(14, Math.min(22, o.w / 8))}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapText(ctx, label, o.w * 0.86);
  const lh = Math.max(16, o.w / 8) * 1.1;
  lines.forEach((ln, i) => {
    const ly = y + o.h * 0.28 + i * lh;
    ctx.strokeText(ln, x, ly);
    ctx.fillText(ln, x, ly);
  });

  // 拖拽提示（可拖物）
  if (o.draggable) {
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.7)' : 'rgba(107,43,68,0.6)';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('↕', x + o.w / 2 - 14, y - o.h / 2 + 12);
  }

  // 顺序编号徽章（tapSeq 关）
  if (typeof badge === 'number') {
    ctx.fillStyle = scene.accent;
    ctx.beginPath();
    ctx.arc(x + o.w / 2 - 4, y - o.h / 2 - 4, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(badge), x + o.w / 2 - 4, y - o.h / 2 - 4);
  }

  // 长按目标提示（hold 关）
  if (badge === 'hold') {
    const r = 20 + 3 * Math.sin(time * 4);
    ctx.strokeStyle = `rgba(255, 111, 165, ${0.5 + 0.3 * Math.sin(time * 4)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y - o.h * 0.16, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScene(ctx, scene, time, chapter) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, scene.bgTop);
  g.addColorStop(1, scene.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  ctx.save();
  if (scene.deco === 'sweet') {
    // 飘浮的糖果圆点
    for (let i = 0; i < 18; i += 1) {
      const sx = (i * 173) % WORLD.WIDTH;
      const sy = 120 + ((i * 61) % 480);
      const tw = 0.5 + 0.5 * Math.abs(Math.sin(time * 1.2 + i));
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.7)' : 'rgba(255,111,165,0.5)';
      ctx.beginPath(); ctx.arc(sx, sy, 6 + (i % 4) * 3, 0, Math.PI * 2); ctx.fill();
    }
    // 底部糖霜波浪
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(0, 620);
    for (let x = 0; x <= WORLD.WIDTH; x += 40) {
      ctx.lineTo(x, 620 + Math.sin(x * 0.02 + time) * 10);
    }
    ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT); ctx.lineTo(0, WORLD.HEIGHT);
    ctx.closePath(); ctx.fill();
  } else if (scene.deco === 'garden') {
    ctx.fillStyle = 'rgba(143,227,106,0.3)';
    ctx.fillRect(0, 580, WORLD.WIDTH, 140);
    // 树 + 心形灌木
    [180, 1120].forEach((x) => {
      ctx.fillStyle = 'rgba(120,80,60,0.7)';
      ctx.fillRect(x - 12, 400, 24, 180);
      ctx.fillStyle = 'rgba(255,111,165,0.5)';
      heartPath(ctx, x, 340, 140); ctx.fill();
    });
    for (let i = 0; i < 10; i += 1) {
      const fx = 200 + i * 96;
      const fy = 600 + ((i * 37) % 40);
      ctx.fillStyle = i % 2 ? 'rgba(255,209,102,0.8)' : 'rgba(255,111,165,0.8)';
      ctx.beginPath(); ctx.arc(fx, fy, 7, 0, Math.PI * 2); ctx.fill();
    }
  } else if (scene.deco === 'studio') {
    // 悬挂的爱心串
    for (let i = 0; i < 6; i += 1) {
      const hx = 160 + i * 200;
      const bob = Math.sin(time * 1.6 + i) * 6;
      ctx.strokeStyle = 'rgba(255,111,165,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, 120 + bob); ctx.stroke();
      ctx.fillStyle = 'rgba(255,111,165,0.55)';
      heartPath(ctx, hx, 140 + bob, 36); ctx.fill();
    }
    // 箭靶装饰
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(1120, 220, 60, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(1120, 220, 38, 0, Math.PI * 2); ctx.stroke();
  } else if (scene.deco === 'moon') {
    // 星星
    for (let i = 0; i < 60; i += 1) {
      const sx = (i * 197) % WORLD.WIDTH;
      const sy = (i * 89) % (WORLD.HEIGHT - 120);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.5 + i));
      ctx.fillStyle = `rgba(255,255,255,${0.3 * tw})`;
      ctx.beginPath(); ctx.arc(sx, sy, 1.4 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    // 大月亮
    ctx.fillStyle = 'rgba(232,215,160,0.9)';
    ctx.beginPath(); ctx.arc(180, 190, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200,180,130,0.5)';
    ctx.beginPath(); ctx.arc(165, 175, 14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(200, 205, 9, 0, Math.PI * 2); ctx.fill();
    // 舞台地板
    ctx.fillStyle = 'rgba(255,111,165,0.12)';
    ctx.fillRect(0, 560, WORLD.WIDTH, 14);
  }
  ctx.restore();

  // 章节水印
  ctx.fillStyle = scene.name === 'moon' ? 'rgba(255,255,255,0.16)' : 'rgba(107,43,68,0.16)';
  ctx.font = `800 ${52}px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(String(chapter).padStart(2, '0'), WORLD.WIDTH - 24, 16);
}

function drawCupid(ctx, x, y, s, expression, time) {
  ctx.save();
  ctx.translate(x, y);
  const bob = expression === 'happy' ? Math.sin(time * 18) * 3 : 0;
  ctx.translate(0, bob);

  // 小翅膀
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.ellipse(-s * 0.5, -s * 0.15, s * 0.3, s * 0.16, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * 0.5, -s * 0.15, s * 0.3, s * 0.16, 0.4, 0, Math.PI * 2); ctx.fill();

  // 身体（小袍子）
  ctx.fillStyle = '#ffe3ee';
  rr(ctx, -s * 0.45, s * 0.05, s * 0.9, s * 0.9, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,40,80,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 腰带爱心
  ctx.fillStyle = '#ff5d8f';
  heartPath(ctx, 0, s * 0.5, s * 0.4); ctx.fill();

  // 头
  ctx.fillStyle = '#f7c9a8';
  ctx.beginPath(); ctx.arc(0, -s * 0.22, s * 0.34, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,40,80,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 卷发
  ctx.fillStyle = '#f0a868';
  ctx.beginPath();
  ctx.arc(-s * 0.26, -s * 0.45, s * 0.14, 0, Math.PI * 2);
  ctx.arc(0, -s * 0.52, s * 0.14, 0, Math.PI * 2);
  ctx.arc(s * 0.26, -s * 0.45, s * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = '#5b3a2a';
  ctx.beginPath(); ctx.arc(-s * 0.14, -s * 0.22, s * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.22, s * 0.05, 0, Math.PI * 2); ctx.fill();

  // 嘴：neutral 微笑 / happy 大笑 / pout 委屈
  ctx.strokeStyle = '#5b3a2a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const my = -s * 0.02;
  if (expression === 'happy') {
    ctx.fillStyle = '#5b3a2a';
    ctx.beginPath(); ctx.arc(0, my, s * 0.2, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8a8a';
    ctx.beginPath(); ctx.arc(0, my + s * 0.04, s * 0.12, 0, Math.PI); ctx.fill();
  } else if (expression === 'pout') {
    ctx.beginPath(); ctx.arc(0, my + s * 0.22, s * 0.2, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.24, -s * 0.38); ctx.lineTo(-s * 0.06, -s * 0.32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.24, -s * 0.38); ctx.lineTo(s * 0.06, -s * 0.32); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-s * 0.14, my); ctx.lineTo(s * 0.14, my); ctx.stroke();
  }
  ctx.restore();
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function draw(run, opts = {}) {
    const lang = opts.lang || 'en';
    const expression = opts.expression || 'neutral';
    const drag = opts.drag || null;
    const chapter = run ? run.level.chapter : 1;
    const scene = sceneOf(chapter);
    const time = run ? run.time : 0;

    drawScene(ctx, scene, time, chapter);

    if (!run) {
      drawCupid(ctx, 110, 660, 120, expression, time);
      return;
    }

    ctx.save();
    if (run.ls.sceneRotated) {
      ctx.translate(WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-WORLD.WIDTH / 2, -WORLD.HEIGHT / 2);
    }

    // 高亮 + 编号/长按提示：当前解法涉及的交互物（goal 可读性）
    const targets = new Set();
    const badges = new Map(); // id -> number | 'hold'
    for (let i = 0; i < run.level.solution.length; i += 1) {
      if (run.ls.done[i]) continue;
      const req = run.level.solution[i];
      if (req.kind === 'dragTo') targets.add(req.targetId);
      else if (req.kind === 'invert') targets.add('handle');
      else if (req.kind === 'tapSeq') {
        const idx = run.ls.seqProgress[i] || 0;
        req.ids.forEach((id, k) => {
          targets.add(id);
          if (k === idx) badges.set(id, k + 1);
        });
      } else if (req.kind === 'hold') {
        targets.add(req.id);
        badges.set(req.id, 'hold');
      } else {
        targets.add(req.id);
      }
    }

    for (const o of run.objects) {
      if (run.ls.moved.has(o.id)) continue;
      if (run._isCovered(o)) continue;
      if (run.ls.placed.has(o.id)) continue;
      if (drag && drag.id === o.id) continue;
      drawObject(ctx, o, scene, lang, time, targets.has(o.id), badges.get(o.id));
    }

    // 已放置的物体：吸附到目标中心
    for (const [id, targetId] of run.ls.placed) {
      const o = run._objectById(id);
      const t = run._objectById(targetId);
      if (o && t) {
        const placed = { ...o, x: t.x, y: t.y - (t.h / 2 - o.h / 2), draggable: false };
        drawObject(ctx, placed, scene, lang, time, false, badges.get(id));
      }
    }

    // 拖拽中的物体画在手指处
    if (drag) {
      const o = run._objectById(drag.id);
      if (o && !run.ls.placed.has(o.id)) {
        drawObject(ctx, { ...o, x: drag.x, y: drag.y }, scene, lang, time, true, badges.get(o.id));
      }
    }

    ctx.restore();

    // 丘比特（不受场景翻转影响，始终正立；放左下角避免遮挡可交互物）
    drawCupid(ctx, 110, 660, 120, expression, time);
  }

  return { draw };
}

export default createRender;
