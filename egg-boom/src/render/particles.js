// EGG BOOM · 粒子（彩带 / 溅射 / 破团碎屑）
export function createParticles() {
  const list = [];

  function burst(x, y, kind) {
    const n = kind === 'confetti' ? 26 : kind === 'yolk' ? 18 : 10;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const sp = 120 + Math.random() * 260;
      list.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 0.5 + Math.random() * 0.5,
        age: 0,
        size: kind === 'confetti' ? 4 + Math.random() * 4 : 2 + Math.random() * 3,
        kind,
        hue: kind === 'confetti' ? pickHue() : null,
      });
    }
    if (list.length > 300) list.splice(0, list.length - 300);
  }

  function pickHue() {
    const hues = [14, 30, 48, 210, 280, 330, 120];
    return hues[Math.floor(Math.random() * hues.length)];
  }

  function update(dt) {
    for (const p of list) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 700 * dt;
      if (p.kind === 'confetti') p.vx *= 0.96;
    }
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].age >= list[i].life) list.splice(i, 1);
    }
  }

  function draw(ctx) {
    for (const p of list) {
      const t = p.age / p.life;
      ctx.globalAlpha = 1 - t;
      if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.age * 9);
        ctx.fillStyle = `hsl(${p.hue}, 80%, 60%)`;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.kind === 'yolk') {
        ctx.fillStyle = '#ffcf4d';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(240,230,205,0.9)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  return { list, burst, update, draw };
}
