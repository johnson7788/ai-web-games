// src/render/index.js — 霓虹街机 Canvas 渲染器（程序化，零素材）
// 职责：背景 / 障碍 / 俘虏 / 敌机（带红色警告标记）/ 炮塔 / 弹体 / 拖拽弹道预览 / 粒子 / 震屏。
import { WORLD, PLAYER, BOLT, ENEMY_BOLT, CAPTIVE } from '../../config/gameplay.js';
import { sceneById } from '../../config/levels.js';

const TAU = Math.PI * 2;
const MAX_PARTICLES = 520;
const DPR_CAP = 2;

function colorForScene(scene) {
  return sceneById(scene).palette;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let shake = 0;
  let reducedMotion = false;
  let time = 0;
  if (typeof matchMedia === 'function') {
    try { reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { reducedMotion = false; }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const w = Math.floor(WORLD.WIDTH * dpr);
    const h = Math.floor(WORLD.HEIGHT * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  if (typeof window !== 'undefined') window.addEventListener('resize', resize);

  function burst(x, y, kind) {
    if (reducedMotion) return;
    let count = 0;
    let color = '#45f3ff';
    let speed = 220;
    if (kind === 'muzzle') { count = 6; color = '#aefcff'; speed = 260; }
    else if (kind === 'hit') { count = 8; color = '#ffd24a'; speed = 180; }
    else if (kind === 'kill') { count = 16; color = '#ff5a3c'; speed = 320; }
    else if (kind === 'explosion') { count = 22; color = '#ffb454'; speed = 420; }
    else if (kind === 'captive') { count = 14; color = '#4fa8ff'; speed = 260; }
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * TAU;
      const sp = speed * (0.4 + Math.random() * 0.8);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        color,
        size: 2 + Math.random() * 3,
      });
    }
    if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
  }

  function setShake(n) {
    if (reducedMotion) return;
    shake = Math.max(shake, n);
  }

  function stepParticles(dt) {
    if (reducedMotion) { particles = []; return; }
    const remaining = [];
    for (const p of particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      remaining.push(p);
    }
    particles = remaining;
  }

  function drawBackground(pal) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, pal.bgTop);
    g.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 网格
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    for (let x = 40; x < WORLD.WIDTH; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
    }
    for (let y = 40; y < WORLD.HEIGHT; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
    }

    // 顶部/底部霓虹地平线
    ctx.fillStyle = pal.neon;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, WORLD.HEIGHT - 8, WORLD.WIDTH, 2);
    ctx.fillRect(0, 70, WORLD.WIDTH, 2);
    ctx.globalAlpha = 1;
  }

  function glow(color, blur = 12) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function noGlow() {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  function drawEnemy(e, timeNow) {
    const bob = Math.sin(timeNow * 3 + e.id) * 4;
    const y = e.y + bob;
    // 警告标记（红色「!」徽章）
    ctx.save();
    const by = y - e.radius - 20;
    glow('#ff2e4d', 10);
    ctx.fillStyle = '#ff2e4d';
    ctx.beginPath();
    ctx.arc(e.x, by, 11, 0, TAU);
    ctx.fill();
    noGlow();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', e.x, by + 1);
    ctx.restore();

    glow('#ff5a3c', 14);
    ctx.fillStyle = '#ff5a3c';
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 2;
    if (e.type === 'scout') {
      ctx.beginPath();
      ctx.moveTo(e.x, y - e.radius);
      ctx.lineTo(e.x + e.radius, y + e.radius * 0.6);
      ctx.lineTo(e.x - e.radius, y + e.radius * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.type === 'turret') {
      ctx.beginPath();
      ctx.arc(e.x, y, e.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      // 炮管朝向玩家
      const ang = Math.atan2(PLAYER.Y - y, PLAYER.X - e.x);
      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(e.x, y);
      ctx.lineTo(e.x + Math.cos(ang) * (e.radius + 12), y + Math.sin(ang) * (e.radius + 12));
      ctx.stroke();
    } else {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU + Math.PI / 6;
        const px = e.x + Math.cos(a) * e.radius;
        const py = y + Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    noGlow();

    // 血条 pips
    if (e.maxHp > 1) {
      for (let i = 0; i < e.maxHp; i += 1) {
        ctx.fillStyle = i < e.hp ? '#ffd24a' : 'rgba(255,255,255,0.22)';
        ctx.fillRect(e.x - ((e.maxHp - 1) * 12) / 2 + i * 12, y + e.radius + 6, 8, 5);
      }
    }
  }

  function drawObstacle(o, pal, timeNow) {
    const hw = o.w / 2;
    const hh = o.h / 2;
    if (o.type === 'glass') {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = pal.neon;
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(69,243,255,0.10)';
      ctx.fillRect(o.x - hw, o.y - hh, o.w, o.h);
      ctx.strokeRect(o.x - hw, o.y - hh, o.w, o.h);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    if (o.type === 'core') {
      const pulse = 1 + Math.sin(timeNow * 6) * 0.18;
      glow(pal.neon2, 18);
      ctx.fillStyle = '#ffd24a';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(o.x, o.y, hw * pulse, 0, TAU);
      ctx.fill();
      ctx.stroke();
      noGlow();
      return;
    }
    if (o.type === 'brick') {
      ctx.fillStyle = '#5a2a3a';
      ctx.strokeStyle = pal.neon;
      ctx.lineWidth = 2;
      ctx.fillRect(o.x - hw, o.y - hh, o.w, o.h);
      ctx.strokeRect(o.x - hw, o.y - hh, o.w, o.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(o.x - hw, o.y);
      ctx.lineTo(o.x + hw, o.y);
      ctx.moveTo(o.x, o.y - hh);
      ctx.lineTo(o.x, o.y + hh);
      ctx.stroke();
      return;
    }
    // box
    ctx.fillStyle = '#2a3a55';
    ctx.strokeStyle = pal.neon;
    ctx.lineWidth = 2;
    ctx.fillRect(o.x - hw, o.y - hh, o.w, o.h);
    ctx.strokeRect(o.x - hw, o.y - hh, o.w, o.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x - hw + 8, o.y - hh + 8, o.w - 16, o.h - 16);
  }

  function drawCaptive(c, timeNow) {
    const bob = Math.sin(timeNow * 2.6 + c.id) * 3;
    const y = c.y + bob;
    glow('#4fa8ff', 14);
    ctx.fillStyle = 'rgba(79,168,255,0.25)';
    ctx.strokeStyle = '#4fa8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x, y - c.radius);
    ctx.lineTo(c.x + c.radius, y);
    ctx.lineTo(c.x, y + c.radius);
    ctx.lineTo(c.x - c.radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    noGlow();
    ctx.fillStyle = '#eaf6ff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✚', c.x, y);
  }

  function drawPlayer(p, pal) {
    const { x, y, radius } = p;
    glow(pal.neon, 14);
    ctx.fillStyle = '#0e2a2a';
    ctx.strokeStyle = '#54ff9f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.stroke();
    noGlow();

    // 炮管指向当前瞄准点（由外部传入？用内部暂存 angle）
    const ang = drawPlayer._angle ?? -Math.PI / 2;
    glow('#54ff9f', 8);
    ctx.strokeStyle = '#54ff9f';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * (radius + 22), y + Math.sin(ang) * (radius + 22));
    ctx.stroke();
    noGlow();
  }

  function drawBolt(b) {
    glow('#45f3ff', 12);
    ctx.strokeStyle = 'rgba(69,243,255,0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, BOLT.RADIUS, 0, TAU);
    ctx.fill();
    noGlow();
  }

  function drawEnemyBolt(b) {
    glow('#ff5a3c', 10);
    ctx.fillStyle = '#ff8a5c';
    ctx.beginPath();
    ctx.arc(b.x, b.y, ENEMY_BOLT.RADIUS, 0, TAU);
    ctx.fill();
    noGlow();
  }

  function drawTrajectory(run, pal) {
    const px = run.player.x;
    const py = run.player.y;
    const dx = run.aim.x - px;
    const dy = run.aim.y - py;
    const len = Math.hypot(dx, dy);
    if (len < 8) return;
    const nx = dx / len;
    const ny = dy / len;

    // 拖拽虚线
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = pal.neon;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + nx * (PLAYER.RADIUS + 6), py + ny * (PLAYER.RADIUS + 6));
    ctx.lineTo(run.aim.x, run.aim.y);
    ctx.stroke();
    ctx.restore();

    // 弹道预览（重力弧线）
    let vx = nx * BOLT.SPEED;
    let vy = ny * BOLT.SPEED;
    let x = px + nx * (PLAYER.RADIUS + BOLT.RADIUS + 2);
    let y = py + ny * (PLAYER.RADIUS + BOLT.RADIUS + 2);
    ctx.fillStyle = pal.neon;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 22; i += 1) {
      vy += BOLT.GRAVITY * (1 / 60);
      x += vx * (1 / 60);
      y += vy * (1 / 60);
      if (x < 8 || x > WORLD.WIDTH - 8 || y < 8 || y > WORLD.HEIGHT - 8) break;
      ctx.beginPath();
      ctx.arc(x, y, i % 3 === 0 ? 3.5 : 2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(run, alpha = 1) {
    time += reducedMotion ? 0 : 1 / 60;
    const pal = run ? colorForScene(run.scene) : colorForScene('foundry');

    ctx.save();
    if (shake > 0) {
      const sx = (Math.random() - 0.5) * shake;
      const sy = (Math.random() - 0.5) * shake;
      ctx.translate(sx, sy);
      shake = Math.max(0, shake - 0.6);
    }

    drawBackground(pal);

    if (run) {
      for (const o of run.obstacles) drawObstacle(o, pal, time);
      for (const c of run.captives) drawCaptive(c, time);
      for (const e of run.enemies) drawEnemy(e, time);
      // 炮管角度
      const ang = run.aim.active
        ? Math.atan2(run.aim.y - run.player.y, run.aim.x - run.player.x)
        : -Math.PI / 2;
      drawPlayer._angle = ang;
      drawPlayer(run.player, pal);
      for (const b of run.enemyBolts) drawEnemyBolt(b);
      for (const b of run.bolts) drawBolt(b);
      if (run.aim.active) drawTrajectory(run, pal);
    } else {
      // 标题背景：只画网格与一点氛围
      drawPlayer._angle = -Math.PI / 2;
    }

    stepParticles(1 / 60);
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  return { draw, burst, setShake, resize };
}
