// MY PLANET GROW · Canvas 渲染（程序化低多边形扁平太空，零素材零外链）
import { WORLD, GAME } from '../../config/game.config.js';
import { mulberry32 } from '../game/sim.js';

const TIER_COLORS = [
  ['#4ade80', '#16a34a'], // 0 岩石星球（青绿）
  ['#38bdf8', '#0369a1'], // 1 海洋星球（蓝）
  ['#a78bfa', '#6d28d9'], // 2 气态星球（紫）
  ['#fb923c', '#c2410c'], // 3 熔岩星球（橙）
  ['#facc15', '#ca8a04'], // 4 恒星（金）
];

const TIER_RING = ['#86efac', '#7dd3fc', '#c4b5fd', '#fdba74', '#fde047'];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const rng = mulberry32(20241120);
  const stars = [];
  for (let i = 0; i < 130; i += 1) {
    stars.push({
      x: rng() * WORLD.WIDTH,
      y: rng() * WORLD.HEIGHT,
      r: 0.6 + rng() * 1.6,
      phase: rng() * Math.PI * 2,
      speed: 0.6 + rng() * 1.6,
      hue: rng() < 0.2 ? 'warm' : 'cool',
    });
  }

  function drawStarfield(time) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0b1030');
    g.addColorStop(0.55, '#131a42');
    g.addColorStop(1, '#1d1140');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    for (const s of stars) {
      const tw = 0.55 + 0.45 * Math.sin(time * s.speed + s.phase);
      ctx.globalAlpha = 0.35 + 0.6 * tw;
      ctx.fillStyle = s.hue === 'warm' ? '#ffd9a0' : '#cdd9ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 低多边形星球：径向渐变底 + 几片切面 + 高光环
  function drawPlanet(x, y, r, tier, time) {
    const [c1, c2] = TIER_COLORS[tier] || TIER_COLORS[0];
    // 外发光
    ctx.globalAlpha = 0.35;
    const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.6);
    glow.addColorStop(0, c1);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 主体
    const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.15, x, y, r);
    body.addColorStop(0, c1);
    body.addColorStop(1, c2);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // 低多边形切面
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    const n = 6;
    for (let i = 0; i < n; i += 1) {
      const a0 = (i / n) * Math.PI * 2 + time * 0.06;
      const a1 = ((i + 0.45) / n) * Math.PI * 2 + time * 0.06;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
      ctx.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r);
      ctx.closePath();
      ctx.stroke();
    }
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.32, y - r * 0.38, r * 0.26, r * 0.16, -0.6, 0, Math.PI * 2);
    ctx.fill();

    // 进化环
    if (tier > 0) {
      ctx.strokeStyle = TIER_RING[tier] || '#fff';
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawMeteor(e, time) {
    const { x, y, r } = e;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, '#fff7ed');
    g.addColorStop(1, '#f97316');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // 火尾
    ctx.strokeStyle = 'rgba(251,146,60,0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y - r - 16 - Math.sin(time * 6 + e.spin) * 5);
    ctx.stroke();
  }

  function drawGold(e, time) {
    const { x, y, r } = e;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 菱形黄金流星
    const a = time * 1.5 + e.spin;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const ang = a + (i * Math.PI) / 2;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r * 0.8;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawShield(e, time) {
    const { x, y, r } = e;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 六边形护盾
    ctx.fillStyle = '#93c5fd';
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#dbeafe';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#eff6ff';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHole(e, time) {
    const { x, y, r } = e;
    // 紫色吸积环（旋转虚线）
    ctx.strokeStyle = 'rgba(192,132,252,0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // 主体黑洞
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, '#000000');
    g.addColorStop(0.75, '#1e1033');
    g.addColorStop(1, '#4c1d95');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // 事件视界高光
    ctx.strokeStyle = 'rgba(233,213,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r - 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPlayerMarker(x, y, r, time) {
    // 脉冲白环标识玩家
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.strokeStyle = `rgba(255,255,255,${0.45 + 0.35 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    // 上方箭头
    const ay = y - r - 18 + Math.sin(time * 4) * 3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, ay + 8);
    ctx.lineTo(x - 8, ay);
    ctx.lineTo(x + 8, ay);
    ctx.closePath();
    ctx.fill();
  }

  function drawShieldBubble(p, time) {
    ctx.strokeStyle = 'rgba(147,197,253,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = time * 24;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawParticles(view, dt) {
    for (const f of view.fxQueue) {
      const k = 1 - f.ttl / f.max;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (0.5 + k * 1.2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawComboPopup(view) {
    const c = view.comboPopup;
    if (!c) return;
    const k = 1 - c.ttl / c.max;
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.fillStyle = '#ffe08a';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.text, c.x, c.y - k * 34);
    ctx.globalAlpha = 1;
  }

  function drawTitleScene(time, best, tierHint) {
    drawStarfield(time);
    // 中心大星球
    const bigR = 120;
    const cx = WORLD.WIDTH / 2;
    const cy = WORLD.HEIGHT / 2 + 14;
    drawPlanet(cx, cy, bigR, tierHint ?? 2, time);
    // 环绕的小流星
    for (let i = 0; i < 5; i += 1) {
      const a = time * 0.5 + (i / 5) * Math.PI * 2;
      const ox = cx + Math.cos(a) * 190;
      const oy = cy + Math.sin(a) * 82;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#7ef0e0';
      ctx.beginPath();
      ctx.arc(ox, oy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  return {
    draw(state, dt, view) {
      const time = view.time || 0;
      ctx.save();
      if (view.shake > 0) {
        ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
      }
      if (!state) {
        // 标题屏：太空 + 大星球 + 环绕流星
        drawTitleScene(time, 0, 2);
      } else if (state.phase === 'over') {
        // 结算屏背后仍画太空 + 星球
        drawStarfield(time);
        if (state.planet) {
          drawPlanet(state.planet.x, state.planet.y, state.planet.r * 0.9, state.planet.tier, time);
        }
      } else {
        drawStarfield(time);
        for (const e of state.entities) {
          if (e.type === 'hole') drawHole(e, time);
          else if (e.type === 'gold') drawGold(e, time);
          else if (e.type === 'shield') drawShield(e, time);
          else drawMeteor(e, time);
        }
        const p = state.planet;
        if (state.shields > 0) drawShieldBubble(p, time);
        drawPlanet(p.x, p.y, p.r, p.tier, time);
        drawPlayerMarker(p.x, p.y, p.r, time);
      }
      drawParticles(view, dt);
      drawComboPopup(view);
      ctx.restore();
    },

    drawMenu(time, tierHint) {
      drawTitleScene(time, 0, tierHint);
    },
  };
}
