// 世界物件：数字珊瑚墙 / 海胆 / Boss 分段墙（+裂纹）+ 食物（spark / gold）。
// 所有 worldY → screenY 的换算在 index.js 统一完成，这里只收屏幕坐标。
import { WORLD, FONT, WALL, URCHIN, BOSS, FOOD, clamp, mixHex } from './theme.js';

const TAU = Math.PI * 2;

function hash2(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
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

function wallColor(value, pal) {
  const t = clamp((value - 1) / 59, 0, 1);
  return mixHex(pal.wallLow, pal.wallHigh, t);
}

function drawCoral(ctx, w, sx, sy, pal) {
  const h = Math.max(WALL.minH, w.h || WALL.minH);
  const x = sx - w.w / 2;
  const y = sy - h / 2;
  const color = wallColor(w.value, pal);
  // 光晕
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  roundRect(ctx, x - WALL.halo, y - WALL.halo, w.w + WALL.halo * 2, h + WALL.halo * 2, WALL.radius + WALL.halo);
  ctx.fill();
  ctx.globalAlpha = 1;
  // 主体
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w.w, h, WALL.radius);
  ctx.fill();
  // 顶部高光 / 底部阴影
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(ctx, x + 3, y + 3, w.w - 6, 3, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(ctx, x + 3, y + h - 6, w.w - 6, 3, 2);
  ctx.fill();
  // 数字（等宽 + 描边保证亮暗底都可读）
  const fs = Math.max(WALL.textMin, Math.floor(h * 0.6));
  ctx.font = `bold ${fs}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(3,8,14,0.92)';
  ctx.lineWidth = WALL.outlineWidth;
  ctx.strokeText(String(w.value), sx, sy);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(w.value), sx, sy);
}

function drawUrchin(ctx, sx, sy) {
  const r = URCHIN.r;
  // 红色外圈光（加法）
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 2.1);
  g.addColorStop(0, 'rgba(255,61,90,0.5)');
  g.addColorStop(1, 'rgba(255,61,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, r * 2.1, 0, TAU);
  ctx.fill();
  ctx.restore();
  // 尖刺
  ctx.strokeStyle = '#05050a';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < URCHIN.spikes; i += 1) {
    const a = (i / URCHIN.spikes) * TAU;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(sx + dx * (r - 3), sy + dy * (r - 3));
    ctx.lineTo(sx + dx * (r + URCHIN.spikeLen), sy + dy * (r + URCHIN.spikeLen));
    ctx.stroke();
  }
  // 黑球主体
  ctx.fillStyle = '#0b0b12';
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, TAU);
  ctx.fill();
  // 红色发光核
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,61,90,0.9)';
  ctx.beginPath();
  ctx.arc(sx, sy, r * 0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(sx - r * 0.3, sy - r * 0.3, r * 0.28, 0, TAU);
  ctx.fill();
}

function drawCrack(ctx, seed, x, y, w, h) {
  ctx.beginPath();
  let cx = x + w * (0.25 + hash2(seed, 1) * 0.5);
  let cy = y + 4;
  ctx.moveTo(cx, cy);
  const n = BOSS.crackN;
  for (let i = 0; i < n; i += 1) {
    cx += (hash2(seed, i + 2) - 0.5) * w * 0.34;
    cy += h / n;
    ctx.lineTo(cx, cy);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,120,70,0.35)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function drawBossSegment(ctx, seed, x, y, w, h, now) {
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + seed);
  ctx.fillStyle = '#2a0a08';
  roundRect(ctx, x, y, w, h, WALL.radius);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,61,46,${0.55 + pulse * 0.4})`;
  ctx.lineWidth = 2.5;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, WALL.radius);
  ctx.stroke();
  // 内部熔岩光
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,90,50,0.35)');
  g.addColorStop(1, 'rgba(120,10,8,0.15)');
  ctx.fillStyle = g;
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, WALL.radius - 2);
  ctx.fill();
  ctx.restore();
  drawCrack(ctx, seed, x, y, w, h);
}

function drawBoss(ctx, w, sx, sy, now) {
  const h = Math.max(40, w.h || 40);
  const x = sx - w.w / 2;
  const y = sy - h / 2;
  const segs = WALL.bossSegs;
  const gap = 7;
  const segW = (w.w - gap * (segs - 1)) / segs;
  // 整体红光晕
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
  ctx.globalAlpha = 0.22 + pulse * 0.16;
  ctx.fillStyle = '#ff3d2e';
  roundRect(ctx, x - WALL.halo * 2, y - WALL.halo * 2, w.w + WALL.halo * 4, h + WALL.halo * 4, WALL.radius + WALL.halo * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  for (let s = 0; s < segs; s += 1) {
    drawBossSegment(ctx, (w.id * 31 + s) | 0, x + s * (segW + gap), y, segW, h, now);
  }
}

function drawBossPart(ctx, w, sx, sy, now) {
  const h = Math.max(WALL.minH, w.h || WALL.minH);
  const x = sx - w.w / 2;
  const y = sy - h / 2;
  drawBossSegment(ctx, (w.id * 53) | 0, x, y, w.w, h, now);
}

export function drawWalls(ctx, o) {
  const run = o.run;
  if (!run || !run.walls || !run.walls.length) return;
  const pal = o.pal;
  for (const w of run.walls) {
    const sy = o.rWY + WORLD.HEAD_Y - w.worldY;
    if (sy < -140 || sy > WORLD.HEIGHT + 140) continue;
    const sx = w.x;
    if (w.kind === 'coral') drawCoral(ctx, w, sx, sy, pal);
    else if (w.kind === 'urchin') drawUrchin(ctx, sx, sy);
    else if (w.kind === 'boss') drawBoss(ctx, w, sx, sy, o.now);
    else if (w.kind === 'bossPart') drawBossPart(ctx, w, sx, sy, o.now);
  }
}

export function drawFoods(ctx, o) {
  const run = o.run;
  if (!run || !run.foods || !run.foods.length) return;
  for (const f of run.foods) {
    const sy = o.rWY + WORLD.HEAD_Y - f.worldY;
    if (sy < -40 || sy > WORLD.HEIGHT + 40) continue;
    const spr = f.kind === 'gold' ? o.sprites.orbGold : o.sprites.orbCyan;
    const r = FOOD.glow;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(spr, f.x - r, sy - r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = f.kind === 'gold' ? '#fff3d6' : '#eaffff';
    ctx.beginPath();
    ctx.arc(f.x, sy, FOOD.r * 0.6, 0, TAU);
    ctx.fill();
  }
}
