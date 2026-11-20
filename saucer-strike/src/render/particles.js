// 粒子系统：击杀爆炸 / 命中火花 / 曳光火花（纯渲染，不碰游戏逻辑）
import { PARTICLE } from './theme.js';

const COLORS = {
  kill: ['#ffd166', '#ff5d73', '#ffffff', '#7df9ff'],
  hit: ['#7df9ff', '#ffffff', '#c792ff'],
  tracer: ['#8ff4ff', '#ffd166', '#ffffff'],
  meteorBlock: ['#ff9e4f', '#ff5d73'],
};

export function createParticles() {
  const list = [];

  function burst(x, y, kind, count = 14) {
    const colors = COLORS[kind] || COLORS.hit;
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 260;
      list.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        r: 1.5 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    if (list.length > PARTICLE.cap) list.splice(0, list.length - PARTICLE.cap);
  }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
  }

  function draw(ctx) {
    for (const p of list) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { burst, update, draw };
}
