// src/render/units.js — 程序化角色/敌人绘制（几何小人 + 不透明血条 + 状态标记）
const CLASS_ICON = {
  vanguard: 'shield',
  ranger: 'bow',
  seer: 'staff',
  enemy: 'spike',
  boss: 'crown',
};

function hpColor(p) {
  return p > 0.5 ? '#58d68d' : p > 0.25 ? '#f4c152' : '#ef6b6b';
}

export function drawFighter(ctx, x, y, u, time) {
  const kind = u.kind || 'enemy';
  const alive = u.alive !== false;
  const s = 1.0;
  ctx.save();
  ctx.globalAlpha = alive ? 1 : 0.35;
  if (u.tauntTurns > 0) {
    ctx.globalAlpha = 1;
  }

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 34, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 身体
  const body = ctx.createLinearGradient(x - 20, y - 10, x + 20, y + 20);
  body.addColorStop(0, u.color);
  body.addColorStop(1, '#20242e');
  ctx.fillStyle = body;
  roundRect(ctx, x - 20, y - 16, 40, 46, 12);
  ctx.fill();

  // 头
  ctx.fillStyle = u.color;
  ctx.beginPath();
  ctx.arc(x, y - 32, 17 * s, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = '#10131a';
  ctx.beginPath();
  ctx.arc(x - 6, y - 34, 2.6, 0, Math.PI * 2);
  ctx.arc(x + 6, y - 34, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // 职业标记
  drawIcon(ctx, x, y - 2, CLASS_ICON[kind] || 'spike', u.color, time);

  ctx.restore();

  // 状态标记（在身体之上，不透明，保证可读）
  if (u.shield > 0) {
    ctx.strokeStyle = '#8fd3ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 4, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (u.tauntTurns > 0) {
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 18px system-ui';
    ctx.fillText('!', x + 24, y - 34);
  }
  if (u.buffAtk > 0) {
    ctx.fillStyle = '#5fd0a0';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText('▲', x - 34, y - 38);
  }
  if (u.markedTurns > 0) {
    ctx.strokeStyle = '#ff5d73';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y - 2, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawIcon(ctx, x, y, icon, color, time) {
  ctx.save();
  ctx.fillStyle = '#10131a';
  if (icon === 'shield') {
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x + 10, y - 10);
    ctx.lineTo(x + 10, y);
    ctx.lineTo(x, y + 8);
    ctx.lineTo(x - 10, y);
    ctx.lineTo(x - 10, y - 10);
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'bow') {
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 2, 12, -Math.PI * 0.8, Math.PI * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 8);
    ctx.lineTo(x + 12, y + 4);
    ctx.stroke();
  } else if (icon === 'staff') {
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 16);
    ctx.lineTo(x - 6, y + 12);
    ctx.stroke();
    ctx.fillStyle = '#10131a';
    ctx.beginPath();
    ctx.arc(x + 8, y - 18, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (icon === 'crown') {
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 4);
    ctx.lineTo(x - 10, y - 14);
    ctx.lineTo(x - 4, y - 8);
    ctx.lineTo(x, y - 16);
    ctx.lineTo(x + 4, y - 8);
    ctx.lineTo(x + 10, y - 14);
    ctx.lineTo(x + 10, y - 4);
    ctx.closePath();
    ctx.fill();
  } else {
    // spike：两把小刀
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 8);
    ctx.lineTo(x - 4, y - 12);
    ctx.lineTo(x - 2, y - 12);
    ctx.lineTo(x - 10, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 8);
    ctx.lineTo(x + 4, y - 12);
    ctx.lineTo(x + 2, y - 12);
    ctx.lineTo(x + 10, y + 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawHpBar(ctx, x, y, hp, maxHp, label, color) {
  const w = 64;
  const p = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
  ctx.fillStyle = 'rgba(10, 14, 20, 0.85)';
  roundRect(ctx, x - w / 2 - 2, y - 2, w + 4, 12, 6);
  ctx.fill();
  ctx.fillStyle = hpColor(p);
  roundRect(ctx, x - w / 2, y, w * p, 8, 4);
  ctx.fill();
  if (label) {
    ctx.fillStyle = '#dff4ff';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 8);
    ctx.textAlign = 'left';
  }
}

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
