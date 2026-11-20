// LAUNCH LEGENDS · Canvas 2D 渲染：三个夜空场景 / 云层障碍 / 烟花弹 / 尾焰 / 迷你烟花。
// 只消费 run.state（contract）+ view（shake/fx/fireworks/sceneKey/cursor）。
// 像素换算全部在此完成（sim 只给层索引、列号与归一化弹跳相位 bounceT）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize() }。

import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const SCENE_PALETTES = {
  town: {
    skyTop: '#1C2A58', skyMid: '#2E3F7E', skyBot: '#4E62A4',
    cityFar: '#26335E', cityNear: '#141F44', window: '#FFE08A',
    ground: '#26345C', pad: '#55689A', padHi: '#7E90C0',
    glow: 'rgba(255,190,130,0.45)',
  },
  clouds: {
    skyTop: '#3570B8', skyMid: '#7FB0E0', skyBot: '#D0E9F8',
    cityFar: '#9FC2E0', cityNear: '#D0E9F8', window: '#FFFFFF',
    ground: '#5A86B8', pad: '#4A7AB0', padHi: '#82B0D8',
    glow: 'rgba(255,242,190,0.45)',
  },
  rings: {
    skyTop: '#2A1548', skyMid: '#3E2864', skyBot: '#5E428A',
    cityFar: '#382058', cityNear: '#27143E', window: '#EBCFFF',
    ground: '#31204E', pad: '#6A4A90', padHi: '#9072B8',
    glow: 'rgba(210,160,255,0.40)',
  },
};

const BOUNCE_H = LAYOUT.FLOOR_Y - LAYOUT.CEIL_Y;

// ---- 静态背景离屏缓存（每帧只 drawImage 一次） ----
const bgCache = new Map();

function seededRand(seed, a, b) {
  let x = seed >>> 0;
  x = (x + 0x6D2B79F5) | 0;
  let t = Math.imul(x ^ (x >>> 15), 1 | x);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * (b - a) + a;
}

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

function drawBackground(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.town;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  drawStars(g, sceneKey);

  if (sceneKey === 'town') drawCity(g, P);
  else if (sceneKey === 'clouds') drawCloudBank(g, P);
  else drawRings(g, P);

  // 地面
  g.fillStyle = P.ground;
  g.fillRect(0, LAYOUT.LAUNCH_PAD_Y, W, H - LAYOUT.LAUNCH_PAD_Y);
  const grd = g.createLinearGradient(0, LAYOUT.LAUNCH_PAD_Y, 0, H);
  grd.addColorStop(0, P.ground);
  grd.addColorStop(1, P.skyBot);
  g.fillStyle = grd;
  g.fillRect(0, LAYOUT.LAUNCH_PAD_Y, W, H - LAYOUT.LAUNCH_PAD_Y);
}

function drawStars(g, sceneKey) {
  const n = sceneKey === 'rings' ? 150 : 110;
  for (let i = 0; i < n; i += 1) {
    const x = seededRand(i * 7 + 1, 0, WORLD.WIDTH);
    const y = seededRand(i * 13 + 2, 0, WORLD.HEIGHT * 0.62);
    const r = 0.7 + seededRand(i * 17 + 3, 0, 1.8);
    const a = 0.45 + seededRand(i * 19 + 4, 0, 0.55);
    g.fillStyle = `rgba(235,244,255,${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

function drawCity(g, P) {
  for (let i = 0; i < 22; i += 1) {
    const w = seededRand(i * 3 + 5, 34, 90);
    const h = seededRand(i * 5 + 6, 60, 210);
    const x = i * (WORLD.WIDTH / 22) - 6;
    const y = LAYOUT.LAUNCH_PAD_Y - h;
    g.fillStyle = i % 2 ? P.cityFar : P.cityNear;
    g.fillRect(x, y, w, h);
    // 窗灯
    for (let wy = y + 10; wy < y + h - 8; wy += 18) {
      for (let wx = x + 8; wx < x + w - 8; wx += 16) {
        if (seededRand(i * 31 + wx * 3 + wy, 0, 1) > 0.6) {
          g.fillStyle = P.window;
          g.fillRect(wx, wy, 5, 7);
        }
      }
    }
  }
}

function drawCloudBank(g, P) {
  for (let i = 0; i < 6; i += 1) {
    const x = seededRand(i * 7 + 11, -60, WORLD.WIDTH);
    const y = seededRand(i * 11 + 13, 60, 320);
    const s = 0.6 + seededRand(i * 5 + 17, 0, 0.9);
    puffCloud(g, x, y, s, 'rgba(255,255,255,0.28)');
  }
}

function drawRings(g, P) {
  const cx = WORLD.WIDTH * 0.74, cy = 300, r = 120;
  g.strokeStyle = 'rgba(230,180,255,0.5)';
  g.lineWidth = 10;
  g.beginPath();
  g.ellipse(cx, cy, r, r * 0.42, -0.5, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(150,120,220,0.4)';
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(cx, cy, r + 22, r * 0.5, -0.5, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#F0E6FF';
  g.beginPath();
  g.arc(cx - r * 0.4, cy - 40, 22, 0, Math.PI * 2);
  g.fill();
}

// ---- 云絮（可撞碎 / 收集物） ----
function puffCloud(g, x, y, s, color) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, 16 * s, 0, Math.PI * 2);
  g.arc(x + 16 * s, y - 6 * s, 13 * s, 0, Math.PI * 2);
  g.arc(x - 16 * s, y - 5 * s, 12 * s, 0, Math.PI * 2);
  g.fill();
}

function drawCloud(g, x, y, w, h, bright) {
  const cx = x + w / 2, cy = y + h / 2;
  const base = bright ? 'rgba(235,252,255,0.98)' : 'rgba(205,238,255,0.95)';
  const rim = 'rgba(255,255,255,0.98)';
  const halo = g.createRadialGradient(cx, cy, 2, cx, cy, w * 0.62);
  halo.addColorStop(0, 'rgba(190,235,255,0.30)');
  halo.addColorStop(1, 'rgba(190,235,255,0)');
  g.fillStyle = halo;
  g.fillRect(x - 8, y - 10, w + 16, h + 20);
  g.fillStyle = base;
  g.beginPath();
  g.arc(cx, cy + 4, h * 0.5, 0, Math.PI * 2);
  g.arc(cx - w * 0.26, cy + 2, h * 0.36, 0, Math.PI * 2);
  g.arc(cx + w * 0.26, cy + 2, h * 0.38, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = rim;
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(cx, cy + 4, h * 0.5, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
  // 收集物标记：一闪一闪的 ✦
  if (bright) {
    const tw = 0.6 + 0.4 * Math.sin((Date.now ? Date.now() : 0) * 0.006 + x * 0.1);
    g.fillStyle = `rgba(255,244,180,${0.5 + 0.5 * tw})`;
    g.font = '700 15px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('✦', cx, cy - 2);
  }
}

// ---- 钢棚（危险 / 只有炽热态可烧穿） ----
function drawSteel(g, x, y, w, h) {
  const grad = g.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#4A4E5E');
  grad.addColorStop(0.5, '#2A2E3C');
  grad.addColorStop(1, '#1A1E28');
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  // 危险斜纹
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = 'rgba(255,190,90,0.55)';
  g.lineWidth = 4;
  for (let dx = -h; dx < w + h; dx += 18) {
    g.beginPath();
    g.moveTo(x + dx, y + h);
    g.lineTo(x + dx + h, y);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 1.5;
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

// ---- 发射台 ----
function drawLaunchPad(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.town;
  const y = LAYOUT.LAUNCH_PAD_Y;
  g.fillStyle = P.pad;
  g.beginPath();
  g.moveTo(WORLD.WIDTH / 2 - 90, y);
  g.lineTo(WORLD.WIDTH / 2 + 90, y);
  g.lineTo(WORLD.WIDTH / 2 + 70, y + 52);
  g.lineTo(WORLD.WIDTH / 2 - 70, y + 52);
  g.closePath();
  g.fill();
  g.fillStyle = P.padHi;
  g.fillRect(WORLD.WIDTH / 2 - 90, y - 4, 180, 8);
}

// ---- 烟花弹（程序化，≤40 图元） ----
function drawRocket(g, x, y, incandescent, rising, clock) {
  g.save();
  g.translate(x, y);
  g.scale(1.4, 1.4);
  // 常亮光晕（突出玩家，保证眯眼可辨）
  const halo = g.createRadialGradient(0, 0, 4, 0, 0, 30);
  halo.addColorStop(0, 'rgba(255,210,130,0.55)');
  halo.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = halo;
  g.beginPath();
  g.arc(0, 0, 30, 0, Math.PI * 2);
  g.fill();
  if (incandescent) {
    const glow = g.createRadialGradient(0, 0, 4, 0, 0, 46);
    glow.addColorStop(0, 'rgba(255,220,150,0.9)');
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, 46, 0, Math.PI * 2);
    g.fill();
  }

  // 尾焰（下方）
  const flameLen = incandescent ? 46 : (rising ? 34 : 20);
  const flameW = incandescent ? 16 : 11;
  const fg = g.createLinearGradient(0, 0, 0, flameLen);
  if (incandescent) {
    fg.addColorStop(0, '#FFFFFF');
    fg.addColorStop(0.3, '#FFE08A');
    fg.addColorStop(1, 'rgba(255,90,20,0)');
  } else {
    fg.addColorStop(0, '#FFF2B0');
    fg.addColorStop(0.4, '#FFB340');
    fg.addColorStop(1, 'rgba(255,70,20,0)');
  }
  g.fillStyle = fg;
  g.beginPath();
  g.moveTo(-flameW, 6);
  g.quadraticCurveTo(0, flameLen, flameW, 6);
  g.closePath();
  g.fill();

  // 弹体
  const body = g.createLinearGradient(-9, -22, 9, 0);
  if (incandescent) {
    body.addColorStop(0, '#FFFFFF');
    body.addColorStop(1, '#FFB020');
  } else {
    body.addColorStop(0, '#FFE9C8');
    body.addColorStop(1, '#E0553A');
  }
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(0, -30);
  g.quadraticCurveTo(9, -20, 8, -6);
  g.lineTo(8, 6);
  g.lineTo(-8, 6);
  g.lineTo(-8, -6);
  g.quadraticCurveTo(-9, -20, 0, -30);
  g.closePath();
  g.fill();

  // 尾翼
  g.fillStyle = incandescent ? '#FF8A3A' : '#C23A2A';
  g.beginPath();
  g.moveTo(-8, 4); g.lineTo(-16, 14); g.lineTo(-8, 12); g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(8, 4); g.lineTo(16, 14); g.lineTo(8, 12); g.closePath(); g.fill();

  // 亮点
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(-3, -14, 2.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---- 特效（粒子 + 烟花） ----
function drawFx(g, view) {
  if (!view) return;
  if (view.sparks) {
    for (const s of view.sparks) {
      const k = s.ttl / s.max;
      g.fillStyle = `rgba(255,${Math.floor(180 + 60 * k)},120,${k})`;
      g.beginPath();
      g.arc(s.x, s.y, 2 + k * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (view.fireworks) {
    for (const f of view.fireworks) {
      const k = 1 - f.ttl / f.max; // 0→1 展开
      const r = 18 + k * 58;
      const a = f.ttl / f.max;
      g.strokeStyle = `rgba(255,${Math.floor(200 * a + 55)},${Math.floor(120 * a)},${a})`;
      g.lineWidth = 2;
      for (let i = 0; i < 12; i += 1) {
        const ang = (i / 12) * Math.PI * 2 + f.seed;
        const px = f.x + Math.cos(ang) * r;
        const py = f.y + Math.sin(ang) * r;
        g.beginPath();
        g.arc(px, py, 2.5 * a, 0, Math.PI * 2);
        g.fillStyle = `rgba(255,240,180,${a})`;
        g.fill();
      }
    }
  }
}

// ---- 布局（contract：render 从 config 计算，sim 不依赖像素） ----
function computeLayout(state) {
  return {
    hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
    playfield: { x: 0, y: LAYOUT.HUD_H, w: WORLD.WIDTH, h: WORLD.HEIGHT - LAYOUT.HUD_H },
    cloud: { x: 80, y: LAYOUT.CEIL_Y - 6, w: 200, h: LAYOUT.BAR_H + 10 },
    goal: { x: WORLD.WIDTH - 240, y: LAYOUT.HUD_H + 6, w: 200, h: 34 },
  };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;

  function resize() {
    return { w: WORLD.WIDTH, h: WORLD.HEIGHT };
  }

  function debugLayout() {
    return computeLayout(lastState);
  }

  function rocketY(state) {
    const p = Math.max(0, Math.min(1, state.bounceT));
    return LAYOUT.FLOOR_Y - BOUNCE_H * 4 * p * (1 - p);
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('town'), 0, 0);
    drawLaunchPad(ctx, 'town');
    // 标题屏上预置一颗待发烟花弹 + 一圈迷你烟花
    drawRocket(ctx, WORLD.WIDTH / 2, 470, false, true, clock);
    const fw = { x: WORLD.WIDTH / 2, y: 360, ttl: 0.4, max: 1, seed: 0.3 };
    ctx.save();
    const k = 0.7;
    const r = 30 + k * 70;
    ctx.strokeStyle = 'rgba(255,210,130,0.85)';
    for (let i = 0; i < 12; i += 1) {
      const ang = (i / 12) * Math.PI * 2 + 0.3;
      ctx.fillStyle = 'rgba(255,240,180,0.9)';
      ctx.beginPath();
      ctx.arc(fw.x + Math.cos(ang) * r, fw.y + Math.sin(ang) * r, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw(state, dt, view) {
    if (!state || !state.layers) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;
    const sceneKey = state.scene || v.sceneKey || 'town';

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);
    drawLaunchPad(ctx, sceneKey);

    // 云层障碍
    const { segW, cols, layers, layerIndex } = state;
    const shift = state.cloudShift || 0;
    const visibleN = Math.ceil(BOUNCE_H / LAYOUT.LAYER_SPACING) + 2;
    for (let j = layerIndex; j < layerIndex + visibleN; j += 1) {
      if (j >= layers.length) break;
      const y = LAYOUT.CEIL_Y - (j - layerIndex) * LAYOUT.LAYER_SPACING;
      if (y + LAYOUT.BAR_H < 0) break;
      const layer = layers[j];
      for (let c = 0; c < cols; c += 1) {
        const seg = layer[c];
        const x = c * segW + shift;
        if (seg === 'cloud') drawCloud(ctx, x + 3, y + 3, segW - 6, LAYOUT.BAR_H - 6, j === layerIndex);
        else if (seg === 'steel') drawSteel(ctx, x + 2, y + 2, segW - 4, LAYOUT.BAR_H - 4);
      }
      // 当前层（判定线）高亮边框
      if (j === layerIndex) {
        ctx.strokeStyle = 'rgba(255,220,130,0.5)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(2, y, WORLD.WIDTH - 4, LAYOUT.BAR_H);
      }
    }

    // 火箭
    const ry = rocketY(state);
    const rising = state.bounceT < 0.5;
    drawRocket(ctx, state.x, ry, state.incandescent, rising, clock);

    drawFx(ctx, v);

    ctx.restore();
  }

  return { draw, debugLayout, resize };
}
