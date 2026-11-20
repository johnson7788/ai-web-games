// src/render/index.js — Canvas 2D 渲染：三场景包（晨云/雨后/夜空）+ 字母泡泡 + 粒子 + 彩虹桥。
// 纯程序化，不引外部素材。场景包换章必换（色板 + 构图 + 装饰）。
import { WORLD } from '../../config/game.config.js';
import { PLAY } from '../../config/gameplay.js';

const SCENES = {
  morning: {
    skyTop: '#ffe3ef', skyBottom: '#fff7fb',
    clouds: ['#ffffff', '#ffd6e8'],
    glow: 'rgba(255,214,232,0.5)',
  },
  rain: {
    skyTop: '#b9d9ff', skyBottom: '#eef7ff',
    clouds: ['#ffffff', '#cfe6ff'],
    glow: 'rgba(255,255,255,0.5)',
  },
  night: {
    skyTop: '#0a0f2e', skyBottom: '#1c2650',
    clouds: ['#2b3568', '#232c58'],
    glow: 'rgba(140,160,255,0.3)',
  },
};

const RAINBOW = ['#ff5d73', '#ffb347', '#ffe066', '#7ce06c', '#54c8ff', '#a48aff'];

function letterHue(letter) {
  const idx = (letter || 'A').toUpperCase().charCodeAt(0) - 65;
  return ((idx * 137.5) % 360);
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const particles = [];
  let bridgeUntil = -1;
  let lastNow = performance.now();
  let sceneId = 'morning';
  let starSeed = 0;

  function drawSky(scene) {
    const pal = SCENES[scene] || SCENES.morning;
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    if (scene === 'morning' || scene === 'rain') {
      drawClouds(pal);
    }
    if (scene === 'rain') drawRainbowArcs();
    if (scene === 'night') drawStars();
  }

  function drawClouds(pal) {
    ctx.save();
    for (let i = 0; i < 7; i += 1) {
      const cx = ((i * 197) + 60) % WORLD.WIDTH;
      const cy = 120 + ((i * 89) % 420);
      const s = 0.7 + ((i * 37) % 10) / 12;
      ctx.fillStyle = pal.clouds[i % 2];
      ctx.globalAlpha = 0.5 + ((i * 53) % 10) / 22;
      cloud(ctx, cx, cy, 60 * s);
    }
    ctx.restore();
  }

  function cloud(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.9, y - r * 0.3, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 1.6, y, r * 0.85, 0, Math.PI * 2);
    ctx.arc(x + r * 0.8, y + r * 0.4, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRainbowArcs() {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 12;
    const cx = WORLD.WIDTH / 2;
    const cy = WORLD.HEIGHT + 120;
    for (let i = 0; i < RAINBOW.length; i += 1) {
      ctx.strokeStyle = RAINBOW[i];
      ctx.beginPath();
      ctx.arc(cx, cy, 620 - i * 14, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStars() {
    ctx.save();
    starSeed += 1;
    for (let i = 0; i < 70; i += 1) {
      const x = ((i * 173) % WORLD.WIDTH);
      const y = ((i * 97) % (WORLD.HEIGHT - 160));
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(starSeed * 0.03 + i));
      ctx.fillStyle = `rgba(255,255,255,${tw})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    // 月亮
    ctx.fillStyle = '#f7f3d8';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(WORLD.WIDTH - 150, 130, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#dcd6b2';
    ctx.beginPath();
    ctx.arc(WORLD.WIDTH - 138, 116, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBubble(ctx, b, time) {
    const hue = letterHue(b.letter);
    const jx = b.shaking ? Math.sin(time * 42 + b.id * 3) * 7 : 0;
    const jy = b.shaking ? Math.cos(time * 38 + b.id * 5) * 5 : 0;
    const x = b.x + jx;
    const y = b.y + jy;

    // 泡泡本体（糖果气球）
    const g = ctx.createRadialGradient(x - b.r * 0.35, y - b.r * 0.4, b.r * 0.15, x, y, b.r);
    g.addColorStop(0, `hsla(${hue}, 90%, 88%, 0.95)`);
    g.addColorStop(0.6, `hsla(${hue}, 85%, 72%, 0.95)`);
    g.addColorStop(1, `hsla(${hue}, 80%, 58%, 0.95)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, b.r, 0, Math.PI * 2);
    ctx.fill();

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(x - b.r * 0.34, y - b.r * 0.42, b.r * 0.22, b.r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();

    // 字母
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(b.r * 1.15)}px "PingFang SC", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = `hsla(${hue}, 70%, 40%, 0.9)`;
    ctx.strokeText(b.letter, x, y + 2);
    ctx.fillText(b.letter, x, y + 2);
  }

  function drawBridge(now) {
    if (now > bridgeUntil) return;
    const t = 1 - (bridgeUntil - now) / 2600;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.6) * 0.8;
    ctx.lineWidth = 16;
    const cx = WORLD.WIDTH / 2;
    const cy = 60;
    for (let i = 0; i < RAINBOW.length; i += 1) {
      ctx.strokeStyle = RAINBOW[i];
      ctx.beginPath();
      ctx.arc(cx, cy, 300 + i * 18, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.6));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function draw(run) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;

    const hud = run ? run.getHud() : { scene: sceneId };
    sceneId = hud.scene || sceneId;
    drawSky(sceneId);

    if (run) {
      for (const b of run.bubbles) drawBubble(ctx, b, run.time);
      updateParticles(dt);
      drawParticles();
      drawBridge(now);
    } else {
      updateParticles(dt);
      drawParticles();
    }
  }

  function burst(x, y, color) {
    const n = 12;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const sp = 80 + Math.random() * 160;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        r: 3 + Math.random() * 4,
        life: 0.5 + Math.random() * 0.3,
        color,
      });
    }
  }

  function flashBridge() {
    bridgeUntil = performance.now() + 2600;
  }

  return {
    draw,
    burst,
    flashBridge,
    get scene() { return sceneId; },
  };
}

export default createRender;
