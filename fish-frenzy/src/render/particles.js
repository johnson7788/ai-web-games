// FISH FRENZY · 粒子：网爆环 / 捕获火花 / 金币雨 / 电击闪 / 泡泡。
// 纯渲染层，不碰 sim 状态。
import { PARTICLE, NET_RING, clamp } from './theme.js';

export function createParticles() {
  let parts = [];

  function push(p) {
    if (parts.length >= PARTICLE.cap) parts.splice(0, parts.length - PARTICLE.cap);
    parts.push(p);
  }

  function burst(x, y, kind) {
    if (kind === 'catch') {
      for (let i = 0; i < 10; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 90 + Math.random() * 180;
        push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5, max: 0.5, size: 2 + Math.random() * 3, col: '#ffd166' });
      }
    } else if (kind === 'net') {
      push({ kind: 'ring', x, y, r: 10, life: 0.4, max: 0.4, col: NET_RING.color });
      for (let i = 0; i < 8; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 90;
        push({ kind: 'bubble', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.5, max: 0.5, size: 2 + Math.random() * 2, col: '#9feaff' });
      }
    } else if (kind === 'electric') {
      for (let i = 0; i < 26; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 120 + Math.random() * 260;
        push({ kind: 'bolt', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35, max: 0.35, size: 1.5 + Math.random() * 2, col: '#ffffff' });
      }
      push({ kind: 'ring', x, y, r: 20, life: 0.5, max: 0.5, col: 'rgba(255,255,255,0.9)' });
    } else if (kind === 'coin') {
      for (let i = 0; i < 16; i += 1) {
        push({ kind: 'coin', x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 40, vy: -160 - Math.random() * 120, life: 0.9, max: 0.9, size: 3, col: '#ffd166' });
      }
    }
  }

  function update(dt) {
    const next = [];
    for (const p of parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.kind === 'ring') { p.r += 420 * dt; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'coin') { p.vx *= 0.98; p.vy += 300 * dt; } // 金币雨受重力
      if (p.kind === 'bubble') p.vy -= 40 * dt;
      next.push(p);
    }
    parts = next;
  }

  function draw(ctx) {
    for (const p of parts) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.col;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'bolt') {
        ctx.strokeStyle = p.col;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
        ctx.stroke();
      } else if (p.kind === 'coin') {
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,110,20,0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  return { burst, update, draw, get count() { return parts.length; } };
}
