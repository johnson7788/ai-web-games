// 粒子：spark 真空回吸轨迹（消费 run.sparks）、破墙爆散 / 海胆断尾 / 金珠 / Boss 爆散（burst）、气泡上升。
import { PARTICLE, WORLD } from './theme.js';

const TAU = Math.PI * 2;

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

export function createParticles(cap = PARTICLE.cap) {
  const parts = [];
  const bubbles = [];
  let bubbleAcc = 0;

  function spawn(p) {
    if (parts.length >= cap) parts.shift();
    parts.push(p);
  }

  function burst(x, y, kind) {
    const cfg = {
      pop:  { n: 14, color: ['#7df9ff', '#eaffff', '#3fd8ff'], speed: 220, life: 0.5, grav: 160, size: 3 },
      cut:  { n: 20, color: ['#ff3d5a', '#ffd166', '#ff8a5c'], speed: 260, life: 0.6, grav: 120, size: 3.4 },
      gold: { n: 16, color: ['#ffd166', '#fff3d6', '#ffb45f'], speed: 150, life: 0.8, grav: -20, size: 2.8 },
      boss: { n: 30, color: ['#ff3d2e', '#ff8a5c', '#ffd166', '#7a0d08'], speed: 300, life: 0.8, grav: 200, size: 4 },
    }[kind] || { n: 10, color: ['#ffffff'], speed: 180, life: 0.4, grav: 100, size: 3 };

    for (let i = 0; i < cfg.n; i += 1) {
      const a = Math.random() * TAU;
      const sp = cfg.speed * (0.4 + Math.random() * 0.8);
      spawn({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        grav: cfg.grav,
        life: cfg.life * (0.6 + Math.random() * 0.6),
        ttl: cfg.life,
        size: cfg.size * (0.6 + Math.random() * 0.8),
        color: cfg.color[(Math.random() * cfg.color.length) | 0],
        glow: true,
      });
    }
    if (kind === 'pop' || kind === 'cut' || kind === 'boss') {
      spawn({
        x, y, vx: 0, vy: 0, grav: 0,
        life: 0.35, ttl: 0.35,
        size: kind === 'boss' ? 90 : 60,
        color: kind === 'boss' ? '#ff5a3c' : '#7df9ff',
        ring: true,
      });
    }
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      if (p.ring) continue;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.max(0, 1 - 1.6 * dt);
    }
    // 气泡：底部持续升起
    bubbleAcc += dt * 4;
    while (bubbleAcc > 1) {
      bubbleAcc -= 1;
      if (bubbles.length < PARTICLE.bubbleMax) {
        bubbles.push({
          x: Math.random() * WORLD.WIDTH,
          y: WORLD.HEIGHT + 8,
          r: 1.5 + Math.random() * 3,
          vy: -PARTICLE.bubbleRise * (0.6 + Math.random() * 0.8),
          wob: Math.random() * TAU,
          alpha: 0.25 + Math.random() * 0.35,
        });
      }
    }
    for (let i = bubbles.length - 1; i >= 0; i -= 1) {
      const b = bubbles[i];
      b.y += b.vy * dt;
      if (b.y < -10) { bubbles.splice(i, 1); continue; }
    }
  }

  function draw(ctx, now) {
    // 发光粒子（加法）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      if (!p.glow) continue;
      const k = clamp01(p.life / p.ttl);
      if (p.ring) {
        const t = 1 - k;
        const rad = p.size * (0.25 + 0.75 * t);
        ctx.globalAlpha = (1 - t) * 0.7;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1 + 3 * (1 - t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // 气泡（普通混合，很淡）
    for (const b of bubbles) {
      const bobX = Math.sin(now * 0.002 + b.wob) * 3;
      ctx.globalAlpha = b.alpha;
      ctx.strokeStyle = 'rgba(190,230,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x + bobX, b.y, b.r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(190,230,255,0.15)';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 消费 sim 的 sparks（真空回吸）：发光点 + 沿速度方向短拖尾。
  function drawSimSparks(ctx, sparks, headX, headY) {
    if (!sparks || !sparks.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const s of sparks) {
      const a = clamp01(s.life);
      const n = Math.hypot(s.vx || 0, s.vy || 0) || 1;
      const dx = (s.vx || 0) / n;
      const dy = (s.vy || 0) / n;
      const len = Math.min(22, n * 0.08);
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = '#aef5ff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(s.x - dx * len, s.y - dy * len);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#eaffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  return { burst, update, draw, drawSimSparks, count: () => parts.length };
}
