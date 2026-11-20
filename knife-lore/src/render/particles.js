// KNIFE LORE · 墨点粒子（程序化 Canvas 水墨飞溅，零素材）
import { PARTICLE, clamp } from './theme.js';

export function createParticles() {
  const parts = []; // { x, y, vx, vy, life, maxLife, size, color, kind }

  function burst(x, y, kind, color) {
    const n = kind === 'break' ? PARTICLE.inkMax : kind === 'signature' ? 28 : 12;
    for (let i = 0; i < n; i += 1) {
      if (parts.length >= PARTICLE.cap) parts.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = (kind === 'break' ? 260 : 160) * (0.4 + Math.random());
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (kind === 'break' ? 40 : 0),
        life: 0,
        maxLife: 0.5 + Math.random() * 0.6,
        size: 2 + Math.random() * 4,
        color: color || 'rgba(20, 15, 10, 0.85)',
        kind,
      });
    }
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.maxLife) { parts.splice(i, 1); continue; }
      p.vy += 260 * dt; // 墨点轻微下坠
      p.vx *= (1 - 1.6 * dt);
      p.vy *= (1 - 1.6 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function draw(ctx) {
    for (const p of parts) {
      const t = p.life / p.maxLife;
      const alpha = 1 - t;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + t * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { burst, update, draw, get count() { return parts.length; } };
}
