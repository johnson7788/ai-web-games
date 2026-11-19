// RPS DUEL QI · 渲染层（canvas 程序化霓虹街机）
// 只画：背景网格、两位斗士、宗师亮手 + 倒计时环、玩家出手光束、粒子火花。
// HUD / 手牌按钮 / 屏幕由 DOM（ui.js + main.js）负责，避免 canvas 文字裁切。
import { WORLD } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

const PAL = {
  bg0: '#070311',
  bg1: '#140a2e',
  grid: '#241b52',
  player: '#35f0ff',
  playerDim: '#1e8fa8',
  boss: '#ff3d81',
  bossDim: '#a82a5c',
  gold: '#ffd24a',
  qi: '#b44dff',
  white: '#eaf6ff',
};

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function capsule(ctx, x1, y1, x2, y2, w) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// 手牌图标（rock=拳 / scissors=剪 / paper=掌），发光描边填充
function drawHand(ctx, cx, cy, size, hand, color, glow = 18) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  const s = size;

  if (hand === 'rock') {
    // 拳头：主体圆 + 3 个指节
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.12, s * 0.62, 0, Math.PI * 2);
    ctx.fill();
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.arc(cx + i * s * 0.34, cy - s * 0.5, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (hand === 'scissors') {
    // 剪刀：两根手指从底部基座向上张开（V 形，✌）
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.28;
    capsule(ctx, cx, cy + s * 0.55, cx - s * 0.5, cy - s * 0.55, s * 0.28);
    capsule(ctx, cx, cy + s * 0.55, cx + s * 0.5, cy - s * 0.55, s * 0.28);
  } else {
    // 布掌：掌底 + 四根手指
    roundedRect(ctx, cx - s * 0.6, cy - s * 0.05, s * 1.2, s * 0.75, s * 0.22);
    ctx.fill();
    for (let i = -3; i <= 3; i += 2) {
      capsule(ctx, cx + i * s * 0.24, cy - s * 0.05, cx + i * s * 0.24, cy - s * 0.7, s * 0.2);
    }
  }
  ctx.restore();
}

function drawFighter(ctx, x, y, s, color, t, angry) {
  ctx.save();
  const glow = 14 + Math.min(14, angry * 4);
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  // 底座环
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.62, s * 0.5, s * 0.16, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // 身体（圆角三角）
  ctx.beginPath();
  ctx.moveTo(x - s * 0.34, y + s * 0.6);
  ctx.quadraticCurveTo(x, y - s * 0.1, x + s * 0.34, y + s * 0.6);
  ctx.closePath();
  ctx.fill();
  // 头
  ctx.beginPath();
  ctx.arc(x, y - s * 0.28 + Math.sin(t * 3) * s * 0.02, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // 手臂（前端握拳，随 t 微动）
  const sway = Math.sin(t * 2.2) * s * 0.06;
  capsule(ctx, x + s * 0.3, y + s * 0.28, x + s * 0.56 + sway, y - s * 0.08, s * 0.13);
  ctx.beginPath();
  ctx.arc(x + s * 0.56 + sway, y - s * 0.1, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let time = 0;
  let particles = [];

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (typeof window !== 'undefined') {
    resize();
    window.addEventListener('resize', resize);
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PAL.bg1);
    g.addColorStop(1, PAL.bg0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 透视网格（地板）
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1.5;
    const horizon = H * 0.52;
    ctx.beginPath();
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      const x = W * 0.5 + (t - 0.5) * W * 1.6;
      ctx.moveTo(W * 0.5, horizon);
      ctx.lineTo(x, H + 20);
    }
    for (let j = 0; j <= 8; j += 1) {
      const t = j / 8;
      const y = horizon + t * t * (H - horizon);
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    // 顶部霓虹光晕
    const glow = ctx.createRadialGradient(W * 0.5, horizon, 10, W * 0.5, horizon, W * 0.7);
    glow.addColorStop(0, 'rgba(180, 77, 255, 0.16)');
    glow.addColorStop(1, 'rgba(180, 77, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    // 暗角
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.4, W * 0.5, H * 0.5, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    // 扫描线
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    ctx.globalAlpha = 1;
  }

  function drawCountdownRing(cx, cy, r, frac, color) {
    ctx.save();
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.restore();
  }

  function spawnSpark(x, y, color, n = 14) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.4, ttl: 0.5 + Math.random() * 0.4, color, r: 1.5 + Math.random() * 2,
      });
    }
  }

  function draw(state, dt, view) {
    time += dt;
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    const cx = W / 2;
    const bossC = { x: cx, y: H * 0.4 };
    const angry = state ? state.anger : 1;
    const bossColor = angry >= 4 ? '#ff2040' : PAL.boss;

    // 斗士
    drawFighter(ctx, W * 0.18, H * 0.62, 92, PAL.player, time, 0);
    drawFighter(ctx, W * 0.82, H * 0.6, 108, bossColor, time, angry);

    // 宗师亮手（中心大图标 + 倒计时环）
    if (state && state.bossHand && (state.phase === 'playing' || state.phase === 'settle')) {
      const handSize = 66;
      const pulse = 1 + Math.sin(time * 6) * 0.03;
      const frac = state.roundTime > 0 ? Math.max(0, state.timeLeft / state.roundTime) : 0;
      const ringColor = frac < 0.3 ? '#ff2040' : PAL.gold;
      drawCountdownRing(cx, bossC.y, handSize + 30, frac, ringColor);
      drawHand(ctx, cx, bossC.y, handSize * pulse, state.bossHand, bossColor, 26);
    }

    // 玩家出手光束 / 出手手牌
    if (view && view.playerHand && view.playerHandT > 0) {
      const ph = view.playerHand;
      const px = W * 0.32;
      const py = H * 0.56;
      ctx.save();
      ctx.strokeStyle = PAL.player;
      ctx.shadowColor = PAL.player;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 5;
      ctx.globalAlpha = Math.min(1, view.playerHandT * 2);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(cx, bossC.y);
      ctx.stroke();
      ctx.restore();
      if (ph === 'rock' || ph === 'scissors' || ph === 'paper') drawHand(ctx, px, py, 46, ph, PAL.player, 20);
    }

    // 粒子
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    particles = particles.filter((p) => p.life > 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.ttl);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // 浮动得分文字
    if (view && view.floatText && view.floatTextT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, view.floatTextT);
      ctx.fillStyle = PAL.gold;
      ctx.font = '800 30px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = PAL.gold;
      ctx.shadowBlur = 12;
      ctx.fillText(view.floatText, cx, H * 0.3 - (1 - view.floatTextT) * 30);
      ctx.restore();
    }
  }

  function debugLayout() {
    return {
      boss: { x: W / 2 - 96, y: H * 0.4 - 96, w: 192, h: 192 },
      buttons: { x: 0, y: H - 150, w: W, h: 150 },
    };
  }

  return { draw, debugLayout, spawnSpark, get palette() { return PAL; } };
}
