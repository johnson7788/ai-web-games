// src/render/scene.js — MARRY RICH · 三场景包程序化背景（换章必换：色板 + 构图 + 装饰）。
// 小镇（暖橙）→ 都市（青蓝霓虹）→ 巅峰（金紫）。全部 Canvas 程序化，零外部素材。
import { WORLD } from '../../config/gameplay.js';

// 每场景的色板（一眼可分）
export const THEMES = {
  town: {
    skyTop: '#2a1f3d', skyBottom: '#ff9a5a',
    ground: '#5a3a52', silhouette: '#3a2740',
    accent: '#ffcf8a', accent2: '#ff8a5c',
  },
  city: {
    skyTop: '#04122b', skyBottom: '#0d4a6b',
    ground: '#061c33', silhouette: '#0a2a4a',
    accent: '#54e7ff', accent2: '#2aa9c4',
  },
  peak: {
    skyTop: '#17082e', skyBottom: '#5b2a86',
    ground: '#24104a', silhouette: '#33145c',
    accent: '#ffd76a', accent2: '#c084fc',
  },
};

function lerpColor(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16);
  const b = parseInt(c2.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

function sky(ctx, theme, time) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, theme.skyTop);
  g.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 天空粒子（星星 / 光点，确定性）
  const n = 46;
  for (let i = 0; i < n; i += 1) {
    const x = (i * 173) % WORLD.WIDTH;
    const y = (i * 97) % (WORLD.HEIGHT * 0.6);
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.8 + i));
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.12 + 0.3 * tw;
    const r = 1 + (i % 3);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTown(ctx, theme, time) {
  sky(ctx, theme, time);
  // 远山
  ctx.fillStyle = theme.silhouette;
  ctx.beginPath();
  ctx.moveTo(0, 520);
  for (let x = 0; x <= WORLD.WIDTH; x += 80) {
    ctx.lineTo(x, 430 + Math.sin(x * 0.02) * 40);
  }
  ctx.lineTo(WORLD.WIDTH, 720);
  ctx.lineTo(0, 720);
  ctx.closePath();
  ctx.fill();
  // 小镇低层房屋
  ctx.fillStyle = theme.ground;
  for (let i = 0; i < 8; i += 1) {
    const x = 60 + i * 160;
    const h = 120 + (i % 3) * 40;
    ctx.fillRect(x, 720 - h, 130, h);
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.5;
    for (let wy = 720 - h + 16; wy < 700; wy += 44) {
      for (let wx = x + 14; wx < x + 116; wx += 34) {
        ctx.fillRect(wx, wy, 16, 20);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.ground;
  }
  // 温暖太阳
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(1050, 150, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCity(ctx, theme, time) {
  sky(ctx, theme, time);
  // 摩天楼剪影
  for (let i = 0; i < 14; i += 1) {
    const x = i * 96 - 20;
    const h = 260 + ((i * 137) % 5) * 60;
    ctx.fillStyle = theme.silhouette;
    ctx.fillRect(x, 720 - h, 78, h);
    // 窗灯（确定性闪烁）
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.6;
    for (let wy = 720 - h + 18; wy < 700; wy += 34) {
      for (let wx = x + 10; wx < x + 68; wx += 22) {
        const on = Math.sin(time * 1.5 + wx * 0.13 + wy * 0.07) > 0;
        if (on) ctx.fillRect(wx, wy, 10, 14);
      }
    }
    ctx.globalAlpha = 1;
  }
  // 地面反光
  const g = ctx.createLinearGradient(0, 640, 0, 720);
  g.addColorStop(0, 'rgba(84,231,255,0.0)');
  g.addColorStop(1, 'rgba(84,231,255,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 640, WORLD.WIDTH, 80);
}

function drawPeak(ctx, theme, time) {
  sky(ctx, theme, time);
  // 阶梯 / 颁奖台（逆袭登顶意象）
  for (let i = 0; i < 4; i += 1) {
    const w = 380 - i * 60;
    const x = WORLD.WIDTH / 2 - w / 2;
    const y = 720 - (80 + i * 110);
    ctx.fillStyle = theme.silhouette;
    ctx.fillRect(x, y, w, 90);
  }
  // 皇冠剪影
  ctx.fillStyle = theme.accent;
  const cx = WORLD.WIDTH / 2;
  const cy = 150;
  ctx.beginPath();
  ctx.moveTo(cx - 60, cy + 60);
  ctx.lineTo(cx - 60, cy - 10);
  ctx.lineTo(cx - 30, cy + 18);
  ctx.lineTo(cx, cy - 34);
  ctx.lineTo(cx + 30, cy + 18);
  ctx.lineTo(cx + 60, cy - 10);
  ctx.lineTo(cx + 60, cy + 60);
  ctx.closePath();
  ctx.fill();
  // 金色光点飘落（确定性）
  ctx.fillStyle = theme.accent;
  for (let i = 0; i < 40; i += 1) {
    const x = (i * 211 + Math.sin(time * 0.6 + i) * 40 + WORLD.WIDTH) % WORLD.WIDTH;
    const y = ((time * (30 + (i % 5) * 8) + i * 137) % 720);
    ctx.globalAlpha = 0.3 + 0.3 * Math.sin(time + i);
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// 主角剪影（小镇姑娘）：左侧常驻、放大加亮，让「玩家」眯眼即可辨（剪影评审关键）。
function drawHero(ctx, theme, time) {
  const x = 168;
  const baseY = 612;
  const bob = Math.sin(time * 1.6) * 3;

  // 强光晕（她必须是画面最亮的元素）
  const g = ctx.createRadialGradient(x, baseY - 170, 20, x, baseY - 170, 220);
  g.addColorStop(0, 'rgba(255,240,200,0.42)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 220, baseY - 390, 440, 440);

  const skin = '#fff3d9';
  const dress = '#ffd76a';

  // 头部（大、亮）
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, baseY - 262 + bob, 46, 0, Math.PI * 2);
  ctx.fill();

  // 头发（亮棕，仍比背景亮）
  ctx.fillStyle = '#6b3f57';
  ctx.beginPath();
  ctx.arc(x, baseY - 268 + bob, 45, Math.PI * 0.92, Math.PI * 1.92);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 26, baseY - 282 + bob);
  ctx.quadraticCurveTo(x + 84, baseY - 322 + bob, x + 106, baseY - 268 + bob);
  ctx.lineTo(x + 40, baseY - 246 + bob);
  ctx.closePath();
  ctx.fill();

  // 身体（连衣裙，最粗主体）
  ctx.fillStyle = dress;
  ctx.beginPath();
  ctx.moveTo(x - 60, baseY - 212 + bob);
  ctx.lineTo(x + 60, baseY - 212 + bob);
  ctx.lineTo(x + 100, baseY);
  ctx.lineTo(x - 100, baseY);
  ctx.closePath();
  ctx.fill();

  // 手臂（向前伸，做「抉择」姿态，用亮色）
  ctx.strokeStyle = skin;
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 48, baseY - 190 + bob);
  ctx.lineTo(x + 96, baseY - 130 + bob);
  ctx.stroke();

  // 地面光带
  ctx.fillStyle = 'rgba(255,240,200,0.3)';
  ctx.fillRect(x - 108, baseY + 6, 216, 8);
}

export function drawScene(ctx, scene, time) {
  const theme = THEMES[scene] || THEMES.town;
  if (scene === 'city') drawCity(ctx, theme, time);
  else if (scene === 'peak') drawPeak(ctx, theme, time);
  else drawTown(ctx, theme, time);
  drawHero(ctx, theme, time);
}

export { lerpColor };
