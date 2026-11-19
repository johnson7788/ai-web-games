// SNAIL MAZE · Canvas 2D 渲染：霓虹合成波网格 + 发光管道 + 蜗牛 + 星尘/岩石 + 粒子。
// 全部程序化，无外部素材。DPR ≤2；粒子分档；prefers-reduced-motion 由 main 传入。
import { WORLD } from '../../config/game.config.js';
import { GAME } from '../../config/game.config.js';

const SCALE = 0.62;
const HALF = GAME.CORRIDOR_HALF;
const DIR_ANGLE = { top: 0, bottom: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
const DIR_VEC = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

const COLORS = {
  bgTop: '#0a0518',
  bgBottom: '#1c0b30',
  grid: 'rgba(120, 60, 200, 0.16)',
  horizon: 'rgba(255, 46, 196, 0.12)',
  corridor: 'rgba(84, 40, 150, 0.97)',
  corridorGlow: 'rgba(42, 210, 240, 0.25)',
  wall: '#8df4ff',
  wallDim: 'rgba(141, 244, 255, 0.9)',
  snail: '#ff2ec4',
  snailShell: '#f7f2ff',
  snailSpiral: '#ff2ec4',
  snailOutline: '#160a22',
  orb: '#ffd166',
  rock: '#ff5470',
  flag: '#7cff6b',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  canvas.style.width = `${WORLD.WIDTH}px`;
  canvas.style.height = `${WORLD.HEIGHT}px`;

  let camX = 0;
  let camY = 0;
  let camRot = 0;
  let randomTarget = 0;
  let randomTimer = 0;
  let lastRunLevel = null;
  const trail = [];
  const particles = [];

  function resetCamera() {
    camX = 0; camY = 0; camRot = 0; randomTimer = 0; randomTarget = 0;
    trail.length = 0; particles.length = 0;
  }

  function spawn(type, x, y) {
    const MAX = 220;
    if (particles.length > MAX) particles.splice(0, particles.length - MAX);
    let n = 0;
    let palette = ['#ffd166', '#2ad2f0', '#ff2ec4'];
    if (type === 'star') { n = 8; palette = ['#ffd166', '#fff3b0', '#ffb703']; }
    else if (type === 'bash') { n = 14; palette = ['#ff5470', '#ff8c5a', '#ff2ec4']; }
    else if (type === 'rockHit') { n = 10; palette = ['#ff5470', '#7a1f3d', '#ff8c5a']; }
    else if (type === 'crash') { n = 22; palette = ['#ff2ec4', '#2ad2f0', '#ffd166', '#ffffff']; }
    else if (type === 'win') { n = 26; palette = ['#7cff6b', '#2ad2f0', '#ffd166', '#ff2ec4']; }
    else if (type === 'turn') { n = 5; palette = ['#2ad2f0', '#e0fbff']; }
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.5,
        size: 2 + Math.random() * 4,
        color: palette[Math.floor(Math.random() * palette.length)],
      });
    }
  }

  function drawBackground(now, reduced) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 轻微地平线辉光
    const hg = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT * 0.42, 20, WORLD.WIDTH / 2, WORLD.HEIGHT * 0.42, 420);
    hg.addColorStop(0, reduced ? 'rgba(255,46,196,0.05)' : COLORS.horizon);
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 透视网格
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const horizonY = WORLD.HEIGHT * 0.42;
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      const y = horizonY + Math.pow(t, 2) * (WORLD.HEIGHT - horizonY);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
    }
    for (let i = -16; i <= 16; i += 1) {
      const x = WORLD.WIDTH / 2 + i * 60;
      ctx.beginPath(); ctx.moveTo(x, horizonY); ctx.lineTo(WORLD.WIDTH / 2 + (x - WORLD.WIDTH / 2) * 2.6, WORLD.HEIGHT); ctx.stroke();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTrack(geo, state, now) {
    const pts = geo.points;
    const dirs = geo.dirs;

    // 走廊填充
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.corridor;
    ctx.lineWidth = HALF * 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    ctx.strokeStyle = COLORS.corridorGlow;
    ctx.lineWidth = HALF * 2 + 30;
    ctx.stroke();

    // 墙壁（两条亮边）
    for (const side of [-1, 1]) {
      ctx.strokeStyle = COLORS.wallDim;
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i < pts.length - 1; i += 1) {
        const d = dirs[i];
        const n = { top: { x: 1, y: 0 }, bottom: { x: 1, y: 0 }, left: { x: 0, y: 1 }, right: { x: 0, y: 1 } }[d];
        const a = pts[i]; const b = pts[i + 1];
        const ox = n.x * HALF * side; const oy = n.y * HALF * side;
        if (i === 0) ctx.moveTo(a.x + ox, a.y + oy);
        ctx.lineTo(b.x + ox, b.y + oy);
      }
      ctx.stroke();
    }

    // 中心引导线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // 起点踏板
    ctx.fillStyle = COLORS.wall;
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 20, 0, Math.PI * 2);
    ctx.fill();

    // 拐角箭头（指向下一段方向）
    for (let i = 0; i < dirs.length - 1; i += 1) {
      const next = dirs[i + 1];
      const p = pts[i + 1];
      const active = state && state.turnAvailable && state.seg === i;
      drawArrow(p.x, p.y, next, active, now);
    }

    // 终点旗帜
    const end = pts[pts.length - 1];
    drawFlag(end.x, end.y, dirs[dirs.length - 1], now);

    for (const o of geo.orbs) if (o.alive) drawOrb(o.x, o.y, now);
    for (const r of geo.rocks) if (r.alive) drawRock(r.x, r.y, r.warned, now);
  }

  function drawArrow(x, y, dir, active, now) {
    const ang = DIR_ANGLE[dir];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.globalAlpha = active ? 1 : 0.6;
    ctx.shadowColor = COLORS.wall;
    ctx.shadowBlur = active ? 26 : 12;
    ctx.fillStyle = active ? '#ffffff' : COLORS.wall;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(26, 10);
    ctx.lineTo(-26, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFlag(x, y, dir, now) {
    const ang = DIR_ANGLE[dir];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.shadowColor = COLORS.flag;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#eafce8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -HALF);
    ctx.lineTo(0, HALF);
    ctx.stroke();
    const w = 0.5 + 0.5 * Math.sin(now * 6);
    ctx.fillStyle = COLORS.flag;
    ctx.beginPath();
    ctx.moveTo(0, -HALF);
    ctx.lineTo(66, -HALF + 20 + w * 8);
    ctx.lineTo(0, -HALF + 42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawOrb(x, y, now) {
    const pulse = 1 + 0.18 * Math.sin(now * 8 + x * 0.02);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(now * 1.4 + x * 0.01);
    ctx.shadowColor = COLORS.orb;
    ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.orb;
    const s = 18 * pulse;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.6, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawRock(x, y, warned, now) {
    ctx.save();
    ctx.translate(x, y);
    if (warned) {
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now * 10);
      ctx.shadowColor = COLORS.rock;
      ctx.shadowBlur = 18;
    } else {
      ctx.shadowColor = COLORS.rock;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = COLORS.rock;
    roundRect(-18, -18, 36, 36, 8);
    ctx.fill();
    ctx.strokeStyle = '#5c1628';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // 裂纹（不形成 X）
    ctx.strokeStyle = '#ffb3c0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -4); ctx.lineTo(-2, -6); ctx.lineTo(2, -1);
    ctx.moveTo(-6, 6); ctx.lineTo(1, 3); ctx.lineTo(8, 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawSnail(x, y, dir, now) {
    const ang = DIR_ANGLE[dir];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    // 黏液尾迹
    ctx.fillStyle = 'rgba(42, 210, 240, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 32, 22, 34, 0, 0, Math.PI * 2);
    ctx.fill();

    // 白色外圈（提剪影）
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 2, 32, 40, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 身体（深色描边提剪影）
    ctx.shadowColor = COLORS.snail;
    ctx.shadowBlur = 30;
    const bodyG = ctx.createLinearGradient(0, -30, 0, 40);
    bodyG.addColorStop(0, '#ff8ae2');
    bodyG.addColorStop(1, '#c2169a');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.ellipse(0, 8, 28, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COLORS.snailOutline;
    ctx.lineWidth = 5;
    ctx.stroke();

    // 壳（白色 + 洋红螺旋）
    ctx.shadowColor = COLORS.snailShell;
    ctx.shadowBlur = 22;
    ctx.fillStyle = COLORS.snailShell;
    ctx.beginPath();
    ctx.arc(0, -8, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COLORS.snailOutline;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.strokeStyle = COLORS.snailSpiral;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, -8, 16, 0, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -8, 8, 0, Math.PI * 1.5);
    ctx.stroke();

    // 眼柄
    ctx.strokeStyle = '#ffb3e4';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(9, -14); ctx.lineTo(15, -30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, -14); ctx.lineTo(-15, -30); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(15, -32, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-15, -32, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#101018';
    ctx.beginPath(); ctx.arc(15, -32, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-15, -32, 3, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  function drawParticles(dt) {
    for (const p of particles) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      const a = 1 - p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    particles.splice(0, Math.max(0, particles.length - 260));
  }

  function draw(run, dt, view) {
    const now = performance.now() / 1000;
    const reduced = view && view.reduced;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(now, reduced);

    if (!run) return;

    const state = run.state;
    const geo = run.view();
    const snail = run.snail();

    if (lastRunLevel !== state.level) {
      resetCamera();
      lastRunLevel = state.level;
    }
    const look = DIR_VEC[snail.dir];
    const tx = snail.x + look.x * 140;
    const ty = snail.y + look.y * 140;
    camX += (tx - camX) * Math.min(1, dt * 7);
    camY += (ty - camY) * Math.min(1, dt * 7);

    let rotTarget = 0;
    if (geo.rotate && state.phase !== 'won' && state.phase !== 'lost') {
      rotTarget = -DIR_ANGLE[snail.dir];
    } else if (geo.random && state.phase !== 'won' && state.phase !== 'lost') {
      randomTimer -= dt;
      if (randomTimer <= 0) {
        randomTimer = 3;
        const mag = (45 + Math.random() * 135) * (Math.random() < 0.5 ? 1 : -1);
        randomTarget = (mag * Math.PI) / 180;
      }
      rotTarget = randomTarget;
    } else {
      rotTarget = 0;
    }
    camRot += (rotTarget - camRot) * Math.min(1, dt * 5);

    let shakeX = 0; let shakeY = 0;
    if (view && view.shake > 0) {
      shakeX = (Math.random() - 0.5) * view.shake;
      shakeY = (Math.random() - 0.5) * view.shake;
    }

    ctx.save();
    ctx.translate(WORLD.WIDTH / 2 + shakeX, WORLD.HEIGHT / 2 + shakeY);
    ctx.rotate(camRot);
    ctx.scale(SCALE, SCALE);
    ctx.translate(-camX, -camY);

    drawTrack(geo, state, now);

    for (let i = 0; i < trail.length; i += 1) {
      const t = trail[i];
      ctx.globalAlpha = (i / trail.length) * 0.4;
      ctx.fillStyle = COLORS.snail;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 8 + (i / trail.length) * 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawParticles(dt);
    drawSnail(snail.x, snail.y, snail.dir, now);

    ctx.restore();

    trail.push({ x: snail.x, y: snail.y });
    if (trail.length > 16) trail.shift();

    if (view && view.flash > 0 && !reduced) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = view.flashColor || 'rgba(255,255,255,0.5)';
      ctx.globalAlpha = Math.min(0.5, view.flash);
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.globalAlpha = 1;
    }
  }

  return { draw, spawn, resetCamera };
}
