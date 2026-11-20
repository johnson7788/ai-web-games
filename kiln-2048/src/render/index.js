// KILN 2048 · Canvas 2D 渲染：三大场景（晨光陶坊/暮色窑口/夜焰窑炉）+ 窑腔 + 釉球。
// 只消费 run.state + view（cursor/hammerMode/fxQueue/firePulse/shake）。
// 像素换算全部在此完成；sim 只给逻辑坐标。火光随场上最大数值升温变亮。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, KILN, LAYOUT } from '../../config/game.config.js';
import { glazeColor, glazeInk } from '../../config/glaze.js';

const SCENES = {
  'morning-workshop': {
    skyTop: '#FFF3D6', skyMid: '#F6D9A8', skyBot: '#E8BE8A',
    wall: '#8A5A3C', wallDark: '#6E4630', wallHi: '#A8744E',
    floor: '#B9875A', floorDark: '#96683F',
    chamber: '#3A2620', brick: '#5E3E2C',
    glow: 'rgba(255,190,120,',
    decor: 'morning',
  },
  'dusk-kiln': {
    skyTop: '#E8874A', skyMid: '#B95A4A', skyBot: '#5A3A5E',
    wall: '#6E4A3C', wallDark: '#57382E', wallHi: '#8A5E4A',
    floor: '#8A5A3A', floorDark: '#6E4530',
    chamber: '#2A1A1E', brick: '#4A2E28',
    glow: 'rgba(255,150,70,',
    decor: 'dusk',
  },
  'night-fire': {
    skyTop: '#0E1B2A', skyMid: '#14263A', skyBot: '#0B1420',
    wall: '#26364A', wallDark: '#1B2836', wallHi: '#38506A',
    floor: '#1C2A38', floorDark: '#14202C',
    chamber: '#0A0E14', brick: '#26364A',
    glow: 'rgba(255,120,40,',
    decor: 'night',
  },
};

// ---- 静态背景离屏缓存（每帧只 drawImage 一次；火光单独动态叠加） ----
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
  const P = SCENES[sceneKey] || SCENES['morning-workshop'];
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (P.decor === 'morning') {
    drawMorning(g, W, H);
  } else if (P.decor === 'dusk') {
    drawDusk(g, W, H);
  } else {
    drawNight(g, W, H);
  }

  drawKilnFrame(g, P, W, H);
}

function sun(g, x, y, r, color) {
  const halo = g.createRadialGradient(x, y, r * 0.4, x, y, r * 3.2);
  halo.addColorStop(0, color);
  halo.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r * 0.55, 0, Math.PI * 2);
  g.fill();
}

function drawMorning(g, W, H) {
  sun(g, 170, 150, 46, 'rgba(255,236,190,0.9)');
  // 远处的山/墙剪影
  g.fillStyle = 'rgba(120,84,56,0.55)';
  g.beginPath();
  g.moveTo(0, H * 0.6);
  for (let i = 0; i <= 8; i += 1) {
    const x = (W / 8) * i;
    g.lineTo(x, H * 0.6 - Math.sin(i * 1.5 + 0.4) * 60 - 20);
  }
  g.lineTo(W, H * 0.6 + 40);
  g.lineTo(0, H * 0.6 + 40);
  g.closePath();
  g.fill();
}

function drawDusk(g, W, H) {
  sun(g, W - 200, 190, 50, 'rgba(255,150,70,0.85)');
  g.fillStyle = 'rgba(70,40,70,0.6)';
  for (let i = 0; i < 4; i += 1) {
    const x = 240 + i * 270;
    const w = 90;
    const h = 220 + i * 30;
    g.beginPath();
    g.moveTo(x, H);
    g.lineTo(x, H - h);
    g.lineTo(x + w, H - h + 30);
    g.lineTo(x + w, H);
    g.closePath();
    g.fill();
  }
}

function drawNight(g, W, H) {
  for (let i = 0; i < 80; i += 1) {
    const x = (i * 97) % W;
    const y = (i * 53) % (H * 0.55);
    const a = 0.3 + ((i * 13) % 10) / 15;
    g.fillStyle = `rgba(220,235,255,${a.toFixed(2)})`;
    g.fillRect(x, y, 2, 2);
  }
  // 月亮
  g.fillStyle = 'rgba(220,235,250,0.9)';
  g.beginPath();
  g.arc(W - 170, 120, 34, 0, Math.PI * 2);
  g.fill();
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

function drawKilnFrame(g, P, W, H) {
  const x0 = KILN.LEFT - 34;
  const x1 = KILN.RIGHT + 34;
  const y0 = KILN.FAIL_LINE_Y - 30;
  const y1 = KILN.FLOOR_Y + 30;

  // 窑腔内部（暗）
  g.fillStyle = P.chamber;
  roundRect(g, x0 + 16, y0 + 16, x1 - x0 - 32, y1 - y0 - 32, 22);
  g.fill();

  // 砖墙外框
  const brickGrad = g.createLinearGradient(0, y0, 0, y1);
  brickGrad.addColorStop(0, P.wallHi);
  brickGrad.addColorStop(1, P.wallDark);
  g.fillStyle = brickGrad;
  roundRect(g, x0, y0, x1 - x0, y1 - y0, 26);
  g.fill();
  // 内切出窑腔洞口
  g.fillStyle = P.chamber;
  roundRect(g, x0 + 16, y0 + 16, x1 - x0 - 32, y1 - y0 - 32, 20);
  g.fill();

  // 砖缝
  g.strokeStyle = P.brick;
  g.lineWidth = 2;
  for (let yy = y0 + 22; yy < y1; yy += 22) {
    g.beginPath();
    g.moveTo(x0 + 6, yy);
    g.lineTo(x1 - 6, yy);
    g.stroke();
  }
  // 窑底
  g.fillStyle = P.floor;
  g.fillRect(x0, KILN.FLOOR_Y, x1 - x0, y1 - KILN.FLOOR_Y);
  g.fillStyle = P.floorDark;
  g.fillRect(x0, KILN.FLOOR_Y, x1 - x0, 6);
}

// ---- 窑腔几何（render 计算，sim 不依赖像素）----
function chamberRect(state) {
  const k = state.kiln || KILN;
  return {
    left: k.left,
    right: k.right,
    floorY: k.floorY,
    failLineY: k.failLineY,
    spawnY: k.spawnY,
    w: k.right - k.left,
  };
}

// ---- 火光（随场上最大数值升温变亮）----
function fireGlowAmount(state) {
  const t = Math.max(0, Math.min(1, (Math.log2(Math.max(2, state.maxValue)) - 1) / 10));
  return t;
}

function drawFireGlow(g, sceneKey, state) {
  const P = SCENES[sceneKey] || SCENES['morning-workshop'];
  const k = state.kiln || KILN;
  const t = fireGlowAmount(state);
  const cx = (k.left + k.right) / 2;
  const cy = k.floorY + 20;
  const r = 180 + t * 320;
  const a = 0.16 + t * 0.5;
  const grad = g.createRadialGradient(cx, cy, 10, cx, cy, r);
  grad.addColorStop(0, `${P.glow}${(a).toFixed(3)})`);
  grad.addColorStop(1, `${P.glow}0)`);
  g.fillStyle = grad;
  g.fillRect(k.left - 40, k.failLineY - 30, k.right - k.left + 80, k.floorY - k.failLineY + 60);
}

// ---- 球 ----
function drawBall(g, b, sceneKey, opts = {}) {
  const color = glazeColor(b.value);
  const ink = glazeInk(b.value);
  const x = b.x;
  const y = b.y;
  const r = b.r;

  // 球体径向渐变
  const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  grad.addColorStop(0, lighten(color, 0.35));
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, darken(color, 0.3));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();

  // 描边
  g.strokeStyle = darken(color, 0.45);
  g.lineWidth = Math.max(1.5, r * 0.07);
  g.stroke();

  // 高光
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.beginPath();
  g.ellipse(x - r * 0.32, y - r * 0.42, r * 0.3, r * 0.18, -0.6, 0, Math.PI * 2);
  g.fill();

  // 数值
  const digits = String(b.value).length;
  const fs = r * (digits >= 4 ? 0.5 : digits === 3 ? 0.66 : 0.88);
  g.font = `800 ${Math.max(11, fs)}px 'PingFang SC', 'Segoe UI', sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = Math.max(2, fs * 0.16);
  g.strokeStyle = 'rgba(20,14,8,0.55)';
  g.strokeText(String(b.value), x, y + 1);
  g.fillStyle = ink;
  g.fillText(String(b.value), x, y + 1);

  // 冰冻球：冰层 + 霜圈
  if (b.frozen) {
    g.fillStyle = 'rgba(200,235,255,0.42)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(235,248,255,0.85)';
    g.lineWidth = Math.max(2, r * 0.09);
    g.setLineDash([r * 0.28, r * 0.22]);
    g.beginPath();
    g.arc(x, y, r + Math.max(2, r * 0.1), 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = `700 ${Math.max(10, r * 0.4)}px sans-serif`;
    g.fillText('❄', x, y - r * 0.55);
  }

  // 双色釉：相位环（异色才能合）
  if (opts.dualGlaze) {
    const ring = b.phase === 0 ? '#FFD479' : '#6FD8E8';
    g.strokeStyle = ring;
    g.lineWidth = Math.max(2, r * 0.08);
    g.beginPath();
    g.arc(x, y, r + Math.max(3, r * 0.16), 0, Math.PI * 2);
    g.stroke();
  }
}

function lighten(hex, amt) {
  const c = hexToRgb(hex);
  return `rgb(${Math.round(c.r + (255 - c.r) * amt)},${Math.round(c.g + (255 - c.g) * amt)},${Math.round(c.b + (255 - c.b) * amt)})`;
}
function darken(hex, amt) {
  const c = hexToRgb(hex);
  return `rgb(${Math.round(c.r * (1 - amt))},${Math.round(c.g * (1 - amt))},${Math.round(c.b * (1 - amt))})`;
}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) || 200,
    g: parseInt(h.slice(2, 4), 16) || 200,
    b: parseInt(h.slice(4, 6), 16) || 200,
  };
}

// ---- 失败线 ----
function drawFailLine(g, state) {
  const k = state.kiln || KILN;
  g.save();
  // 危险区淡红提示（失败线上方 = 不可越线）
  const dz = g.createLinearGradient(0, k.failLineY - 26, 0, k.failLineY);
  dz.addColorStop(0, 'rgba(255,80,60,0)');
  dz.addColorStop(1, 'rgba(255,80,60,0.16)');
  g.fillStyle = dz;
  g.fillRect(k.left, k.failLineY - 26, k.right - k.left, 26);
  // 虚线
  g.strokeStyle = 'rgba(255,120,90,0.9)';
  g.lineWidth = 3;
  g.setLineDash([14, 10]);
  g.beginPath();
  g.moveTo(k.left, k.failLineY);
  g.lineTo(k.right, k.failLineY);
  g.stroke();
  g.setLineDash([]);
  // ⚠ 标记（无歧义的「危险线」图标）
  g.fillStyle = '#FF9A80';
  g.font = '700 16px sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('⚠', k.left + 6, k.failLineY - 11);
  g.restore();
}

// ---- 粒子 / 特效 ----
function drawFx(g, view) {
  if (!view) return;
  if (view.firePulse > 0) {
    const a = view.firePulse;
    const grad = g.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT * 0.6, 40, WORLD.WIDTH / 2, WORLD.HEIGHT * 0.6, WORLD.WIDTH * 0.75);
    grad.addColorStop(0, `rgba(255,214,120,${(0.5 * a).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }
  for (const fx of view.fxQueue || []) {
    if (fx.ttl <= 0) continue;
    const k = fx.ttl / fx.maxTtl;
    if (fx.type === 'merge') {
      g.strokeStyle = `rgba(255,224,140,${(0.9 * k).toFixed(3)})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(fx.x, fx.y, fx.r * (1.6 - k * 0.6), 0, Math.PI * 2);
      g.stroke();
    } else if (fx.type === 'eliminate') {
      g.fillStyle = `rgba(140,230,245,${(0.8 * k).toFixed(3)})`;
      g.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const px = fx.x + Math.cos(a) * fx.r * (1.3 - k * 0.3);
        const py = fx.y + Math.sin(a) * fx.r * (1.3 - k * 0.3);
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
    } else if (fx.type === 'hammer' || fx.type === 'thaw') {
      g.fillStyle = `rgba(220,220,240,${(0.8 * k).toFixed(3)})`;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + fx.seed;
        const px = fx.x + Math.cos(a) * fx.r * (0.4 + k * 1.2);
        const py = fx.y + Math.sin(a) * fx.r * (0.4 + k * 1.2);
        g.beginPath();
        g.arc(px, py, 3 + 3 * k, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
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
    const k = lastState.kiln || KILN;
    return {
      chamber: { x: k.left, y: k.failLineY, w: k.right - k.left, h: k.floorY - k.failLineY },
      failLine: { x: k.left, y: k.failLineY, w: k.right - k.left, h: 4 },
      spawn: { x: k.left, y: k.spawnY, w: k.right - k.left, h: 56 },
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
      queue: { x: WORLD.WIDTH - 150, y: 60, w: 130, h: 200 },
      cell: 1,
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('morning-workshop'), 0, 0);
    const P = SCENES['morning-workshop'];
    drawFireGlow(ctx, 'morning-workshop', { kiln: KILN, maxValue: 128 });
    // 标题屏也放两枚釉球示意
    drawBall(ctx, { x: WORLD.WIDTH / 2 - 70, y: 470, r: 40, value: 64, frozen: false, phase: 0 }, 'morning-workshop');
    drawBall(ctx, { x: WORLD.WIDTH / 2 + 70, y: 470, r: 40, value: 64, frozen: false, phase: 1 }, 'morning-workshop');
  }

  function draw(state, dt, view) {
    if (!state || !state.balls) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.sceneKey || 'morning-workshop';
    clock += dt || 0;
    lastState = state;

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);
    drawFireGlow(ctx, sceneKey, state);
    drawFailLine(ctx, state);

    const dualGlaze = !!state.features.dualGlaze;
    for (const b of state.balls) {
      drawBall(ctx, b, sceneKey, { dualGlaze });
    }

    // 持球 + 投放引导线
    if (state.held) {
      const h = state.held;
      const k = state.kiln || KILN;
      // 引导虚线
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(h.x, h.y + h.r);
      ctx.lineTo(h.x, k.floorY - h.r);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // 投球点高亮光晕
      const glow = ctx.createRadialGradient(h.x, h.y, h.r * 0.5, h.x, h.y, h.r * 2.2);
      glow.addColorStop(0, 'rgba(255,240,180,0.5)');
      glow.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      drawBall(ctx, h, sceneKey, { dualGlaze });
      // NEXT 标签 + 向下箭头（明确「这是下一个要投放的球」）
      ctx.fillStyle = 'rgba(20,14,8,0.72)';
      roundRect(ctx, h.x - 27, h.y - h.r - 32, 54, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#FFE9B4';
      ctx.font = "800 12px 'PingFang SC', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NEXT', h.x, h.y - h.r - 21);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.moveTo(h.x - 8, h.y + h.r + 6);
      ctx.lineTo(h.x + 8, h.y + h.r + 6);
      ctx.lineTo(h.x, h.y + h.r + 16);
      ctx.closePath();
      ctx.fill();
      if (v.hammerMode) {
        ctx.strokeStyle = 'rgba(255,120,90,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawFx(ctx, v);

    ctx.restore();
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize };
}
