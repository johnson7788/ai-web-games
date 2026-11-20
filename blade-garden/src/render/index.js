// BLADE GARDEN · Canvas 2D 渲染（纯程序化，零外部素材）。
// 只消费 run.state + view（fxQueue/shake/joystick/signature）。像素换算全部在此完成。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize() }。
// 三场景包：春圃 spring / 夏泽 summer / 秋崖 autumn（色板/构图/装饰互异）。

import { WORLD, GAME } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const TAU = Math.PI * 2;

export const SCENE_PALETTES = {
  spring: {
    skyTop: '#BEE7D0', skyBot: '#EAF6DF',
    ground: '#8CCB74', groundDark: '#6FAE5C',
    far: '#A9DE9A', near: '#79BC6B',
    accent: '#F7A8C8', accent2: '#FFF1F5',
    deco: 'blossom',
  },
  summer: {
    skyTop: '#9AD6C4', skyBot: '#C9EDE2',
    ground: '#5EA98C', groundDark: '#4A8B72',
    far: '#7DC3A8', near: '#5EA98C',
    accent: '#E9C46A', accent2: '#F4E4B0',
    deco: 'reed',
  },
  autumn: {
    skyTop: '#E8A76A', skyBot: '#F4D2A6',
    ground: '#C98A4B', groundDark: '#A96E38',
    far: '#D99B5A', near: '#C07F42',
    accent: '#D9534F', accent2: '#F2C14E',
    deco: 'leaf',
  },
};

// ------------------------------------------------------------------ 背景缓存
const bgCache = new Map();
function getBackground(sceneKey) {
  let c = bgCache.get(sceneKey);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  drawBackground(c.getContext('2d'), sceneKey);
  bgCache.set(sceneKey, c);
  return c;
}

function seeded(r, c) {
  const a = (r * 73856093) ^ (c * 19349663);
  const v = Math.sin(a) * 43758.5453;
  return v - Math.floor(v);
}

function drawBackground(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.spring;
  const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // 远景山/云
  g.fillStyle = P.far;
  g.beginPath();
  g.moveTo(0, H * 0.5);
  for (let i = 0; i <= 8; i += 1) {
    const x = (W / 8) * i;
    g.lineTo(x, H * 0.5 - Math.sin(i * 1.3) * 60 - 20);
  }
  g.lineTo(W, H * 0.62); g.lineTo(0, H * 0.62); g.closePath(); g.fill();

  // 地面
  const grd = g.createLinearGradient(0, H * 0.58, 0, H);
  grd.addColorStop(0, P.ground);
  grd.addColorStop(1, P.groundDark);
  g.fillStyle = grd;
  g.fillRect(0, H * 0.58, W, H * 0.42);

  // 地表纹理（稳伪随机点/草）
  for (let i = 0; i < 260; i += 1) {
    const x = seeded(i, 1) * W;
    const y = H * 0.6 + seeded(i, 2) * (H * 0.4);
    g.fillStyle = seeded(i, 3) > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
    g.beginPath();
    g.arc(x, y, 1 + seeded(i, 4) * 2.4, 0, TAU);
    g.fill();
  }

  if (P.deco === 'blossom') drawBlossoms(g, P);
  else if (P.deco === 'reed') drawReeds(g, P);
  else drawLeaves(g, P);
}

function drawBlossoms(g, P) {
  for (let i = 0; i < 26; i += 1) {
    const x = seeded(i, 11) * W;
    const y = H * 0.58 + seeded(i, 12) * (H * 0.4);
    const r = 3 + seeded(i, 13) * 5;
    g.fillStyle = P.accent;
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * TAU + seeded(i, 14);
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.55, r * 0.3, a, 0, TAU);
      g.fill();
    }
    g.fillStyle = P.accent2;
    g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.fill();
  }
  // 竹丛
  drawBamboo(g, 90, H * 0.62, 1.0);
  drawBamboo(g, W - 90, H * 0.64, 0.85);
}

function drawBamboo(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = '#4E8F4E'; g.lineWidth = 8; g.lineCap = 'round';
  for (let i = 0; i < 3; i += 1) {
    const bx = (i - 1) * 26;
    g.beginPath(); g.moveTo(bx, 0); g.quadraticCurveTo(bx + 8, -130, bx - 4, -240); g.stroke();
    g.fillStyle = '#5FA35F';
    for (let k = 0; k < 4; k += 1) {
      const a = -Math.PI / 2 + (k - 1.5) * 0.55;
      g.save(); g.translate(bx - 4, -240 + k * 0); g.rotate(a + (i - 1) * 0.3);
      g.beginPath(); g.ellipse(0, -26, 6, 24, 0, 0, TAU); g.fill();
      g.restore();
    }
  }
  g.restore();
}

function drawReeds(g, P) {
  for (let i = 0; i < 40; i += 1) {
    const x = seeded(i, 21) * W;
    const y = H * 0.58 + seeded(i, 22) * (H * 0.42);
    g.strokeStyle = '#2F6E57'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 30, x + 3, y - 52); g.stroke();
    g.fillStyle = '#3E8B6A';
    g.beginPath(); g.ellipse(x + 3, y - 52, 3, 12, 0, 0, TAU); g.fill();
  }
  // 水波
  g.strokeStyle = 'rgba(200,240,230,0.25)'; g.lineWidth = 2;
  for (let i = 0; i < 7; i += 1) {
    const y = H * 0.68 + i * 30;
    g.beginPath();
    for (let x = 0; x <= W; x += 14) {
      const yy = y + Math.sin(x * 0.02 + i * 1.5) * 3;
      if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }
}

function drawLeaves(g, P) {
  for (let i = 0; i < 30; i += 1) {
    const x = seeded(i, 31) * W;
    const y = H * 0.6 + seeded(i, 32) * (H * 0.4);
    const r = 2.5 + seeded(i, 33) * 4;
    g.save(); g.translate(x, y); g.rotate(seeded(i, 34) * TAU);
    g.fillStyle = i % 2 ? P.accent : P.accent2;
    g.beginPath(); g.ellipse(0, 0, r, r * 0.5, 0, 0, TAU); g.fill();
    g.restore();
  }
  // 岩
  for (let i = 0; i < 6; i += 1) {
    const x = seeded(i, 41) * W;
    const y = H * 0.62 + seeded(i, 42) * (H * 0.34);
    g.fillStyle = '#8A6A4A';
    g.beginPath();
    g.moveTo(x - 30, y); g.lineTo(x - 12, y - 26); g.lineTo(x + 18, y - 20); g.lineTo(x + 30, y); g.closePath();
    g.fill();
    g.fillStyle = '#A87E58';
    g.beginPath(); g.moveTo(x - 12, y - 26); g.lineTo(x - 2, y - 34); g.lineTo(x + 18, y - 20); g.closePath(); g.fill();
  }
}

// ------------------------------------------------------------------ 圆角
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ------------------------------------------------------------------ 玩家（竹剑客）
function drawPlayer(g, p, clock, facing) {
  const x = p.x, y = p.y;
  // 脚下影
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath(); g.ellipse(x, y + 20, 18, 7, 0, 0, TAU); g.fill();

  // 光晕（玩家最亮）
  const glow = g.createRadialGradient(x, y, 4, x, y, 46);
  glow.addColorStop(0, 'rgba(220,255,230,0.6)');
  glow.addColorStop(1, 'rgba(220,255,230,0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(x, y, 46, 0, TAU); g.fill();

  g.save();
  g.translate(x, y);
  g.scale(1.35, 1.35);
  // 白色轮廓环（玩家一眼可辨）
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 2.5;
  g.beginPath(); g.arc(0, -2, 21, 0, TAU); g.stroke();
  const bob = Math.sin(clock * 6) * 1.5;
  g.translate(0, bob);

  // 竹剑（朝向最近敌人）
  g.save();
  g.rotate(facing);
  g.strokeStyle = '#3E7A3E'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(6, 0); g.lineTo(34, 0); g.stroke();
  g.strokeStyle = '#CBE0A0'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(10, -3); g.lineTo(32, -3); g.stroke();
  g.restore();

  // 斗笠
  g.fillStyle = '#C89A4B';
  g.beginPath(); g.arc(0, -22, 17, Math.PI, 0); g.fill();
  g.fillStyle = '#B0833A';
  g.beginPath(); g.ellipse(0, -22, 17, 5, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#6B4E22';
  g.beginPath(); g.arc(0, -18, 8, 0, TAU); g.fill();

  // 头
  g.fillStyle = '#F2D3A8';
  g.beginPath(); g.arc(0, -10, 9, 0, TAU); g.fill();

  // 袍（绿）
  g.fillStyle = '#4E9E5A';
  g.beginPath();
  g.moveTo(-12, 12);
  g.quadraticCurveTo(-14, -4, -6, -8);
  g.lineTo(6, -8);
  g.quadraticCurveTo(14, -4, 12, 12);
  g.closePath(); g.fill();
  g.fillStyle = '#3E7E48';
  g.beginPath(); g.ellipse(0, 4, 8, 10, 0, 0, TAU); g.fill();
  // 腰带
  g.fillStyle = '#D9B94A';
  g.fillRect(-8, 2, 16, 3);
  g.restore();
}

// ------------------------------------------------------------------ 敌人
function drawEnemy(g, e, clock, noMarkers) {
  const { x, y, radius: r } = e;
  const id = e.enemyId;
  const elite = e.elite, boss = e.boss;

  // 脚下影
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.beginPath(); g.ellipse(x, y + r * 0.9, r * 0.8, r * 0.28, 0, 0, TAU); g.fill();

  if (boss) {
    const glow = g.createRadialGradient(x, y, r * 0.3, x, y, r * 1.8);
    glow.addColorStop(0, 'rgba(255,120,60,0.5)');
    glow.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(x, y, r * 1.8, 0, TAU); g.fill();
  }

  g.save();
  g.translate(x, y);
  const wob = Math.sin(clock * 8 + e.id) * (boss ? 2 : 1);

  if (id === 'crow') {
    g.fillStyle = '#33333F';
    g.beginPath();
    g.moveTo(0, -r); g.lineTo(r, r * 0.7); g.lineTo(-r, r * 0.7); g.closePath(); g.fill();
    g.fillStyle = '#1E1E26';
    g.beginPath(); g.moveTo(-r * 0.6, -r * 0.3); g.lineTo(-r * 1.2, -r * 0.7); g.lineTo(-r * 0.3, r * 0.1); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(r * 0.6, -r * 0.3); g.lineTo(r * 1.2, -r * 0.7); g.lineTo(r * 0.3, r * 0.1); g.closePath(); g.fill();
    g.fillStyle = '#FF6B5E';
    g.beginPath(); g.arc(r * 0.2, -r * 0.4, r * 0.18, 0, TAU); g.fill();
  } else if (id === 'thief') {
    g.fillStyle = '#5A3B6B';
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.fillStyle = '#6E4A82';
    g.beginPath(); g.arc(0, -r * 0.1, r * 0.6, 0, TAU); g.fill();
    g.fillStyle = '#2A1B33';
    g.beginPath(); g.arc(-r * 0.25, -r * 0.2, r * 0.18, 0, TAU); g.arc(r * 0.25, -r * 0.2, r * 0.18, 0, TAU); g.fill();
  } else if (id === 'mandrill' || id === 'eliteMandrill' || id === 'bossMandrillKing') {
    g.fillStyle = '#4A5A3B';
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.fillStyle = '#7A8A5B';
    g.beginPath(); g.ellipse(0, r * 0.2, r * 0.5, r * 0.4, 0, 0, TAU); g.fill();
    g.fillStyle = '#E8C77A';
    g.beginPath(); g.arc(0, r * 0.35, r * 0.3, 0, TAU); g.fill();
    if (boss) { g.fillStyle = '#F2C14E'; g.beginPath(); g.moveTo(-r * 0.5, -r * 0.8); g.lineTo(0, -r * 1.4); g.lineTo(r * 0.5, -r * 0.8); g.closePath(); g.fill(); }
  } else if (id === 'bossCauldron') {
    g.fillStyle = '#2E7A5B';
    roundRect(g, -r, -r * 0.7, r * 2, r * 1.7, r * 0.4); g.fill();
    g.fillStyle = '#25644A';
    roundRect(g, -r * 0.8, -r, r * 1.6, r * 0.5, r * 0.2); g.fill();
    g.fillStyle = '#B8F0C8';
    for (let i = 0; i < 3; i += 1) {
      g.beginPath(); g.arc((i - 1) * r * 0.4, -r * 1.1, r * 0.16, 0, TAU); g.fill();
    }
    g.fillStyle = '#3E8B6A';
    g.beginPath(); g.ellipse(0, -r * 0.7, r * 0.7, r * 0.2, 0, 0, TAU); g.fill();
  } else {
    // boar / eliteBoar
    g.fillStyle = e.proto.color || '#8A5A3B';
    g.beginPath(); g.ellipse(0, 0, r * 1.1, r * 0.85, 0, 0, TAU); g.fill();
    g.fillStyle = '#6E452E';
    g.beginPath(); g.ellipse(-r * 0.3, -r * 0.3, r * 0.3, r * 0.22, 0, 0, TAU); g.fill();
    g.fillStyle = '#F5EDD8';
    g.beginPath();
    g.moveTo(r * 1.05, -r * 0.4); g.lineTo(r * 0.55, -r * 0.2); g.lineTo(r * 0.55, r * 0.15); g.lineTo(r * 1.05, r * 0.35);
    g.closePath(); g.fill();
  }
  g.restore();

  // 普通敌人：红色威胁描边 + 顶部红三角「敌对」标记（一眼看出是「要斩的目标」）
  if (!noMarkers && !elite && !boss) {
    g.strokeStyle = 'rgba(255,70,50,0.95)';
    g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, r + 4, 0, TAU); g.stroke();
    g.fillStyle = '#FF2D20';
    g.beginPath();
    g.moveTo(x, y - r - 4);
    g.lineTo(x - 7, y - r - 15);
    g.lineTo(x + 7, y - r - 15);
    g.closePath();
    g.fill();
  }

  // 精英/ Boss 环
  if (!noMarkers && (elite || boss)) {
    g.strokeStyle = boss ? 'rgba(255,120,60,0.9)' : 'rgba(255,210,90,0.9)';
    g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, r + 7 + wob * 0.5, 0, TAU); g.stroke();
  }
}

// ------------------------------------------------------------------ 修为光点
function drawGem(g, gem, clock) {
  const pulse = 1 + Math.sin(clock * 5 + gem.t * 3) * 0.2;
  const r = 6 * pulse;
  const glow = g.createRadialGradient(gem.x, gem.y, 1, gem.x, gem.y, r * 2.4);
  glow.addColorStop(0, 'rgba(160,255,170,0.95)');
  glow.addColorStop(1, 'rgba(160,255,170,0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(gem.x, gem.y, r * 2.4, 0, TAU); g.fill();
  g.fillStyle = '#6FE08A';
  g.beginPath(); g.arc(gem.x, gem.y, r, 0, TAU); g.fill();
  g.fillStyle = '#C9FFCF';
  g.beginPath(); g.arc(gem.x - r * 0.25, gem.y - r * 0.25, r * 0.35, 0, TAU); g.fill();
}

// ------------------------------------------------------------------ 弹
function drawProjectile(g, pr) {
  if (pr.kind === 'leafDart') {
    g.save(); g.translate(pr.x, pr.y); g.rotate(Math.atan2(pr.vy, pr.vx));
    g.fillStyle = '#5FB84E';
    g.beginPath(); g.ellipse(0, 0, 9, 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#CFF0A0';
    g.beginPath(); g.ellipse(2, 0, 5, 2, 0, 0, TAU); g.fill();
    g.restore();
  } else {
    g.fillStyle = '#D8F0FF';
    g.beginPath(); g.arc(pr.x, pr.y, pr.radius, 0, TAU); g.fill();
  }
}

function drawEnemyProjectile(g, pr) {
  const glow = g.createRadialGradient(pr.x, pr.y, 1, pr.x, pr.y, 14);
  glow.addColorStop(0, 'rgba(255,150,90,0.9)');
  glow.addColorStop(1, 'rgba(255,150,90,0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(pr.x, pr.y, 14, 0, TAU); g.fill();
  g.fillStyle = '#E8723A';
  g.beginPath(); g.arc(pr.x, pr.y, 7, 0, TAU); g.fill();
}

// ------------------------------------------------------------------ 地形：毒沼 / 窄道
function drawHazards(g, state) {
  for (const hz of state.hazards || []) {
    g.fillStyle = 'rgba(120,190,90,0.28)';
    roundRect(g, hz.x, hz.y, hz.w, hz.h, 20);
    g.fill();
    g.strokeStyle = 'rgba(120,190,90,0.55)';
    g.lineWidth = 2;
    g.setLineDash([10, 8]);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(180,230,140,0.5)';
    for (let i = 0; i < 5; i += 1) {
      const bx = hz.x + 24 + i * 60;
      const by = hz.y + 24 + (i % 3) * 30;
      g.beginPath(); g.arc(bx, by, 5, 0, TAU); g.fill();
    }
  }
}

function drawWalls(g, state) {
  for (const wl of state.walls || []) {
    const grad = g.createLinearGradient(0, wl.y, 0, wl.y + wl.h);
    grad.addColorStop(0, '#8A6A48');
    grad.addColorStop(1, '#6B4E32');
    g.fillStyle = grad;
    roundRect(g, wl.x, wl.y, wl.w, wl.h, 8);
    g.fill();
    g.strokeStyle = '#4A3622';
    g.lineWidth = 3;
    g.stroke();
    // 竹节纹理
    g.strokeStyle = 'rgba(0,0,0,0.2)';
    g.lineWidth = 2;
    for (let x = wl.x + 18; x < wl.x + wl.w; x += 26) {
      g.beginPath(); g.moveTo(x, wl.y + 4); g.lineTo(x, wl.y + wl.h - 4); g.stroke();
    }
  }
}

// ------------------------------------------------------------------ 特效 / 签名竹叶
function drawFx(g, fx, clock) {
  if (fx.type === 'bolt') {
    const a = fx.ttl / fx.max;
    g.strokeStyle = `rgba(255,235,120,${a})`;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(fx.x, fx.y - 26);
    g.lineTo(fx.x + 6, fx.y - 4);
    g.lineTo(fx.x - 6, fx.y + 4);
    g.lineTo(fx.x, fx.y + 26);
    g.stroke();
  } else if (fx.type === 'ring') {
    const k = 1 - fx.ttl / fx.max;
    g.strokeStyle = `rgba(220,255,230,${(1 - k) * 0.8})`;
    g.lineWidth = 4 * (1 - k) + 1;
    g.beginPath(); g.arc(fx.x, fx.y, fx.r * k + 6, 0, TAU); g.stroke();
  } else if (fx.type === 'burst' || fx.type === 'hit') {
    const a = fx.ttl / fx.max;
    const r = 6 + (1 - a) * 22;
    g.fillStyle = fx.type === 'burst' ? `rgba(255,210,90,${a * 0.8})` : `rgba(255,255,255,${a * 0.7})`;
    for (let i = 0; i < 5; i += 1) {
      const ang = (i / 5) * TAU + fx.seed;
      g.beginPath(); g.arc(fx.x + Math.cos(ang) * r, fx.y + Math.sin(ang) * r, 3 * a + 1, 0, TAU); g.fill();
    }
  }
}

function drawSignatureLeaves(g, p, clock) {
  const n = 10;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TAU + clock * 1.6;
    const rad = 42 + Math.sin(clock * 3 + i) * 6;
    const x = p.x + Math.cos(a) * rad;
    const y = p.y + Math.sin(a) * rad;
    g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2 + Math.sin(clock * 2 + i) * 0.5);
    g.fillStyle = i % 2 ? '#7ED98A' : '#B7F0A0';
    g.beginPath(); g.ellipse(0, 0, 8, 3.4, 0, 0, TAU); g.fill();
    g.restore();
  }
}

// ------------------------------------------------------------------ 摇杆
function drawJoystick(g, joy) {
  const { x, y } = joy.base;
  const r = 48;
  g.save();
  g.globalAlpha = 0.45;
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.4)';
  g.beginPath(); g.arc(x, y, r * 0.55, 0, TAU); g.stroke();
  const kx = x + joy.dx * (r - 18);
  const ky = y + joy.dy * (r - 18);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.arc(kx, ky, 20, 0, TAU); g.fill();
  g.restore();
}

// ------------------------------------------------------------------ 布局（供教程高亮真实 UI）
function debugLayout() {
  return {
    joystick: { x: 44, y: H - 44 - 116, w: 116, h: 116 },
    xpBar: { x: 620, y: 11, w: 260, h: 22 },
    upgrade: { x: W / 2 - 190, y: H / 2 - 165, w: 380, h: 330 },
  };
}

// ------------------------------------------------------------------ createRenderer
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let clock = 0;

  function drawTitleScene(view) {
    const v = view || {};
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(getBackground('spring'), 0, 0);
    const p = { x: W / 2, y: 640, speed: 0, abilities: {} };
    drawPlayer(ctx, p, clock, 0);
    drawEnemy(ctx, { id: 1, enemyId: 'boar', proto: { color: '#8A5A3B' }, x: W / 2 - 250, y: 620, radius: 24, elite: false, boss: false }, clock, true);
    drawEnemy(ctx, { id: 2, enemyId: 'crow', proto: { color: '#33333F' }, x: W / 2 + 260, y: 600, radius: 15, elite: false, boss: false }, clock, true);
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * TAU;
      drawGem(ctx, { x: W / 2 + Math.cos(a) * 130, y: 560 + Math.sin(a) * 40, t: i, value: 1 }, clock);
    }
  }

  function draw(state, dt, view) {
    const v = view || {};
    clock += dt || 0;
    if (!state || !state.player) { drawTitleScene(v); return; }

    const sceneKey = state.sceneKey || 'spring';
    const p = state.player;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (v.shake > 0) ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);

    ctx.drawImage(getBackground(sceneKey), 0, 0);
    // 摇杆画在场景之上、实体之下（避免遮住敌人/玩家）
    if (v.joystick) drawJoystick(ctx, v.joystick);
    drawHazards(ctx, state);
    drawWalls(ctx, state);

    // 根须缠绕范围提示
    if (p.abilities.rootTangle > 0) {
      ctx.strokeStyle = 'rgba(120,190,90,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 120, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const gem of state.gems) drawGem(ctx, gem, clock);
    for (const e of state.enemies) drawEnemy(ctx, e, clock);
    for (const pr of state.projectiles) drawProjectile(ctx, pr);
    for (const pr of state.enemyProjectiles) drawEnemyProjectile(ctx, pr);

    // 玩家朝向最近敌人
    let facing = 0;
    let bd = Infinity;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; facing = Math.atan2(e.y - p.y, e.x - p.x); }
    }
    drawPlayer(ctx, p, clock, facing);

    // 特效
    for (const fx of v.fxQueue || []) drawFx(ctx, fx, clock);

    // 签名竹叶旋舞
    if (state.signature || (v.signatureLeaves && p.abilities && Object.values(p.abilities).filter(Boolean).length >= 3)) {
      drawSignatureLeaves(ctx, p, clock);
    }

    ctx.restore();
  }

  return {
    draw,
    debugLayout,
    resize: (w, h) => ({ w, h, world: { width: W, height: H } }),
  };
}
