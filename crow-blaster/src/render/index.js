// CROW BLASTER · Canvas 2D 渲染：霓虹天际线 + 机械乌鸦 + 等离子弹 + 粒子。
// 纯程序化，零素材。DPR ≤2。固定逻辑世界 1280×720。
import { WORLD } from '../../config/game.config.js';
import { LAUNCHER, CROWS } from '../../config/gameplay.js';

const DPR_CAP = 2;

// 霓虹街机配色（统一一套：深紫夜空 + 青/品红/金/橙霓虹）
const COL = {
  skyTop: '#0a0a1e',
  skyBottom: '#1c0f33',
  building: '#121228',
  buildingFar: '#171530',
  windowA: '#22d3ee',
  windowB: '#e94560',
  windowC: '#fbbf24',
  grid: 'rgba(34,211,238,0.14)',
  horizon: 'rgba(233,69,96,0.5)',
};

const CROW_STYLE = {
  scout:  { body: '#22d3ee', glow: 'rgba(34,211,238,0.85)', wing: '#0ea5e9' },
  tank:   { body: '#fb923c', glow: 'rgba(251,146,60,0.85)', wing: '#ea580c' },
  golden: { body: '#fbbf24', glow: 'rgba(251,191,36,0.95)', wing: '#f59e0b' },
  ghost:  { body: '#a855f7', glow: 'rgba(168,85,247,0.7)', wing: '#7c3aed' },
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 预生成天际线（建筑 + 窗户），只画一次缓存到离屏 canvas
function buildSkyline() {
  const c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  const ctx = c.getContext('2d');
  // 远景
  let x = 0;
  while (x < WORLD.WIDTH) {
    const w = 46 + Math.floor(Math.random() * 40);
    const h = 90 + Math.floor(Math.random() * 120);
    ctx.fillStyle = COL.buildingFar;
    ctx.fillRect(x, WORLD.HEIGHT - h, w, h);
    x += w + 6;
  }
  // 近景
  x = -10;
  while (x < WORLD.WIDTH) {
    const w = 70 + Math.floor(Math.random() * 90);
    const h = 140 + Math.floor(Math.random() * 160);
    ctx.fillStyle = COL.building;
    ctx.fillRect(x, WORLD.HEIGHT - h, w, h);
    // 霓虹窗
    const cols = [COL.windowA, COL.windowB, COL.windowC];
    for (let wy = WORLD.HEIGHT - h + 16; wy < WORLD.HEIGHT - 14; wy += 26) {
      for (let wx = x + 12; wx < x + w - 10; wx += 22) {
        if (Math.random() < 0.5) {
          ctx.fillStyle = cols[Math.floor(Math.random() * cols.length)];
          ctx.fillRect(wx, wy, 8, 10);
        }
      }
    }
    x += w + 18;
  }
  return c;
}

let _skyline = null;
function skyline() {
  if (!_skyline) _skyline = buildSkyline();
  return _skyline;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  let aim = 0;
  let particles = [];
  let shake = 0;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, COL.skyTop);
    g.addColorStop(1, COL.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(skyline(), 0, 0);
    // 网格地平线
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    for (let gy = WORLD.HEIGHT - 30; gy > 200; gy -= 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(WORLD.WIDTH, gy);
      ctx.stroke();
    }
    ctx.strokeStyle = COL.horizon;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.HEIGHT - 14);
    ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT - 14);
    ctx.stroke();
    // 星点
    for (let i = 0; i < 60; i += 1) {
      const sx = (i * 197 + 40) % WORLD.WIDTH;
      const sy = (i * 89 + 20) % 320;
      ctx.fillStyle = 'rgba(226,232,240,0.5)';
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  function drawLauncher(now) {
    const cx = LAUNCHER.X;
    const cy = LAUNCHER.Y;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(aim * Math.PI / 180);
    // 底座
    ctx.fillStyle = '#3b0a1f';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    // 炮管（霓虹）
    const grad = ctx.createLinearGradient(0, 0, 0, -70);
    grad.addColorStop(0, '#e94560');
    grad.addColorStop(1, '#22d3ee');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -64);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, -62);
    ctx.stroke();
    // 炮口能量点（呼吸）
    const pulse = 0.6 + 0.4 * Math.sin(now / 140);
    ctx.fillStyle = `rgba(34,211,238,${pulse})`;
    ctx.beginPath();
    ctx.arc(0, -66, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 底座外圈（不随角度旋转）
    ctx.strokeStyle = 'rgba(233,69,96,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawCrow(c, now) {
    const s = CROW_STYLE[c.kind] || CROW_STYLE.scout;
    const flap = Math.sin(now / 90 + c.wobble) * (c.kind === 'golden' ? 0.8 : 0.5);
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.vx < 0) ctx.scale(-1, 1); // 朝左飞则镜像
    // 发光
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = c.kind === 'golden' ? 22 : 12;
    // 身体
    ctx.fillStyle = s.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, c.r, c.r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    // 头
    ctx.beginPath();
    ctx.arc(c.r * 0.62, -c.r * 0.18, c.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    // 翅膀
    ctx.fillStyle = s.wing;
    ctx.save();
    ctx.translate(-c.r * 0.1, -c.r * 0.1);
    ctx.rotate(flap);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-c.r * 0.9, -c.r * 0.7);
    ctx.lineTo(-c.r * 0.4, c.r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // 喙
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(c.r * 1.05, -c.r * 0.18);
    ctx.lineTo(c.r * 1.5, -c.r * 0.02);
    ctx.lineTo(c.r * 1.0, c.r * 0.08);
    ctx.closePath();
    ctx.fill();
    // 眼睛
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0a1e';
    ctx.beginPath();
    ctx.arc(c.r * 0.7, -c.r * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c.r * 0.72, -c.r * 0.32, 1.4, 0, Math.PI * 2);
    ctx.fill();
    // 装甲乌鸦：铆钉线
    if (c.kind === 'tank') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-c.r * 0.6, -c.r * 0.4);
      ctx.lineTo(c.r * 0.5, c.r * 0.3);
      ctx.stroke();
    }
    // 鬼鸦：画个 X 警告
    if (c.kind === 'ghost') {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-c.r * 0.5, -c.r * 0.5);
      ctx.lineTo(c.r * 0.5, c.r * 0.5);
      ctx.moveTo(c.r * 0.5, -c.r * 0.5);
      ctx.lineTo(-c.r * 0.5, c.r * 0.5);
      ctx.stroke();
    }
    // 金鸦：星芒
    if (c.kind === 'golden') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 4; i += 1) {
        const a = i * Math.PI / 2 + now / 300;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * c.r * 0.9, Math.sin(a) * c.r * 0.9, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBolt(b) {
    ctx.save();
    ctx.shadowColor = 'rgba(34,211,238,0.9)';
    ctx.shadowBlur = 14;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r + 4);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#a5f3fc');
    g.addColorStop(1, '#22d3ee');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
    ctx.fill();
    // 拖尾
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(34,211,238,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
    ctx.restore();
  }

  function drawAimGuide(now) {
    if (aim === 0) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(165,243,252,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    const rad = aim * Math.PI / 180;
    ctx.moveTo(LAUNCHER.X, LAUNCHER.Y - 10);
    ctx.lineTo(LAUNCHER.X + Math.sin(rad) * 140, LAUNCHER.Y - Math.cos(rad) * 140);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function updateParticles(dt) {
    const next = [];
    for (const p of particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      next.push(p);
    }
    particles = next;
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return {
    setAim(a) { aim = a; },
    burst(x, y, kind) {
      if (reduced) return;
      const colors = { hit: '#22d3ee', tankHit: '#fb923c', goldenHit: '#fbbf24', ghostHit: '#a855f7', kill: '#e94560', miss: '#64748b' };
      const color = colors[kind] || '#22d3ee';
      const n = kind === 'kill' || kind === 'goldenHit' ? 18 : 10;
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 220;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, r: 2 + Math.random() * 3, life: 0.5 + Math.random() * 0.4, maxLife: 0.9, color });
      }
      if (particles.length > 220) particles = particles.slice(-220);
      shake = kind === 'kill' ? 5 : 2;
    },

    draw(run, alpha, now) {
      const t = now || performance.now();
      const dt = 1 / 60;
      if (run && run.phase === 'playing') updateParticles(dt);

      ctx.save();
      if (shake > 0 && !reduced) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake *= 0.8;
      }
      drawBackground();

      // 标题/暂停无 run 时画几只装饰乌鸦，保证画面不空
      const crows = run ? run.crows : null;
      if (crows) {
        for (const c of crows) if (!c.dead) drawCrow(c, t);
        if (run.phase === 'playing') drawAimGuide(t);
        for (const b of run.bolts) if (!b.dead) drawBolt(b);
        drawParticles();
        drawLauncher(t);
      } else {
        // 装饰乌鸦（标题屏）
        for (let i = 0; i < 3; i += 1) {
          const fake = {
            kind: ['scout', 'golden', 'scout'][i],
            x: ((t / 20 + i * 400) % (WORLD.WIDTH + 300)) - 150,
            y: 140 + i * 90 + Math.sin(t / 800 + i) * 18,
            vx: 90,
            r: i === 1 ? 34 : 38,
            wobble: i * 2,
          };
          drawCrow(fake, t);
        }
        drawLauncher(t);
      }
      ctx.restore();
    },
  };
}
