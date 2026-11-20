// EGG BOOM · 背景 + 台面 + 场景装饰（程序化 Canvas，三套场景包）
import { WORLD } from '../../config/gameplay.js';
import { themeOf } from './theme.js';

export function drawScene(ctx, scene, time) {
  const th = themeOf(scene);
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;

  // 天空/墙面渐变
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.skyTop);
  g.addColorStop(1, th.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 台面
  ctx.fillStyle = th.counter;
  ctx.fillRect(0, 668, W, H - 668);
  ctx.fillStyle = th.counterEdge;
  ctx.fillRect(0, 668, W, 10);

  // 台面木纹 / 缝
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let y = 690; y < H; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // 场景装饰（按 scene 分支，构图不同）
  if (scene === 'kitchen') drawKitchen(ctx, th, time);
  else if (scene === 'dessert') drawDessert(ctx, th, time);
  else drawCanteen(ctx, th, time);

  // 顶部柔光
  const lg = ctx.createLinearGradient(0, 0, 0, 140);
  lg.addColorStop(0, 'rgba(255,255,255,0.28)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, 140);
}

function drawKitchen(ctx, th, time) {
  // 早晨厨房：圆太阳 + 挂着的瓶瓶罐罐 + 砧板（避免方框误读为 UI 槽位）
  const W = WORLD.WIDTH;
  ctx.save();
  // 太阳（左上，柔和圆形）
  ctx.fillStyle = 'rgba(255, 214, 120, 0.55)';
  ctx.beginPath();
  ctx.arc(130, 120, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 236, 170, 0.5)';
  ctx.beginPath();
  ctx.arc(130, 120, 84, 0, Math.PI * 2);
  ctx.fill();

  // 挂架上一排圆罐（右上，圆润装饰）
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  roundRect(ctx, 800, 44, 420, 12, 6);
  ctx.fill();
  const jarColors = ['#e8b06a', '#d98a3a', '#b9743c', '#e8b06a', '#c87f3a'];
  for (let i = 0; i < 5; i += 1) {
    const x = 860 + i * 76;
    ctx.fillStyle = jarColors[i];
    ctx.beginPath();
    ctx.arc(x, 84, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(x - 6, 78, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // 砧板（台面上，近景）
  ctx.fillStyle = '#c99b6b';
  roundRect(ctx, 480, 682, 260, 40, 10);
  ctx.fill();
  ctx.restore();
}

function drawDessert(ctx, th, time) {
  // 甜品站：蛋糕台 + 甜甜圈 + 糖霜波纹
  const W = WORLD.WIDTH;
  ctx.save();
  // 蛋糕台
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  roundRect(ctx, 620, 518, 300, 150, 20);
  ctx.fill();
  ctx.fillStyle = th.accent;
  roundRect(ctx, 640, 548, 120, 120, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  roundRect(ctx, 655, 563, 90, 90, 8);
  ctx.fill();

  // 甜甜圈（左上）
  for (let i = 0; i < 3; i += 1) {
    const x = 140 + i * 130;
    const y = 150 + Math.sin(time * 0.6 + i) * 6;
    ctx.fillStyle = i === 1 ? th.accent : '#ffd9a8';
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = th.skyTop;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // 糖霜波纹
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 6;
  for (let x = 0; x < W; x += 120) {
    ctx.beginPath();
    ctx.arc(x, 680, 60, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCanteen(ctx, th, time) {
  // 午夜食堂：霓虹灯管 + 蒸笼热气 + 挂灯
  const W = WORLD.WIDTH;
  ctx.save();
  // 霓虹灯管
  ctx.strokeStyle = th.accent;
  ctx.lineWidth = 5;
  ctx.shadowColor = th.accent;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(40, 90); ctx.lineTo(300, 90);
  ctx.moveTo(360, 130); ctx.lineTo(520, 130);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 蒸笼
  for (let i = 0; i < 4; i += 1) {
    const x = 700 + i * 130;
    const y = 688;
    ctx.fillStyle = '#3a4a78';
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.fill();
    // 热气
    const t = (time * 0.8 + i * 0.5) % 1;
    ctx.fillStyle = 'rgba(200,210,255,0.25)';
    for (let k = 0; k < 3; k += 1) {
      const yy = y - 40 - t * 90 - k * 26;
      ctx.beginPath();
      ctx.arc(x + Math.sin(t * 6 + k) * 14, yy, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 挂灯
  for (let i = 0; i < 3; i += 1) {
    const x = 120 + i * 460;
    ctx.strokeStyle = '#1a2238';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, 60);
    ctx.stroke();
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath();
    ctx.arc(x, 72, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
