// Canvas 2D 渲染：霓虹合成波天空 + 光点无人机 + 光柱 + 光珠 + 粒子/浮字。
// 只消费 run.state（契约 §3.4）+ view（shake/particles/pops/flash）。
// 像素换算全部在此完成（sim 只给逻辑坐标）。API：createRenderer(canvas) → { draw(state, dt, view) }。
import { WORLD, BIRD, PIPE, ORB, LEVELS } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const GY = WORLD.GROUND_Y;

// ---- 霓虹街机色板（全游戏统一） ----
const SKY_TOP = '#0b0a2e';
const SKY_MID = '#2a1258';
const SKY_BOT = '#5b1f7a';
const SUN = '#ff3ec8';
const SUN_CORE = '#ffd166';
const GRID = 'rgba(143, 107, 255, 0.5)';
const GROUND_TOP = '#ff3ec8';
const GROUND_FILL = '#150f2e';
const PIPE_BODY = '#16102f';
const PIPE_EDGE = '#29e6ff';
const PIPE_GLOW = 'rgba(41, 230, 255, 0.55)';
const ORB_FILL = '#ffd166';
const ORB_GLOW = 'rgba(255, 209, 102, 0.9)';
const BIRD_FILL = '#29e6ff';
const BIRD_CORE = '#ffffff';
const SHIELD_RING = 'rgba(255, 209, 102, 0.85)';

function roundedRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---- 静态背景离屏缓存 ----
let bgCache = null;
function background(ctx) {
  if (bgCache) { ctx.drawImage(bgCache, 0, 0); return; }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  const sky = g.createLinearGradient(0, 0, 0, GY);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(0.55, SKY_MID);
  sky.addColorStop(1, SKY_BOT);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, GY);

  // 合成波太阳（带扫描线）
  const cx = W * 0.62;
  const cy = GY * 0.52;
  const r = 150;
  const sun = g.createLinearGradient(0, cy - r, 0, cy + r);
  sun.addColorStop(0, SUN_CORE);
  sun.addColorStop(0.55, SUN);
  sun.addColorStop(1, SKY_BOT);
  g.fillStyle = sun;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  // 扫描线切割太阳
  g.globalCompositeOperation = 'destination-out';
  for (let y = cy - r; y < cy + r; y += 8) {
    g.fillRect(cx - r, y, r * 2, 2.5);
  }
  g.globalCompositeOperation = 'source-over';

  // 星点
  const stars = [[0.12, 0.18], [0.3, 0.08], [0.5, 0.2], [0.78, 0.1], [0.9, 0.22], [0.05, 0.4], [0.85, 0.4]];
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [sx, sy] of stars) {
    g.fillRect(W * sx, H * sy, 2, 2);
  }

  // 地面
  g.fillStyle = GROUND_FILL;
  g.fillRect(0, GY, W, H - GY);
  g.fillStyle = GROUND_TOP;
  g.fillRect(0, GY, W, 5);
  g.fillStyle = 'rgba(255, 62, 200, 0.25)';
  g.fillRect(0, GY + 5, W, 14);

  bgCache = c;
  ctx.drawImage(c, 0, 0);
}

// 合成波地面网格（透视，会滚动）
function groundGrid(ctx, offset) {
  const horizon = GY;
  const base = H;
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1.5;
  // 竖线（向消失点收拢）
  const vpX = W / 2;
  for (let i = -8; i <= 8; i += 1) {
    const xTop = vpX + i * 46;
    const xBot = vpX + i * 210;
    ctx.beginPath();
    ctx.moveTo(xTop, horizon);
    ctx.lineTo(xBot, base);
    ctx.stroke();
  }
  // 横线（滚动）
  const scroll = offset % 40;
  for (let k = 0; k < 8; k += 1) {
    const t = (k * 40 + scroll) / (base - horizon);
    const y = horizon + t * t * (base - horizon);
    if (y < horizon || y > base) continue;
    ctx.globalAlpha = 0.35 + t * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPipe(ctx, pipe) {
  const topH = pipe.gapY - pipe.gapH / 2;
  const botY = pipe.gapY + pipe.gapH / 2;
  const x = pipe.x - PIPE.WIDTH / 2;
  const w = PIPE.WIDTH;

  for (const [py, ph] of [[0, topH], [botY, GY - botY]]) {
    // 管体
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#0c0922');
    grad.addColorStop(0.5, PIPE_BODY);
    grad.addColorStop(1, '#0c0922');
    ctx.fillStyle = grad;
    roundedRect(ctx, x, py, w, Math.max(0, ph), 8);
    ctx.fill();

    // 霓虹描边（发光）
    ctx.save();
    ctx.shadowColor = PIPE_GLOW;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = PIPE_EDGE;
    ctx.lineWidth = 4;
    roundedRect(ctx, x, py, w, Math.max(0, ph), 8);
    ctx.stroke();
    ctx.restore();

    // 端口盖（更亮的霓虹嘴）
    const capY = py === 0 ? py + Math.max(0, ph) - 18 : py;
    ctx.fillStyle = '#2a1d5e';
    roundedRect(ctx, x - 4, capY, w + 8, 18, 6);
    ctx.fill();
    ctx.strokeStyle = '#8feaff';
    ctx.lineWidth = 2.5;
    roundedRect(ctx, x - 4, capY, w + 8, 18, 6);
    ctx.stroke();
  }
}

function drawOrb(ctx, pipe, time) {
  if (!pipe.orbActive || pipe.orbTaken) return;
  const px = pipe.orbX;
  const py = pipe.orbY;
  const pulse = 1 + Math.sin(time * 6) * 0.16;
  const r = (ORB.R + 5) * pulse;
  ctx.save();
  ctx.shadowColor = ORB_GLOW;
  ctx.shadowBlur = 22;
  ctx.fillStyle = ORB_FILL;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // 四角星闪，强化「可收集物」辨识
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2;
  const arm = r * 0.7;
  ctx.beginPath();
  ctx.moveTo(px - arm, py);
  ctx.lineTo(px + arm, py);
  ctx.moveTo(px, py - arm);
  ctx.lineTo(px, py + arm);
  ctx.stroke();
  ctx.fillStyle = '#fff8e1';
  ctx.beginPath();
  ctx.arc(px - r * 0.22, py - r * 0.22, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBird(ctx, state, time, trail) {
  const b = state.bird;
  const y = state.phase === 'ready' ? b.y + Math.sin(time * 3) * 7 : b.y;
  const x = b.x;

  // 尾迹（只画存活的粒子，避免负半径抛异常）
  trail.push({ x, y, ttl: 0.35 });
  if (trail.length > 24) trail.shift();
  for (let i = trail.length - 1; i >= 0; i -= 1) {
    const p = trail[i];
    p.ttl -= 0.016;
    if (p.ttl <= 0) { trail.splice(i, 1); continue; }
    const a = Math.max(0, p.ttl / 0.35) * 0.4;
    ctx.fillStyle = `rgba(41, 230, 255, ${a.toFixed(3)})`;
    const tr = Math.max(0.5, BIRD.R * (p.ttl / 0.35) * 0.8);
    ctx.beginPath();
    ctx.arc(p.x - (trail.length - i) * 3, p.y, tr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(b.rot || 0);
  const VR = BIRD.R + 9; // 视觉半径比碰撞盒大，眯眼也能一眼锁定玩家

  // 护盾光环
  if (state.shield > 0) {
    ctx.strokeStyle = SHIELD_RING;
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255, 209, 102, 0.9)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, VR + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // 主体（白热核心 + 青色外壳，对比强烈）
  ctx.shadowColor = 'rgba(41, 230, 255, 0.95)';
  ctx.shadowBlur = 26;
  const bodyGrad = ctx.createRadialGradient(0, 0, VR * 0.2, 0, 0, VR);
  bodyGrad.addColorStop(0, '#ffffff');
  bodyGrad.addColorStop(0.35, '#b9f4ff');
  bodyGrad.addColorStop(1, '#29e6ff');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, VR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 翅膀（拍动动画，死亡后耷拉）
  const flap = state.phase === 'dead' ? 0.9 : (0.5 + Math.sin(time * 18) * 0.5);
  ctx.fillStyle = '#8feaff';
  ctx.beginPath();
  ctx.ellipse(-VR * 0.1, VR * 0.1, VR * 0.9, VR * 0.42, flap - 0.4, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = '#04222a';
  ctx.beginPath();
  ctx.arc(VR * 0.28, -VR * 0.22, VR * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawParticles(ctx, particles, dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ttl -= dt;
    const a = Math.max(0, p.ttl / p.maxTtl);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * Math.max(0.15, a), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPops(ctx, pops, dt) {
  for (const p of pops) {
    p.y -= 42 * dt;
    p.ttl -= dt;
    const a = Math.max(0, p.ttl / p.maxTtl);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.font = `900 ${p.size}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillText(p.text, p.x, p.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start';
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  const trail = [];

  function draw(state, dt, view = {}) {
    const time = state ? state.time : 0;
    const dist = state ? state.dist : 0;

    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (view.shake > 0) {
      ctx.translate(
        (Math.random() * 2 - 1) * view.shake,
        (Math.random() * 2 - 1) * view.shake,
      );
    }

    background(ctx);
    groundGrid(ctx, dist);

    if (state) {
      for (const pipe of state.pipes) drawPipe(ctx, pipe);
      for (const pipe of state.pipes) drawOrb(ctx, pipe, time);
      drawBird(ctx, state, time, trail);
      if (view.particles) drawParticles(ctx, view.particles, dt);
      if (view.pops) drawPops(ctx, view.pops, dt);
    }

    ctx.restore();

    // 全屏闪白/闪色（死亡等）
    if (view.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.6, view.flash).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return { draw };
}
