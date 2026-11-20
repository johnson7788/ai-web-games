// Canvas 2D 渲染：Depth Diver 三场景（阳光浅海 / 微光中层 / 午夜深渊）+ 潜航器 +
// 头灯光锥 / 礁石 / 水雷 / 样本生物 / 氧气罐 / 热泉气泡 / 追逐者 + 暗角限视 + 层切扫光。
// 只消费 run.state + view（shake/layerFlash/scatter/clock）。像素换算全部在此完成。

import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const SCENE_PALETTES = {
  sunlit: {
    skyTop: '#8FE3F5', skyMid: '#46b3d8', skyBot: '#17679a',
    beam: 'rgba(210,245,255,0.5)',
    rockHi: '#7a5a40', rockDark: '#3f2f24', rockLine: '#241a12',
    depth: 0.25,
    particle: 'rgba(235,250,255,0.8)',
  },
  twilight: {
    skyTop: '#0d3a4c', skyMid: '#0a2c3d', skyBot: '#041722',
    beam: 'rgba(120,220,240,0.22)',
    rockHi: '#54545c', rockDark: '#2a2e34', rockLine: '#10141a',
    depth: 0.4,
    particle: 'rgba(150,230,240,0.55)',
  },
  abyss: {
    skyTop: '#050d16', skyMid: '#030a12', skyBot: '#010409',
    beam: 'rgba(90,200,255,0.14)',
    rockHi: '#464b56', rockDark: '#1d2229', rockLine: '#05070a',
    depth: 0.55,
    particle: 'rgba(120,255,220,0.75)',
  },
};

const PAL = (sceneKey) => SCENE_PALETTES[sceneKey] || SCENE_PALETTES.sunlit;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededRand(a, b, seed = 7) {
  return mulberry32((a * 73856093) ^ (b * 19349663) ^ (seed * 83492791))();
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

function drawBackground(g, sceneKey) {
  const P = PAL(sceneKey);
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // 阳光束（浅海）/ 微光（中层）/ 无（深渊）
  if (sceneKey === 'sunlit') {
    for (let i = 0; i < 6; i += 1) {
      const x = 140 + i * 200 + seededRand(i, 3, 13) * 60;
      const grad = g.createLinearGradient(x, 0, x - 90, H);
      grad.addColorStop(0, P.beam);
      grad.addColorStop(1, 'rgba(210,245,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x - 46, 0); g.lineTo(x + 46, 0); g.lineTo(x - 40, H); g.lineTo(x - 130, H);
      g.closePath(); g.fill();
    }
  } else if (sceneKey === 'twilight') {
    for (let i = 0; i < 5; i += 1) {
      const x = 200 + i * 220 + seededRand(i, 7, 17) * 80;
      const grad = g.createLinearGradient(x, 0, x - 70, H);
      grad.addColorStop(0, P.beam);
      grad.addColorStop(1, 'rgba(120,220,240,0)');
      g.fillStyle = grad;
      g.fillRect(x - 30, 0, 60, H);
    }
  }

  // 底部海床 / 崖壁装饰（构图互异）
  if (sceneKey === 'sunlit') drawSandyBed(g, P);
  else if (sceneKey === 'twilight') drawSilhouetteCliffs(g, P);
  else drawAbyssSpires(g, P);
}

function drawSandyBed(g, P) {
  const H = WORLD.HEIGHT;
  g.fillStyle = 'rgba(214,184,120,0.5)';
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(0, H - 26);
  for (let x = 0; x <= WORLD.WIDTH; x += 16) g.lineTo(x, H - 26 - Math.sin(x * 0.02) * 8);
  g.lineTo(WORLD.WIDTH, H);
  g.closePath(); g.fill();
  // 海草
  for (let i = 0; i < 14; i += 1) {
    const x = 40 + i * 95 + seededRand(i, 1, 9) * 30;
    g.strokeStyle = 'rgba(40,120,70,0.55)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, H);
    g.quadraticCurveTo(x + Math.sin(i) * 14, H - 50, x + Math.sin(i * 2) * 20, H - 90);
    g.stroke();
  }
}

function drawSilhouetteCliffs(g, P) {
  const H = WORLD.HEIGHT;
  g.fillStyle = 'rgba(4,14,20,0.9)';
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= WORLD.WIDTH; x += 24) g.lineTo(x, H - 90 - Math.abs(Math.sin(x * 0.012 + 1.3)) * 150);
  g.lineTo(WORLD.WIDTH, H); g.closePath(); g.fill();
  g.fillStyle = 'rgba(4,14,20,0.6)';
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= WORLD.WIDTH; x += 24) g.lineTo(x, H - 40 - Math.abs(Math.sin(x * 0.02 + 4.0)) * 70);
  g.lineTo(WORLD.WIDTH, H); g.closePath(); g.fill();
}

function drawAbyssSpires(g, P) {
  const H = WORLD.HEIGHT;
  g.fillStyle = 'rgba(0,0,0,0.95)';
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= WORLD.WIDTH; x += 20) g.lineTo(x, H - 120 - Math.abs(Math.sin(x * 0.015)) * 180);
  g.lineTo(WORLD.WIDTH, H); g.closePath(); g.fill();
  for (let i = 0; i < 24; i += 1) {
    const x = seededRand(i, 3, 19) * WORLD.WIDTH;
    const y = H - 60 - seededRand(i, 5, 23) * 200;
    g.fillStyle = `rgba(90,200,255,${0.2 + seededRand(i, 7, 29) * 0.5})`;
    g.beginPath(); g.arc(x, y, 1 + seededRand(i, 9, 31) * 2, 0, Math.PI * 2); g.fill();
  }
}

// ---- 潜航器（程序化，主体最亮保证剪影可读）----
function drawSub(ctx, x, y, clock, thrusting) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(clock * 2.2) * 2;
  ctx.rotate((thrusting ? 1 : -1) * 0.05 + Math.sin(clock * 1.4) * 0.03);
  ctx.translate(0, bob);

  // 艇体柔光（保证潜航器在深水中是最亮主体）
  const bodyGlow = ctx.createRadialGradient(0, 0, 6, 0, 0, 64);
  bodyGlow.addColorStop(0, 'rgba(210,240,255,0.55)');
  bodyGlow.addColorStop(1, 'rgba(210,240,255,0)');
  ctx.fillStyle = bodyGlow;
  ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.fill();

  // 头灯光锥（向右下，照亮下潜路径）
  const cone = ctx.createLinearGradient(20, 8, 20 + GAME.PLAYER_R * 1.2, 8 + 90);
  cone.addColorStop(0, 'rgba(190,240,255,0.85)');
  cone.addColorStop(1, 'rgba(190,240,255,0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(22, 4);
  ctx.lineTo(22, 18);
  ctx.lineTo(22 + GAME.PLAYER_R * 1.4, 26 + 70);
  ctx.lineTo(22 + GAME.PLAYER_R * 0.4, 4);
  ctx.closePath(); ctx.fill();

  // 艇体
  const hull = ctx.createLinearGradient(0, -22, 0, 22);
  hull.addColorStop(0, '#f2f6fa');
  hull.addColorStop(0.5, '#cfe0ea');
  hull.addColorStop(1, '#8fb0c4');
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-36, -14);
  ctx.lineTo(28, -14);
  ctx.quadraticCurveTo(40, 0, 28, 14);
  ctx.lineTo(-36, 14);
  ctx.quadraticCurveTo(-46, 0, -36, -14);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a5a70';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 观察窗（穹顶）
  ctx.fillStyle = '#123a5c';
  ctx.beginPath(); ctx.arc(12, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7fd0e8';
  ctx.beginPath(); ctx.arc(14, -1, 3, 0, Math.PI * 2); ctx.fill();

  // 尾鳍 + 螺旋桨
  ctx.fillStyle = '#e8863a';
  ctx.beginPath(); ctx.moveTo(-36, -6); ctx.lineTo(-48, -18); ctx.lineTo(-44, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-36, 6); ctx.lineTo(-48, 18); ctx.lineTo(-44, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffb457';
  ctx.beginPath(); ctx.arc(-46, 0, 4, clock * 12, clock * 12 + 1.2); ctx.stroke();
  ctx.strokeStyle = '#c96a2e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-44, -2); ctx.lineTo(-48, 2); ctx.stroke();

  // 红色信号灯（色盲冗余：形状为三角形）
  ctx.fillStyle = '#ff5a5a';
  ctx.beginPath(); ctx.moveTo(30, -10); ctx.lineTo(38, -7); ctx.lineTo(30, -4); ctx.closePath(); ctx.fill();

  ctx.restore();
}

function drawRock(ctx, x, y, r, sceneKey) {
  const P = PAL(sceneKey);
  ctx.save();
  ctx.translate(x, y);
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, P.rockHi);
  grad.addColorStop(1, P.rockDark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const rr = r * (0.82 + seededRand(i, 1, 5) * 0.3);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = P.rockLine; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMine(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  grad.addColorStop(0, '#6a7480');
  grad.addColorStop(1, '#1d242c');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
  // 尖刺
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    ctx.fillStyle = '#9aa4b0';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a - 0.22) * (r + 12), Math.sin(a - 0.22) * (r + 12));
    ctx.lineTo(Math.cos(a + 0.22) * (r + 12), Math.sin(a + 0.22) * (r + 12));
    ctx.closePath(); ctx.fill();
  }
  // 红色警示灯（形状冗余：方形灯）
  const blink = 0.6 + 0.4 * Math.sin(performance.now() * 0.006);
  ctx.fillStyle = `rgba(255,60,60,${blink})`;
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();
}

function drawSample(ctx, x, y, clock) {
  ctx.save();
  ctx.translate(x, y);
  const pulse = 1 + Math.sin(clock * 4 + x * 0.01) * 0.1;
  // 采集标记环（金色虚线环 + 中心亮点：一眼读出「这是可采集目标」）
  const ring = 0.5 + 0.5 * Math.sin(clock * 5);
  ctx.strokeStyle = `rgba(255,224,120,${0.5 + 0.4 * ring})`;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -clock * 22;
  ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // 外光晕（金色，最易在深蓝水中辨识）
  const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
  halo.addColorStop(0, 'rgba(255,240,190,0.95)');
  halo.addColorStop(0.5, 'rgba(255,190,80,0.5)');
  halo.addColorStop(1, 'rgba(255,170,40,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
  // 水母伞盖（金琥珀）
  const bell = ctx.createRadialGradient(0, -6, 2, 0, 0, 16);
  bell.addColorStop(0, '#fffbe8');
  bell.addColorStop(1, '#e8a11f');
  ctx.fillStyle = bell;
  ctx.beginPath();
  ctx.moveTo(-14 * pulse, 0);
  ctx.quadraticCurveTo(-14 * pulse, -14, 0, -14);
  ctx.quadraticCurveTo(14 * pulse, -14, 14 * pulse, 0);
  ctx.closePath(); ctx.fill();
  // 触须
  ctx.strokeStyle = 'rgba(255,200,90,0.9)';
  ctx.lineWidth = 1.6;
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 5, 0);
    ctx.quadraticCurveTo(i * 6, 12 + Math.sin(clock * 3 + i) * 3, i * 3, 22);
    ctx.stroke();
  }
  // 四角星闪光（与 HUD 的 ★ 样本计数同构，一眼读出「采集换星」）
  const sp = 8 + Math.sin(clock * 6) * 2;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -sp); ctx.quadraticCurveTo(2, -2, sp, 0); ctx.quadraticCurveTo(2, 2, 0, sp);
  ctx.quadraticCurveTo(-2, 2, -sp, 0); ctx.quadraticCurveTo(-2, -2, 0, -sp);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd84e';
  ctx.beginPath(); ctx.arc(0, -4, 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawOxygen(ctx, x, y, clock) {
  ctx.save();
  ctx.translate(x, y);
  const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
  halo.addColorStop(0, 'rgba(140,255,180,0.9)');
  halo.addColorStop(1, 'rgba(80,255,140,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(-9, 0, 9, 0);
  g.addColorStop(0, '#0e7a3a'); g.addColorStop(0.5, '#45e07e'); g.addColorStop(1, '#0e7a3a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 16, 0, 0, Math.PI * 2); ctx.fill();
  // 加号标记（不与 HUD 的氧气文字冲突）
  ctx.fillStyle = '#fff';
  ctx.font = '700 12px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('+', 0, 0);
  ctx.restore();
}

function drawChaser(ctx, c, clock, playerX) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(c.x < playerX ? 1 : -1, 1);
  // 深色鱼身
  const body = ctx.createLinearGradient(-20, 0, 20, 0);
  body.addColorStop(0, '#1c232c'); body.addColorStop(1, '#05070a');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
  // 大嘴锯齿
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(20, -6);
  for (let i = 0; i <= 5; i += 1) ctx.lineTo(20 - i * 3, (i % 2 === 0 ? -9 : -3));
  ctx.lineTo(20, 6); ctx.closePath(); ctx.fill();
  // 发光诱饵（鮟鱇）
  const lx = -26, ly = -22 + Math.sin(clock * 3) * 3;
  ctx.strokeStyle = '#9aa4b0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(lx, ly); ctx.stroke();
  const lure = ctx.createRadialGradient(lx, ly, 1, lx, ly, 12);
  lure.addColorStop(0, '#eaffff'); lure.addColorStop(1, 'rgba(120,255,220,0)');
  ctx.fillStyle = lure;
  ctx.beginPath(); ctx.arc(lx, ly, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#eaffff';
  ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
  // 眼睛
  ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(14, -3, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawVent(ctx, v, clock) {
  const P = PAL('twilight');
  const alpha = 0.25 + 0.15 * Math.sin(clock * 6 + v.x);
  ctx.fillStyle = `rgba(150,230,240,${alpha * 0.4})`;
  ctx.fillRect(v.x - v.w / 2, v.y - v.h, v.w, v.h);
  for (let i = 0; i < 10; i += 1) {
    const by = v.y - (i * 26 + (clock * 90) % 26);
    const bx = v.x + Math.sin(i * 2.4 + clock * 5) * (v.w * 0.3);
    ctx.fillStyle = `rgba(220,250,255,${0.3 + (i % 3) * 0.12})`;
    ctx.beginPath(); ctx.arc(bx, by, 2 + (i % 3) * 1.4, 0, Math.PI * 2); ctx.fill();
  }
}

// ---- 头灯 + 暗角 ----
function drawDarkness(ctx, state) {
  const P = PAL(state.scene);
  if (P.depth < 0.2) return;
  const p = state.player;
  const r = Math.max(120, state.lightRadius || 200);
  const g = ctx.createRadialGradient(p.x, p.y, r * 0.25, p.x, p.y, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,10,${P.depth})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  // 边缘硬暗角
  const edge = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT * 0.2);
  edge.addColorStop(0, `rgba(0,0,0,${P.depth * 0.9})`);
  edge.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edge; ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT * 0.2);
}

// ---- 布局（供 tutorial/verify 使用）----
function computeLayout(state) {
  return {
    play: { x: LAYOUT.PLAY_X0, y: LAYOUT.PLAY_Y0, w: LAYOUT.PLAY_X1 - LAYOUT.PLAY_X0, h: LAYOUT.PLAY_Y1 - LAYOUT.PLAY_Y0 },
    hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
    player: { x: state.player.x - 40, y: state.player.y - 30, w: 84, h: 60 },
  };
}

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
    return computeLayout(lastState);
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('sunlit'), 0, 0);
    // 标题屏：中置潜航器 + 头灯
    drawSub(ctx, WORLD.WIDTH / 2, 330, clock, false);
    const glow = ctx.createRadialGradient(WORLD.WIDTH / 2, 360, 20, WORLD.WIDTH / 2, 360, 320);
    glow.addColorStop(0, 'rgba(190,240,255,0.5)');
    glow.addColorStop(1, 'rgba(190,240,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 荧光样本点缀
    for (let i = 0; i < 7; i += 1) {
      drawSample(ctx, 220 + i * 150 + seededRand(i, 1, 9) * 40, 470 + seededRand(i, 2, 11) * 90, clock + i);
    }
  }

  function draw(state, dt, view) {
    if (!state) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(state.scene), 0, 0);

    // 环境粒子（气泡 / 荧光）
    drawAmbient(ctx, state, clock);

    // 头灯暗角（越深越暗）——先画暗角，样本/潜航器后画，保证生物荧光穿透黑暗
    drawDarkness(ctx, state);

    // 热泉
    for (const vt of state.vents) drawVent(ctx, vt, clock);

    // 障碍
    for (const o of state.obstacles) {
      if (o.kind === 'mine') drawMine(ctx, o.x, o.y, o.r);
      else drawRock(ctx, o.x, o.y, o.r, state.scene);
    }
    if (state.chaser) drawChaser(ctx, state.chaser, clock, state.player.x);

    // 样本 / 氧气（最亮可交互目标，画在暗角之上：生物荧光穿透黑暗）
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (pk.kind === 'sample') drawSample(ctx, pk.x, pk.y, clock);
      else drawOxygen(ctx, pk.x, pk.y, clock);
    }

    // 潜航器（最上层，最亮主体）
    drawSub(ctx, state.player.x, state.player.y, clock, state.modules && false);

    // 层切扫光 + 生物散开（签名瞬间）
    if (v.layerFlash && v.layerFlash > 0) {
      const a = Math.max(0, v.layerFlash);
      const p = state.player;
      const sweep = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 400 * (1.4 - a));
      sweep.addColorStop(0, `rgba(220,250,255,${a * 0.5})`);
      sweep.addColorStop(1, 'rgba(220,250,255,0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
    if (v.scatter && v.scatter.length) {
      ctx.fillStyle = 'rgba(140,255,220,0.8)';
      for (const sp of v.scatter) {
        ctx.globalAlpha = Math.max(0, sp.a);
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawAmbient(ctx, state, clock) {
    const P = PAL(state.scene);
    for (let i = 0; i < 26; i += 1) {
      const sp = (clock * (30 + (i % 5) * 14) + i * 137) % (WORLD.HEIGHT + 60);
      const x = seededRand(i, 1, 17) * WORLD.WIDTH;
      const y = WORLD.HEIGHT - sp;
      ctx.fillStyle = P.particle;
      ctx.beginPath(); ctx.arc(x, y, 1.2 + (i % 3) * 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  function __renderDemo(sceneKey) {
    const key = ['sunlit', 'twilight', 'abyss'].includes(sceneKey) ? sceneKey : 'sunlit';
    const fake = {
      scene: key,
      level: 1,
      depth: 0, depthTarget: 300,
      player: { x: 560, y: 360, r: 28 },
      obstacles: [
        { kind: 'rock', x: 600, y: 500, r: 56 },
        { kind: 'rock', x: 780, y: 620, r: 62 },
        { kind: 'mine', x: 420, y: 540, r: 24 },
      ],
      pickups: [
        { kind: 'sample', x: 420, y: 470, r: 22, taken: false },
        { kind: 'sample', x: 960, y: 560, r: 22, taken: false },
        { kind: 'oxygen', x: 780, y: 430, r: 20, taken: false },
      ],
      vents: [],
      chaser: null,
      lightRadius: 220,
      modules: {},
    };
    lastState = fake;
    draw(fake, 0, {});
  }

  if (typeof window !== 'undefined') {
    window.__renderDemo = __renderDemo;
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize, __renderDemo };
}
