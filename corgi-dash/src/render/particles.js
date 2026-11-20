// CORGI DASH · 粒子系统（纯 Canvas2D，无外部依赖）
// 种类：dust（落地尘土）/ spark（吃羊闪光）/ perfect（完美跳金色）/ surge（牧羊冲鸭浪涌）/ scatter（口哨散开）

export function createParticles() {
  let items = [];

  function burst(x, y, kind, n = 8) {
    for (let i = 0; i < n; i += 1) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 220;
      items.push({
        kind,
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        size: 2 + Math.random() * 4,
      });
    }
  }

  function surge(x, y) {
    for (let i = 0; i < 26; i += 1) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const sp = 160 + Math.random() * 420;
      items.push({
        kind: 'surge',
        x: x + (Math.random() - 0.5) * 120,
        y: y + (Math.random() - 0.5) * 40,
        vx: Math.cos(ang) * sp * 0.4 + 120,
        vy: Math.sin(ang) * sp,
        life: 0.6 + Math.random() * 0.6,
        maxLife: 1.2,
        size: 3 + Math.random() * 5,
      });
    }
  }

  function update(dt) {
    const next = [];
    for (const p of items) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind !== 'surge') p.vy += 300 * dt;
      next.push(p);
    }
    items = next;
  }

  function draw(ctx) {
    for (const p of items) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = a;
      if (p.kind === 'dust') {
        ctx.fillStyle = 'rgba(200,190,170,0.7)';
      } else if (p.kind === 'spark') {
        ctx.fillStyle = 'rgba(255,244,200,0.9)';
      } else if (p.kind === 'perfect') {
        ctx.fillStyle = 'rgba(255,210,90,0.95)';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  return { burst, surge, update, draw, get count() { return items.length; } };
}
