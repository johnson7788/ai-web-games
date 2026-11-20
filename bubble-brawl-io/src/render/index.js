// BUBBLE BRAWL IO · Canvas 2D 霓虹渲染（程序化，零素材零外链）
import { WORLD } from '../../config/game.config.js';

const COL = {
  bg: '#0a0618',
  grid: 'rgba(80, 60, 160, 0.10)',
  outer: '#22d3ee',
  inner: '#e879f9',
  coreA: '#fbbf24',
  coreB: '#f97316',
  turret: '#4ade80',
  bubble: '#67e8f9',
  spike: '#fb7185',
  rock: '#a78bfa',
  text: '#e0e7ff',
};

const reduceMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const particles = [];
  let shake = 0;

  function burst(x, y, color, n = 8, speed = 180) {
    if (reduceMotion()) return;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.3, max: 0.8, color, r: 2 + Math.random() * 3 });
    }
  }

  function glow(x, y, r, color, alpha = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBackground() {
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.WIDTH; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= WORLD.HEIGHT; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
    }
    // 中央垂直瞄准基线
    ctx.strokeStyle = 'rgba(120, 100, 220, 0.12)';
    ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.moveTo(WORLD.CX, WORLD.HEIGHT); ctx.lineTo(WORLD.CX, 0); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawRing(ring, color) {
    const half = ring.gapArc / 2;
    // 实心部分 = 整圆减去两个对向缺口
    const segs = [
      [ring.angle + half, ring.angle + Math.PI - half],
      [ring.angle + Math.PI + half, ring.angle + Math.PI * 2 - half],
    ];
    ctx.lineWidth = WORLD.RING_BAND;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75;
    for (const [a, b] of segs) {
      ctx.beginPath();
      ctx.arc(WORLD.CX, WORLD.RING_CY, ring.radius, a, b);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 缺口高亮边
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    for (const g of [ring.angle, ring.angle + Math.PI]) {
      const a0 = g - half;
      const a1 = g + half;
      ctx.beginPath();
      ctx.arc(WORLD.CX, WORLD.RING_CY, ring.radius, a0, a1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCore(state) {
    const { CORE_CX: cx, CORE_CY: cy, CORE_R: R } = WORLD;
    const pct = state ? state.core.hp / state.core.maxHp : 1;
    glow(cx, cy, R * 2.4, 'rgba(251, 146, 60, 0.25)');
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    g.addColorStop(0, COL.coreA);
    g.addColorStop(1, COL.coreB);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    // HP 弧
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(cx, cy, R + 10, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = pct > 0.5 ? COL.turret : pct > 0.25 ? COL.coreA : COL.spike;
    ctx.beginPath(); ctx.arc(cx, cy, R + 10, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2); ctx.stroke();
  }

  function drawRocks(state) {
    for (const rock of state.rocks) {
      if (!rock.alive) continue;
      const x = WORLD.CX + Math.cos(rock.angle) * rock.radius;
      const y = WORLD.CORE_CY + Math.sin(rock.angle) * rock.radius;
      glow(x, y, rock.r * 2, 'rgba(167, 139, 250, 0.35)');
      ctx.fillStyle = COL.rock;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const rr = rock.r * (i % 2 === 0 ? 1 : 0.72);
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawSpikes(state) {
    for (const s of state.spikes) {
      glow(s.x, s.y, s.r * 2, 'rgba(251, 113, 133, 0.3)');
      ctx.fillStyle = COL.spike;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + s.r);
      ctx.lineTo(s.x - s.r, s.y - s.r);
      ctx.lineTo(s.x + s.r, s.y - s.r);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBubbles(state) {
    for (const b of state.bubbles) {
      const dir = b.vy < 0 ? -1 : 1;
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + dir * b.r);
      ctx.lineTo(b.x, b.y + dir * (b.r + 18));
      ctx.stroke();
      glow(b.x, b.y, b.r * 2.4, 'rgba(103, 232, 249, 0.5)');
      ctx.fillStyle = COL.bubble;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTurret(state) {
    const t = state.turret;
    const y = WORLD.TURRET_Y;
    glow(t.x, y, 30, 'rgba(74, 222, 128, 0.4)');
    ctx.fillStyle = COL.turret;
    ctx.beginPath();
    ctx.moveTo(t.x, y - 22);
    ctx.lineTo(t.x - 18, y + 14);
    ctx.lineTo(t.x + 18, y + 14);
    ctx.closePath();
    ctx.fill();
    // 炮口
    ctx.fillStyle = '#a7f3d0';
    ctx.fillRect(t.x - 6, y - 30, 12, 12);
    // 底座
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(WORLD.TURRET_MIN_X, y + 22); ctx.lineTo(WORLD.TURRET_MAX_X, y + 22); ctx.stroke();
  }

  function drawParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 300) particles.splice(0, particles.length - 300);
  }

  function applyEvents(events) {
    for (const e of events) {
      switch (e.type) {
        case 'hit': burst(WORLD.CORE_CX, WORLD.CORE_CY + WORLD.CORE_R, COL.coreA, 8, 200); break;
        case 'crit': burst(WORLD.CORE_CX, WORLD.CORE_CY + WORLD.CORE_R, '#fde047', 16, 260); shake = Math.max(shake, 3); break;
        case 'gap': burst(WORLD.CX, WORLD.RING_CY, '#a5f3fc', 4, 120); break;
        case 'bounce': burst(e.x ?? WORLD.CX, e.y ?? WORLD.RING_CY + 200, COL.bubble, 5, 140); break;
        case 'rock': burst(e.x ?? WORLD.CX, e.y ?? WORLD.CORE_CY, COL.rock, 8, 180); break;
        case 'hurt': shake = Math.max(shake, 9); burst(WORLD.CX, WORLD.TURRET_Y, COL.spike, 12, 240); break;
        case 'win': burst(WORLD.CORE_CX, WORLD.CORE_CY, COL.coreA, 30, 320); shake = Math.max(shake, 8); break;
        case 'lose': shake = Math.max(shake, 8); break;
        case 'spike': burst(e.x ?? WORLD.CX, WORLD.CORE_CY + WORLD.CORE_R, COL.spike, 3, 90); break;
        case 'dodge': burst(e.x ?? WORLD.CX, WORLD.TURRET_Y - 10, '#ffffff', 3, 90); break;
        default: break;
      }
    }
  }

  return {
    render(state, dt = 1 / 60, events = []) {
      applyEvents(events);
      ctx.save();
      if (shake > 0 && !reduceMotion()) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake *= 0.86;
        if (shake < 0.3) shake = 0;
      }
      drawBackground();
      if (state) {
        drawCore(state);
        drawRocks(state);
        for (let i = 0; i < state.rings.length; i += 1) {
          drawRing(state.rings[i], i === 0 ? COL.outer : COL.inner);
        }
        drawSpikes(state);
        drawBubbles(state);
        drawTurret(state);
      }
      drawParticles(dt);
      ctx.restore();
    },
    burst,
  };
}
