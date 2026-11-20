// src/render/particles.js — 粒子：格挡/命中/涟漪/胜利火花。
import { PARTICLE, clamp } from './theme.js';

export function createParticles() {
  const pool = [];

  function burst(x, y, kind) {
    const colors = {
      pop: ['#ffd166', '#fff4cf', '#ff9e4f'],
      block: ['#7df9ff', '#ffffff', '#2aa9c4'],
      break: ['#ff5d73', '#ffd166', '#ffffff'],
      gold: ['#ffd166', '#fff2b0', '#ff9e4f'],
    }[kind] || ['#ffffff'];
    const n = kind === 'break' ? 18 : PARTICLE.burstN;
    for (let i = 0; i < n; i += 1) {
      if (pool.length >= PARTICLE.cap) pool.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 260;
      pool.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120,
        life: 0.5 + Math.random() * 0.5,
        age: 0,
        r: 2 + Math.random() * 3,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
  }

  function update(dt) {
    for (let i = pool.length - 1; i >= 0; i -= 1) {
      const p = pool[i];
      p.age += dt;
      if (p.age >= p.life) { pool.splice(i, 1); continue; }
      p.vy += 460 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of pool) {
      const a = clamp(1 - p.age / p.life, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return { burst, update, draw };
}
