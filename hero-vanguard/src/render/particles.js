// src/render/particles.js — 轻量粒子层（命中/击杀/共鸣/换位特效）
export function createParticles() {
  let parts = [];

  function burst(x, y, color, count = 8, speed = 220) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        color,
        r: 2 + Math.random() * 3,
      });
    }
  }

  function update(dt) {
    const keep = [];
    for (const p of parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      keep.push(p);
    }
    if (parts.length > 600) parts = parts.slice(-400);
    parts = keep;
  }

  function draw(ctx) {
    for (const p of parts) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { burst, update, draw, get count() { return parts.length; } };
}
