// EGG BOOM · 渲染装配：背景 + 道具 + 面团 + 子弹 + 蛋 + 粒子
import { WORLD } from '../../config/gameplay.js';
import { drawScene } from './scene.js';
import { themeOf } from './theme.js';
import { drawEgg } from './egg.js';
import { drawDough, drawBullet, drawProp } from './dough.js';
import { createParticles } from './particles.js';

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = createParticles();
  let lastTime = 0;
  let shake = 0;

  function draw(run, alpha = 1) {
    const now = performance.now();
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
    lastTime = now;

    const W = WORLD.WIDTH;
    const H = WORLD.HEIGHT;
    ctx.clearRect(0, 0, W, H);

    const scene = run ? run.scene : 'kitchen';
    const th = themeOf(scene);
    const time = run ? run.time : 0;

    drawScene(ctx, scene, time);

    // 震屏（壳碎/破团时小抖）
    ctx.save();
    if (shake > 0) {
      const s = shake * 6;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      shake = Math.max(0, shake - dt * 6);
    }

    if (run && run.phase !== 'dead' && run.phase !== 'won') {
      // 道具
      for (const p of run.props) drawProp(ctx, p, run, th, time);
      // 面团
      for (const d of run.doughs) drawDough(ctx, d, run, th);
      // 子弹
      for (const b of run.bullets) drawBullet(ctx, b, th);
      // 蛋
      drawEgg(ctx, run, th, time);
    } else if (run && run.phase === 'dead') {
      // 死时仍画蛋（碎蛋）
      drawDeadEgg(ctx, run, th);
    }

    // 粒子
    particles.update(dt);
    particles.draw(ctx);
    ctx.restore();
  }

  function drawDeadEgg(ctx, run, th) {
    ctx.save();
    ctx.translate(WORLD.EGG_X, run.egg.y);
    ctx.fillStyle = th.eggBody;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    // 裂纹
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -12); ctx.lineTo(-2, 0); ctx.lineTo(-12, 12);
    ctx.moveTo(2, -4); ctx.lineTo(10, -10);
    ctx.stroke();
    ctx.restore();
  }

  function burst(x, y, kind) {
    particles.burst(x, y, kind);
  }

  function shakeScreen() {
    shake = 1;
  }

  return { draw, burst, shakeScreen };
}
