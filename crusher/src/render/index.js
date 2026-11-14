// Canvas 2D 渲染：多面矿石（随损伤开裂）+ 血条/层级进度 + 破碎粒子/伤害浮字。
import { WORLD, OBJECT, COLORS } from '../../config/game.config.js';
import { TIERS } from '../../config/game.config.js';
import { tierIndex, tierProgress } from '../game/sim.js';
import { RULES } from '../../config/game.config.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 由 tier 决定的不规则多边形顶点（确定性）
function oreVertices(tier) {
  const n = 9;
  const pts = [];
  let s = (tier + 1) * 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = OBJECT.R * (0.82 + rnd() * 0.22);
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];
  const popups = [];
  let shakeT = 0;
  let shakeMag = 0;
  let pulse = 0;

  function burst(x, y, color, n = 18) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 320;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0.6 + Math.random() * 0.4, t: 0, color, size: 4 + Math.random() * 7, rot: Math.random() * Math.PI });
    }
  }
  function popup(text, x, y, color = COLORS.ink, big = false) {
    popups.push({ text, x, y, color, t: 0, life: big ? 1.0 : 0.7, big });
  }
  function shake(mag = 8) { shakeMag = Math.max(shakeMag, mag); shakeT = 0.22; }
  function hit() { pulse = 1; }
  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.vy += 620 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 4;
    }
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      popups[i].t += dt;
      if (popups[i].t >= popups[i].life) popups.splice(i, 1);
    }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt); else shakeMag = 0;
    pulse = Math.max(0, pulse - dt * 6);
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(OBJECT.CX, OBJECT.CY, 60, OBJECT.CX, OBJECT.CY, 760);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawObject(run, view) {
    const tier = tierIndex(run);
    const t = TIERS[tier];
    const dmg = 1 - Math.max(0, run.hp) / run.maxHp;
    const scale = 1 + pulse * 0.07;
    const pts = oreVertices(tier);
    ctx.save();
    ctx.translate(OBJECT.CX, OBJECT.CY);
    ctx.scale(scale, scale);
    // 光晕
    ctx.shadowColor = t.glow;
    ctx.shadowBlur = 40;
    const grad = ctx.createRadialGradient(-OBJECT.R * 0.3, -OBJECT.R * 0.3, 20, 0, 0, OBJECT.R * 1.1);
    grad.addColorStop(0, lighten(t.color, 0.3));
    grad.addColorStop(0.6, t.color);
    grad.addColorStop(1, t.glow);
    ctx.fillStyle = grad;
    ctx.beginPath();
    pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    //  facets
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < pts.length; i += 2) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(pts[i].x * 0.9, pts[i].y * 0.9);
      ctx.stroke();
    }
    // 裂纹（随损伤增多）
    const cracks = Math.floor(dmg * 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    let cs = (tier + 7) * 999;
    const crnd = () => { cs = (cs * 1103515245 + 12345) & 0x7fffffff; return cs / 0x7fffffff; };
    for (let i = 0; i < cracks; i += 1) {
      const a = crnd() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      let x = 0; let y = 0;
      for (let k = 0; k < 4; k += 1) {
        x += Math.cos(a + (crnd() - 0.5)) * OBJECT.R * 0.28;
        y += Math.sin(a + (crnd() - 0.5)) * OBJECT.R * 0.28;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 血条
    const bw = 320;
    const bx = OBJECT.CX - bw / 2;
    const by = OBJECT.CY + OBJECT.R + 34;
    ctx.fillStyle = COLORS.hpBack;
    roundRect(ctx, bx, by, bw, 20, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.hpFill;
    const frac = Math.max(0, run.hp) / run.maxHp;
    if (frac > 0) { roundRect(ctx, bx, by, bw * frac, 20, 10); ctx.fill(); }
    ctx.fillStyle = COLORS.ink;
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(Math.max(0, run.hp))} / ${run.maxHp}`, OBJECT.CX, by + 10);

    // 层级进度
    ctx.fillStyle = 'rgba(243,238,252,0.6)';
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(`${view.nextTierLabel || ''} ${tierProgress(run)}/${RULES.objectsPerTier}`, OBJECT.CX, by + 44);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function drawPopups() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of popups) {
      const k = p.t / p.life;
      const alpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `800 ${(p.big ? 40 : 26)}px ${FONT}`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y - k * 60);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function render(view) {
    const { run } = view;
    ctx.save();
    if (shakeT > 0 && shakeMag > 0) {
      const m = shakeMag * (shakeT / 0.22);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawBackground();
    if (run) drawObject(run, view);
    drawParticles();
    drawPopups();
    ctx.restore();
  }

  function clearEffects() {
    particles.length = 0;
    popups.length = 0;
    shakeT = 0;
    shakeMag = 0;
    pulse = 0;
  }

  return { render, update, burst, popup, shake, hit, clearEffects };
}

function lighten(hex, amt) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`;
}