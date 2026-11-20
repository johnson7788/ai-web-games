// INK FINCH · Canvas 2D 渲染：水墨世界（晨雾竹海 / 雨夜竹径 / 雪竹山道）
// 只消费 run.state + view（shake/fxQueue/held）。像素换算全部在此完成（sim 不依赖像素）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。

import { WORLD, BIRD, GATE } from '../../config/game.config.js';

const INK = '#23232B';                 // 墨
const INK_SOFT = '#3A3A44';
const VERMILLION = '#C8402A';          // 朱砂红（签名点缀）

const SCENE_PALETTES = {
  mist: {
    skyTop: '#EEF3EA', skyMid: '#E3EAE0', skyBot: '#CFD8C9',
    fog: 'rgba(245,248,240,0.85)',
    bamboo: '#2B2B2B', bambooHi: '#4A4A4A', leaf: '#3E4A3C',
    ground: '#B9C0B0', groundDark: '#9AA292',
    accent: 'rgba(200,64,42,0.9)',
    particle: 'fog',
  },
  rain: {
    skyTop: '#161B26', skyMid: '#1E2430', skyBot: '#10141C',
    fog: 'rgba(20,24,32,0.6)',
    bamboo: '#0E1118', bambooHi: '#262C38', leaf: '#1E3B2E',
    ground: '#131720', groundDark: '#0B0E13',
    accent: 'rgba(216,88,52,0.95)',
    particle: 'rain',
  },
  snow: {
    skyTop: '#F3F5F8', skyMid: '#E8ECF2', skyBot: '#D3DAE3',
    fog: 'rgba(250,252,255,0.9)',
    bamboo: '#2A2A2A', bambooHi: '#505058', leaf: '#3E4A42',
    ground: '#E4E8EE', groundDark: '#C8CFDA',
    accent: 'rgba(200,64,42,0.95)',
    particle: 'snow',
  },
};

// ---- 静态背景离屏缓存 ----
const bgCache = new Map();

function getBackground(sceneKey) {
  let c = bgCache.get(sceneKey);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  drawBackground(c.getContext('2d'), sceneKey);
  bgCache.set(sceneKey, c);
  return c;
}

function seededRand(a, b, s) {
  const x = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawBackground(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.mist;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.6, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // 远景远山/竹影（按场景构图互异）
  if (sceneKey === 'snow') {
    drawPeaks(g, W, H);
  } else if (sceneKey === 'rain') {
    drawDistantPagoda(g, W, H);
  } else {
    drawMistHills(g, W, H);
  }

  // 远景竹影（淡、细，营造纵深）
  g.strokeStyle = sceneKey === 'rain' ? 'rgba(190,200,210,0.10)' : 'rgba(60,70,60,0.12)';
  g.lineWidth = 3;
  for (let i = 0; i < 14; i += 1) {
    const x = 40 + i * 92 + seededRand(i, 1, 3) * 30;
    g.beginPath();
    g.moveTo(x, H);
    g.quadraticCurveTo(x + seededRand(i, 2, 5) * 20 - 10, H * 0.55, x + 8, H * 0.28 - seededRand(i, 4, 9) * 40);
    g.stroke();
  }

  // 地面
  const gy = WORLD.GROUND_Y;
  g.fillStyle = P.ground;
  g.fillRect(0, gy, W, H - gy);
  const grd = g.createLinearGradient(0, gy, 0, H);
  grd.addColorStop(0, P.ground);
  grd.addColorStop(1, P.groundDark);
  g.fillStyle = grd;
  g.fillRect(0, gy, W, H - gy);
  // 地面纹理（细横线）
  g.strokeStyle = 'rgba(0,0,0,0.08)';
  g.lineWidth = 1;
  for (let y = gy + 12; y < H; y += 14) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 6); g.stroke();
  }
}

function drawMistHills(g, W, H) {
  g.fillStyle = 'rgba(190,200,180,0.35)';
  g.beginPath(); g.moveTo(0, H * 0.5);
  for (let i = 0; i <= 8; i += 1) g.lineTo((W / 8) * i, H * 0.5 - Math.sin(i * 1.3 + 1) * 90 - 30);
  g.lineTo(W, H * 0.5 + 80); g.lineTo(0, H * 0.5 + 80); g.closePath(); g.fill();
}

function drawPeaks(g, W, H) {
  g.fillStyle = 'rgba(150,165,185,0.45)';
  g.beginPath(); g.moveTo(0, H * 0.52);
  g.lineTo(180, H * 0.22); g.lineTo(300, H * 0.44);
  g.lineTo(470, H * 0.18); g.lineTo(620, H * 0.46);
  g.lineTo(820, H * 0.26); g.lineTo(1010, H * 0.5);
  g.lineTo(1280, H * 0.34); g.lineTo(1280, H * 0.6); g.lineTo(0, H * 0.6);
  g.closePath(); g.fill();
}

function drawDistantPagoda(g, W, H) {
  g.strokeStyle = 'rgba(210,220,235,0.14)';
  g.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const x = 240 + i * 180;
    const y = H * 0.42 + (i % 2) * 30;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 40, y - 70); g.lineTo(x + 80, y);
    g.lineTo(x + 40, y - 30); g.lineTo(x, y);
    g.stroke();
  }
}

// ---- 竹节（上下竹节 + 双缝中间竹节） ----
function drawBambooStalk(ctx, x, y0, y1, w, P, seed) {
  if (y1 - y0 < 4) return;
  ctx.fillStyle = P.bamboo;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x - w / 2, y0, w, y1 - y0, 3) : ctx.fillRect(x - w / 2, y0, w, y1 - y0);
  ctx.fill();
  // 竹节节点（横向凸起）
  ctx.fillStyle = P.bambooHi;
  const step = 54;
  for (let y = y0 + step; y < y1 - 6; y += step) {
    ctx.fillRect(x - w / 2 - 2, y, w + 4, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - w / 2, y + 4, w, 2);
    ctx.fillStyle = P.bambooHi;
  }
  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(x - w / 2 + 4, y0 + 4, 5, y1 - y0 - 8);
}

function drawLeaf(ctx, x, y, len, ang, P) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.strokeStyle = P.leaf;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.25, len, 0);
  ctx.stroke();
  ctx.restore();
}

// ---- 小鸟（墨色雀） ----
function drawBird(ctx, x, y, vy, clock, held) {
  ctx.save();
  ctx.translate(x, y);
  // 俯仰角随速度
  const pitch = Math.max(-0.45, Math.min(0.65, vy / 900));
  ctx.rotate(pitch);
  ctx.scale(1.25, 1.25);

  // 纸白 halo：暗场景（雨夜）下让墨雀从背景里跳出来
  ctx.fillStyle = 'rgba(248,244,236,0.5)';
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();

  // 尾羽（两道墨痕）
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-20, -4, -26, 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, 2); ctx.quadraticCurveTo(-19, 4, -25, 8); ctx.stroke();

  // 身体（墨色圆）
  const grad = ctx.createLinearGradient(-10, -8, 10, 10);
  grad.addColorStop(0, INK_SOFT);
  grad.addColorStop(1, INK);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2); ctx.fill();

  // 翅膀（拍动）
  const flap = Math.sin(clock * 14) * (held ? 0.35 : 1.0);
  ctx.save();
  ctx.rotate(flap);
  ctx.fillStyle = '#15151C';
  ctx.beginPath(); ctx.ellipse(-2, -4, 9, 5, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // 头
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(10, -3, 6, 0, Math.PI * 2); ctx.fill();
  // 喙
  ctx.fillStyle = '#3A3A44';
  ctx.beginPath(); ctx.moveTo(15, -4); ctx.lineTo(22, -2); ctx.lineTo(15, 0); ctx.closePath(); ctx.fill();
  // 朱砂眼（签名点缀）
  ctx.fillStyle = VERMILLION;
  ctx.beginPath(); ctx.arc(11, -4.5, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---- 朱砂印（目标收集物，悬浮在缝口中心） ----
function drawSealMarker(ctx, x, y, collected) {
  ctx.save();
  ctx.translate(x, y);
  if (!collected) {
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 26);
    glow.addColorStop(0, 'rgba(200,64,42,0.5)');
    glow.addColorStop(1, 'rgba(200,64,42,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = collected ? 'rgba(120,120,128,0.5)' : VERMILLION;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = collected ? 'rgba(200,200,205,0.5)' : '#fff6ec';
  ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---- 竹刺转轮 ----
function drawWheel(ctx, x, y, r, angle, P) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // 轮辐（竹刺）
  ctx.strokeStyle = P.bamboo;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  const spikes = 8;
  for (let i = 0; i < spikes; i += 1) {
    const a = (i / spikes) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  // 轮毂
  ctx.fillStyle = P.bambooHi;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = VERMILLION;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---- 环境粒子（雾/雨/雪） ----
const ambient = []; // 持久环境粒子

function ensureAmbient(sceneKey) {
  if (ambient.length && ambient[0].scene === sceneKey) return;
  ambient.length = 0;
  for (let i = 0; i < 60; i += 1) {
    ambient.push({
      scene: sceneKey,
      x: Math.random() * WORLD.WIDTH,
      y: Math.random() * WORLD.HEIGHT,
      spd: 20 + Math.random() * 60,
      size: 1 + Math.random() * 2.5,
      ph: Math.random() * Math.PI * 2,
    });
  }
}

function drawAmbient(ctx, sceneKey, dt, clock) {
  const P = SCENE_PALETTES[sceneKey];
  ensureAmbient(sceneKey);
  for (const p of ambient) {
    if (sceneKey === 'rain') {
      p.y += p.spd * dt;
      if (p.y > WORLD.HEIGHT) { p.y = -10; p.x = Math.random() * WORLD.WIDTH; }
      ctx.strokeStyle = 'rgba(200,214,232,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 2, p.y + 9); ctx.stroke();
    } else if (sceneKey === 'snow') {
      p.y += p.spd * 0.4 * dt;
      p.x += Math.sin(clock * 0.8 + p.ph) * 0.5;
      if (p.y > WORLD.HEIGHT) { p.y = -10; p.x = Math.random() * WORLD.WIDTH; }
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    } else {
      p.x -= p.spd * 0.5 * dt;
      if (p.x < -20) { p.x = WORLD.WIDTH + 20; p.y = Math.random() * WORLD.HEIGHT * 0.7; }
      ctx.fillStyle = `rgba(245,248,240,${0.16 + Math.sin(clock * 0.6 + p.ph) * 0.08})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 40 + p.size * 12, 12, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---- 墨点粒子 ----
const ink = [];

function spawnInk(x, y, n, spread) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = (Math.random() * spread);
    ink.push({
      x: x + Math.cos(a) * 6,
      y: y + Math.sin(a) * 6,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 30,
      life: 0.5 + Math.random() * 0.5,
      max: 1,
      r: 1 + Math.random() * 2.5,
    });
  }
}

function drawInk(ctx, dt) {
  for (let i = ink.length - 1; i >= 0; i -= 1) {
    const p = ink[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.life -= dt;
    if (p.life <= 0) { ink.splice(i, 1); continue; }
    const a = Math.max(0, p.life / p.max);
    ctx.fillStyle = `rgba(24,24,32,${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
}

// ---- 布局（tutorial 高亮用） ----
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;

  function resize(w, h) {
    return { w, h, world: { width: WORLD.WIDTH, height: WORLD.HEIGHT } };
  }

  function debugLayout() {
    if (!lastState) return null;
    const s = lastState;
    const g = s.gates.find((x) => !x.scored);
    return {
      bird: { x: s.bird.x - 34, y: s.bird.y - 30, w: 68, h: 60 },
      gate: g ? { x: g.x - g.w / 2 - 12, y: g.gapTop - 14, w: g.w + 24, h: g.gapBottom - g.gapTop + 28 } : null,
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: 46 },
      score: { x: 12, y: 48, w: 180, h: 40 },
      restart: { x: WORLD.WIDTH - 96, y: 4, w: 40, h: 40 },
    };
  }

  function drawTitleScene() {
    clock += 1 / 60;
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('mist'), 0, 0);
    drawAmbient(ctx, 'mist', 1 / 60, clock);
    // 标题屏前景竹与雀
    drawBambooStalk(ctx, 60, 0, 470, 60, SCENE_PALETTES.mist, 1);
    drawBambooStalk(ctx, 1220, 240, WORLD.GROUND_Y, 60, SCENE_PALETTES.mist, 2);
    drawLeaf(ctx, 90, 500, 60, -0.5, SCENE_PALETTES.mist);
    drawBird(ctx, WORLD.WIDTH / 2, 340, Math.sin(clock * 2) * 30, clock, false);
    drawInk(ctx, 1 / 60);
  }

  function draw(state, dt, view) {
    if (!state || !state.bird) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.scene || 'mist';
    clock += dt || 0;
    lastState = state;

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);
    drawAmbient(ctx, sceneKey, dt, clock);

    const P = SCENE_PALETTES[sceneKey];

    // 竹节
    for (const g of state.gates) {
      drawBambooStalk(ctx, g.x, 0, g.gapTop, g.w, P, Math.floor(g.x));
      drawBambooStalk(ctx, g.x, g.gapBottom, WORLD.GROUND_Y, g.w, P, Math.floor(g.x));
      if (g.kind === 'double') drawBambooStalk(ctx, g.x, g.upperBottom, g.lowerTop, g.w, P, Math.floor(g.x));
      // 竹叶
      if (g.gapTop > 20) drawLeaf(ctx, g.x + g.w / 2 + 6, g.gapTop + 8, 40, 0.6, P);
      if (g.gapBottom < WORLD.GROUND_Y - 20) drawLeaf(ctx, g.x - g.w / 2 - 6, g.gapBottom - 8, 40, -0.6, P);
      if (g.wheel) drawWheel(ctx, g.x, g.wheel.cy, g.wheel.r, g.wheel.angle, P);
      // 目标印：未穿 = 朱砂实心，已穿 = 灰淡
      const sealY = g.kind === 'double' ? (g.nearCenter === 'upper' ? g.upperCenter : g.lowerCenter) : g.gapY;
      drawSealMarker(ctx, g.x, sealY, g.scored);
    }

    // 分数浮字（朱砂）
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.type === 'scorePop') {
          const a = Math.max(0, fx.ttl / fx.max);
          const yy = fx.y - (1 - fx.ttl / fx.max) * 46;
          ctx.fillStyle = `rgba(200,64,42,${a})`;
          ctx.font = '900 26px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`+${fx.points}`, fx.x, yy);
        } else if (fx.type === 'inkSplash' && !fx.spawned) {
          fx.spawned = true;
          spawnInk(fx.x, fx.y, GATE ? 3 : 3, 40);
        } else if (fx.type === 'deathInk' && !fx.spawned) {
          fx.spawned = true;
          spawnInk(fx.x, fx.y, 26, 130);
        } else if (fx.type === 'nearMiss' && !fx.spawned) {
          fx.spawned = true;
          spawnInk(fx.x, fx.y, 2, 24);
        }
      }
    }
    drawInk(ctx, dt);

    // 鸟
    if (state.phase !== 'won' && state.phase !== 'lost') {
      drawBird(ctx, state.bird.x, state.bird.y, state.bird.vy, clock, state.held);
    } else {
      // 终局：墨散，雀隐（只在 lost 画散墨；won 画雀停在缝心）
      if (state.phase === 'won') drawBird(ctx, state.bird.x, state.bird.y, 0, clock, false);
    }

    ctx.restore();
  }

  return { draw, debugLayout, resize };
}
