// src/render/index.js — IMPERIAL EXAM JOURNEY · Canvas 2D 渲染（手绘卡通·水墨纸卷）
// 背景/驿道/纸卷静态预渲染到离屏层；每帧只叠：残卷成语（缓存）+ 牛车 + 粒子。
import { WORLD } from '../../config/game.config.js';
import { renderErasedIdiom } from './erase.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

const ROAD = { x1: 96, y1: 640, x2: 1184, y2: 600, width: 46 };
const SCROLL = { x: 300, y: 130, w: 680, h: 340 };

function lerp(a, b, t) { return a + (b - a) * t; }

export function createRender(canvas) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    cacheId: -1,
    cacheCanvas: null,
    particles: [],
    lastRun: null,
  };

  const bg = buildBackground();

  function buildBackground() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');

    // 纸底
    g.fillStyle = '#f3ead7';
    g.fillRect(0, 0, W, H);

    // 远景水墨山（几层半透明）
    g.fillStyle = 'rgba(47, 111, 94, 0.16)';
    g.beginPath();
    g.moveTo(0, 300);
    g.quadraticCurveTo(180, 150, 380, 300);
    g.quadraticCurveTo(560, 130, 780, 300);
    g.quadraticCurveTo(980, 140, 1280, 300);
    g.lineTo(1280, 0);
    g.lineTo(0, 0);
    g.fill();
    g.fillStyle = 'rgba(181, 56, 44, 0.10)';
    g.beginPath();
    g.moveTo(0, 360);
    g.quadraticCurveTo(300, 240, 640, 360);
    g.quadraticCurveTo(940, 250, 1280, 360);
    g.lineTo(1280, 0);
    g.lineTo(0, 0);
    g.fill();

    // 地面
    g.fillStyle = '#e7d8b8';
    g.fillRect(0, 560, W, H - 560);
    g.fillStyle = 'rgba(200, 144, 42, 0.14)';
    g.fillRect(0, 600, W, H - 600);

    // 驿道
    g.strokeStyle = '#cbb684';
    g.lineWidth = ROAD.width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(ROAD.x1, ROAD.y1);
    g.quadraticCurveTo(640, 700, ROAD.x2, ROAD.y2);
    g.stroke();
    // 驿道中线虚线
    g.strokeStyle = 'rgba(181, 56, 44, 0.35)';
    g.lineWidth = 3;
    g.setLineDash([18, 16]);
    g.beginPath();
    g.moveTo(ROAD.x1, ROAD.y1);
    g.quadraticCurveTo(640, 700, ROAD.x2, ROAD.y2);
    g.stroke();
    g.setLineDash([]);

    // 驿站旗（沿路）
    for (let i = 0; i <= 4; i += 1) {
      const t = i / 4;
      const x = lerp(ROAD.x1, ROAD.x2, t);
      const y = lerp(ROAD.y1, ROAD.y2, t) - ROAD.width * 0.7;
      g.fillStyle = '#7c4a2a';
      g.fillRect(x - 3, y - 46, 6, 46);
      g.fillStyle = '#b5382c';
      g.beginPath();
      g.moveTo(x + 3, y - 46);
      g.lineTo(x + 34, y - 38);
      g.lineTo(x + 3, y - 30);
      g.closePath();
      g.fill();
    }

    // 中央纸卷
    roundRect(g, SCROLL.x, SCROLL.y, SCROLL.w, SCROLL.h, 18);
    g.fillStyle = '#f8f0dc';
    g.fill();
    g.strokeStyle = '#c8902a';
    g.lineWidth = 3;
    roundRect(g, SCROLL.x, SCROLL.y, SCROLL.w, SCROLL.h, 18);
    g.stroke();
    // 卷轴两端
    g.fillStyle = '#7c4a2a';
    roundRect(g, SCROLL.x - 16, SCROLL.y + 8, 14, SCROLL.h - 16, 7);
    g.fill();
    roundRect(g, SCROLL.x + SCROLL.w + 2, SCROLL.y + 8, 14, SCROLL.h - 16, 7);
    g.fill();
    // 印章
    g.fillStyle = '#b5382c';
    g.fillRect(SCROLL.x + SCROLL.w - 52, SCROLL.y + 16, 34, 34);
    g.fillStyle = '#f8f0dc';
    g.font = '700 15px "PingFang SC", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('印', SCROLL.x + SCROLL.w - 35, SCROLL.y + 34);

    return c;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function erasedCanvas(run) {
    const cur = run.current;
    if (!cur) return null;
    const id = cur.riddleId;
    if (state.cacheId !== id) {
      state.cacheId = id;
      state.cacheCanvas = renderErasedIdiom(cur.answer, {
        width: 600,
        height: 240,
        fontPx: 132,
        eraseRatio: cur.eraseRatio,
        seed: id,
      });
    }
    return state.cacheCanvas;
  }

  function drawCart(g, run) {
    const total = run._deck ? run._deck.length : 1;
    const t = Math.min(1, (run.riddlesSolved || 0) / Math.max(1, total));
    const x = lerp(ROAD.x1 + 20, ROAD.x2 - 40, t);
    const y = lerp(ROAD.y1, ROAD.y2, t) - 26;

    // 车轮
    g.fillStyle = '#7c4a2a';
    g.beginPath(); g.arc(x - 22, y + 18, 12, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x + 22, y + 18, 12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#cbb684';
    g.beginPath(); g.arc(x - 22, y + 18, 4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x + 22, y + 18, 4, 0, Math.PI * 2); g.fill();

    // 车斗
    g.fillStyle = '#a86f3a';
    roundRect(g, x - 30, y - 14, 60, 32, 8);
    g.fill();
    g.strokeStyle = '#7c4a2a';
    g.lineWidth = 2;
    roundRect(g, x - 30, y - 14, 60, 32, 8);
    g.stroke();

    // 书生（头 + 斗笠 + 青衫）
    g.fillStyle = '#2f6f5e';
    g.beginPath();
    g.moveTo(x - 8, y - 4);
    g.lineTo(x + 8, y - 4);
    g.lineTo(x + 4, y - 40);
    g.lineTo(x - 4, y - 40);
    g.closePath();
    g.fill();
    g.fillStyle = '#e8c39a';
    g.beginPath(); g.arc(x, y - 48, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2016';
    g.beginPath();
    g.moveTo(x - 15, y - 50);
    g.lineTo(x + 15, y - 50);
    g.lineTo(x, y - 62);
    g.closePath();
    g.fill();

    return { x, y };
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) { state.particles.splice(i, 1); continue; }
      p.vy += 260 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function drawParticles(g) {
    for (const p of state.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      g.globalAlpha = a;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function burst(x, y, type = 'correct') {
    if (reduced) return;
    const colors = type === 'waystation'
      ? ['#b5382c', '#c8902a', '#2f6f5e', '#ffd84e']
      : ['#ffd84e', '#c8902a', '#fff3c4'];
    for (let i = 0; i < 16; i += 1) {
      const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 90 + Math.random() * 140;
      state.particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 60,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        size: 3 + Math.random() * 4,
        color: colors[i % colors.length],
      });
    }
  }

  function draw(run, alpha) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bg, 0, 0);

    if (!run) return;

    // 残卷成语
    if (run.current) {
      const ec = erasedCanvas(run);
      if (ec) {
        ctx.drawImage(ec, SCROLL.x + 40, SCROLL.y + 50, SCROLL.w - 80, SCROLL.h - 100);
      }
      // 倒计时残影环
      const cur = run.current;
      if (!cur.resolved) {
        const rem = Math.max(0, cur.timer);
        const frac = rem / 15;
        ctx.strokeStyle = frac < 0.34 ? '#b5382c' : '#c8902a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(SCROLL.x + SCROLL.w - 44, SCROLL.y + 44, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
      }
    }

    drawCart(ctx, run);

    // 粒子
    if (!reduced) {
      updateParticles(1 / 60);
      drawParticles(ctx);
    }
  }

  function playerPos(run) {
    const total = run._deck ? run._deck.length : 1;
    const t = Math.min(1, (run.riddlesSolved || 0) / Math.max(1, total));
    return {
      x: lerp(ROAD.x1 + 20, ROAD.x2 - 40, t),
      y: lerp(ROAD.y1, ROAD.y2, t) - 26,
    };
  }

  return {
    draw,
    burst,
    playerPos,
    setLastRun(run) { state.lastRun = run; },
  };
}
