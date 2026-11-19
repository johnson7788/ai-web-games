// STORM FIGHTER JET · Canvas 2D 渲染（霓虹街机风，全部程序化，零素材）
// 只消费 run.state + view（shake/fxQueue/clock）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, GAME, LAYOUT } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

// ---- 调色板（霓虹街机）----
const BG_TOP = '#06040f';
const BG_MID = '#0d0a24';
const BG_BOT = '#120b2e';
const GRID = 'rgba(64, 196, 255, 0.10)';
const GRID_HOT = 'rgba(255, 78, 168, 0.13)';
const PLANE = '#46e2ff';
const PLANE_DARK = '#0f7fa8';
const PLANE_WHITE = '#eaffff';
const FLAME = '#ff4db8';
const COIN = '#ffd84e';
const COIN_HOT = '#fff3b0';
const SHIELD = '#52f2ff';
const MISSILE_COLORS = { 1: '#ff4d5e', 2: '#ff9a3c', 3: '#ff3df0', 0: '#ffe14d' };

// ---- 静态背景离屏缓存 ----
let bgCache = null;
function getBackground() {
  if (bgCache) return bgCache;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  drawBackground(c.getContext('2d'));
  bgCache = c;
  return bgCache;
}

function drawBackground(g) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, BG_TOP);
  sky.addColorStop(0.55, BG_MID);
  sky.addColorStop(1, BG_BOT);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // 星点（固定 seed 分布；压低密度与亮度，让敌人/金币更突出）
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 64; i += 1) {
    const x = rnd() * W, y = rnd() * H;
    const r = 0.5 + rnd() * 1.3;
    g.fillStyle = `rgba(170, 210, 240, ${0.14 + rnd() * 0.3})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // 星云光晕
  const neb = g.createRadialGradient(W * 0.75, H * 0.3, 30, W * 0.75, H * 0.3, 420);
  neb.addColorStop(0, 'rgba(150, 60, 220, 0.18)');
  neb.addColorStop(1, 'rgba(150, 60, 220, 0)');
  g.fillStyle = neb;
  g.fillRect(0, 0, W, H);
  const neb2 = g.createRadialGradient(W * 0.2, H * 0.72, 20, W * 0.2, H * 0.72, 360);
  neb2.addColorStop(0, 'rgba(40, 160, 255, 0.14)');
  neb2.addColorStop(1, 'rgba(40, 160, 255, 0)');
  g.fillStyle = neb2;
  g.fillRect(0, 0, W, H);
}

// ---- 透视网格（滚动）----
function drawGrid(g, scrollY, t) {
  const horizon = H * 0.34;
  const rows = 9;
  for (let i = 0; i < rows; i += 1) {
    const f = (i + (scrollY % 1)) / rows;
    const y = horizon + Math.pow(f, 2) * (H - horizon);
    g.strokeStyle = i % 2 ? GRID_HOT : GRID;
    g.lineWidth = 1 + f * 1.4;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  const cols = 13;
  for (let i = 0; i <= cols; i += 1) {
    const fx = i / cols;
    const xc = W / 2;
    const spread = W * 0.62 * fx;
    g.strokeStyle = GRID;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(xc + spread * (t * 0.0006 % 0.02), horizon);
    g.lineTo(xc + spread * 1.0, H);
    g.stroke();
    g.beginPath();
    g.moveTo(xc - spread * (t * 0.0006 % 0.02), horizon);
    g.lineTo(xc - spread * 1.0, H);
    g.stroke();
  }
}

// ---- 喷气战机（程序化矢量）----
function drawPlane(g, x, y, heading, invuln, t) {
  g.save();
  g.translate(x, y);
  g.rotate(heading);
  if (invuln > 0 && Math.floor(t * 14) % 2 === 0) g.globalAlpha = 0.45;

  // 尾焰
  const flameLen = 34 + Math.sin(t * 26) * 8;
  const fg = g.createLinearGradient(0, 14, 0, 14 + flameLen);
  fg.addColorStop(0, 'rgba(255, 90, 200, 0.95)');
  fg.addColorStop(1, 'rgba(255, 90, 200, 0)');
  g.fillStyle = fg;
  g.beginPath();
  g.moveTo(-8, 16); g.lineTo(0, 16 + flameLen); g.lineTo(8, 16);
  g.closePath(); g.fill();

  // 机身
  g.fillStyle = PLANE_DARK;
  g.beginPath();
  g.moveTo(0, -30); g.lineTo(16, 22); g.lineTo(0, 15); g.lineTo(-16, 22);
  g.closePath(); g.fill();
  // 主翼
  g.fillStyle = PLANE;
  g.beginPath();
  g.moveTo(0, -2); g.lineTo(30, 26); g.lineTo(4, 14); g.lineTo(-4, 14); g.lineTo(-30, 26);
  g.closePath(); g.fill();
  // 机头高光
  g.fillStyle = PLANE_WHITE;
  g.beginPath(); g.ellipse(0, -18, 6, 14, 0, 0, Math.PI * 2); g.fill();
  // 座舱
  g.fillStyle = '#0a1c2e';
  g.beginPath(); g.ellipse(0, 2, 4, 9, 0, 0, Math.PI * 2); g.fill();

  g.restore();

  // 发光描边（更亮的主角剪影）
  g.save();
  g.strokeStyle = 'rgba(70, 226, 255, 0.5)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.stroke();
  g.restore();
}

// ---- 导弹 ----
function drawMissile(g, m) {
  const color = MISSILE_COLORS[m.type] || '#ff4d5e';
  const ang = Math.atan2(m.vy, m.vx);
  // 光晕（拉开与背景的对比）
  const halo = g.createRadialGradient(m.x, m.y, 2, m.x, m.y, 30);
  halo.addColorStop(0, 'rgba(255, 70, 90, 0.45)');
  halo.addColorStop(1, 'rgba(255, 70, 90, 0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(m.x, m.y, 30, 0, Math.PI * 2); g.fill();

  g.save();
  g.translate(m.x, m.y);
  g.rotate(ang);
  // 尾迹
  const tg = g.createLinearGradient(0, 12, 0, 40);
  tg.addColorStop(0, `${color}`);
  tg.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.5;
  g.fillStyle = tg;
  g.beginPath(); g.moveTo(-5, 12); g.lineTo(0, 42); g.lineTo(5, 12); g.closePath(); g.fill();
  g.globalAlpha = 1;
  // 弹体（加大）
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, -20); g.lineTo(11, 14); g.lineTo(0, 8); g.lineTo(-11, 14); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath(); g.arc(0, -8, 3.5, 0, Math.PI * 2); g.fill();
  g.restore();

  // 危险标记：所有导弹都带红色「!」
  g.save();
  g.font = '900 18px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText('!', m.x, m.y - 28);
  g.fillStyle = '#ff2d3f';
  g.fillText('!', m.x, m.y - 28);
  g.restore();
}

// ---- 岩石 ----
function drawRock(g, rk) {
  g.save();
  g.translate(rk.x, rk.y);
  g.rotate(rk.rot);
  const r = rk.r;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.ellipse(3, 4, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
  const grad = g.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, '#8a77c9');
  grad.addColorStop(1, '#3c3268');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(-r, r * 0.3);
  g.lineTo(-r * 0.5, -r);
  g.lineTo(r * 0.5, -r * 0.85);
  g.lineTo(r, r * 0.25);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(120, 200, 255, 0.5)';
  g.lineWidth = 1.5;
  g.stroke();
  g.restore();
}

// ---- 金币 ----
function drawCoin(g, c, t) {
  const pulse = 1 + Math.sin(t * 5 + c.x * 0.01) * 0.12;
  const r = GAME.COIN_RADIUS * pulse;
  g.save();
  // 光晕
  const halo = g.createRadialGradient(c.x, c.y, 2, c.x, c.y, r * 2.4);
  halo.addColorStop(0, 'rgba(255,216,78,0.5)');
  halo.addColorStop(1, 'rgba(255,216,78,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(c.x, c.y, r * 2.4, 0, Math.PI * 2); g.fill();
  // 币身
  g.fillStyle = COIN;
  g.beginPath(); g.arc(c.x, c.y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = COIN_HOT;
  g.beginPath(); g.arc(c.x, c.y, r * 0.55, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255, 170, 40, 0.8)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(c.x, c.y, r, 0, Math.PI * 2); g.stroke();
  // 中央「+」标记，明确是收集物
  g.strokeStyle = '#8a5a00';
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(c.x, c.y - r * 0.5); g.lineTo(c.x, c.y + r * 0.5); g.stroke();
  g.beginPath(); g.moveTo(c.x - r * 0.5, c.y); g.lineTo(c.x + r * 0.5, c.y); g.stroke();
  g.restore();
}

// ---- 护盾道具 ----
function drawShield(g, sh, t) {
  const r = GAME.SHIELD_RADIUS;
  const pulse = 0.6 + 0.4 * Math.sin(t * 4);
  g.save();
  const halo = g.createRadialGradient(sh.x, sh.y, 2, sh.x, sh.y, r * 2.6);
  halo.addColorStop(0, `rgba(82,242,255,${0.45 * pulse})`);
  halo.addColorStop(1, 'rgba(82,242,255,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(sh.x, sh.y, r * 2.6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = SHIELD;
  g.lineWidth = 3;
  g.beginPath(); g.arc(sh.x, sh.y, r, 0, Math.PI * 2); g.stroke();
  // 内六角盾
  g.fillStyle = 'rgba(82,242,255,0.85)';
  g.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const px = sh.x + Math.cos(a) * r * 0.62;
    const py = sh.y + Math.sin(a) * r * 0.62;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath(); g.fill();
  g.restore();
}

// ---- 护盾环绕战机 ----
function drawPlaneShield(g, x, y, t) {
  const r = 42;
  g.save();
  g.strokeStyle = `rgba(82,242,255,${0.55 + 0.3 * Math.sin(t * 5)})`;
  g.lineWidth = 3;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(82,242,255,0.25)';
  g.lineWidth = 8;
  g.beginPath(); g.arc(x, y, r + 7, t * 0.8, t * 0.8 + 1.4); g.stroke();
  g.restore();
}

// ---- 爆炸粒子 ----
function drawParticles(g, fx, t) {
  for (const p of fx) {
    const k = 1 - p.age / p.ttl;
    g.save();
    g.globalAlpha = Math.max(0, k);
    g.fillStyle = p.color || '#ffd84e';
    g.beginPath();
    g.arc(p.x, p.y, p.r * (0.5 + k * 0.5), 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}

// ---- 标题屏演示场景 ----
function drawTitleScene(g, t) {
  g.clearRect(0, 0, W, H);
  g.drawImage(getBackground(), 0, 0);
  drawGrid(g, t * 0.02, t * 1000);
  // 演示金币
  drawCoin(g, { x: W * 0.3, y: H * 0.5 }, t);
  drawCoin(g, { x: W * 0.72, y: H * 0.44 }, t + 1);
  drawCoin(g, { x: W * 0.62, y: H * 0.62 }, t + 2);
  // 演示导弹
  drawMissile(g, { x: W * 0.82, y: H * 0.6, vx: -120, vy: 40, type: 3, warn: true });
  // 主角喷气机居中偏下
  drawPlane(g, W / 2, H * 0.68, -Math.PI / 2, 0, t);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  let clock = 0;
  let scrollY = 0;
  let lastState = null;

  function resize(w, h) {
    return { w, h, world: { width: W, height: H } };
  }

  function debugLayout() {
    return {
      hud: { x: 0, y: 0, w: W, h: LAYOUT.HUD_H },
      world: { x: 0, y: LAYOUT.HUD_H, w: W, h: H - LAYOUT.HUD_H },
    };
  }

  function draw(state, dt, view) {
    const v = view || {};
    clock += dt || 0;
    if (!state || !state.plane) {
      drawTitleScene(ctx, clock);
      lastState = null;
      return;
    }
    lastState = state;
    scrollY += dt * 60 * 0.5; // 网格滚动速度

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(), 0, 0);
    drawGrid(ctx, scrollY, clock * 1000);

    for (const c of state.coins) drawCoin(ctx, c, clock);
    for (const sh of state.shields) drawShield(ctx, sh, clock);
    for (const rk of state.rocks) drawRock(ctx, rk);
    for (const m of state.missiles) drawMissile(ctx, m);

    const p = state.plane;
    drawPlane(ctx, p.x, p.y, p.heading, state.invuln, clock);
    if (state.shield) drawPlaneShield(ctx, p.x, p.y, clock);

    if (v.fxQueue) drawParticles(ctx, v.fxQueue, clock);

    ctx.restore();
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene(ctx, clock);
  }

  return { draw, debugLayout, resize };
}
