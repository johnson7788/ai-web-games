// Canvas 2D 渲染：环形农田（地块/作物生长/成熟脉冲）+ 收割粒子。
import { WORLD, RING, COLORS } from '../../config/game.config.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

export function plotPos(i) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / RING.PLOTS;
  return { x: RING.CX + RING.R * Math.cos(a), y: RING.CY + RING.R * Math.sin(a) };
}

function drawCrop(ctx, x, y, r, growth, now) {
  if (growth >= 1) {
    const pulse = 1 + 0.06 * Math.sin(now / 200);
    ctx.fillStyle = COLORS.crop;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.5);
    ctx.lineTo(x, y - r * 0.1);
    ctx.stroke();
    for (let k = -1; k <= 1; k += 1) {
      ctx.beginPath();
      ctx.ellipse(x + k * r * 0.22, y - r * 0.15, r * 0.12, r * 0.22, k * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (growth > 0.05) {
    const h = r * 0.7 * growth;
    ctx.strokeStyle = COLORS.sprout;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.4);
    ctx.lineTo(x, y + r * 0.4 - h);
    ctx.stroke();
    ctx.fillStyle = COLORS.sprout;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.18, y + r * 0.4 - h * 0.7, r * 0.16, r * 0.1, -0.5, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.18, y + r * 0.4 - h * 0.8, r * 0.16, r * 0.1, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 150;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.5 + Math.random() * 0.3, t: 0, color, size: 3 + Math.random() * 3 });
    }
  }
  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.vy += 400 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(RING.CX, RING.CY, 60, RING.CX, RING.CY, 700);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawRing(run, view) {
    const now = view.now || 0;
    // 中心谷仓
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(RING.CX - 45, RING.CY - 30, 90, 60);
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(RING.CX - 55, RING.CY - 30);
    ctx.lineTo(RING.CX, RING.CY - 65);
    ctx.lineTo(RING.CX + 55, RING.CY - 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(RING.CX - 12, RING.CY, 24, 30);

    for (let i = 0; i < RING.PLOTS; i += 1) {
      const p = run.plots[i];
      const { x, y } = plotPos(i);
      if (!p.unlocked) {
        ctx.fillStyle = COLORS.locked;
        ctx.beginPath();
        ctx.arc(x, y, RING.PLOT_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = COLORS.panelEdge;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(238,246,238,0.3)';
        ctx.font = `700 22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒', x, y);
        continue;
      }
      ctx.fillStyle = p.growth >= 1 ? COLORS.soilReady : COLORS.soil;
      ctx.beginPath();
      ctx.arc(x, y, RING.PLOT_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.panelEdge;
      ctx.lineWidth = 3;
      ctx.stroke();
      // 生长进度环
      if (p.growth < 1) {
        ctx.strokeStyle = COLORS.sprout;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, RING.PLOT_R - 3, -Math.PI / 2, -Math.PI / 2 + p.growth * 2 * Math.PI);
        ctx.stroke();
      }
      drawCrop(ctx, x, y, RING.PLOT_R, p.growth, now);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function render(view) {
    drawBackground();
    if (view.run) drawRing(view.run, view);
    drawParticles();
  }

  function hitPlot(x, y) {
    for (let i = 0; i < RING.PLOTS; i += 1) {
      const p = plotPos(i);
      if (Math.hypot(x - p.x, y - p.y) <= RING.PLOT_R + 4) return i;
    }
    return -1;
  }

  function clearEffects() { particles.length = 0; }
  return { render, update, burst, hitPlot, plotPos, clearEffects };
}