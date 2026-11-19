// DRIFT KING CN · Canvas 2D 渲染：霓虹网格 + 漂移车 + 幽灵车 + 霓虹柱 + 道具 + 粒子。
// 所有美术程序化，零图片零外链。DPR ≤2；prefers-reduced-motion 由 main 控制动效幅度。
import { WORLD, GAME, CAR_LV } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const TAU = Math.PI * 2;
const deg2rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const particles = [];
  const trail = [];
  const TRAIL_MAX = reduceMotion ? 0 : 42;

  function spawn(type, x, y) {
    if (reduceMotion && type !== 'death') return;
    const n = type === 'explosion' ? 18 : type === 'spark' ? 6 : type === 'starPop' ? 10 : 6;
    const colors = {
      explosion: ['#ff5d8f', '#ffa23d', '#ffd23d', '#ffffff'],
      spark: ['#8ff3ff', '#ffffff'],
      starPop: ['#ffd23d', '#fff6c0'],
      ring: ['#8ff3ff'],
      pylonPop: ['#ff4fd8', '#8ff3ff'],
      hurt: ['#ff3b3b', '#ffffff'],
    }[type] || ['#ffffff'];
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const sp = type === 'ring' ? 0 : 60 + Math.random() * 260;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        maxLife: type === 'ring' ? 0.4 : 0.5 + Math.random() * 0.5,
        size: type === 'ring' ? 30 : 1.5 + Math.random() * 3,
        color: colors[(Math.random() * colors.length) | 0],
        ring: type === 'ring',
      });
    }
  }

  function drawGrid(camX, camY, time) {
    ctx.fillStyle = '#0a0618';
    ctx.fillRect(0, 0, W, H);
    // 远景辉光
    const grad = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, '#241343');
    grad.addColorStop(1, '#0a0618');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 滚动网格（世界坐标对齐，随相机滚动）
    const cell = 64;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120, 90, 200, 0.16)';
    const ox = ((camX % cell) + cell) % cell;
    const oy = ((camY % cell) + cell) % cell;
    ctx.beginPath();
    for (let gx = -ox; gx <= W; gx += cell) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
    for (let gy = -oy; gy <= H; gy += cell) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
    ctx.stroke();

    // 主网格线（每 256px）
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(180, 120, 255, 0.22)';
    const cell2 = 256;
    const ox2 = ((camX % cell2) + cell2) % cell2;
    const oy2 = ((camY % cell2) + cell2) % cell2;
    ctx.beginPath();
    for (let gx = -ox2; gx <= W; gx += cell2) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
    for (let gy = -oy2; gy <= H; gy += cell2) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
    ctx.stroke();

    // 散落的霓虹亮点（固定世界坐标，随相机滚动）
    ctx.save();
    for (let ix = -1; ix <= Math.ceil(W / 180) + 1; ix += 1) {
      for (let iy = -1; iy <= Math.ceil(H / 180) + 1; iy += 1) {
        const wx = Math.floor((camX) / 180) * 180 + ix * 180 + 90;
        const wy = Math.floor((camY) / 180) * 180 + iy * 180 + 90;
        const sx = wx - camX + W / 2;
        const sy = wy - camY + H / 2;
        if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
        const h = ((wx * 7 + wy * 13) % 360 + 360) % 360;
        ctx.fillStyle = `hsla(${h}, 90%, 65%, 0.5)`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.6 + 0.6 * Math.sin(time * 2 + wx), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    // 边缘暗角
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  function drawCar(x, y, heading, color, r, opts = {}) {
    const glow = opts.glowColor || color;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(deg2rad(heading + 90));
    // 车体（箭头）
    ctx.shadowColor = glow;
    ctx.shadowBlur = opts.shadowBlur != null ? opts.shadowBlur : 18;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (opts.shape === 'diamond') {
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.8, 0);
    } else {
      // 玩家：尖箭头
      ctx.moveTo(0, -r * 1.4);
      ctx.lineTo(r * 0.95, r);
      ctx.lineTo(0, r * 0.55);
      ctx.lineTo(-r * 0.95, r);
    }
    ctx.closePath();
    ctx.fill();
    // 亮核
    ctx.shadowBlur = 0;
    ctx.fillStyle = opts.coreColor || 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    if (opts.shape === 'diamond') {
      ctx.arc(0, 0, r * 0.32, 0, TAU);
    } else {
      ctx.moveTo(0, -r * 0.55);
      ctx.lineTo(r * 0.34, r * 0.35);
      ctx.lineTo(0, r * 0.2);
      ctx.lineTo(-r * 0.34, r * 0.35);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTrail(state, camX, camY) {
    if (!state) return;
    if (trail.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < trail.length - 1; i += 1) {
      const a = trail[i];
      const b = trail[i + 1];
      const alpha = (i / trail.length) * 0.5;
      ctx.strokeStyle = `rgba(120, 240, 255, ${alpha})`;
      ctx.lineWidth = 1 + (i / trail.length) * 4;
      ctx.beginPath();
      ctx.moveTo(a.x - camX + W / 2, a.y - camY + H / 2);
      ctx.lineTo(b.x - camX + W / 2, b.y - camY + H / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pushTrail(state) {
    if (!state || reduceMotion) return;
    if (state.mode === 'idle') {
      trail.push({ x: state.player.x, y: state.player.y });
    } else {
      trail.push({ x: state.player.x, y: state.player.y });
      trail.push({ x: state.player.x, y: state.player.y });
    }
    if (trail.length > TRAIL_MAX) trail.splice(0, trail.length - TRAIL_MAX);
  }

  function drawProp(p, camX, camY) {
    const sx = p.x - camX + W / 2;
    const sy = p.y - camY + H / 2;
    if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) return;
    ctx.save();
    ctx.translate(sx, sy);
    if (p.propKind === 'star') {
      ctx.shadowColor = '#ffd23d';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffd23d';
      drawStar(ctx, 0, 0, 5, 14, 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff6c0';
      drawStar(ctx, 0, 0, 5, 6, 2.6);
    } else if (p.propKind === 'bomb') {
      ctx.shadowColor = '#c95bff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#a23bff';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e2c8ff';
      ctx.fillRect(-2, -16, 4, 5);
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath(); ctx.arc(0, -18, 3, 0, TAU); ctx.fill();
    } else if (p.propKind === 'shield') {
      ctx.shadowColor = '#3ee6ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#1fc8ff';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(11, -7);
      ctx.lineTo(9, 8);
      ctx.lineTo(0, 14);
      ctx.lineTo(-9, 8);
      ctx.lineTo(-11, -7);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(0, -2, 4, 0, TAU); ctx.fill();
    } else if (p.propKind === 'range') {
      ctx.shadowColor = '#5effa0';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#2ee06a';
      ctx.beginPath();
      ctx.arc(0, 0, 11, Math.PI, 0);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#2ee06a';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-11, -6, 4, 12);
      ctx.fillRect(7, -6, 4, 12);
    }
    ctx.restore();
  }

  function drawPylon(p, camX, camY) {
    const sx = p.x - camX + W / 2;
    const sy = p.y - camY + H / 2;
    if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) return;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.shadowColor = '#ff4fd8';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ff4fd8';
    ctx.beginPath();
    ctx.moveTo(0, -p.r);
    ctx.lineTo(p.r, 0);
    ctx.lineTo(0, p.r);
    ctx.lineTo(-p.r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawParticles(dt) {
    if (!particles.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      const k = 1 - p.life / p.maxLife;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + p.life * 4), 0, TAU);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawDemo(time) {
    drawGrid(0, 0, time);
    const sway = Math.sin(time * 1.3) * 0.5;
    const heading = -90 + sway * 34;
    // 玩家演示车在中心偏下
    drawCar(W / 2 - 40 * Math.sin(time * 0.7), H / 2 + 40, heading, '#6ef2ff', 24, { coreColor: '#ffffff', shape: 'arrow' });
    // 幽灵车
    drawCar(W / 2 - 240, H / 2 - 150, -90 + Math.sin(time) * 20, '#ff5d8f', 18, { shape: 'diamond' });
    drawCar(W / 2 + 260, H / 2 - 180, -90, '#ffa23d', 19, { shape: 'diamond' });
    drawCar(W / 2 + 120, H / 2 - 300, -90, '#ff4fd8', 17, { shape: 'diamond' });
    // 星星
    for (let i = 0; i < 5; i += 1) {
      const a = time * 0.5 + i * 1.2566;
      const sx = W / 2 + Math.cos(a) * (170 + i * 30);
      const sy = H / 2 - 60 + Math.sin(a) * 60;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.shadowColor = '#ffd23d';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffd23d';
      drawStar(ctx, 0, 0, 5, 12, 5);
      ctx.restore();
    }
    // 霓虹柱
    drawPylon({ x: W / 2 - 320, y: H / 2 - 40, r: 16 }, 0, 0);
    drawPylon({ x: W / 2 + 340, y: H / 2 - 120, r: 16 }, 0, 0);
  }

  function draw(state, dt, view) {
    const time = (view && view.time) || 0;
    if (!state || state.phase === 'title') {
      drawDemo(time);
      return;
    }
    const camX = state.player ? state.player.x : 0;
    const camY = state.player ? state.player.y : 0;
    let shakeX = 0;
    let shakeY = 0;
    if (view && view.shake > 0) {
      shakeX = (Math.random() * 2 - 1) * view.shake;
      shakeY = (Math.random() * 2 - 1) * view.shake;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawGrid(camX, camY, time);
    // 拾取半径（磁吸时显示）
    if (state.player && state.player.range > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(46, 224, 106, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, GAME.EAT_RANGE * GAME.RANGE_MULT, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    // 霓虹柱
    if (state.pylons) for (const p of state.pylons) if (p.alive) drawPylon(p, camX, camY);
    // 道具
    if (state.props) for (const p of state.props) if (p.alive) drawProp(p, camX, camY);
    // 幽灵车
    if (state.enemies) {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const sx = e.x - camX + W / 2;
        const sy = e.y - camY + H / 2;
        if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
        drawCar(sx, sy, e.heading, e.color, e.r, { shape: 'diamond', coreColor: 'rgba(255,255,255,0.85)', shadowBlur: 14 });
      }
    }
    // 拖尾
    drawTrail(state, camX, camY);
    // 玩家（最亮，最后画保证最上层）
    if (state.player && state.phase === 'playing') {
      const modeColor = state.mode === 'hot' ? '#ffd23d' : state.mode === 'hit' ? '#8ff3ff' : '#6ef2ff';
      const shieldRing = state.player.shield > 0 || state.player.invuln > 0;
      if (shieldRing) {
        ctx.save();
        ctx.strokeStyle = 'rgba(63, 230, 255, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, state.player.r + 10, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      drawCar(W / 2, H / 2, state.player.heading, modeColor, state.player.r + 4, {
        shape: 'arrow', coreColor: '#ffffff', shadowBlur: 26, glowColor: modeColor,
      });
    }
    drawParticles(dt);
    ctx.restore();
  }

  // 供 main 每帧推进拖尾
  function tick(state) {
    if (state && state.phase === 'playing') pushTrail(state);
  }

  function clearTrail() { trail.length = 0; }

  return { draw, spawn, tick, clearTrail, dpr };
}

function drawStar(ctx, cx, cy, spikes, outer, inner) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
  for (let i = 0; i < spikes; i += 1) {
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
  }
  ctx.closePath();
  ctx.fill();
}
