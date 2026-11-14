// Canvas 2D 渲染：AI 素材（深空背景 + 星球 sprite）叠上程序化玩法层
// （星空/点击脉冲/能量浮字/粒子）。素材缺失回退程序化渐变，不白屏。
import { WORLD, PLANET, COLORS } from '../../config/game.config.js';
import { currentPlanet } from '../game/sim.js';
import { ART, image, progress, drawSprite } from './art.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
// 土星 sprite 是「球 + 环」整体构图，放大让环半径仍 ≈ 原程序化的 R*1.5。
const PLANET_SCALE = { saturn: 1.5 };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const popups = [];
  const particles = [];
  let pulse = 0;
  // 固定星空
  const stars = [];
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < 120; i += 1) {
    stars.push({ x: rnd() * WORLD.WIDTH, y: rnd() * WORLD.HEIGHT, r: 0.5 + rnd() * 1.5, tw: rnd() * Math.PI * 2 });
  }

  function popup(text, x, y, color = COLORS.gold, big = false) {
    popups.push({ text, x, y, color, t: 0, life: big ? 1.1 : 0.8, big });
  }
  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, t: 0, color, size: 3 + Math.random() * 3 });
    }
  }
  function hit() { pulse = 1; }
  function update(dt) {
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      popups[i].t += dt;
      if (popups[i].t >= popups[i].life) popups.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    pulse = Math.max(0, pulse - dt * 5);
  }

  function drawBackground(now) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const bg = image(ART.bg);
    if (bg) {
      // 整幅铺底：cover 对齐 1280×720（crop 边缘，不变形）。
      const s = Math.max(WORLD.WIDTH / bg.width, WORLD.HEIGHT / bg.height);
      const w = bg.width * s;
      const h = bg.height * s;
      ctx.drawImage(bg, (WORLD.WIDTH - w) / 2, (WORLD.HEIGHT - h) / 2, w, h);
    } else {
      const g = ctx.createRadialGradient(PLANET.CX, PLANET.CY, 60, PLANET.CX, PLANET.CY, 800);
      g.addColorStop(0, COLORS.bgGlow);
      g.addColorStop(1, COLORS.bg);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
    // 星球背后一圈柔光，保证 sprite 在深空上可辨
    const glow = ctx.createRadialGradient(PLANET.CX, PLANET.CY, PLANET.R * 0.2, PLANET.CX, PLANET.CY, PLANET.R * 1.6);
    glow.addColorStop(0, 'rgba(16,26,48,0.5)');
    glow.addColorStop(1, 'rgba(16,26,48,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(PLANET.CX, PLANET.CY, PLANET.R * 1.6, 0, Math.PI * 2);
    ctx.fill();
    for (const st of stars) {
      const a = 0.4 + 0.4 * Math.sin(now / 800 + st.tw);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlanet(run) {
    const p = currentPlanet(run);
    const scale = 1 + pulse * 0.06;
    const R = PLANET.R * scale;
    const cx = PLANET.CX;
    const cy = PLANET.CY;
    // 光晕
    const glow = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R * 1.5);
    glow.addColorStop(0, hexA(p.glow, 0.55));
    glow.addColorStop(1, hexA(p.glow, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2);
    ctx.fill();

    const w = R * 2 * (PLANET_SCALE[p.id] || 1);
    if (drawSprite(ctx, ART.planets[p.id], cx, cy, w)) return;
    drawProceduralPlanet(p, R, cx, cy);
  }

  // 程序化兜底：原渐变球体 + 表面纹理 + 土星环（sprite 缺失时才走这里）。
  function drawProceduralPlanet(p, R, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = p.glow;
    ctx.shadowBlur = 50;
    const grad = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R);
    grad.addColorStop(0, lighten(p.color, 0.35));
    grad.addColorStop(0.6, p.color);
    grad.addColorStop(1, p.glow);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    let ss = (p.threshold + 1) * 999;
    const rr = () => { ss = (ss * 1103515245 + 12345) & 0x7fffffff; return ss / 0x7fffffff; };
    for (let i = 0; i < 8; i += 1) {
      const cx0 = (rr() - 0.5) * R * 1.6;
      const cy0 = (rr() - 0.5) * R * 1.6;
      const cr = R * (0.1 + rr() * 0.2);
      ctx.beginPath();
      ctx.arc(cx0, cy0, cr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (p.id === 'saturn') {
      ctx.strokeStyle = 'rgba(251,191,36,0.6)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.5, R * 0.4, -0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
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
      ctx.font = `800 ${(p.big ? 36 : 26)}px ${FONT}`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y - k * 60);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function drawLoading() {
    const p = progress();
    if (p >= 1) return;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(16, WORLD.HEIGHT - 12, 120, 4);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(16, WORLD.HEIGHT - 12, 120 * p, 4);
  }

  function render(view) {
    const { run, now } = view;
    drawBackground(now || 0);
    if (run) drawPlanet(run);
    drawParticles();
    drawPopups();
    drawLoading();
  }

  function clearEffects() { popups.length = 0; particles.length = 0; pulse = 0; }

  return { render, update, popup, burst, hit, clearEffects };
}

function lighten(hex, amt) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
