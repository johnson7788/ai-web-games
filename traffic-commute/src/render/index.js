// Traffic Commute · 霓虹街机渲染（纯 canvas 2D，程序化，零素材）
// 负责：霓虹都市背景 + 场景元素 + 发光选项标记 + 命中/错误特效。
// 布局：顶部 64px 为不透明 HUD（DOM），canvas 场景区为 y∈[64,720]。
import { WORLD, LAYOUT } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const SCENE_TOP = LAYOUT.SCENE_TOP;
const SCENE_H = H - SCENE_TOP;

// 霓虹配色
const PAL = {
  bgTop: '#07070f',
  bgBottom: '#141430',
  cyan: '#00e5ff',
  magenta: '#ff2d78',
  yellow: '#ffd166',
  green: '#4ade80',
  purple: '#a78bfa',
  white: '#f4f4ff',
  dim: 'rgba(244,244,255,0.35)',
};

const LETTERS = ['A', 'B', 'C', 'D'];

function glow(ctx, color, blur = 12) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}
function noGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

// ---- 背景：渐变夜空 + 星空 + 天际线 + 透视网格 ----
function drawBackdrop(ctx, t) {
  const g = ctx.createLinearGradient(0, SCENE_TOP, 0, H);
  g.addColorStop(0, PAL.bgTop);
  g.addColorStop(1, PAL.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, SCENE_TOP, W, SCENE_H);

  // 星空
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 60; i += 1) {
    const sx = (i * 137.5 + 40) % W;
    const sy = SCENE_TOP + ((i * 89.7 + 20) % (SCENE_H * 0.4));
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
    ctx.globalAlpha = 0.25 + 0.5 * tw;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  // 天际线剪影
  ctx.fillStyle = 'rgba(20,20,45,0.9)';
  for (let i = 0; i < 12; i += 1) {
    const bx = i * 116 - 10;
    const bw = 80 + ((i * 53) % 60);
    const bh = 90 + ((i * 97) % 140);
    ctx.fillRect(bx, SCENE_TOP + SCENE_H * 0.42 - bh, bw, bh);
  }
  // 楼窗霓虹点
  ctx.fillStyle = 'rgba(0,229,255,0.35)';
  for (let i = 0; i < 24; i += 1) {
    const wx = (i * 173 + 60) % W;
    const wy = SCENE_TOP + 40 + ((i * 61) % (SCENE_H * 0.35));
    if (Math.sin(i * 1.7 + t) > 0) ctx.fillRect(wx, wy, 4, 4);
  }

  // 透视网格地面（下半区）
  const horizon = SCENE_TOP + SCENE_H * 0.46;
  ctx.strokeStyle = 'rgba(0,229,255,0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i += 1) {
    const y = horizon + (i / 10) * (H - horizon);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = -6; i <= 6; i += 1) {
    const cx = W / 2 + i * 70;
    ctx.beginPath();
    ctx.moveTo(cx, horizon);
    ctx.lineTo(W / 2 + i * 160, H);
    ctx.stroke();
  }
}

// ---- 场景元素（按 scene key）----
function drawScene(ctx, scene, t) {
  const c = PAL;
  switch (scene) {
    case 'road': {
      // 马路
      ctx.fillStyle = '#101024';
      ctx.fillRect(0, SCENE_TOP + SCENE_H * 0.58, W, SCENE_H * 0.3);
      ctx.strokeStyle = 'rgba(255,209,102,0.8)';
      ctx.setLineDash([26, 18]);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, SCENE_TOP + SCENE_H * 0.73);
      ctx.lineTo(W, SCENE_TOP + SCENE_H * 0.73);
      ctx.stroke();
      ctx.setLineDash([]);
      // 斑马线（左侧）
      ctx.fillStyle = 'rgba(244,244,255,0.85)';
      for (let i = 0; i < 6; i += 1) {
        ctx.fillRect(90 + i * 34, SCENE_TOP + SCENE_H * 0.60, 20, SCENE_H * 0.24);
      }
      // 红绿灯杆
      ctx.fillStyle = '#1c1c30';
      ctx.fillRect(W * 0.78, SCENE_TOP + SCENE_H * 0.30, 10, SCENE_H * 0.32);
      drawLightHead(ctx, W * 0.78 + 5, SCENE_TOP + SCENE_H * 0.28, t);
      break;
    }
    case 'lights': {
      // 巨型红绿灯特写
      ctx.fillStyle = '#101024';
      ctx.fillRect(0, SCENE_TOP + SCENE_H * 0.55, W, SCENE_H * 0.3);
      drawBigLight(ctx, W / 2, SCENE_TOP + SCENE_H * 0.36, t);
      break;
    }
    case 'bridge': {
      ctx.fillStyle = '#101024';
      ctx.fillRect(0, SCENE_TOP + SCENE_H * 0.6, W, SCENE_H * 0.28);
      ctx.strokeStyle = 'rgba(255,209,102,0.8)';
      ctx.setLineDash([26, 18]);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, SCENE_TOP + SCENE_H * 0.74);
      ctx.lineTo(W, SCENE_TOP + SCENE_H * 0.74);
      ctx.stroke();
      ctx.setLineDash([]);
      // 过街天桥（拱形）
      glow(ctx, c.cyan, 10);
      ctx.strokeStyle = c.cyan;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(W * 0.12, SCENE_TOP + SCENE_H * 0.72);
      ctx.quadraticCurveTo(W * 0.32, SCENE_TOP + SCENE_H * 0.16, W * 0.52, SCENE_TOP + SCENE_H * 0.72);
      ctx.stroke();
      noGlow(ctx);
      ctx.strokeStyle = '#1c1c30';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(W * 0.14, SCENE_TOP + SCENE_H * 0.72);
      ctx.lineTo(W * 0.14, SCENE_TOP + SCENE_H * 0.58);
      ctx.moveTo(W * 0.50, SCENE_TOP + SCENE_H * 0.72);
      ctx.lineTo(W * 0.50, SCENE_TOP + SCENE_H * 0.58);
      ctx.stroke();
      break;
    }
    case 'busstop': {
      ctx.fillStyle = '#101024';
      ctx.fillRect(0, SCENE_TOP + SCENE_H * 0.58, W, SCENE_H * 0.28);
      // 站牌
      glow(ctx, c.yellow, 8);
      ctx.fillStyle = '#1c1c30';
      ctx.fillRect(W * 0.48, SCENE_TOP + SCENE_H * 0.30, 8, SCENE_H * 0.3);
      ctx.fillStyle = c.yellow;
      ctx.fillRect(W * 0.36, SCENE_TOP + SCENE_H * 0.26, 120, 40);
      ctx.fillStyle = '#101024';
      ctx.font = '700 22px "Courier New", monospace';
      ctx.fillText('BUS', W * 0.40, SCENE_TOP + SCENE_H * 0.26 + 27);
      noGlow(ctx);
      break;
    }
    case 'businterior': {
      // 车厢：长凳 + 扶手杆
      ctx.fillStyle = '#151530';
      ctx.fillRect(0, SCENE_TOP + SCENE_H * 0.12, W, SCENE_H * 0.72);
      ctx.strokeStyle = 'rgba(0,229,255,0.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i += 1) {
        const y = SCENE_TOP + SCENE_H * (0.34 + i * 0.16);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // 扶手杆
      glow(ctx, c.magenta, 8);
      ctx.strokeStyle = c.magenta;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(W * 0.5, SCENE_TOP + SCENE_H * 0.14);
      ctx.lineTo(W * 0.5, SCENE_TOP + SCENE_H * 0.8);
      ctx.stroke();
      noGlow(ctx);
      break;
    }
    case 'curb': {
      ctx.fillStyle = '#101024';
      ctx.fillRect(0, SCENE_TOP + SCENE_H * 0.56, W, SCENE_H * 0.3);
      // 人行道台阶
      ctx.fillStyle = '#1c1c30';
      ctx.fillRect(0, SCENE_TOP + SCENE_H * 0.52, W, SCENE_H * 0.08);
      ctx.strokeStyle = 'rgba(244,244,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, SCENE_TOP + SCENE_H * 0.52);
      ctx.lineTo(W, SCENE_TOP + SCENE_H * 0.52);
      ctx.stroke();
      // 公交车
      drawBusShape(ctx, W * 0.5, SCENE_TOP + SCENE_H * 0.4, t);
      break;
    }
    default:
      break;
  }
}

function drawLightHead(ctx, x, y, t) {
  glow(ctx, PAL.green, 8);
  ctx.fillStyle = '#1c1c30';
  ctx.fillRect(x - 18, y - 44, 46, 92);
  const cols = [PAL.magenta, PAL.yellow, PAL.green];
  const active = Math.floor(t / 0.8) % 3;
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i === active ? cols[i] : 'rgba(244,244,255,0.12)';
    ctx.beginPath();
    ctx.arc(x + 5, y - 24 + i * 28, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  noGlow(ctx);
}

function drawBigLight(ctx, cx, cy, t) {
  glow(ctx, PAL.green, 14);
  ctx.fillStyle = '#1c1c30';
  ctx.beginPath();
  ctx.roundRect(cx - 80, cy - 150, 160, 300, 26);
  ctx.fill();
  const cols = [PAL.magenta, PAL.yellow, PAL.green];
  const active = Math.floor(t / 0.8) % 3;
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i === active ? cols[i] : 'rgba(244,244,255,0.12)';
    ctx.beginPath();
    ctx.arc(cx, cy - 100 + i * 100, 38, 0, Math.PI * 2);
    ctx.fill();
  }
  noGlow(ctx);
}

function drawBusShape(ctx, cx, cy, t) {
  glow(ctx, PAL.yellow, 10);
  ctx.fillStyle = PAL.yellow;
  ctx.beginPath();
  ctx.roundRect(cx - 190, cy - 70, 380, 130, 16);
  ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = '#101024';
  for (let i = 0; i < 4; i += 1) ctx.fillRect(cx - 170 + i * 88, cy - 54, 66, 46);
  ctx.fillStyle = '#101024';
  ctx.beginPath();
  ctx.arc(cx - 150, cy + 72, 26, 0, Math.PI * 2);
  ctx.arc(cx + 150, cy + 72, 26, 0, Math.PI * 2);
  ctx.fill();
}

// ---- 图标（简化矢量象形）----
function drawIcon(ctx, icon, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.lineCap = 'round';
  const u = s / 40; // 单位
  switch (icon) {
    case 'crosswalk':
      ctx.fillStyle = color;
      for (let i = 0; i < 5; i += 1) ctx.fillRect((-40 + i * 20) * u, -28 * u, 12 * u, 56 * u);
      break;
    case 'jaywalk':
      ctx.beginPath();
      ctx.moveTo(-32 * u, 24 * u);
      ctx.lineTo(-8 * u, -8 * u);
      ctx.lineTo(16 * u, 12 * u);
      ctx.lineTo(32 * u, -24 * u);
      ctx.stroke();
      break;
    case 'signalWalk':
      ctx.fillRect(-30 * u, -30 * u, 60 * u, 60 * u);
      ctx.strokeStyle = '#101024';
      ctx.beginPath();
      ctx.arc(-4 * u, -16 * u, 6 * u, 0, Math.PI * 2);
      ctx.moveTo(-4 * u, -8 * u);
      ctx.lineTo(-14 * u, 12 * u);
      ctx.moveTo(-4 * u, -4 * u);
      ctx.lineTo(8 * u, 12 * u);
      ctx.moveTo(-16 * u, -2 * u);
      ctx.lineTo(-16 * u, 22 * u);
      ctx.moveTo(14 * u, -2 * u);
      ctx.lineTo(14 * u, 22 * u);
      ctx.stroke();
      break;
    case 'signalStop':
      ctx.fillRect(-30 * u, -30 * u, 60 * u, 60 * u);
      ctx.strokeStyle = '#101024';
      ctx.beginPath();
      ctx.moveTo(-14 * u, -8 * u);
      ctx.lineTo(-14 * u, 22 * u);
      ctx.moveTo(14 * u, -8 * u);
      ctx.lineTo(14 * u, 22 * u);
      ctx.moveTo(-14 * u, 4 * u);
      ctx.lineTo(14 * u, 4 * u);
      ctx.moveTo(-14 * u, -6 * u);
      ctx.lineTo(0 * u, -20 * u);
      ctx.lineTo(14 * u, -6 * u);
      ctx.stroke();
      break;
    case 'signalWait':
      ctx.fillRect(-30 * u, -30 * u, 60 * u, 60 * u);
      ctx.strokeStyle = '#101024';
      ctx.beginPath();
      ctx.moveTo(0, -22 * u);
      ctx.lineTo(0, 22 * u);
      ctx.moveTo(-14 * u, -14 * u);
      ctx.lineTo(14 * u, -14 * u);
      ctx.moveTo(-14 * u, 14 * u);
      ctx.lineTo(14 * u, 14 * u);
      ctx.stroke();
      break;
    case 'bridge':
      ctx.beginPath();
      ctx.moveTo(-34 * u, 24 * u);
      ctx.quadraticCurveTo(0, -34 * u, 34 * u, 24 * u);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-24 * u, 24 * u);
      ctx.lineTo(-24 * u, 10 * u);
      ctx.moveTo(24 * u, 24 * u);
      ctx.lineTo(24 * u, 10 * u);
      ctx.stroke();
      break;
    case 'truck':
      ctx.beginPath();
      ctx.roundRect(-30 * u, -24 * u, 60 * u, 40 * u, 6 * u);
      ctx.stroke();
      ctx.fillRect(-30 * u, -24 * u, 18 * u, 40 * u);
      ctx.fillRect(6 * u, -8 * u, 26 * u, 26 * u);
      break;
    case 'bus':
      ctx.beginPath();
      ctx.roundRect(-32 * u, -22 * u, 64 * u, 44 * u, 8 * u);
      ctx.stroke();
      for (let i = 0; i < 3; i += 1) ctx.fillRect((-26 + i * 22) * u, -16 * u, 14 * u, 12 * u);
      ctx.beginPath();
      ctx.arc(-20 * u, 24 * u, 7 * u, 0, Math.PI * 2);
      ctx.arc(20 * u, 24 * u, 7 * u, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'stand':
      ctx.beginPath();
      ctx.arc(0, -22 * u, 7 * u, 0, Math.PI * 2);
      ctx.moveTo(0, -12 * u);
      ctx.lineTo(0, 8 * u);
      ctx.moveTo(-14 * u, 22 * u);
      ctx.lineTo(0, 8 * u);
      ctx.lineTo(14 * u, 22 * u);
      ctx.stroke();
      break;
    case 'seatbelt':
      ctx.beginPath();
      ctx.moveTo(-24 * u, -24 * u);
      ctx.lineTo(24 * u, -24 * u);
      ctx.moveTo(-24 * u, -24 * u);
      ctx.lineTo(-24 * u, 12 * u);
      ctx.lineTo(24 * u, 12 * u);
      ctx.lineTo(24 * u, -24 * u);
      ctx.moveTo(-18 * u, -6 * u);
      ctx.lineTo(18 * u, 6 * u);
      ctx.stroke();
      break;
    case 'door':
      ctx.beginPath();
      ctx.moveTo(-20 * u, -26 * u);
      ctx.lineTo(20 * u, -26 * u);
      ctx.lineTo(20 * u, 26 * u);
      ctx.lineTo(-20 * u, 26 * u);
      ctx.lineTo(-20 * u, -26 * u);
      ctx.moveTo(0, -26 * u);
      ctx.lineTo(0, 26 * u);
      ctx.stroke();
      break;
    case 'handrail':
      ctx.beginPath();
      ctx.moveTo(-10 * u, -26 * u);
      ctx.lineTo(-10 * u, 26 * u);
      ctx.moveTo(10 * u, -26 * u);
      ctx.lineTo(10 * u, 26 * u);
      ctx.moveTo(-20 * u, -20 * u);
      ctx.lineTo(20 * u, -20 * u);
      ctx.stroke();
      break;
    case 'leanout':
      ctx.beginPath();
      ctx.arc(6 * u, -18 * u, 7 * u, 0, Math.PI * 2);
      ctx.moveTo(0, -8 * u);
      ctx.lineTo(-16 * u, 10 * u);
      ctx.moveTo(-20 * u, -14 * u);
      ctx.lineTo(0 * u, 2 * u);
      ctx.stroke();
      break;
    case 'run':
      ctx.beginPath();
      ctx.arc(0, -22 * u, 6 * u, 0, Math.PI * 2);
      ctx.moveTo(0, -14 * u);
      ctx.lineTo(2 * u, 8 * u);
      ctx.moveTo(-10 * u, 24 * u);
      ctx.lineTo(2 * u, 8 * u);
      ctx.lineTo(16 * u, 18 * u);
      ctx.moveTo(2 * u, 2 * u);
      ctx.lineTo(14 * u, -6 * u);
      ctx.stroke();
      break;
    case 'roadside':
      ctx.beginPath();
      ctx.moveTo(24 * u, 0);
      ctx.lineTo(-8 * u, -16 * u);
      ctx.moveTo(-8 * u, -16 * u);
      ctx.lineTo(-8 * u, 16 * u);
      ctx.lineTo(24 * u, 0);
      ctx.stroke();
      break;
    case 'curb':
      ctx.beginPath();
      ctx.moveTo(-28 * u, -6 * u);
      ctx.lineTo(28 * u, -6 * u);
      ctx.lineTo(28 * u, 8 * u);
      ctx.moveTo(-28 * u, 8 * u);
      ctx.lineTo(28 * u, 8 * u);
      ctx.moveTo(-24 * u, 18 * u);
      ctx.lineTo(24 * u, 18 * u);
      ctx.stroke();
      break;
    default:
      ctx.fillRect(-20 * u, -20 * u, 40 * u, 40 * u);
      break;
  }
  ctx.restore();
}

// ---- 选项标记 ----
function optionCenter(opt) {
  return { x: opt.x * W, y: SCENE_TOP + opt.y * SCENE_H };
}

function drawOptions(ctx, state, view) {
  const q = state && state.question;
  if (!q) return;
  const r = LAYOUT.OPTION_R;
  for (const opt of q.options) {
    const c = optionCenter(opt);
    const dim = state.hintRemoved === opt.i;
    const hovered = view.hoverOption === opt.i;
    const letter = LETTERS[opt.i] || '?';

    // 闪烁脉冲
    const pulse = 1 + 0.05 * Math.sin(view.time * 5 + opt.i);

    // 外圈
    const color = dim ? 'rgba(120,120,140,0.4)' : (hovered ? PAL.yellow : PAL.cyan);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(pulse, pulse);
    glow(ctx, dim ? 'transparent' : color, hovered ? 22 : 14);
    ctx.strokeStyle = color;
    ctx.lineWidth = dim ? 2 : 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    // 内底
    ctx.fillStyle = dim ? 'rgba(20,20,35,0.5)' : 'rgba(10,10,24,0.82)';
    ctx.fill();
    noGlow(ctx);

    // 图标
    drawIcon(ctx, opt.icon, 0, -r * 0.18, r * 0.9, dim ? 'rgba(150,150,170,0.5)' : PAL.white);

    // 字母徽章
    ctx.fillStyle = dim ? 'rgba(150,150,170,0.5)' : color;
    ctx.font = `700 ${Math.round(r * 0.62)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 0, r * 0.5);
    ctx.restore();

    // 标签
    const label = view.t(opt.labelKey);
    ctx.font = '700 16px "PingFang SC","Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = dim ? 'rgba(150,150,170,0.5)' : PAL.white;
    ctx.fillText(label, c.x, c.y + r + 10);
  }
}

// ---- 特效 ----
function drawFx(ctx, view) {
  for (const fx of view.fxQueue) {
    const q = view.state && view.state.question;
    if (!q) continue;
    const opt = q.options[fx.option];
    if (!opt) continue;
    const c = optionCenter(opt);
    const k = 1 - fx.ttl / fx.max;
    const color = fx.type === 'correct' ? PAL.green : PAL.magenta;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fx.ttl / fx.max);
    glow(ctx, color, 26);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(c.x, c.y, LAYOUT.OPTION_R + 6 + k * 26, 0, Math.PI * 2);
    ctx.stroke();
    noGlow(ctx);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  function draw(state, dt, view) {
    const t = view.time;
    drawBackdrop(ctx, t);
    if (state) {
      drawScene(ctx, state.question ? state.question.scene : 'road', t);
      drawOptions(ctx, state, view);
      drawFx(ctx, view);
    }
  }

  // 命中测试：返回 {option} 或 null
  function pick(px, py, state) {
    if (!state || !state.question) return null;
    const r = LAYOUT.OPTION_R + 18;
    for (const opt of state.question.options) {
      const c = optionCenter(opt);
      const dx = px - c.x;
      const dy = py - c.y;
      if (dx * dx + dy * dy <= r * r) return opt;
    }
    return null;
  }

  function debugLayout() {
    const grid = { x: 0, y: SCENE_TOP, w: W, h: SCENE_H };
    return { grid, sceneTop: SCENE_TOP, sceneH: SCENE_H, optionR: LAYOUT.OPTION_R };
  }

  return { draw, pick, resize, debugLayout };
}
