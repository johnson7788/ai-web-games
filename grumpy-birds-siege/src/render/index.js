// GRUMPY BIRDS SIEGE · Canvas 2D 霓虹街机渲染（程序化，零素材）
// 逻辑坐标系 960×540，等比适配画布（letterbox，背景铺满）。DPR ≤2。
import { WORLD, BIRD, WALL, ROCK, SENTRY, SHIELD_ITEM, SCORE } from '../../config/game.config.js';

const TAU = Math.PI * 2;

const PAL = {
  bgTop: '#0a0216',
  bgBottom: '#2a0a3a',
  sun: '#ff3d8b',
  sunCore: '#ffd86e',
  grid: '#4b1d7a',
  castle: '#140824',
  castleEdge: '#2c1250',
  wallTop: '#ff3d8b',
  wallBot: '#22d3ee',
  bird: '#ffb340',
  birdStroke: '#fff1c1',
  birdGlow: '#ff9d2e',
  brow: '#2b1200',
  eye: '#ffffff',
  pupil: '#160a28',
  beak: '#ff7a1a',
  rock: '#39ff88',
  rockGlow: '#16c860',
  sentry: '#ff3860',
  sentryGlow: '#c81e42',
  shield: '#22d3ee',
  star: '#ffd84e',
};

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 静态星星（生成一次）
function makeStars(n, seed) {
  const stars = [];
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < n; i += 1) {
    stars.push({ x: rnd() * WORLD.WIDTH, y: rnd() * WORLD.HEIGHT * 0.7, s: 0.6 + rnd() * 1.6, tw: rnd() * TAU });
  }
  return stars;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const stars = makeStars(120, 12345);
  const fx = []; // {x,y,vx,vy,life,ttl,size,color,kind,glow}
  let view = { t: 0, shake: 0, dpr: 1, scale: 1, offX: 0, offY: 0, w: 0, h: 0, reduced: false };

  function resize(container) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = container.clientWidth || WORLD.WIDTH;
    const h = container.clientHeight || WORLD.HEIGHT;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const scale = Math.min(w / WORLD.WIDTH, h / WORLD.HEIGHT);
    view = { ...view, dpr, scale, offX: (w - WORLD.WIDTH * scale) / 2, offY: (h - WORLD.HEIGHT * scale) / 2, w, h };
  }

  function burst(x, y, opts = {}) {
    const n = opts.n || 6;
    for (let i = 0; i < n; i += 1) {
      const a = opts.angle != null ? opts.angle + (Math.random() - 0.5) * (opts.spread || 0.8) : Math.random() * TAU;
      const sp = (opts.speed || 2) * (0.5 + Math.random());
      fx.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        ttl: opts.ttl || 0.5,
        size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
        color: opts.color || PAL.bird,
        glow: opts.glow || false,
        kind: opts.kind || 'dot',
      });
    }
    if (fx.length > 260) fx.splice(0, fx.length - 260);
  }

  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, view.h);
    g.addColorStop(0, PAL.bgTop);
    g.addColorStop(1, PAL.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);

    // 星星（在逻辑坐标里画，需先进入 world 变换）
  }

  function drawSky(t) {
    // 星空
    for (const s of stars) {
      const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 2 + s.tw));
      ctx.fillStyle = `rgba(200,180,255,${a.toFixed(2)})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    // 远处霓虹地平线光（低对比，纯氛围，不构成可读物体）
    const hx = WORLD.WIDTH * 0.8;
    const hy = WORLD.HEIGHT * 0.34;
    const hr = 90;
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    hg.addColorStop(0, 'rgba(255,110,199,0.22)');
    hg.addColorStop(1, 'rgba(255,61,139,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
  }

  function drawCastle(t) {
    // 远景城堡剪影（右下，含城垛）
    const base = WORLD.GROUND_Y;
    ctx.fillStyle = PAL.castle;
    const towers = [
      { x: WORLD.WIDTH * 0.62, w: 90, h: 120 },
      { x: WORLD.WIDTH * 0.74, w: 60, h: 150 },
      { x: WORLD.WIDTH * 0.86, w: 70, h: 100 },
    ];
    for (const tw of towers) {
      ctx.fillRect(tw.x, base - tw.h, tw.w, tw.h);
      // 城垛
      const cw = 12;
      for (let cx = tw.x; cx < tw.x + tw.w; cx += cw * 2) {
        ctx.fillRect(cx, base - tw.h - 12, cw, 12);
      }
    }
    ctx.fillStyle = PAL.castleEdge;
    for (const tw of towers) {
      ctx.fillRect(tw.x, base - tw.h, tw.w, 3);
    }
  }

  function drawGrid(t) {
    const base = WORLD.GROUND_Y;
    // 透视网格地板
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1.5;
    glow(ctx, PAL.wallBot, 8);
    ctx.beginPath();
    const horizon = base;
    const bottom = WORLD.HEIGHT;
    for (let i = -6; i <= 6; i += 1) {
      const x = WORLD.WIDTH / 2 + i * 90 + ((t * 30) % 90);
      ctx.moveTo(x, horizon);
      ctx.lineTo(WORLD.WIDTH / 2 + i * 46, bottom);
    }
    ctx.stroke();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(10,2,22,0.55)';
    ctx.fillRect(0, base, WORLD.WIDTH, WORLD.HEIGHT - base);
  }

  function drawWall(w, st) {
    const gapY = w.baseY + Math.sin(st.time * TAU / WALL.OSC_PERIOD) * WALL.OSC_AMP;
    const gh = st.gapH;
    const x = w.x;
    const wd = WALL.WIDTH;

    // 上下墙同一色（读作「一道墙上的缺口」，而非两个物体）
    drawTower(x, 0, wd, gapY, PAL.wallTop);
    drawTower(x, gapY + gh, wd, WORLD.GROUND_Y - (gapY + gh), PAL.wallTop);

    // 缺口引导光柱（穿过缺口中心，提示飞行通道）
    ctx.fillStyle = 'rgba(34,211,238,0.12)';
    ctx.fillRect(x - 2, gapY + 6, wd + 4, gh - 12);
    // 缺口两端光晕提示
    glow(ctx, PAL.wallBot, 12);
    ctx.fillStyle = PAL.wallBot;
    ctx.fillRect(x - 5, gapY - 3, wd + 10, 6);
    ctx.fillRect(x - 5, gapY + gh - 3, wd + 10, 6);
    noGlow(ctx);
    // 缺口中心「通过」箭头（脉冲）
    drawGapChevron(x + wd / 2, gapY + gh / 2, st.time);
  }

  function drawTower(x, y, wd, h, color) {
    if (h <= 0) return;
    // 塔身
    ctx.fillStyle = 'rgba(12,4,28,0.86)';
    ctx.fillRect(x, y, wd, h);
    // 霓虹描边
    glow(ctx, color, 12);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 1.5, y + 1.5, wd - 3, Math.max(0, h - 3));
    noGlow(ctx);
    // 砖纹
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let by = y + 14; by < y + h - 8; by += 22) {
      ctx.fillRect(x + 6, by, wd - 12, 2);
    }
    // 顶部城垛
    ctx.fillStyle = color;
    const cw = 8;
    for (let cx = x; cx < x + wd; cx += cw * 2) {
      ctx.fillRect(cx, y, cw, 6);
    }
  }

  function drawBird(st) {
    const x = BIRD.X;
    const y = st.bird.y;
    const r = BIRD.R;
    const ang = clampAngle(st.bird.vy * 0.06);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    // 尾迹
    if (st.phase === 'playing') {
      ctx.strokeStyle = 'rgba(255,179,64,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r - 6, 0);
      ctx.lineTo(-r - 18, st.bird.vy * -1.4);
      ctx.stroke();
    }

    // 盾牌光环
    if (st.bird.shielded) {
      glow(ctx, PAL.shield, 16);
      ctx.strokeStyle = PAL.shield;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 7, 0, TAU);
      ctx.stroke();
      noGlow(ctx);
    }

    // 身体
    glow(ctx, PAL.birdGlow, 18);
    ctx.fillStyle = PAL.bird;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = PAL.birdStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 肚皮
    ctx.fillStyle = 'rgba(255,241,193,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.45, r * 0.55, r * 0.42, 0, 0, TAU);
    ctx.fill();

    // 怒眉（两条斜线）
    ctx.strokeStyle = PAL.brow;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.42);
    ctx.lineTo(-r * 0.08, -r * 0.62);
    ctx.moveTo(r * 0.08, -r * 0.62);
    ctx.lineTo(r * 0.55, -r * 0.42);
    ctx.stroke();

    // 眼睛
    ctx.fillStyle = PAL.eye;
    ctx.beginPath();
    ctx.arc(-r * 0.34, -r * 0.2, r * 0.3, 0, TAU);
    ctx.arc(r * 0.34, -r * 0.2, r * 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PAL.pupil;
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.16, r * 0.14, 0, TAU);
    ctx.arc(r * 0.38, -r * 0.16, r * 0.14, 0, TAU);
    ctx.fill();

    // 喙
    ctx.fillStyle = PAL.beak;
    ctx.beginPath();
    ctx.moveTo(r * 0.42, r * 0.02);
    ctx.lineTo(r * 1.1, r * 0.18);
    ctx.lineTo(r * 0.42, r * 0.34);
    ctx.closePath();
    ctx.fill();

    // 翅膀
    ctx.fillStyle = '#e08718';
    ctx.beginPath();
    ctx.ellipse(-r * 0.15, r * 0.42, r * 0.5, r * 0.28, -0.5, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function clampAngle(v) { return Math.min(0.9, Math.max(-0.9, v)); }

  function drawRock(rock) {
    glow(ctx, PAL.rockGlow, 14);
    ctx.fillStyle = PAL.rock;
    ctx.beginPath();
    ctx.arc(rock.x, rock.y, ROCK.R, 0, TAU);
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(rock.x - 3, rock.y - 3, ROCK.R * 0.35, 0, TAU);
    ctx.fill();
  }

  function drawSentry(s) {
    const r = SENTRY.R;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.PI); // 面向左
    glow(ctx, PAL.sentryGlow, 14);
    ctx.fillStyle = PAL.sentry;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = PAL.eye;
    ctx.beginPath();
    ctx.arc(r * 0.3, -r * 0.15, r * 0.26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PAL.pupil;
    ctx.beginPath();
    ctx.arc(r * 0.36, -r * 0.12, r * 0.12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PAL.brow;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.6);
    ctx.lineTo(r * 0.5, -r * 0.35);
    ctx.stroke();
    ctx.restore();
  }

  function drawShieldItem(sh, t) {
    if (!sh.active) return;
    const pulse = 1 + 0.12 * Math.sin(t * 5);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.scale(pulse, pulse);
    glow(ctx, PAL.shield, 18);
    ctx.strokeStyle = PAL.shield;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = Math.cos(a) * SHIELD_ITEM.R;
      const py = Math.sin(a) * SHIELD_ITEM.R;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(34,211,238,0.25)';
    ctx.fill();
    ctx.restore();
  }

  function drawGapChevron(cx, cy, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    const off = 6 + pulse * 5;
    ctx.globalAlpha = 0.45 + pulse * 0.45;
    ctx.strokeStyle = PAL.wallBot;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx - off - 4, cy - 12);
      ctx.lineTo(cx - off + 5, cy);
      ctx.lineTo(cx - off - 4, cy + 12);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawReadyHint(state) {
    const x = BIRD.X;
    const y = state.bird.y - BIRD.R - 34;
    const pulse = 0.6 + 0.4 * Math.sin(view.t * 5);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#fff1c1';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAP TO FLAP', x, y);
    ctx.globalAlpha = 1;
  }

  function drawParticles(dt, t) {
    for (let i = fx.length - 1; i >= 0; i -= 1) {
      const p = fx[i];
      p.life += dt;
      if (p.life >= p.ttl) { fx.splice(i, 1); continue; }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += (p.gravity || 0) * dt * 60;
      const a = 1 - p.life / p.ttl;
      ctx.globalAlpha = Math.max(0, a);
      if (p.glow) glow(ctx, p.color, 10);
      ctx.fillStyle = p.color;
      const s = p.size * (p.kind === 'ring' ? (0.5 + p.life / p.ttl) : a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, s), 0, TAU);
      ctx.fill();
      noGlow(ctx);
    }
    ctx.globalAlpha = 1;
  }

  function draw(state, dt, v) {
    view.t = v.t;
    view.shake = v.shake;
    view.reduced = v.reduced;

    // 背景（铺满画布）
    const g = ctx.createLinearGradient(0, 0, 0, view.h);
    g.addColorStop(0, PAL.bgTop);
    g.addColorStop(1, PAL.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);

    // 世界坐标
    ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, view.dpr * view.offX, view.dpr * view.offY);
    if (view.shake > 0) {
      ctx.translate((Math.random() - 0.5) * view.shake * 2, (Math.random() - 0.5) * view.shake * 2);
    }

    drawSky(view.t);
    drawCastle(view.t);
    drawGrid(view.t);

    if (state) {
      if (state.phase !== 'title') {
        for (const w of state.walls) drawWall(w, state);
        if (state.shieldItem) drawShieldItem(state.shieldItem, view.t);
        if (state.sentry) drawSentry(state.sentry);
        for (const rock of state.rocks) drawRock(rock);
        drawBird(state);
        if (state.phase === 'ready') drawReadyHint(state);
      }
      drawParticles(dt, view.t);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { resize, draw, burst, get fx() { return fx; } };
}
