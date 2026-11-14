// Canvas 2D 渲染：传送带 + 三站机器（瓶颈高亮）+ 流动大葱 + 手动收割大葱 + 金币浮字。
import { WORLD, BELT, HARVEST, COLORS, STATIONS } from '../../config/game.config.js';
import { stationRate, bottleneck, throughput } from '../game/sim.js';

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

function drawLeek(ctx, x, y, s) {
  // 白色根部
  ctx.fillStyle = '#f4fbe8';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.28, s * 0.2, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // 绿色叶
  ctx.strokeStyle = COLORS.leek;
  ctx.lineWidth = s * 0.14;
  ctx.lineCap = 'round';
  for (const dx of [-0.16, 0, 0.16]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * s * 0.4, y + s * 0.1);
    ctx.quadraticCurveTo(x + dx * s, y - s * 0.3, x + dx * s * 1.3, y - s * 0.55);
    ctx.stroke();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const popups = [];
  const particles = [];
  let beltOffset = 0;
  let pulse = 0;

  function popup(text, x, y, color = COLORS.gold, big = false) {
    popups.push({ text, x, y, color, t: 0, life: big ? 1.0 : 0.8, big });
  }
  function burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0.5 + Math.random() * 0.3, t: 0, color, size: 3 + Math.random() * 4 });
    }
  }
  function hit() { pulse = 1; }
  function update(dt, run) {
    const speed = run ? 40 + throughput(run) * 60 : 40;
    beltOffset = (beltOffset + speed * dt) % 64;
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      popups[i].t += dt;
      if (popups[i].t >= popups[i].life) popups.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.vy += 480 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    pulse = Math.max(0, pulse - dt * 5);
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(400, 300, 60, 400, 360, 880);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawBelt(run, view) {
    const bn = bottleneck(run);
    // 传送带
    ctx.fillStyle = COLORS.belt;
    roundRect(ctx, BELT.X, BELT.Y + 40, BELT.W, BELT.H - 40, 12);
    ctx.fill();
    ctx.strokeStyle = COLORS.beltEdge;
    ctx.lineWidth = 3;
    ctx.stroke();
    // 滚动纹理
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 4;
    for (let x = BELT.X - 64 + beltOffset; x < BELT.X + BELT.W; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, BELT.Y + 46);
      ctx.lineTo(x + 20, BELT.Y + BELT.H - 6);
      ctx.stroke();
    }
    // 流动大葱
    for (let x = BELT.X - 64 + beltOffset; x < BELT.X + BELT.W + 32; x += 64) {
      if (x < BELT.X + 12 || x > BELT.X + BELT.W - 12) continue;
      drawLeek(ctx, x, BELT.Y + 78, 30);
    }
    // 三站机器
    const lang = view.lang || 'en';
    STATIONS.forEach((s, i) => {
      const cx = BELT.X + (i + 0.5) * BELT.W / 3;
      const mw = 150;
      const mx = cx - mw / 2;
      const my = BELT.Y - 64;
      const isBn = s.id === bn;
      ctx.fillStyle = COLORS.panel;
      roundRect(ctx, mx, my, mw, 96, 12);
      ctx.fill();
      ctx.strokeStyle = isBn ? COLORS.danger : s.color;
      ctx.lineWidth = isBn ? 4 : 2;
      ctx.stroke();
      ctx.fillStyle = s.color;
      ctx.font = `800 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.name[lang] || s.name.en, cx, my + 24);
      ctx.fillStyle = COLORS.ink;
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText(`${view.levelLabel || 'Lv'}${run.levels[s.id]} · ${stationRate(run, s.id).toFixed(1)}/s`, cx, my + 50);
      if (isBn) {
        ctx.fillStyle = COLORS.danger;
        ctx.font = `800 13px ${FONT}`;
        ctx.fillText(view.bottleneckLabel || 'Bottleneck', cx, my + 76);
      }
      // 连接柱
      ctx.strokeStyle = COLORS.beltEdge;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx, my + 96);
      ctx.lineTo(cx, BELT.Y + 40);
      ctx.stroke();
    });
  }

  function drawHarvest(run, view) {
    const scale = 1 + pulse * 0.08;
    ctx.save();
    ctx.translate(HARVEST.CX, HARVEST.CY);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(74,222,128,0.1)';
    ctx.beginPath();
    ctx.arc(0, 0, HARVEST.R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    drawLeek(ctx, 0, 10, HARVEST.R * 0.9);
    ctx.restore();
    ctx.fillStyle = COLORS.accent;
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(view.harvestLabel || 'Harvest', HARVEST.CX, HARVEST.CY + HARVEST.R + 28);
    ctx.fillStyle = 'rgba(238,246,238,0.6)';
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(view.clickHint || '', HARVEST.CX, HARVEST.CY + HARVEST.R + 52);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      roundRect(ctx, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, 1.5);
      ctx.fill();
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
      ctx.font = `800 ${(p.big ? 34 : 24)}px ${FONT}`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y - k * 50);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function render(view) {
    const { run } = view;
    drawBackground();
    if (run) {
      drawBelt(run, view);
      drawHarvest(run, view);
    }
    drawParticles();
    drawPopups();
  }

  function clearEffects() {
    popups.length = 0;
    particles.length = 0;
    pulse = 0;
  }

  return { render, update, popup, burst, hit, clearEffects };
}