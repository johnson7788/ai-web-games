// COLOR FLUX · 粒子：过环迸溅 / 极光爆发全屏流彩 / 死亡碎光
import { WORLD, COLORS } from '../../config/gameplay.js';

const TAU = Math.PI * 2;
const CAP = 320;

function makeParticle() {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: 0, kind: 'spark' };
}

export function createParticles() {
  const pool = [];

  function spawn(kind, x, y, colorIdx) {
    if (pool.length >= CAP) pool.splice(0, pool.length - CAP + 20);
    for (let i = 0; i < (kind === 'burst' ? 60 : 14); i += 1) {
      const p = makeParticle();
      p.x = x;
      p.y = y;
      const a = Math.random() * TAU;
      const sp = (kind === 'burst' ? 120 : 60) + Math.random() * 220;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.maxLife = 0.5 + Math.random() * 0.6;
      p.life = p.maxLife;
      p.size = kind === 'burst' ? 3 + Math.random() * 4 : 1.5 + Math.random() * 2.5;
      p.color = colorIdx != null ? colorIdx : Math.floor(Math.random() * COLORS.length);
      p.kind = kind;
      pool.push(p);
    }
  }

  function burst(x, y, colorIdx) {
    spawn('burst', x, y, colorIdx);
  }

  function passFx(x, y, colorIdx) {
    spawn('spark', x, y, colorIdx);
  }

  function update(dt) {
    for (let i = pool.length - 1; i >= 0; i -= 1) {
      const p = pool[i];
      p.life -= dt;
      if (p.life <= 0) { pool.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
  }

  function draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of pool) {
      const t = p.life / p.maxLife;
      const c = COLORS[p.color];
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = c.hex;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  return { burst, passFx, update, draw, get count() { return pool.length; } };
}
