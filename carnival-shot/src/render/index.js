// createRender 装配：渲染函数纯消费 sim 状态，不持有游戏逻辑。
// 导出 createRender(canvas) → { draw(run, interp, aim), resize, burst, lanternRain, setAim }。
import { WORLD, DPR_CAP, scene, clamp } from './theme.js';
import { drawScene } from './scene.js';
import { drawTargets } from './targets.js';
import { createParticles } from './particles.js';

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const particles = createParticles();
  let aim = { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 };
  let lastNow = 0;
  let shakeMag = 0;

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

  function setAim(x, y) {
    aim.x = x;
    aim.y = y;
  }

  function burst(x, y, kind) {
    particles.burst(x, y, kind);
    if (kind === 'gold' || kind === 'lanternRain') requestShake(8);
  }

  function lanternRain() {
    particles.lanternRain();
    requestShake(10);
  }

  function requestShake(mag) {
    if (reduceMotion) return;
    shakeMag = Math.max(shakeMag, mag);
  }

  function currentScene(run) {
    const hud = run && typeof run.getHud === 'function' ? run.getHud() : null;
    if (hud && hud.scene) return hud.scene;
    return 'lantern';
  }

  function drawTitle(now) {
    drawScene(ctx, 'lantern', now, reduceMotion);
    // 装饰目标（静止的纸鸢 + 提灯鸭），让标题屏也有玩法剪影
    const decos = [
      { kind: 'kite', x: 300, y: 230, vx: 40 },
      { kind: 'lantern', x: 620, y: 180, vx: -20 },
      { kind: 'golden', x: 950, y: 260, vx: 30 },
      { kind: 'red', x: 1080, y: 170, vx: -30 },
      { kind: 'moving', x: 780, y: 380, vx: 20 },
    ];
    drawTargets(ctx, decos.map((d) => ({ ...d, dead: false, r: 40 })), now);
  }

  function draw(run, interp, now) {
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;

    particles.update(dt);

    if (!run) {
      drawTitle(now);
      return;
    }

    const sceneKey = currentScene(run);
    const hud = typeof run.getHud === 'function' ? run.getHud() : null;

    // 震屏衰减
    shakeMag *= Math.max(0, 1 - 3.2 * dt);
    if (shakeMag < 0.2) shakeMag = 0;
    const shx = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;
    const shy = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.translate(shx, shy);
    drawScene(ctx, sceneKey, now, reduceMotion);
    drawTargets(ctx, run.targets || [], now);
    particles.draw(ctx, now);
    drawCrosshair(ctx, aim.x, aim.y, hud);
    ctx.restore();
  }

  function drawCrosshair(ctx, x, y, hud) {
    ctx.save();
    ctx.strokeStyle = '#fff6df';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(255,209,102,0.9)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 22, y); ctx.lineTo(x - 8, y);
    ctx.moveTo(x + 8, y); ctx.lineTo(x + 22, y);
    ctx.moveTo(x, y - 22); ctx.lineTo(x, y - 8);
    ctx.moveTo(x, y + 8); ctx.lineTo(x, y + 22);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  resize();

  return { draw, resize, setAim, burst, lanternRain };
}
