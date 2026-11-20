// FISH FRENZY · createRender 装配：渲染函数纯消费 sim 状态，不持有游戏逻辑。
// 导出 createRender(canvas) → { draw(run, interp), burst(x,y,kind), resize() }。
import { WORLD, DPR_CAP, FONT, scenePalette, clamp } from './theme.js';
import { drawScene } from './scene.js';
import { drawFish } from './fish.js';
import { drawCannon } from './cannon.js';
import { createParticles } from './particles.js';
import { pathById } from '../../config/paths.js';

function makeGlowSprite(radius, core) {
  const size = Math.max(2, Math.ceil(radius * 2));
  const s = document.createElement('canvas');
  s.width = size;
  s.height = size;
  const c = s.getContext('2d');
  const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, core);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return s;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = createParticles();
  const bulletGlow = makeGlowSprite(24, 'rgba(84,231,255,0.95)');

  let lastNow = 0;
  let smoothScene = 1;
  let targetScene = 1;

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

  function sceneOf(run) {
    if (run && typeof run.getHud === 'function') {
      const h = run.getHud();
      if (h && typeof h.scene === 'number') return h.scene;
    }
    if (run && typeof run.stage === 'number') {
      // 直接读 stage：scene = ceil(stage/4) 近似映射（1-4→1, 5-8→2, 9-12→3）
      const s = Math.min(3, Math.ceil(run.stage / 4));
      return s;
    }
    return 1;
  }

  function drawForecast(ctx, run) {
    const f = run.forecast;
    if (!f) return;
    const path = pathById(f.pathId).points;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,209,102,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    path.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawBullets(ctx, run) {
    for (const b of run.bullets) {
      ctx.drawImage(bulletGlow, b.x - 24, b.y - 24, 48, 48);
      ctx.fillStyle = '#eaffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 标题屏演示：画几条发光鱼 + 炮台，让标题屏有可识别主体（vision-review silhouette）
  function drawTitleDemo(now) {
    const sec = now / 1000;
    const demos = [
      { species: 7, x: 220 + Math.sin(sec * 0.4) * 120, y: 200, dir: 0.2, r: 34 },
      { species: 4, x: 980 + Math.cos(sec * 0.5) * 90, y: 330, dir: Math.PI - 0.3, r: 22 },
      { species: 1, x: 600 + Math.sin(sec * 0.7 + 2) * 180, y: 130, dir: -0.1, r: 16 },
      { species: 9, x: 900 + Math.sin(sec * 0.35 + 1) * 100, y: 160, dir: Math.PI, r: 28 },
    ];
    for (const d of demos) {
      const f = {
        species: d.species, radius: d.r, x: d.x, y: d.y,
        path: [[d.x - 60, d.y], [d.x + 60, d.y]], seg: 0, _dir: d.dir,
      };
      drawFish(ctx, f, sec);
    }
    drawCannon(ctx, { angle: -Math.PI / 2, tier: 3 }, sec);
  }

  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;
    const ip = typeof interp === 'number' ? clamp(interp, 0, 1) : 1;

    particles.update(dt);

    if (!run) {
      drawScene(ctx, 1, now / 1000);
      drawTitleDemo(now);
      return;
    }

    // 场景平滑过渡
    targetScene = sceneOf(run);
    smoothScene += (targetScene - smoothScene) * Math.min(1, dt * 3);
    const sceneIdx = clamp(Math.round(smoothScene) || 1, 1, 3);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#010409';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    drawScene(ctx, sceneIdx, now / 1000);
    drawForecast(ctx, run);

    for (const f of run.fish) {
      if (!f.alive) continue;
      drawFish(ctx, f, now / 1000);
    }

    drawBullets(ctx, run);
    drawCannon(ctx, run.cannon, now / 1000);
    particles.draw(ctx);
  }

  resize();

  return {
    draw,
    resize,
    burst: (x, y, kind) => particles.burst(x, y, kind),
    setScene: (s) => { targetScene = clamp(s || 1, 1, 3); },
  };
}
