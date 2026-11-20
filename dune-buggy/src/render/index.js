// DUNE BUGGY · 伪 3D 渲染（行扫描地平线起伏，参考 redline-racer/rally 手法）
// 只画不碰 sim 状态；输入 run（含 segments/position/playerX/speed/airborne）与 hud。
import { WORLD } from '../../config/game.config.js';
import { STAGE } from '../../config/gameplay.js';
import { stageAt } from '../../config/levels.js';
import { segmentAt } from '../game/track.js';
import { themeFor } from './theme.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const SEG_LEN = STAGE.SEG_LEN;
const ROAD_HALF = 1.0;      // 半宽（m），playerX ±1 对应左右边缘
const FOCAL = 660;          // 透视焦距（px）
const DRAW = 190;           // 最多绘制段数
const CAM_H = 1.42;         // 相机高度（m）

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

const particles = [];

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');

  function draw(run, alpha) {
    ctx.clearRect(0, 0, W, H);
    if (!run) {
      drawBackdrop(ctx, themeFor(0), 0, 0, 0, 0);
      return;
    }
    const hud = run.getHud();
    drawScene(ctx, run, hud, alpha);
  }

  function burst(x, y, kind) {
    const n = kind === 'jump' ? 18 : kind === 'land' ? 22 : 8;
    for (let i = 0; i < n; i += 1) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 260,
        vy: (Math.random() - 0.5) * 200 - 40,
        life: 0.4 + Math.random() * 0.5,
        max: 0.9,
        r: 2 + Math.random() * 3,
        color: kind === 'jump' ? '#ffe08a' : kind === 'land' ? '#e8b877' : '#f2cf96',
      });
    }
    if (particles.length > 220) particles.splice(0, particles.length - 220);
  }

  return { draw, burst, get particles() { return particles; } };
}

// ---------------- 场景 ----------------

function drawScene(ctx, run, hud, alpha) {
  const theme = themeFor(hud.scenePack);
  const storm = Number(hud.storm) || 0;
  const airborne = !!hud.airborne;

  // 签名瞬间：飞跃沙丘顶时相机拉升、俯瞰落点
  const lift = airborne ? 1 : 0;
  const camH = CAM_H + lift * 0.75;
  const horizon = WORLD.HORIZON + lift * 48;

  const offset = (run.position % SEG_LEN) / SEG_LEN;
  const base = Math.floor(run.position / SEG_LEN);
  const len = run.segments.length;

  // 天空 / 太阳
  drawSky(ctx, theme, horizon, storm);
  drawSun(ctx, theme, horizon, storm);
  drawFarDunes(ctx, theme, horizon, run.position, storm);

  // 地面基底（远雾 → 近沙）
  const g = ctx.createLinearGradient(0, horizon - 8, 0, H);
  g.addColorStop(0, theme.groundFar);
  g.addColorStop(1, theme.groundNear);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon - 8, W, H - horizon + 8);

  // 预计算各段横向累计（弯道）
  const roadX = new Float32Array(DRAW);
  let acc = 0;
  for (let n = 0; n < DRAW; n += 1) {
    roadX[n] = acc;
    const seg = run.segments[(base + n) % len];
    acc += seg.curve * SEG_LEN;
  }

  const maxDraw = Math.max(24, Math.floor(DRAW * (1 - storm * 0.68)));
  const carShift = run.playerX * ROAD_HALF;

  // 远 → 近绘制路段
  for (let n = maxDraw - 1; n >= 0; n -= 1) {
    const seg = run.segments[(base + n) % len];
    const zFar = SEG_LEN * (n + 1 - offset);
    if (zFar <= 0.6) continue;
    const zNear = Math.max(0.45, zFar - SEG_LEN);
    const cx = roadX[n] - carShift;
    drawSegment(ctx, theme, seg, n, zFar, zNear, cx, run, camH, horizon, storm, alpha);
  }

  drawGoal(ctx, theme, run, camH, horizon, storm, alpha);

  drawDecor(ctx, theme, run, base, len, offset, camH, horizon, storm, alpha);

  // 粒子（沙尘 / 飞跃）
  updateAndDrawParticles(ctx, run, hud, alpha);

  // 沙暴雾层
  if (storm > 0) drawStorm(ctx, theme, horizon, storm);

  // 车身
  drawBuggy(ctx, run, hud, alpha, theme);
}

function drawSky(ctx, theme, horizon, storm) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon + 20);
  g.addColorStop(0, theme.skyTop);
  g.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon + 20);
}

function drawSun(ctx, theme, horizon, storm) {
  const [sx, sy] = theme.sunPos;
  const r = 46;
  const gr = ctx.createRadialGradient(sx, sy, 4, sx, sy, r * 2.4);
  gr.addColorStop(0, theme.sun);
  gr.addColorStop(0.35, theme.sun);
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 1 - storm * 0.5;
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(sx, sy, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawFarDunes(ctx, theme, horizon, pos, storm) {
  const roll = pos * 0.004;
  ctx.fillStyle = theme.farDune;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= W; x += 16) {
    const t = (x / W) * Math.PI * 2 + roll;
    const y = horizon - 4 - Math.sin(t * 1.3) * 26 - Math.sin(t * 2.7 + 1) * 14;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, horizon + 40);
  ctx.lineTo(0, horizon + 40);
  ctx.closePath();
  ctx.fill();

  // 第二层更淡
  ctx.fillStyle = theme.farDune2;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 6);
  for (let x = 0; x <= W; x += 20) {
    const t = (x / W) * Math.PI * 2 - roll * 1.4;
    const y = horizon + 6 - Math.sin(t * 1.9) * 16 - Math.sin(t * 3.3 + 2) * 9;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, horizon + 40);
  ctx.lineTo(0, horizon + 40);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------------- 单路段 ----------------

function fogFactor(z, maxDraw) {
  return clamp(1 - z / (maxDraw * SEG_LEN), 0, 1);
}

function projectY(z, camH, segY, horizon) {
  return horizon + ((camH - segY) * FOCAL) / z;
}
function scaleAt(z) { return FOCAL / z; }

function terrainColor(theme, seg) {
  switch (seg.terrain) {
    case 'rock': return theme.rock;
    case 'oasis': return theme.oasis;
    case 'jump': return '#f0d99a';
    default: return theme.road;
  }
}

function drawSegment(ctx, theme, seg, n, zFar, zNear, cx, run, camH, horizon, storm, alpha) {
  const fog = fogFactor(zFar, DRAW);
  const yFar = projectY(zFar, camH, seg.y, horizon);
  const yNear = projectY(zNear, camH, seg.y, horizon);
  const sFar = scaleAt(zFar);
  const sNear = scaleAt(zNear);

  const cxFar = W / 2 + cx * sFar;
  const cxNear = W / 2 + cx * sNear;
  const hwFar = ROAD_HALF * sFar;
  const hwNear = ROAD_HALF * sNear;

  // 路面（按段奇偶交替明暗，制造速度感）
  const shade = (n % 2 === 0) ? 1 : 0.92;
  ctx.fillStyle = shadeColor(terrainColor(theme, seg), shade, fog, theme);
  ctx.beginPath();
  ctx.moveTo(cxFar - hwFar, yFar);
  ctx.lineTo(cxFar + hwFar, yFar);
  ctx.lineTo(cxNear + hwNear, yNear);
  ctx.lineTo(cxNear - hwNear, yNear);
  ctx.closePath();
  ctx.fill();

  // 路肩边线
  ctx.strokeStyle = rgbaMix(theme.roadEdge, 0.5 + (1 - fog) * 0.5);
  ctx.lineWidth = Math.max(0.5, 1.6 * sNear);
  ctx.beginPath();
  ctx.moveTo(cxFar - hwFar, yFar); ctx.lineTo(cxNear - hwNear, yNear);
  ctx.moveTo(cxFar + hwFar, yFar); ctx.lineTo(cxNear + hwNear, yNear);
  ctx.stroke();

  // 金色沙脊（中心线，骑脊加速）
  if (seg.ridge) {
    const rhwFar = 0.3 * sFar;
    const rhwNear = 0.3 * sNear;
    ctx.fillStyle = theme.ridge;
    ctx.globalAlpha = 0.55 + (1 - fog) * 0.45;
    ctx.beginPath();
    ctx.moveTo(cxFar - rhwFar, yFar);
    ctx.lineTo(cxFar + rhwFar, yFar);
    ctx.lineTo(cxNear + rhwNear, yNear);
    ctx.lineTo(cxNear - rhwNear, yNear);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 岩区 / 绿洲 / 跳台细节
  if (seg.terrain === 'rock' && n % 3 === 0 && sNear > 1) {
    drawRocks(ctx, cxNear, yNear, sNear, theme, fog);
  } else if (seg.terrain === 'oasis' && n % 5 === 0 && sNear > 1) {
    drawPalm(ctx, cxNear - hwNear * 0.4, yNear, sNear, fog);
  } else if (seg.terrain === 'jump' && sNear > 1.4) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(cxNear - hwNear, yNear - sNear * 0.12, hwNear * 2, sNear * 0.12);
  }
}

function shadeColor(color, shade, fog, theme) {
  return darken(color, shade);
}

function darken(hex, factor) {
  const c = hexToRgb(hex);
  const r = Math.round(c[0] * factor);
  const g = Math.round(c[1] * factor);
  const b = Math.round(c[2] * factor);
  return `rgb(${r},${g},${b})`;
}

function rgbaMix(hex, a) {
  const c = hexToRgb(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function drawRocks(ctx, cx, y, s, theme, fog) {
  ctx.fillStyle = rgbaMix(theme.rock, 0.8);
  ctx.beginPath();
  ctx.arc(cx, y - s * 0.02, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function drawPalm(ctx, cx, y, s, fog) {
  ctx.strokeStyle = '#5d7a4e';
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx, y - s * 0.5);
  ctx.stroke();
  ctx.fillStyle = '#6f9f5f';
  ctx.beginPath();
  ctx.arc(cx, y - s * 0.5, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- 目标标记（检查点门 / 终点横幅） ----------------

function curveXAt(run, ahead) {
  const base = Math.floor(run.position / SEG_LEN);
  const end = Math.floor((run.position + ahead) / SEG_LEN);
  let acc = 0;
  for (let i = base; i < end; i += 1) {
    acc += run.segments[i % run.segments.length].curve * SEG_LEN;
  }
  return acc;
}

function drawGoal(ctx, theme, run, camH, horizon, storm, alpha) {
  const stage = stageAt(run.stage);
  const carShift = run.playerX * ROAD_HALF;
  const maxAhead = DRAW * SEG_LEN * 0.96;

  // 下一个检查点（金色拱门）
  const cp = run.checkpoints[run.nextCheckpoint];
  if (cp != null) {
    const ahead = cp - run.position;
    if (ahead > 1.2 && ahead < maxAhead) {
      const seg = segmentAt(run.segments, run.position + ahead);
      const z = ahead;
      const y = projectY(z, camH, seg.y, horizon);
      const s = scaleAt(z);
      const cx = W / 2 + (curveXAt(run, ahead) - carShift) * s;
      drawGate(ctx, theme, cx, y, s, 'checkpoint', storm);
    }
  }

  // 终点横幅（更醒目，永远作为终极目标）
  const finishAhead = stage.length - run.position;
  if (finishAhead > 1.2 && finishAhead < maxAhead) {
    const seg = segmentAt(run.segments, stage.length);
    const z = finishAhead;
    const y = projectY(z, camH, seg.y, horizon);
    const s = scaleAt(z);
    const cx = W / 2 + (curveXAt(run, finishAhead) - carShift) * s;
    drawGate(ctx, theme, cx, y, s, 'finish', storm);
  }
}

function drawGate(ctx, theme, cx, y, s, kind, storm) {
  const hw = ROAD_HALF * s * 1.18;
  const postW = Math.max(2, s * 0.22);
  const top = y - s * 3.6;
  ctx.globalAlpha = 1 - storm * 0.3;

  // 立柱
  ctx.fillStyle = kind === 'finish' ? '#f4ead8' : '#ffd45e';
  ctx.fillRect(cx - hw - postW / 2, top, postW, y - top);
  ctx.fillRect(cx + hw - postW / 2, top, postW, y - top);

  if (kind === 'finish') {
    // 黑白格终点横幅
    const bannerH = Math.max(2, s * 0.9);
    const cells = 6;
    const cw = (hw * 2) / cells;
    for (let i = 0; i < cells; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#1c1410';
      ctx.fillRect(cx - hw + i * cw, top, cw + 0.5, bannerH);
    }
    ctx.fillStyle = '#ff5d4d';
    ctx.font = `bold ${Math.max(8, Math.round(s * 0.7))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', cx, top - s * 0.4);
  } else {
    // 金色检查点拱顶 + 三角旗
    ctx.fillStyle = '#ffd45e';
    ctx.fillRect(cx - hw - postW, top, hw * 2 + postW * 2, Math.max(2, s * 0.32));
    ctx.beginPath();
    ctx.moveTo(cx, top - s * 1.4);
    ctx.lineTo(cx - s * 0.7, top);
    ctx.lineTo(cx + s * 0.7, top);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------- 路边装饰 ----------------

function drawDecor(ctx, theme, run, base, len, offset, camH, horizon, storm, alpha) {
  const start = Math.floor(run.position / SEG_LEN);
  for (let n = 4; n < 60; n += 1) {
    const idx = start + n;
    if (idx % 26 !== 0) continue;
    const seg = run.segments[idx % len];
    const zFar = SEG_LEN * (n + 1 - offset);
    if (zFar <= 1.2) continue;
    const yFar = projectY(zFar, camH, seg.y, horizon);
    if (yFar > H + 40) continue;
    const s = scaleAt(zFar);
    const side = (idx % 52 === 0) ? -1 : 1;
    const x = W / 2 + (side * ROAD_HALF * 1.9) * s;
    const fog = fogFactor(zFar, DRAW);
    const color = theme.decor[idx % 3];
    ctx.fillStyle = rgbaMix(color, 0.85 - fog * 0.6);
    // 沙漠灌木/岩柱/枯枝，按场景包换形状
    if (theme.id === 'morning') {
      ctx.fillRect(x - s * 0.04, yFar - s * 0.55, s * 0.08, s * 0.55); // 岩柱
    } else if (theme.id === 'noon') {
      ctx.beginPath(); ctx.arc(x, yFar - s * 0.12, s * 0.12, 0, Math.PI * 2); ctx.fill(); // 石头
    } else {
      ctx.fillRect(x - s * 0.03, yFar - s * 0.7, s * 0.06, s * 0.7); // 高柱影
    }
  }
}

// ---------------- 车身 ----------------

function drawBuggy(ctx, run, hud, alpha, theme) {
  const cx = W / 2;
  const lean = clamp(hud.playerX * 0.14 + run.speed * 0.0006, -0.22, 0.22);
  const bob = hud.airborne ? -26 : Math.sin(run.position * 0.9) * 2.2;
  const cy = H - 96 + bob;
  const scale = hud.airborne ? 0.86 : 1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(lean * 0.5);
  ctx.scale(scale, scale);

  // 影子
  ctx.fillStyle = 'rgba(40,20,10,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 44, 46, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 车轮
  ctx.fillStyle = '#1c1410';
  roundRect(ctx, -40, 16, 18, 30, 6); roundRect(ctx, 22, 16, 18, 30, 6); ctx.fill();

  // 车架（笼式）
  ctx.fillStyle = '#e8eef2';
  roundRect(ctx, -44, -6, 88, 26, 10); ctx.fill();

  // 顶棚笼架
  ctx.strokeStyle = '#c26a1f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-30, -4); ctx.lineTo(-24, -26); ctx.lineTo(22, -26); ctx.lineTo(28, -4);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-4, -4); ctx.lineTo(0, -26);
  ctx.stroke();

  // 前保险杠 + 车灯
  ctx.fillStyle = '#c26a1f';
  roundRect(ctx, -46, 2, 92, 12, 6); ctx.fill();
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath(); ctx.arc(-38, 8, 4, 0, Math.PI * 2); ctx.arc(38, 8, 4, 0, Math.PI * 2); ctx.fill();

  ctx.restore();

  // 排气管 / 尾尘（速度感）
  if (hud.speed > 8) {
    ctx.fillStyle = 'rgba(242,207,150,0.55)';
    for (let i = 0; i < 4; i += 1) {
      const px = cx - 6 + Math.random() * 12;
      const py = cy + 30 + Math.random() * 14;
      ctx.beginPath();
      ctx.arc(px, py, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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

// ---------------- 粒子 / 沙暴 ----------------

function updateAndDrawParticles(ctx, run, hud, alpha) {
  const dt = 1 / 60;
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt;
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStorm(ctx, theme, horizon, storm) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `${theme.fog}${0.0})`);
  g.addColorStop(0.5, `${theme.fog}${0.32 * storm})`);
  g.addColorStop(1, `${theme.fog}${0.5 * storm})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 横飞沙粒
  ctx.fillStyle = 'rgba(255,240,210,0.35)';
  for (let i = 0; i < Math.floor(storm * 90); i += 1) {
    const y = (Math.sin(i * 37.7 + performance.now() * 0.003) * 0.5 + 0.5) * H;
    const x = (Math.sin(i * 53.3 + performance.now() * 0.008) * 0.5 + 0.5) * W;
    ctx.fillRect(x, y, 2 + storm * 3, 1.2);
  }
}

// ---------------- 标题背景 ----------------

function drawBackdrop(ctx, theme, pos, storm, horizon, offset) {
  const h = WORLD.HORIZON;
  drawSky(ctx, theme, h, 0);
  drawSun(ctx, theme, h, 0);
  drawFarDunes(ctx, theme, h, 30, 0);
  const g = ctx.createLinearGradient(0, h - 8, 0, H);
  g.addColorStop(0, theme.groundFar);
  g.addColorStop(1, theme.groundNear);
  ctx.fillStyle = g;
  ctx.fillRect(0, h - 8, W, H - h + 8);
}
