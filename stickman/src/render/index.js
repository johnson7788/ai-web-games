import { WORLD } from '../../config/game.config.js';
import { MAPS } from '../../config/maps.js';
import { clamp, inkLine } from './ink.js';
import { drawCharacter } from './character.js';
import { createWorldRenderer, drawPickups } from './world.js';
import { createFx } from './fx.js';

if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('bench') === '1' && !window.location.pathname.endsWith('/tools/renderbench.html')) {
  window.location.replace('./tools/renderbench.html');
}

const canvasState = { canvas: null, ctx: null, dpr: 1, scale: 1, ox: 0, oy: 0, w: 0, h: 0 };
const view = { map: MAPS.draft, shakeScale: 1, quality: 'high', t: 0 };
const world = createWorldRenderer();
const effects = createFx();

function resize() {
  const { canvas } = canvasState;
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvasState.dpr = dpr;
  canvasState.w = w;
  canvasState.h = h;
  canvasState.scale = Math.min(w / WORLD.w, h / WORLD.h);
  canvasState.ox = (w - WORLD.w * canvasState.scale) / 2;
  canvasState.oy = (h - WORLD.h * canvasState.scale) / 2;
}

function init(canvas, options = {}) {
  canvasState.canvas = canvas;
  canvasState.ctx = canvas.getContext('2d');
  view.quality = options.quality === 'low' ? 'low' : 'high';
  effects.setQuality(view.quality);
  effects.setMap(view.map);
  resize();
}

function setMap(id) {
  view.map = typeof id === 'object' && id ? id : (MAPS[id] || MAPS.draft);
  effects.setMap(view.map);
}

function setQuality(q) {
  view.quality = q === 'low' ? 'low' : 'high';
  effects.setQuality(view.quality);
}

function setShakeScale(v) {
  view.shakeScale = clamp(Number(v) || 0, 0, 1.5);
}

function screenToWorld(cx, cy) {
  return {
    x: (cx - canvasState.ox) / canvasState.scale,
    y: (cy - canvasState.oy) / canvasState.scale,
  };
}

function toScreen(x, y) {
  return {
    x: x * canvasState.scale + canvasState.ox,
    y: y * canvasState.scale + canvasState.oy,
  };
}

function drawBullets(ctx, bullets, palette, alpha, t) {
  for (let i = 0; i < bullets.length; i += 1) {
    const b = bullets[i];
    const x = (b.px ?? b.x) + (b.x - (b.px ?? b.x)) * alpha;
    const y = (b.py ?? b.y) + (b.y - (b.py ?? b.y)) * alpha;
    const player = b.owner === 'player';
    const color = player ? (b.color || palette.accent) : '#ef6a5e';
    const dx = b.dx ?? 1;
    const dy = b.dy ?? 0;
    inkLine(ctx, x - dx * 30, y - dy * 30, x, y, {
      color, width: player ? 3.8 : 4.5, alpha: 0.16,
      seed: 1600 + i, time: t, segments: 8, jitter: 0.18, dry: 0.35,
    });
    inkLine(ctx, x - dx * 19, y - dy * 19, x, y, {
      color, width: player ? 2.1 : 2.7, alpha: 0.95,
      seed: 1700 + i, time: t, segments: 8, jitter: 0.12,
    });
    if (player) {
      inkLine(ctx, x - dx * 11, y - dy * 11, x, y, {
        color: palette.line, width: 0.65, alpha: 0.8,
        seed: 1800 + i, time: t, segments: 8, jitter: 0.08,
      });
    }
  }
}

function drawEntities(ctx, sim, palette, alpha, t) {
  const enemies = sim.enemies || [];
  const options = { t, alpha, groundY: sim.world?.groundY ?? WORLD.groundY };
  for (const ent of enemies) if (ent.dead) drawCharacter(ctx, ent, palette, options);
  if (sim.boss && !enemies.includes(sim.boss)) drawCharacter(ctx, sim.boss, palette, options);
  for (const ent of enemies) if (!ent.dead && ent !== sim.player) drawCharacter(ctx, ent, palette, options);
  if (sim.player) drawCharacter(ctx, sim.player, palette, options);
}

function draw(run, alpha = 1, dt = 0.016) {
  const ctx = canvasState.ctx;
  if (!ctx) return;
  const frameDt = clamp(Number.isFinite(dt) ? dt : 0.016, 0, 0.06);
  const visualDt = effects.update(frameDt);
  view.t += visualDt;
  const p = view.map.palette;
  const sim = run?.sim || null;
  const t = view.t;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, canvasState.canvas.width, canvasState.canvas.height);

  const shake = effects.getShake(t);
  const sx = shake.x * view.shakeScale;
  const sy = shake.y * view.shakeScale;
  const { dpr, scale, ox, oy } = canvasState;
  ctx.save();
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + sx), dpr * (oy + sy));
  world.draw(ctx, view.map, {
    t, dt: visualDt, quality: view.quality,
    focusX: sim?.player?.x ?? WORLD.w / 2,
  });

  if (sim) {
    drawPickups(ctx, sim.pickups || [], p, t, alpha);
    drawBullets(ctx, sim.bullets || [], p, alpha, t);
    drawEntities(ctx, sim, p, alpha, t);
  }
  world.drawForeground(ctx, view.map, sim?.boss || sim?.enemies?.find((e) => e.type === 'blank'), t);
  effects.drawWorld(ctx, t);
  ctx.restore();

  const inkRatio = sim?.player ? clamp(sim.player.hp / (sim.player.maxHp || 100)) : 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  effects.drawScreen(ctx, canvasState.w, canvasState.h, inkRatio);
  ctx.globalAlpha = 1;
}

const Render = {
  init, resize, setMap, draw, setQuality, setShakeScale, screenToWorld, toScreen,
  fx: effects.consume,
  get state() { return view; },
};

export { Render };
export default Render;
