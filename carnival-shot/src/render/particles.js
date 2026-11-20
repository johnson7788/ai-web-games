// 粒子：命中火花 / 枪口闪光 / 孔明灯雨（签名时刻全场金光）。
// 纯渲染状态，不碰 sim。
import { PARTICLE, WORLD } from './theme.js';

const COLORS = {
  hit: ['#ffd166', '#fff3d6', '#ffb347'],
  gold: ['#ffd23f', '#fff6cf', '#ff9e3f'],
  ghost: ['#9bd0ff', '#c77dff', '#e8ecff'],
  muzzle: ['#fff3d6', '#ffd166'],
};

export function createParticles() {
  const parts = [];
  let rainActive = false;
  let rainAccum = 0;

  function spawn(x, y, kind, n) {
    const cols = COLORS[kind] || COLORS.hit;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.6,
        r: 1.5 + Math.random() * 3,
        color: cols[(Math.random() * cols.length) | 0],
        grav: 220,
      });
    }
    if (parts.length > PARTICLE.cap) parts.splice(0, parts.length - PARTICLE.cap);
  }

  function burst(x, y, kind) {
    const n = kind === 'ghost' ? 10 : kind === 'gold' ? 18 : PARTICLE.hit;
    spawn(x, y, kind === 'muzzle' ? 'muzzle' : kind, n);
  }

  function lanternRain() {
    rainActive = true;
    rainAccum = 0;
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (rainActive) {
      rainAccum += dt;
      if (rainAccum > PARTICLE.rainLife) rainActive = false;
      else if (parts.length < PARTICLE.cap) {
        // 顶部持续飘下金色纸灯
        for (let k = 0; k < 5; k += 1) {
          parts.push({
            x: Math.random() * WORLD.WIDTH,
            y: -10 - Math.random() * 40,
            vx: (Math.random() - 0.5) * 30,
            vy: 50 + Math.random() * 70,
            life: 2.4,
            maxLife: 2.6,
            r: 2 + Math.random() * 2.5,
            color: ['#ffd23f', '#ffedb0', '#ffb347'][(Math.random() * 3) | 0],
            grav: -6,
          });
        }
      }
    }
  }

  function draw(ctx, now) {
    for (const p of parts) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  return { burst, lanternRain, update, draw };
}
