// src/render/donkey.js — 主角小驴 + 背上陶罐（程序化绘制）。
// 脚掌在 (x, y)；jars 叠在背上，撞一次少一罐（血量可视化）。
export function drawDonkey(ctx, opts) {
  const {
    x, y, jars = 3, jarMax = 6, t = 0, invuln = false, dropAir = false,
  } = opts;

  // 无敌窗口闪烁（每 90ms 切换半透明）
  if (invuln && Math.floor(t * 1000 / 90) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }

  const run = Math.sin(t * 14);        // 跑步循环
  const bodyW = 78;
  const bodyH = 40;

  ctx.save();
  ctx.translate(x, y);

  // 卸货跳金光
  if (dropAir) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,214,110,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -30, 46, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 腿（跑步摆动）
  ctx.fillStyle = '#6f5236';
  ctx.strokeStyle = '#3a2a18';
  ctx.lineWidth = 2;
  const legLen = 30;
  for (let i = 0; i < 4; i += 1) {
    const lx = -30 + i * 22;
    const phase = i % 2 === 0 ? run : -run;
    ctx.save();
    ctx.translate(lx, -legLen);
    ctx.rotate(phase * 0.6);
    ctx.fillRect(-5, 0, 10, legLen);
    ctx.strokeRect(-5, 0, 10, legLen);
    ctx.restore();
  }

  // 尾巴
  ctx.strokeStyle = '#5a4028';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-bodyW / 2 - 4, -bodyH * 0.6);
  ctx.quadraticCurveTo(-bodyW / 2 - 18, -bodyH * 0.9 + Math.sin(t * 6) * 5, -bodyW / 2 - 12, -bodyH * 1.1);
  ctx.stroke();

  // 身体
  ctx.fillStyle = '#8a6a4a';
  ctx.strokeStyle = '#3a2a18';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -legLen - bodyH / 2, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 鬃毛
  ctx.fillStyle = '#5a4028';
  ctx.beginPath();
  ctx.moveTo(0, -legLen - bodyH);
  for (let i = 0; i <= 6; i += 1) {
    ctx.lineTo(-14 + i * 5, -legLen - bodyH - 8 - (i % 2) * 6);
  }
  ctx.lineTo(20, -legLen - bodyH);
  ctx.closePath();
  ctx.fill();

  // 脖子 + 头
  ctx.fillStyle = '#8a6a4a';
  ctx.strokeStyle = '#3a2a18';
  ctx.beginPath();
  ctx.moveTo(bodyW / 2 - 8, -legLen - bodyH * 0.8);
  ctx.lineTo(bodyW / 2 + 22, -legLen - bodyH - 26);
  ctx.lineTo(bodyW / 2 + 40, -legLen - bodyH - 20);
  ctx.lineTo(bodyW / 2 + 8, -legLen - bodyH * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 头 + 长耳
  ctx.beginPath();
  ctx.ellipse(bodyW / 2 + 30, -legLen - bodyH - 34, 20, 16, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5a4028';
  ctx.beginPath();
  ctx.ellipse(bodyW / 2 + 22, -legLen - bodyH - 56, 7, 20, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(bodyW / 2 + 40, -legLen - bodyH - 58, 7, 20, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 眼睛
  ctx.fillStyle = '#1a1208';
  ctx.beginPath();
  ctx.arc(bodyW / 2 + 34, -legLen - bodyH - 36, 3, 0, Math.PI * 2);
  ctx.fill();

  // 背上陶罐（血量可视化：一罐一格）
  ctx.fillStyle = '#c96f3f';
  ctx.strokeStyle = '#7a3a1c';
  ctx.lineWidth = 2;
  const jarW = 16;
  const jarH = 18;
  const startX = -(Math.min(jars, jarMax) - 1) * (jarW * 0.5);
  for (let i = 0; i < jars; i += 1) {
    const jx = startX + i * jarW * 0.5 - jarW / 2;
    const jy = -legLen - bodyH - 8;
    ctx.beginPath();
    ctx.moveTo(jx + jarW * 0.15, jy);
    ctx.lineTo(jx + jarW * 0.85, jy);
    ctx.lineTo(jx + jarW * 0.7, jy + jarH);
    ctx.lineTo(jx + jarW * 0.3, jy + jarH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 罐口高光
    ctx.fillStyle = '#e8a46a';
    ctx.fillRect(jx + jarW * 0.25, jy - 2, jarW * 0.5, 3);
    ctx.fillStyle = '#c96f3f';
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}
