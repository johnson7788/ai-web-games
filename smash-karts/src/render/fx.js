// 特效：粒子池（上限 320，对象复用）/ 冲击环 / 飘字 / 轮胎印 / 速度线 / 震屏 / 慢放提示。
// 全部在 1280×720 逻辑坐标系内绘制；reduced 模式下震屏/慢放关闭、粒子减半。
import { PALETTE } from '../../config/game.config.js';

const MAX_PARTICLES = 320;
const MAX_RINGS = 24;
const MAX_FLOATERS = 32;
const MAX_MARKS = 96;

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",system-ui,sans-serif';

function rnd(a, b) { return a + Math.random() * (b - a); }

function starPath(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (Math.PI * i) / 5 - Math.PI / 2;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function createFx() {
  const parts = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, size: 4, color: '#fff', shape: 'dot', rot: 0, vr: 0, drag: 2.4, grav: 0, alpha: 1 });
  }
  const rings = [];
  for (let i = 0; i < MAX_RINGS; i += 1) {
    rings.push({ on: false, x: 0, y: 0, r0: 6, r1: 40, t: 0, life: 0.4, color: '#ffd23f', width: 5 });
  }
  const floaters = [];
  for (let i = 0; i < MAX_FLOATERS; i += 1) {
    floaters.push({ on: false, x: 0, y: 0, text: '', color: '#fff', size: 18, t: 0, life: 0.85, vy: -52 });
  }
  const marks = [];
  for (let i = 0; i < MAX_MARKS; i += 1) {
    marks.push({ on: false, x: 0, y: 0, angle: 0, w: 14, t: 0, life: 2.8 });
  }
  let pCur = 0;
  let rCur = 0;
  let fCur = 0;
  let mCur = 0;

  const shake = { t: 9, dur: 0.01, mag: 0, ox: 0, oy: 0 };
  const slow = { t: 9, dur: 0.01 };
  let reduced = false;

  function allocPart() {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const idx = (pCur + i) % MAX_PARTICLES;
      if (!parts[idx].on) { pCur = (idx + 1) % MAX_PARTICLES; return parts[idx]; }
    }
    const p = parts[pCur];
    pCur = (pCur + 1) % MAX_PARTICLES;
    return p;
  }
  function allocRing() {
    for (let i = 0; i < MAX_RINGS; i += 1) {
      const idx = (rCur + i) % MAX_RINGS;
      if (!rings[idx].on) { rCur = (idx + 1) % MAX_RINGS; return rings[idx]; }
    }
    const r = rings[rCur];
    rCur = (rCur + 1) % MAX_RINGS;
    return r;
  }
  function allocFloater() {
    for (let i = 0; i < MAX_FLOATERS; i += 1) {
      const idx = (fCur + i) % MAX_FLOATERS;
      if (!floaters[idx].on) { fCur = (idx + 1) % MAX_FLOATERS; return floaters[idx]; }
    }
    const f = floaters[fCur];
    fCur = (fCur + 1) % MAX_FLOATERS;
    return f;
  }
  function allocMark() {
    for (let i = 0; i < MAX_MARKS; i += 1) {
      const idx = (mCur + i) % MAX_MARKS;
      if (!marks[idx].on) { mCur = (idx + 1) % MAX_MARKS; return marks[idx]; }
    }
    const m = marks[mCur];
    mCur = (mCur + 1) % MAX_MARKS;
    return m;
  }

  function spawnPart(cfg) {
    const p = allocPart();
    p.on = true;
    p.x = cfg.x; p.y = cfg.y;
    p.vx = cfg.vx || 0; p.vy = cfg.vy || 0;
    p.t = 0; p.life = cfg.life || 0.5;
    p.size = cfg.size || 4;
    p.color = cfg.color || PALETTE.cream;
    p.shape = cfg.shape || 'dot';
    p.rot = cfg.rot || 0;
    p.vr = cfg.vr || 0;
    p.drag = cfg.drag === undefined ? 2.4 : cfg.drag;
    p.grav = cfg.grav || 0;
    p.alpha = cfg.alpha === undefined ? 1 : cfg.alpha;
    return p;
  }

  /** 通用粒子爆发。shape: dot|spark|star|smoke|streak|confetti */
  function burst(x, y, opts = {}) {
    const n = reduced ? Math.ceil((opts.count || 10) / 2) : opts.count || 10;
    const shape = opts.shape || 'dot';
    for (let i = 0; i < n; i += 1) {
      const a = opts.dir !== undefined
        ? opts.dir + rnd(-(opts.spread || Math.PI), opts.spread || Math.PI)
        : rnd(0, Math.PI * 2);
      const sp = rnd(opts.speed0 || 60, opts.speed1 || 240);
      spawnPart({
        x: x + rnd(-4, 4), y: y + rnd(-4, 4),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rnd(opts.life0 || 0.3, opts.life1 || 0.6),
        size: opts.size || rnd(3, 6),
        color: Array.isArray(opts.color) ? opts.color[(Math.random() * opts.color.length) | 0] : (opts.color || PALETTE.cream),
        shape,
        rot: rnd(0, Math.PI * 2),
        vr: shape === 'star' || shape === 'confetti' ? rnd(-6, 6) : 0,
        grav: opts.grav || 0,
        alpha: opts.alpha === undefined ? 1 : opts.alpha,
      });
    }
  }
  function stars(x, y, count = 6, color = PALETTE.gold) {
    burst(x, y, { count, color, shape: 'star', size: 8, speed0: 90, speed1: 300, life0: 0.5, life1: 0.9, drag: 1.6, grav: 260 });
  }
  function smoke(x, y, count = 4, color = 'rgba(255,246,229,0.75)') {
    burst(x, y, { count, color, shape: 'smoke', size: 9, speed0: 14, speed1: 60, life0: 0.5, life1: 0.9, drag: 1.2, alpha: 0.8 });
  }
  function dust(x, y, count = 4, color = 'rgba(255,246,229,0.9)') {
    burst(x, y, { count, color, shape: 'dot', size: 4, speed0: 30, speed1: 110, life0: 0.25, life1: 0.5, drag: 3.2 });
  }
  function ring(x, y, r0, r1, life = 0.4, color = PALETTE.gold, width = 5) {
    const r = allocRing();
    r.on = true;
    r.x = x; r.y = y; r.r0 = r0; r.r1 = r1;
    r.t = 0; r.life = life; r.color = color; r.width = width;
  }
  function floater(x, y, text, color = '#ffffff', size = 18) {
    const f = allocFloater();
    f.on = true;
    f.x = x; f.y = y;
    f.text = text; f.color = color; f.size = size;
    f.t = 0; f.life = 0.85; f.vy = -52;
  }
  function mark(x, y, angle, w = 14) {
    const m = allocMark();
    m.on = true;
    m.x = x; m.y = y; m.angle = angle; m.w = w;
    m.t = 0; m.life = 2.8;
  }
  /** 速度线：沿 dir 反方向的拉长条纹（强化加速体感）。 */
  function speedLines(x, y, dir, count = 10) {
    const n = reduced ? Math.ceil(count / 2) : count;
    const bx = -Math.cos(dir);
    const by = -Math.sin(dir);
    const px = -by;
    const py = bx;
    for (let i = 0; i < n; i += 1) {
      const side = (Math.random() * 2 - 1) * rnd(16, 44);
      const back = rnd(6, 34);
      spawnPart({
        x: x + px * side + bx * back,
        y: y + py * side + by * back,
        vx: bx * rnd(260, 520), vy: by * rnd(260, 520),
        life: rnd(0.12, 0.22),
        size: rnd(10, 20),
        color: 'rgba(255,255,255,0.85)',
        shape: 'streak',
        drag: 0.4,
        alpha: 0.8,
      });
    }
  }

  function addShake(mag, dur) {
    if (reduced) return;
    if (shake.t < shake.dur && shake.mag > mag) return;
    shake.t = 0; shake.dur = Math.max(0.01, dur); shake.mag = mag;
  }
  function triggerSlowmo() {
    if (reduced) return;
    slow.t = 0; slow.dur = 0.38;
  }

  function update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const p = parts[i];
      if (!p.on) continue;
      p.t += dt;
      if (p.t >= p.life) { p.on = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.vy += p.grav * dt;
      p.rot += p.vr * dt;
    }
    for (let i = 0; i < MAX_RINGS; i += 1) {
      const r = rings[i];
      if (!r.on) continue;
      r.t += dt;
      if (r.t >= r.life) r.on = false;
    }
    for (let i = 0; i < MAX_FLOATERS; i += 1) {
      const f = floaters[i];
      if (!f.on) continue;
      f.t += dt;
      if (f.t >= f.life) { f.on = false; continue; }
      f.y += f.vy * dt;
      f.vy *= Math.max(0, 1 - 2.2 * dt);
    }
    for (let i = 0; i < MAX_MARKS; i += 1) {
      const m = marks[i];
      if (!m.on) continue;
      m.t += dt;
      if (m.t >= m.life) m.on = false;
    }
    shake.t += dt;
    if (shake.t < shake.dur) {
      const k = 1 - shake.t / shake.dur;
      const amp = shake.mag * k * k;
      shake.ox = Math.sin(shake.t * 89) * amp;
      shake.oy = Math.cos(shake.t * 67) * amp;
    } else {
      shake.ox = 0; shake.oy = 0; shake.mag = 0;
    }
    slow.t += dt;
  }

  function drawGround(ctx) {
    ctx.lineCap = 'round';
    for (let i = 0; i < MAX_MARKS; i += 1) {
      const m = marks[i];
      if (!m.on) continue;
      const k = 1 - m.t / m.life;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      ctx.strokeStyle = PALETTE.ink;
      ctx.globalAlpha = 0.16 * k;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-m.w / 2, 0);
      ctx.lineTo(m.w / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawAir(ctx) {
    for (let i = 0; i < MAX_RINGS; i += 1) {
      const r = rings[i];
      if (!r.on) continue;
      const k = r.t / r.life;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.5);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - k * k), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const p = parts[i];
      if (!p.on) continue;
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = p.alpha * k;
      ctx.fillStyle = p.color;
      if (p.shape === 'dot') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'spark' || p.shape === 'streak') {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const len = p.shape === 'streak' ? p.size : p.size * 1.6;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.shape === 'streak' ? 2.5 : 3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len);
        ctx.stroke();
      } else if (p.shape === 'star') {
        starPath(ctx, p.x, p.y, p.size * (0.7 + k * 0.3), p.rot);
        ctx.fill();
      } else if (p.shape === 'smoke') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + p.t / p.life), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore();
      }
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let i = 0; i < MAX_FLOATERS; i += 1) {
      const f = floaters[i];
      if (!f.on) continue;
      const k = f.t / f.life;
      const pop = Math.min(1, f.t / 0.1) * (1 + 0.18 * (1 - Math.min(1, f.t / 0.35)));
      ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      ctx.font = `800 ${Math.round(f.size * pop)}px ${FONT}`;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  /** KO 慢放提示：只画视觉（暗角脉冲），不改任何速度。 */
  function drawSlowmo(ctx) {
    if (slow.t >= slow.dur) return;
    const k = slow.t / slow.dur;
    ctx.fillStyle = PALETTE.ink;
    ctx.globalAlpha = 0.22 * Math.sin(k * Math.PI);
    ctx.fillRect(0, 0, 1280, 720);
    ctx.globalAlpha = 1;
  }

  function clear() {
    for (const p of parts) p.on = false;
    for (const r of rings) r.on = false;
    for (const f of floaters) f.on = false;
    for (const m of marks) m.on = false;
    shake.t = 9; shake.dur = 0.01; shake.mag = 0; shake.ox = 0; shake.oy = 0;
    slow.t = 9; slow.dur = 0.01;
  }

  return {
    burst, stars, smoke, dust, ring, floater, mark, speedLines,
    addShake, triggerSlowmo,
    update, drawGround, drawAir, drawSlowmo,
    setReduced(v) { reduced = !!v; },
    shakeOx() { return shake.ox; },
    shakeOy() { return shake.oy; },
    shakeMag() { return shake.t < shake.dur ? shake.mag * (1 - shake.t / shake.dur) : 0; },
    countParticles() { let n = 0; for (const p of parts) if (p.on) n += 1; return n; },
    clear,
  };
}

export { roundRect, starPath };
