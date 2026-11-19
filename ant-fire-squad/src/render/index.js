// ANT FIRE SQUAD · Canvas 2D 渲染（霓虹街机，全部程序化，零素材）
// 逻辑坐标 1280×720；DPR ≤ 2。renderer 内置粒子与震屏，供 main 在事件时调用 spawn()。

import { WORLD, FORGE, ARENA, ANT, WASP, ORB } from '../../config/game.config.js';

const rand = (a, b) => a + Math.random() * (b - a);

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const particles = [];
  let shake = 0;
  let flash = 0;

  function headingOf(ant, state) {
    let tx = ant.tx;
    let ty = ant.ty;
    if (ant.mode === 'carry' || ant.mode === 'unload') { tx = FORGE.x; ty = FORGE.y; }
    else if (ant.mode === 'seek') {
      const orb = state.orbs.find((o) => o.id === ant.orbId);
      if (orb) { tx = orb.x; ty = orb.y; }
    }
    return Math.atan2(ty - ant.y, tx - ant.x);
  }

  function glow(x, y, r, color, alpha = 0.5) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBackground(t) {
    // 深空底
    const bg = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    bg.addColorStop(0, '#070715');
    bg.addColorStop(0.55, '#0b0f26');
    bg.addColorStop(1, '#141033');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 网格
    ctx.strokeStyle = 'rgba(70, 90, 200, 0.10)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.WIDTH; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= WORLD.HEIGHT; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
    }

    // 熔炉底座光晕
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    glow(FORGE.x, FORGE.y, 210, 'rgba(255, 120, 20, 0.55)', 0.35 + pulse * 0.15);
    glow(FORGE.x, FORGE.y, 120, 'rgba(255, 190, 60, 0.6)', 0.5);
  }

  function drawForge(t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    // 外环
    ctx.strokeStyle = 'rgba(255, 150, 40, 0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(FORGE.x, FORGE.y, FORGE.r + 8 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();

    // 熔炉主体
    const core = ctx.createRadialGradient(FORGE.x, FORGE.y - 6, 4, FORGE.x, FORGE.y, FORGE.r);
    core.addColorStop(0, '#fff6d8');
    core.addColorStop(0.35, '#ffd24a');
    core.addColorStop(0.75, '#ff7a1a');
    core.addColorStop(1, '#c22e00');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(FORGE.x, FORGE.y, FORGE.r, 0, Math.PI * 2);
    ctx.fill();

    // 中心白热
    glow(FORGE.x, FORGE.y - 4, 26, 'rgba(255, 255, 255, 0.9)', 0.7 + pulse * 0.2);

    // 火焰舌
    ctx.fillStyle = `rgba(255, 200, 80, ${0.6 + pulse * 0.3})`;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + t * 1.4;
      const fx = FORGE.x + Math.cos(a) * (FORGE.r * 0.55);
      const fy = FORGE.y + Math.sin(a) * (FORGE.r * 0.55);
      const fr = 6 + Math.sin(t * 6 + i) * 3;
      ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawAnt(a, state) {
    const ang = headingOf(a, state);
    const stunned = a.stun > 0;
    const boosting = a.boost > 0;
    ctx.save();
    ctx.translate(a.x, a.y);

    if (stunned) {
      // 眩晕：转圈 + 头上星星
      ctx.rotate(performance.now() / 40);
      ctx.globalAlpha = 0.8;
    } else {
      ctx.rotate(ang);
    }

    // 腿
    ctx.strokeStyle = '#ff9d2e';
    ctx.lineWidth = 2;
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < 3; k += 1) {
        const lx = side * 5;
        const ly = -6 + k * 6;
        const bend = Math.sin(performance.now() / 60 + k * 2) * 3;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(side * (10 + bend), ly + 6);
        ctx.stroke();
      }
    }

    // 身体（腹 + 胸 + 头）
    ctx.fillStyle = stunned ? '#ff6a3a' : '#ff8c1a';
    ctx.beginPath();
    ctx.ellipse(-6, 0, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb84d';
    ctx.beginPath();
    ctx.ellipse(3, 0, 5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe0b0';
    ctx.beginPath();
    ctx.arc(9, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // 触角
    ctx.strokeStyle = '#ffe0b0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12, -1);
    ctx.lineTo(18, -6);
    ctx.moveTo(12, 1);
    ctx.lineTo(18, 6);
    ctx.stroke();

    // 眼睛
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath(); ctx.arc(10, -1.6, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, 1.6, 1.2, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    if (boosting) glow(a.x, a.y, 26, 'rgba(57, 255, 136, 0.5)', 0.6);
    else glow(a.x, a.y, 18, 'rgba(255, 150, 40, 0.5)', 0.45);

    if (stunned) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('✦', a.x + 10, a.y - 16);
    }
  }

  function drawOrb(o, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 + o.id);
    const r = (o.kind === 'egg' ? 13 : 9) + pulse * 2;
    const color = o.kind === 'egg' ? '#ffd24a' : '#35f0ff';
    glow(o.x, o.y, r * 3, color, 0.6);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(o.x - r * 0.3, o.y - r * 0.3, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWasp(w, t) {
    const ang = Math.atan2(FORGE.y - w.y, FORGE.x - w.x);
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(ang);
    // 翅膀
    ctx.fillStyle = 'rgba(224, 179, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-2, -8, 10, 5, -0.5, 0, Math.PI * 2);
    ctx.ellipse(-2, 8, 10, 5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    // 身体
    ctx.fillStyle = '#c44dff';
    ctx.beginPath();
    ctx.ellipse(-4, 0, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c8ff';
    ctx.beginPath();
    ctx.arc(7, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // 毒针
    ctx.strokeStyle = '#ff3b6b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-19, 0);
    ctx.stroke();
    // 眼睛
    ctx.fillStyle = '#2a0033';
    ctx.beginPath(); ctx.arc(8, -1.8, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 1.8, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    glow(w.x, w.y, 24, 'rgba(196, 77, 255, 0.55)', 0.6);
    // 血条（hp>1 才显示）
    if (w.hp > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(w.x - 12, w.y - 20, 24, 4);
      ctx.fillStyle = '#ff3b6b';
      ctx.fillRect(w.x - 12, w.y - 20, 24 * (w.hp / 3), 4);
    }
  }

  function drawSoldier(s) {
    glow(s.x, s.y, 22, 'rgba(127, 212, 255, 0.7)', 0.7);
    ctx.fillStyle = '#7fd4ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSpecial(s, t) {
    if (s.kind === 'bomb') {
      const blink = Math.sin(t * 16) > 0 ? 1 : 0.4;
      glow(s.x, s.y, 30, `rgba(255, 59, 59, ${0.7 * blink})`, 0.8);
      ctx.fillStyle = '#ff3b3b';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x + 8, s.y - 8);
      ctx.quadraticCurveTo(s.x + 18, s.y - 18, s.x + 22, s.y - 30);
      ctx.stroke();
    } else if (s.kind === 'boost') {
      ctx.strokeStyle = 'rgba(57, 255, 136, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 26 + (1 - s.ttl / 0.8) * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#39ff88';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', s.x, s.y + 7);
      ctx.textAlign = 'start';
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.vy += 60 * dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return {
    spawn(x, y, color, n = 8, speed = 160) {
      for (let i = 0; i < n; i += 1) {
        const a = rand(0, Math.PI * 2);
        const v = rand(speed * 0.3, speed);
        particles.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
          r: rand(1.5, 4), life: rand(0.3, 0.7), maxLife: 0.7, color,
        });
      }
    },
    addShake(n) { shake = Math.max(shake, n); },
    flash() { flash = 0.18; },

    draw(state, dt, view = {}) {
      const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
      ctx.save();
      if (shake > 0) {
        ctx.translate(rand(-shake, shake), rand(-shake, shake));
        shake = Math.max(0, shake - dt * 22);
      }
      drawBackground(t);
      drawForge(t);

      if (state && state.ants) {
        for (const o of state.orbs) drawOrb(o, t);
        for (const s of state.specials) drawSpecial(s, t);
        for (const w of state.wasps) drawWasp(w, t);
        for (const s of state.soldiers) drawSoldier(s);
        for (const a of state.ants) drawAnt(a, state);
      }
      drawParticles(dt);

      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flash / 0.18 * 0.6})`;
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        flash = Math.max(0, flash - dt);
      }
      ctx.restore();
    },

    drawAttract(t) {
      // 标题屏：背景 + 熔炉 + 程序化巡逻火蚁（无 sim）
      const state = {
        ants: [
          { id: 1, x: 400 + Math.sin(t * 0.7) * 120, y: 360, tx: 400, ty: 500, mode: 'wander', orbId: null, stun: 0, boost: 0 },
          { id: 2, x: 640, y: 300, tx: 900, ty: 320, mode: 'wander', orbId: null, stun: 0, boost: 0 },
          { id: 3, x: 860 + Math.cos(t * 0.6) * 100, y: 420, tx: 400, ty: 420, mode: 'wander', orbId: null, stun: 0, boost: 0 },
        ],
        orbs: [
          { id: 9, x: 300 + Math.sin(t * 1.3) * 40, y: 300, weight: 1, kind: 'ember', claimedBy: null, carriedBy: null, age: 0 },
          { id: 10, x: 980, y: 260 + Math.cos(t * 1.1) * 30, weight: 1, kind: 'ember', claimedBy: null, carriedBy: null, age: 0 },
          { id: 11, x: 700, y: 480, weight: 5, kind: 'egg', claimedBy: null, carriedBy: null, age: 0 },
        ],
        wasps: [], soldiers: [], specials: [],
      };
      ctx.save();
      drawBackground(t);
      drawForge(t);
      for (const o of state.orbs) drawOrb(o, t);
      for (const a of state.ants) drawAnt(a, state);
      drawParticles(0.016);
      ctx.restore();
    },
  };
}
