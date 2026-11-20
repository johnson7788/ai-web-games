// src/render/index.js — createRender 装配：场景 / 掉落物 / 玩家 / 粒子 / 涟漪。
// 纯消费 sim 状态，不持有游戏逻辑。
import { WORLD } from './theme.js';
import { RIPPLE as RIPPLE_CFG, laneAt } from '../../config/gameplay.js';
import { drawScene, drawRipple } from './scene.js';
import { drawItems } from './objects.js';
import { drawPlayer } from './player.js';
import { createParticles } from './particles.js';

function makeGlow(radius, core, edge) {
  const size = Math.max(2, Math.ceil(radius * 2));
  const s = document.createElement('canvas');
  s.width = size;
  s.height = size;
  const c = s.getContext('2d');
  const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, core);
  g.addColorStop(0.4, core);
  g.addColorStop(1, edge);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return s;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const particles = createParticles();
  let prevX = null;
  let lastNow = 0;

  function resize() {
    const dpr = (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
    const capDpr = Math.min(2, Math.max(1, dpr));
    const cssW = canvas.clientWidth || WORLD.WIDTH;
    const cssH = canvas.clientHeight || WORLD.HEIGHT;
    const scale = Math.min(cssW / WORLD.WIDTH, cssH / WORLD.HEIGHT);
    const ox = (cssW - WORLD.WIDTH * scale) / 2;
    const oy = (cssH - WORLD.HEIGHT * scale) / 2;
    canvas.width = Math.max(1, Math.round(cssW * capDpr));
    canvas.height = Math.max(1, Math.round(cssH * capDpr));
    ctx.setTransform(capDpr * scale, 0, 0, capDpr * scale, capDpr * ox, capDpr * oy);
  }

  function clear() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    const ip = typeof interp === 'number' ? Math.max(0, Math.min(1, interp)) : 1;

    particles.update(dt);
    clear();

    if (!run) {
      drawScene(ctx, { sceneIdx: 1, now, laneAt, windKey: 'calm' });
      drawIdleDrops(ctx, now);
      particles.draw(ctx);
      return;
    }

    const hud = run.getHud();
    const sceneIdx = hud.scene || 1;
    drawScene(ctx, { sceneIdx, now, laneAt, windKey: hud.wind });

    drawItems(ctx, run, null);

    // 玩家插值
    const curX = run.player.x;
    if (prevX === null) prevX = curX;
    const px = prevX + (curX - prevX) * ip;
    prevX = curX;

    const invuln = run.time < run.player.invulnUntil;
    drawPlayer(ctx, {
      x: px,
      blocking: run.player.blocking,
      shield: run.player.shield,
      invuln,
      now,
      pal: { accent: '#2aa9c4', glow: '#ffe27a' },
      blink: Math.floor(now / 90) % 2 === 0,
    });

    // 慢动作涟漪（signature）
    if (hud.ripple) {
      const remaining = Math.max(0, run.rippleUntil - run.time);
      const age = 1 - remaining / RIPPLE_CFG.DURATION;
      drawRipple(ctx, px, WORLD.GROUND_Y, age, sceneIdx);
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#9fd8ff';
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.restore();
    }

    particles.draw(ctx);
  }

  // 标题屏装饰：缓慢飘落的几个物品
  function drawIdleDrops(ctx, now) {
    const kinds = ['pot', 'bottle', 'cup', 'drone'];
    const fakeRun = { items: [], time: now };
    for (let i = 0; i < 6; i += 1) {
      const x = 100 + i * 220 + Math.sin(now * 0.0004 + i) * 40;
      const y = ((now * 0.05 + i * 90) % 720) - 60;
      fakeRun.items.push({ id: 100 + i, x, y, r: 13 + (i % 3) * 5, kind: kinds[i % kinds.length], tracking: false, active: true, vy: 0, vx: 0 });
    }
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawItems(ctx, fakeRun, null);
    ctx.restore();
  }

  resize();

  return { draw, resize, burst: (x, y, kind) => particles.burst(x, y, kind) };
}
