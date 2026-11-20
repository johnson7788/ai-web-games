// src/render/theme.js — 三场景包（丝路晨/绿洲午/星夜）：色板 + 构图 + 装饰。
// 换段即换包（换色板+换构图+换装饰），一眼可分。全部程序化 Canvas。
export const THEMES = {
  dawn: {
    name: 'dawn',
    skyTop: '#f7dda8',
    skyBottom: '#edb061',
    sun: '#fff3c9',
    far: '#e7bd78',
    mid: '#d7a05a',
    groundTop: '#c98d4e',
    groundFill: '#b3773d',
    groundLine: '#8a5a2c',
    dust: '#e7c08a',
    accent: '#f5c96a',
  },
  oasis: {
    name: 'oasis',
    skyTop: '#c2ecd2',
    skyBottom: '#74cfa0',
    sun: '#f0fff0',
    far: '#a9d9a2',
    mid: '#86c081',
    groundTop: '#7fb069',
    groundFill: '#5f9452',
    groundLine: '#45713d',
    dust: '#c9e3b8',
    accent: '#e2f3d0',
  },
  night: {
    name: 'night',
    skyTop: '#1c1c3e',
    skyBottom: '#46307a',
    sun: '#f5f0d8',
    far: '#33336a',
    mid: '#4a3f86',
    groundTop: '#5c4a8a',
    groundFill: '#40356a',
    groundLine: '#2c2450',
    dust: '#8a80c0',
    accent: '#c7b8ff',
  },
};

export function themeFor(scene) {
  return THEMES[scene] || THEMES.dawn;
}

export function sceneDeco(ctx, scene, t, W, H) {
  // 场景专属装饰（构图区分）：dawn 高空飞鸟 / oasis 水泽光带 / night 星与新月
  if (scene === 'dawn') {
    drawBirds(ctx, W, H, t);
  } else if (scene === 'oasis') {
    drawOasisWater(ctx, W, H, t);
  } else if (scene === 'night') {
    drawStars(ctx, W, H, t);
    // 新月
    ctx.save();
    ctx.fillStyle = '#f5f0d8';
    ctx.beginPath();
    ctx.arc(W * 0.8, H * 0.2, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2650';
    ctx.beginPath();
    ctx.arc(W * 0.8 + 10, H * 0.2 - 6, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBirds(ctx, W, H, t) {
  // 高空飞鸟（明显非交互装饰，避免被误认为目标/收集物）
  ctx.save();
  ctx.strokeStyle = 'rgba(90,52,24,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    const x = ((i * 260 + t * 18) % (W + 80)) - 40;
    const y = H * 0.16 + (i % 2) * 26 + Math.sin(t * 0.7 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.quadraticCurveTo(x, y - 5, x + 7, y);
    ctx.quadraticCurveTo(x, y + 3, x - 7, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOasisWater(ctx, W, H, t) {
  // 远景水泽光带（明显非交互，不会与陶罐/障碍混淆）
  ctx.save();
  const gy = H * 0.62;
  ctx.fillStyle = 'rgba(150,230,220,0.35)';
  ctx.fillRect(0, gy, W, 22);
  ctx.fillStyle = 'rgba(220,255,245,0.5)';
  for (let i = 0; i < 12; i += 1) {
    const x = (i * 137 + t * 12) % W;
    ctx.fillRect(x, gy + 6, 26, 2);
  }
  ctx.restore();
}

function drawStars(ctx, W, H, t) {
  ctx.save();
  for (let i = 0; i < 40; i += 1) {
    const x = (i * 173) % W;
    const y = (i * 97) % (H * 0.5);
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + i));
    ctx.fillStyle = `rgba(255,255,240,${(0.3 + 0.5 * tw).toFixed(2)})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}
