// BEAT BALL · Canvas 2D 渲染：三场景太鼓面 / 纵深透视 / 鼓槌预警 / 节拍点 / 太鼓球。
// 只消费 run.state + view（shake/fxQueue/sceneKey）。
// 透视：沿用原作的 pow2 深度曲线（近处加速放大），far=拍点出生、near=拍点到达玩家线。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, GAME } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const HORIZON = { x: 640, y: 148 };
const NEAR_Y = 618;
const LANE_GAP = 150;

const SCENES = {
  dawn: {
    skyTop: '#FFE3B0', skyMid: '#F7B36A', skyBot: '#E88B5A',
    drumLight: '#E8A24E', drumDark: '#9A4A20', rim: '#7A2E14',
    lane: 'rgba(90,40,10,0.28)', accent: '#C1272D', pad: '#FFD84E',
    decor: 'lanterns', groundGlow: 'rgba(255,214,130,0.35)',
  },
  lantern: {
    skyTop: '#141B3C', skyMid: '#2A1E4E', skyBot: '#3A1430',
    drumLight: '#4A2A5A', drumDark: '#1A0E2A', rim: '#2E1230',
    lane: 'rgba(255,140,80,0.22)', accent: '#E8543C', pad: '#FFC66A',
    decor: 'lanterns', groundGlow: 'rgba(255,120,60,0.22)',
  },
  storm: {
    skyTop: '#0E2230', skyMid: '#153A44', skyBot: '#0A1B22',
    drumLight: '#1E4650', drumDark: '#0A2028', rim: '#0E2E34',
    lane: 'rgba(160,220,240,0.20)', accent: '#5AC8E8', pad: '#B7F0FF',
    decor: 'storm', groundGlow: 'rgba(120,220,255,0.18)',
  },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---- 离屏背景缓存 ----
const bgCache = new Map();
function getBackground(sceneKey) {
  const key = sceneKey || 'dawn';
  let c = bgCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  drawBackground(c.getContext('2d'), key);
  bgCache.set(key, c);
  return c;
}

function drawBackground(g, sceneKey) {
  const P = SCENES[sceneKey] || SCENES.dawn;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.5, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'lantern') {
    drawMoon(g);
    drawStars(g, 90);
    drawLanterns(g, P);
  } else if (sceneKey === 'storm') {
    drawStormClouds(g);
    drawRain(g);
    drawLightning(g);
  } else {
    drawSunGlow(g, P);
    drawTorii(g, P);
    drawLanterns(g, P);
  }
}

function drawSunGlow(g, P) {
  const gx = 250, gy = 170;
  const halo = g.createRadialGradient(gx, gy, 10, gx, gy, 340);
  halo.addColorStop(0, 'rgba(255,240,200,0.85)');
  halo.addColorStop(0.4, P.groundGlow);
  halo.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);
}

function drawMoon(g) {
  const gx = 1030, gy = 130, r = 46;
  const halo = g.createRadialGradient(gx, gy, r * 0.4, gx, gy, r * 2.8);
  halo.addColorStop(0, 'rgba(255,235,190,0.5)');
  halo.addColorStop(1, 'rgba(255,235,190,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(gx, gy, r * 2.8, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFEFC2';
  g.beginPath(); g.arc(gx, gy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(190,160,120,0.35)';
  g.beginPath(); g.arc(gx - 14, gy - 8, r * 0.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(gx + 12, gy + 12, r * 0.15, 0, Math.PI * 2); g.fill();
}

function drawStars(g, n) {
  for (let i = 0; i < n; i += 1) {
    const x = (i * 131.7) % W;
    const y = (i * 97.3) % (H * 0.5);
    const a = 0.25 + ((i * 37) % 10) / 16;
    g.fillStyle = `rgba(220,235,255,${a.toFixed(2)})`;
    g.beginPath(); g.arc(x, y, 0.8 + ((i * 13) % 10) / 7, 0, Math.PI * 2); g.fill();
  }
}

function drawLanterns(g, P) {
  const xs = [150, 420, 860, 1130];
  for (let i = 0; i < xs.length; i += 1) {
    const x = xs[i];
    const y = 190 + ((i * 53) % 60);
    const glow = g.createRadialGradient(x, y, 4, x, y, 60);
    glow.addColorStop(0, 'rgba(255,120,70,0.8)');
    glow.addColorStop(1, 'rgba(255,120,70,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(x, y, 60, 0, Math.PI * 2); g.fill();
    // 灯笼身
    g.fillStyle = i % 2 ? '#E8543C' : '#C1272D';
    g.beginPath(); g.ellipse(x, y + 14, 20, 26, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,220,160,0.7)';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = 'rgba(255,200,120,0.8)';
    g.fillRect(x - 2, y - 6, 4, 6);
    g.fillRect(x - 2, y + 40, 4, 6);
  }
}

function drawTorii(g, P) {
  g.fillStyle = 'rgba(90,30,12,0.85)';
  const base = 300;
  for (const [sx, s] of [[120, 0.8], [1180, 1.0]]) {
    g.save();
    g.translate(sx, base);
    g.scale(s, s);
    g.fillRect(-70, -180, 12, 180);
    g.fillRect(58, -180, 12, 180);
    g.fillRect(-90, -200, 200, 14);
    g.fillRect(-80, -170, 180, 12);
    g.restore();
  }
}

function drawStormClouds(g) {
  g.fillStyle = 'rgba(8,14,20,0.6)';
  for (let i = 0; i < 5; i += 1) {
    const x = i * 280 - 40;
    const y = 60 + ((i * 31) % 50);
    g.beginPath();
    g.ellipse(x, y, 180, 70, 0, Math.PI, 0);
    g.ellipse(x + 120, y + 10, 140, 60, 0, Math.PI, 0);
    g.fill();
  }
}

function drawRain(g) {
  g.strokeStyle = 'rgba(170,220,240,0.22)';
  g.lineWidth = 1.4;
  for (let i = 0; i < 60; i += 1) {
    const x = (i * 89.3) % W;
    const y = (i * 47.7) % H;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 8, y + 22);
    g.stroke();
  }
}

function drawLightning(g) {
  // 静态闪电分支（程序化装饰）
  g.strokeStyle = 'rgba(200,240,255,0.5)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(360, 40);
  g.lineTo(330, 130);
  g.lineTo(360, 150);
  g.lineTo(322, 240);
  g.stroke();
}

// ---- 太鼓面 ----
function drawDrum(g, sceneKey, clock) {
  const P = SCENES[sceneKey] || SCENES.dawn;
  const cx = W / 2, cy = 700;
  const rx = 660, ry = 400;
  const grad = g.createRadialGradient(cx, cy - 60, 80, cx, cy, ry);
  grad.addColorStop(0, P.drumLight);
  grad.addColorStop(0.7, P.drumLight);
  grad.addColorStop(1, P.drumDark);
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.fill();

  // 鼓皮同心环
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 3;
  for (let i = 1; i <= 3; i += 1) {
    g.beginPath();
    g.ellipse(cx, cy, rx * (1 - i * 0.16), ry * (1 - i * 0.16), 0, 0, Math.PI * 2);
    g.stroke();
  }

  // 鼓边（rim）：下缘粗环
  g.strokeStyle = P.rim;
  g.lineWidth = 22;
  g.beginPath();
  g.ellipse(cx, cy, rx - 10, ry - 10, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.15)';
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(cx, cy, rx - 20, ry - 20, 0, 0, Math.PI * 2);
  g.stroke();

  // 鼓边铆钉
  g.fillStyle = P.rim;
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const x = cx + Math.cos(a) * (rx - 10);
    const y = cy + Math.sin(a) * (ry - 10);
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
  }

  // 拍点脉冲环（每拍一次，用 clock 推）
  const beatPhase = (clock % 1);
  if (beatPhase < 0.4) {
    g.strokeStyle = `rgba(255,220,120,${0.5 * (1 - beatPhase / 0.4)})`;
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(cx, cy, rx * 0.4 + beatPhase * 260, ry * 0.4 + beatPhase * 160, 0, 0, Math.PI * 2);
    g.stroke();
  }
}

function drawLanes(g, lanes, sceneKey) {
  const P = SCENES[sceneKey] || SCENES.dawn;
  g.strokeStyle = P.lane;
  g.lineWidth = 4;
  g.lineCap = 'round';
  for (let i = 0; i < lanes; i += 1) {
    const off = (i - (lanes - 1) / 2) * LANE_GAP;
    g.beginPath();
    g.moveTo(HORIZON.x, HORIZON.y);
    g.lineTo(HORIZON.x + off, NEAR_Y + 30);
    g.stroke();
  }
}

function laneOffsetX(lane, lanes) {
  return (lane - (lanes - 1) / 2) * LANE_GAP;
}

function eventScreen(o, clock, lanes) {
  const p = clamp((o.t - clock) / (o.travel || 0.6), 0, 1);
  const approach = 1 - p;
  const pow2 = Math.pow(2, approach * 4 - 4);
  return {
    p,
    pow2,
    y: lerp(HORIZON.y, NEAR_Y, pow2),
    x: HORIZON.x + laneOffsetX(o.lane, lanes) * pow2,
    scale: 0.16 + 0.84 * pow2,
  };
}

// ---- 鼓槌 ----
function drawStick(g, x, y, scale, ang, color) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(scale, scale);
  g.strokeStyle = color;
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, -52); g.lineTo(0, 8); g.stroke();
  g.fillStyle = '#F3E6C8';
  g.beginPath(); g.arc(0, 10, 13, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ---- 节拍点 ----
function drawPad(g, x, y, scale, jump, clock, fog) {
  const pulse = 0.7 + 0.3 * Math.sin(clock * 8 + x * 0.05);
  const r = 30 * scale * pulse;
  const col = jump ? 'rgba(90,220,240,' : 'rgba(255,210,80,';
  const alpha = fog ? 0.5 : 0.95;
  const glow = g.createRadialGradient(x, y, 2, x, y, r * 2.2);
  glow.addColorStop(0, `${col}${alpha})`);
  glow.addColorStop(1, `${col}0)`);
  g.fillStyle = glow;
  g.beginPath(); g.arc(x, y, r * 2.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = jump ? `rgba(150,245,255,${alpha})` : `rgba(255,238,150,${alpha})`;
  g.beginPath(); g.arc(x, y, r * 0.55, 0, Math.PI * 2); g.fill();
  g.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`;
  g.lineWidth = 3;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
}

// ---- 太鼓球（玩家）----
function drawBall(g, x, y, r, jumpLift, clock, sceneKey) {
  const P = SCENES[sceneKey] || SCENES.dawn;
  const shadow = g.createRadialGradient(x, y + r + 10, 4, x, y + r + 10, r * 1.1);
  shadow.addColorStop(0, 'rgba(0,0,0,0.35)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = shadow;
  g.beginPath(); g.ellipse(x, y + r + 12 - jumpLift * 0.3, r * 0.95, r * 0.3, 0, 0, Math.PI * 2); g.fill();

  const by = y - jumpLift;
  // 鼓身
  const body = g.createRadialGradient(x - r * 0.3, by - r * 0.3, r * 0.2, x, by, r);
  body.addColorStop(0, P.accent);
  body.addColorStop(0.7, P.accent);
  body.addColorStop(1, P.rim);
  g.fillStyle = body;
  g.beginPath(); g.arc(x, by, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 3;
  g.stroke();

  // 鼓面（内圈）
  g.fillStyle = 'rgba(255,238,200,0.95)';
  g.beginPath(); g.arc(x, by, r * 0.62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = P.rim;
  g.lineWidth = 3;
  g.stroke();

  // 铆钉
  g.fillStyle = '#F6E3B4';
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + clock * 1.2;
    g.beginPath();
    g.arc(x + Math.cos(a) * r * 0.82, by + Math.sin(a) * r * 0.82, 3.4, 0, Math.PI * 2);
    g.fill();
  }

  // 表情（脸）
  g.fillStyle = '#3A2412';
  g.beginPath(); g.arc(x - r * 0.24, by - r * 0.1, r * 0.09, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + r * 0.24, by - r * 0.1, r * 0.09, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3A2412';
  g.lineWidth = r * 0.06;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(x, by + r * 0.1, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
}

// ---- 涟漪特效 ----
function drawRipple(g, fx) {
  const t = clamp((0.5 - fx.ttl) / 0.5, 0, 1);
  const r = 20 + t * 90;
  g.strokeStyle = `rgba(255,220,120,${0.7 * (1 - t)})`;
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(fx.x, fx.y, r, r * 0.4, 0, 0, Math.PI * 2);
  g.stroke();
}

// ---- 主渲染器 ----
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  let clock = 0;
  let lastState = null;

  function resize(w, h) {
    return { w, h, world: { width: W, height: H } };
  }

  function laneRects(state) {
    const lanes = state.lanes;
    const rects = [];
    for (let i = 0; i < lanes; i += 1) {
      const x = HORIZON.x + laneOffsetX(i, lanes) - 46;
      rects.push({ x, y: NEAR_Y - 46, w: 92, h: 92 });
    }
    return rects;
  }

  function debugLayout() {
    if (!lastState) return null;
    const lanes = lastState.lanes;
    const minX = HORIZON.x + laneOffsetX(0, lanes) - 46;
    const maxX = HORIZON.x + laneOffsetX(lanes - 1, lanes) + 46;
    return {
      hud: { x: 0, y: 0, w: W, h: 48 },
      lanes: { x: minX, y: NEAR_Y - 60, w: maxX - minX, h: 120 },
      player: { x: HORIZON.x + laneOffsetX(lastState.playerLane, lanes) - 40, y: NEAR_Y - 44, w: 88, h: 88 },
      progress: { x: 0, y: 44, w: W, h: 12 },
      jump: { x: W - 132, y: H - 92, w: 88, h: 88 },
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(getBackground('dawn'), 0, 0);
    drawDrum(ctx, 'dawn', clock);
    drawLanes(ctx, 3, 'dawn');
    drawBall(ctx, HORIZON.x, NEAR_Y - 10, 40, 0, clock, 'dawn');
  }

  function draw(state, dt, view) {
    if (!state || !state.obstacles) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.scene || v.sceneKey || 'dawn';
    clock += dt || 0;
    lastState = state;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);
    drawDrum(ctx, sceneKey, clock);
    drawLanes(ctx, state.lanes, sceneKey);

    const fog = state.feature === 'fog';
    const lanes = state.lanes;

    // 事件（先画预警/节拍点，再画鼓槌，最后画玩家球）
    for (const o of state.obstacles) {
      if (o.resolved) continue;
      const e = eventScreen(o, state.clock, lanes);
      if (o.kind === 'hazard') {
        // 预警红圈
        if (o.warned) {
          const wr = 26 * e.scale;
          const a = fog ? 0.35 : 0.85;
          gstroke(ctx, `rgba(230,60,60,${a})`, 5);
          ctx.beginPath(); ctx.arc(e.x, e.y - 8 * e.scale, wr, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = `rgba(230,60,60,${a * 0.25})`;
          ctx.beginPath(); ctx.arc(e.x, e.y - 8 * e.scale, wr, 0, Math.PI * 2); ctx.fill();
          // 上方悬着的鼓槌
          drawStick(ctx, e.x, e.y - 60 * e.scale, e.scale, -0.6, '#8A5A3A');
        }
      } else if (o.kind === 'pad') {
        drawPad(ctx, e.x, e.y, e.scale, o.jump, clock, fog);
      }
    }

    // 已结算的鼓槌：落地动画
    for (const o of state.obstacles) {
      if (!o.resolved || o.kind !== 'hazard') continue;
      const dtSlap = state.clock - o.t;
      if (dtSlap < 0 || dtSlap > 0.28) continue;
      const x = HORIZON.x + laneOffsetX(o.lane, lanes);
      const k = dtSlap / 0.28;
      const ang = -1.3 + k * 1.6;
      drawStick(ctx, x, NEAR_Y + 8, 1.1 - k * 0.3, ang, o.hit ? '#C1272D' : '#6E4528');
      if (o.hit) {
        // 撞击火花
        ctx.fillStyle = `rgba(255,120,60,${0.8 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(x, NEAR_Y + 4, 40 * k + 6, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 涟漪特效
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.type === 'ripple' && fx.ttl > 0) {
          const rx = fx.lane != null ? HORIZON.x + laneOffsetX(fx.lane, lanes) : HORIZON.x;
          drawRipple(ctx, { x: rx, y: NEAR_Y, ttl: fx.ttl });
        }
      }
    }

    // 玩家球
    let lift = 0;
    if (state.playerJumping) {
      const prog = 1 - state.jumpT / GAME.JUMP_DURATION;
      lift = Math.sin(clamp(prog, 0, 1) * Math.PI) * 90;
    }
    const px = HORIZON.x + laneOffsetX(state.playerLane, lanes);
    drawBall(ctx, px, NEAR_Y, 36, lift, clock, sceneKey);

    ctx.restore();
  }

  function gstroke(ctx, style, w) {
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize };
}
