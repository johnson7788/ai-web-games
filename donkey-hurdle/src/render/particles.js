// src/render/particles.js — 轻量粒子：扬尘 / 陶罐碎片 / 金色弧线（signature）。
// 由 main.js 在事件分发时调用 burst(x, y, kind)。
export function createParticles() {
  const parts = [];

  function spawn(x, y, kind, n) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 220;
      let life = 0.4 + Math.random() * 0.5;
      let size = 3 + Math.random() * 4;
      let color;
      if (kind === 'dust') {
        color = 'rgba(231,192,138,0.9)';
        size = 4 + Math.random() * 5;
      } else if (kind === 'shard') {
        color = 'rgba(201,111,63,0.95)';
        size = 3 + Math.random() * 4;
        life = 0.5 + Math.random() * 0.4;
      } else if (kind === 'gold') {
        color = 'rgba(255,214,110,0.95)';
        size = 3 + Math.random() * 4;
      } else {
        color = 'rgba(255,255,240,0.9)';
      }
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life,
        maxLife: life,
        size,
        color,
        kind,
      });
    }
  }

  function goldArc(x, y) {
    // 满载连跳签名：身后划出一串金色弧线
    for (let i = 0; i < 14; i += 1) {
      const t = i / 14;
      const bx = x - 20 - t * 130;
      const by = y - 40 - Math.sin(t * Math.PI) * 90;
      parts.push({
        x: bx, y: by,
        vx: -40 - t * 80, vy: -30 + t * 50,
        life: 0.6, maxLife: 0.6,
        size: 4, color: 'rgba(255,214,110,0.9)', kind: 'gold',
      });
    }
  }

  function update(dt) {
    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'dust' ? 40 : 300) * dt;
      p.life -= dt;
    }
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (parts[i].life <= 0) parts.splice(i, 1);
    }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
  }

  function draw(ctx) {
    for (const p of parts) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { parts, spawn, goldArc, update, draw };
}
