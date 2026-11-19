// BRAIN CHECKUP · 程序化霓虹背景（Canvas 2D，零素材）
// 深色底 + 透视网格 + 浮动粒子 + 缓慢扫描线，营造「赛博诊所」氛围。
import { WORLD, GAME } from '../../config/game.config.js';

const PALETTE = {
  bgTop: '#070a14',
  bgBottom: '#0d1020',
  grid: 'rgba(56, 240, 255, 0.16)',
  gridGlow: 'rgba(56, 240, 255, 0.30)',
  scan: 'rgba(255, 90, 200, 0.05)',
  particles: ['#56f0ff', '#ff5ac8', '#ffd84e', '#9d7bff'],
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, GAME.DPR_MAX);
  let W = WORLD.WIDTH;
  let H = WORLD.HEIGHT;
  let particles = [];
  let t = 0;
  const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedParticles() {
    particles = [];
    const count = reduceMotion ? Math.floor(GAME.MAX_PARTICLES * 0.4) : GAME.MAX_PARTICLES;
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.6 + Math.random() * 1.8,
        s: 0.015 + Math.random() * 0.05,
        c: PALETTE.particles[(Math.random() * PALETTE.particles.length) | 0],
        a: 0.25 + Math.random() * 0.55,
      });
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PALETTE.bgTop);
    g.addColorStop(1, PALETTE.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    const gap = 56;
    const cx = W / 2;
    const horizon = H * 0.42;
    ctx.beginPath();
    for (let x = -W; x <= W * 2; x += gap) {
      ctx.moveTo(x, H);
      ctx.lineTo(cx + (x - cx) * 0.32, horizon);
    }
    for (let y = horizon; y <= H; y += gap * 0.6) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    // 近端一条亮线
    ctx.strokeStyle = PALETTE.gridGlow;
    ctx.beginPath();
    ctx.moveTo(0, H - 8);
    ctx.lineTo(W, H - 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawScanline() {
    if (reduceMotion) return;
    const y = ((t * 40) % (H + 200)) - 100;
    const g = ctx.createLinearGradient(0, y - 90, 0, y + 90);
    g.addColorStop(0, 'rgba(255,90,200,0)');
    g.addColorStop(0.5, PALETTE.scan);
    g.addColorStop(1, 'rgba(255,90,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 90, W, 180);
  }

  function drawParticles() {
    for (const p of particles) {
      const px = p.x * W;
      const py = p.y * H;
      const tw = 0.6 + 0.4 * Math.sin(t * 2 + p.x * 20);
      ctx.globalAlpha = p.a * tw;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (!reduceMotion) {
        p.y -= p.s * (1 / 60) * 60;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      }
    }
    ctx.globalAlpha = 1;
  }

  function draw(dt) {
    t += dt;
    drawBackground();
    drawGrid();
    drawParticles();
    drawScanline();
  }

  resize();
  seedParticles();
  window.addEventListener('resize', resize);

  return {
    draw,
    resize,
    debugLayout() {
      // 关卡内容在 DOM 里，布局矩形由 main.js 从 DOM 计算（tutorial 聚光用）
      return null;
    },
  };
}
