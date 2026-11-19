// src/render/index.js — 程序化 canvas 渲染：霓虹街机风赛道 + 双车道 + 霓虹鸡 + 清场闸门/岩石。
// 逻辑坐标 1280×720；DPR ≤2；全部绘制无外部素材。
import { WORLD } from '../../config/game.config.js';

const TRUE_X = 410;
const FALSE_X = 870;
const GROUND_Y = 640;

const COLORS = {
  bgTop: '#07071a',
  bgBottom: '#0c1030',
  grid: 'rgba(120,140,255,0.10)',
  true: '#2ee6c8',
  false: '#ff5d7e',
  player: '#ffd23f',
  playerGlow: 'rgba(255,210,63,0.55)',
  gate: '#ff8a3d',
  rock: '#7a8bd8',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let hazardAnim = null;

  function resize() {
    const vw = window.innerWidth || WORLD.WIDTH;
    const vh = window.innerHeight || WORLD.HEIGHT;
    const scale = Math.min(vw / WORLD.WIDTH, vh / WORLD.HEIGHT);
    const cssW = Math.floor(WORLD.WIDTH * scale);
    const cssH = Math.floor(WORLD.HEIGHT * scale);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform((cssW * dpr) / WORLD.WIDTH, 0, 0, (cssH * dpr) / WORLD.HEIGHT, 0, 0);
    const host = canvas.parentElement;
    if (host) {
      host.style.width = cssW + 'px';
      host.style.height = cssH + 'px';
    }
  }
  resize();
  window.addEventListener('resize', resize);

  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 地平线网格
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const scroll = (t * 40) % 40;
    for (let y = 40 - scroll; y < GROUND_Y; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
    for (let x = 80; x < WORLD.WIDTH; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x, GROUND_Y);
      ctx.stroke();
    }
  }

  function drawLane(x, label, color) {
    // 车道地面
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(x - 150, 40, 300, GROUND_Y - 40);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(x, 46);
    ctx.lineTo(x, GROUND_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 标签
    ctx.fillStyle = color;
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillText(label, x, 70);
    ctx.shadowBlur = 0;
  }

  function drawChicken(x, y, scale, opts = {}) {
    const { body = '#c8d0ff', glow = null, alive = true, label = '' } = opts;
    if (!alive) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;
    }
    // 身体（椭圆）
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 头
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(-2, -14, 9, 0, Math.PI * 2);
    ctx.fill();
    // 鸡冠
    ctx.fillStyle = '#ff5d7e';
    ctx.beginPath();
    ctx.arc(-2, -21, 4, 0, Math.PI * 2);
    ctx.fill();
    // 喙
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(4, -15);
    ctx.lineTo(12, -13);
    ctx.lineTo(4, -10);
    ctx.closePath();
    ctx.fill();
    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(1, -15, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(2, -15, 1.1, 0, Math.PI * 2);
    ctx.fill();
    // 腿
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 14); ctx.lineTo(-7, 22);
    ctx.moveTo(6, 14); ctx.lineTo(7, 22);
    ctx.stroke();
    ctx.restore();

    if (label) {
      ctx.fillStyle = '#fff';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y + 32);
    }
  }

  function drawHazard(h) {
    if (!h) return;
    const now = performance.now();
    if (!hazardAnim || hazardAnim.lane !== h.lane) {
      hazardAnim = { lane: h.lane, type: h.type, start: now };
    }
    const p = Math.min(1, (now - hazardAnim.start) / 1400);
    const x = h.lane === 1 ? FALSE_X : TRUE_X;
    const y = -120 + p * (GROUND_Y + 120);
    ctx.save();
    ctx.globalAlpha = p >= 1 ? 0.9 : 1;
    if (h.type === 'rock') {
      ctx.fillStyle = COLORS.rock;
      ctx.shadowColor = COLORS.rock;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(x, y, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aab6ff';
      ctx.beginPath();
      ctx.arc(x - 16, y - 14, 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = COLORS.gate;
      ctx.shadowColor = COLORS.gate;
      ctx.shadowBlur = 24;
      ctx.fillRect(x - 130, y - 16, 260, 34);
      ctx.fillStyle = '#fff';
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✕', x, y + 6);
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const pt = particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 300 * dt;
      pt.life -= dt * 1.6;
      if (pt.life <= 0) particles.splice(i, 1);
    }
  }

  let lastNow = performance.now();
  function draw(hud, alpha = 1) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;

    drawBackground(now / 1000);
    drawLane(TRUE_X, 'TRUE', COLORS.true);
    drawLane(FALSE_X, 'FALSE', COLORS.false);

    if (hud && hud.phase === 'playing') {
      // 机器人
      const bots = hud.bots || [];
      for (const b of bots) {
        if (!b.alive) continue;
        const row = b.id % 8;
        const col = Math.floor(b.id / 8) % 2;
        const x = TRUE_X + (FALSE_X - TRUE_X) * b.camp + (col - 0.5) * 96;
        const y = 200 + row * 46;
        drawChicken(x, y, 1.0, { body: `hsl(${b.tint}, 70%, 66%)` });
      }
      // 玩家
      if (hud.playerAlive) {
        const px = TRUE_X + (FALSE_X - TRUE_X) * hud.playerCamp;
        drawChicken(px, 560, 1.5, { body: COLORS.player, glow: COLORS.playerGlow, label: 'YOU' });
      }
      drawHazard(hud.hazard);
    }

    updateParticles(dt);
    drawParticles();
  }

  function burst(x, y, kind) {
    const color = kind === 'correct' ? COLORS.true : kind === 'wrong' ? COLORS.false : COLORS.player;
    for (let i = 0; i < 18; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        r: 1.5 + Math.random() * 3,
        color,
        life: 0.6 + Math.random() * 0.5,
      });
    }
    if (particles.length > 320) particles.splice(0, particles.length - 320);
  }

  function playerPos(hud) {
    if (!hud) return { x: TRUE_X, y: 560 };
    return { x: TRUE_X + (FALSE_X - TRUE_X) * hud.playerCamp, y: 560 };
  }

  return { draw, burst, playerPos, resize };
}
