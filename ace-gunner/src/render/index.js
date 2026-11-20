// ACE GUNNER · Canvas 2D 渲染：边城城垛 / 弓箭手 / 荒漠马匪 / 箭矢 / 准星 / 鹰眼慢动作。
// 只消费 run.state + view（cursor/shake/fxQueue/sceneKey）。像素换算全部在此完成（sim 只给坐标）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize() }。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { LANE_Y } from '../../config/levels.js';

const SCENE_PALETTES = {
  'noon-desert': {
    skyTop: '#FFE9B4', skyMid: '#EEC987', skyBot: '#E0A75F',
    duneFar: '#D09A5C', duneNear: '#C08A4C', ground: '#E3B877',
    road: '#D8A860', roadEdge: '#C08A4C',
    wallHi: '#B8845C', wallLo: '#8A6440', wallDark: '#5E442E',
    glow: 'rgba(255,224,150,0.55)',
  },
  'sandstorm-border': {
    skyTop: '#B98A5A', skyMid: '#A87848', skyBot: '#7A5A38',
    duneFar: '#9A6E44', duneNear: '#8A5E3A', ground: '#B98A5A',
    road: '#A87A48', roadEdge: '#8A5E3A',
    wallHi: '#8A6E50', wallLo: '#6A5038', wallDark: '#4A3A28',
    glow: 'rgba(240,190,120,0.4)',
  },
  'starry-fortress': {
    skyTop: '#0E2E3E', skyMid: '#10384C', skyBot: '#0A2230',
    duneFar: '#12384A', duneNear: '#0E2E3E', ground: '#143A4C',
    road: '#163E52', roadEdge: '#0E2E3E',
    wallHi: '#3A5A68', wallLo: '#2A4250', wallDark: '#1A2E3A',
    glow: 'rgba(127,200,232,0.2)',
  },
};

function seededRand(a, b, s) {
  const x = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------- 背景离屏缓存 ----------
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
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['noon-desert'];
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'starry-fortress') { drawStars(g); drawMoon(g); }
  else if (sceneKey === 'sandstorm-border') drawSandstorm(g, P);
  else drawSun(g, P);

  // 远景沙丘 / 城墙基座
  drawDunes(g, P, W, H);
  drawFortress(g, P, W, H);

  // 地面
  g.fillStyle = P.ground;
  g.fillRect(LAYOUT.WALL_X, H * 0.5, W - LAYOUT.WALL_X, H * 0.5);
  const grd = g.createLinearGradient(0, H * 0.5, 0, H);
  grd.addColorStop(0, P.ground);
  grd.addColorStop(1, P.skyBot);
  g.fillStyle = grd;
  g.fillRect(LAYOUT.WALL_X, H * 0.5, W - LAYOUT.WALL_X, H * 0.5);

  // 道路（四条道，供敌人行进）
  for (const y of LANE_Y) {
    g.fillStyle = P.road;
    g.fillRect(LAYOUT.WALL_X, y - 26, W - LAYOUT.WALL_X, 52);
    g.fillStyle = P.roadEdge;
    g.fillRect(LAYOUT.WALL_X, y - 26, W - LAYOUT.WALL_X, 2);
    g.fillRect(LAYOUT.WALL_X, y + 24, W - LAYOUT.WALL_X, 2);
  }
}

function drawStars(g) {
  for (let i = 0; i < 90; i += 1) {
    const x = seededRand(i, 1, 3) * WORLD.WIDTH;
    const y = seededRand(i, 2, 5) * WORLD.HEIGHT * 0.5;
    const r = 0.6 + seededRand(i, 3, 7) * 1.4;
    g.fillStyle = `rgba(220,240,255,${0.35 + seededRand(i, 4, 9) * 0.6})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

function drawMoon(g) {
  const x = WORLD.WIDTH - 200, y = 110, r = 42;
  const halo = g.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6);
  halo.addColorStop(0, 'rgba(210,235,255,0.5)');
  halo.addColorStop(1, 'rgba(210,235,255,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(x, y, r * 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#E8F2FF';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

function drawSun(g, P) {
  const x = 210, y = 150;
  const halo = g.createRadialGradient(x, y, 20, x, y, 320);
  halo.addColorStop(0, P.glow);
  halo.addColorStop(1, 'rgba(255,224,150,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  g.fillStyle = '#FFF3C0';
  g.beginPath(); g.arc(x, y, 40, 0, Math.PI * 2); g.fill();
}

function drawSandstorm(g, P) {
  for (let i = 0; i < 46; i += 1) {
    const x = seededRand(i, 1, 3) * WORLD.WIDTH;
    const y = seededRand(i, 2, 5) * WORLD.HEIGHT;
    const len = 30 + seededRand(i, 3, 7) * 70;
    g.strokeStyle = `rgba(240,200,140,${0.12 + seededRand(i, 4, 9) * 0.16})`;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - len, y + (seededRand(i, 5, 11) - 0.5) * 14);
    g.stroke();
  }
}

function drawDunes(g, P, W, H) {
  g.fillStyle = P.duneFar;
  g.beginPath();
  g.moveTo(0, H * 0.5);
  for (let i = 0; i <= 6; i += 1) {
    const x = (W / 6) * i;
    g.lineTo(x, H * 0.5 - Math.sin(i * 1.7 + 0.5) * 60 - 18);
  }
  g.lineTo(W, H * 0.5 + 40); g.lineTo(0, H * 0.5 + 40); g.closePath(); g.fill();
}

function drawFortress(g, P, W, H) {
  // 城墙主体（左侧立面）
  g.fillStyle = P.wallHi;
  g.fillRect(0, 0, LAYOUT.WALL_X, H);
  g.fillStyle = P.wallLo;
  g.fillRect(0, 0, LAYOUT.WALL_X, H);
  // 砖缝
  g.strokeStyle = P.wallDark;
  g.lineWidth = 2;
  for (let y = 0; y < H; y += 46) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(LAYOUT.WALL_X, y); g.stroke();
  }
  for (let y = 0; y < H; y += 46) {
    const off = (y / 46) % 2 === 0 ? 0 : LAYOUT.WALL_X / 2;
    for (let x = off; x < LAYOUT.WALL_X; x += LAYOUT.WALL_X) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(y + 46, H)); g.stroke();
    }
  }
  // 城垛
  g.fillStyle = P.wallHi;
  for (let x = 0; x < LAYOUT.WALL_X; x += 26) {
    g.fillRect(x, H - 24, 16, 24);
  }
}

// ---------- 实体绘制 ----------
function drawArcher(ctx, clock) {
  const x = LAYOUT.ARCHER_X, y = LAYOUT.ARCHER_Y;
  const bob = Math.sin(clock * 2.2) * 1.5;
  ctx.save();
  ctx.translate(x, y + bob);
  // 披风
  ctx.fillStyle = '#7A3B2E';
  ctx.beginPath(); ctx.moveTo(-14, 6); ctx.quadraticCurveTo(-30, 30, -20, 52); ctx.lineTo(-4, 40); ctx.closePath(); ctx.fill();
  // 身体
  ctx.fillStyle = '#C07A3E';
  ctx.beginPath(); ctx.ellipse(0, 12, 16, 22, 0, 0, Math.PI * 2); ctx.fill();
  // 头 + 牛仔帽
  ctx.fillStyle = '#E8C49A';
  ctx.beginPath(); ctx.arc(0, -12, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5A3A22';
  ctx.beginPath(); ctx.ellipse(0, -20, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-8, -34, 16, 14);
  ctx.fillStyle = '#5A3A22';
  ctx.beginPath(); ctx.arc(0, -34, 8, 0, Math.PI * 2); ctx.fill();
  // 弓
  ctx.strokeStyle = '#6A4526';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(20, 4, 30, -Math.PI / 2.4, Math.PI / 2.4); ctx.stroke();
  ctx.strokeStyle = '#E8E0D0';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(20 - Math.cos(0.4) * 30, 4 + Math.sin(0.4) * 30); ctx.lineTo(20 + Math.cos(0.4) * 30, 4 + Math.sin(0.4) * 30); ctx.stroke();
  ctx.restore();
}

function drawEnemy(ctx, e, clock) {
  const x = e.x, y = e.y;
  const s = e.radius / 11; // 视觉放大：敌人更醒目（碰撞半径不变）
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  if (e.kind === 'barrel') {
    ctx.fillStyle = '#6A4526';
    ctx.beginPath(); ctx.ellipse(0, 6, 20, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4A3016'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-20, -4); ctx.lineTo(20, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-20, 12); ctx.lineTo(20, 12); ctx.stroke();
    ctx.fillStyle = '#D04A2E';
    ctx.beginPath(); ctx.arc(0, -22, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFE9B4'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(6, -34, 12, -40); ctx.stroke();
    ctx.restore(); return;
  }

  if (e.kind === 'boss') {
    // 大酋长
    ctx.fillStyle = '#3A2412';
    ctx.beginPath(); ctx.ellipse(0, 14, 30, 34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5A3A22';
    ctx.beginPath(); ctx.arc(0, -20, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#E8C49A';
    ctx.beginPath(); ctx.arc(0, -24, 14, 0, Math.PI * 2); ctx.fill();
    // 头饰
    ctx.fillStyle = '#C0392B';
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 12 - 4, -40);
      ctx.lineTo(i * 12 + 4, -40);
      ctx.lineTo(i * 12, -56);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore(); return;
  }

  // 马匪：骑马
  if (e.kind === 'rider') {
    ctx.fillStyle = '#4A3016';
    ctx.beginPath(); ctx.ellipse(0, 14, 26, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5A3A22';
    ctx.beginPath(); ctx.ellipse(0, -8, 16, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#E8C49A';
    ctx.beginPath(); ctx.arc(0, -26, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5A3A22';
    ctx.beginPath(); ctx.ellipse(0, -34, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); return;
  }

  // 步匪 / 盾匪
  ctx.fillStyle = '#3A2412';
  ctx.beginPath(); ctx.ellipse(0, 12, 16, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#E8C49A';
  ctx.beginPath(); ctx.arc(0, -12, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5A3A22';
  ctx.beginPath(); ctx.ellipse(0, -20, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
  if (e.kind === 'shield') {
    // 盾牌（朝右，挡箭）
    ctx.fillStyle = '#8A5A3A';
    ctx.beginPath(); ctx.ellipse(14, 4, 12, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#D0A860'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(14, 4, 12, 20, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawBolt(ctx, b) {
  const ang = Math.atan2(b.vy, b.vx);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(ang);
  ctx.strokeStyle = '#E8E0D0';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(6, 0); ctx.stroke();
  ctx.fillStyle = '#C0392B';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-2, -4); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#F0E8D8';
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-8, -4); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawIncomingChevron(ctx, y) {
  const x = 1208;
  ctx.fillStyle = 'rgba(240,80,60,0.9)';
  for (let i = 0; i < 3; i += 1) {
    const cx = x - i * 16;
    ctx.beginPath();
    ctx.moveTo(cx, y - 12);
    ctx.lineTo(cx - 12, y);
    ctx.lineTo(cx, y + 12);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCrosshair(ctx, p, eagle, clock) {
  const r = eagle ? 30 + Math.sin(clock * 6) * 4 : 22;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,80,60,0.95)';
  ctx.beginPath();
  ctx.moveTo(p.x - r - 8, p.y); ctx.lineTo(p.x - r + 4, p.y);
  ctx.moveTo(p.x + r - 4, p.y); ctx.lineTo(p.x + r + 8, p.y);
  ctx.moveTo(p.x, p.y - r - 8); ctx.lineTo(p.x, p.y - r + 4);
  ctx.moveTo(p.x, p.y + r - 4); ctx.lineTo(p.x, p.y + r + 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,80,60,0.9)';
  ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
}

function drawGate(ctx, state, P, clock) {
  const x = LAYOUT.WALL_X - 6, y = 360;
  const w = 46, h = 110;
  const hpRatio = state.baseMaxHp > 0 ? Math.max(0, state.baseHp / state.baseMaxHp) : 0;
  ctx.save();
  ctx.translate(x, y);
  // 门框
  ctx.fillStyle = P.wallDark;
  ctx.fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
  const gateCol = hpRatio > 0.4 ? '#7A4A2A' : '#5E3A22';
  ctx.fillStyle = gateCol;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // 门板纹理
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
  // 城门血条（贴门上方，替代环绕圆环，避免与射手重叠误读）
  const bw = 72;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(-bw / 2, -h / 2 - 22, bw, 9);
  ctx.fillStyle = hpRatio > 0.5 ? '#6EDB7A' : hpRatio > 0.25 ? '#F0C040' : '#F0503C';
  ctx.fillRect(-bw / 2, -h / 2 - 22, bw * hpRatio, 9);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-bw / 2, -h / 2 - 22, bw, 9);
  ctx.restore();
}

function computeLayout() {
  return { wallX: LAYOUT.WALL_X, archerX: LAYOUT.ARCHER_X, archerY: LAYOUT.ARCHER_Y };
}

function createMockState(sceneKey) {
  return {
    wave: 1,
    phase: 'wave',
    sceneKey,
    baseHp: 80,
    baseMaxHp: 100,
    enemies: [
      { kind: 'foot', x: 900, y: 330, radius: 18 },
      { kind: 'rider', x: 1080, y: 460, radius: 16 },
      { kind: 'shield', x: 760, y: 200, radius: 20 },
      { kind: 'barrel', x: 640, y: 590, radius: 22 },
    ],
    bolts: [],
    aim: { x: 700, y: 400 },
    eagleLeft: 0,
    timeScale: 1,
  };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;

  function resize() {
    return { world: { width: WORLD.WIDTH, height: WORLD.HEIGHT } };
  }

  function debugLayout() {
    return {
      wall: { x: 0, y: 0, w: LAYOUT.WALL_X, h: WORLD.HEIGHT },
      road: { x: LAYOUT.WALL_X, y: 100, w: WORLD.WIDTH - LAYOUT.WALL_X, h: WORLD.HEIGHT - 100 },
      gate: { x: LAYOUT.WALL_X - 30, y: 305, w: 62, h: 110 },
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: 56 },
      archer: { x: LAYOUT.ARCHER_X - 30, y: LAYOUT.ARCHER_Y - 56, w: 60, h: 112 },
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('noon-desert'), 0, 0);
    drawArcher(ctx, clock);
  }

  function draw(state, dt, view) {
    if (!state || !state.enemies) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;
    const sceneKey = state.sceneKey || v.sceneKey || 'noon-desert';
    const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['noon-desert'];
    const eagle = state.eagleLeft > 0;

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);

    // 鹰眼时刻：轻微拉近 + 金圈
    if (eagle) {
      const zoom = 1 + Math.sin(clock * 10) * 0.012;
      ctx.translate(WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-WORLD.WIDTH / 2, -WORLD.HEIGHT / 2);
    }

    drawGate(ctx, state, P, clock);
    drawArcher(ctx, clock);

    // 入场预警：远处敌人所在道绘制红色箭头
    for (const e of state.enemies) {
      if (e.state === 'dead' || e.x < 980) continue;
      drawIncomingChevron(ctx, e.y);
    }

    // 夜袭视野：只压暗背景（敌人/威胁环/准星保持高亮，保证目标可见）
    if (state.night) {
      const grad = ctx.createRadialGradient(LAYOUT.ARCHER_X + 100, LAYOUT.ARCHER_Y, 140, LAYOUT.ARCHER_X + 100, LAYOUT.ARCHER_Y, 820);
      grad.addColorStop(0, 'rgba(4,10,16,0)');
      grad.addColorStop(1, 'rgba(4,10,16,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      // 火把
      for (let i = 0; i < 3; i += 1) {
        const ty = 200 + i * 160;
        ctx.fillStyle = '#E8A040';
        ctx.beginPath(); ctx.arc(LAYOUT.WALL_X + 30, ty, 6 + Math.sin(clock * 7 + i) * 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(232,160,64,0.4)';
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(LAYOUT.WALL_X + 30, ty); ctx.lineTo(LAYOUT.WALL_X + 120, ty); ctx.stroke();
      }
    }

    // 敌人
    for (const e of state.enemies) {
      if (e.state === 'dead') continue;
      // 红色威胁环：明确「这是要打的目标」
      const threat = e.kind === 'boss' ? 'rgba(255,80,60,0.9)' : 'rgba(240,90,60,0.65)';
      ctx.strokeStyle = threat;
      ctx.lineWidth = e.kind === 'boss' ? 4 : 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 7, 0, Math.PI * 2); ctx.stroke();
      drawEnemy(ctx, e, clock);
      // Boss 血条
      if (e.kind === 'boss') {
        const w = 90;
        const ratio = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(e.x - w / 2, e.y - 62, w, 10);
        ctx.fillStyle = '#E04A2E';
        ctx.fillRect(e.x - w / 2, e.y - 62, w * ratio, 10);
      }
    }

    // 箭矢
    for (const b of state.bolts) drawBolt(ctx, b);

    // 命中/爆炸特效（fxQueue）
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.type === 'hitFlash' && fx.ttl > 0) {
          ctx.fillStyle = `rgba(255,230,160,${(fx.ttl / 0.25) * 0.8})`;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, 14, 0, Math.PI * 2); ctx.fill();
        } else if (fx.type === 'explosion' && fx.ttl > 0) {
          const r = (1 - fx.ttl / 0.4) * 90 + 10;
          ctx.fillStyle = `rgba(255,160,60,${(fx.ttl / 0.4) * 0.8})`;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // 准星
    if (state.phase === 'wave') {
      // 瞄准轨迹线：把射手和准星连起来，说明「箭从这里射向准星」
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(LAYOUT.ARCHER_X, LAYOUT.ARCHER_Y);
      ctx.lineTo(state.aim.x, state.aim.y);
      ctx.stroke();
      ctx.setLineDash([]);
      drawCrosshair(ctx, state.aim, eagle, clock);
    }

    // 沙暴沙尘前景
    if (state.sandstorm) {
      ctx.fillStyle = 'rgba(220,180,120,0.12)';
      for (let i = 0; i < 30; i += 1) {
        const fx = (seededRand(i, clock * 0.05, 1) * 1.2 * WORLD.WIDTH + clock * 40) % WORLD.WIDTH;
        const fy = seededRand(i, 7, 3) * WORLD.HEIGHT;
        ctx.beginPath(); ctx.arc(fx, fy, 1.5 + seededRand(i, 9, 13) * 2, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 鹰眼金色描边
    if (eagle) {
      ctx.strokeStyle = `rgba(255,200,80,${0.5 + 0.3 * Math.sin(clock * 8)})`;
      ctx.lineWidth = 8;
      ctx.strokeRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }

    ctx.restore();
  }

  function __renderDemo(sceneKey) {
    const key = SCENE_PALETTES[sceneKey] ? sceneKey : 'noon-desert';
    lastState = createMockState(key);
    draw(lastState, 0, { sceneKey: key });
  }

  if (typeof window !== 'undefined') {
    window.__renderDemo = __renderDemo;
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize, __renderDemo };
}
