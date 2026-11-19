// GUN GOD ARENA · Canvas 2D 渲染（霓虹街机风，程序化，零素材）
// 统一调色板：深空底 + 青色网格；玩家炮台最亮；琥珀全息靶 = 目标；绿色 = VIP 勿打；
// 青色箱子 = 道具；品红岩石 = 可打落的陷阱；白色弹头 + 青色拖尾。
import { WORLD, GUN, BULLET, TARGET, CRATE, ROCK, POWERUP } from '../../config/game.config.js';

const PAL = {
  bg0: '#06060f',
  bg1: '#101028',
  grid: 'rgba(90,220,255,0.10)',
  gridBright: 'rgba(90,220,255,0.20)',
  gun: '#eaffff',
  gunGlow: 'rgba(160,255,255,0.7)',
  target: '#ffd75e',
  targetCore: '#fff3c0',
  vip: '#7dff9a',
  crate: '#5ee6ff',
  rock: '#ff6bd6',
  bullet: '#7df3ff',
  bulletCore: '#ffffff',
  power: {
    ammo: '#7dff9a',
    triple: '#c77dff',
    star: '#ffffff',
    bomb: '#ff5d7a',
  },
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

  const stars = [];
  for (let i = 0; i < 70; i += 1) {
    stars.push({
      x: Math.random() * WORLD.WIDTH,
      y: Math.random() * WORLD.HEIGHT,
      r: 0.5 + Math.random() * 1.5,
      spd: 8 + Math.random() * 28,
      a: 0.2 + Math.random() * 0.5,
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
          color: opts.color || PAL.target,
          gravity: opts.gravity || 0,
        });
      }
    };
    if (type === 'shot') spawn(6, { spd: 70, ttl: 0.2, r: 2, color: PAL.bullet, jy: 8 });
    else if (type === 'kill') spawn(26, { spd: 280, ttl: 0.5, r: 3, color: color || PAL.target, gravity: 160 });
    else if (type === 'crate') spawn(14, { spd: 160, ttl: 0.4, r: 2.4, color: PAL.crate });
    else if (type === 'rock') spawn(12, { spd: 150, ttl: 0.4, r: 2.4, color: PAL.rock });
    else if (type === 'boom') spawn(34, { spd: 340, ttl: 0.6, r: 3.2, color: PAL.power.bomb, gravity: 120 });
    else if (type === 'pickup') spawn(12, { spd: 120, ttl: 0.4, r: 2.4, color: color || PAL.power.star });
    else if (type === 'vipfail') spawn(30, { spd: 300, ttl: 0.6, r: 3, color: PAL.vip });
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
    g.addColorStop(0, '#0a0a20');
    g.addColorStop(0.55, '#0c0c22');
    g.addColorStop(1, '#150e2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    scroll += dt * 22;
    for (const s of stars) {
      s.y += s.spd * dt;
      if (s.y > WORLD.HEIGHT) { s.y = -4; s.x = Math.random() * WORLD.WIDTH; }
      ctx.fillStyle = `rgba(220,235,255,${s.a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // 霓虹网格（垂直 + 水平，轻微透视）
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.WIDTH; x += 64) {
      ctx.moveTo(x, WORLD.PLAY_TOP);
      ctx.lineTo(x, WORLD.HEIGHT);
    }
    let y = WORLD.PLAY_TOP;
    let gap = 30;
    while (y < WORLD.HEIGHT) {
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      y += gap;
      gap *= 1.12;
    }
    ctx.stroke();

    // 顶部地平线光晕 + 底部炮台区
    glowCircle(WORLD.WIDTH / 2, WORLD.PLAY_TOP, 320, '#4a7dff', 0.16);
    glowCircle(GUN.X, GUN.Y, 220, '#5ee6ff', 0.12);
  }

  function drawHoloDrone(x, y, color, state, idx, label) {
    ctx.save();
    ctx.translate(x, y);
    const pulse = 0.8 + 0.2 * Math.sin(state.time * 6 + idx);
    const R = TARGET.R * 1.18;
    glowCircle(0, 0, 46 * pulse, color, 0.55);
    // 外环（更粗更亮）
    ctx.strokeStyle = hexRgba(color, 1);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    // 准星刻度
    ctx.strokeStyle = hexRgba(color, 0.7);
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (R + 3), Math.sin(a) * (R + 3));
      ctx.lineTo(Math.cos(a) * (R + 9), Math.sin(a) * (R + 9));
      ctx.stroke();
    }
    // 内芯（更亮更大）
    ctx.fillStyle = hexRgba(color, 0.34);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.targetCore;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.26, 0, Math.PI * 2);
    ctx.fill();
    // 标记
    if (label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, R + 18);
    }
    ctx.restore();
  }

  function drawGun(state) {
    const a = state.gunAngle;
    const muzzle = {
      x: GUN.X + Math.cos(a) * GUN.LENGTH,
      y: GUN.Y + Math.sin(a) * GUN.LENGTH,
    };
    // 瞄准虚线
    ctx.save();
    ctx.strokeStyle = 'rgba(255,215,94,0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(muzzle.x, muzzle.y);
    ctx.lineTo(muzzle.x + Math.cos(a) * 900, muzzle.y + Math.sin(a) * 900);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 底座（更亮更大，作为玩家剪影锚点）
    glowCircle(GUN.X, GUN.Y, 60, '#a0ffff', 0.85);
    ctx.fillStyle = '#1c3550';
    ctx.strokeStyle = PAL.gun;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(GUN.X, GUN.Y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(GUN.X, GUN.Y, 14, 0, Math.PI * 2);
    ctx.fill();

    // 炮管（沿 gunAngle，加粗加亮）
    ctx.save();
    ctx.translate(GUN.X, GUN.Y);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = PAL.gun;
    ctx.lineWidth = 2.5;
    const w = 15;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.lineTo(0, GUN.LENGTH + 10);
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 枪口
    glowCircle(muzzle.x, muzzle.y, 12, '#ffffff', 0.8);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(muzzle.x, muzzle.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBullets(state) {
    for (const b of state.bulletsFlying) {
      glowCircle(b.x, b.y, 16, PAL.bullet, 0.6);
      ctx.fillStyle = PAL.bulletCore;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET.R * 0.8, 0, Math.PI * 2);
      ctx.fill();
      // 拖尾
      const a = Math.atan2(b.vy, b.vx);
      ctx.strokeStyle = hexRgba(PAL.bullet, 0.7);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - Math.cos(a) * 22, b.y - Math.sin(a) * 22);
      ctx.stroke();
    }
  }

  function drawCrates(state) {
    for (const c of state.crates) {
      glowCircle(c.x, c.y, 28, PAL.crate, 0.4);
      ctx.fillStyle = hexRgba(PAL.crate, 0.16);
      ctx.strokeStyle = PAL.crate;
      ctx.lineWidth = 2.5;
      ctx.fillRect(c.x - CRATE.R, c.y - CRATE.R, CRATE.R * 2, CRATE.R * 2);
      ctx.strokeRect(c.x - CRATE.R, c.y - CRATE.R, CRATE.R * 2, CRATE.R * 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', c.x, c.y + 6);
    }
  }

  function drawRocks(state) {
    for (const r of state.rocks) {
      glowCircle(r.x, r.y, 30, PAL.rock, 0.35);
      ctx.fillStyle = '#2a1230';
      ctx.strokeStyle = PAL.rock;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const pts = 7;
      for (let i = 0; i < pts; i += 1) {
        const rr = ROCK.R * (0.8 + 0.2 * Math.sin(i * 2.7));
        const ang = (i / pts) * Math.PI * 2;
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PAL.rock;
      ctx.beginPath();
      ctx.arc(r.x, r.y, ROCK.R * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPowerups(state) {
    for (const p of state.powerups) {
      const col = PAL.power[p.kind] || PAL.power.star;
      glowCircle(p.x, p.y, 24, col, 0.55);
      ctx.fillStyle = hexRgba(col, 0.2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, POWERUP.R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      const sym = p.kind === 'ammo' ? 'A' : p.kind === 'triple' ? '3' : p.kind === 'star' ? 'S' : 'B';
      ctx.fillText(sym, p.x, p.y + 4);
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

  function draw(state, dt) {
    if (dt > 0.05) dt = 0.05;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake = Math.max(0, shake - dt * 30);
    }

    drawBackground(dt);
    if (state) {
      drawPowerups(state);
      drawRocks(state);
      drawCrates(state);
      for (let i = 0; i < state.vips.length; i += 1) drawHoloDrone(state.vips[i].x, state.vips[i].y, PAL.vip, state, i, 'VIP');
      for (let i = 0; i < state.targets.length; i += 1) drawHoloDrone(state.targets[i].x, state.targets[i].y, PAL.target, state, i, null);
      drawBullets(state);
      if (state.phase !== 'result') drawGun(state);
    }
    drawParticles(dt);
    ctx.restore();
  }

  return { draw, fx, addShake };
}
