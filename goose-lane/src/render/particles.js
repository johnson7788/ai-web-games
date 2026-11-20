// src/render/particles.js — 轻量粒子：宝石火花 / 气球爆裂 / 丝滑换乘白鸽。
export function createParticles() {
  const list = [];       // { x, y, vx, vy, life, maxLife, color, size, kind }
  const doves = [];      // { x, y, t }

  function burst(x, y, color, n = 10, speed = 180) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.9);
      list.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.35,
        color,
        size: 2 + Math.random() * 3,
        kind: 'spark',
      });
    }
  }

  function dove(x, y) {
    doves.push({ x, y, t: 0 });
  }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      p.life += dt;
      if (p.life >= p.maxLife) { list.splice(i, 1); continue; }
      p.vy += 320 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = doves.length - 1; i >= 0; i -= 1) {
      const d = doves[i];
      d.t += dt;
      d.x += 260 * dt;
      d.y -= 60 * dt;
      if (d.t > 1.6 || d.x > 1400) doves.splice(i, 1);
    }
  }

  function draw(ctx) {
    for (const p of list) {
      const k = 1 - p.life / p.maxLife;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const d of doves) {
      const t = d.t;
      const alpha = t < 0.2 ? t / 0.2 : (t > 1.2 ? Math.max(0, (1.6 - t) / 0.4) : 1);
      ctx.globalAlpha = alpha;
      drawDove(ctx, d.x, d.y, t);
    }
    ctx.globalAlpha = 1;
  }

  return { burst, dove, update, draw, get count() { return list.length + doves.length; } };
}

function drawDove(ctx, x, y, t) {
  const flap = Math.sin(t * 22) * 12;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  // 身体
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 翅膀（上下扇）
  ctx.beginPath();
  ctx.moveTo(-2, -2);
  ctx.quadraticCurveTo(-12, -14 - flap, -26, -6 - flap);
  ctx.quadraticCurveTo(-14, -2, -2, 1);
  ctx.fill();
  // 尾
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(24, -4);
  ctx.lineTo(22, 2);
  ctx.closePath();
  ctx.fill();
  // 眼
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath();
  ctx.arc(-8, -1, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
