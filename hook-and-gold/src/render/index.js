// Hook & Gold · Canvas 2D 渲染：三大场景（浅礁碧海/深蓝沉船/夜海月光）、
// 打捞船、机械锚爪、沉船物件、气泡、爆炸、洋流。像素换算全部在此完成。
// 契约：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize() }。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const P = LAYOUT.PIVOT;

const SCENES = {
  'shallow-reef': {
    skyTop: '#BFEFFF', skyBot: '#3FB7D6',
    waterTop: 'rgba(90,205,225,0.9)', waterBot: 'rgba(24,120,150,0.96)',
    seabed: '#E8D9A8', seabedDark: '#C9B07A',
    deco: '#2E9E8A', light: 'rgba(255,255,220,0.5)',
    rays: true, dark: false, biolume: false, stars: false,
  },
  'deep-blue': {
    skyTop: '#1E5A80', skyBot: '#0C2B45',
    waterTop: 'rgba(28,84,120,0.92)', waterBot: 'rgba(5,22,42,0.98)',
    seabed: '#1A3350', seabedDark: '#10233A',
    deco: '#0E2E40', light: 'rgba(150,220,255,0.35)',
    rays: true, dark: true, biolume: false, stars: false,
  },
  'night-sea': {
    skyTop: '#071B2E', skyBot: '#020810',
    waterTop: 'rgba(8,26,46,0.94)', waterBot: 'rgba(2,8,16,0.99)',
    seabed: '#0A1E30', seabedDark: '#06121F',
    deco: '#071523', light: 'rgba(200,230,255,0.3)',
    rays: false, dark: true, biolume: true, stars: true,
  },
};

function hashRand(a, b, seed = 0) {
  let x = Math.sin(a * 12.9898 + b * 78.233 + seed * 7.13) * 43758.5453;
  return x - Math.floor(x);
}

// ---- 背景缓存（每场景离屏画一次）----
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

function drawBackground(g, key) {
  const S = SCENES[key] || SCENES['shallow-reef'];
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  // 天空
  const sky = g.createLinearGradient(0, 0, 0, LAYOUT.SURFACE_Y);
  sky.addColorStop(0, S.skyTop);
  sky.addColorStop(1, S.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, LAYOUT.SURFACE_Y);
  // 月亮/星光（夜海）
  if (S.stars) drawMoonAndStars(g, S);
  // 海水
  const sea = g.createLinearGradient(0, LAYOUT.SURFACE_Y, 0, H);
  sea.addColorStop(0, S.waterTop);
  sea.addColorStop(1, S.waterBot);
  g.fillStyle = sea;
  g.fillRect(0, LAYOUT.SURFACE_Y, W, H - LAYOUT.SURFACE_Y);
  // 光线
  if (S.rays) drawLightRays(g, S);
  // 海床
  const bedY = H * 0.86;
  const bed = g.createLinearGradient(0, bedY, 0, H);
  bed.addColorStop(0, S.seabed);
  bed.addColorStop(1, S.seabedDark);
  g.fillStyle = bed;
  g.beginPath();
  g.moveTo(0, bedY);
  for (let i = 0; i <= 8; i += 1) {
    const x = (W / 8) * i;
    g.lineTo(x, bedY + Math.sin(i * 1.9 + 0.6) * 26 + 6);
  }
  g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  // 海底装饰
  if (key === 'shallow-reef') drawCoral(g, S);
  if (key === 'deep-blue') drawShipwreck(g, S);
  if (key === 'night-sea') drawNightRocks(g, S);
  if (S.biolume) drawBiolume(g);
}

function drawMoonAndStars(g, S) {
  for (let i = 0; i < 70; i += 1) {
    const x = hashRand(i, 1) * WORLD.WIDTH;
    const y = hashRand(i, 2) * LAYOUT.SURFACE_Y * 0.85;
    g.fillStyle = `rgba(210,235,255,${0.25 + hashRand(i, 3) * 0.6})`;
    g.beginPath(); g.arc(x, y, 0.6 + hashRand(i, 4) * 1.2, 0, Math.PI * 2); g.fill();
  }
  const mx = WORLD.WIDTH - 190, my = 86;
  const halo = g.createRadialGradient(mx, my, 10, mx, my, 120);
  halo.addColorStop(0, 'rgba(230,245,255,0.6)');
  halo.addColorStop(1, 'rgba(230,245,255,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(mx, my, 120, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#EAF5FF';
  g.beginPath(); g.arc(mx, my, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(150,180,210,0.5)';
  g.beginPath(); g.arc(mx - 9, my - 6, 7, 0, Math.PI * 2); g.arc(mx + 7, my + 8, 5, 0, Math.PI * 2); g.fill();
}

function drawLightRays(g, S) {
  for (let i = 0; i < 5; i += 1) {
    const x = 150 + i * 240;
    g.fillStyle = S.light;
    g.beginPath();
    g.moveTo(x, LAYOUT.SURFACE_Y);
    g.lineTo(x + 34, LAYOUT.SURFACE_Y);
    g.lineTo(x + 130, WORLD.HEIGHT);
    g.lineTo(x - 60, WORLD.HEIGHT);
    g.closePath();
    g.fill();
  }
}

function drawCoral(g, S) {
  g.strokeStyle = S.deco; g.lineWidth = 7; g.lineCap = 'round';
  for (let i = 0; i < 9; i += 1) {
    const x = 60 + i * 140 + hashRand(i, 9) * 60;
    const y = WORLD.HEIGHT - 40 - hashRand(i, 3) * 40;
    g.beginPath(); g.moveTo(x, WORLD.HEIGHT);
    g.quadraticCurveTo(x - 12, y + 40, x, y);
    g.stroke();
    g.fillStyle = '#E8709A';
    for (let b = 0; b < 3; b += 1) {
      g.beginPath(); g.arc(x + (b - 1) * 14, y - 6, 7, 0, Math.PI * 2); g.fill();
    }
  }
}

function drawShipwreck(g, S) {
  g.fillStyle = 'rgba(6,14,24,0.75)';
  g.beginPath();
  g.moveTo(120, WORLD.HEIGHT); g.lineTo(150, WORLD.HEIGHT - 150); g.lineTo(330, WORLD.HEIGHT - 180);
  g.lineTo(360, WORLD.HEIGHT); g.closePath(); g.fill();
  g.fillStyle = S.deco;
  g.fillRect(150, WORLD.HEIGHT - 150, 14, 150);
  g.fillRect(320, WORLD.HEIGHT - 180, 14, 180);
  // 舷窗
  g.fillStyle = 'rgba(150,220,255,0.35)';
  for (let i = 0; i < 4; i += 1) {
    g.beginPath(); g.arc(210 + i * 34, WORLD.HEIGHT - 120 - i * 12, 9, 0, Math.PI * 2); g.fill();
  }
}

function drawNightRocks(g, S) {
  g.fillStyle = S.deco;
  for (let i = 0; i < 6; i += 1) {
    const x = 100 + i * 220 + hashRand(i, 7) * 70;
    const h = 70 + hashRand(i, 5) * 90;
    g.beginPath();
    g.moveTo(x, WORLD.HEIGHT); g.lineTo(x + 60, WORLD.HEIGHT - h); g.lineTo(x + 120, WORLD.HEIGHT); g.closePath(); g.fill();
  }
}

function drawBiolume(g) {
  for (let i = 0; i < 24; i += 1) {
    const x = hashRand(i, 11) * WORLD.WIDTH;
    const y = LAYOUT.SURFACE_Y + 40 + hashRand(i, 13) * (WORLD.HEIGHT - LAYOUT.SURFACE_Y - 80);
    g.fillStyle = `rgba(150,255,210,${0.3 + hashRand(i, 17) * 0.4})`;
    g.beginPath(); g.arc(x, y, 2 + hashRand(i, 19) * 2.5, 0, Math.PI * 2); g.fill();
  }
}

// ---- 物件绘制 ----
function drawObject(g, o, sceneKey, clock) {
  const S = SCENES[sceneKey] || SCENES['shallow-reef'];
  const night = S.dark;
  const x = o.x, y = o.y, r = o.r;

  if (night) {
    // 半影：先画一层深色剪影，再在表面叠微弱高光
    g.globalAlpha = 0.9;
  }

  switch (o.type) {
    case 'GOLD_INGOT': {
      const grad = g.createLinearGradient(x - r, y - r, x + r, y + r);
      grad.addColorStop(0, '#FFE08A'); grad.addColorStop(0.5, '#FFC53D'); grad.addColorStop(1, '#C98A14');
      g.fillStyle = grad;
      roundRect(g, x - r, y - r * 0.7, r * 2, r * 1.4, r * 0.22); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
      roundRect(g, x - r * 0.6, y - r * 0.42, r * 1.2, r * 0.5, r * 0.16); g.stroke();
      break;
    }
    case 'SILVER_BAR': {
      const grad = g.createLinearGradient(x - r, y - r, x + r, y + r);
      grad.addColorStop(0, '#EAF2F5'); grad.addColorStop(0.5, '#B9C8CF'); grad.addColorStop(1, '#8A9AA3');
      g.fillStyle = grad;
      roundRect(g, x - r, y - r * 0.55, r * 2, r * 1.1, r * 0.3); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      roundRect(g, x - r * 0.55, y - r * 0.32, r * 1.1, r * 0.36, r * 0.16); g.fill();
      break;
    }
    case 'ANTIQUE_VASE': {
      g.fillStyle = night ? '#B06A3A' : '#C97A44';
      g.beginPath();
      g.moveTo(x - r * 0.7, y - r);
      g.quadraticCurveTo(x - r, y, x - r * 0.5, y + r);
      g.lineTo(x + r * 0.5, y + r);
      g.quadraticCurveTo(x + r, y, x + r * 0.7, y - r);
      g.lineTo(x - r * 0.7, y - r);
      g.fill();
      g.strokeStyle = '#7A4A24'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#F0D9A0';
      g.fillRect(x - r * 0.12, y - r * 0.7, r * 0.24, r * 0.3);
      break;
    }
    case 'DUMBBELL': {
      g.fillStyle = '#8A9199';
      roundRect(g, x - r, y - r * 0.22, r * 2, r * 0.44, r * 0.2); g.fill();
      g.fillStyle = '#6A7178';
      g.beginPath(); g.arc(x - r * 0.82, y, r * 0.42, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + r * 0.82, y, r * 0.42, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.beginPath(); g.arc(x - r * 0.82, y - r * 0.14, r * 0.16, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'PEARL_SHELL': {
      const open = o.clamOpen !== false;
      const cx = x, cy = y;
      if (open) {
        g.fillStyle = '#7A5A3A';
        g.beginPath(); g.ellipse(cx - r * 0.55, cy - r * 0.25, r * 0.62, r * 0.5, -0.5, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(cx + r * 0.55, cy - r * 0.25, r * 0.62, r * 0.5, 0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#E9C9D8';
        g.beginPath(); g.ellipse(cx - r * 0.5, cy - r * 0.3, r * 0.45, r * 0.34, -0.5, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(cx + r * 0.5, cy - r * 0.3, r * 0.45, r * 0.34, 0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#FFF3F7';
        g.beginPath(); g.arc(cx, cy - r * 0.42, r * 0.28, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = '#6A4A30';
        g.beginPath(); g.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#4A3420'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(cx - r, cy); g.quadraticCurveTo(cx, cy - r * 0.3, cx + r, cy); g.stroke();
      }
      break;
    }
    case 'JELLYFISH': {
      const bob = Math.sin((clock || 0) * 3 + o.driftPhase) * 3;
      const jy = y + bob;
      const grad = g.createRadialGradient(x, jy - r * 0.3, 2, x, jy - r * 0.3, r);
      grad.addColorStop(0, 'rgba(255,180,220,0.95)');
      grad.addColorStop(1, 'rgba(255,120,190,0.55)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, jy - r * 0.3, r * 0.85, Math.PI, 0); g.fill();
      g.strokeStyle = 'rgba(255,150,200,0.7)'; g.lineWidth = 2.5;
      for (let t = 0; t < 5; t += 1) {
        const tx = x - r * 0.7 + t * r * 0.35;
        g.beginPath(); g.moveTo(tx, jy - r * 0.3);
        g.quadraticCurveTo(tx + Math.sin(clock * 5 + t) * 5, jy + r * 0.5, tx + Math.sin(clock * 4 + t) * 8, jy + r * 0.9);
        g.stroke();
      }
      break;
    }
    case 'DYNAMITE': {
      g.fillStyle = '#D8483A';
      roundRect(g, x - r * 0.5, y - r, r, r * 2, r * 0.18); g.fill();
      g.fillStyle = '#B03026';
      g.fillRect(x - r * 0.5, y - r, r, r * 0.36);
      g.fillStyle = '#F5E6C0';
      g.fillRect(x - r * 0.5, y - r * 0.3, r, r * 0.24);
      // 引信火花
      const spark = o.fuseAt != null || (Math.sin((clock || 0) * 12) > 0.2);
      g.strokeStyle = '#5A4A2A'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.1, y - r * 1.35); g.stroke();
      if (spark) {
        g.fillStyle = '#FFE45C';
        g.beginPath(); g.arc(x + r * 0.1, y - r * 1.4, 6 + Math.sin((clock || 0) * 20) * 2, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case 'BLACK_PEARL': {
      const grad = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 2, x, y, r);
      grad.addColorStop(0, '#5A5A78');
      grad.addColorStop(0.5, '#23233A');
      grad.addColorStop(1, '#0A0A18');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(220,230,255,0.9)';
      g.beginPath(); g.arc(x - r * 0.35, y - r * 0.4, r * 0.22, 0, Math.PI * 2); g.fill();
      break;
    }
    default: break;
  }
  g.globalAlpha = 1;
}

// ---- 打捞船 ----
function drawBoat(g, weight, clock) {
  const tilt = Math.min(0.07, (weight / 600) * 0.07) * Math.sin((clock || 0) * 2.2 + 0.5);
  g.save();
  g.translate(WORLD.WIDTH / 2, 78);
  g.rotate(tilt);
  // 船体
  const hull = g.createLinearGradient(0, -40, 0, 30);
  hull.addColorStop(0, '#6A4430');
  hull.addColorStop(1, '#3A2418');
  g.fillStyle = hull;
  g.beginPath();
  g.moveTo(-110, 8);
  g.lineTo(-96, 34); g.lineTo(96, 34); g.lineTo(110, 8);
  g.quadraticCurveTo(0, -8, -110, 8);
  g.closePath(); g.fill();
  g.strokeStyle = '#2A180E'; g.lineWidth = 4; g.stroke();
  // 甲板舱室
  g.fillStyle = '#8A5A38';
  roundRect(g, -34, -22, 68, 34, 6); g.fill();
  g.fillStyle = '#2E9E8A';
  roundRect(g, -16, -14, 32, 20, 4); g.fill();
  // 起重机吊臂（锚爪绳从这里垂下）
  g.strokeStyle = '#5A3A24'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(40, -20); g.lineTo(70, -54); g.stroke();
  g.strokeStyle = '#3A2418'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(70, -54); g.lineTo(0, 34); g.stroke();
  // 探照灯
  g.fillStyle = '#FFE45C';
  g.beginPath(); g.arc(-66, -6, 7, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ---- 绳 + 锚爪 ----
function drawClaw(g, head, angleDeg, clock) {
  const a = angleDeg * Math.PI / 180;
  // 绳
  g.strokeStyle = 'rgba(30,20,12,0.85)';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(P.x, P.y); g.lineTo(head.x, head.y); g.stroke();

  g.save();
  g.translate(head.x, head.y);
  g.rotate(a);
  // 爪座
  g.fillStyle = '#4A4A58';
  g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2E2E38'; g.lineWidth = 3; g.stroke();
  // 三爪
  const spread = 0.55;
  for (const k of [-1, 0, 1]) {
    const aa = k * spread + Math.PI * 0.5;
    g.strokeStyle = '#8A8A9A'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(Math.cos(aa) * 16, Math.sin(aa) * 16, Math.cos(aa) * 30, Math.sin(aa) * 30);
    g.stroke();
  }
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---- 渲染器 ----
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
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
      field: { x: LAYOUT.FIELD.x0, y: LAYOUT.FIELD.y0, w: LAYOUT.FIELD.x1 - LAYOUT.FIELD.x0, h: LAYOUT.FIELD.y1 - LAYOUT.FIELD.y0 },
      pivot: { x: P.x - 60, y: P.y - 40, w: 120, h: 80 },
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('shallow-reef'), 0, 0);
    // 标题屏也放船 + 一条安静摆动的绳，暗示玩法
    const a = Math.sin(clock * 1.4) * GAME.ROTATE_RANGE_DEG;
    const head = { x: P.x + Math.sin(a * Math.PI / 180) * GAME.IDLE_LEN, y: P.y + Math.cos(a * Math.PI / 180) * GAME.IDLE_LEN };
    drawBoat(ctx, 0, clock);
    drawClaw(ctx, head, a, clock);
    drawFloatHint(ctx);
  }

  function drawFloatHint(g) {
    const bob = Math.sin(clock * 2) * 6;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = '700 20px sans-serif';
    g.textAlign = 'center';
    g.fillText('▼', P.x, LAYOUT.SURFACE_Y + 60 + bob);
  }

  function draw(state, dt, view) {
    if (!state || !state.objects) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;
    const sceneKey = state.scene || 'shallow-reef';
    const hook = state.hook;

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);
    drawCurrentStreaks(ctx, sceneKey, state, clock);

    // 物件
    for (const o of state.objects) {
      if (!o.alive) continue;
      if (state.hook.hooked.includes(o.id)) continue; // 钩住物件画在爪头
      drawObject(ctx, o, sceneKey, clock);
    }

    // 钩住的物件（跟随爪头）
    for (const id of state.hook.hooked) {
      const o = state.objects.find((x) => x.id === id);
      if (o) drawObject(ctx, o, sceneKey, clock);
    }

    // 绳 + 锚爪
    const head = {
      x: P.x + Math.sin(hook.angleDeg * Math.PI / 180) * hook.len,
      y: P.y + Math.cos(hook.angleDeg * Math.PI / 180) * hook.len,
    };
    drawClaw(ctx, head, hook.angleDeg, clock);

    // 船（重物拖拽时倾斜）
    drawBoat(ctx, hook.weight, clock);

    // 粒子：气泡 / 爆炸
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.type === 'bubble' && fx.ttl > 0) drawBubble(ctx, fx);
        if (fx.type === 'boom' && fx.ttl > 0) drawBoom(ctx, fx);
      }
    }

    ctx.restore();
  }

  function drawCurrentStreaks(g, sceneKey, state, clock) {
    const lv = { current: state.current || 0 };
    if (!(lv.current > 0)) return;
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const y = LAYOUT.SURFACE_Y + 40 + i * 90 + Math.sin(clock + i) * 8;
      const x0 = (clock * lv.current * 1.2 + i * 220) % WORLD.WIDTH;
      g.beginPath();
      g.moveTo(x0, y);
      g.quadraticCurveTo(x0 + 60, y, x0 + 120, y + 6);
      g.stroke();
    }
  }

  function drawBubble(g, fx) {
    const a = Math.max(0, fx.ttl / fx.maxTtl || 0.4);
    g.fillStyle = `rgba(220,245,255,${0.5 * a})`;
    g.strokeStyle = `rgba(255,255,255,${0.7 * a})`;
    g.lineWidth = 1.5;
    const r = 4 + fx.size;
    g.beginPath(); g.arc(fx.x, fx.y, r, 0, Math.PI * 2); g.fill(); g.stroke();
  }

  function drawBoom(g, fx) {
    const k = 1 - Math.max(0, fx.ttl / fx.maxTtl);
    const r = 10 + k * GAME.EXPLOSION_RADIUS;
    const grad = g.createRadialGradient(fx.x, fx.y, 2, fx.x, fx.y, r);
    grad.addColorStop(0, `rgba(255,240,180,${0.9 * (1 - k)})`);
    grad.addColorStop(0.4, `rgba(255,140,60,${0.55 * (1 - k)})`);
    grad.addColorStop(1, 'rgba(255,80,40,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(fx.x, fx.y, r, 0, Math.PI * 2); g.fill();
  }

  return { draw, debugLayout, resize };
}
