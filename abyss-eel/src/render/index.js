// createRender 装配：渲染函数纯消费 sim 状态，不持有游戏逻辑。
// 导出 createRender(canvas) → { draw(run, interp), resize(), setZoneFx(zone), burst(x,y,kind), setDash(bool) }。
import { WORLD, DPR_CAP, ZONE_FADE_SEC, EEL, LIGHT, SHAKE, clamp } from './theme.js';
import { drawScene, blendPalette } from './scene.js';
import { drawWalls, drawFoods } from './walls.js';
import { drawEel } from './eel.js';
import { createParticles } from './particles.js';
import { drawLightMask } from './lightmask.js';

function makeGlowSprite(radius, core, edge) {
  const size = Math.max(2, Math.ceil(radius * 2));
  const s = document.createElement('canvas');
  s.width = size;
  s.height = size;
  const c = s.getContext('2d');
  const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, core);
  g.addColorStop(0.42, core);
  g.addColorStop(1, edge);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return s;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sprites = {
    orbCyan: makeGlowSprite(EEL.orbGlow, 'rgba(224,255,255,1)', 'rgba(125,249,255,0)'),
    orbGold: makeGlowSprite(EEL.orbGlow, 'rgba(255,246,220,1)', 'rgba(255,209,102,0)'),
  };

  const particles = createParticles();

  let zoneFrom = 1;
  let zoneTo = 1;
  let zoneFadeT = 1;
  let fxZone = 1;
  let prevHeadX = null;
  let prevHeadWY = null;
  let dash = false;
  let shakeMag = 0;
  let lastShakeAt = -1e9;
  let lastNow = 0;
  let smoothLight = LIGHT.minRadius;

  function clampZone(n) {
    return clamp(Math.round(n) || 1, 1, 5);
  }

  // 世界→屏幕：screenY = headWorldY + 540 − worldY。
  function headWorldY(run) {
    if (run && typeof run.headWorldY === 'number') return run.headWorldY;
    const hud = run && typeof run.getHud === 'function' ? run.getHud() : null;
    if (hud && typeof hud.depth === 'number') return WORLD.HEAD_Y + hud.depth * 10;
    if (run && typeof run.depth === 'number') return WORLD.HEAD_Y + run.depth * 10;
    return WORLD.HEAD_Y;
  }

  function currentZone(run) {
    const hud = run && typeof run.getHud === 'function' ? run.getHud() : null;
    if (hud && typeof hud.zone === 'number') return clampZone(hud.zone);
    if (run && typeof run.zone === 'number') return clampZone(run.zone);
    return 1;
  }

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

  function setZoneFx(zoneIdx) {
    const z = clampZone(zoneIdx);
    if (z === fxZone) return;
    zoneFrom = zoneTo;
    zoneTo = z;
    zoneFadeT = 0;
    fxZone = z;
  }

  function setDash(v) {
    dash = !!v;
  }

  function requestShake(mag) {
    if (reduceMotion) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastShakeAt < 10000) return;
    lastShakeAt = now;
    shakeMag = Math.max(shakeMag, mag);
  }

  function burst(x, y, kind) {
    particles.burst(x, y, kind);
    if (kind === 'boss') requestShake(SHAKE.boss);
  }

  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;
    const ip = typeof interp === 'number' ? clamp(interp, 0, 1) : 1;

    particles.update(dt);

    if (!run) {
      // 标题屏：只画背景氛围
      drawScene(ctx, { zoneFrom, zoneTo, fadeT: zoneFadeT, now, reduceMotion });
      return;
    }

    const zoneIdx = currentZone(run);
    if (zoneIdx !== fxZone) setZoneFx(zoneIdx);
    zoneFadeT = Math.min(1, zoneFadeT + dt / ZONE_FADE_SEC);
    if (zoneFadeT >= 1) { zoneFadeT = 1; zoneFrom = zoneTo; }

    const hud = typeof run.getHud === 'function' ? run.getHud() : null;

    // 线性插值（headWorldY / head.x），interp 由 main 传。
    const curHeadX = run.head && typeof run.head.x === 'number' ? run.head.x : WORLD.WIDTH / 2;
    const curHeadWY = headWorldY(run);
    if (prevHeadX === null) { prevHeadX = curHeadX; prevHeadWY = curHeadWY; }
    const headX = prevHeadX + (curHeadX - prevHeadX) * ip;
    const rWY = prevHeadWY + (curHeadWY - prevHeadWY) * ip;
    prevHeadX = curHeadX;
    prevHeadWY = curHeadWY;
    const headY = WORLD.HEAD_Y;

    const dashing = dash || !!(run.dashing) || !!(run.head && run.head.dash);

    // 光半径平滑（珠多亮、珠少暗）
    const orbsN = (run.orbs && run.orbs.length) || 0;
    const targetLight = (hud && typeof hud.lightRadius === 'number')
      ? hud.lightRadius
      : clamp(LIGHT.minRadius + orbsN * LIGHT.perOrb, LIGHT.minRadius, LIGHT.maxRadius);
    smoothLight += (targetLight - smoothLight) * Math.min(1, dt * 6);

    // 震屏（reduced-motion 关；全屏级 ≤1 次/10s 由 requestShake 保证）
    shakeMag *= Math.max(0, 1 - SHAKE.decay * dt);
    if (shakeMag < 0.15) shakeMag = 0;
    const shx = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;
    const shy = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;

    const pal = blendPalette(zoneFrom, zoneTo, zoneFadeT);

    // 清屏（含 letterbox 黑边）
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#010409';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    drawScene(ctx, { zoneFrom, zoneTo, fadeT: zoneFadeT, now, reduceMotion });

    ctx.save();
    ctx.translate(shx, shy);
    drawWalls(ctx, { run, rWY, pal, now });
    drawFoods(ctx, { run, rWY, sprites, now });
    particles.drawSimSparks(ctx, run.sparks, headX, headY);
    drawEel(ctx, { headX, headY, headVx: run.head && run.head.vx, orbs: run.orbs, dashing, now, sprites, pal });
    particles.draw(ctx, now);
    ctx.restore();

    // 光半径暗角（zone≥3）
    const fromOn = zoneFrom >= 3 ? 1 : 0;
    const toOn = zoneTo >= 3 ? 1 : 0;
    const maskAlpha = fromOn + (toOn - fromOn) * zoneFadeT;
    drawLightMask(ctx, {
      active: (fromOn || toOn) === 1,
      alpha: maskAlpha,
      headX,
      headY,
      radius: smoothLight,
      glow: pal.glow,
    });
  }

  resize();

  return { draw, resize, setZoneFx, burst, setDash };
}
