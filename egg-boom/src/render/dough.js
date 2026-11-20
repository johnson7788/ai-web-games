// EGG BOOM · 面粉团绘制（带数字耐久 / 护甲团 / 移动团）
import { DOUGH, screenXAt, doughYAt } from '../../config/gameplay.js';

export function drawDough(ctx, d, run, th) {
  const sx = screenXAt(d.atDistance, run.distance);
  const sy = doughYAt(d, run.time);
  const r = DOUGH.R;

  ctx.save();
  ctx.translate(sx, sy);

  // 目标标记：红色「!」置于团顶，明确这是要打掉的目标
  ctx.fillStyle = '#e03a2f';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -r - 16, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '800 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, -r - 15);

  // 面粉团主体（加深描边，提升与背景的对比度）
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r * 1.15);
  g.addColorStop(0, th.dough);
  g.addColorStop(1, th.doughShade);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = th.number;
  ctx.lineWidth = 3;
  ctx.stroke();

  // 面粉质感点
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + (d.phase || 0);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 护甲团：金属环
  if (d.armored) {
    ctx.strokeStyle = '#5a6a8a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, Math.PI * 0.2, Math.PI * 0.9);
    ctx.stroke();
  }

  // 移动团：上下指示箭头
  if (d.moving) {
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, r + 14);
    ctx.lineTo(0, r + 26);
    ctx.lineTo(-5, r + 20);
    ctx.moveTo(0, r + 26);
    ctx.lineTo(5, r + 20);
    ctx.stroke();
  }

  // 数字耐久（加白描边，突出目标数值）
  ctx.font = '800 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeText(String(Math.max(0, d.value)), 0, 1);
  ctx.fillStyle = th.number;
  ctx.fillText(String(Math.max(0, d.value)), 0, 1);

  ctx.restore();
}

// 米粒弹绘制
export function drawBullet(ctx, b, th) {
  const r = b.yolk ? 10 : 5;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.yolk) {
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r + 6);
    g.addColorStop(0, '#ffdf6a');
    g.addColorStop(1, 'rgba(255,200,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = b.yolk ? '#ffd23f' : '#f7f3e8';
  ctx.beginPath();
  ctx.ellipse(0, 0, r + 3, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// 道具绘制
export function drawProp(ctx, p, run, th, time) {
  const sx = screenXAt(p.atDistance, run.distance);
  const y = p.y + Math.sin(time * 3 + (p.id || 0)) * 4;
  ctx.save();
  ctx.translate(sx, y);
  if (p.kind === 'score') {
    // 星星
    ctx.fillStyle = '#ffcf4d';
    star(ctx, 0, 0, 5, 13, 6);
    ctx.fill();
    ctx.strokeStyle = '#e0a62e';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (p.kind === 'ammo') {
    // 米袋
    ctx.fillStyle = '#fff3dd';
    roundRect(ctx, -13, -11, 26, 24, 6);
    ctx.fill();
    ctx.strokeStyle = '#d9c49a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#d9c49a';
    ctx.fillRect(-13, -3, 26, 3);
    ctx.fillStyle = '#8a6b3a';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('米', 0, 4);
  } else {
    // 火力（辣椒/火焰）
    ctx.fillStyle = '#ff5a4d';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function star(ctx, cx, cy, spikes, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
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
