// WILDLAND RALLY · Canvas 2D 渲染（霓虹街机，程序化全原创）
// DPR ≤ 2；粒子分档；玩家最亮最粗（剪影清晰），敌人带红色「!」标记。
import { WORLD, LAYOUT, ENEMY } from '../../config/game.config.js';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(LAYOUT.DPR_MAX, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  canvas.style.width = `${WORLD.WIDTH}px`;
  canvas.style.height = `${WORLD.HEIGHT}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const particles = [];
  const MAX_PARTICLES = 360;
  const shake = { v: 0 };

  function spawn(x, y, color, n, speed = 160, life = 0.5, size = 3) {
    if (particles.length > MAX_PARTICLES) return;
    for (let i = 0; i < n; i += 1) {
      if (particles.length >= MAX_PARTICLES) break;
      const a = Math.random() * TAU;
      particles.push({ x, y, vx: Math.cos(a) * speed * (0.4 + Math.random() * 0.9), vy: Math.sin(a) * speed * (0.4 + Math.random() * 0.9), life, ttl: life, color, size: size * (0.6 + Math.random() * 0.8) });
    }
  }

  function grid() {
    ctx.strokeStyle = 'rgba(64, 220, 255, 0.06)';
    ctx.lineWidth = 1;
    const step = 48;
    for (let x = WORLD.MIN_X; x <= WORLD.MAX_X; x += step) {
      ctx.beginPath(); ctx.moveTo(x, WORLD.MIN_Y); ctx.lineTo(x, WORLD.MAX_Y); ctx.stroke();
    }
    for (let y = WORLD.MIN_Y; y <= WORLD.MAX_Y; y += step) {
      ctx.beginPath(); ctx.moveTo(WORLD.MIN_X, y); ctx.lineTo(WORLD.MAX_X, y); ctx.stroke();
    }
  }

  function arenaBorder() {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.strokeRect(WORLD.MIN_X - 6, WORLD.MIN_Y - 6, WORLD.MAX_X - WORLD.MIN_X + 12, WORLD.MAX_Y - WORLD.MIN_Y + 12);
    ctx.restore();
  }

  function drawRock(ro) {
    ctx.save();
    ctx.fillStyle = '#171225';
    ctx.strokeStyle = 'rgba(110, 100, 145, 0.4)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(80, 70, 120, 0.4)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    const n = 7;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * TAU;
      const rr = ro.r * (0.82 + 0.18 * Math.sin(ro.x + ro.y + i * 3.7));
      const px = ro.x + Math.cos(a) * rr;
      const py = ro.y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPickup(pk, t) {
    const colors = { heal: '#4dff88', shield: '#4da6ff', speed: '#ffd84d', magnet: '#ff4dd2' };
    const c = colors[pk.type] || '#fff';
    const pulse = 1 + 0.18 * Math.sin(t * 5 + pk.seed);
    const r = 11 * pulse;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = c;
    ctx.shadowBlur = 14;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, r * 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = { heal: '+', shield: '◈', speed: '»', magnet: 'U' }[pk.type] || '•';
    ctx.fillText(glyph, pk.x, pk.y + 1);
    ctx.restore();
  }

  function drawShip(x, y, radius, color, isPlayer, aimx, aimy, t, opts = {}) {
    const ang = Math.atan2(aimy, aimx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (isPlayer) {
      // 玩家：最亮最粗，白核 + 青辉光 + 外环
      ctx.strokeStyle = 'rgba(127, 252, 255, 0.9)';
      ctx.shadowColor = '#7ffcff';
      ctx.shadowBlur = 26;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(radius + 6, 0);
      ctx.lineTo(-radius * 0.7, radius * 0.8);
      ctx.lineTo(-radius * 0.3, 0);
      ctx.lineTo(-radius * 0.7, -radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#06e5ff';
      ctx.beginPath();
      ctx.arc(-radius * 0.08, 0, radius * 0.4, 0, TAU);
      ctx.fill();
    } else {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(radius + 3, 0);
      ctx.lineTo(-radius * 0.75, radius * 0.8);
      ctx.lineTo(-radius * 0.2, 0);
      ctx.lineTo(-radius * 0.75, -radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(radius * 0.15, 0, radius * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(e, t, px, py) {
    const c = e.color || ENEMY[e.type].color;
    const dx = px - e.x;
    const dy = py - e.y;
    const dl = Math.hypot(dx, dy) || 1;
    drawShip(e.x, e.y, e.radius, c, false, dx / dl, dy / dl, t);
    // 红色「!」标记（目标可见）
    const bob = Math.sin(t * 6 + e.id) * 2;
    const mx = e.x;
    const my = e.y - e.radius - 14 + bob;
    ctx.save();
    ctx.fillStyle = '#ff2d55';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, 6, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', mx, my + 0.5);
    ctx.restore();
    // 血条
    const w = e.radius * 2.2;
    const frac = Math.max(0, e.hp / e.maxHp);
    const bx = e.x - w / 2;
    const by = e.y - e.radius - 26;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx, by, w, 4);
    ctx.fillStyle = frac > 0.5 ? '#4dff88' : frac > 0.25 ? '#ffd84d' : '#ff2d55';
    ctx.fillRect(bx, by, w * frac, 4);
    ctx.restore();
    // 护盾环
    if (e.shield) {
      ctx.save();
      ctx.strokeStyle = '#4da6ff';
      ctx.shadowColor = '#4da6ff';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 6, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawProjectile(pr, t) {
    const isP = pr.from === 'player';
    ctx.save();
    ctx.shadowColor = isP ? '#7ffcff' : '#ff4d6d';
    ctx.shadowBlur = 10;
    ctx.fillStyle = isP ? '#b9fbff' : '#ff5d78';
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, isP ? 4 : 3.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 外部事件 → 粒子
  function feed(events) {
    for (const ev of events) {
      if (ev.type === 'hit') {
        const e = state_holder && state_holder.enemies.find((x) => x.id === ev.id);
        if (e) spawn(e.x, e.y, '#9ffcff', 5, 140, 0.3, 2);
      } else if (ev.type === 'dash') spawn(ev.x, ev.y, '#7ffcff', 14, 200, 0.4, 3);
      else if (ev.type === 'nova') spawn(ev.x, ev.y, '#ffb84d', 30, 300, 0.6, 4);
      else if (ev.type === 'kill') spawn(ev.x, ev.y, '#ffd84d', 16, 200, 0.5, 3);
      else if (ev.type === 'pickup') spawn(ev.x, ev.y, '#4dff88', 10, 140, 0.35, 2);
    }
  }

  let state_holder = null;
  function draw(state, dt, view) {
    if (state) state_holder = state;
    const t = state ? state.time : (view && view.clock) || 0;
    if (shake.v > 0) shake.v = Math.max(0, shake.v - dt * 22);
    const ox = shake.v ? (Math.random() - 0.5) * shake.v : 0;
    const oy = shake.v ? (Math.random() - 0.5) * shake.v : 0;

    ctx.save();
    ctx.translate(ox, oy);
    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    bg.addColorStop(0, '#0b0f22');
    bg.addColorStop(0.55, '#101536');
    bg.addColorStop(1, '#170f2c');
    ctx.fillStyle = bg;
    ctx.fillRect(-12, -12, WORLD.WIDTH + 24, WORLD.HEIGHT + 24);
    grid();
    arenaBorder();

    if (state) {
      for (const ro of state.rocks) drawRock(ro);
      for (const pk of state.pickups) drawPickup(pk, t);
      for (const e of state.enemies) if (e.hp > 0) drawEnemy(e, t);
      for (const pr of state.projectiles) drawProjectile(pr, t);
      const p = state.player;
      if (p.alive) {
        // 冲刺/加速拖尾
        if (p.invuln > 0 || p.speedT > 0) spawn(p.x, p.y, '#7ffcff', 1, 60, 0.3, 2);
        if (p.shieldT > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(77,166,255,0.9)';
          ctx.shadowColor = '#4da6ff';
          ctx.shadowBlur = 14;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 8, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
        drawShip(p.x, p.y, p.radius, '#7ffcff', true, p.aimx, p.aimy, t);
      }
    } else {
      // 标题屏：静态演示场景
      for (const ro of [{ x: 320, y: 200, r: 30 }, { x: 980, y: 430, r: 26 }, { x: 700, y: 140, r: 22 }]) drawRock(ro);
      drawShip(640, 330, 20, '#7ffcff', true, 1, 0, 0);
      drawShip(500, 250, 15, '#ff4d6d', false, -1, 0.4, 0);
      drawShip(800, 420, 15, '#ff9e3d', false, -1, -0.4, 0);
    }

    // 粒子
    for (const p of particles) {
      const a = Math.max(0, p.ttl / p.life);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 粒子生命推进（每帧衰减）
    for (const p of particles) { p.ttl -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; }
    particles.splice(0, Math.max(0, particles.length - MAX_PARTICLES));
    for (let i = particles.length - 1; i >= 0; i -= 1) if (particles[i].ttl <= 0) particles.splice(i, 1);
  }

  return { draw, feed, shake };
}
