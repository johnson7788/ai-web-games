// Sprout Hop · Canvas 2D 渲染：三场景菜园 / 平台（豆荚·南瓜·竹筐·断藤）/ 豌豆 / 蓄力藤蔓 / 轨迹弧线。
// 只消费 run.state（契约）+ view（fxQueue/shake/sceneKey/cursor）。
// 像素换算全部在此完成（sim 只给逻辑坐标）；平台屏幕位置经 camX + clock 摆动。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout() }。
import { WORLD, PHYS, ANCHOR, TOP0, WATER_Y } from '../../config/game.config.js';
import { platformScreenX, platformTopY, predictTrajectory, mulberry32 } from '../game/level.js';

const PEA_R = PHYS.PEA_R;

// ---------------- 三场景色板（换章必换，色板/构图/装饰互异）----------------
const SCENES = {
  dawn: {
    skyTop: '#CFF2E6', skyMid: '#A9E3C8', skyBot: '#8FD2B4',
    water: '#4FA6C9', waterDeep: '#2E7FA6',
    far: '#7CC69A', far2: '#5FAF84',
    sun: '#FFF3C0',
    name: 'dawn',
  },
  noon: {
    skyTop: '#FFEDB0', skyMid: '#F6D489', skyBot: '#E7B96A',
    water: '#3FA3B8', waterDeep: '#1E7E93',
    far: '#C98A4E', far2: '#A66C3C',
    sun: '#FFF6D8',
    name: 'noon',
  },
  night: {
    skyTop: '#1A2B4A', skyMid: '#232A55', skyBot: '#2A1E4A',
    water: '#1F4A6E', waterDeep: '#123552',
    far: '#26395E', far2: '#1C2C4A',
    sun: '#EAF3FF',
    name: 'night',
  },
};

function seededRand(r, c, seed = 7) {
  return mulberry32((r * 73856093) ^ (c * 19349663) ^ (seed * 83492791))();
}

// ---------------- 静态背景离屏缓存 ----------------
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(g, key) {
  const P = SCENES[key] || SCENES.dawn;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (key === 'night') {
    drawStars(g, W, H);
    drawMoon(g, W, H);
  } else {
    drawSun(g, W, H, P.sun, key === 'noon');
  }

  // 远景豆藤坡地
  g.fillStyle = P.far;
  g.beginPath();
  g.moveTo(0, H * 0.6);
  for (let i = 0; i <= 8; i += 1) {
    const x = (W / 8) * i;
    g.lineTo(x, H * 0.6 - Math.sin(i * 1.6 + 0.6) * 46 - 16);
  }
  g.lineTo(W, H * 0.62); g.lineTo(0, H * 0.62); g.closePath(); g.fill();

  g.fillStyle = P.far2;
  g.beginPath();
  g.moveTo(0, H * 0.7);
  for (let i = 0; i <= 9; i += 1) {
    const x = (W / 9) * i;
    g.lineTo(x, H * 0.7 - Math.sin(i * 2.0 + 2.0) * 30 - 10);
  }
  g.lineTo(W, H * 0.72); g.lineTo(0, H * 0.72); g.closePath(); g.fill();

  // 水面
  const water = g.createLinearGradient(0, WATER_Y, 0, H);
  water.addColorStop(0, P.water);
  water.addColorStop(1, P.waterDeep);
  g.fillStyle = water;
  g.fillRect(0, WATER_Y, W, H - WATER_Y);

  // 藤架装饰
  if (key === 'dawn') drawVines(g, W, H, '#3E8E57', 0.5);
  if (key === 'noon') drawTrellis(g, W, H);
  if (key === 'night') drawGlowPods(g, W, H);
}

function drawSun(g, W, H, color, noon) {
  const gx = noon ? W - 200 : 180;
  const gy = noon ? 150 : 150;
  const halo = g.createRadialGradient(gx, gy, 16, gx, gy, 260);
  halo.addColorStop(0, 'rgba(255,250,210,0.95)');
  halo.addColorStop(1, 'rgba(255,250,210,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);
  g.fillStyle = color;
  g.beginPath(); g.arc(gx, gy, 40, 0, Math.PI * 2); g.fill();
}

function drawStars(g, W, H) {
  for (let i = 0; i < 80; i += 1) {
    const x = seededRand(i, 1, 3) * W;
    const y = seededRand(i, 2, 5) * H * 0.55;
    const r = 0.6 + seededRand(i, 3, 7) * 1.3;
    g.fillStyle = `rgba(220,240,255,${0.35 + seededRand(i, 4, 9) * 0.6})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

function drawMoon(g, W, H) {
  const gx = W - 190, gy = 150, r = 40;
  const halo = g.createRadialGradient(gx, gy, r * 0.5, gx, gy, r * 2.6);
  halo.addColorStop(0, 'rgba(220,238,255,0.5)');
  halo.addColorStop(1, 'rgba(220,238,255,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(gx, gy, r * 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#EDF5FF';
  g.beginPath(); g.arc(gx, gy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(160,190,220,0.5)';
  g.beginPath(); g.arc(gx - 13, gy - 8, r * 0.22, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(gx + 10, gy + 12, r * 0.16, 0, Math.PI * 2); g.fill();
}

function drawVines(g, W, H, color, alpha) {
  g.strokeStyle = color;
  g.globalAlpha = alpha;
  g.lineWidth = 6;
  g.lineCap = 'round';
  for (let i = 0; i < 6; i += 1) {
    const x = 60 + i * 220 + seededRand(i, 5, 11) * 40;
    g.beginPath();
    g.moveTo(x, H);
    g.quadraticCurveTo(x + 30, H * 0.72, x + 12, H * 0.62);
    g.stroke();
    // 叶子
    g.fillStyle = color;
    for (let j = 0; j < 4; j += 1) {
      const yy = H * 0.62 + j * 40;
      g.beginPath(); g.ellipse(x + 12 + (j % 2 ? 16 : -16), yy, 14, 7, j % 2 ? 0.4 : -0.4, 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
}

function drawTrellis(g, W, H) {
  g.strokeStyle = 'rgba(120,86,48,0.5)';
  g.lineWidth = 7;
  for (let x = 0; x < W; x += 90) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WATER_Y); g.stroke();
  }
  for (let y = 120; y < WATER_Y; y += 90) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
}

function drawGlowPods(g, W, H) {
  for (let i = 0; i < 10; i += 1) {
    const x = 70 + i * 130;
    const y = 160 + seededRand(i, 9, 13) * 120;
    g.fillStyle = 'rgba(170,255,150,0.7)';
    g.beginPath(); g.ellipse(x, y, 5, 12, 0.5, 0, Math.PI * 2); g.fill();
  }
}

// ---------------- 平台绘制 ----------------
function drawPod(g, x, y, w) {
  const h = 26;
  const grad = g.createLinearGradient(x, y - h, x, y);
  grad.addColorStop(0, '#8FE08A');
  grad.addColorStop(1, '#4CAF50');
  g.fillStyle = grad;
  roundRect(g, x - w / 2, y - h, w, h, 13);
  g.fill();
  g.strokeStyle = '#2E7D32';
  g.lineWidth = 2.5;
  roundRect(g, x - w / 2, y - h, w, h, 13);
  g.stroke();
  // 豆荚缝 + 豆子鼓包
  g.strokeStyle = 'rgba(27,94,32,0.6)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(x - w / 2 + 8, y - h * 0.5); g.lineTo(x + w / 2 - 8, y - h * 0.5); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  for (let i = -2; i <= 2; i += 1) {
    g.beginPath(); g.arc(x + i * (w / 5), y - h * 0.62, 4.5, 0, Math.PI * 2); g.fill();
  }
}

function drawPumpkin(g, x, y, w) {
  const r = w * 0.42;
  const grad = g.createRadialGradient(x, y - r * 0.6, 4, x, y - r * 0.3, r * 1.3);
  grad.addColorStop(0, '#FFB84D');
  grad.addColorStop(1, '#E07A24');
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(x, y - r * 0.55, r, r * 0.78, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#B85C12';
  g.lineWidth = 2.5;
  g.stroke();
  // 南瓜棱
  g.strokeStyle = 'rgba(184,92,18,0.5)';
  g.lineWidth = 2;
  for (let i = -1; i <= 1; i += 1) {
    g.beginPath();
    g.moveTo(x + i * r * 0.4, y - r * 1.3);
    g.quadraticCurveTo(x + i * r * 0.55, y - r * 0.55, x + i * r * 0.4, y - r * 0.1);
    g.stroke();
  }
  // 瓜蒂
  g.strokeStyle = '#4E7A2E';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(x, y - r * 1.3); g.lineTo(x + 4, y - r * 1.5); g.stroke();
}

function drawBasket(g, x, y, w) {
  const h = 24;
  g.fillStyle = '#B98A4E';
  g.beginPath();
  g.moveTo(x - w / 2, y - h);
  g.lineTo(x + w / 2, y - h);
  g.lineTo(x + w / 2 - 6, y);
  g.lineTo(x - w / 2 + 6, y);
  g.closePath(); g.fill();
  g.strokeStyle = '#7A5226';
  g.lineWidth = 2.5;
  g.stroke();
  // 编织纹理
  g.strokeStyle = 'rgba(122,82,38,0.55)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 3; i += 1) {
    const yy = y - h + 6 + i * 6;
    g.beginPath(); g.moveTo(x - w / 2 + 4, yy); g.lineTo(x + w / 2 - 4, yy); g.stroke();
  }
}

function drawBroken(g, x, y, w, collapsed) {
  const h = 16;
  g.fillStyle = collapsed ? '#7A5A3A' : '#9A6B44';
  roundRect(g, x - w / 2, y - h, w, h, 5);
  g.fill();
  g.strokeStyle = '#5A3A22';
  g.lineWidth = 2;
  roundRect(g, x - w / 2, y - h, w, h, 5);
  g.stroke();
  // 裂纹
  g.strokeStyle = 'rgba(40,24,12,0.7)';
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x - w * 0.2, y - h); g.lineTo(x, y); g.lineTo(x + w * 0.25, y - h); g.stroke();
  if (collapsed) {
    g.fillStyle = 'rgba(40,24,12,0.25)';
    g.beginPath(); g.ellipse(x, y + 6, w * 0.4, 8, 0, 0, Math.PI * 2); g.fill();
  }
}

function drawPlatform(g, plat, cx, cy, clock) {
  const w = plat.w;
  switch (plat.kind) {
    case 'pumpkin': drawPumpkin(g, cx, cy, w); break;
    case 'basket': drawBasket(g, cx, cy, w); break;
    case 'broken': drawBroken(g, cx, cy, w, plat.broken); break;
    default: drawPod(g, cx, cy, w); break;
  }
  // 移动平台的摆动虚影（提示运动轨迹）
  if (plat.moving) {
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 2;
    g.setLineDash([5, 6]);
    g.beginPath();
    g.moveTo(cx - plat.amp - 4, cy - 8);
    g.lineTo(cx + plat.amp + 4, cy - 8);
    g.stroke();
    g.setLineDash([]);
  }
}

// ---------------- 豌豆角色 ----------------
function drawPea(g, x, y, opts = {}) {
  const r = PEA_R;
  const squash = opts.squash || 0;      // 蓄力压缩（0..1）
  const rot = opts.rot || 0;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const sy = 1 - squash * 0.28;
  const sx = 1 + squash * 0.22;
  g.scale(sx, sy);

  // 身体
  const grad = g.createRadialGradient(-r * 0.3, -r * 0.4, 3, 0, 0, r * 1.2);
  grad.addColorStop(0, '#B7F06A');
  grad.addColorStop(1, '#5EB847');
  g.fillStyle = grad;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2F7A2E';
  g.lineWidth = 2;
  g.stroke();

  // 头顶豆芽
  g.strokeStyle = '#4C9E3A';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, -r * 0.9); g.quadraticCurveTo(3, -r * 1.5, 0, -r * 1.9); g.stroke();
  g.fillStyle = '#7AD24B';
  g.beginPath(); g.ellipse(-6, -r * 1.8, 8, 4.5, -0.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(6, -r * 1.95, 8, 4.5, 0.5, 0, Math.PI * 2); g.fill();

  // 眼睛
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(-7, -3, 6, 0, Math.PI * 2); g.arc(7, -3, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#20331A';
  g.beginPath(); g.arc(-6, -2, 3, 0, Math.PI * 2); g.arc(8, -2, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(-5, -4, 1.2, 0, Math.PI * 2); g.arc(9, -4, 1.2, 0, Math.PI * 2); g.fill();

  // 腮红
  g.fillStyle = 'rgba(255,150,150,0.5)';
  g.beginPath(); g.arc(-12, 6, 3.4, 0, Math.PI * 2); g.arc(12, 6, 3.4, 0, Math.PI * 2); g.fill();

  // 嘴
  g.strokeStyle = '#2F5A22';
  g.lineWidth = 1.6;
  g.beginPath(); g.arc(0, 7, 4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();

  g.restore();
}

// ---------------- 蓄力藤蔓（签名：拖拽时藤蔓被拉弯）----------------
function drawVineSling(g, peaX, peaY, drag, power) {
  if (power <= 0.02) return;
  // 藤蔓从豌豆身后拉向「拖拽的反方向」（拖拽向后拉，藤蔓向后弯，蓄力朝前弹）
  const tx = peaX - drag.x;   // drag.x>0（朝前弹）→ 藤蔓向后（左）
  const ty = peaY - drag.y;   // drag.y<0（朝上弹）→ 藤蔓向下（后）
  g.strokeStyle = '#4C9E3A';
  g.lineWidth = 8;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(peaX, peaY);
  g.quadraticCurveTo(peaX - 20, peaY + 6, tx, ty);
  g.stroke();
  g.strokeStyle = '#7AD24B';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(peaX, peaY);
  g.quadraticCurveTo(peaX - 24, peaY + 3, tx, ty);
  g.stroke();
}

// ---------------- 轨迹弧线（核心手感）----------------
function drawTrajectory(g, traj) {
  const pts = traj && traj.pts;
  if (!pts || pts.length < 2) return;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 4;
  g.setLineDash([2, 10]);
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < pts.length; i += 1) {
    const { x, y } = pts[i];
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  g.setLineDash([]);
  // 预测落点圈（优先落台点，其次水面/出界）
  const end = (traj.land && { x: traj.land.x, y: traj.land.restY }) || pts[pts.length - 1];
  g.fillStyle = traj.land ? 'rgba(255,216,78,0.95)' : 'rgba(255,255,255,0.85)';
  g.beginPath(); g.arc(end.x, end.y, 7, 0, Math.PI * 2); g.fill();
  g.strokeStyle = traj.land ? '#FFD84E' : 'rgba(255,255,255,0.9)';
  g.lineWidth = 2.5;
  g.beginPath(); g.arc(end.x, end.y, 11, 0, Math.PI * 2); g.stroke();
}

// ---------------- 力度条 ----------------
function drawPowerBar(g, x, y, power) {
  const w = 130, h = 14;
  g.fillStyle = 'rgba(20,16,8,0.72)';
  roundRect(g, x - w / 2, y - h / 2, w, h, 7);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.4)';
  g.lineWidth = 1.5;
  roundRect(g, x - w / 2, y - h / 2, w, h, 7);
  g.stroke();
  const fw = (w - 6) * Math.max(0, Math.min(1, power));
  if (fw > 0) {
    const grad = g.createLinearGradient(x - w / 2 + 3, 0, x - w / 2 + 3 + w, 0);
    grad.addColorStop(0, '#9BE15D');
    grad.addColorStop(0.6, '#FFD84E');
    grad.addColorStop(1, '#FF7A3E');
    g.fillStyle = grad;
    roundRect(g, x - w / 2 + 3, y - h / 2 + 3, fw, h - 6, 5);
    g.fill();
  }
}

// ---------------- 水花 / 粒子 ----------------
function drawFx(g, fx) {
  if (!fx) return;
  const a = Math.max(0, Math.min(1, fx.ttl / fx.max));
  if (fx.type === 'podBurst') {
    g.fillStyle = `rgba(150,255,120,${a})`;
    for (let i = 0; i < 8; i += 1) {
      const ang = (i / 8) * Math.PI * 2 + (fx.seed || 0);
      const d = (1 - a) * 26 + 6;
      g.beginPath(); g.arc(fx.x + Math.cos(ang) * d, fx.y + Math.sin(ang) * d, 3.2, 0, Math.PI * 2); g.fill();
    }
  } else if (fx.type === 'splash') {
    g.fillStyle = `rgba(160,220,255,${a * 0.8})`;
    for (let i = 0; i < 6; i += 1) {
      const ang = -Math.PI - (i / 5) * Math.PI;
      const d = (1 - a) * 30 + 5;
      g.beginPath(); g.arc(fx.x + Math.cos(ang) * d, WATER_Y + Math.sin(ang) * d, 4, 0, Math.PI * 2); g.fill();
    }
  } else if (fx.type === 'ring') {
    g.strokeStyle = `rgba(255,216,120,${a})`;
    g.lineWidth = 3;
    g.beginPath(); g.arc(fx.x, fx.y, (1 - a) * 30 + 8, 0, Math.PI * 2); g.stroke();
  }
}

// ---------------- 目标旗帜（金色，一眼可见「要落到这里」）----------------
function drawFlag(g, cx, cy, s, clock) {
  const pulse = 0.5 + 0.5 * Math.sin(clock * 4);
  // 金色脉冲环
  g.strokeStyle = `rgba(255,216,78,${0.7 + 0.3 * pulse})`;
  g.lineWidth = 4;
  g.beginPath(); g.arc(cx, cy - 10 * s, 22 * s + 5 * pulse, 0, Math.PI * 2); g.stroke();
  // 旗杆
  g.strokeStyle = '#FFF6DE';
  g.lineWidth = 4 * s;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, cy + 4 * s); g.lineTo(cx, cy - 46 * s); g.stroke();
  // 旗面（格纹旗帜）
  g.fillStyle = '#FFB13C';
  g.beginPath();
  g.moveTo(cx, cy - 46 * s);
  g.lineTo(cx + 30 * s, cy - 39 * s);
  g.lineTo(cx, cy - 32 * s);
  g.closePath(); g.fill();
  g.fillStyle = '#E0562E';
  g.beginPath();
  g.moveTo(cx, cy - 39 * s);
  g.lineTo(cx + 30 * s, cy - 32 * s);
  g.lineTo(cx, cy - 25 * s);
  g.closePath(); g.fill();
}

// 下一平台目标标记：金色旗帜（即时目标）
function drawTargetMarker(g, cx, cy, clock) {
  drawFlag(g, cx, cy - 8, 1.0, clock);
}

// 终点平台标记：更大 + 「GOAL」文字
function drawGoalFlag(g, cx, cy, clock) {
  drawFlag(g, cx, cy - 14, 1.35, clock);
  g.font = '900 20px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(20,16,8,0.9)';
  g.strokeText('GOAL', cx, cy - 76);
  g.fillStyle = '#FFD84E';
  g.fillText('GOAL', cx, cy - 76);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;
  let lastLayout = null;

  function computeLayout(state) {
    if (!state) return null;
    const pea = { x: state.pea.x, y: state.pea.y, w: 60, h: 60 };
    const power = { x: ANCHOR.X, y: state.pea.y - 74, w: 150, h: 24 };
    const goalIdx = state.goalJumps; // 第 goalJumps 个平台是通关平台（0 基下标=goalJumps）
    const gp = state.platforms[Math.min(goalIdx, state.platforms.length - 1)];
    const gx = platformScreenX(gp, state.camX, state.clock);
    const gy = platformTopY(gp);
    const goal = { x: gx - 30, y: gy - 70, w: 60, h: 70 };
    return { pea, power, goal };
  }

  function debugLayout() {
    return lastLayout;
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('dawn'), 0, 0);
    drawPea(ctx, WORLD.WIDTH / 2, 470, { squash: 0.1 });
  }

  function draw(state, dt, view) {
    if (!state || !state.platforms) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.scene || v.sceneKey || 'dawn';
    clock += dt || 0;
    lastState = state;
    lastLayout = computeLayout(state);

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);

    // 水面波纹
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const y = WATER_Y + 14 + i * 22;
      ctx.beginPath();
      for (let x = 0; x <= WORLD.WIDTH; x += 16) {
        const yy = y + Math.sin(x * 0.02 + clock * 1.4 + i * 1.3) * 3;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // 平台
    const goalIdx = Math.min(state.goalJumps, state.platforms.length - 1);
    for (let i = 0; i < state.platforms.length; i += 1) {
      const plat = state.platforms[i];
      const sx = platformScreenX(plat, state.camX, state.clock);
      const sy = platformTopY(plat);
      if (sx < -200 || sx > WORLD.WIDTH + 200) continue;
      drawPlatform(ctx, plat, sx, sy, clock);
      if (i === goalIdx) drawGoalFlag(ctx, sx, sy, clock);
      if (i === state.cur + 1) drawTargetMarker(ctx, sx, sy, clock);
    }

    // 蓄力藤蔓（在豌豆身后）
    if (state.aiming.active && state.aiming.power > 0.02) {
      drawVineSling(ctx, state.pea.x, state.pea.y, state.aiming.drag, state.aiming.power);
      const traj = predictTrajectory(state, state.aiming.drag);
      drawTrajectory(ctx, traj);
      drawPowerBar(ctx, ANCHOR.X, state.pea.y - 74, state.aiming.power);
    }

    // 粒子特效
    if (v.fxQueue) {
      for (const fx of v.fxQueue) drawFx(ctx, fx);
    }

    // 豌豆
    const flying = state.phase === 'flying';
    const rot = flying ? Math.atan2(state.pea.vy, Math.max(40, state.pea.vx)) * 0.5 : 0;
    drawPea(ctx, state.pea.x, state.pea.y, {
      squash: state.aiming.active ? state.aiming.power : (flying ? 0 : 0),
      rot,
    });

    // 飞行轨迹残留（轻盈拖尾）
    if (flying) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 1; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.arc(state.pea.x - state.pea.vx * 0.02 * i, state.pea.y - state.pea.vy * 0.02 * i, PEA_R * (0.7 - i * 0.15), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  return { draw, debugLayout };
}
