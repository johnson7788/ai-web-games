// SKY KOI · Canvas 2D 渲染：三场景包（晨曦云海/落樱湖面/夜空星河）+ 锦鲤 + 鸟居门柱 + 珍珠 + 水面。
// 只消费 run.state（契约 docs/README.md）+ view（sceneKey/shake/fxQueue）。
// 像素换算全部在此完成；sim 只给逻辑坐标。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize() }。
import { WORLD, GAME } from '../../config/game.config.js';
import { gateGeometry, GATE_W, PEARL_R } from '../game/sim.js';

const SCENE_PALETTES = {
  dawn: {
    skyTop: '#FFE7C4', skyMid: '#FFD9A0', skyBot: '#F2C078',
    cloud: 'rgba(255,255,255,0.85)', cloudShade: 'rgba(255,214,178,0.6)',
    water: '#6FB8D4', waterDeep: '#3E8CB0', waterFoam: 'rgba(255,255,255,0.5)',
    gate: '#E63B2B', gateDark: '#A82818', gateTop: '#2A1A10',
    sun: '#FFF2C8',
  },
  sakura: {
    skyTop: '#FFE0EC', skyMid: '#FFC4D6', skyBot: '#E8A6C0',
    cloud: 'rgba(255,255,255,0.7)', cloudShade: 'rgba(255,196,214,0.5)',
    water: '#A8CCE0', waterDeep: '#6E9DBE', waterFoam: 'rgba(255,255,255,0.55)',
    gate: '#E6442F', gateDark: '#A82818', gateTop: '#2A1A10',
    sun: '#FFF0F4', petal: '#F7A8C4',
  },
  night: {
    skyTop: '#111A44', skyMid: '#1B2A5C', skyBot: '#243168',
    cloud: 'rgba(130,150,230,0.2)', cloudShade: 'rgba(100,120,200,0.16)',
    water: '#20426A', waterDeep: '#102848', waterFoam: 'rgba(160,200,255,0.4)',
    gate: '#E8482E', gateDark: '#9E2410', gateTop: '#160C08',
    sun: '#EAF2FF', petal: '#BFC9FF',
  },
};

const bgCache = new Map();

function seededRand(a, b, c) {
  const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return x - Math.floor(x);
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
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.dawn;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'night') { drawStars(g); }
  else if (sceneKey === 'sakura') { drawSakuraGlow(g, P); drawPetalField(g, P); }
  else { drawDawnSun(g, P); drawClouds(g, P); }

  // 远景云海 / 山峦剪影
  drawCloudSea(g, P, sceneKey);

  // 水面底（动态部分每帧重画，这里只铺底）
  const wy = GAME.WATER_BASE;
  const wg = g.createLinearGradient(0, wy, 0, H);
  wg.addColorStop(0, P.water);
  wg.addColorStop(1, P.waterDeep);
  g.fillStyle = wg;
  g.fillRect(0, wy, W, H - wy);
}

function drawStars(g) {
  for (let i = 0; i < 46; i += 1) {
    const x = seededRand(i, 1, 3) * WORLD.WIDTH;
    const y = seededRand(i, 2, 5) * WORLD.HEIGHT * 0.5;
    const r = 0.7 + seededRand(i, 3, 7) * 1.4;
    g.fillStyle = `rgba(220,235,255,${0.28 + seededRand(i, 4, 9) * 0.4})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

function drawDawnSun(g, P) {
  const gx = 180, gy = 150;
  const halo = g.createRadialGradient(gx, gy, 20, gx, gy, 300);
  halo.addColorStop(0, 'rgba(255,242,200,0.9)');
  halo.addColorStop(1, 'rgba(255,242,200,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  g.fillStyle = P.sun;
  g.beginPath(); g.arc(gx, gy, 46, 0, Math.PI * 2); g.fill();
}

function drawSakuraGlow(g, P) {
  const gx = WORLD.WIDTH - 220, gy = 200;
  const halo = g.createRadialGradient(gx, gy, 20, gx, gy, 320);
  halo.addColorStop(0, 'rgba(255,240,244,0.8)');
  halo.addColorStop(1, 'rgba(255,240,244,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
}

function drawClouds(g, P) {
  for (let i = 0; i < 7; i += 1) {
    const cx = seededRand(i, 11, 23) * WORLD.WIDTH;
    const cy = 60 + seededRand(i, 13, 29) * 240;
    const s = 0.7 + seededRand(i, 17, 31) * 1.1;
    g.fillStyle = P.cloud;
    g.beginPath();
    g.arc(cx, cy, 34 * s, 0, Math.PI * 2);
    g.arc(cx + 30 * s, cy - 12 * s, 26 * s, 0, Math.PI * 2);
    g.arc(cx + 62 * s, cy, 30 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.cloudShade;
    g.beginPath(); g.ellipse(cx + 30 * s, cy + 16 * s, 50 * s, 12 * s, 0, 0, Math.PI * 2); g.fill();
  }
}

function drawPetalField(g, P) {
  for (let i = 0; i < 26; i += 1) {
    const x = seededRand(i, 41, 53) * WORLD.WIDTH;
    const y = seededRand(i, 43, 59) * 360;
    g.save(); g.translate(x, y); g.rotate(seededRand(i, 47, 61) * Math.PI);
    g.fillStyle = P.petal;
    g.beginPath(); g.ellipse(0, 0, 5, 2.6, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}

function drawCloudSea(g, P, sceneKey) {
  const base = GAME.WATER_BASE;
  g.fillStyle = sceneKey === 'night' ? 'rgba(30,40,80,0.55)' : 'rgba(255,255,255,0.28)';
  g.beginPath();
  g.moveTo(0, base);
  for (let x = 0; x <= WORLD.WIDTH; x += 40) {
    const y = base - 70 - Math.sin(x * 0.012 + 1.3) * 34 - seededRand(x | 0, 1, 5) * 18;
    g.lineTo(x, y);
  }
  g.lineTo(WORLD.WIDTH, base);
  g.closePath();
  g.fill();
}

// ---- 锦鲤（程序化，面向右）----
function drawKoi(ctx, koi, clock, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.dawn;
  const s = (koi.r / 24) * 1.35;
  const bob = Math.sin(clock * 2.6) * (koi.vy < 0 ? 2 : 1);
  ctx.save();
  ctx.translate(koi.x, koi.y + bob);
  // 深色软投影：把鱼从背景里「抬」出来（剪影可读性）
  ctx.fillStyle = 'rgba(30,10,0,0.22)';
  ctx.beginPath(); ctx.ellipse(3, 6, 34, 24, 0, 0, Math.PI * 2); ctx.fill();
  // 柔和轮廓光
  const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 40);
  glow.addColorStop(0, 'rgba(255,255,255,0.32)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
  ctx.scale(s, s);

  const shimmer = koi.shimmer ? 0.8 : 0.15;

  // 尾鳍（左）
  ctx.fillStyle = 'rgba(255,120,60,0.9)';
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.quadraticCurveTo(-40, -12 + Math.sin(clock * 4) * 5, -46, -6 + Math.sin(clock * 4) * 6);
  ctx.quadraticCurveTo(-40, 0, -46, 8 + Math.sin(clock * 4) * 5);
  ctx.quadraticCurveTo(-40, 4, -20, 4);
  ctx.closePath(); ctx.fill();

  // 身体（橙→白渐变）
  const body = ctx.createLinearGradient(0, -20, 0, 20);
  body.addColorStop(0, '#FF8A4A');
  body.addColorStop(0.6, '#FF6B35');
  body.addColorStop(1, '#FFF3E6');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2); ctx.fill();

  // 头部（右）
  ctx.fillStyle = '#FF7A40';
  ctx.beginPath(); ctx.arc(18, -1, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFF3E6';
  ctx.beginPath(); ctx.ellipse(18, 6, 10, 7, 0, 0, Math.PI * 2); ctx.fill();

  // 眼
  ctx.fillStyle = '#1A1208';
  ctx.beginPath(); ctx.arc(23, -4, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(24, -5, 1.2, 0, Math.PI * 2); ctx.fill();

  // 背鳍 + 胸鳍 + 腹鳍
  ctx.fillStyle = 'rgba(255,110,50,0.9)';
  ctx.beginPath(); ctx.moveTo(-6, -14); ctx.quadraticCurveTo(4, -22, 12, -14); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, 8, 8, 4, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(2, 12, 6, 3, -0.4, 0, Math.PI * 2); ctx.fill();

  // 鳞片光斑
  ctx.fillStyle = `rgba(255,255,255,${0.25 + shimmer})`;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath(); ctx.arc(-12 + i * 9, -4 + (i % 2) * 5, 3, 0, Math.PI * 2); ctx.fill();
  }

  // 逆鳞闪光（鳞光冲刺）
  if (koi.shimmer > 0) {
    ctx.fillStyle = `rgba(255,255,255,${koi.shimmer})`;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,180,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 28 + (1 - koi.shimmer) * 12, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.restore();
}

// ---- 鸟居门柱 ----
function drawGate(ctx, gate, clock, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.dawn;
  const geo = gateGeometry(gate, clock);
  const x = gate.x;
  const w = GATE_W;
  const TOP = 46;          // 顶部留 HUD 区，避免门柱压 HUD 造成遮挡
  const bottomY = WORLD.HEIGHT;
  const mainTop = Math.min(...geo.gaps.map((g) => g.top));

  for (const gap of geo.gaps) {
    // 上柱（从 HUD 下沿到门缝上缘）
    if (gap.top > TOP) {
      ctx.fillStyle = P.gate;
      ctx.fillRect(x - w / 2, TOP, w, gap.top - TOP);
    }
    // 下柱
    ctx.fillStyle = P.gate;
    ctx.fillRect(x - w / 2, gap.bottom, w, bottomY - gap.bottom);
    // 柱内阴影
    ctx.fillStyle = P.gateDark;
    ctx.fillRect(x - w / 2, gap.top - 6, w, 6);
    ctx.fillRect(x - w / 2, gap.bottom, w, 6);
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    ctx.fillRect(x - w / 2 + 6, TOP, 5, Math.max(0, gap.top - TOP));
    ctx.fillRect(x - w / 2 + 6, gap.bottom, 5, bottomY - gap.bottom);
    // 门缝内缘亮线（框出「从这里穿」的开口）
    ctx.fillStyle = 'rgba(255,250,230,0.9)';
    ctx.fillRect(x - w / 2 + 2, gap.top - 2, w - 4, 3);
    ctx.fillRect(x - w / 2 + 2, gap.bottom - 1, w - 4, 3);
  }

  // 顶部笠木（横梁）
  const beamY = Math.max(TOP, mainTop - 22);
  ctx.fillStyle = P.gateTop;
  ctx.fillRect(x - w / 2 - 10, beamY - 6, w + 20, 14);
  ctx.fillStyle = P.gate;
  ctx.fillRect(x - w / 2 - 6, beamY, w + 12, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x - w / 2 - 6, beamY, w + 12, 4);

  // 门缝目标高亮：发光「传送门」环 + 中央菱形，明确穿过点
  for (const gap of geo.gaps) {
    const gy = (gap.top + gap.bottom) / 2;
    const gh = gap.bottom - gap.top;
    const glow = ctx.createLinearGradient(0, gap.top, 0, gap.bottom);
    glow.addColorStop(0, 'rgba(160,240,255,0)');
    glow.addColorStop(0.5, 'rgba(160,240,255,0.68)');
    glow.addColorStop(1, 'rgba(160,240,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - w / 2 + 2, gap.top, w - 4, gh);
    // 大「门」环（白亮描边，任何背景都醒目）
    const pulse = 1 + Math.sin(clock * 5 + x * 0.03) * 0.1;
    ctx.strokeStyle = 'rgba(255,255,255,0.98)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(x, gy, w * 0.95 * pulse, Math.min(gh * 0.46, 52) * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 中央大菱形（高对比 + 深描边）
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = 'rgba(90,20,0,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, gy - 20 * pulse);
    ctx.lineTo(x + 16 * pulse, gy);
    ctx.lineTo(x, gy + 20 * pulse);
    ctx.lineTo(x - 16 * pulse, gy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawPearl(ctx, x, y, clock) {
  const pulse = 1 + Math.sin(clock * 4 + x * 0.05) * 0.15;
  const halo = ctx.createRadialGradient(x, y, 1, x, y, PEARL_R * 2.2 * pulse);
  halo.addColorStop(0, 'rgba(255,255,255,0.95)');
  halo.addColorStop(0.4, 'rgba(255,235,245,0.7)');
  halo.addColorStop(1, 'rgba(255,235,245,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(x, y, PEARL_R * 2.2 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFF6FA';
  ctx.beginPath(); ctx.arc(x, y, PEARL_R * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,225,0.8)';
  ctx.beginPath(); ctx.arc(x - 2, y - 2, PEARL_R * 0.4, 0, Math.PI * 2); ctx.fill();
}

// ---- 动态水面 ----
function drawWater(ctx, waterY, clock, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.dawn;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const wg = ctx.createLinearGradient(0, waterY, 0, H);
  wg.addColorStop(0, P.water);
  wg.addColorStop(1, P.waterDeep);
  ctx.fillStyle = wg;
  ctx.fillRect(0, waterY, W, H - waterY);

  // 波光
  ctx.strokeStyle = P.waterFoam;
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    const y = waterY + 12 + i * 16;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 18) {
      const yy = y + Math.sin(x * 0.02 + clock * 1.6 + i * 1.3) * 3;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // 水面高光线
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 24) {
    const yy = waterY + Math.sin(x * 0.03 + clock * 1.2) * 2;
    if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.stroke();
}

// ---- 粒子 ----
function drawFx(ctx, fxQueue, clock) {
  for (const fx of fxQueue) {
    const a = Math.max(0, Math.min(1, fx.ttl / (fx.max || 0.4)));
    if (fx.type === 'splash') {
      ctx.fillStyle = `rgba(255,255,255,${a * 0.85})`;
      for (let i = 0; i < 5; i += 1) {
        const ang = -Math.PI / 2 + (i - 2) * 0.6;
        const d = (1 - a) * 26 + 4;
        ctx.beginPath();
        ctx.arc(fx.x + Math.cos(ang) * d, fx.y + Math.sin(ang) * d * 0.6, 3 * a + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (fx.type === 'sparkle') {
      ctx.fillStyle = `rgba(255,240,250,${a})`;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 5 * a + 1, 0, Math.PI * 2); ctx.fill();
    } else if (fx.type === 'ring') {
      ctx.strokeStyle = `rgba(255,240,180,${a * 0.8})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, (1 - a) * 44 + 6, 0, Math.PI * 2); ctx.stroke();
    } else if (fx.type === 'wind') {
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y);
      ctx.lineTo(fx.x - (1 - a) * 70, fx.y + Math.sin(a * 6) * 8);
      ctx.stroke();
    }
  }
}

// ---- 布局（调试/教程高亮用）----
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;

  function resize() {
    return { w: WORLD.WIDTH, h: WORLD.HEIGHT };
  }

  function nextGate(state) {
    for (const g of state.gates) {
      if (!g.passed && g.x + GATE_W / 2 > state.koi.x - state.koi.r) return g;
    }
    return state.gates[0] || null;
  }

  function nextPearl(state) {
    for (const g of state.gates) {
      const geo = gateGeometry(g, state.clock);
      for (const p of g.pearls) {
        if (!p.taken) return { x: g.x, y: geo.centers[p.gap] + p.rel };
      }
    }
    return null;
  }

  function debugLayout() {
    if (!lastState) return null;
    const s = lastState;
    const g = nextGate(s);
    const p = nextPearl(s);
    return {
      koi: { x: s.koi.x - 34, y: s.koi.y - 34, w: 68, h: 68 },
      gate: g ? { x: g.x - GATE_W / 2 - 6, y: Math.max(0, (gateGeometry(g, s.clock).gaps[0].top - 30)), w: GATE_W + 12, h: 260 } : null,
      pearl: p ? { x: p.x - 16, y: p.y - 16, w: 32, h: 32 } : null,
      water: { x: 0, y: s.waterY - 10, w: WORLD.WIDTH, h: 20 },
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: 44 },
    };
  }

  function draw(state, dt, view) {
    const v = view || {};
    const sceneKey = (state && state.sceneKey) || v.sceneKey || 'dawn';
    clock += dt || 0;
    if (state) lastState = state;

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    if (state && state.koi) {
      ctx.drawImage(getBackground(sceneKey), 0, 0);
      const waterY = state.waterY != null ? state.waterY : GAME.WATER_BASE;

      // 水面先画（门柱下段入水）
      drawWater(ctx, waterY, clock, sceneKey);

      // 门柱（按 x 升序 = 由远及近，先画远门）
      const gates = [...state.gates].sort((a, b) => b.x - a.x);
      for (const g of gates) drawGate(ctx, g, state.clock, sceneKey);

      // 珍珠
      for (const g of state.gates) {
        const geo = gateGeometry(g, state.clock);
        for (const p of g.pearls) {
          if (!p.taken) drawPearl(ctx, g.x, geo.centers[p.gap] + p.rel, clock);
        }
      }

      drawKoi(ctx, state.koi, clock, sceneKey);
      drawFx(ctx, v.fxQueue || [], clock);
    } else {
      // 标题屏背景
      ctx.drawImage(getBackground('dawn'), 0, 0);
      drawWater(ctx, GAME.WATER_BASE, clock, 'dawn');
      const demoKoi = { x: 360, y: 400, vy: 0, r: 40, shimmer: 0 };
      drawKoi(ctx, demoKoi, clock, 'dawn');
    }

    ctx.restore();
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => draw(null, 0, {});
  }

  return { draw, debugLayout, resize };
}
