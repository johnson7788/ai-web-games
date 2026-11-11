import { CONFIG, WORLD } from '../../config/game.config.js';
import { TAU, clamp, noise, inkPath, inkLine, inkArc, inkCircle, inkBlob, inkDrop } from './ink.js';

export function createFx() {
  const particles = [];
  const pool = [];
  const rings = [];
  const texts = [];
  const slashes = [];
  const echoes = [];
  const decals = [];
  const decalCanvas = document.createElement('canvas');
  decalCanvas.width = WORLD.w;
  decalCanvas.height = WORLD.h;
  const decalCtx = decalCanvas.getContext('2d');
  let quality = 'high';
  let map = null;
  let shake = 0;
  let flash = 0;
  let hurt = 0;
  let slowmo = 0;
  let hitstop = 0;
  let waveLine = 0;
  let transition = 0;
  let serial = 1;

  function particleLimit() {
    return quality === 'high' ? CONFIG.quality.maxParticlesHigh : CONFIG.quality.maxParticlesLow;
  }

  function decalLimit() {
    return quality === 'high' ? CONFIG.quality.decalsHigh : CONFIG.quality.decalsLow;
  }

  function addParticle(x, y, vx, vy, life, r, color, gravity = 900) {
    if (particles.length >= particleLimit()) return;
    const p = pool.pop() || {};
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.r = r; p.color = color; p.gravity = gravity;
    p.seed = serial++;
    particles.push(p);
  }

  function burst(x, y, count, color, speed = 240, direction = null) {
    const adjusted = quality === 'high' ? count : Math.ceil(count * 0.45);
    for (let i = 0; i < adjusted; i += 1) {
      const a = direction == null ? noise(serial * 2.1 + i) * TAU : direction + (noise(serial + i) - 0.5) * 1.8;
      const s = speed * (0.25 + noise(serial * 3.7 + i) * 0.9);
      addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - speed * 0.18,
        0.35 + noise(serial + i * 2) * 0.65, 1 + noise(serial + i * 4) * 3.2, color);
    }
  }

  function ring(x, y, color, r = 8, life = 0.1, width = 2) {
    rings.push({ x, y, color, r, life, max: life, width, seed: serial++ });
  }

  function decal(x, y, color, heavy = false) {
    decals.push({ x, y: clamp(y, 40, WORLD.groundY + 8), r: heavy ? 24 : 13, color, alpha: 0.6, seed: serial++ });
    const limit = decalLimit();
    if (decals.length > limit) decals.splice(0, decals.length - limit);
  }

  function consume(events) {
    if (!map) return;
    const p = map.palette;
    for (const ev of events || []) {
      const enemyShot = ev.owner && ev.owner !== 'player';
      const shotColor = enemyShot ? '#ef6a5e' : p.accent;
      switch (ev.type) {
        case 'shot':
          burst(ev.x, ev.y, 5, shotColor, 180, Math.atan2(ev.dy, ev.dx));
          ring(ev.x, ev.y, '#ffffff', 5, 0.08, 2.4);
          flash = Math.max(flash, 0.045);
          shake = Math.min(CONFIG.camera.maxShake, shake + 1.2);
          break;
        case 'shotHit':
        case 'hit': {
          const heavy = !!ev.heavy;
          burst(ev.x, ev.y, heavy ? 10 : 6, ev.target === 'player' ? p.accent : p.ink, heavy ? 320 : 220);
          ring(ev.x, ev.y, p.ink, heavy ? 14 : 8, 0.08, heavy ? 3.5 : 2);
          if (ev.dmg != null) texts.push({ x: ev.x, y: ev.y - 8, value: String(Math.round(ev.dmg)), life: 0.55, max: 0.55, color: p.inkSoft, seed: serial++ });
          hitstop = Math.max(hitstop, heavy ? CONFIG.combat.hitstopHeavy : CONFIG.combat.hitstop);
          shake = Math.min(CONFIG.camera.maxShake, shake + (heavy ? 4 : 1.4));
          break;
        }
        case 'kill': {
          const count = ev.boss ? 24 : 12 + Math.floor(noise(serial) * 12);
          burst(ev.x, ev.y, count, p.ink, ev.boss ? 480 : 330);
          decal(ev.x, WORLD.groundY + 3, p.ink, ev.boss);
          ring(ev.x, ev.y, p.ink, ev.boss ? 80 : 24, ev.boss ? 0.7 : 0.22, ev.boss ? 9 : 3);
          slowmo = Math.max(slowmo, CONFIG.combat.killSlowmo);
          flash = Math.max(flash, ev.boss ? 1 : 0.13);
          shake = Math.min(CONFIG.camera.maxShake, shake + (ev.boss ? 20 : 4));
          break;
        }
        case 'splash':
          ring(ev.x, ev.y, ev.color || p.accent, ev.r || 34, 0.28, 4);
          burst(ev.x, ev.y, 10, ev.color || p.accent, 240);
          break;
        case 'dash':
          for (let i = 0; i < 3; i += 1) echoes.push({ x: ev.x - ev.dir * i * 18, y: ev.y, dir: ev.dir, life: 0.22 + i * 0.04, max: 0.34, seed: serial++ });
          burst(ev.x, ev.y, 4, p.inkSoft, 150, ev.dir > 0 ? Math.PI : 0);
          break;
        case 'melee':
          slashes.push({ x: ev.x, y: ev.y, dir: ev.dir, life: 0.12, max: 0.12, hit: ev.hit, seed: serial++ });
          shake = Math.min(CONFIG.camera.maxShake, shake + (ev.hit ? 4 : 1.5));
          break;
        case 'hurt':
          hurt = Math.max(hurt, 0.3);
          flash = Math.max(flash, 0.07);
          shake = Math.min(CONFIG.camera.maxShake, shake + 5);
          break;
        case 'pickup':
          ring(ev.x, ev.y, p.accent, 12, 0.24, 2);
          burst(ev.x, ev.y, 4, p.accent, 100);
          break;
        case 'waveStart':
          waveLine = 0.4;
          shake = Math.min(CONFIG.camera.maxShake, shake + 3);
          break;
        case 'bossPhase':
          flash = Math.max(flash, 0.85);
          shake = Math.min(CONFIG.camera.maxShake, shake + 12);
          ring(ev.x ?? WORLD.w / 2, ev.y ?? WORLD.h / 2, p.ink, 130, 0.6, 10);
          break;
        case 'actStart':
          transition = 0.6;
          break;
        case 'bossDown':
          flash = 1;
          shake = CONFIG.camera.maxShake;
          break;
        default:
          break;
      }
    }
  }

  function update(dt) {
    const frozen = hitstop > 0;
    hitstop = Math.max(0, hitstop - dt);
    const slowed = slowmo > 0;
    slowmo = Math.max(0, slowmo - dt);
    const visualDt = frozen ? 0 : dt * (slowed ? 0.35 : 1);
    flash = Math.max(0, flash - dt * 2.8);
    hurt = Math.max(0, hurt - dt);
    waveLine = Math.max(0, waveLine - dt);
    transition = Math.max(0, transition - dt);
    shake = Math.max(0, shake - dt * CONFIG.camera.shakeDecay * 6);

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * visualDt;
      p.y += p.vy * visualDt;
      p.vy += p.gravity * visualDt;
      p.vx *= Math.max(0, 1 - visualDt * 1.8);
      p.life -= visualDt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        if (pool.length < particleLimit()) pool.push(p);
      }
    }
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      rings[i].life -= visualDt;
      if (rings[i].life <= 0) rings.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i -= 1) {
      texts[i].life -= visualDt;
      texts[i].y -= visualDt * 42;
      if (texts[i].life <= 0) texts.splice(i, 1);
    }
    for (let i = slashes.length - 1; i >= 0; i -= 1) {
      slashes[i].life -= visualDt;
      if (slashes[i].life <= 0) slashes.splice(i, 1);
    }
    for (let i = echoes.length - 1; i >= 0; i -= 1) {
      echoes[i].life -= visualDt;
      if (echoes[i].life <= 0) echoes.splice(i, 1);
    }
    for (let i = decals.length - 1; i >= 0; i -= 1) {
      decals[i].alpha -= visualDt * 0.02;
      if (decals[i].alpha <= 0) decals.splice(i, 1);
    }
    return visualDt;
  }

  function drawDecals(t) {
    decalCtx.clearRect(0, 0, WORLD.w, WORLD.h);
    for (const d of decals) {
      inkBlob(decalCtx, d.x, d.y, d.r * 1.8, d.r * 0.28, {
        color: d.color, fill: d.color, alpha: d.alpha * 0.5, fillAlpha: d.alpha * 0.35,
        width: 1.2, seed: d.seed, time: t * 0.1, jitter: 1.5, dry: 0.5,
      });
      for (let i = 0; i < 4; i += 1) {
        inkDrop(decalCtx, d.x + (noise(d.seed + i) - 0.5) * d.r * 3,
          d.y - noise(d.seed + i * 3) * d.r * 0.5, 1 + noise(d.seed + i * 7) * 2.5,
          d.color, d.alpha * 0.55, d.seed + i);
      }
    }
  }

  function drawWorld(ctx, t) {
    if (!map) return;
    const p = map.palette;
    drawDecals(t);
    ctx.drawImage(decalCanvas, 0, 0);
    for (const e of echoes) {
      const a = clamp(e.life / e.max) * 0.35;
      for (let i = 0; i < 3; i += 1) {
        inkLine(ctx, e.x - e.dir * 35, e.y - 35 + i * 22, e.x + e.dir * 32, e.y - 38 + i * 22, {
          color: p.inkSoft, width: 3 - i * 0.5, alpha: a, seed: e.seed + i,
          time: t, segments: 12, jitter: 0.8, dry: 0.65,
        });
      }
    }
    for (const r of rings) {
      const progress = 1 - r.life / r.max;
      inkCircle(ctx, r.x, r.y, r.r * (0.65 + progress * 0.8), {
        color: r.color, width: r.width * (1 - progress * 0.5), alpha: clamp(r.life / r.max),
        seed: r.seed, time: t, segments: 14, jitter: 0.7, dry: 0.4,
      });
    }
    for (const s of slashes) {
      const progress = 1 - s.life / s.max;
      const start = s.dir > 0 ? -1.15 : Math.PI - 1.15;
      inkArc(ctx, s.x, s.y - 24, 74 + progress * 12, 48, start, start + 2.1, {
        color: s.hit ? p.accent : p.ink, width: 9 * (1 - progress * 0.45),
        alpha: clamp(s.life / s.max), seed: s.seed, time: t,
        segments: 14, jitter: 1.1, dry: 0.72,
      });
      inkArc(ctx, s.x, s.y - 24, 68 + progress * 12, 43, start + 0.1, start + 1.9, {
        color: p.bg, width: 1.4, alpha: clamp(s.life / s.max) * 0.65,
        seed: s.seed + 1, time: t, segments: 14, dry: 0.7,
      });
    }
    ctx.save();
    for (const pt of particles) {
      ctx.globalAlpha = clamp(pt.life / pt.max) * 0.9;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    for (const tx of texts) {
      ctx.save();
      ctx.globalAlpha = clamp(tx.life / tx.max) * 0.75;
      ctx.fillStyle = tx.color;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tx.value, tx.x, tx.y);
      ctx.restore();
    }
    if (waveLine > 0) {
      const progress = 1 - waveLine / 0.4;
      inkLine(ctx, 160, 92, 160 + 960 * progress, 92, {
        color: p.ink, width: 2.4, alpha: clamp(waveLine / 0.15),
        seed: 1500, time: t, segments: 14, jitter: 0.55, dry: 0.35,
      });
    }
  }

  function drawScreen(ctx, w, h, lowInk) {
    if (!map) return;
    const p = map.palette;
    const edge = Math.max(hurt / 0.3, lowInk < 0.3 ? (0.3 - lowInk) / 0.3 : 0);
    if (edge > 0 && quality === 'high') {
      ctx.save();
      const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.7);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.68, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, hurt > 0 ? '#a62d34' : p.ink);
      ctx.globalAlpha = edge * 0.32;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    if (transition > 0) {
      const progress = 1 - transition / 0.6;
      ctx.save();
      ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.4;
      ctx.fillStyle = p.ink;
      const width = w * Math.sin(progress * Math.PI);
      ctx.fillRect((w - width) / 2, h * 0.42, width, h * 0.16);
      ctx.restore();
    }
    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(flash) * 0.65;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function getShake(t) {
    return {
      x: (Math.sin(t * 91) + Math.sin(t * 47) * 0.5) * shake * 0.45 * CONFIG.camera.shakeKick,
      y: (Math.cos(t * 83) + Math.sin(t * 59) * 0.5) * shake * 0.35 * CONFIG.camera.shakeKick,
    };
  }

  return {
    consume, update, drawWorld, drawScreen, getShake,
    setMap(value) { map = value; decals.length = 0; },
    setQuality(value) {
      quality = value === 'low' ? 'low' : 'high';
      if (particles.length > particleLimit()) particles.splice(0, particles.length - particleLimit());
      if (decals.length > decalLimit()) decals.splice(0, decals.length - decalLimit());
    },
    get shake() { return shake; },
    get particleCount() { return particles.length; },
  };
}
