// src/render/particles.js — 轻量粒子（气泡爆裂/洋流拖尾/撞击碎屑）
export function createParticles() {
  const parts = [];

  function spawn(kind, x, y) {
    const colors = {
      pop: ['#7df9e0', '#d9f4ff', '#ffffff'],
      gold: ['#ffd95e', '#ffe9a3', '#ffffff'],
      hit: ['#ff5d73', '#ffb199', '#ffffff'],
      boost: ['#6fd0ff', '#d9f4ff', '#ffffff'],
      spray: ['#bfeaff', '#ffffff', '#8fd8e8'],
    };
    const palette = colors[kind] || colors.pop;
    const n = kind === 'boost' ? 14 : 8;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 200;
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        r: 2 + Math.random() * 4,
        color: palette[(Math.random() * palette.length) | 0],
      });
    }
  }

  function tick(dt) {
    for (const p of parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
    }
    while (parts.length && parts[0].life <= 0) parts.shift();
    // 简单过滤（避免 while 误删后仍有过期粒子）
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (parts[i].life <= 0) parts.splice(i, 1);
    }
  }

  function draw(ctx) {
    for (const p of parts) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { spawn, tick, draw, get count() { return parts.length; } };
}
