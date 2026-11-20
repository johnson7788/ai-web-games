// NEON SERPENT · Canvas 2D 渲染（全程序化霓虹街机风格，零素材零外链）
// 职责：合成波峡谷背景、霓虹柱门、道具、发光飞蛇、粒子。DPR ≤2，60Hz 供图。
import { WORLD, SERPENT, GATES } from '../../config/game.config.js';

const TAU = Math.PI * 2;

// 霓虹调色板（全游戏统一）
const PAL = {
  skyTop: '#08031f',
  skyMid: '#180b3c',
  skyBot: '#3b1266',
  sunTop: '#ff5ea8',
  sunBot: '#ffb13c',
  sunCore: '#ffe97a',
  mountain1: '#160b30',
  mountain2: '#0d0620',
  floorTop: '#2a0f4d',
  floorGrid: '#7d3cff',
  floorGlow: '#ff2ecc',
  crystal: '#19f6ff',
  crystalCore: '#c9ffff',
  rock: '#b347ff',
  rockCore: '#e7c6ff',
  head: '#4dffc9',
  bodyHi: '#31e0ff',
  bodyLo: '#ff4dc4',
  heart: '#ff4d9d',
  gem: '#4de3ff',
  star: '#ffe14d',
};

function glow(ctx, color, r) {
  ctx.shadowColor = color;
  ctx.shadowBlur = r;
}

function noGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  const particles = [];
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({
      x: Math.random() * WORLD.WIDTH,
      y: Math.random() * WORLD.HEIGHT * 0.55,
      r: Math.random() * 1.4 + 0.4,
      tw: Math.random() * TAU,
    });
  }

  function burst(x, y, color, n = 12, speed = 160) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const v = speed * (0.4 + Math.random() * 0.8);
      particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        ttl: 0.5 + Math.random() * 0.4,
        life: 0,
        color,
        r: 1.5 + Math.random() * 2.5,
      });
    }
  }

  function drawSky(t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, PAL.skyTop);
    g.addColorStop(0.55, PAL.skyMid);
    g.addColorStop(1, PAL.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星星
    for (const s of stars) {
      const a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#d9e6ff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // 合成波落日
    const sunX = WORLD.WIDTH * 0.5;
    const sunY = WORLD.HEIGHT * 0.46;
    const sunR = 150;
    const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sg.addColorStop(0, PAL.sunTop);
    sg.addColorStop(0.6, PAL.sunBot);
    sg.addColorStop(1, PAL.sunCore);
    glow(ctx, PAL.sunBot, 40);
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, TAU);
    ctx.fill();
    // 条纹遮罩
    noGlow(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(8,3,31,0.9)';
    for (let y = sunY + 18; y < sunY + sunR; y += 14) ctx.fillRect(sunX - sunR, y, sunR * 2, 5);
    ctx.restore();
  }

  function drawMountains() {
    // 远山
    ctx.fillStyle = PAL.mountain1;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.HEIGHT * 0.6);
    for (let x = 0; x <= WORLD.WIDTH; x += 40) {
      ctx.lineTo(x, WORLD.HEIGHT * (0.6 - 0.08 * Math.sin(x * 0.004) - 0.04 * Math.sin(x * 0.013 + 2)));
    }
    ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT);
    ctx.lineTo(0, WORLD.HEIGHT);
    ctx.closePath();
    ctx.fill();
    // 近山（霓虹描边）
    ctx.fillStyle = PAL.mountain2;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.HEIGHT * 0.72);
    for (let x = 0; x <= WORLD.WIDTH; x += 32) {
      ctx.lineTo(x, WORLD.HEIGHT * (0.72 - 0.1 * Math.sin(x * 0.006 + 1)));
    }
    ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT);
    ctx.lineTo(0, WORLD.HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  function drawFloor(t) {
    const fy = WORLD.HEIGHT * 0.82;
    const g = ctx.createLinearGradient(0, fy, 0, WORLD.HEIGHT);
    g.addColorStop(0, PAL.floorTop);
    g.addColorStop(1, '#0b0320');
    ctx.fillStyle = g;
    ctx.fillRect(0, fy, WORLD.WIDTH, WORLD.HEIGHT - fy);

    // 透视网格
    glow(ctx, PAL.floorGlow, 6);
    ctx.strokeStyle = PAL.floorGrid;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.5;
    const horizonY = fy;
    for (let i = 0; i < 10; i += 1) {
      const yy = fy + Math.pow(i / 9, 2.2) * (WORLD.HEIGHT - fy);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(WORLD.WIDTH, yy);
      ctx.stroke();
    }
    // 竖线向消失点汇聚 + 缓慢滚动
    const off = (t * 140) % 96;
    for (let i = -1; i < 16; i += 1) {
      const x = i * 96 + off;
      const px = WORLD.WIDTH * 0.5 + (x - WORLD.WIDTH * 0.5) * 0.35;
      ctx.beginPath();
      ctx.moveTo(WORLD.WIDTH * 0.5, horizonY);
      ctx.lineTo(px, WORLD.HEIGHT);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    noGlow(ctx);
    // 底部辉光带
    const bg = ctx.createLinearGradient(0, WORLD.HEIGHT - 70, 0, WORLD.HEIGHT);
    bg.addColorStop(0, 'rgba(255,46,204,0)');
    bg.addColorStop(1, 'rgba(255,46,204,0.25)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, WORLD.HEIGHT - 70, WORLD.WIDTH, 70);
  }

  function drawGate(g) {
    const gapTop = g.gapY - g.gapH / 2;
    const gapBot = g.gapY + g.gapH / 2;
    const color = g.kind === 'rock' ? PAL.rock : PAL.crystal;
    const core = g.kind === 'rock' ? PAL.rockCore : PAL.crystalCore;
    const hw = g.w / 2;
    // 上柱
    if (gapTop > 0) drawPillar(g.x - hw, 0, g.w, gapTop, color, core);
    // 下柱
    if (gapBot < WORLD.HEIGHT) drawPillar(g.x - hw, gapBot, g.w, WORLD.HEIGHT - gapBot, color, core);
    // 缺口上下缘辉光
    glow(ctx, color, 16);
    ctx.strokeStyle = core;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(g.x - hw - 4, gapTop);
    ctx.lineTo(g.x + hw + 4, gapTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(g.x - hw - 4, gapBot);
    ctx.lineTo(g.x + hw + 4, gapBot);
    ctx.stroke();
    noGlow(ctx);
  }

  function drawPillar(x, y, w, h, color, core) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.9)');
    g.addColorStop(0.5, color);
    g.addColorStop(1, 'rgba(0,0,0,0.9)');
    glow(ctx, color, 12);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    noGlow(ctx);
    ctx.strokeStyle = core;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.85;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.globalAlpha = 1;
  }

  function drawPickup(p, t) {
    const bob = Math.sin(t * 4 + p.x * 0.01) * 3;
    const y = p.y + bob;
    if (p.kind === 'heart') {
      glow(ctx, PAL.heart, 14);
      ctx.fillStyle = PAL.heart;
      heartPath(p.x, y, 12);
      ctx.fill();
      noGlow(ctx);
    } else if (p.kind === 'gem') {
      glow(ctx, PAL.gem, 14);
      ctx.fillStyle = PAL.gem;
      ctx.beginPath();
      ctx.moveTo(p.x, y - 12);
      ctx.lineTo(p.x + 11, y);
      ctx.lineTo(p.x, y + 12);
      ctx.lineTo(p.x - 11, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(p.x, y - 5);
      ctx.lineTo(p.x + 4, y);
      ctx.lineTo(p.x, y + 5);
      ctx.lineTo(p.x - 4, y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      noGlow(ctx);
    } else { // star
      glow(ctx, PAL.star, 14);
      ctx.fillStyle = PAL.star;
      starPath(p.x, y, 12, 5, 5);
      ctx.fill();
      noGlow(ctx);
    }
  }

  function heartPath(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.4, y - s * 0.2, x - s * 0.6, y - s * 1.1, x, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.2, x, y + s * 0.9);
    ctx.closePath();
  }

  function starPath(x, y, r, points, inner) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const rad = i % 2 === 0 ? r : r * (inner / 5);
      const a = (i / (points * 2)) * TAU - Math.PI / 2;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawSerpent(state, t, decorative) {
    const serp = state ? state.serpent : null;
    const headY = serp ? serp.y : WORLD.HEIGHT * 0.5 + Math.sin(t * 2) * 30;
    const segs = serp ? serp.segs : [
      { x: SERPENT.X - 38, y: headY + 8 },
      { x: SERPENT.X - 76, y: headY + 18 },
      { x: SERPENT.X - 114, y: headY + 26 },
    ];

    // 护盾光环
    if (serp && serp.shieldT > 0) {
      glow(ctx, PAL.gem, 22);
      ctx.strokeStyle = 'rgba(77,227,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(SERPENT.X, headY, SERPENT.R + 10, 0, TAU);
      ctx.stroke();
      noGlow(ctx);
    }
    // 狂热光环
    if (serp && serp.feverT > 0) {
      const h = (t * 6) % 1;
      glow(ctx, `hsl(${Math.round(h * 360)},90%,60%)`, 26);
      ctx.strokeStyle = `hsl(${Math.round(h * 360)},90%,62%)`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(SERPENT.X, headY, SERPENT.R + 14, 0, TAU);
      ctx.stroke();
      noGlow(ctx);
    }

    // 连续蛇身：尾→头逐段用粗线连成一条发光缎带（不再是一串分离的球）
    const pts = [{ x: SERPENT.X, y: headY }, ...segs];
    const n = pts.length;
    const radii = pts.map((_, i) => (i === 0 ? SERPENT.R : Math.max(8, SERPENT.R - 2 - i * 2.4)));
    for (let i = n - 1; i >= 1; i -= 1) {
      const k = i / Math.max(1, n - 1);
      const color = lerpColor(PAL.bodyHi, PAL.bodyLo, k);
      glow(ctx, color, 10);
      ctx.strokeStyle = color;
      ctx.lineWidth = radii[i] * 1.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i - 1].x, pts[i - 1].y);
      ctx.stroke();
    }
    noGlow(ctx);

    // 身体圆节（填充，让蛇身更实）
    for (let i = n - 1; i >= 0; i -= 1) {
      const k = i / Math.max(1, n - 1);
      const color = i === 0 ? PAL.head : lerpColor(PAL.bodyHi, PAL.bodyLo, k);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, radii[i], 0, TAU);
      ctx.fill();
    }

    // 头部：更亮 + 背鳍（读出「生物」而非球）
    glow(ctx, PAL.head, 20);
    ctx.fillStyle = PAL.head;
    ctx.beginPath();
    ctx.arc(SERPENT.X, headY, SERPENT.R + 1, 0, TAU);
    ctx.fill();
    noGlow(ctx);
    // 背鳍
    ctx.fillStyle = PAL.bodyHi;
    ctx.beginPath();
    ctx.moveTo(SERPENT.X - 6, headY - SERPENT.R + 2);
    ctx.lineTo(SERPENT.X + 6, headY - SERPENT.R - 12);
    ctx.lineTo(SERPENT.X + 12, headY - SERPENT.R + 3);
    ctx.closePath();
    ctx.fill();

    // 眼睛 + 瞳孔（朝向右侧 = 前进方向）
    if (!decorative) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(SERPENT.X + 9, headY - 3, 5.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#0a0420';
      ctx.beginPath();
      ctx.arc(SERPENT.X + 11, headY - 3, 2.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(SERPENT.X + 12.4, headY - 4.4, 1, 0, TAU);
      ctx.fill();
    }
  }

  // 目标标记：在最近一个未通过门的缺口中心画脉冲虚线环 + 右指箭头（让「飞进缺口」一眼可见）
  function drawGapMarker(state, t) {
    let g = null;
    for (const gate of state.gates) {
      if (!gate.passed && gate.x > SERPENT.X - 40) { g = gate; break; }
    }
    if (!g || g.x > WORLD.WIDTH + 120) return;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    glow(ctx, PAL.crystal, 16 + pulse * 10);
    ctx.strokeStyle = PAL.crystal;
    ctx.lineWidth = 3 + pulse * 1.5;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    ctx.arc(g.x, g.gapY, g.gapH * 0.34 + pulse * 5, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    noGlow(ctx);
    // 右指箭头（飞向缺口）
    ctx.fillStyle = PAL.crystalCore;
    ctx.strokeStyle = 'rgba(6,2,15,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x - g.gapH * 0.34 - 26, g.gapY);
    ctx.lineTo(g.x - g.gapH * 0.34 - 12, g.gapY - 10);
    ctx.lineTo(g.x - g.gapH * 0.34 - 12, g.gapY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawParticles(dt) {
    for (const p of particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      const a = Math.max(0, 1 - p.life / p.ttl);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = particles.length - 1; i >= 0; i -= 1) if (particles[i].life >= particles[i].ttl) particles.splice(i, 1);
  }

  function lerpColor(a, b, k) {
    const pa = hexToRgb(a);
    const pb = hexToRgb(b);
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * k);
    const g = Math.round(pa[1] + (pb[1] - pa[1]) * k);
    const bl = Math.round(pa[2] + (pb[2] - pa[2]) * k);
    return `rgb(${r},${g},${bl})`;
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  return {
    draw(state, dt, view = {}) {
      const t = (view.t ?? 0) + (state ? state.time : 0);
      drawSky(t);
      drawMountains();
      drawFloor(t);
      if (state) {
        for (const g of state.gates) if (g.x > -GATES.ROCK_W && g.x < WORLD.WIDTH + GATES.ROCK_W) drawGate(g);
        drawGapMarker(state, t);
        for (const p of state.pickups) if (!p.collected && p.x > -40 && p.x < WORLD.WIDTH + 40) drawPickup(p, t);
        drawSerpent(state, t, false);
      } else {
        drawSerpent(null, t, true);
      }
      drawParticles(dt);
    },

    burst,
    clearParticles() { particles.length = 0; },

    debugLayout() {
      // 教程聚光灯不需要精确定位，返回空即可（tutorial 卡片固定底部居中）
      return null;
    },
  };
}
