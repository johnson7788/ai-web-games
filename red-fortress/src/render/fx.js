import { SHARED } from '../../config/palette.js';
import { drawHelicopter } from './sprites.js';

const MAX_PARTICLES = 600;
const MAX_DECALS = 60;
const TAU = Math.PI * 2;

function makeParticle() {
  return {
    active: false, type: 'spark', x: 0, y: 0, vx: 0, vy: 0,
    life: 0, maxLife: 1, size: 2, color: SHARED.white, delay: 0,
    gravity: 0, angle: 0, spin: 0,
  };
}

export function createFx() {
  const particles = Array.from({ length: MAX_PARTICLES }, makeParticle);
  const decals = Array.from({ length: MAX_DECALS }, () => ({ active: false, x: 0, y: 0, r: 0, seed: 0 }));
  const floats = Array.from({ length: 24 }, () => ({ active: false, x: 0, y: 0, life: 0, text: '', color: SHARED.white }));
  const helis = Array.from({ length: 4 }, () => ({ active: false, x: 0, y: 0, vx: 0, life: 0, maxLife: 1, angle: 0, z: 90, doorOpen: false }));
  let cursor = 0;
  let decalCursor = 0;
  let floatCursor = 0;
  let heliCursor = 0;
  let randomState = 0x91e10da5;
  let quality = 'high';
  let reduced = false;
  let hitStop = 0;
  let redFlash = 0;
  let airstrike = 0;
  let activeParticles = 0;

  function random() {
    randomState |= 0;
    randomState = (randomState + 0x6d2b79f5) | 0;
    let n = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }

  function spawn(type, x, y, color, life, size, vx = 0, vy = 0, delay = 0) {
    const limit = quality === 'low' ? 220 : MAX_PARTICLES;
    let p = null;
    for (let n = 0; n < limit; n += 1) {
      const index = (cursor + n) % limit;
      if (!particles[index].active) {
        p = particles[index];
        cursor = (index + 1) % limit;
        break;
      }
    }
    if (!p) {
      p = particles[cursor];
      cursor = (cursor + 1) % limit;
    } else {
      activeParticles += 1;
    }
    p.active = true;
    p.type = type;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.delay = delay;
    p.gravity = type === 'debris' || type === 'shell' ? 180 : 0;
    p.angle = random() * TAU;
    p.spin = (random() - 0.5) * 12;
    return p;
  }

  function burst(x, y, count, color, speed, life, size, type = 'spark', delay = 0) {
    const amount = reduced ? Math.max(1, Math.ceil(count * 0.5)) : count;
    for (let i = 0; i < amount; i += 1) {
      const a = random() * TAU;
      const s = speed * (0.35 + random() * 0.65);
      spawn(type, x, y, color, life * (0.7 + random() * 0.6), size * (0.7 + random() * 0.7), Math.cos(a) * s, Math.sin(a) * s, delay);
    }
  }

  function scorch(x, y, radius) {
    const d = decals[decalCursor];
    decalCursor = (decalCursor + 1) % decals.length;
    d.active = true;
    d.x = x;
    d.y = y;
    d.r = Math.min(70, Math.max(16, radius * 0.42));
    d.seed = random() * 100;
  }

  function floatText(x, y, text, color) {
    const f = floats[floatCursor];
    floatCursor = (floatCursor + 1) % floats.length;
    f.active = true;
    f.x = x;
    f.y = y;
    f.life = 1;
    f.text = text;
    f.color = color;
  }

  function explosion(x, y, radius = 80, delay = 0) {
    spawn('flash', x, y, SHARED.bulletCore, reduced ? 0.05 : 0.1, Math.min(80, radius * 0.65), 0, 0, delay);
    spawn('ring', x, y, SHARED.enemyAccent, 0.36, radius, 0, 0, delay);
    burst(x, y, 8, SHARED.playerAccent, 210, 0.34, 5, 'spark', delay);
    burst(x, y, 5, SHARED.smoke, 42, 1.25, 24, 'smoke', delay + 0.08);
    scorch(x, y, radius);
  }

  function addHeli(x, y, attack = false) {
    const h = helis[heliCursor];
    heliCursor = (heliCursor + 1) % helis.length;
    h.active = true;
    h.x = attack ? -140 : x - 500;
    h.y = y;
    h.vx = attack ? 540 : 330;
    h.life = attack ? 3.2 : 3.8;
    h.maxLife = h.life;
    h.angle = 0;
    h.z = attack ? 120 : 90;
    h.doorOpen = !attack;
  }

  function event(ev, pal) {
    if (!ev || !ev.type) return;
    const x = ev.x || 0;
    const y = ev.y || 0;
    if (ev.type === 'shot') {
      const color = ev.owner === 'enemy' ? SHARED.enemyAccent : SHARED.playerAccent;
      const a = ev.angle || 0;
      spawn('muzzle', x, y, color, 0.055, ev.weapon === 'mg' ? 14 : 22, Math.cos(a) * 30, Math.sin(a) * 30);
      if (quality === 'high') spawn('shell', x, y, SHARED.gold, 0.55, 3, Math.cos(a + 1.7) * 55, Math.sin(a + 1.7) * 55);
    } else if (ev.type === 'hit') {
      burst(x, y, 6, SHARED.playerAccent, 150, 0.24, 4);
      spawn('ring', x, y, SHARED.bulletCore, 0.12, 20);
      hitStop = Math.max(hitStop, reduced ? 0 : 0.03);
    } else if (ev.type === 'kill') {
      burst(x, y, ev.big ? 15 : 8, SHARED.enemyAccent, ev.big ? 190 : 120, 0.55, 6, 'debris');
      burst(x, y, 3, SHARED.smoke, 35, 0.85, 15, 'smoke');
    } else if (ev.type === 'explode') {
      explosion(x, y, ev.radius || (ev.kind === 'boss' ? 150 : 88));
      if (ev.kind === 'boss' || ev.kind === 'airstrike') burst(x, y, 8, pal.accent, 250, 0.5, 7);
    } else if (ev.type === 'powPickup') {
      burst(x, y, 7, SHARED.pow, 75, 0.55, 4);
      floatText(x, y - 20, '+1', SHARED.pow);
    } else if (ev.type === 'powDown') {
      burst(x, y, 5, SHARED.powDark, 65, 0.6, 5, 'debris');
    } else if (ev.type === 'deliver') {
      burst(x, y, 8, SHARED.pow, 85, 0.65, 5);
      floatText(x, y - 28, `+${150 * (ev.count || 1)}`, SHARED.hp);
    } else if (ev.type === 'heliIn') {
      addHeli(x, y, false);
    } else if (ev.type === 'airstrike') {
      addHeli(x, y - 180, true);
      airstrike = 2.4;
      for (let wave = 0; wave < 3; wave += 1) {
        for (let lane = 0; lane < 3; lane += 1) {
          const delay = 0.35 + wave * 0.42 + lane * 0.09;
          const targetX = x + (lane - 1) * 125 + wave * 60;
          const targetY = y - wave * 150 + lane * 25;
          spawn('debris', targetX, targetY - 220, SHARED.enemyDark, 0.4, 11, 0, 480, delay - 0.35);
          explosion(targetX, targetY, 105, delay);
        }
      }
    } else if (ev.type === 'playerHit') {
      redFlash = reduced ? 0.08 : 0.22;
      burst(x, y, 8, SHARED.enemyAccent, 155, 0.4, 5);
    } else if (ev.type === 'playerDead') {
      explosion(x, y, 145);
      redFlash = reduced ? 0.08 : 0.3;
    } else if (ev.type === 'bossAwake' || ev.type === 'bossPhase') {
      spawn('ring', x, y, pal.accent, 0.8, 180);
      burst(x, y, 12, pal.accent2, 180, 0.75, 5);
    } else if (ev.type === 'bossNodeDown' || ev.type === 'bossDead') {
      explosion(x, y, ev.type === 'bossDead' ? 190 : 110);
    }
  }

  function update(dt) {
    const step = hitStop > 0 ? 0 : dt;
    hitStop = Math.max(0, hitStop - dt);
    redFlash = Math.max(0, redFlash - dt);
    airstrike = Math.max(0, airstrike - dt);
    activeParticles = 0;
    const limit = quality === 'low' ? 220 : MAX_PARTICLES;
    for (let i = 0; i < limit; i += 1) {
      const p = particles[i];
      if (!p.active) continue;
      if (p.delay > 0) {
        p.delay -= step;
        activeParticles += 1;
        continue;
      }
      p.life -= step;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += p.gravity * step;
      p.angle += p.spin * step;
      if (p.type === 'smoke') {
        p.vx *= 0.985;
        p.vy -= 7 * step;
      }
      activeParticles += 1;
    }
    for (const f of floats) {
      if (!f.active) continue;
      f.life -= step;
      f.y -= 28 * step;
      if (f.life <= 0) f.active = false;
    }
    for (const h of helis) {
      if (!h.active) continue;
      h.life -= step;
      h.x += h.vx * step;
      h.y -= 12 * step;
      if (h.life <= 0) h.active = false;
    }
  }

  function drawGround(ctx) {
    ctx.save();
    for (const d of decals) {
      if (!d.active) continue;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = SHARED.scorch;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.65, d.seed, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = SHARED.black;
      ctx.fillRect(d.x - d.r * 0.35, d.y - 3, d.r * 0.7, 6);
    }
    ctx.restore();
  }

  function draw(ctx, t) {
    for (const p of particles) {
      if (!p.active || p.delay > 0) continue;
      const ratio = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      if (p.type === 'flash') {
        ctx.globalAlpha = Math.min(0.85, ratio);
        ctx.fillStyle = p.color;
        const r = p.size * (1.1 - ratio * 0.4);
        ctx.fillRect(-r, -r * 0.22, r * 2, r * 0.44);
        ctx.fillRect(-r * 0.22, -r, r * 0.44, r * 2);
      } else if (p.type === 'ring') {
        ctx.globalAlpha = ratio * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(2, 8 * ratio);
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1 - ratio * 0.75), 0, TAU);
        ctx.stroke();
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = ratio * 0.5;
        ctx.fillStyle = p.color;
        const size = p.size * (1.5 - ratio * 0.5);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.fillRect(-size * 0.75, -size * 0.2, size * 0.6, size * 0.6);
      } else if (p.type === 'muzzle') {
        ctx.globalAlpha = ratio;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 0.5);
        ctx.lineTo(p.size * 1.7, 0);
        ctx.lineTo(0, p.size * 0.5);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.globalAlpha = ratio;
        ctx.fillStyle = p.color;
        const stretch = p.type === 'spark' ? 2.5 : 1;
        ctx.fillRect(-p.size * stretch / 2, -p.size / 2, p.size * stretch, p.size);
      }
      ctx.restore();
    }

    for (const f of floats) {
      if (!f.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    for (const h of helis) {
      if (h.active) drawHelicopter(ctx, h, t);
    }
  }

  function drawScreen(ctx, width, height, lowHp) {
    if (redFlash > 0 || lowHp) {
      ctx.save();
      ctx.globalAlpha = lowHp ? 0.12 + Math.max(0, redFlash) : redFlash;
      ctx.strokeStyle = SHARED.hpLow;
      ctx.lineWidth = lowHp ? 54 : 34;
      ctx.strokeRect(0, 0, width, height);
      ctx.restore();
    }
    if (airstrike > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.28, airstrike * 0.12);
      ctx.strokeStyle = SHARED.playerAccent;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(width + 40, 80 + i * 150);
        ctx.lineTo(width * 0.42, 250 + i * 120);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function reset() {
    for (const p of particles) p.active = false;
    for (const d of decals) d.active = false;
    for (const f of floats) f.active = false;
    for (const h of helis) h.active = false;
    activeParticles = 0;
    redFlash = 0;
    airstrike = 0;
    hitStop = 0;
  }

  return {
    event,
    update,
    draw,
    drawGround,
    drawScreen,
    reset,
    setQuality(value) {
      quality = value === 'low' ? 'low' : 'high';
      if (quality === 'low') {
        for (let i = 220; i < particles.length; i += 1) particles[i].active = false;
        cursor %= 220;
      }
    },
    setReducedMotion(value) { reduced = !!value; },
    getStats() {
      let activeDecals = 0;
      for (const d of decals) if (d.active) activeDecals += 1;
      return { particles: activeParticles, decals: activeDecals };
    },
  };
}
