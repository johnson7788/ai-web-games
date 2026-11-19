// BLADE BARRAGE · Canvas 2D 渲染（霓虹街机，全程序化，零素材）
// 只消费 run.state + view（shake/fx 由 main 通过 renderer 方法注入）。
// 契约：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h), fx(name,x,y), shake(amp) }。

import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

const COL = {
  cyan: '#3EF5FF',
  cyanHot: '#E8FFFF',
  magenta: '#FF3EC8',
  danger: '#FF4D6D',
  gem: '#A6FF4D',
  rock: '#9AA4B8',
  rockRim: '#3EF5FF',
};

const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- 背景离屏缓存 ----
let bgCanvas = null;
function getBackground() {
  if (bgCanvas) return bgCanvas;
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = W;
  bgCanvas.height = H;
  const g = bgCanvas.getContext('2d');
  // 深空渐变
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0a1c');
  sky.addColorStop(0.5, '#0d0d24');
  sky.addColorStop(1, '#150f2e');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // 霓虹网格（透视地面）
  g.strokeStyle = 'rgba(62,245,255,0.10)';
  g.lineWidth = 1;
  for (let x = -H; x <= W + H; x += 60) {
    g.beginPath(); g.moveTo(x, H * 0.62); g.lineTo(W / 2 + (x - W / 2) * 3, H); g.stroke();
  }
  for (let y = 0; y < 8; y += 1) {
    const yy = H * 0.62 + Math.pow(y / 7, 2) * H * 0.38;
    g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke();
  }
  // 星点（调暗，避免与目标光球混淆）
  let s = 7;
  const rnd = (i, m) => { s = (s * 16807) % 2147483647; return (s / 2147483647) * m; };
  for (let i = 0; i < 70; i += 1) {
    g.fillStyle = `rgba(210,230,255,${0.08 + rnd(i, 0.3)})`;
    g.beginPath();
    g.arc(rnd(i + 1, W), rnd(i + 2, H * 0.62), 0.5 + rnd(i + 3, 1.1), 0, Math.PI * 2);
    g.fill();
  }
  // 顶部/底部霓虹辉光带
  const topGlow = g.createLinearGradient(0, 0, 0, 120);
  topGlow.addColorStop(0, 'rgba(255,62,200,0.16)');
  topGlow.addColorStop(1, 'rgba(255,62,200,0)');
  g.fillStyle = topGlow; g.fillRect(0, 0, W, 120);
  const botGlow = g.createLinearGradient(0, H - 110, 0, H);
  botGlow.addColorStop(0, 'rgba(62,245,255,0.14)');
  botGlow.addColorStop(1, 'rgba(62,245,255,0)');
  g.fillStyle = botGlow; g.fillRect(0, H - 110, W, 110);
  return bgCanvas;
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

function glowCircle(ctx, x, y, r, color, alpha = 1) {
  const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

// ---- 尖刺（上排朝下 / 下排朝上）----
function drawSpikes(ctx) {
  const n = Math.ceil(W / 46) + 1;
  const color = COL.danger;
  ctx.save();
  // 深色基底，把尖刺与网格地面拉开对比
  ctx.fillStyle = 'rgba(12, 8, 16, 0.72)';
  ctx.fillRect(0, GAME.TOP_SPIKE_Y - 8, W, 48);
  ctx.fillRect(0, GAME.BOTTOM_SPIKE_Y - 8, W, 48);
  ctx.shadowColor = color;
  ctx.shadowBlur = REDUCED_MOTION ? 0 : 8;
  for (let i = 0; i < n; i += 1) {
    const x = i * 46 - 8;
    const gradTop = ctx.createLinearGradient(0, GAME.TOP_SPIKE_Y, 0, GAME.TOP_SPIKE_Y + 40);
    gradTop.addColorStop(0, '#FF8AA3');
    gradTop.addColorStop(1, color);
    ctx.fillStyle = gradTop;
    // 上排（朝下）
    ctx.beginPath();
    ctx.moveTo(x, GAME.TOP_SPIKE_Y);
    ctx.lineTo(x + 23, GAME.TOP_SPIKE_Y + 40);
    ctx.lineTo(x + 46, GAME.TOP_SPIKE_Y);
    ctx.closePath(); ctx.fill();
    const gradBot = ctx.createLinearGradient(0, GAME.BOTTOM_SPIKE_Y, 0, GAME.BOTTOM_SPIKE_Y - 40);
    gradBot.addColorStop(0, '#FF8AA3');
    gradBot.addColorStop(1, color);
    ctx.fillStyle = gradBot;
    // 下排（朝上）
    ctx.beginPath();
    ctx.moveTo(x, GAME.BOTTOM_SPIKE_Y);
    ctx.lineTo(x + 23, GAME.BOTTOM_SPIKE_Y - 40);
    ctx.lineTo(x + 46, GAME.BOTTOM_SPIKE_Y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---- 核心（magenta 光球 + 瞳孔 + 金色准星 = 目标标记）----
function drawCore(ctx, core, clock, opts = {}) {
  const { x, y, radius } = core;
  const pulse = REDUCED_MOTION ? 1 : 1 + Math.sin(clock * 6) * 0.08;
  glowCircle(ctx, x, y, radius, 'rgba(255,62,200,0.6)');
  ctx.save();
  ctx.shadowColor = COL.magenta;
  ctx.shadowBlur = REDUCED_MOTION ? 0 : 18;
  const g = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
  g.addColorStop(0, '#FFB3EE');
  g.addColorStop(0.45, COL.magenta);
  g.addColorStop(1, '#8E1E7E');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, radius * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 瞳孔（敌意之眼）
  ctx.fillStyle = '#2A0A2E';
  ctx.beginPath(); ctx.arc(x, y, radius * 0.44, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFD9F5';
  ctx.beginPath(); ctx.arc(x - radius * 0.13, y - radius * 0.13, radius * 0.15, 0, Math.PI * 2); ctx.fill();

  if (opts.target) {
    // 金色准星（4 角括号）+ 目标标签：明确「这就是要贯穿的目标」
    const R = radius * 1.6;
    const a = 0.55 + 0.4 * Math.sin(clock * 5);
    ctx.save();
    ctx.strokeStyle = `rgba(255,216,78,${a})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#FFD84E';
    ctx.shadowBlur = REDUCED_MOTION ? 0 : 10;
    const b = R * 0.34;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * R - sx * b, y + sy * R);
      ctx.lineTo(x + sx * R, y + sy * R);
      ctx.lineTo(x + sx * R, y + sy * R - sy * b);
      ctx.stroke();
    }
    ctx.restore();
    const lang = (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
    const label = lang === 'zh' ? '目标' : 'TARGET';
    ctx.fillStyle = `rgba(255,216,78,${0.85 + 0.15 * Math.sin(clock * 5)})`;
    ctx.font = '800 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x, y - R - 6);
  }
}

// ---- 飞刃（cyan 剑形 + 拖尾）----
function drawBlade(ctx, s, clock) {
  const bx = s.blade.x;
  const by = s.blade.y;
  const hw = GAME.BLADE_HALF_W;
  const hh = GAME.BLADE_HALF_H;

  // 拖尾
  if (s.blade.fired && !REDUCED_MOTION) {
    const trail = ctx.createLinearGradient(0, by, 0, by + 130);
    trail.addColorStop(0, 'rgba(62,245,255,0.35)');
    trail.addColorStop(1, 'rgba(62,245,255,0)');
    ctx.fillStyle = trail;
    ctx.fillRect(bx - hw, by, hw * 2, 130);
  }

  ctx.save();
  ctx.translate(bx, by);
  ctx.shadowColor = COL.cyan;
  ctx.shadowBlur = REDUCED_MOTION ? 0 : 16;
  // 剑体（向上箭头形状）
  const grad = ctx.createLinearGradient(0, -hh, 0, hh);
  grad.addColorStop(0, COL.cyanHot);
  grad.addColorStop(0.4, COL.cyan);
  grad.addColorStop(1, '#1A7A8C');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -hh);            // 剑尖
  ctx.lineTo(hw, -hh * 0.3);
  ctx.lineTo(hw * 0.7, hh * 0.6);
  ctx.lineTo(0, hh);            // 剑柄尖
  ctx.lineTo(-hw * 0.7, hh * 0.6);
  ctx.lineTo(-hw, -hh * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 中央白热芯
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(0, by - hh + 4);
  ctx.lineTo(2.5, by + hh * 0.5);
  ctx.lineTo(-2.5, by + hh * 0.5);
  ctx.closePath();
  ctx.fill();

  // 底座辉光
  glowCircle(ctx, bx, by + hh, 26, 'rgba(62,245,255,0.4)');
}

// ---- 岩石（灰六边形，cyan 描边）----
function drawRock(ctx, rock, clock) {
  const { x, y, r } = rock;
  const rot = clock * 0.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.shadowColor = COL.rockRim;
  ctx.shadowBlur = REDUCED_MOTION ? 0 : 10;
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#B7C0D4');
  g.addColorStop(1, '#5B6472');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COL.rockRim;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// ---- 能量宝石（绿色菱形）----
function drawGem(ctx, gem, clock) {
  const { x, y, r } = gem;
  const pulse = REDUCED_MOTION ? 1 : 1 + Math.sin(clock * 5) * 0.16;
  glowCircle(ctx, x, y, r * 1.6, 'rgba(166,255,77,0.5)');
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.shadowColor = COL.gem;
  ctx.shadowBlur = REDUCED_MOTION ? 0 : 12;
  ctx.fillStyle = COL.gem;
  ctx.fillRect(-r * 0.9 * pulse, -r * 0.9 * pulse, r * 1.8 * pulse, r * 1.8 * pulse);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, Math.PI * 2); ctx.fill();
}

// ---- 粒子 ----
function spawnParticles(arr, x, y, color, n, speed = 320) {
  if (REDUCED_MOTION) n = Math.max(2, Math.floor(n / 3));
  for (let i = 0; i < n; i += 1) {
    if (arr.length >= GAME.MAX_PARTICLES) arr.shift();
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.4 + Math.random() * 0.9);
    arr.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.5,
      maxLife: 0.9,
      color,
      size: 1.5 + Math.random() * 3,
    });
  }
}

export function createRenderer(canvas) {
  const dpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let clock = 0;
  let lastState = null;
  let particles = [];
  let shakeAmt = 0;
  let surgeAura = 0; // 0..1

  function resize(w, h) {
    return { w, h, world: { width: W, height: H } };
  }

  function fx(name, x, y) {
    switch (name) {
      case 'fire': spawnParticles(particles, x, y + GAME.BLADE_HALF_H, COL.cyan, 8, 200); break;
      case 'hit': spawnParticles(particles, x, y, COL.magenta, 16, 380); spawnParticles(particles, x, y, COL.cyan, 8, 260); break;
      case 'perfect': spawnParticles(particles, x, y, '#FFFFFF', 10, 300); break;
      case 'gem': spawnParticles(particles, x, y, COL.gem, 14, 300); break;
      case 'surge': spawnParticles(particles, x, y, COL.gem, 30, 420); break;
      case 'burst': spawnParticles(particles, x, y, COL.cyan, 24, 420); spawnParticles(particles, x, y, COL.magenta, 16, 300); break;
      case 'die': spawnParticles(particles, x, y, COL.danger, 26, 460); break;
      case 'rock': spawnParticles(particles, x, y, COL.rock, 16, 320); break;
      default: break;
    }
  }

  function shake(amp) { shakeAmt = Math.max(shakeAmt, amp); }

  function debugLayout() {
    return {
      hud: { x: 0, y: 0, w: W, h: LAYOUT.HUD_H },
      blade: { x: GAME.BLADE_X - 46, y: GAME.BLADE_START_Y - 60, w: 92, h: 130 },
      core: { x: 300, y: 92, w: 680, h: 230 },
      gem: { x: 300, y: 320, w: 680, h: 200 },
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(getBackground(), 0, 0);
    drawSpikes(ctx);
    // 装饰核心（慢速往复）
    const cx = W / 2 + Math.sin(clock * 1.1) * 460;
    const cy = 210 + Math.sin(clock * 0.8) * 24;
    drawCore(ctx, { x: cx, y: cy, radius: 46 }, clock);
    // 装饰飞刃（待发）
    drawBlade(ctx, { blade: { x: GAME.BLADE_X, y: GAME.BLADE_START_Y, fired: false } }, clock);
    drawGem(ctx, { x: 340 + Math.sin(clock * 0.9 + 2) * 220, y: 400, r: 11 }, clock);
  }

  function draw(state, dt, view) {
    const v = view || {};
    clock += dt || 0;
    surgeAura = Math.max(0, surgeAura - (dt || 0) * 1.6);
    if (state && state.surge) surgeAura = 1;

    if (!state || state.phase == null || state.phase === 'title') {
      drawTitleScene();
      // 标题粒子维持少量
      updateParticles(dt);
      drawParticles();
      return;
    }

    lastState = state;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shakeAmt > 0) {
      ctx.translate((Math.random() * 2 - 1) * shakeAmt, (Math.random() * 2 - 1) * shakeAmt);
    }

    ctx.drawImage(getBackground(), 0, 0);
    drawSpikes(ctx);

    // Surge 全屏色调（子弹时间氛围）
    if (surgeAura > 0) {
      ctx.fillStyle = `rgba(166,255,77,${0.06 * surgeAura})`;
      ctx.fillRect(0, 0, W, H);
    }

    for (const rock of state.rocks) drawRock(ctx, rock, clock);
    for (const p of state.pickups) if (!p.collected) drawGem(ctx, p, clock);
    if (state.core) drawCore(ctx, state.core, clock, { target: true });
    drawBlade(ctx, state, clock);

    updateParticles(dt);
    drawParticles();

    ctx.restore();
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt; // 轻微下坠
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { draw, debugLayout, resize, fx, shake };
}
