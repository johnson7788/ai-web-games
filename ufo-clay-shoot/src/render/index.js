// UFO CLAY SHOOT · Canvas 2D 渲染（霓虹街机风，程序化，零素材）
// 统一调色板：深空底 + 青色网格；玩家暖黄最亮；小/中/大飞碟青/品红/橙；敌人子弹红。
import { WORLD, PLAYER, ENEMIES, ASTEROID, COIN, AMMO, POWERUP, LASER } from '../../config/game.config.js';

const PAL = {
  bg0: '#0a0a20',
  bg1: '#161033',
  grid: 'rgba(80,220,255,0.10)',
  gridBright: 'rgba(80,220,255,0.18)',
  player: '#eaffff',
  playerCore: '#ffffff',
  playerGlow: 'rgba(160,255,255,0.7)',
  enemySmall: '#ff6bd6',
  enemyMedium: '#ff8a3c',
  enemyBig: '#ff3b5c',
  asteroid: '#8a97b4',
  asteroidDark: '#5d6a86',
  coin: '#ffd75e',
  ammo: '#7dff9a',
  power: '#c77dff',
  laser: '#7df3ff',
  enemyLaser: '#ff5d7a',
};

function hexRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 预生成星空（滚动视差）
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({
      x: Math.random() * WORLD.WIDTH,
      y: Math.random() * WORLD.HEIGHT,
      r: 0.5 + Math.random() * 1.6,
      spd: 12 + Math.random() * 40,
      a: 0.25 + Math.random() * 0.5,
    });
  }

  const particles = [];   // { x, y, vx, vy, life, ttl, r, color, gravity }
  let shake = 0;
  let scroll = 0;

  function fx(type, x, y, color) {
    const spawn = (n, opts) => {
      for (let i = 0; i < n && particles.length < 420; i += 1) {
        particles.push({
          x: x + (opts.jx ? (Math.random() - 0.5) * opts.jx : 0),
          y: y + (opts.jy ? (Math.random() - 0.5) * opts.jy : 0),
          vx: (Math.random() - 0.5) * (opts.spd || 120),
          vy: (Math.random() - 0.5) * (opts.spd || 120),
          life: 0,
          ttl: opts.ttl || 0.4,
          r: opts.r || 2.5,
          color: opts.color || PAL.player,
          gravity: opts.gravity || 0,
        });
      }
    };
    if (type === 'shot') spawn(5, { spd: 60, ttl: 0.2, r: 2, color: PAL.laser, jy: 8 });
    else if (type === 'hit') spawn(6, { spd: 140, ttl: 0.25, r: 2, color: '#ffffff' });
    else if (type === 'kill') spawn(22, { spd: 260, ttl: 0.5, r: 3, color: color || '#ffa24d', gravity: 160 });
    else if (type === 'pickupCoin') spawn(8, { spd: 90, ttl: 0.35, r: 2, color: PAL.coin });
    else if (type === 'pickupAmmo') spawn(8, { spd: 90, ttl: 0.35, r: 2, color: PAL.ammo });
    else if (type === 'pickupPower') spawn(10, { spd: 120, ttl: 0.4, r: 2.4, color: PAL.power });
    else if (type === 'invincible') spawn(26, { spd: 220, ttl: 0.6, r: 3, color: '#7df3ff', jx: 40, jy: 30 });
    else if (type === 'lose') spawn(40, { spd: 360, ttl: 0.8, r: 3.4, color: '#ff5d7a', gravity: 200 });
  }

  function addShake(n) { shake = Math.min(12, shake + n); }

  function glowCircle(x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexRgba(color, a));
    g.addColorStop(1, hexRgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawBackground(dt) {
    ctx.fillStyle = PAL.bg0;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0c0c26');
    g.addColorStop(0.5, '#0d0d24');
    g.addColorStop(1, '#1a1038');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    scroll += dt * 30;
    for (const s of stars) {
      s.y += s.spd * dt;
      if (s.y > WORLD.HEIGHT) { s.y = -4; s.x = Math.random() * WORLD.WIDTH; }
      ctx.fillStyle = `rgba(220,235,255,${s.a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // 霓虹网格（水平线，向下间距递增 → 轻微透视）
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    let y = WORLD.PLAY_TOP;
    let gap = 34;
    ctx.beginPath();
    while (y < WORLD.HEIGHT) {
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      y += gap;
      gap *= 1.14;
    }
    ctx.stroke();
    // 垂直网格线
    ctx.strokeStyle = PAL.grid;
    for (let x = 0; x <= WORLD.WIDTH; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, WORLD.PLAY_TOP);
      ctx.lineTo(x, WORLD.HEIGHT);
      ctx.stroke();
    }
    // 顶部地平线光晕
    glowCircle(WORLD.WIDTH / 2, WORLD.PLAY_TOP, 300, '#4a7dff', 0.16);
  }

  function drawPlayer(state, dt) {
    const p = state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (state.invincible) {
      ctx.strokeStyle = hexRgba('#7df3ff', 0.85);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 34 + Math.sin(state.time * 10) * 3, 0, Math.PI * 2);
      ctx.stroke();
      glowCircle(0, 0, 46, '#7df3ff', 0.28);
    }
    if (state.triple > 0) {
      glowCircle(0, 0, 40, PAL.power, 0.22);
    }
    // 引擎尾焰
    const fl = 10 + Math.sin(state.time * 30) * 4;
    ctx.fillStyle = hexRgba('#7df3ff', 0.6);
    ctx.beginPath();
    ctx.moveTo(-7, PLAYER.HEIGHT * 0.42);
    ctx.lineTo(0, PLAYER.HEIGHT * 0.42 + fl);
    ctx.lineTo(7, PLAYER.HEIGHT * 0.42);
    ctx.closePath();
    ctx.fill();
    glowCircle(0, PLAYER.HEIGHT * 0.4, 18, '#7df3ff', 0.5);

    // 船体（白色最亮，一眼区分玩家；视觉放大 1.3×，碰撞盒保持 54×46）
    glowCircle(0, 0, 48, '#a0ffff', 0.6);
    ctx.save();
    ctx.scale(1.3, 1.3);
    ctx.fillStyle = PAL.player;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -PLAYER.HEIGHT * 0.5);          // 机头
    ctx.lineTo(PLAYER.WIDTH * 0.34, PLAYER.HEIGHT * 0.34);
    ctx.lineTo(PLAYER.WIDTH * 0.5, PLAYER.HEIGHT * 0.42);
    ctx.lineTo(0, PLAYER.HEIGHT * 0.34);
    ctx.lineTo(-PLAYER.WIDTH * 0.5, PLAYER.HEIGHT * 0.42);
    ctx.lineTo(-PLAYER.WIDTH * 0.34, PLAYER.HEIGHT * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 驾驶舱
    ctx.fillStyle = PAL.playerCore;
    ctx.beginPath();
    ctx.arc(0, -2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawEnemy(e, idx, state) {
    const cfg = ENEMIES[e.type];
    const col = e.type === 'small' ? PAL.enemySmall : e.type === 'medium' ? PAL.enemyMedium : PAL.enemyBig;
    ctx.save();
    ctx.translate(e.x, e.y);
    glowCircle(0, 0, cfg.w * 0.8, col, 0.3);
    // 机身椭圆
    ctx.fillStyle = hexRgba(col, 0.16);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 2, cfg.w * 0.42, cfg.h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 顶盖
    ctx.fillStyle = hexRgba(col, 0.4);
    ctx.beginPath();
    ctx.ellipse(0, -cfg.h * 0.16, cfg.w * 0.2, cfg.h * 0.24, 0, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    // 底部灯光（闪烁）
    for (let i = -1; i <= 1; i += 1) {
      const blink = (Math.sin(state.time * 8 + idx + i) > 0);
      ctx.fillStyle = blink ? '#ffffff' : hexRgba(col, 0.4);
      ctx.beginPath();
      ctx.arc(i * cfg.w * 0.22, cfg.h * 0.3, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAsteroid(a, idx) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    const r = ASTEROID.R;
    ctx.fillStyle = PAL.asteroid;
    ctx.strokeStyle = PAL.asteroidDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const pts = 9;
    for (let i = 0; i < pts; i += 1) {
      const rr = r * (0.8 + 0.2 * Math.sin(idx * 3.7 + i * 2.4));
      const ang = (i / pts) * Math.PI * 2;
      const px = Math.cos(ang) * rr;
      const py = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 陨石坑
    ctx.fillStyle = PAL.asteroidDark;
    ctx.beginPath();
    ctx.arc(r * 0.25, -r * 0.2, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPickups(state) {
    for (const c of state.coins) {
      glowCircle(c.x, c.y, 18, PAL.coin, 0.5);
      ctx.fillStyle = PAL.coin;
      ctx.beginPath();
      ctx.arc(c.x, c.y, COIN.R * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff3c0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#a97b00';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('¢', c.x, c.y + 4);
    }
    for (const b of state.ammoBoxes) {
      glowCircle(b.x, b.y, 20, PAL.ammo, 0.4);
      ctx.fillStyle = hexRgba(PAL.ammo, 0.2);
      ctx.strokeStyle = PAL.ammo;
      ctx.lineWidth = 2;
      const s = AMMO.R;
      ctx.fillRect(b.x - s, b.y - s, s * 2, s * 2);
      ctx.strokeRect(b.x - s, b.y - s, s * 2, s * 2);
      ctx.fillStyle = PAL.ammo;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('A', b.x, b.y + 5);
    }
    for (const w of state.powerups) {
      glowCircle(w.x, w.y, 22, PAL.power, 0.5);
      ctx.fillStyle = hexRgba(PAL.power, 0.2);
      ctx.strokeStyle = PAL.power;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w.x, w.y - POWERUP.R);
      ctx.lineTo(w.x + POWERUP.R, w.y);
      ctx.lineTo(w.x, w.y + POWERUP.R);
      ctx.lineTo(w.x - POWERUP.R, w.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('3', w.x, w.y + 5);
    }
  }

  function drawLasers(state) {
    for (const l of state.lasers) {
      glowCircle(l.x, l.y, 12, PAL.laser, 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(l.x - LASER.W / 2, l.y - LASER.H / 2, LASER.W, LASER.H);
      ctx.fillStyle = hexRgba(PAL.laser, 0.7);
      ctx.fillRect(l.x - LASER.W / 2, l.y - LASER.H, LASER.W, LASER.H);
    }
    for (const l of state.enemyLasers) {
      glowCircle(l.x, l.y, 9, PAL.enemyLaser, 0.55);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(l.x, l.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.enemyLaser;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(dt) {
    for (const p of particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
      const k = 1 - p.life / p.ttl;
      ctx.fillStyle = hexRgba(p.color, Math.max(0, k));
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.3, p.r * k), 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].life >= particles[i].ttl) particles.splice(i, 1);
    }
  }

  function draw(state, dt, view = {}) {
    if (dt > 0.05) dt = 0.05;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake = Math.max(0, shake - dt * 30);
    }

    drawBackground(dt);
    if (state) {
      drawLasers(state);
      drawPickups(state);
      for (let i = 0; i < state.asteroids.length; i += 1) drawAsteroid(state.asteroids[i], i);
      for (let i = 0; i < state.enemies.length; i += 1) drawEnemy(state.enemies[i], i, state);
      if (state.alive) drawPlayer(state, dt);
      else drawParticles(dt);
    }
    drawParticles(dt);
    ctx.restore();
  }

  function debugLayout() {
    return {
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: WORLD.HUD_H },
      play: { x: 0, y: WORLD.PLAY_TOP, w: WORLD.WIDTH, h: WORLD.HEIGHT - WORLD.PLAY_TOP },
    };
  }

  return { draw, fx, addShake, debugLayout };
}
