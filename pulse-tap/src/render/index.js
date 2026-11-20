// PULSE TAP · Canvas 2D 渲染：心跳夜店 DJ 台的四轨霓虹能量轨 + 下落脉冲 + 判定线。
// 只消费 run.state（契约）+ view（fxQueue/shake）。像素换算全部在此完成。
// 三个场景包（换章必换色板/构图/装饰）：neon-bar / rooftop-electro / midnight-subway。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout() }。
import { WORLD, TRACK_COUNT } from '../../config/game.config.js';

const FALL_SPEED = 268; // px/s：note 提前约 2s 从顶部出现
const LANE_W = 150;
const LANE_GAP = 24;
const LANE_TOP = 64;
const JUDGE_Y = 596;
const LANE_COLORS = ['#FF3D81', '#27D6F6', '#54F08A', '#FFC842'];
const LANE_DIM = ['rgba(255,61,129,0.14)', 'rgba(39,214,246,0.14)', 'rgba(84,240,138,0.14)', 'rgba(255,200,66,0.14)'];

const SCENES = {
  'neon-bar': {
    skyTop: '#12081F', skyMid: '#2A0F3D', skyBot: '#0B0614',
    accent: '#FF3D81', accent2: '#27D6F6', floor: '#160A28',
  },
  'rooftop-electro': {
    skyTop: '#05070F', skyMid: '#101A3A', skyBot: '#040610',
    accent: '#27D6F6', accent2: '#54F08A', floor: '#0A1226',
  },
  'midnight-subway': {
    skyTop: '#080D12', skyMid: '#0E1A22', skyBot: '#05090D',
    accent: '#FFC842', accent2: '#FF3D81', floor: '#0B1218',
  },
};

function computeLayout() {
  const total = TRACK_COUNT * LANE_W + (TRACK_COUNT - 1) * LANE_GAP;
  const startX = Math.floor((WORLD.WIDTH - total) / 2);
  const lanes = [];
  for (let i = 0; i < TRACK_COUNT; i += 1) {
    lanes.push({ x: startX + i * (LANE_W + LANE_GAP), w: LANE_W, track: i, cx: startX + i * (LANE_W + LANE_GAP) + LANE_W / 2 });
  }
  return { lanes, startX, laneW: LANE_W, laneGap: LANE_GAP, laneTop: LANE_TOP, judgeY: JUDGE_Y };
}

function noteY(note, now, L) {
  return L.judgeY - (note.time - now) * FALL_SPEED;
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

function gradeText(g, txt, cx, cy, color) {
  g.font = '900 26px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const w = g.measureText(txt).width + 26;
  g.fillStyle = 'rgba(8, 4, 16, 0.72)';
  roundRect(g, cx - w / 2, cy - 20, w, 40, 12);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 1.5;
  roundRect(g, cx - w / 2, cy - 20, w, 40, 12);
  g.stroke();
  g.fillStyle = color;
  g.fillText(txt, cx, cy + 1);
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
  const P = SCENES[sceneKey] || SCENES['neon-bar'];
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'neon-bar') drawNeonBar(g, P, W, H);
  else if (sceneKey === 'rooftop-electro') drawRooftop(g, P, W, H);
  else drawSubway(g, P, W, H);

  // 地面 / 舞台反光
  g.fillStyle = P.floor;
  g.fillRect(0, H * 0.86, W, H * 0.14);
  const g2 = g.createLinearGradient(0, H * 0.86, 0, H);
  g2.addColorStop(0, 'rgba(255,255,255,0.06)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = g2;
  g.fillRect(0, H * 0.86, W, H * 0.14);
}

function drawNeonBar(g, P, W, H) {
  // 吧台霓虹灯箱（均衡器图形，无文字，避免与标题混淆）
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(40, 40, 300, 110);
  g.strokeStyle = P.accent;
  g.lineWidth = 4;
  g.strokeRect(40, 40, 300, 110);
  g.fillStyle = P.accent;
  g.fillRect(72, 70, 18, 60);
  g.fillStyle = P.accent2;
  g.fillRect(102, 52, 18, 78);
  g.fillStyle = '#54F08A';
  g.fillRect(132, 64, 18, 66);
  g.fillStyle = P.accent;
  g.beginPath();
  g.arc(120, 132, 6, 0, Math.PI * 2);
  g.fill();
  // 顶部灯光光束
  for (let i = 0; i < 6; i += 1) {
    const x = 180 + i * 160;
    const beam = g.createLinearGradient(x, 0, x, H * 0.55);
    beam.addColorStop(0, i % 2 ? 'rgba(39,214,246,0.25)' : 'rgba(255,61,129,0.25)');
    beam.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(x - 14, 0);
    g.lineTo(x + 14, 0);
    g.lineTo(x + 90, H * 0.55);
    g.lineTo(x - 90, H * 0.55);
    g.closePath();
    g.fill();
  }
  // 舞池光点
  for (let i = 0; i < 40; i += 1) {
    const x = (i * 137.5) % W;
    const y = H * 0.55 + ((i * 61) % (H * 0.3));
    g.fillStyle = i % 3 === 0 ? P.accent : i % 3 === 1 ? P.accent2 : '#54F08A';
    g.globalAlpha = 0.25 + (i % 5) * 0.08;
    g.beginPath();
    g.arc(x, y, 2.4, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

function drawRooftop(g, P, W, H) {
  // 城市天际线
  g.fillStyle = 'rgba(8,12,28,0.9)';
  for (let i = 0; i < 14; i += 1) {
    const x = i * 95;
    const h = 90 + ((i * 47) % 150);
    g.fillRect(x, H * 0.86 - h, 72, h);
    // 窗灯
    g.fillStyle = 'rgba(84,240,138,0.25)';
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        if ((i + r + c) % 2) g.fillRect(x + 12 + c * 20, H * 0.86 - h + 12 + r * 26, 10, 12);
      }
    }
    g.fillStyle = 'rgba(8,12,28,0.9)';
  }
  // 月亮
  const mx = W - 180, my = 130;
  g.fillStyle = 'rgba(210,235,255,0.9)';
  g.beginPath();
  g.arc(mx, my, 42, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(180,210,235,0.5)';
  g.beginPath();
  g.arc(mx - 12, my - 8, 8, 0, Math.PI * 2);
  g.arc(mx + 10, my + 12, 6, 0, Math.PI * 2);
  g.fill();
  // 探照灯
  for (let i = 0; i < 3; i += 1) {
    const x = 260 + i * 320;
    const beam = g.createLinearGradient(x, 0, x, H);
    beam.addColorStop(0, 'rgba(39,214,246,0.16)');
    beam.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(x - 26, 0);
    g.lineTo(x + 26, 0);
    g.lineTo(x + 130, H);
    g.lineTo(x - 130, H);
    g.closePath();
    g.fill();
  }
}

function drawSubway(g, P, W, H) {
  // 隧道顶部连排灯（位于 HUD 下方，避免被顶栏遮挡）
  for (let i = 0; i < 10; i += 1) {
    const x = i * 140;
    const halo = g.createRadialGradient(x, 88, 4, x, 88, 80);
    halo.addColorStop(0, 'rgba(255,200,66,0.5)');
    halo.addColorStop(1, 'rgba(255,200,66,0)');
    g.fillStyle = halo;
    g.fillRect(x - 80, 20, 160, 120);
    g.fillStyle = '#FFE9A0';
    g.fillRect(x - 26, 82, 52, 10);
  }
  // 隧道纵深线条（透视）
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  g.lineWidth = 3;
  for (let i = 0; i < 7; i += 1) {
    const x = W / 2 + (i - 3) * 90;
    g.beginPath();
    g.moveTo(W / 2, H * 0.3);
    g.lineTo(x * 1.6, H);
    g.stroke();
  }
  // 车窗剪影
  g.fillStyle = 'rgba(255,61,129,0.12)';
  g.fillRect(0, H * 0.62, W, 40);
  g.fillStyle = 'rgba(39,214,246,0.10)';
  g.fillRect(0, H * 0.70, W, 30);
}

// ---- 单个 note 绘制 ----
function drawNote(g, note, now, L, clock) {
  const x = L.lanes[note.track].x;
  const cx = L.lanes[note.track].cx;
  const y = noteY(note, now, L);
  const color = note.kind === 'fake' ? '#9AA4B2' : LANE_COLORS[note.track];
  const pulse = 1 + Math.sin(clock * 8 + note.id) * 0.04;

  if (note.kind === 'hold') {
    const endY = noteY({ time: note.time + note.dur }, now, L);
    const top = Math.min(y, endY);
    const bot = Math.max(y, endY);
    const drawTop = Math.max(L.laneTop, top);
    const drawBot = Math.min(L.judgeY, bot);
    // 半透明长条 = 按住时长（弱化，不抢头部目标）
    g.globalAlpha = 0.5;
    g.fillStyle = color;
    roundRect(g, x + 26, drawTop, L.laneW - 52, Math.max(12, drawBot - drawTop), 14);
    g.fill();
    g.globalAlpha = 1;
    // 头部 = 明确的「点住」目标：白描边 + 向下箭头
    const headY = Math.max(L.laneTop + 12, y - 12);
    const glow = g.createRadialGradient(cx, headY, 2, cx, headY, 46);
    glow.addColorStop(0, 'rgba(255,255,255,0.9)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(cx, headY, 46, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = color;
    roundRect(g, cx - 42, headY - 16, 84, 32, 14);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    roundRect(g, cx - 42, headY - 16, 84, 32, 14);
    g.stroke();
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(cx - 8, headY - 6);
    g.lineTo(cx + 8, headY - 6);
    g.lineTo(cx, headY + 8);
    g.closePath();
    g.fill();
    return;
  }

  const w = L.laneW * 0.62 * pulse;
  const h = 34 * pulse;
  const glow = g.createRadialGradient(cx, y, 2, cx, y, w * 0.8);
  glow.addColorStop(0, 'rgba(255,255,255,0.85)');
  glow.addColorStop(0.35, color);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(cx, y, w * 0.8, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = note.kind === 'fake' ? '#6B7480' : color;
  roundRect(g, cx - w / 2, y - h / 2, w, h, 14);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  roundRect(g, cx - w / 2 + 4, y - h / 2 + 4, w - 8, h * 0.34, 8);
  g.fill();

  if (note.kind === 'fake') {
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(cx - 14, y - 12);
    g.lineTo(cx + 14, y + 12);
    g.moveTo(cx + 14, y - 12);
    g.lineTo(cx - 14, y + 12);
    g.stroke();
  }
  if (note.kind === 'slide') {
    // 滑键箭头指向相邻轨
    const toCx = L.lanes[note.toTrack].cx;
    const dir = toCx > cx ? 1 : -1;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(cx + dir * (w / 2 + 6), y);
    g.lineTo(cx + dir * (w / 2 + 26), y - 10);
    g.lineTo(cx + dir * (w / 2 + 26), y + 10);
    g.closePath();
    g.fill();
  }
  if (note.kind === 'slideEnd') {
    g.fillStyle = color;
    g.beginPath();
    g.arc(cx, y, 6, 0, Math.PI * 2);
    g.fill();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;
  let lastView = null;

  function resize() {
    return { w: WORLD.WIDTH, h: WORLD.HEIGHT };
  }

  function debugLayout() {
    const L = computeLayout();
    return {
      lanes: L.lanes.map((l) => ({ x: l.x, y: L.laneTop, w: L.laneW, h: L.judgeY - L.laneTop })),
      judge: { x: L.startX, y: L.judgeY, w: TRACK_COUNT * LANE_W + (TRACK_COUNT - 1) * LANE_GAP, h: 10 },
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: 44 },
    };
  }

  function drawTitleScene() {
    const L = computeLayout();
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('neon-bar'), 0, 0);
    drawLanes(ctx, L);
    drawJudge(ctx, L, clock);
    // 装饰性下落脉冲
    for (let i = 0; i < 5; i += 1) {
      const tr = (i * 7) % TRACK_COUNT;
      const t = ((clock * 0.7 + i * 0.37) % 2.2) / 2.2;
      const y = L.laneTop + t * (L.judgeY - L.laneTop);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = LANE_COLORS[tr];
      roundRect(ctx, L.lanes[tr].cx - 42, y - 16, 84, 32, 13);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      roundRect(ctx, L.lanes[tr].cx - 38, y - 12, 76, 10, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function draw(state, dt, view) {
    if (!state || !state.notes) { drawTitleScene(); return; }
    const v = view || lastView || {};
    lastView = v;
    clock += dt || 0;
    lastState = state;

    const L = computeLayout();
    const sceneKey = state.scene || 'neon-bar';

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);

    // 律动模式：整屏随拍呼吸的霓虹 vignette
    if (state.groove) {
      const b = 0.5 + 0.5 * Math.sin(clock * 2 * Math.PI * (state.bpm / 60));
      const vg = ctx.createRadialGradient(WORLD.WIDTH / 2, JUDGE_Y, 120, WORLD.WIDTH / 2, JUDGE_Y, 640);
      vg.addColorStop(0, `rgba(255,61,129,${0.05 + b * 0.10})`);
      vg.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }

    drawLanes(ctx, L, state.groove);
    drawJudge(ctx, L, clock, state.groove);

    // 下落中的 note（仅画可见时间窗）
    const now = state.time;
    for (const n of state.notes) {
      if (n.status === 'hit' || n.status === 'missed') continue;
      if (n.time < now - 0.4 || n.time > now + 2.6) continue;
      drawNote(ctx, n, now, L, clock);
    }

    // 命中特效（view.fxQueue）：判定文字带深色底衬，避免被轨道/背景干扰
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.ttl <= 0) continue;
        const k = fx.ttl / fx.maxTtl;
        const cx = L.lanes[fx.track].cx;
        const y = L.judgeY;
        if (fx.type === 'hit') {
          const r = 30 + (1 - k) * 70;
          ctx.strokeStyle = LANE_COLORS[fx.track];
          ctx.globalAlpha = k;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(cx, y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          const grade = fx.grade === 'perfect' ? 'PERFECT' : fx.grade === 'great' ? 'GREAT' : 'MISS';
          const color = fx.grade === 'perfect' ? '#FFE9A0' : fx.grade === 'great' ? '#B9F6FF' : '#FF9D9D';
          gradeText(ctx, grade, cx, y - 74 - (1 - k) * 20, color);
        } else if (fx.type === 'miss') {
          gradeText(ctx, 'MISS', cx, y - 74 - (1 - k) * 16, '#FF9D9D');
        }
      }
    }

    ctx.restore();
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = drawTitleScene;
  }

  return { draw, debugLayout, resize, drawTitleScene };
}

function drawLanes(g, L, groove) {
  for (const lane of L.lanes) {
    const grad = g.createLinearGradient(lane.x, 0, lane.x, L.judgeY);
    grad.addColorStop(0, 'rgba(0,0,0,0.30)');
    grad.addColorStop(1, groove ? 'rgba(255,61,129,0.12)' : 'rgba(0,0,0,0.08)');
    g.fillStyle = grad;
    roundRect(g, lane.x, L.laneTop - 10, lane.w, L.judgeY - L.laneTop + 20, 14);
    g.fill();

    g.strokeStyle = LANE_DIM[lane.track];
    g.lineWidth = 2;
    roundRect(g, lane.x, L.laneTop - 10, lane.w, L.judgeY - L.laneTop + 20, 14);
    g.stroke();

    // 轨道底部按键标签
    g.fillStyle = LANE_COLORS[lane.track];
    g.font = '900 24px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const keyLabel = ['D', 'F', 'J', 'K'][lane.track];
    g.fillText(keyLabel, lane.cx, L.judgeY + 38);
  }
}

function drawJudge(g, L, clock, groove) {
  const x = L.startX;
  const w = TRACK_COUNT * LANE_W + (TRACK_COUNT - 1) * LANE_GAP;
  const y = L.judgeY;
  const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
  const glow = g.createLinearGradient(x, 0, x + w, 0);
  glow.addColorStop(0, 'rgba(255,255,255,0.05)');
  glow.addColorStop(0.5, groove ? `rgba(255,61,129,${0.5 + pulse * 0.3})` : 'rgba(255,255,255,0.5)');
  glow.addColorStop(1, 'rgba(255,255,255,0.05)');
  g.fillStyle = glow;
  g.fillRect(x, y - 5, w, 10);
  // 判定线本体永远用高对比白，律动模式下加粉色光晕但不改线色，避免被背景吞掉
  g.fillStyle = '#FFFFFF';
  g.fillRect(x, y - 1.5, w, 3);
  if (groove) {
    g.fillStyle = 'rgba(255,61,129,0.5)';
    g.fillRect(x, y - 7, w, 2);
    g.fillRect(x, y + 5, w, 2);
  }
}
