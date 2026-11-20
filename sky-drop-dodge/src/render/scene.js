// src/render/scene.js — 三场景背景（晴午 / 雷雨 / 晚霞）+ 天台 + 风带。
import { WORLD, scene, hexToRgb, rgbCss, clamp } from './theme.js';

const TAU = Math.PI * 2;

function hash2(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// 远景建筑（固定位置/相位，按场景生成）
function skyline(sceneIdx, now) {
  const out = [];
  const base = sceneIdx * 37;
  let x = -20;
  for (let i = 0; x < WORLD.WIDTH + 40; i += 1) {
    const w = 60 + hash2(base, i) * 120;
    const h = 90 + hash2(base + 3, i) * 200;
    const win = hash2(base + 7, i) > 0.4;
    out.push({ x, w, h, win, lit: hash2(base + 11, i) > 0.5 });
    x += w + 14;
  }
  return out;
}

function drawSky(ctx, pal) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.GROUND_Y);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.55, pal.mid);
  g.addColorStop(1, pal.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.GROUND_Y);
}

function drawCelestial(ctx, sceneIdx, now) {
  if (sceneIdx === 1) {
    // 晴午太阳
    ctx.save();
    const g = ctx.createRadialGradient(980, 120, 0, 980, 120, 90);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, 'rgba(255,238,170,0.8)');
    g.addColorStop(1, 'rgba(255,238,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(890, 30, 180, 180);
    ctx.fillStyle = '#fff4cf';
    ctx.beginPath();
    ctx.arc(980, 120, 38, 0, TAU);
    ctx.fill();
    ctx.restore();
  } else if (sceneIdx === 2) {
    // 雷雨：乌云 + 闪电（低频闪烁）
    ctx.save();
    for (let i = 0; i < 6; i += 1) {
      const cx = 120 + i * 220 + Math.sin(now * 0.0002 + i) * 30;
      const cy = 40 + (i % 3) * 34;
      ctx.fillStyle = 'rgba(30,26,50,0.85)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 150, 46, 0, 0, TAU);
      ctx.fill();
    }
    const flash = Math.max(0, Math.sin(now * 0.0009)) > 0.985 ? 0.7 : 0;
    if (flash) {
      ctx.fillStyle = `rgba(210,205,255,${flash})`;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.GROUND_Y);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(420, 0);
      ctx.lineTo(390, 120);
      ctx.lineTo(430, 140);
      ctx.lineTo(400, 260);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // 晚霞：低垂大太阳
    ctx.save();
    const g = ctx.createRadialGradient(640, 470, 0, 640, 470, 200);
    g.addColorStop(0, 'rgba(255,220,150,0.95)');
    g.addColorStop(0.5, 'rgba(255,150,90,0.6)');
    g.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(440, 270, 400, 400);
    ctx.fillStyle = '#ffcf80';
    ctx.beginPath();
    ctx.arc(640, 470, 68, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawSkyline(ctx, sceneIdx, now) {
  const pal = scene(sceneIdx);
  const rows = skyline(sceneIdx, now);
  const y = WORLD.GROUND_Y;
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (const b of rows) {
    ctx.fillStyle = 'rgba(20,24,38,0.5)';
    ctx.fillRect(b.x, y - b.h, b.w, b.h);
    if (b.win) {
      ctx.fillStyle = pal.window;
      for (let wy = y - b.h + 14; wy < y - 20; wy += 26) {
        for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 20) {
          if (b.lit && hash2(wx, wy) > 0.4) ctx.fillRect(wx, wy, 8, 12);
        }
      }
    }
  }
  ctx.restore();
}

function drawRooftop(ctx, pal) {
  const y = WORLD.GROUND_Y;
  // 楼体立面
  const g = ctx.createLinearGradient(0, y, 0, WORLD.HEIGHT);
  g.addColorStop(0, pal.groundTop);
  g.addColorStop(1, pal.ground);
  ctx.fillStyle = g;
  ctx.fillRect(0, y, WORLD.WIDTH, WORLD.HEIGHT - y);

  // 女儿墙（玩家站立的台沿）
  ctx.fillStyle = 'rgba(20,20,30,0.25)';
  ctx.fillRect(0, y - 6, WORLD.WIDTH, 6);

  // 地面风带分区（三列）
  const laneW = WORLD.WIDTH / 3;
  for (let i = 0; i < 3; i += 1) {
    const x0 = i * laneW;
    ctx.fillStyle = i === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)';
    ctx.fillRect(x0, y + 8, laneW, 46);
    if (i !== 1) ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    else ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 1, y + 8, laneW - 2, 46);
  }
}

// 风带箭头（借风走位的可视化）
function drawWindArrows(ctx, laneAt, windKey) {
  const y = WORLD.GROUND_Y + 30;
  const dir = (lane) => (lane.dir === 0 ? 0 : lane.dir);
  for (let i = 0; i < 3; i += 1) {
    const lane = laneAt(i * 427 + 60); // 取每列中点的 lane
    if (!lane || lane.dir === 0) continue;
    const cx = (lane.x0 + lane.x1) / 2;
    const d = lane.dir;
    ctx.save();
    ctx.globalAlpha = windKey === 'tail' || windKey === 'head' ? 0.9 : 0.4;
    ctx.fillStyle = '#ffffff';
    for (let k = -2; k <= 2; k += 1) {
      const ax = cx + k * 46;
      const bob = Math.sin((cx * 0.01 + k) * 1.7) * 3;
      ctx.beginPath();
      ctx.moveTo(ax - d * 14, y - 6 + bob);
      ctx.lineTo(ax + d * 14, y + bob);
      ctx.lineTo(ax + d * 4, y + bob);
      ctx.lineTo(ax + d * 14, y + 8 + bob);
      ctx.lineTo(ax + d * 14, y - 8 + bob);
      ctx.lineTo(ax + d * 4, y + bob);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

// 慢动作涟漪（signature）
export function drawRipple(ctx, x, y, age, sceneIdx) {
  const pal = scene(sceneIdx);
  for (let i = 0; i < 3; i += 1) {
    const r = 20 + age * 320 + i * 26;
    const a = Math.max(0, 0.5 - age * 0.5 - i * 0.12);
    if (a <= 0) continue;
    ctx.strokeStyle = rgbCss(hexToRgb(pal.glow), a);
    ctx.lineWidth = 2 + i;
    ctx.beginPath();
    ctx.arc(x, y - 40, r, 0, TAU);
    ctx.stroke();
  }
}

export function drawScene(ctx, o) {
  const { sceneIdx, now, laneAt, windKey } = o;
  const pal = scene(sceneIdx);
  drawSky(ctx, pal);
  drawCelestial(ctx, sceneIdx, now);
  drawSkyline(ctx, sceneIdx, now);
  drawRooftop(ctx, pal);
  drawWindArrows(ctx, laneAt, windKey);
}
