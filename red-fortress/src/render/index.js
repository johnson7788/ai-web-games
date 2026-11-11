import { WORLD, CAMERA } from '../../config/game.config.js';
import { STAGES } from '../../config/levels.js';
import { paletteFor, SHARED } from '../../config/palette.js';
import { drawTerrain, drawAtmosphere, drawTitleBackground } from './terrain.js';
import { drawPlayer, drawEntity, drawBoss } from './sprites.js';
import { createFx } from './fx.js';

export function initRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  const fx = createFx();
  let quality = 'high';
  let reduced = false;
  let shakePower = 0;
  let shakeTime = 0;
  let lastRun = null;
  let lastPhase = '';
  let phaseTime = 0;
  let dpr = 0;
  let pal = paletteFor('fortress');
  let vignette = null;
  let vignetteTheme = '';
  let scanlines = null;

  function resize() {
    const next = Math.max(1, Math.min(2, globalThis.devicePixelRatio || 1));
    if (next === dpr && canvas.width === WORLD.W * next) return;
    dpr = next;
    canvas.width = Math.round(WORLD.W * dpr);
    canvas.height = Math.round(WORLD.H * dpr);
    ctx.imageSmoothingEnabled = false;
    vignetteTheme = '';
    const tile = canvas.ownerDocument.createElement('canvas');
    tile.width = 4;
    tile.height = 4;
    const tileCtx = tile.getContext('2d');
    tileCtx.fillStyle = SHARED.black;
    tileCtx.globalAlpha = 0.16;
    tileCtx.fillRect(0, 0, 4, 1);
    scanlines = ctx.createPattern(tile, 'repeat');
  }

  function overlay() {
    if (vignetteTheme !== pal.id) {
      vignetteTheme = pal.id;
      vignette = ctx.createRadialGradient(WORLD.W / 2, WORLD.H / 2, 260, WORLD.W / 2, WORLD.H / 2, 760);
      vignette.addColorStop(0, pal.fog);
      vignette.addColorStop(0.72, pal.fog);
      vignette.addColorStop(1, SHARED.black);
    }
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = scanlines;
    ctx.fillRect(0, 0, WORLD.W, WORLD.H);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WORLD.W, WORLD.H);
    ctx.restore();
  }

  function draw({ run, phase = 'title', t = 0, dt = 1 / 60, quality: frameQuality, reducedMotion } = {}) {
    resize();
    if (frameQuality && frameQuality !== quality) setQuality(frameQuality);
    if (reducedMotion != null && reducedMotion !== reduced) setReducedMotion(reducedMotion);
    if (run !== lastRun) {
      fx.reset();
      lastRun = run;
      shakeTime = 0;
    }
    if (phase !== lastPhase) {
      lastPhase = phase;
      phaseTime = 0;
    } else {
      phaseTime += Math.min(0.05, Math.max(0, dt));
    }

    const theme = run ? (STAGES[run.stageIndex] || STAGES[0]).theme : 'fortress';
    pal = paletteFor(theme);
    fx.setQuality(quality);
    fx.setReducedMotion(reduced);
    fx.update(Math.min(0.05, Math.max(0, dt)));
    shakeTime = Math.max(0, shakeTime - dt);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.deep;
    ctx.fillRect(0, 0, WORLD.W, WORLD.H);

    if (!run) {
      drawTitleBackground(ctx, pal, t, reduced);
      overlay(t);
      return;
    }

    const shakeRatio = shakeTime > 0 ? Math.min(1, shakeTime / CAMERA.SHAKE_MS * 1000) : 0;
    const amplitude = reduced ? 0 : shakePower * shakeRatio;
    const shakeX = Math.sin(t * 91) * amplitude;
    const shakeY = Math.cos(t * 73 + 1.2) * amplitude * 0.7;
    const camY = run.cameraY || 0;

    ctx.save();
    ctx.translate(Math.round(shakeX), Math.round(shakeY - camY));
    drawTerrain(ctx, run, pal, theme, t, quality, camY);
    fx.drawGround(ctx);
    if (run.boss && (run.boss.type === 'boss' || run.boss.nodes)) drawBoss(ctx, run.boss, pal, t);

    const entities = run.entities || [];
    for (const e of entities) {
      if (e.kind === 'grenade' || e.type === 'mine') drawEntity(ctx, e, t, pal);
    }
    for (const e of entities) {
      if (e.kind !== 'bullet' && e.kind !== 'grenade' && e.type !== 'mine') drawEntity(ctx, e, t, pal);
    }
    if (run.player) drawPlayer(ctx, run.player, t);
    for (const e of entities) {
      if (e.kind === 'bullet') drawEntity(ctx, e, t, pal);
    }
    fx.draw(ctx, t);
    ctx.restore();

    drawAtmosphere(ctx, pal, theme, t, quality, reduced);
    fx.drawScreen(ctx, WORLD.W, WORLD.H, !!run.player && run.player.hp <= Math.max(1, run.player.maxHp * 0.34));
    overlay(t);

    if (phase === 'intro' && phaseTime < 1) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - phaseTime);
      ctx.fillStyle = SHARED.black;
      ctx.fillRect(0, 0, WORLD.W, WORLD.H);
      ctx.globalAlpha = Math.min(0.25, 1 - phaseTime);
      ctx.fillStyle = pal.accent2;
      for (let y = 0; y < WORLD.H; y += 12) {
        const offset = ((y * 17 + Math.floor(t * 12) * 31) % 97);
        ctx.fillRect(offset, y, WORLD.W - offset, 2);
      }
      ctx.restore();
    }
  }

  function setQuality(value) {
    quality = value === 'low' ? 'low' : 'high';
    fx.setQuality(quality);
  }

  function setReducedMotion(value) {
    reduced = !!value;
    fx.setReducedMotion(reduced);
    if (reduced) {
      shakeTime = 0;
      shakePower = 0;
    }
  }

  function shake(power = 0.4) {
    if (reduced) return;
    shakePower = Math.min(CAMERA.SHAKE_MAX, Math.max(0, power) * CAMERA.SHAKE_MAX);
    shakeTime = Math.min(CAMERA.SHAKE_MS / 1000, 0.12 + Math.max(0, power) * 0.18);
  }

  function handleEvent(event) {
    fx.event(event, pal);
    if (event && event.type === 'shock') shake(event.power || 0.4);
    else if (event && event.type === 'explode') shake(Math.min(1, (event.radius || 80) / 180));
    else if (event && (event.type === 'bossDead' || event.type === 'playerDead')) shake(1);
  }

  resize();

  return {
    draw,
    fx: handleEvent,
    setQuality,
    setReducedMotion,
    shake,
    drawBackground(t = 0, phase = 'title') { draw({ run: null, phase, t }); },
    getStats() { return { ...fx.getStats(), dpr, quality, reducedMotion: reduced }; },
  };
}
