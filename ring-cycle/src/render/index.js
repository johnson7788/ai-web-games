// src/render/index.js — createRender 装配：背景 + 彩环 + 糖球 + 粒子。
// 契约：createRender(canvas) → { draw(run, alpha), burst(x, y, kind, dye), rain(dye) }
import { WORLD, STEP } from '../../config/game.config.js';
import { bandIndexAt, sceneAt } from '../../config/levels.js';
import { drawScene } from './scene.js';
import { drawRing, drawBall, drawBallTrail } from './rings.js';
import { createParticles } from './particles.js';
import { sceneById } from './theme.js';

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const particles = createParticles();
  let lastRun = null;
  let lastScene = null;
  let rainbowFlash = 0; // 0..1 彩虹糖雨全屏脉冲
  let shake = 0;

  function sceneFor(run) {
    return sceneAt(bandIndexAt(run.ringsCleared || 0));
  }

  function draw(run, alpha = 1) {
    lastRun = run;
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 标题屏只画背景（无 run）
    if (!run) {
      drawScene(ctx, 'fruity', 0);
      return;
    }

    const scene = sceneFor(run);
    lastScene = scene;

    // 震屏（死亡/彩虹）
    ctx.save();
    if (shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.86;
    }

    drawScene(ctx, scene.id, run.depth);

    // 彩环（从下往上画，近的在下层）
    const rings = run.rings.slice().sort((a, b) => a.worldY - b.worldY);
    for (const ring of rings) drawRing(ctx, run, ring, sceneById(scene.id));

    drawBallTrail(ctx, run);
    drawBall(ctx, run, sceneById(scene.id));

    // 粒子
    particles.update(STEP);
    particles.draw(ctx);

    // 彩虹糖雨全屏脉冲
    if (rainbowFlash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${(rainbowFlash * 0.22).toFixed(3)})`;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      rainbowFlash *= 0.9;
    }

    ctx.restore();
  }

  return {
    draw,
    burst(x, y, kind, dye = 0) {
      particles.burst(x, y, kind, dye);
    },
    rain(dye = 0) {
      particles.rain(dye);
      rainbowFlash = 1;
    },
    shakeScreen(amount = 8) {
      shake = amount;
    },
    get scene() { return lastScene; },
    get run() { return lastRun; },
  };
}

export default createRender;
