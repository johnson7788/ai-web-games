// CANNON ECHO · 粒子系统：炮口闪光 / 命中火花 / 反弹涟漪 / 爆破碎片 / 回声波纹
export function createParticles() {
  const list = [];
  return {
    spawn(opts) {
      list.push({
        x: opts.x, y: opts.y,
        vx: opts.vx ?? 0, vy: opts.vy ?? 0,
        life: opts.life ?? 0.5, maxLife: opts.life ?? 0.5,
        size: opts.size ?? 4, color: opts.color ?? '#fff',
        kind: opts.kind ?? 'spark',
        gravity: opts.gravity ?? 0,
      });
    },
    burst(x, y, kind, accent = '#ffd98a') {
      const n = kind === 'break' ? 12 : kind === 'echo' ? 8 : 5;
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 220;
        this.spawn({
          x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.3 + Math.random() * 0.4,
          size: kind === 'echo' ? 3 : 2 + Math.random() * 3,
          color: kind === 'break' ? (Math.random() < 0.5 ? '#ffd98a' : '#fff0c0') : accent,
          kind,
          gravity: kind === 'break' ? 300 : 0,
        });
      }
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.life -= dt;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) list.splice(i, 1);
      }
    },
    draw(ctx) {
      for (const p of list) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        const s = p.size * (0.5 + a * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    get count() { return list.length; },
  };
}
