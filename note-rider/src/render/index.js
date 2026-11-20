// NOTE RIDER · Canvas 2D 渲染：三场景（晨曦弦桥/雨夜琴城/星海音阶）+ 五线谱 + 音符/弦魔 + 弦骑士。
// 只消费 run.state + view（shake/fxQueue/cursor/sceneKey）。
// 像素换算全部在此完成（sim 只给 beatClock 与 note.start/end）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, LAYOUT } from '../../config/game.config.js';

const HIT_X = LAYOUT.HIT_X;
const PLAYER_X = LAYOUT.PLAYER_X;
const LANE_Y = LAYOUT.LANE_Y;
const STAFF_LINES = LAYOUT.STAFF_LINES;

// ---- 三场景色板（换章必换，构图/装饰互异）----
const SCENE_PALETTES = {
  dawn: {
    skyTop: '#FFE7B0', skyMid: '#F6C88A', skyBot: '#E4A96C',
    ground: '#F3D9A4', far: '#DDB27E',
    staff: '#5C4A2E', staffHi: '#8A6A40',
    glow: 'rgba(255,224,150,0.55)',
    noteGlow: 'rgba(255,220,140,0.5)',
  },
  rain: {
    skyTop: '#233455', skyMid: '#2A4066', skyBot: '#182742',
    ground: '#223050', far: '#1C2944',
    staff: '#5C7FA8', staffHi: '#7FA0C8',
    glow: 'rgba(140,175,255,0.4)',
    noteGlow: 'rgba(150,185,255,0.5)',
  },
  star: {
    skyTop: '#0A1030', skyMid: '#151B4A', skyBot: '#080C24',
    ground: '#0E1438', far: '#0A0F2C',
    staff: '#3A4A8A', staffHi: '#6A7AC0',
    glow: 'rgba(150,170,255,0.4)',
    noteGlow: 'rgba(180,190,255,0.45)',
  },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seededRand = (a, b, s) => mulberry32((a * 73856093) ^ (b * 19349663) ^ (s * 83492791))();

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
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.dawn;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.6, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'star') {
    for (let i = 0; i < 110; i += 1) {
      const x = seededRand(i, 1, 3) * W;
      const y = seededRand(i, 2, 5) * H * 0.62;
      const r = 0.6 + seededRand(i, 3, 7) * 1.5;
      g.fillStyle = `rgba(220,230,255,${0.35 + seededRand(i, 4, 9) * 0.6})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    drawConstellation(g, 900, 130);
  } else if (sceneKey === 'rain') {
    for (let i = 0; i < 60; i += 1) {
      const x = seededRand(i, 11, 13) * W;
      const y = seededRand(i, 12, 17) * H;
      const len = 12 + seededRand(i, 13, 19) * 20;
      g.strokeStyle = `rgba(170,200,250,${0.07 + seededRand(i, 14, 23) * 0.12})`;
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + len); g.stroke();
    }
    drawMoon(g, 180, 110);
  } else {
    const gx = 190, gy = 120;
    const halo = g.createRadialGradient(gx, gy, 20, gx, gy, 300);
    halo.addColorStop(0, P.glow);
    halo.addColorStop(1, 'rgba(255,224,150,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, W, H);
    drawBirds(g);
  }

  // 远景桥面（弦桥）
  g.fillStyle = P.far;
  g.beginPath();
  g.moveTo(0, H * 0.72);
  for (let i = 0; i <= 8; i += 1) {
    const x = (W / 8) * i;
    g.lineTo(x, H * 0.72 - Math.sin(i * 1.4 + 0.6) * 26 - 10);
  }
  g.lineTo(W, H * 0.8); g.lineTo(0, H * 0.8); g.closePath(); g.fill();

  g.fillStyle = P.ground;
  g.fillRect(0, H * 0.76, W, H * 0.24);
}

function drawMoon(g, x, y) {
  const halo = g.createRadialGradient(x, y, 20, x, y, 120);
  halo.addColorStop(0, 'rgba(200,220,255,0.4)');
  halo.addColorStop(1, 'rgba(200,220,255,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(x, y, 120, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#EAF2FF';
  g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.fill();
}

function drawConstellation(g, x, y) {
  const pts = [[0, 0], [60, -40], [120, -10], [150, 30], [80, 60], [20, 40], [0, 0]];
  g.strokeStyle = 'rgba(180,200,255,0.35)';
  g.lineWidth = 1.5;
  g.beginPath();
  pts.forEach(([dx, dy], i) => (i ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy)));
  g.stroke();
  g.fillStyle = '#DDE6FF';
  for (const [dx, dy] of pts.slice(0, -1)) { g.beginPath(); g.arc(x + dx, y + dy, 2.4, 0, Math.PI * 2); g.fill(); }
}

function drawBirds(g) {
  g.strokeStyle = 'rgba(90,70,50,0.5)';
  g.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const x = 300 + i * 170;
    const y = 90 + Math.sin(i * 1.7) * 30;
    g.beginPath();
    g.arc(x, y, 12, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
    g.beginPath();
    g.arc(x + 22, y, 12, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  }
}

// ---- 五线谱 + 判定线 ----
function drawStaff(g, P, sceneKey) {
  g.strokeStyle = P.staff;
  g.lineWidth = 3;
  for (const y of STAFF_LINES) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(WORLD.WIDTH, y); g.stroke();
  }
  // 高音谱号（程序化近似，只为氛围）
  g.strokeStyle = P.staffHi;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(30, STAFF_LINES[4]);
  g.bezierCurveTo(10, STAFF_LINES[2], 44, STAFF_LINES[0], 30, STAFF_LINES[2] - 8);
  g.stroke();
  g.fillStyle = P.staffHi;
  g.beginPath(); g.arc(30, STAFF_LINES[4] - 6, 5, 0, Math.PI * 2); g.fill();
}

function drawHitLine(g) {
  g.strokeStyle = 'rgba(255,215,90,0.9)';
  g.lineWidth = 3;
  g.setLineDash([10, 8]);
  g.beginPath(); g.moveTo(HIT_X, STAFF_LINES[0] - 26); g.lineTo(HIT_X, STAFF_LINES[4] + 26); g.stroke();
  g.setLineDash([]);
  // 判定线端点光点
  g.fillStyle = '#FFD75A';
  g.beginPath(); g.arc(HIT_X, STAFF_LINES[0] - 26, 5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(HIT_X, STAFF_LINES[4] + 26, 5, 0, Math.PI * 2); g.fill();
}

function drawLaneHighlight(g, lane, clock) {
  const y = LANE_Y[lane];
  const a = 0.16 + 0.08 * Math.sin((clock || 0) * 4);
  g.fillStyle = `rgba(255,220,110,${a})`;
  g.fillRect(0, y - 40, WORLD.WIDTH, 80);
}

// ---- 音符 / 弦魔 ----
const NOTE_COLORS = {
  tap: { fill: '#4FC3F7', edge: '#0D6FA8', glow: 'rgba(79,195,247,0.55)' },
  hold: { fill: '#B388FF', edge: '#5E35B1', glow: 'rgba(179,136,255,0.55)' },
  red: { fill: '#FF5A5A', edge: '#8E1B1B', glow: 'rgba(255,90,90,0.6)' },
  double: { fill: '#FFB74D', edge: '#C77800', glow: 'rgba(255,183,77,0.6)' },
};

function drawNote(g, x, y, note, clock) {
  const C = NOTE_COLORS[note.type] || NOTE_COLORS.tap;
  const r = 17;
  const pulse = note.isBoss ? 1 + Math.sin(clock * 6) * 0.12 : 1;

  // 光晕（放大，保证深色场景下目标清晰）
  const glow = g.createRadialGradient(x, y, 2, x, y, r * 2.8);
  glow.addColorStop(0, C.glow);
  glow.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(x, y, r * 2.8, 0, Math.PI * 2); g.fill();

  if (note.type === 'hold') {
    const headX = x;
    const tailX = headX + note.tailPx;
    g.fillStyle = C.fill;
    roundRect(g, headX - r * 0.6, y - r * 0.5, Math.max(r * 1.2, tailX), r, r * 0.5);
    g.fill();
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = 2.5;
    roundRect(g, headX - r * 0.6, y - r * 0.5, Math.max(r * 1.2, tailX), r, r * 0.5);
    g.stroke();
    g.strokeStyle = C.edge;
    g.lineWidth = 1;
    roundRect(g, headX - r * 0.6, y - r * 0.5, Math.max(r * 1.2, tailX), r, r * 0.5);
    g.stroke();
  }

  // 符头（椭圆，微倾斜，白描边确保任何背景可辨）
  g.save();
  g.translate(x, y);
  g.rotate(-0.25);
  g.fillStyle = C.fill;
  g.beginPath(); g.ellipse(0, 0, r * pulse, r * 0.78 * pulse, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#FFFFFF';
  g.lineWidth = 3;
  g.stroke();
  g.strokeStyle = C.edge;
  g.lineWidth = 1;
  g.stroke();
  g.restore();

  // 符干
  g.strokeStyle = C.edge;
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(x + r * 0.7, y - r * 0.2); g.lineTo(x + r * 0.7, y - r * 1.9); g.stroke();
  // 符尾
  g.beginPath();
  g.moveTo(x + r * 0.7, y - r * 1.9);
  g.quadraticCurveTo(x + r * 1.6, y - r * 1.5, x + r * 1.5, y - r * 1.0);
  g.stroke();

  if (note.type === 'double') {
    g.fillStyle = C.fill;
    g.beginPath(); g.ellipse(x + r * 1.1, y, r * 0.8, r * 0.7, -0.25, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(x + r * 1.1, y, r * 0.8, r * 0.7, -0.25, 0, Math.PI * 2); g.stroke();
  }

  // Boss 皇冠标记
  if (note.isBoss) {
    g.fillStyle = '#FFD75A';
    g.font = '700 18px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText('♛', x, y - r * 2.4);
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---- 弦骑士（程序化，≤50 图元）----
function drawKnight(g, x, y, clock, pose, sceneKey) {
  const s = 1.0;
  g.save();
  g.translate(x, y);
  g.scale(s, s);

  const gallop = Math.sin(clock * 14) * 4;
  const bob = Math.sin(clock * 14) * 3;
  const swing = pose === 'slash' ? Math.sin(clock * 40) * 0.9 : 0;
  const bodyColor = '#5B8DEF';
  const darkColor = '#3A5FB8';
  const maneColor = '#2A3A66';

  // 马腿（4 条，交替跑动）
  g.strokeStyle = '#2A3A66';
  g.lineWidth = 6;
  g.lineCap = 'round';
  const legSwing = Math.sin(clock * 14);
  g.beginPath(); g.moveTo(-34, 20); g.lineTo(-34 + legSwing * 8, 52); g.stroke();
  g.beginPath(); g.moveTo(-14, 20); g.lineTo(-14 - legSwing * 8, 52); g.stroke();
  g.beginPath(); g.moveTo(18, 20); g.lineTo(18 - legSwing * 8, 52); g.stroke();
  g.beginPath(); g.moveTo(38, 20); g.lineTo(38 + legSwing * 8, 52); g.stroke();

  // 马尾
  g.strokeStyle = maneColor;
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(44, -6); g.quadraticCurveTo(60 + Math.sin(clock * 14) * 6, 0, 66, 14); g.stroke();

  // 马身
  g.fillStyle = bodyColor;
  g.beginPath(); g.ellipse(0, 4, 46, 26, 0, 0, Math.PI * 2); g.fill();
  // 马腹亮部
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.beginPath(); g.ellipse(-4, 14, 30, 10, 0, 0, Math.PI * 2); g.fill();

  // 马颈 + 头
  g.fillStyle = bodyColor;
  g.beginPath(); g.ellipse(40, -22, 14, 22, -0.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(52, -34, 16, 12, -0.4, 0, Math.PI * 2); g.fill();
  // 马鬃
  g.strokeStyle = maneColor;
  g.lineWidth = 7;
  g.beginPath(); g.moveTo(40, -40); g.quadraticCurveTo(44, -56, 38, -62); g.stroke();
  // 马耳
  g.fillStyle = maneColor;
  g.beginPath(); g.moveTo(58, -46); g.lineTo(64, -60); g.lineTo(66, -42); g.closePath(); g.fill();
  // 马眼
  g.fillStyle = '#10131A';
  g.beginPath(); g.arc(60, -36, 2.4, 0, Math.PI * 2); g.fill();

  // 骑士身体
  g.fillStyle = '#3A5FB8';
  g.beginPath(); g.ellipse(-6, -30, 12, 18, 0, 0, Math.PI * 2); g.fill();
  // 骑士头
  g.fillStyle = '#F0D5A8';
  g.beginPath(); g.arc(-4, -54, 10, 0, Math.PI * 2); g.fill();
  // 头盔
  g.fillStyle = '#B9C6E8';
  g.beginPath(); g.arc(-4, -56, 11, Math.PI, Math.PI * 2); g.fill();
  // 盔缨
  g.fillStyle = '#FF5A6E';
  g.beginPath();
  g.moveTo(-4, -66);
  g.quadraticCurveTo(2 - swing * 8, -78, 12 - swing * 10, -72);
  g.lineTo(2, -66);
  g.closePath(); g.fill();

  // 持剑手臂 + 剑
  g.save();
  g.translate(-2, -32);
  g.rotate(-0.5 + swing);
  g.strokeStyle = '#3A5FB8';
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(18, -4); g.stroke();
  // 剑刃
  g.strokeStyle = '#E8EEFF';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(18, -4); g.lineTo(46, -22); g.stroke();
  // 剑柄
  g.strokeStyle = '#C98A2E';
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(14, -2); g.lineTo(24, -8); g.stroke();
  g.restore();

  g.restore();
}

// ---- 特效 ----
function drawSlashArc(g, x, y, ttl, clock) {
  const k = 1 - ttl / 0.3;
  g.save();
  g.translate(x, y);
  g.rotate(-0.3);
  g.strokeStyle = `rgba(255,240,210,${Math.max(0, 0.9 - k)})`;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, 30 + k * 40, -0.9, 0.9);
  g.stroke();
  g.restore();
}

// ---- 布局（tutorial 用）----
function computeLayout(state) {
  return {
    hitline: { x: HIT_X - 8, y: STAFF_LINES[0] - 30, w: 16, h: STAFF_LINES[4] - STAFF_LINES[0] + 60 },
    lanes: { x: 0, y: STAFF_LINES[0] - 30, w: WORLD.WIDTH, h: STAFF_LINES[4] - STAFF_LINES[0] + 60 },
    hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
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
    if (!lastState) return computeLayout({});
    return computeLayout(lastState);
  }

  function pxPerSec(bpm, speedMult = 1) {
    return LAYOUT.PX_PER_BEAT * (bpm / 60) * speedMult;
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('dawn'), 0, 0);
    drawStaff(ctx, SCENE_PALETTES.dawn, 'dawn');
    drawKnight(ctx, 620, 420, clock, 'idle', 'dawn');
  }

  function draw(state, dt, view) {
    if (!state || !state.notes) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.scene || v.sceneKey || 'dawn';
    clock += dt || 0;
    lastState = state;
    const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.dawn;

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);
    drawStaff(ctx, P, sceneKey);
    drawLaneHighlight(ctx, state.lane, clock);

    // 音符（弦魔）
    const speed = pxPerSec(state.bpm, state.speedMult || 1);
    const approach = 4.5;
    for (const n of state.notes) {
      if (n.resolved) continue;
      if (state.beatClock < n.start - approach) continue;
      if (n.type === 'hold' && state.beatClock > n.end + 0.3) continue;
      if (n.type !== 'hold' && state.beatClock > n.start + 0.3) continue;
      const x = HIT_X + (n.start - state.beatClock) * speed;
      const y = LANE_Y[n.lane];
      n.tailPx = (n.end - n.start) * speed;
      drawNote(ctx, x, y, n, clock);
    }

    drawHitLine(ctx);

    // 特效：斩击弧
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.type === 'slashArc' && fx.ttl > 0) {
          drawSlashArc(ctx, fx.x, fx.y, fx.ttl, clock);
        }
      }
    }

    // 和弦斩整行震动（高亮整行）
    if (v.chordFlash && v.chordFlash > 0) {
      ctx.fillStyle = `rgba(255,235,150,${v.chordFlash * 0.35})`;
      ctx.fillRect(0, STAFF_LINES[0] - 30, WORLD.WIDTH, STAFF_LINES[4] - STAFF_LINES[0] + 60);
    }

    // 玩家
    const py = LANE_Y[state.lane] + 6;
    const pose = v.slashPose ? 'slash' : 'idle';
    drawKnight(ctx, PLAYER_X, py, clock, pose, sceneKey);

    ctx.restore();
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize };
}
