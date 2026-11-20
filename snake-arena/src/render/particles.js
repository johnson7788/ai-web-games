// SNAKE ARENA · 粒子系统（数据雨 / 冲击波环 / 超频光屑），加法混合，纯 Canvas2D。
export function createParticles() {
  const list = [];

  function spawn(o) {
    if (list.length > 900) list.shift(); // 上限分档，保帧率
    list.push({
      x: o.x, y: o.y,
      vx: o.vx ?? 0, vy: o.vy ?? 0,
      life: o.life ?? 0.8, maxLife: o.life ?? 0.8,
      size: o.size ?? 3, color: o.color ?? '#fff',
      drag: o.drag ?? 0.92, gravity: o.gravity ?? 0,
      ring: o.ring ?? false,
    });
  }

  // 击杀瞬间：敌蛇光带碎成数据雨被吸走
  function burstData(x, y, color, count = 26) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 260;
      spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7 + Math.random() * 0.5, size: 2 + Math.random() * 3, color, drag: 0.9 });
    }
  }

  // 脉冲冲击波环
  function shockwave(x, y, color, radius) {
    spawn({ x, y, life: 0.5, size: radius, color, ring: true });
  }

  // 超频光屑（沿蛇身撒出的小火花）
  function shard(x, y, color) {
    const a = Math.random() * Math.PI * 2;
    spawn({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, life: 0.4, size: 2, color });
  }

  function eatPop(x, y, color) {
    for (let i = 0; i < 5; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 90;
      spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35, size: 1.5 + Math.random() * 2, color });
    }
  }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
    }
  }

  function draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of list) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a;
      if (p.ring) {
        const r = p.size * (1 - a * 0.2) + 20 * (1 - a);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * a + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.6, p.size * a), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  return { spawn, burstData, shockwave, shard, eatPop, update, draw, get count() { return list.length; } };
}
