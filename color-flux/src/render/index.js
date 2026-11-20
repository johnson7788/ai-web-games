// COLOR FLUX · createRender 装配：场景 → 障碍 → 萤 → 粒子 → 极光爆发
import { WORLD, BALL, COLORS } from '../../config/gameplay.js';
import { DPR_CAP, SCENE_FADE_SEC, blendScene, clamp } from './theme.js';
import { drawScene } from './scene.js';
import { drawObstacle } from './obstacles.js';
import { drawBall } from './ball.js';
import { createParticles } from './particles.js';

const TAU = Math.PI * 2;

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const particles = createParticles();

  let sceneFrom = 0;
  let sceneTo = 0;
  let sceneFadeT = 1;
  let burstUntil = -1e9;
  let lastNow = 0;

  function resize() {
    const dpr = clamp(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1, DPR_CAP);
    const cssW = canvas.clientWidth || WORLD.WIDTH;
    const cssH = canvas.clientHeight || WORLD.HEIGHT;
    const scale = Math.min(cssW / WORLD.WIDTH, cssH / WORLD.HEIGHT);
    const ox = (cssW - WORLD.WIDTH * scale) / 2;
    const oy = (cssH - WORLD.HEIGHT * scale) / 2;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  }

  function setScene(si) {
    const s = clamp(Math.round(si) || 0, 0, 2);
    if (s === sceneTo) return;
    sceneFrom = sceneTo;
    sceneTo = s;
    sceneFadeT = 0;
  }

  function triggerBurst() {
    burstUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 1500;
  }

  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;
    const ip = typeof interp === 'number' ? clamp(interp, 0, 1) : 1;

    particles.update(dt);

    // 场景包切换
    if (run) {
      const hud = typeof run.getHud === 'function' ? run.getHud() : null;
      const s = hud && typeof hud.scene === 'number' ? hud.scene : (run.scene || 0);
      if (s !== sceneTo) setScene(s);
      sceneFadeT = Math.min(1, sceneFadeT + dt / SCENE_FADE_SEC);
      if (sceneFadeT >= 1) { sceneFadeT = 1; sceneFrom = sceneTo; }
    }

    // 清屏
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    drawScene(ctx, { sceneFrom, sceneTo, fadeT: sceneFadeT, now });
    const pal = blendScene(sceneFrom, sceneTo, sceneFadeT);

    if (run) {
      const hud = typeof run.getHud === 'function' ? run.getHud() : null;

      // 垂直航线（萤的飞行路径，连接球与环带，提示目标）
      drawFluxLine(ctx, run.ball.color);

      // 障碍
      for (const o of run.obstacles) {
        if (o.y < -RING_TOP || o.y > WORLD.HEIGHT + 200) continue;
        drawObstacle(ctx, o, run.time, pal.accent, run.ball.color);
      }

      // 拾取物
      drawPickups(ctx, run);

      // 球（线性插值 y）
      const curY = run.ball.y;
      const prevY = run._prevY ?? curY;
      const y = prevY + (curY - prevY) * ip;
      run._prevY = curY;
      const ballRun = { ...run, ball: { ...run.ball, y } };
      drawBall(ctx, ballRun, now);

      // 粒子
      particles.draw(ctx);

      // 极光爆发全屏流彩
      if (now < burstUntil) {
        const t = 1 - (burstUntil - now) / 1500;
        drawBurstOverlay(ctx, t, pal.glow);
      }
    }
  }

  function drawFluxLine(ballColor) {
    const x = WORLD.BALL_X;
    const c = COLORS[ballColor] || COLORS[0];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, c.hex);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.HEIGHT);
    ctx.stroke();
    ctx.restore();
  }

  function drawPickups(ctx, run) {
    for (const p of run.pickups) {
      const x = WORLD.BALL_X;
      const y = p.y;
      const c = p.kind === 'color' ? COLORS[p.color] : null;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (p.kind === 'color') {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.5, c.hex);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, TAU);
        ctx.fill();
      } else {
        // 双色核心：双色同心环
        ctx.strokeStyle = COLORS[0].hex;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = COLORS[2].hex;
        ctx.beginPath();
        ctx.arc(x, y, 24, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawBurstOverlay(ctx, t, glowHex) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const alpha = Math.sin(t * Math.PI) * 0.5;
    for (let k = 0; k < 6; k += 1) {
      const c = COLORS[k].hex;
      const g = ctx.createLinearGradient(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      g.addColorStop(0, `rgba(0,0,0,0)`);
      g.addColorStop(0.5, c);
      g.addColorStop(1, `rgba(0,0,0,0)`);
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = g;
      ctx.beginPath();
      const w = 140 + k * 30;
      const off = (now => Math.sin(now * 0.003 + k) * 160)((performance.now ? performance.now() : Date.now()));
      ctx.moveTo(off, 0);
      ctx.lineTo(off + w, 0);
      ctx.lineTo(off + w + 240, WORLD.HEIGHT);
      ctx.lineTo(off + 240, WORLD.HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  resize();
  return { draw, resize, setScene, triggerBurst, particles };
}

const RING_TOP = 60;
