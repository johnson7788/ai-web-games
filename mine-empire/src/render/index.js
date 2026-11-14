// Canvas 2D 渲染：AI 背景铺底 + 矿井剖面（矿层/掘进面/矿石 sprite）+ 点击脉冲 + 金币浮字/碎石粒子。
// 玩法层（矿井几何 / 深度标尺 / 层名 / 判定）保留程序化；AI 只替换背景与矿石贴图。
import { WORLD, MINE, COLORS } from '../../config/game.config.js';
import { layerAt } from '../game/sim.js';
import { ART, art } from './art.js';

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

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const popups = [];
  const particles = [];
  let pulse = 0;

  function popup(text, x, y, color = COLORS.accent, big = false) {
    popups.push({ text, x, y, color, t: 0, life: big ? 1.0 : 0.8, big });
  }
  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.5 + Math.random() * 0.3, t: 0, color, size: 3 + Math.random() * 4 });
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
      p.vy += 480 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    pulse = Math.max(0, pulse - dt * 5);
  }

  function drawBackground() {
    const bg = art.img(ART.bg);
    if (bg) {
      ctx.drawImage(bg, 0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      return;
    }
    // 占位：程序化渐变铺底，不白屏
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(360, 360, 60, 360, 360, 800);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawOre(layer, faceY) {
    const entry = ART.ores[layer.id];
    const img = art.img(entry);
    const bandTop = faceY;
    const bandBottom = MINE.Y + MINE.H;
    const spots = [
      { fx: 0.3, fy: 0.62 },
      { fx: 0.5, fy: 0.42 },
      { fx: 0.7, fy: 0.58 },
    ];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of spots) {
      const x = MINE.X + MINE.W * s.fx;
      const y = bandTop + (bandBottom - bandTop) * s.fy;
      if (img) {
        // pivot=center：按 manifest 的 w/h 中心对齐
        ctx.drawImage(img, x - entry.w / 2, y - entry.h / 2, entry.w, entry.h);
      } else {
        // 占位色块（带名字）
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = layer.color;
        roundRect(ctx, x - 34, y - 34, 68, 68, 12);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.font = `700 13px ${FONT}`;
        ctx.fillText(layer.name.en, x, y);
      }
    }
  }

  function drawMine(run) {
    const layer = layerAt(run.depth);
    const faceY = MINE.Y + MINE.H * 0.55 + pulse * 8;
    // 矿柱背景（当前层颜色）
    ctx.fillStyle = layer.color;
    roundRect(ctx, MINE.X, MINE.Y, MINE.W, MINE.H, 14);
    ctx.fill();
    // 矿石 sprite（当前层矿石，替换原程序化白斑）
    ctx.save();
    roundRect(ctx, MINE.X, MINE.Y, MINE.W, MINE.H, 14);
    ctx.clip();
    drawOre(layer, faceY);
    ctx.restore();
    // 已挖隧道（上方暗色）
    ctx.fillStyle = '#0d0a07';
    ctx.fillRect(MINE.X + MINE.W * 0.2, MINE.Y, MINE.W * 0.6, faceY - MINE.Y);
    // 掘进面（锯齿）
    ctx.fillStyle = '#0d0a07';
    ctx.beginPath();
    ctx.moveTo(MINE.X + MINE.W * 0.2, faceY);
    const teeth = 8;
    for (let i = 0; i <= teeth; i += 1) {
      const x = MINE.X + MINE.W * 0.2 + (i / teeth) * MINE.W * 0.6;
      ctx.lineTo(x, faceY + (i % 2 === 0 ? 12 : -6));
    }
    ctx.lineTo(MINE.X + MINE.W * 0.8, faceY);
    ctx.closePath();
    ctx.fill();
    // 边框
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.lineWidth = 3;
    roundRect(ctx, MINE.X, MINE.Y, MINE.W, MINE.H, 14);
    ctx.stroke();
    // 深度标尺
    ctx.fillStyle = COLORS.ink;
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.floor(run.depth)} m`, MINE.X + MINE.W / 2, MINE.Y + 30);
    ctx.fillStyle = 'rgba(243,236,226,0.7)';
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(layer.name.en, MINE.X + MINE.W / 2, MINE.Y + MINE.H - 24);
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
      ctx.font = `800 ${(p.big ? 34 : 24)}px ${FONT}`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y - k * 55);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function drawLoading() {
    if (art.ready) return;
    const w = 200; const h = 6;
    const x = WORLD.WIDTH / 2 - w / 2; const y = WORLD.HEIGHT - 44;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x, y, w * art.progress, h);
  }

  function render(view) {
    const { run } = view;
    drawBackground();
    if (run) drawMine(run);
    drawParticles();
    drawPopups();
    drawLoading();
  }

  function clearEffects() { popups.length = 0; particles.length = 0; pulse = 0; }

  return { render, update, popup, burst, hit, clearEffects };
}
