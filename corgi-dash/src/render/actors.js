// CORGI DASH · 程序化角色/场景/障碍绘制（Canvas2D，无外部素材）
import { WORLD, PLAYER } from '../../config/gameplay.js';

// ---------- 背景：天空 / 远山 / 地面 / 天气装饰（视差随 scrollX 滚动） ----------
export function drawBackground(ctx, theme, scrollX, now, reduceMotion) {
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  const groundY = WORLD.GROUND_Y;

  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, groundY);

  // 太阳 / 云（缓慢视差）
  const sunX = 980 - (scrollX * 0.02) % 1200;
  const sunY = 110;
  ctx.save();
  ctx.globalAlpha = theme.decor === 'storm' ? 0.25 : 0.9;
  const sg = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 90);
  sg.addColorStop(0, 'rgba(255,255,240,0.95)');
  sg.addColorStop(1, 'rgba(255,255,240,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sunX - 100, sunY - 100, 200, 200);
  ctx.restore();

  drawClouds(ctx, theme, scrollX, now);

  // 远山（更慢视差）
  ctx.fillStyle = theme.hillFar;
  const off = (scrollX * 0.05) % 640;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = -off; x <= W + 80; x += 160) {
    ctx.quadraticCurveTo(x + 80, groundY - 150 - Math.sin((x + off) * 0.01) * 40, x + 160, groundY);
  }
  ctx.fill();

  // 近山
  ctx.fillStyle = theme.hillNear;
  const off2 = (scrollX * 0.12) % 800;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = -off2; x <= W + 80; x += 200) {
    ctx.quadraticCurveTo(x + 100, groundY - 90 - Math.sin((x + off2) * 0.02) * 26, x + 200, groundY);
  }
  ctx.fill();

  // 地面
  const gg = ctx.createLinearGradient(0, groundY, 0, H);
  gg.addColorStop(0, theme.ground);
  gg.addColorStop(1, theme.groundDark);
  ctx.fillStyle = gg;
  ctx.fillRect(0, groundY, W, H - groundY);

  // 地面纹理（滚动）
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  const gOff = (scrollX * 1.0) % 48;
  for (let x = -gOff; x <= W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, groundY + 6);
    ctx.lineTo(x - 14, H);
    ctx.stroke();
  }

  // 天气装饰
  if (theme.decorKind === 'mist') drawMist(ctx, theme, scrollX, now, reduceMotion);
  else if (theme.decorKind === 'wheatWave') drawWheat(ctx, theme, scrollX, now);
  else if (theme.decorKind === 'rain') drawRain(ctx, now, reduceMotion);
}

function drawClouds(ctx, theme, scrollX, now) {
  ctx.save();
  ctx.fillStyle = theme.cloud;
  const off = (scrollX * 0.08) % 900;
  for (let i = 0; i < 4; i += 1) {
    const x = ((i * 300 - off) % 1400 + 1400) % 1400 - 100;
    const y = 60 + i * 46 + Math.sin(now * 0.3 + i) * 6;
    ctx.beginPath();
    ctx.ellipse(x, y, 70, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 40, y - 8, 44, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMist(ctx, theme, scrollX, now, reduceMotion) {
  ctx.save();
  ctx.fillStyle = theme.fog;
  const off = (scrollX * 0.2) % 700;
  for (let i = 0; i < 5; i += 1) {
    const x = ((i * 260 - off) % 1500 + 1500) % 1500 - 120;
    const y = WORLD.GROUND_Y - 60 + Math.sin(now * (reduceMotion ? 0 : 0.2) + i * 2) * 14;
    ctx.beginPath();
    ctx.ellipse(x, y, 180, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWheat(ctx, theme, scrollX, now) {
  ctx.save();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 3;
  const off = (scrollX * 1.0) % 40;
  for (let x = -off; x <= WORLD.WIDTH; x += 40) {
    const sway = Math.sin(now * 1.4 + x * 0.05) * 6;
    ctx.beginPath();
    ctx.moveTo(x, WORLD.GROUND_Y);
    ctx.quadraticCurveTo(x + sway, WORLD.GROUND_Y - 34, x + sway * 0.4, WORLD.GROUND_Y - 46);
    ctx.stroke();
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.ellipse(x + sway * 0.4, WORLD.GROUND_Y - 50, 5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRain(ctx, now, reduceMotion) {
  ctx.save();
  ctx.strokeStyle = 'rgba(200,220,240,0.28)';
  ctx.lineWidth = 1.5;
  const speed = reduceMotion ? 0 : 900;
  for (let i = 0; i < 60; i += 1) {
    const x = (i * 97) % WORLD.WIDTH;
    const y = (i * 41 + now * speed) % WORLD.HEIGHT;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 16);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- 柯基（侧视图，跑步循环腿 + 尾巴 + 耳朵） ----------
export function drawCorgi(ctx, x, y, time, airborne, scattered) {
  const groundY = WORLD.GROUND_Y;
  const bodyW = 62;
  const bodyH = 34;
  const bodyY = y + PLAYER.H - bodyH - 4; // 身体底贴碰撞盒底

  ctx.save();
  ctx.translate(x, 0);

  // 阴影（贴地时）
  if (!airborne) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, groundY + 6, 34, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 尾巴（摇摆）
  const wag = Math.sin(time * 8) * 0.4;
  ctx.save();
  ctx.translate(-bodyW / 2 + 2, bodyY + 6);
  ctx.rotate(-0.5 + wag);
  ctx.fillStyle = '#e8873a';
  ctx.beginPath();
  ctx.ellipse(-10, -4, 12, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 腿（跑步循环）
  const phase = airborne ? 0.4 : Math.sin(time * 14) * 0.6;
  ctx.fillStyle = '#e8873a';
  const legW = 9, legH = 20;
  for (let i = 0; i < 4; i += 1) {
    const lx = -bodyW / 2 + 8 + i * 15;
    const swing = i % 2 === 0 ? phase : -phase;
    ctx.save();
    ctx.translate(lx, bodyY + bodyH - 6);
    ctx.rotate(swing * 0.7);
    ctx.fillRect(-legW / 2, -legH + 6, legW, legH);
    ctx.restore();
  }

  // 身体
  const bg = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
  bg.addColorStop(0, '#f2a34c');
  bg.addColorStop(1, '#d97f2e');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(-bodyW / 2, bodyY, bodyW, bodyH, 12);
  ctx.fill();

  // 白色胸腹
  ctx.fillStyle = '#fdf3e0';
  ctx.beginPath();
  ctx.roundRect(-bodyW / 2 + 6, bodyY + 12, bodyW - 14, bodyH - 12, 8);
  ctx.fill();

  // 头
  ctx.fillStyle = '#f2a34c';
  ctx.beginPath();
  ctx.arc(bodyW / 2 - 4, bodyY + 2, 20, 0, Math.PI * 2);
  ctx.fill();
  // 口鼻
  ctx.fillStyle = '#fdf3e0';
  ctx.beginPath();
  ctx.ellipse(bodyW / 2 + 10, bodyY + 8, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(bodyW / 2 + 14, bodyY + 6, 3.2, 0, Math.PI * 2);
  ctx.fill();
  // 眼睛
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(bodyW / 2 + 2, bodyY - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(bodyW / 2 + 3, bodyY - 5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // 耳朵（竖耳）
  ctx.fillStyle = '#e8873a';
  ctx.beginPath();
  ctx.moveTo(bodyW / 2 - 12, bodyY - 10);
  ctx.lineTo(bodyW / 2 - 16, bodyY - 28);
  ctx.lineTo(bodyW / 2 - 2, bodyY - 14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bodyW / 2 - 2, bodyY - 16);
  ctx.lineTo(bodyW / 2 + 2, bodyY - 32);
  ctx.lineTo(bodyW / 2 + 10, bodyY - 10);
  ctx.closePath();
  ctx.fill();

  // 口哨散开时头顶小音符
  if (scattered) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('♪', bodyW / 2 - 8, bodyY - 34);
  }

  ctx.restore();
}

// ---------- 羊（羊群跟随链） ----------
export function drawSheep(ctx, x, y, size, phase) {
  const s = size || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // 身体（蓬松）
  ctx.fillStyle = '#fdf6ea';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.arc(-6, 4, 9, 0, Math.PI * 2);
  ctx.arc(6, 4, 9, 0, Math.PI * 2);
  ctx.fill();
  // 头
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.arc(12, -4, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(14, -6, 2, 0, Math.PI * 2);
  ctx.fill();
  // 腿（轻微摆动）
  const lp = Math.sin(phase) * 0.3;
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-6 + lp, 10, 3, 8);
  ctx.fillRect(4 - lp, 10, 3, 8);
  ctx.restore();
}

// ---------- 障碍 ----------
export function drawObstacle(ctx, o, screenX, theme) {
  ctx.save();
  ctx.translate(screenX, 0);
  const groundY = WORLD.GROUND_Y;
  switch (o.kind) {
    case 'fence': {
      ctx.fillStyle = '#8a5a2c';
      ctx.fillRect(0, o.y, o.w, o.h);
      // 横栏
      ctx.fillStyle = '#a06a34';
      ctx.fillRect(-4, o.y + 8, o.w + 8, 8);
      ctx.fillRect(-4, o.y + o.h - 22, o.w + 8, 8);
      // 尖顶
      ctx.fillStyle = '#7a4e24';
      for (let x = 2; x < o.w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, o.y);
        ctx.lineTo(x + 8, o.y - 8);
        ctx.lineTo(x + 16, o.y);
        ctx.fill();
      }
      break;
    }
    case 'hay': {
      ctx.fillStyle = '#e7c05c';
      ctx.beginPath();
      ctx.arc(o.w / 2, o.y + o.h / 2, Math.min(o.w, o.h) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b98b2e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(o.w * 0.3, o.y + o.h * 0.2);
      ctx.lineTo(o.w * 0.7, o.y + o.h * 0.7);
      ctx.moveTo(o.w * 0.7, o.y + o.h * 0.25);
      ctx.lineTo(o.w * 0.3, o.y + o.h * 0.8);
      ctx.stroke();
      break;
    }
    case 'puddle': {
      ctx.fillStyle = '#5aa7c9';
      ctx.beginPath();
      ctx.ellipse(o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(o.w / 2, o.y + o.h * 0.32, o.w * 0.26, o.h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'pen': {
      ctx.fillStyle = '#9a6a3a';
      ctx.fillRect(0, o.y, o.w, o.h);
      ctx.fillStyle = '#7a4e24';
      ctx.fillRect(0, o.y, o.w, 8);
      ctx.fillRect(0, o.y + o.h - 8, o.w, 8);
      // 竖条
      ctx.fillStyle = '#b0804a';
      for (let x = 2; x < o.w; x += 14) ctx.fillRect(x, o.y + 8, 5, o.h - 16);
      break;
    }
    case 'bridge': {
      ctx.fillStyle = '#6e5a4a';
      ctx.fillRect(0, o.y, o.w, o.h);
      ctx.fillStyle = '#8a7560';
      ctx.fillRect(0, o.y + o.h - 14, o.w, 14);
      // 桥墩
      ctx.fillStyle = '#5a4a3c';
      ctx.fillRect(6, o.y + o.h - 14, 16, groundY - (o.y + o.h - 14));
      ctx.fillRect(o.w - 22, o.y + o.h - 14, 16, groundY - (o.y + o.h - 14));
      break;
    }
    default: {
      ctx.fillStyle = theme.accent;
      ctx.fillRect(0, o.y, o.w, o.h);
    }
  }
  ctx.restore();
}
