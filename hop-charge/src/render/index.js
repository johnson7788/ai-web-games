// HOP CHARGE · Canvas 2D 渲染：三场景包 / 屋顶平台 / 提灯小狸猫 / 灯焰 / 蓄力条 / 粒子。
// 只消费 run.state + view（sceneKey/fxQueue/shake/clock）。
// 像素换算全部在此完成（sim 只给世界 x 与归一化进度 jumpT）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const GROUND = LAYOUT.GROUND_Y;

// ---- 三场景色板（换章必换：色板/构图/装饰互异）----
const SCENES = {
  'dusk-town': {
    skyTop: '#2E2450', skyMid: '#5A3A6E', skyBot: '#C77B4E',
    far: '#4A3560', near: '#33274A',
    roof: '#5C4636', roofEdge: '#8A6A4A', tileLine: '#4A382A',
    accent: '#FFC24E', ground: '#2A1E3C',
  },
  'rainy-street': {
    skyTop: '#0C1830', skyMid: '#12304A', skyBot: '#1D3A52',
    far: '#10283A', near: '#0A1C2C',
    roof: '#2A3A4A', roofEdge: '#3E5668', tileLine: '#20303E',
    accent: '#FF7A5C', ground: '#081420',
  },
  'misty-peak': {
    skyTop: '#C6D6CE', skyMid: '#DDE9E3', skyBot: '#EDF4F0',
    far: '#9FB8B0', near: '#8AA69C',
    roof: '#5A6E66', roofEdge: '#748A80', tileLine: '#46584F',
    accent: '#E9B949', ground: '#6E847A',
  },
};

function sceneOf(key) { return SCENES[key] || SCENES['dusk-town']; }

// ---- 粒子 / 缓动工具 ----
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function platformX(p, t) {
  if (p && p.type === 'moving' && p.motion) {
    return p.x + p.motion.amp * Math.sin(p.motion.speed * t + p.motion.phase);
  }
  return p ? p.x : 0;
}

// ---- 静态背景离屏缓存 ----
const bgCache = new Map();
function getBackground(sceneKey, clock) {
  const key = sceneKey + (sceneKey === 'rainy-street' || sceneKey === 'misty-peak' ? Math.floor(clock * 12) % 6 : '');
  let c = bgCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  drawBackground(c.getContext('2d'), sceneKey, clock);
  bgCache.set(key, c);
  return c;
}

function drawBackground(g, sceneKey, clock) {
  const P = sceneOf(sceneKey);
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'dusk-town') drawSunMoon(g, P, clock);
  else if (sceneKey === 'rainy-street') drawMoon(g, P, clock);
  else drawMistSun(g, P, clock);

  // 远景剪影（三场景构图互异）
  if (sceneKey === 'dusk-town') drawTownSkyline(g, P);
  else if (sceneKey === 'rainy-street') drawRainSkyline(g, P);
  else drawMountainSkyline(g, P);

  // 地面
  const grd = g.createLinearGradient(0, GROUND, 0, H);
  grd.addColorStop(0, P.ground);
  grd.addColorStop(1, P.skyTop);
  g.fillStyle = grd;
  g.fillRect(0, GROUND, W, H - GROUND);

  if (sceneKey === 'rainy-street') drawRain(g, clock);
  if (sceneKey === 'misty-peak') drawFogBands(g, P, clock);
}

function drawSunMoon(g, P, clock) {
  const gx = W - 200, gy = 150, r = 46;
  const halo = g.createRadialGradient(gx, gy, r * 0.4, gx, gy, r * 3);
  halo.addColorStop(0, 'rgba(255,190,120,0.65)');
  halo.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#FFC98A';
  g.beginPath(); g.arc(gx, gy, r, 0, Math.PI * 2); g.fill();
}

function drawMoon(g, P, clock) {
  const gx = W - 230, gy = 150, r = 40;
  const halo = g.createRadialGradient(gx, gy, r * 0.5, gx, gy, r * 1.9);
  halo.addColorStop(0, 'rgba(210,235,255,0.4)');
  halo.addColorStop(1, 'rgba(210,235,255,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(gx, gy, r * 1.9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#E8F2FF';
  g.beginPath(); g.arc(gx, gy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(160,190,220,0.5)';
  g.beginPath(); g.arc(gx - 12, gy - 6, r * 0.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(gx + 9, gy + 11, r * 0.15, 0, Math.PI * 2); g.fill();
}

function drawMistSun(g, P, clock) {
  const gx = 220, gy = 150, r = 52;
  const halo = g.createRadialGradient(gx, gy, r * 0.4, gx, gy, r * 3);
  halo.addColorStop(0, 'rgba(255,240,200,0.7)');
  halo.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#FFF4DC';
  g.beginPath(); g.arc(gx, gy, r, 0, Math.PI * 2); g.fill();
}

function drawTownSkyline(g, P) {
  g.fillStyle = P.far;
  for (let i = 0; i < 9; i += 1) {
    const x = i * 150 - 20;
    const hgt = 120 + ((i * 53) % 90);
    g.beginPath();
    g.moveTo(x, GROUND); g.lineTo(x, GROUND - hgt); g.lineTo(x + 130, GROUND - hgt + 30); g.lineTo(x + 130, GROUND);
    g.closePath(); g.fill();
  }
}

function drawRainSkyline(g, P) {
  g.fillStyle = P.far;
  for (let i = 0; i < 10; i += 1) {
    const x = i * 140 - 10;
    const hgt = 90 + ((i * 37) % 70);
    g.fillRect(x, GROUND - hgt, 110, hgt);
    // 屋顶斜边
    g.beginPath(); g.moveTo(x - 6, GROUND - hgt); g.lineTo(x + 55, GROUND - hgt - 34); g.lineTo(x + 116, GROUND - hgt); g.closePath(); g.fill();
  }
}

function drawMountainSkyline(g, P) {
  g.fillStyle = P.far;
  g.beginPath();
  g.moveTo(0, GROUND);
  for (let i = 0; i <= 8; i += 1) {
    const x = (W / 8) * i;
    g.lineTo(x, GROUND - 150 - Math.sin(i * 1.9) * 70);
  }
  g.lineTo(W, GROUND); g.closePath(); g.fill();
  g.fillStyle = P.near;
  g.beginPath();
  g.moveTo(0, GROUND);
  for (let i = 0; i <= 9; i += 1) {
    const x = (W / 9) * i;
    g.lineTo(x, GROUND - 80 - Math.cos(i * 2.3) * 40);
  }
  g.lineTo(W, GROUND); g.closePath(); g.fill();
}

function drawRain(g, clock) {
  g.strokeStyle = 'rgba(180,215,255,0.22)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 60; i += 1) {
    const seed = i * 137;
    const x = (seed % W);
    const y = ((seed * 7 + clock * 900) % (H * 1.4)) - 100;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 8, y + 18);
    g.stroke();
  }
}

function drawFogBands(g, P, clock) {
  for (let i = 0; i < 4; i += 1) {
    const y = GROUND - 40 - i * 60 + Math.sin(clock * 0.6 + i) * 8;
    g.fillStyle = `rgba(240,246,243,${0.16 + i * 0.03})`;
    g.beginPath();
    g.ellipse(W / 2 + Math.sin(clock * 0.4 + i * 2) * 60, y, W * 0.75, 46, 0, 0, Math.PI * 2);
    g.fill();
  }
}

// ---- 屋顶平台 ----
function roofTopY() { return GROUND; }

function drawPlatform(ctx, p, sx, sceneKey, clock, isTarget) {
  const P = sceneOf(sceneKey);
  const w = p.w;
  const topY = roofTopY();
  const bodyH = 46 + ((p.x % 100) + 100) % 26;
  const x0 = sx - w / 2;

  // 屋身
  const body = ctx.createLinearGradient(x0, topY, x0, topY + bodyH);
  body.addColorStop(0, P.roofEdge);
  body.addColorStop(1, P.roof);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x0 - 8, topY + bodyH);
  ctx.lineTo(x0, topY);
  ctx.lineTo(x0 + w, topY);
  ctx.lineTo(x0 + w + 8, topY + bodyH);
  ctx.closePath();
  ctx.fill();
  // 顶面亮边
  ctx.strokeStyle = P.roofEdge;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x0, topY); ctx.lineTo(x0 + w, topY); ctx.stroke();
  // 瓦纹
  ctx.strokeStyle = P.tileLine;
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 5; i += 1) {
    const tx = x0 + (w / 5) * i;
    ctx.beginPath(); ctx.moveTo(tx, topY + 2); ctx.lineTo(tx - 6, topY + bodyH); ctx.stroke();
  }

  // 类型标记
  if (p.type === 'spring') drawSpring(ctx, sx, topY);
  else if (p.type === 'ice') drawIce(ctx, sx, topY, w, clock);
  else if (p.type === 'moving') drawMoveArrows(ctx, sx, topY, clock);
  else if (p.type === 'narrow') drawCrack(ctx, sx, topY, w);

  // 目标信标（仅当前目标台显示：大号脉冲光环 + 实心靶心 + 向下箭头）
  if (isTarget) {
    const cx = sx, cy = topY - 2;
    const pulse = 0.5 + 0.5 * Math.sin(clock * 4);
    const haloR = 26 + pulse * 9;
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, haloR * 2.2);
    glow.addColorStop(0, `rgba(255,220,120,${0.5 + 0.3 * pulse})`);
    glow.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, haloR * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFD24E';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, haloR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,240,180,${0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, haloR * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#FFF3C4';
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    const ay = cy - haloR - 20 + Math.sin(clock * 5) * 4;
    ctx.fillStyle = '#FFD24E';
    ctx.beginPath();
    ctx.moveTo(cx, ay + 14);
    ctx.lineTo(cx - 12, ay - 4);
    ctx.lineTo(cx + 12, ay - 4);
    ctx.closePath();
    ctx.fill();
    // 「NEXT」标签：让目标语义明确
    ctx.fillStyle = 'rgba(16,10,26,0.85)';
    ctx.fillRect(cx - 30, ay - 34, 60, 20);
    ctx.strokeStyle = 'rgba(255,210,78,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 30, ay - 34, 60, 20);
    ctx.fillStyle = '#FFD24E';
    ctx.font = '800 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEXT', cx, ay - 24);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }
}

function drawSpring(ctx, sx, topY) {
  ctx.strokeStyle = '#B9C0C6';
  ctx.lineWidth = 5;
  ctx.beginPath();
  const k = 4;
  ctx.moveTo(sx - 22, topY - 2);
  for (let i = 0; i < k; i += 1) {
    ctx.lineTo(sx - 22 + (i + 0.5) * (44 / k), topY - 2 - ((i % 2) ? 16 : 2));
  }
  ctx.stroke();
}

function drawIce(ctx, sx, topY, w, clock) {
  const spark = Math.sin(clock * 3 + sx) * 0.4 + 0.6;
  ctx.fillStyle = `rgba(200,240,255,${0.28 + spark * 0.18})`;
  ctx.beginPath();
  ctx.moveTo(sx - w / 2, topY);
  ctx.lineTo(sx + w / 2, topY);
  ctx.lineTo(sx + w / 2 - 6, topY + 14);
  ctx.lineTo(sx - w / 2 + 6, topY + 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 3; i += 1) {
    const sx2 = sx - w / 3 + i * (w / 3);
    ctx.beginPath(); ctx.arc(sx2, topY + 5, 2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawMoveArrows(ctx, sx, topY, clock) {
  const bob = Math.sin(clock * 3) * 4;
  const y = topY - 12 + bob;
  ctx.strokeStyle = 'rgba(220,235,255,0.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx - 30, y); ctx.lineTo(sx + 30, y);
  ctx.moveTo(sx - 30, y); ctx.lineTo(sx - 22, y - 6); ctx.moveTo(sx - 30, y); ctx.lineTo(sx - 22, y + 6);
  ctx.moveTo(sx + 30, y); ctx.lineTo(sx + 22, y - 6); ctx.moveTo(sx + 30, y); ctx.lineTo(sx + 22, y + 6);
  ctx.stroke();
}

function drawCrack(ctx, sx, topY, w) {
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx - w / 2, topY + 1); ctx.lineTo(sx, topY + 8); ctx.lineTo(sx + w / 2, topY + 2);
  ctx.stroke();
}

// ---- 提灯小狸猫 ----
function drawHero(ctx, x, y, opts = {}) {
  const { squash = 0, flame = 0.5, combo = 0, facing = 1, clock = 0, pose = 'idle' } = opts;
  const sx = clamp(1 - 0.28 * squash, 0.6, 1);
  const sy = clamp(1 + 0.34 * squash, 1, 1.34);
  const breathe = pose === 'idle' ? Math.sin(clock * 3) * 2 : 0;
  const cheer = pose === 'cheer' ? -Math.abs(Math.sin(clock * 8)) * 6 : 0;

  ctx.save();
  ctx.translate(x, y + breathe + cheer);
  ctx.scale(facing * sx, sy);

  // 尾巴（连击时着火拖尾）
  const tailFire = combo >= 2;
  ctx.save();
  ctx.translate(-24, -20);
  ctx.rotate(-0.7);
  ctx.fillStyle = tailFire ? '#E8612E' : '#D98E4A';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-20, -6, -32, -2);
  ctx.quadraticCurveTo(-26, 8, -14, 10);
  ctx.closePath();
  ctx.fill();
  if (tailFire) {
    const fl = 6 + Math.min(10, combo * 3) + Math.sin(clock * 14) * 2;
    ctx.fillStyle = '#FFC24E';
    ctx.beginPath();
    ctx.ellipse(-32, 2, fl * 0.5, fl, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF3D6';
    ctx.beginPath();
    ctx.ellipse(-32, 4, fl * 0.26, fl * 0.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 身体
  ctx.fillStyle = '#E8A25C';
  ctx.beginPath();
  ctx.ellipse(0, -8, 24, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  // 肚皮
  ctx.fillStyle = '#F7E2C4';
  ctx.beginPath();
  ctx.ellipse(2, -4, 13, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // 头
  ctx.fillStyle = '#E8A25C';
  ctx.beginPath();
  ctx.arc(2, -34, 19, 0, Math.PI * 2);
  ctx.fill();
  // 耳朵
  ctx.fillStyle = '#C97A3A';
  ctx.beginPath(); ctx.moveTo(-8, -48); ctx.lineTo(-16, -66); ctx.lineTo(2, -54); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(12, -48); ctx.lineTo(20, -66); ctx.lineTo(6, -54); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#F0B078';
  ctx.beginPath(); ctx.moveTo(-6, -49); ctx.lineTo(-12, -60); ctx.lineTo(-1, -53); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10, -49); ctx.lineTo(15, -60); ctx.lineTo(5, -53); ctx.closePath(); ctx.fill();
  // 脸
  ctx.fillStyle = '#F7E2C4';
  ctx.beginPath(); ctx.ellipse(2, -30, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
  // 眼睛
  ctx.fillStyle = '#2A1A0C';
  ctx.beginPath(); ctx.arc(-5, -36, 2.6, 0, Math.PI * 2); ctx.arc(9, -36, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-4, -37, 1, 0, Math.PI * 2); ctx.arc(10, -37, 1, 0, Math.PI * 2); ctx.fill();
  // 鼻子
  ctx.fillStyle = '#2A1A0C';
  ctx.beginPath(); ctx.arc(2, -30, 1.8, 0, Math.PI * 2); ctx.fill();

  // 提灯（举在前方）
  const poleX = 22;
  ctx.strokeStyle = '#6E4A2A';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(8, -18); ctx.lineTo(poleX, -44); ctx.stroke();
  const lx = poleX, ly = -46;
  // 灯体
  ctx.fillStyle = '#FFE4A0';
  ctx.beginPath();
  ctx.ellipse(lx, ly, 9, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#C97A3A';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 火焰（随蓄力涨大）
  const fr = 3 + flame * 6;
  const glow = ctx.createRadialGradient(lx, ly, 1, lx, ly, fr * 3);
  glow.addColorStop(0, 'rgba(255,240,180,0.9)');
  glow.addColorStop(0.4, 'rgba(255,180,80,0.5)');
  glow.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(lx, ly, fr * 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FF9A3C';
  ctx.beginPath();
  ctx.ellipse(lx, ly, fr * 0.5, fr, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFF3D6';
  ctx.beginPath();
  ctx.ellipse(lx, ly, fr * 0.24, fr * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---- 粒子特效 ----
function drawFx(ctx, fx, camX, clock) {
  const sx = fx.x - camX + W / 2;
  const sy = fx.y;
  if (fx.type === 'halo') {
    const k = 1 - fx.ttl / fx.maxTtl;
    const r = 14 + k * 90;
    ctx.strokeStyle = `rgba(255,220,120,${(1 - k) * 0.9})`;
    ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, r);
    glow.addColorStop(0, `rgba(255,240,180,${(1 - k) * 0.6})`);
    glow.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  } else if (fx.type === 'dust') {
    const k = 1 - fx.ttl / fx.maxTtl;
    ctx.fillStyle = `rgba(255,255,255,${(1 - k) * 0.5})`;
    for (let i = 0; i < 4; i += 1) {
      const a = i * 1.7 + fx.seed;
      const rr = 4 + k * 22;
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.5, 3 * (1 - k) + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- 布局（契约：render 从 config 计算）----
function computeLayout(state, camX) {
  const next = state.platforms[state.player.platformIndex + 1];
  const nextX = next ? platformX(next, 0) : state.player.x;
  const nextSx = nextX - camX + W / 2;
  return {
    chargeBar: { x: W / 2 - LAYOUT.CHARGE_BAR_W / 2, y: LAYOUT.CHARGE_BAR_Y, w: LAYOUT.CHARGE_BAR_W, h: LAYOUT.CHARGE_BAR_H },
    nextPlatform: { x: nextSx - (next ? next.w / 2 : 0), y: GROUND - 46, w: next ? next.w : 0, h: 60 },
    hud: { x: 0, y: 0, w: W, h: LAYOUT.HUD_H },
  };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  let clock = 0;
  let camX = 0;
  let lastState = null;
  let lastCamX = 0;

  function resize(w, h) {
    return { w, h, world: { width: W, height: H } };
  }

  function cameraTarget(state) {
    if (!state || !state.platforms || !state.platforms.length) return 0;
    const p = state.player;
    const next = state.platforms[p.platformIndex + 1];
    const nextCx = next ? platformX(next, clock) : p.x;
    return (p.x + nextCx) / 2;
  }

  function heroWorldPos(state) {
    const p = state.player;
    if (state.phase === 'jumping' && state.pending) {
      const t = clamp(state.pending.jumpT, 0, 1);
      const x = lerp(state.pending.fromX, state.pending.landX, t);
      const arc = Math.sin(Math.PI * t) * 150;
      return { x, y: GROUND - arc };
    }
    return { x: p.x, y: GROUND };
  }

  function debugLayout() {
    if (!lastState) return null;
    return computeLayout(lastState, lastCamX);
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(getBackground('dusk-town', clock), 0, 0);
    drawHero(ctx, W / 2, GROUND, { flame: 0.8, clock, pose: 'idle' });
  }

  function draw(state, dt, view) {
    clock += dt || 0;
    const v = view || {};
    const sceneKey = v.sceneKey || 'dusk-town';
    if (!state || !state.platforms) { drawTitleScene(); return; }
    lastState = state;

    // 相机平滑跟随
    const target = cameraTarget(state);
    const maxX = Math.max(0, state.platforms[state.platforms.length - 1].x - W / 2 + 200);
    camX = clamp(lerp(camX, target, Math.min(1, (dt || 0) * 5)), 0, maxX);
    lastCamX = camX;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey, clock), 0, 0);

    // 平台
    const targetIndex = state.player.platformIndex + 1;
    for (let i = 0; i < state.platforms.length; i += 1) {
      const p = state.platforms[i];
      const sx = platformX(p, clock) - camX + W / 2;
      if (sx < -200 || sx > W + 200) continue;
      drawPlatform(ctx, p, sx, sceneKey, clock, i === targetIndex);
    }

    // 粒子
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.ttl > 0) drawFx(ctx, fx, camX, clock);
      }
    }

    // 角色
    if (state.phase !== 'lost') {
      const hp = heroWorldPos(state);
      const squash = state.phase === 'charging' ? state.player.squash : 0;
      const flame = state.phase === 'charging' ? state.player.squash : (state.phase === 'ready' ? 0.45 : 0.6);
      const combo = state.combo;
      const pose = state.phase === 'won' ? 'cheer' : 'idle';
      drawHero(ctx, hp.x - camX + W / 2, hp.y, {
        squash, flame, combo, facing: 1, clock, pose,
      });
    }

    // 蓄力条
    if (state.phase === 'charging' || state.phase === 'ready') {
      drawChargeBar(ctx, state.phase === 'charging' ? state.player.squash : 0, state.phase === 'charging');
    }

    ctx.restore();
  }

  function drawChargeBar(ctx, squash, active) {
    const b = LAYOUT.CHARGE_BAR_W, h = LAYOUT.CHARGE_BAR_H;
    const x = W / 2 - b / 2, y = LAYOUT.CHARGE_BAR_Y;
    ctx.fillStyle = 'rgba(20,14,28,0.72)';
    roundRect(ctx, x - 6, y - 6, b + 12, h + 12, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - 6, y - 6, b + 12, h + 12, 10);
    ctx.stroke();
    const fill = clamp(squash, 0, 1);
    if (fill > 0) {
      const grad = ctx.createLinearGradient(x, y, x + b, y);
      grad.addColorStop(0, '#FFC24E');
      grad.addColorStop(1, '#FF7A3C');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, b * fill, h, 6);
      ctx.fill();
    }
    // 中心刻度
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const midX = x + b * 0.5;
    ctx.fillRect(midX - 1, y - 2, 2, h + 4);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 调试入口：--eval 驱动三场景截图
  function __renderDemo(sceneKey) {
    const key = SCENES[sceneKey] ? sceneKey : 'dusk-town';
    camX = 0;
    drawTitleSceneFor(key);
  }

  function drawTitleSceneFor(key) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(getBackground(key, clock), 0, 0);
    drawHero(ctx, W / 2, GROUND, { flame: 0.8, clock, pose: 'idle' });
  }

  // 图标渲染：256×256 独立画布，只画提灯小狸猫大头贴
  function __renderIcon(size = 256) {
    canvas.width = size;
    canvas.height = size;
    const bg = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size * 0.72);
    bg.addColorStop(0, '#4A3568');
    bg.addColorStop(1, '#160F28');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    const s = 2.15;
    ctx.save();
    ctx.translate(size / 2 - 2 * s, size * 0.7);
    ctx.scale(s, s);
    drawHero(ctx, 0, 0, { flame: 1.0, clock: 0, pose: 'idle', facing: 1 });
    ctx.restore();
    return true;
  }

  if (typeof window !== 'undefined') {
    window.__renderDemo = __renderDemo;
    window.__drawTitle = () => drawTitleScene();
    window.__renderIcon = __renderIcon;
  }

  return { draw, debugLayout, resize, __renderDemo, __renderIcon };
}
