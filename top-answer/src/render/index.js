// Canvas 2D 渲染：背景渐变 + 揭示/通关彩带粒子（答案板与输入为 DOM）。
import { WORLD, COLORS } from '../../config/game.config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];

  function confetti(n = 40) {
    const palette = ['#60a5fa', '#fbbf24', '#34d399', '#f472b6', '#a78bfa'];
    for (let i = 0; i < n; i += 1) {
      particles.push({
        x: Math.random() * WORLD.WIDTH,
        y: -20 - Math.random() * 120,
        vx: (Math.random() - 0.5) * 80,
        vy: 120 + Math.random() * 160,
        life: 2.2 + Math.random(),
        t: 0,
        color: palette[i % palette.length],
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 6,
      });
    }
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life || p.y > WORLD.HEIGHT + 30) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  function render() {
    const g = ctx.createRadialGradient(640, 200, 60, 640, 360, 900);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 顶部聚光
    const spot = ctx.createRadialGradient(640, 120, 10, 640, 120, 420);
    spot.addColorStop(0, 'rgba(96,165,250,0.12)');
    spot.addColorStop(1, 'rgba(96,165,250,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function clearEffects() { particles.length = 0; }

  return { render, update, confetti, clearEffects };
}