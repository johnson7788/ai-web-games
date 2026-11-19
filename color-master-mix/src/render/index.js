// COLOR MASTER MIX · Canvas 2D 渲染（霓虹街机：暗底 + 发亮分格 + 粒子）
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { colorHex, luminance } from '../../config/colors.js';

const BOARD_W = WORLD.WIDTH - LAYOUT.PALETTE_W; // 920
const BOARD_CX = BOARD_W / 2;
const BOARD_CY = LAYOUT.HUD_H + (WORLD.HEIGHT - LAYOUT.HUD_H) / 2;

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
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
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let reducedMotion = false;
  const particles = [];
  let t = 0;

  function geometry(run) {
    const grid = run.level.grid;
    const cell = Math.min(
      (BOARD_W - LAYOUT.BOARD_MARGIN * 2) / grid,
      (WORLD.HEIGHT - LAYOUT.HUD_H - LAYOUT.BOARD_MARGIN * 2) / grid,
    );
    const ox = BOARD_CX - (grid * cell) / 2;
    const oy = BOARD_CY - (grid * cell) / 2;
    return { grid, cell, ox, oy };
  }

  function cellRect(run, region, g) {
    return {
      x: g.ox + region.c * g.cell,
      y: g.oy + region.r * g.cell,
      w: g.cell,
      h: g.cell,
    };
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0a0a1e');
    g.addColorStop(0.55, '#12122e');
    g.addColorStop(1, '#1b0f2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 暗网格
    ctx.strokeStyle = 'rgba(120, 90, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.WIDTH; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); }
    for (let y = 0; y <= WORLD.HEIGHT; y += 40) { ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); }
    ctx.stroke();
  }

  function drawRock(rect) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const s = rect.w * 0.2;
    ctx.strokeStyle = 'rgba(255, 130, 220, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s, cy);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(60, 50, 90, 0.9)';
    ctx.fill();
  }

  function drawShape(run, hoverId) {
    const g = geometry(run);
    for (const r of run.regions) {
      const rect = cellRect(run, r, g);
      const pad = 1.5;
      const x = rect.x + pad;
      const y = rect.y + pad;
      const w = rect.w - pad * 2;
      const h = rect.h - pad * 2;
      const rn = Math.max(3, w * 0.22);

      if (r.colored && r.color != null) {
        const hex = colorHex(r.color);
        // 霓虹光晕（大一圈低透明度）
        ctx.fillStyle = hex;
        ctx.globalAlpha = 0.32;
        roundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, rn + 1);
        ctx.fill();
        ctx.globalAlpha = 1;
        // 主体
        ctx.fillStyle = hex;
        roundRect(ctx, x, y, w, h, rn);
        ctx.fill();
        // 高光（亮色加一点顶部白边）
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        roundRect(ctx, x, y, w, h * 0.32, rn);
        ctx.fill();
      } else if (r.locked && !r.unlocked) {
        ctx.fillStyle = '#23233a';
        roundRect(ctx, x, y, w, h, rn);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 130, 220, 0.55)';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.5;
        roundRect(ctx, x, y, w, h, rn);
        ctx.stroke();
        ctx.setLineDash([]);
        drawRock({ x, y, w, h });
      } else {
        // 未上色（可涂）
        ctx.fillStyle = 'rgba(30, 30, 60, 0.9)';
        roundRect(ctx, x, y, w, h, rn);
        ctx.fill();
        ctx.strokeStyle = r.id === hoverId ? 'rgba(120, 255, 255, 0.95)' : 'rgba(110, 140, 255, 0.6)';
        ctx.lineWidth = r.id === hoverId ? 2.5 : 1.5;
        roundRect(ctx, x, y, w, h, rn);
        ctx.stroke();
        // 中心小点
        ctx.fillStyle = 'rgba(150, 170, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, Math.max(2, w * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawParticles(dt) {
    if (reducedMotion) { particles.length = 0; return; }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + 0.6 * (p.life / p.maxLife));
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      ctx.globalAlpha = 1;
    }
  }

  function spawn(region, color, count, power) {
    if (reducedMotion) return;
    const g = { cell: 0 };
    // 位置由调用方给出（世界坐标）
    for (let i = 0; i < count; i += 1) {
      if (particles.length > 140) break;
      const a = Math.random() * Math.PI * 2;
      const sp = power * (0.4 + Math.random() * 0.8);
      particles.push({
        x: region.px, y: region.py,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - power * 0.4,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 4 + Math.random() * 5,
        color,
      });
    }
  }

  function onEvent(e, run) {
    if (e.type === 'regionFill' || e.type === 'magicFill') {
      const r = run.regions[e.id];
      if (!r) return;
      const g = geometry(run);
      const rect = cellRect(run, r, g);
      spawn({ px: rect.x + rect.w / 2, py: rect.y + rect.h / 2 }, colorHex(e.color), e.type === 'magicFill' ? 18 : 8, e.type === 'magicFill' ? 90 : 60);
    } else if (e.type === 'rockUnlock') {
      const r = run.regions[e.id];
      if (!r) return;
      const g = geometry(run);
      const rect = cellRect(run, r, g);
      spawn({ px: rect.x + rect.w / 2, py: rect.y + rect.h / 2 }, '#ff82dc', 12, 70);
    } else if (e.type === 'win') {
      for (let i = 0; i < 40 && particles.length <= 140; i += 1) {
        particles.push({
          x: BOARD_CX + (Math.random() - 0.5) * 500,
          y: BOARD_CY + (Math.random() - 0.5) * 400,
          vx: (Math.random() - 0.5) * 160,
          vy: -60 - Math.random() * 120,
          life: 0.6 + Math.random() * 0.6,
          maxLife: 1.2,
          size: 5 + Math.random() * 6,
          color: colorHex(Math.floor(Math.random() * 64)),
        });
      }
    }
  }

  function render(run, phase, info = {}) {
    const dt = Math.min(info.dt || 0.016, 0.05);
    t += dt;
    drawBackground();
    if (run) drawShape(run, info.hoverId);
    drawParticles(dt);
  }

  return {
    render,
    onEvent,
    setReducedMotion(v) { reducedMotion = !!v; },
    geometry,
    cellRect,
    BOARD_CX,
    BOARD_CY,
    BOARD_W,
  };
}
