// CORGI DASH · createRender 装配：纯消费 sim 状态，不持有游戏逻辑。
// 导出 createRender(canvas) → { draw(run, interp), resize(), burst(x,y,kind), surge(x,y), setShakeMag() }
import { WORLD, PLAYER } from '../../config/gameplay.js';
import { segmentFor } from '../../config/segments.js';
import { themeFor, blendPalette, clamp01 } from './theme.js';
import { drawBackground, drawCorgi, drawSheep, drawObstacle } from './actors.js';
import { createParticles } from './particles.js';

const DPR_CAP = 2;
const FADE_SEC = 0.7;

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const particles = createParticles();

  let themeFrom = themeFor('meadow');
  let themeTo = themeFor('meadow');
  let fadeT = 1;
  let curDecor = 'meadow';
  let shakeMag = 0;
  let lastNow = 0;
  let prevPlayerY = null;
  let surgeFlash = 0;

  function currentDecor(run) {
    if (run && typeof run.segment === 'number') return segmentFor(run.distance).decor;
    return 'meadow';
  }

  function resize() {
    const dpr = Math.min(DPR_CAP, Math.max(1, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1));
    const cssW = canvas.clientWidth || WORLD.WIDTH;
    const cssH = canvas.clientHeight || WORLD.HEIGHT;
    const scale = Math.min(cssW / WORLD.WIDTH, cssH / WORLD.HEIGHT);
    const ox = (cssW - WORLD.WIDTH * scale) / 2;
    const oy = (cssH - WORLD.HEIGHT * scale) / 2;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  }

  function setDecor(decor) {
    if (decor === curDecor) return;
    themeFrom = themeTo;
    themeTo = themeFor(decor);
    fadeT = 0;
    curDecor = decor;
  }

  function burst(x, y, kind) {
    particles.burst(x, y, kind);
  }
  function surge(x, y) {
    particles.surge(x, y);
    surgeFlash = 1;
  }
  function shake(mag) {
    if (reduceMotion) return;
    shakeMag = Math.max(shakeMag, mag);
  }

  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp01((now - lastNow) / 1000) > 0.05 ? 0.05 : Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    const ip = typeof interp === 'number' ? Math.min(1, Math.max(0, interp)) : 1;

    particles.update(dt);
    surgeFlash = Math.max(0, surgeFlash - dt * 2.2);

    const decor = run ? currentDecor(run) : 'meadow';
    if (run) setDecor(decor);
    fadeT = Math.min(1, fadeT + dt / FADE_SEC);
    if (fadeT >= 1) { fadeT = 1; themeFrom = themeTo; }

    const pal = blendPalette(themeFrom, themeTo, fadeT);

    // 震屏衰减
    shakeMag *= Math.max(0, 1 - 4 * dt);
    if (shakeMag < 0.2) shakeMag = 0;
    const shx = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;
    const shy = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1712';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const scrollX = run ? run.scrollX : 0;
    drawBackground(ctx, pal, scrollX, now, reduceMotion);

    if (run) {
      ctx.save();
      ctx.translate(shx, shy);

      // 障碍
      for (const o of run.obstacles) {
        const sx = o.x - run.scrollX;
        if (sx < -80 || sx > WORLD.WIDTH + 80) continue;
        drawObstacle(ctx, o, sx, pal);
      }

      // 羊拾取物
      for (const s of run.pickups) {
        const sx = s.x - run.scrollX;
        if (sx < -40 || sx > WORLD.WIDTH + 40) continue;
        drawSheep(ctx, sx, s.y + s.h / 2, 1, now * 4 + s.id);
      }

      // 羊群跟随链（从尾巴画到头）
      const trail = run.trail || [];
      const headY = WORLD.GROUND_Y - PLAYER.H;
      const n = Math.min(run.flock, trail.length);
      for (let i = n - 1; i >= 0; i -= 1) {
        const pt = trail[trail.length - 1 - i];
        drawSheep(ctx, pt.x, headY + 8, 0.8, now * 3 + i);
      }

      // 柯基
      const curY = run.player.y;
      if (prevPlayerY == null) prevPlayerY = curY;
      const py = prevPlayerY + (curY - prevPlayerY) * ip;
      prevPlayerY = curY;
      drawCorgi(ctx, WORLD.PLAYER_X, py, run.time, run.player.airborne, run.scattered > 0);

      // 粒子（落地尘土/吃羊闪光/完美跳金色）
      particles.draw(ctx);

      // 牧羊冲鸭全屏浪涌
      if (surgeFlash > 0) {
        ctx.save();
        ctx.globalAlpha = surgeFlash * 0.35;
        const sg = ctx.createLinearGradient(0, 0, WORLD.WIDTH, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,240,200,0.9)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        ctx.restore();
      }

      ctx.restore();
    }

    // 暴雨暗角
    if (pal.decorKind === 'rain') {
      ctx.save();
      ctx.fillStyle = 'rgba(10,16,24,0.16)';
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.restore();
    }
  }

  resize();

  return { draw, resize, burst, surge, shake };
}
