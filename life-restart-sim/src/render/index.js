// 霓虹背景渲染（canvas 程序化）：网格 + 扫描线 + 漂浮粒子。
// 游戏内容（卡片/日志/HUD）全部走 DOM，canvas 只负责氛围底，避免文字裁切。
import { WORLD } from '../../config/game.config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  const particles = [];
  for (let i = 0; i < 70; i += 1) {
    particles.push({
      x: Math.random() * WORLD.WIDTH,
      y: Math.random() * WORLD.HEIGHT,
      r: 0.6 + Math.random() * 2.2,
      vy: 6 + Math.random() * 22,
      hue: [300, 190, 330, 45][i % 4],
    });
  }

  let t = 0;

  function draw(state, dt, view = {}) {
    t += dt || 0.016;

    // 背景渐变
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0b0518');
    g.addColorStop(0.55, '#120a2b');
    g.addColorStop(1, '#05030f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 地平线霓虹网格（透视）
    ctx.save();
    const horizon = WORLD.HEIGHT * 0.52;
    ctx.strokeStyle = 'rgba(90, 40, 160, 0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i += 1) {
      const y = horizon + Math.pow(i / 11, 1.7) * (WORLD.HEIGHT - horizon);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
    for (let i = -6; i <= 6; i += 1) {
      const x = WORLD.WIDTH / 2 + i * 110;
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.lineTo(WORLD.WIDTH / 2 + i * 300, WORLD.HEIGHT);
      ctx.stroke();
    }
    // 太阳/光晕
    const sun = ctx.createRadialGradient(WORLD.WIDTH / 2, horizon - 30, 4, WORLD.WIDTH / 2, horizon - 30, 260);
    sun.addColorStop(0, 'rgba(255, 60, 180, 0.55)');
    sun.addColorStop(0.4, 'rgba(90, 40, 200, 0.22)');
    sun.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(WORLD.WIDTH / 2 - 260, horizon - 300, 520, 560);
    ctx.restore();

    // 漂浮粒子
    for (const p of particles) {
      p.y -= p.vy * (dt || 0.016);
      if (p.y < -6) { p.y = WORLD.HEIGHT + 6; p.x = Math.random() * WORLD.WIDTH; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 62%, ${0.25 + 0.2 * Math.sin(t * 2 + p.x)})`;
      ctx.fill();
    }

    // 扫描线
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let y = 0; y < WORLD.HEIGHT; y += 4) ctx.fillRect(0, y, WORLD.WIDTH, 1);
    ctx.restore();
  }

  return { draw };
}
