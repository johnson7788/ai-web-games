// IDLE FORGE · Canvas 2D 渲染：三场景铁匠铺 / 铁砧 + 摆锤 / 装备立绘 / 大师之作进度条 / 火花。
// 只消费 run.state（契约）+ view（fxQueue/shake/cursor）。
// 像素换算全部在此完成（sim 只给归一化进度与数值）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { SCENES } from '../../config/levels.js';

// ---- 三场景色板（换章必换：乡村/城塞/火山 一眼可分）----
const SCENE_PALETTES = {
  village: {
    skyTop: '#BFE3D0', skyBot: '#8CC7A8', ground: '#6E8F4E',
    groundFar: '#5B7C41', wood: '#7A5A38', woodDark: '#5A4228',
    accent: '#E8C36A', glow: 'rgba(255,224,150,0.55)',
  },
  castle: {
    skyTop: '#8FB4D6', skyBot: '#5C7A99', ground: '#7A8088',
    groundFar: '#5C6268', wood: '#4A4A55', woodDark: '#33333C',
    accent: '#C9A24B', glow: 'rgba(180,200,255,0.45)',
  },
  volcano: {
    skyTop: '#3A1515', skyBot: '#1E0B0B', ground: '#3A2118',
    groundFar: '#2A1710', wood: '#5A3A28', woodDark: '#38241A',
    accent: '#FF7A33', glow: 'rgba(255,120,40,0.5)',
  },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

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
  const x = Math.sin(a * 12.9898 + b * 78.233 + s * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

function drawBackground(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.village;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H * 0.7);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // 地面
  g.fillStyle = P.groundFar;
  g.fillRect(0, H * 0.6, W, H * 0.1);
  g.fillStyle = P.ground;
  g.fillRect(0, H * 0.7, W, H * 0.3);
  const grd = g.createLinearGradient(0, H * 0.7, 0, H);
  grd.addColorStop(0, P.ground);
  grd.addColorStop(1, P.groundFar);
  g.fillStyle = grd;
  g.fillRect(0, H * 0.7, W, H * 0.3);

  if (sceneKey === 'village') {
    drawTrees(g, P);
    drawShed(g, P, 70, 520, 260, 180);
  } else if (sceneKey === 'castle') {
    drawBrickWall(g, P, W, H);
    drawBanners(g, P);
  } else {
    drawLava(g, P, W, H);
    drawEmbers(g, P, W, H);
  }
}

function drawTrees(g, P) {
  for (let i = 0; i < 6; i += 1) {
    const x = 120 + i * 220 + seededRand(i, 3, 7) * 60;
    const y = 480 + seededRand(i, 5, 11) * 40;
    g.fillStyle = P.woodDark;
    g.fillRect(x - 8, y - 40, 16, 80);
    g.fillStyle = i % 2 ? '#4E7A3A' : '#5E8A46';
    g.beginPath(); g.arc(x, y - 60, 42, 0, Math.PI * 2); g.fill();
  }
}

function drawShed(g, P, x, y, w, h) {
  g.fillStyle = P.woodDark;
  g.fillRect(x, y, w, h);
  g.fillStyle = P.wood;
  for (let i = 0; i < 4; i += 1) g.fillRect(x + 8, y + 8 + i * 44, w - 16, 6);
  g.fillStyle = '#3A2A18';
  g.beginPath();
  g.moveTo(x - 12, y); g.lineTo(x + w / 2, y - 60); g.lineTo(x + w + 12, y); g.closePath(); g.fill();
}

function drawBrickWall(g, P, W, H) {
  const y0 = H * 0.6;
  g.fillStyle = P.groundFar;
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 22; c += 1) {
      const x = (c * 62) - (r % 2 ? 31 : 0);
      const y = y0 + r * 26;
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 2;
      g.strokeRect(x, y, 60, 24);
    }
  }
}

function drawBanners(g, P) {
  for (let i = 0; i < 3; i += 1) {
    const x = 200 + i * 440;
    g.fillStyle = '#4A4A55';
    g.fillRect(x - 4, 100, 8, 320);
    g.fillStyle = i === 0 ? '#B33A3A' : i === 1 ? '#3A5FB3' : P.accent;
    g.beginPath();
    g.moveTo(x, 104); g.lineTo(x + 90, 130); g.lineTo(x, 156); g.closePath(); g.fill();
  }
}

function drawLava(g, P, W, H) {
  for (let i = 0; i < 6; i += 1) {
    const y = H * 0.72 + seededRand(i, 1, 9) * 40;
    g.fillStyle = i % 2 ? 'rgba(255,120,40,0.5)' : 'rgba(255,60,20,0.4)';
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 8);
    g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  }
}

function drawEmbers(g, P, W, H) {
  for (let i = 0; i < 40; i += 1) {
    const x = seededRand(i, 1, 13) * W;
    const y = H * 0.6 + seededRand(i, 2, 17) * H * 0.4;
    g.fillStyle = `rgba(255,${120 + i * 3},30,${0.3 + seededRand(i, 3, 19) * 0.5})`;
    g.beginPath(); g.arc(x, y, 1.6 + seededRand(i, 4, 21) * 2, 0, Math.PI * 2); g.fill();
  }
}

// ---- 铁砧 + 摆锤 ----
function drawAnvil(ctx, x, y, w, h, sceneKey, glow) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.village;
  // 底座
  ctx.fillStyle = P.woodDark;
  roundRect(ctx, x - w * 0.52, y + h * 0.32, w * 1.04, h * 0.4, 10); ctx.fill();
  // 铁砧主体
  const grad = ctx.createLinearGradient(x - w * 0.3, y - h * 0.3, x + w * 0.3, y + h * 0.3);
  grad.addColorStop(0, '#4A4A55');
  grad.addColorStop(1, '#23232C');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.16, y - h * 0.34);
  ctx.lineTo(x - w * 0.3, y - h * 0.06);
  ctx.lineTo(x - w * 0.26, y + h * 0.34);
  ctx.lineTo(x + w * 0.26, y + h * 0.34);
  ctx.lineTo(x + w * 0.3, y - h * 0.06);
  ctx.lineTo(x + w * 0.16, y - h * 0.34);
  ctx.closePath(); ctx.fill();
  // 顶面高光
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, x - w * 0.2, y - h * 0.34, w * 0.4, h * 0.16, 6); ctx.fill();
  if (glow > 0) {
    ctx.strokeStyle = `rgba(255,216,120,${0.35 + glow * 0.4})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, w * 0.5 + glow * 8, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawHammer(ctx, x, y, phase, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.village;
  // phase 0..1：0=举高，1=砸下
  const angle = -1.1 + phase * 1.7;
  ctx.save();
  ctx.translate(x, y - 30);
  ctx.rotate(angle);
  // 锤柄
  ctx.strokeStyle = P.wood;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -150); ctx.stroke();
  // 锤头
  ctx.translate(0, -158);
  ctx.fillStyle = '#3A3A44';
  roundRect(ctx, -52, -34, 104, 62, 10); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, -46, -28, 44, 22, 6); ctx.fill();
  ctx.restore();
}

// ---- 装备立绘（程序化，按品类/等级上色）----
const TIER_COLORS = [
  { metal: '#C9813A', dark: '#8A5522', glow: '#E8A84C' },   // 铜
  { metal: '#9AA2AD', dark: '#5C636C', glow: '#C7D0DA' },   // 铁
  { metal: '#B9D6E8', dark: '#6E90A8', glow: '#DFF2FF' },   // 秘银
  { metal: '#5E9E6E', dark: '#2E5A40', glow: '#A8E8A0' },   // 龙鳞
];

function itemTypeFromName(name) {
  const n = (name && name.en) || '';
  if (/Slayer|Sword/i.test(n)) return 'sword';
  if (/Helm/i.test(n)) return 'helm';
  if (/Armor/i.test(n)) return 'armor';
  return 'sword';
}

function drawItem(ctx, x, y, w, h, tier, type, clock) {
  const C = TIER_COLORS[tier] || TIER_COLORS[0];
  const bob = Math.sin(clock * 2.2) * 6;
  ctx.save();
  ctx.translate(x, y + bob);

  // 底座光环
  const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, w * 0.6);
  halo.addColorStop(0, C.glow + '88');
  halo.addColorStop(1, C.glow + '00');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, w * 0.6, 0, Math.PI * 2); ctx.fill();

  if (type === 'sword') {
    // 剑刃
    const grad = ctx.createLinearGradient(-w * 0.12, -h * 0.5, w * 0.12, h * 0.1);
    grad.addColorStop(0, C.metal);
    grad.addColorStop(0.5, '#FFFFFF');
    grad.addColorStop(1, C.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.5);
    ctx.lineTo(w * 0.1, -h * 0.1);
    ctx.lineTo(w * 0.1, h * 0.3);
    ctx.lineTo(-w * 0.1, h * 0.3);
    ctx.lineTo(-w * 0.1, -h * 0.1);
    ctx.closePath(); ctx.fill();
    // 护手 + 剑柄
    ctx.fillStyle = C.dark;
    ctx.fillRect(-w * 0.28, h * 0.3, w * 0.56, h * 0.06);
    ctx.fillRect(-w * 0.05, h * 0.36, w * 0.1, h * 0.16);
  } else if (type === 'helm') {
    ctx.fillStyle = C.metal;
    ctx.beginPath(); ctx.arc(0, -h * 0.1, w * 0.34, Math.PI, 0); ctx.fill();
    ctx.fillRect(-w * 0.34, -h * 0.1, w * 0.68, h * 0.18);
    ctx.fillStyle = C.dark;
    ctx.fillRect(-w * 0.34, h * 0.02, w * 0.68, h * 0.08);
    // 护鼻 + 眼缝
    ctx.fillStyle = C.dark;
    ctx.fillRect(-w * 0.04, -h * 0.24, w * 0.08, h * 0.3);
    ctx.fillStyle = '#101018';
    ctx.fillRect(-w * 0.2, -h * 0.16, w * 0.14, h * 0.07);
    ctx.fillRect(w * 0.06, -h * 0.16, w * 0.14, h * 0.07);
  } else { // armor
    ctx.fillStyle = C.metal;
    roundRect(ctx, -w * 0.36, -h * 0.3, w * 0.72, h * 0.66, 14); ctx.fill();
    ctx.fillStyle = C.dark;
    roundRect(ctx, -w * 0.28, -h * 0.22, w * 0.56, h * 0.5, 10); ctx.fill();
    // 胸甲装饰鳞片
    ctx.fillStyle = C.glow;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath(); ctx.arc(-w * 0.1 + i * w * 0.1, -h * 0.05, w * 0.04, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// ---- 大师之作进度条 ----
function drawProgressBar(ctx, state) {
  const x = LAYOUT.MARGIN_X;
  const y = LAYOUT.PROGRESS_Y;
  const w = WORLD.WIDTH - LAYOUT.MARGIN_X * 2;
  const h = 40;
  // 底板
  ctx.fillStyle = 'rgba(20,16,8,0.72)';
  roundRect(ctx, x - 6, y - 6, w + 12, h + 28, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x - 6, y - 6, w + 12, h + 28, 12); ctx.stroke();

  ctx.fillStyle = '#FFE9B4';
  ctx.font = '800 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('MASTERWORK', x + 8, y + h / 2 - 4);

  // 进度槽
  const barY = y + 14;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, x, barY, w, 16, 8); ctx.fill();
  const p = Math.max(0, Math.min(1, state.masterpiece));
  const grad = ctx.createLinearGradient(x, barY, x + w, barY);
  grad.addColorStop(0, '#E8A84C');
  grad.addColorStop(1, '#FFE9B4');
  ctx.fillStyle = grad;
  if (p > 0.005) { roundRect(ctx, x, barY, w * p, 16, 8); ctx.fill(); }
  ctx.fillStyle = '#1E1608';
  ctx.font = '800 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(p * 100)}%`, x + w / 2, barY + 8);
  ctx.textAlign = 'left';
}

// ---- 火花粒子 ----
function drawSparks(ctx, fxQueue, clock) {
  for (const fx of fxQueue) {
    if (fx.type !== 'spark' || fx.ttl <= 0) continue;
    const a = fx.ttl / 0.5;
    for (let i = 0; i < 6; i += 1) {
      const ang = (i / 6) * Math.PI * 2 + fx.seed;
      const d = (1 - a) * 60 + i;
      const x = fx.x + Math.cos(ang) * d;
      const y = fx.y + Math.sin(ang) * d - (1 - a) * 30;
      ctx.fillStyle = `rgba(255,${180 + i * 10},60,${a})`;
      ctx.beginPath(); ctx.arc(x, y, 2.5 * a + 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---- 布局 ----
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
    return {
      anvil: { x: LAYOUT.ANVIL_X - LAYOUT.ANVIL_W / 2, y: LAYOUT.ANVIL_Y - LAYOUT.ANVIL_H / 2, w: LAYOUT.ANVIL_W, h: LAYOUT.ANVIL_H },
      progress: { x: LAYOUT.MARGIN_X, y: LAYOUT.PROGRESS_Y, w: WORLD.WIDTH - LAYOUT.MARGIN_X * 2, h: 46 },
      item: { x: LAYOUT.ITEM_X - LAYOUT.ITEM_W / 2, y: LAYOUT.ITEM_Y - LAYOUT.ITEM_H / 2, w: LAYOUT.ITEM_W, h: LAYOUT.ITEM_H },
      forge: { x: LAYOUT.ANVIL_X - 260, y: LAYOUT.ANVIL_Y - 220, w: 520, h: 400 },
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('village'), 0, 0);
    drawAnvil(ctx, LAYOUT.ANVIL_X, LAYOUT.ANVIL_Y, LAYOUT.ANVIL_W, LAYOUT.ANVIL_H, 'village', 0);
    drawHammer(ctx, LAYOUT.ANVIL_X, LAYOUT.ANVIL_Y, 0.5, 'village');
    drawItem(ctx, LAYOUT.ITEM_X, LAYOUT.ITEM_Y, LAYOUT.ITEM_W, LAYOUT.ITEM_H, 0, 'sword', clock);
  }

  function draw(state, dt, view) {
    if (!state) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;
    const sceneKey = SCENES.includes(state.scene) ? state.scene : 'village';

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);

    // 火温/矿脉/罢工氛围
    if (state.buffs?.vein?.active) {
      ctx.fillStyle = 'rgba(255,216,120,0.06)';
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
    if (state.buffs?.temp?.active) {
      ctx.fillStyle = 'rgba(255,120,40,0.05)';
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }

    drawProgressBar(ctx, state);

    // 铁砧 + 摆锤
    const glow = state.buffs?.temp?.active || state.buffs?.vein?.active ? 0.8 : 0;
    drawAnvil(ctx, LAYOUT.ANVIL_X, LAYOUT.ANVIL_Y, LAYOUT.ANVIL_W, LAYOUT.ANVIL_H, sceneKey, glow);
    const swingPhase = state.phase === 'won' ? 0.6 : (state.forgeProgress || 0);
    drawHammer(ctx, LAYOUT.ANVIL_X, LAYOUT.ANVIL_Y, swingPhase, sceneKey);

    // 装备立绘
    const type = itemTypeFromName(state.name);
    drawItem(ctx, LAYOUT.ITEM_X, LAYOUT.ITEM_Y, LAYOUT.ITEM_W, LAYOUT.ITEM_H, state.tier, type, clock);

    // 罢工标识
    if (state.strike?.active) {
      ctx.fillStyle = 'rgba(255,60,60,0.85)';
      ctx.font = '800 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠', LAYOUT.ANVIL_X, LAYOUT.ANVIL_Y - 150);
      ctx.textAlign = 'left';
    }

    drawSparks(ctx, v.fxQueue || [], clock);

    // 传世装备金光（全屏渐变）
    if (v.flash > 0) {
      const a = Math.min(1, v.flash);
      const fg = ctx.createRadialGradient(LAYOUT.ITEM_X, LAYOUT.ITEM_Y, 40, LAYOUT.ITEM_X, LAYOUT.ITEM_Y, WORLD.WIDTH * 0.7);
      fg.addColorStop(0, `rgba(255,236,150,${0.85 * a})`);
      fg.addColorStop(0.5, `rgba(255,180,60,${0.4 * a})`);
      fg.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }

    ctx.restore();
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize };
}
