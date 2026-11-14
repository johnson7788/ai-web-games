// Canvas 2D 渲染：AI 背景/keyart 铺底 + 中线分隔 + 获胜彩带。
// 玩法层（题干/选项/计分/计时/揭示）在 DOM，判定几何一律不在这里改。
import { WORLD, COLORS } from '../../config/game.config.js';
import { get as art } from './art.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];
  let phase = 'title';
  let loading = -1; // -1 完成；0..1 加载中

  function confetti(n = 60) {
    const palette = [COLORS.p1, COLORS.p2, COLORS.gold, COLORS.good];
    for (let i = 0; i < n; i += 1) {
      particles.push({
        x: Math.random() * WORLD.WIDTH, y: -20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160,
        life: 2.5 + Math.random(), t: 0, color: palette[i % palette.length],
        size: 5 + Math.random() * 6, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6,
      });
    }
  }
  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life || p.y > WORLD.HEIGHT + 30) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
  }

  function drawBackground() {
    const img = art('bg-arena');
    if (img) {
      ctx.drawImage(img, 0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    } else {
      // 占位：程序化渐变，不白屏
      const g = ctx.createRadialGradient(640, 200, 60, 640, 360, 900);
      g.addColorStop(0, COLORS.bgGlow);
      g.addColorStop(1, COLORS.bg);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
    if (phase === 'title') {
      const key = art('keyart-duo-quiz');
      if (key) ctx.drawImage(key, 0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
  }

  function drawLoading() {
    if (loading < 0) return;
    const w = 420;
    const h = 14;
    const x = (WORLD.WIDTH - w) / 2;
    const y = WORLD.HEIGHT - 90;
    ctx.fillStyle = 'rgba(10,14,24,0.6)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(x, y, w * Math.min(1, Math.max(0, loading)), h);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '600 16px "PingFang SC","Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOADING', WORLD.WIDTH / 2, y - 18);
  }

  function render() {
    drawBackground();
    if (phase === 'playing' || phase === 'paused' || phase === 'done') {
      // 中线分隔（玩法层视觉提示）
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(640, 160);
      ctx.lineTo(640, 700);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    drawLoading();
  }

  function setPhase(p) { phase = p; }
  function setLoading(v) { loading = v; }
  function clearEffects() { particles.length = 0; }

  return { render, update, confetti, clearEffects, setPhase, setLoading };
}
