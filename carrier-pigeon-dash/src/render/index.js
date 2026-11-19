// Canvas 2D 渲染（霓虹街机风格，全程序化，零素材零外链）。
// 层次：天空渐变 + 星空 + 城市剪影 → 地面霓虹网格 → 中继塔 → 岩石 → 信封 → 信鸽 → 粒子。
// 信鸽为画面最亮元素（白色 + 金色辉光），保证剪影可读。

import { WORLD, PLAYER, TOWER, LEVELS, ROCK, TOKEN } from '../../config/game.config.js';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glowCircle(ctx, x, y, r, color, alpha = 0.35) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const particles = [];
  let shake = 0;
  let tGlobal = 0;
  let stars = [];
  let buildings = [];
  buildStatic();

  function buildStatic() {
    stars = [];
    for (let i = 0; i < 90; i += 1) {
      stars.push({
        x: Math.random() * WORLD.WIDTH,
        y: Math.random() * (WORLD.GROUND_Y - 120),
        r: 0.6 + Math.random() * 1.6,
        ph: Math.random() * TAU,
        sp: 1 + Math.random() * 3,
      });
    }
    buildings = [];
    let x = -20;
    while (x < WORLD.WIDTH + 20) {
      const w = 40 + Math.random() * 90;
      const h = 60 + Math.random() * 200;
      buildings.push({ x, w, h });
      x += w + 4;
    }
  }

  function burst(type, x, y) {
    const n = type === 'death' ? 22 : type === 'delivery' ? 16 : 8;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const sp = 40 + Math.random() * (type === 'death' ? 260 : 140);
      particles.push({
        type,
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        ttl: 0.4 + Math.random() * 0.5,
        life: 0,
        r: 1.5 + Math.random() * 2.5,
      });
    }
    if (particles.length > 160) particles.splice(0, particles.length - 160);
  }

  function addShake(amt) {
    shake = Math.max(shake, amt);
  }

  function drawSky(dt) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#070716');
    g.addColorStop(0.55, '#141232');
    g.addColorStop(1, '#241a4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星空
    for (const s of stars) {
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(tGlobal * s.sp + s.ph));
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#cfeaff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 月亮
    glowCircle(ctx, 1080, 120, 90, '#ffe9b0', 0.18);
    ctx.fillStyle = '#fff2cf';
    ctx.beginPath();
    ctx.arc(1080, 120, 34, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f0e2bb';
    ctx.beginPath();
    ctx.arc(1068, 112, 7, 0, TAU);
    ctx.arc(1092, 130, 5, 0, TAU);
    ctx.fill();
  }

  function drawCity(dt) {
    ctx.fillStyle = '#0d0b22';
    for (const b of buildings) {
      ctx.fillRect(b.x, WORLD.GROUND_Y - b.h, b.w, b.h);
      // 楼顶天线灯
      ctx.fillStyle = '#ff4d7a';
      ctx.fillRect(b.x + b.w / 2 - 1, WORLD.GROUND_Y - b.h - 6, 2, 6);
      ctx.fillStyle = '#0d0b22';
    }
    // 远楼窗户点
    ctx.fillStyle = 'rgba(255,220,120,0.25)';
    for (const b of buildings) {
      for (let wy = WORLD.GROUND_Y - b.h + 12; wy < WORLD.GROUND_Y - 16; wy += 20) {
        for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 16) {
          if (((wx * 7 + wy * 13) % 5) === 0) ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
  }

  function drawGround(dt) {
    ctx.fillStyle = '#0c0a20';
    ctx.fillRect(0, WORLD.GROUND_Y, WORLD.WIDTH, WORLD.HEIGHT - WORLD.GROUND_Y);
    // 霓虹网格（滚动）
    const scroll = (tGlobal * 120) % 40;
    ctx.strokeStyle = hexA('#3ee0ff', 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -scroll; x < WORLD.WIDTH + 40; x += 40) {
      ctx.moveTo(x, WORLD.GROUND_Y);
      ctx.lineTo(x - 14, WORLD.HEIGHT);
    }
    for (let y = WORLD.GROUND_Y + 20; y < WORLD.HEIGHT; y += 20) {
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
    }
    ctx.stroke();
    // 地面顶缘亮线
    ctx.fillStyle = '#3ee0ff';
    ctx.fillRect(0, WORLD.GROUND_Y, WORLD.WIDTH, 3);
  }

  function drawTower(t, color) {
    const gapTop = t.gapY - t.gap / 2;
    const gapBottom = t.gapY + t.gap / 2;
    const x = t.x;
    const w = TOWER.W;

    // 上塔
    drawPylon(x, 0, w, gapTop, color, false);
    // 下塔
    drawPylon(x, gapBottom, w, WORLD.GROUND_Y - gapBottom, color, true);
    // 缺口上下缘的亮条（门）
    ctx.fillStyle = color;
    ctx.fillRect(x - 6, gapTop - 3, w + 12, 4);
    ctx.fillRect(x - 6, gapBottom - 1, w + 12, 4);
    // 门内微光
    ctx.fillStyle = hexA(color, 0.12);
    ctx.fillRect(x + 6, gapTop, w - 12, t.gap);
  }

  function drawPylon(x, y, w, h, color, up) {
    if (h <= 0) return;
    // 外辉光
    ctx.fillStyle = hexA(color, 0.18);
    rr(ctx, x - 8, y, w + 16, h, 8);
    ctx.fill();
    // 主体（深色）
    ctx.fillStyle = '#151330';
    rr(ctx, x, y, w, h, 6);
    ctx.fill();
    // 霓虹描边
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    rr(ctx, x, y, w, h, 6);
    ctx.stroke();
    // 内部横纹
    ctx.strokeStyle = hexA(color, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const startY = up ? y + 20 : y + 20;
    for (let yy = startY; yy < y + h - 8; yy += 24) {
      ctx.moveTo(x + 8, yy);
      ctx.lineTo(x + w - 8, yy);
    }
    ctx.stroke();
    // 顶/底信号灯
    ctx.fillStyle = '#fff';
    const tipY = up ? y + h - 6 : y;
    ctx.beginPath();
    ctx.arc(x + w / 2, tipY, 3, 0, TAU);
    ctx.fill();
  }

  function drawRock(r) {
    const color = '#ff3d8b';
    glowCircle(ctx, r.x, r.y, r.r * 2, color, 0.2);
    ctx.fillStyle = '#24122c';
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    // 高光裂缝
    ctx.strokeStyle = hexA(color, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x - r.r * 0.5, r.y - r.r * 0.3);
    ctx.lineTo(r.x + r.r * 0.1, r.y + r.r * 0.2);
    ctx.lineTo(r.x + r.r * 0.5, r.y - r.r * 0.1);
    ctx.stroke();
  }

  function drawToken(tk) {
    const color = '#ffd23e';
    glowCircle(ctx, tk.x, tk.y, tk.r * 2.4, color, 0.4);
    // 信封
    ctx.fillStyle = '#fff6d8';
    rr(ctx, tk.x - tk.r, tk.y - tk.r * 0.66, tk.r * 2, tk.r * 1.32, 2);
    ctx.fill();
    ctx.strokeStyle = '#e8b93c';
    ctx.lineWidth = 2;
    rr(ctx, tk.x - tk.r, tk.y - tk.r * 0.66, tk.r * 2, tk.r * 1.32, 2);
    ctx.stroke();
    // 信封 V 形
    ctx.beginPath();
    ctx.moveTo(tk.x - tk.r, tk.y - tk.r * 0.66);
    ctx.lineTo(tk.x, tk.y);
    ctx.lineTo(tk.x + tk.r, tk.y - tk.r * 0.66);
    ctx.strokeStyle = '#e8b93c';
    ctx.stroke();
  }

  function drawBird(bird, state, dt) {
    const x = PLAYER.X;
    const y = bird.y;
    const rot = clamp(bird.vy / 900, -0.4, 0.9);
    const color = '#ffd23e';
    glowCircle(ctx, x, y, 44, color, 0.25);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // 尾羽
    ctx.fillStyle = '#e8e4f2';
    ctx.beginPath();
    ctx.moveTo(-16, -2);
    ctx.lineTo(-30, -12);
    ctx.lineTo(-30, 10);
    ctx.closePath();
    ctx.fill();

    // 身体
    ctx.fillStyle = '#f4f1fb';
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 12, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#c9c2e0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 头
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(14, -6, 8, 0, TAU);
    ctx.fill();

    // 喙（含一封信）
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.moveTo(22, -6);
    ctx.lineTo(30, -3);
    ctx.lineTo(22, -1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(16, -8, 7, 4); // 信
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, -8, 7, 4);

    // 眼睛
    ctx.fillStyle = '#1a1633';
    ctx.beginPath();
    ctx.arc(16, -8, 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(16.8, -8.8, 0.8, 0, TAU);
    ctx.fill();

    // 翅膀（扇动）
    const wing = Math.sin(tGlobal * 18) * 0.8;
    ctx.fillStyle = '#dcd6ee';
    ctx.save();
    ctx.translate(-3, -2);
    ctx.rotate(-0.6 + wing * 0.9);
    ctx.beginPath();
    ctx.ellipse(-8, 0, 12, 6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function drawParticles(dt) {
    for (const p of particles) {
      p.life += dt;
      const k = 1 - p.life / p.ttl;
      if (k <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      const color = p.type === 'death' ? '#ff3d8b' : p.type === 'delivery' ? '#ffd23e' : '#3ee0ff';
      ctx.globalAlpha = k;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * k, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    particles.splice(0, particles.length - 200);
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].life >= particles[i].ttl) particles.splice(i, 1);
    }
  }

  function draw(run, dt, view = {}) {
    tGlobal += dt;
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake = Math.max(0, shake - dt * 24);
    }

    drawSky(dt);
    drawCity(dt);
    drawGround(dt);

    if (run) {
      const color = LEVELS[run.state.levelIndex]?.tower || '#3ee0ff';
      for (const t of run.towers) {
        drawTower(t, color);
        if (t.token && !t.token.collected) drawToken({ x: t.x + TOWER.W / 2, y: t.token.y, r: TOKEN.R });
      }
      for (const r of run.rocks) drawRock(r);
      drawBird(run.bird, run.state, dt);
    } else {
      // 标题屏：一只巡航的信鸽
      const y = 340 + Math.sin(tGlobal * 1.6) * 26;
      drawBird({ y, vy: 0 }, { phase: 'title' }, dt);
      drawTower({ x: 720, gapY: 340, gap: 360 }, '#3ee0ff');
      drawToken({ x: 764, y: 340, r: TOKEN.R, collected: false });
    }

    drawParticles(dt);
    ctx.restore();
  }

  return {
    draw,
    burst,
    addShake,
    debugLayout: () => null,
  };
}
