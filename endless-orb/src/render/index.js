// ENDLESS ORB · Canvas 2D 渲染：三套场景包 + 能量核 + 光子 + 涟漪/粒子。
// 只负责画，不碰 sim 状态；事件特效由 main 经 renderer.event(type,payload) 驱动。
import { WORLD } from '../../config/game.config.js';
import { sceneAt } from '../../config/levels.js';
import { pinnedPos } from '../game/sim.js';
import { themeOf } from './theme.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function decorFor(sceneId) {
  const cache = decorFor._cache || (decorFor._cache = {});
  if (cache[sceneId]) return cache[sceneId];
  const rng = mulberry32(sceneId === 'blue' ? 11 : sceneId === 'red' ? 22 : 33);
  const stars = [];
  for (let i = 0; i < 42; i += 1) {
    stars.push({
      x: rng() * WORLD.WIDTH,
      y: rng() * WORLD.HEIGHT * 0.8,
      r: 0.6 + rng() * 1.6,
      a: 0.2 + rng() * 0.5,
    });
  }
  const arcs = [];
  for (let i = 0; i < 3; i += 1) {
    arcs.push({
      x: WORLD.WIDTH * (0.2 + 0.6 * rng()),
      y: WORLD.HEIGHT * (0.18 + 0.6 * rng()),
      r: 90 + rng() * 160,
      start: rng() * Math.PI * 2,
      len: 0.6 + rng() * 1.8,
      speed: (rng() - 0.5) * 0.4,
    });
  }
  const out = { stars, arcs };
  cache[sceneId] = out;
  return out;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const particles = [];
  const ripples = [];
  let flash = null;
  let lastNow = performance.now();

  function spawnParticle(p) {
    if (particles.length > 260) particles.shift();
    particles.push(p);
  }

  function spawnBurst(x, y, color, n, speed, size) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random());
      spawnParticle({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.6,
        maxLife: 1.1,
        color,
        size: size * (0.5 + Math.random()),
      });
    }
  }

  function event(type, payload = {}) {
    const scene = sceneAt(payload.ring || 1).id;
    const th = themeOf(scene);
    const x = payload.x ?? WORLD.CORE_X;
    const y = payload.y ?? WORLD.CORE_Y;
    switch (type) {
      case 'pin':
        spawnBurst(x, y, th.photon, 6, 160, 3);
        break;
      case 'heavyPin':
        spawnBurst(x, y, th.heavy, 14, 220, 5);
        break;
      case 'nearMiss':
        spawnBurst(x, y, th.photonGlow, 4, 120, 2);
        break;
      case 'ringClear':
        ripples.push({ x: WORLD.CORE_X, y: WORLD.CORE_Y, age: 0, dur: 1.1, maxR: 520, color: th.ripple, heavy: true });
        spawnBurst(WORLD.CORE_X, WORLD.CORE_Y, th.photon, 40, 340, 4);
        break;
      case 'polarityReversal':
        ripples.push({ x: WORLD.CORE_X, y: WORLD.CORE_Y, age: 0, dur: 0.7, maxR: 300, color: th.coreGlow, heavy: false });
        flash = { color: th.coreEdge, t: 0.12 };
        break;
      case 'photonSuck':
        spawnBurst(x, y, th.coreEdge, 8, 180, 3);
        break;
      case 'death':
        flash = { color: 'rgba(255,70,90,0.55)', t: 0.25 };
        spawnBurst(x, y, '#ff5d73', 34, 360, 4);
        break;
      case 'win':
        ripples.push({ x: WORLD.CORE_X, y: WORLD.CORE_Y, age: 0, dur: 1.6, maxR: 720, color: th.ripple, heavy: true });
        spawnBurst(WORLD.CORE_X, WORLD.CORE_Y, th.heavy, 60, 420, 5);
        break;
      case 'pulse':
        ripples.push({ x: WORLD.CORE_X, y: WORLD.CORE_Y, age: 0, dur: 0.6, maxR: 220, color: th.coreGlow, heavy: false });
        break;
      case 'shieldSave':
        flash = { color: 'rgba(255,255,255,0.28)', t: 0.12 };
        spawnBurst(x, y, th.heavy, 10, 200, 3);
        break;
      default:
        break;
    }
  }

  function drawCore(core, th, run) {
    // 能量核主体：径向渐变发光
    const g = ctx.createRadialGradient(core.x, core.y, core.R * 0.2, core.x, core.y, core.R);
    g.addColorStop(0, th.coreInner);
    g.addColorStop(0.72, th.coreEdge);
    g.addColorStop(1, th.coreEdge);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(core.x, core.y, core.R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 旋转能量环（用核心 rotation 制造自转视觉）
    ctx.save();
    ctx.translate(core.x, core.y);
    ctx.rotate(core.rotation);
    ctx.strokeStyle = th.coreGlow;
    ctx.lineWidth = 5;
    ctx.setLineDash([26, 18]);
    ctx.beginPath();
    ctx.arc(0, 0, core.R + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 中心亮点
    ctx.save();
    ctx.fillStyle = th.heavy;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(core.x, core.y, Math.max(6, core.R * 0.16), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBackground(sceneId, th) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, th.bgTop);
    g.addColorStop(1, th.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    const decor = decorFor(sceneId);
    // 星点
    for (const s of decor.stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = th.particle[0];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 装饰弧
    const t = performance.now() / 1000;
    for (const a of decor.arcs) {
      ctx.strokeStyle = th.decorArc;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, a.start + t * a.speed, a.start + t * a.speed + a.len);
      ctx.stroke();
    }
  }

  function drawLauncher(th) {
    ctx.save();
    ctx.strokeStyle = th.coreGlow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(WORLD.LAUNCH_X - 26, WORLD.LAUNCH_Y);
    ctx.lineTo(WORLD.LAUNCH_X + 26, WORLD.LAUNCH_Y);
    ctx.stroke();
    ctx.fillStyle = th.photon;
    ctx.beginPath();
    ctx.moveTo(WORLD.LAUNCH_X, WORLD.LAUNCH_Y - 6);
    ctx.lineTo(WORLD.LAUNCH_X - 10, WORLD.LAUNCH_Y + 12);
    ctx.lineTo(WORLD.LAUNCH_X + 10, WORLD.LAUNCH_Y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPinned(run, th) {
    for (const p of run.pinned) {
      const pos = pinnedPos(run, p);
      const col = p.heavy ? th.heavy : th.photon;
      const glow = p.heavy ? th.heavyGlow : th.photonGlow;
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPhoton(run, th) {
    const ph = run.photon;
    if (!ph) return;
    ctx.save();
    ctx.shadowColor = ph.heavy ? th.heavyGlow : th.photonGlow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = ph.heavy ? th.heavy : th.photon;
    ctx.beginPath();
    ctx.arc(ph.x, ph.y, ph.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 尾迹
    ctx.save();
    ctx.strokeStyle = ph.heavy ? th.heavyGlow : th.photonGlow;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(ph.x, ph.y + ph.r);
    ctx.lineTo(ph.x, ph.y + ph.r + 22);
    ctx.stroke();
    ctx.restore();
  }

  function drawFx(dt) {
    // 粒子
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * (p.life / p.maxLife)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 涟漪（签名脉冲）
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const r = ripples[i];
      r.age += dt;
      if (r.age >= r.dur) { ripples.splice(i, 1); continue; }
      const k = r.age / r.dur;
      const radius = r.maxR * (0.2 + 0.8 * k);
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.heavy ? 6 * (1 - k) + 2 : 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 全屏闪
    if (flash) {
      flash.t -= dt;
      if (flash.t <= 0) flash = null;
      else {
        ctx.save();
        ctx.globalAlpha = Math.max(0, flash.t / 0.25) * 0.5;
        ctx.fillStyle = flash.color;
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        ctx.restore();
      }
    }
  }

  function draw(run, alpha) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;

    const sceneId = run ? sceneAt(run.ring).id : 'blue';
    const th = themeOf(sceneId);
    drawBackground(sceneId, th);

    if (run) {
      for (const core of run.cores) drawCore(core, th, run);
      drawPinned(run, th);
      drawPhoton(run, th);
      drawLauncher(th);
    } else {
      // 标题屏：画一颗静止的展示星核
      drawCore({ x: WORLD.CORE_X, y: WORLD.CORE_Y, R: 200, rotation: performance.now() / 4000 }, th, null);
    }

    drawFx(dt);

    // 暗角
    ctx.save();
    const vg = ctx.createRadialGradient(WORLD.CORE_X, WORLD.CORE_Y, 220, WORLD.CORE_X, WORLD.CORE_Y, 720);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, th.vignette);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.restore();
  }

  return { draw, event };
}

export default createRender;
