// COLOR FLUX · 障碍渲染：极光环带（单环/双弧/十字/风车/嵌套双环），程序化发光 Canvas
import { WORLD } from '../../config/gameplay.js';
import { COLORS } from '../../config/gameplay.js';
import { rotOf } from '../game/sim.js';

const TAU = Math.PI * 2;
const CX = WORLD.BALL_X;
const RADIUS = 150;
const THICK = 26;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// 段角度区间（弧度）
function segmentArcs(o) {
  const segCount = o.segCount;
  const segAngle = TAU / segCount;
  const rot = ((rotOf(o, o._renderTime ?? 0) * Math.PI) / 180);
  const arcs = [];
  for (let i = 0; i < segCount; i += 1) {
    // 屏幕 y 向下：角度 0 = 右，π/2 = 下。环段按世界角度逆时针排布。
    const a0 = -Math.PI / 2 + rot + i * segAngle;
    arcs.push({ a0, a1: a0 + segAngle, color: COLORS[o.colors[i]] });
  }
  return arcs;
}

function drawSegments(ctx, o, x, y, radius, thickness, arcs, alpha = 1, ballColor = -1) {
  for (const arc of arcs) {
    const isMatch = arc.color.id === ballColor;
    const a = isMatch ? alpha : alpha * 0.82;
    ctx.beginPath();
    ctx.arc(x, y, radius, arc.a0, arc.a1);
    ctx.strokeStyle = rgba(arc.color.hex, a);
    ctx.lineWidth = isMatch ? thickness + 5 : thickness;
    ctx.lineCap = 'butt';
    ctx.stroke();
    // 内圈发光描边（匹配段更亮）
    ctx.beginPath();
    ctx.arc(x, y, radius, arc.a0, arc.a1);
    ctx.strokeStyle = rgba(arc.color.hex, isMatch ? 0.6 * alpha : 0.35 * alpha);
    ctx.lineWidth = thickness + 8;
    ctx.stroke();
  }
}

function drawRing(ctx, o, x, y, ballColor) {
  const arcs = segmentArcs(o);
  drawSegments(ctx, o, x, y, RADIUS, THICK, arcs, 1, ballColor);
  // 中心洞
  ctx.beginPath();
  ctx.arc(x, y, RADIUS - THICK - 6, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
}

function drawArc2(ctx, o, x, y, ballColor) {
  // 双弧：上下两段大弧 + 左右缺口
  const arcs = segmentArcs(o);
  drawSegments(ctx, o, x, y, RADIUS, THICK, arcs, 1, ballColor);
}

function drawCross(ctx, o, x, y, ballColor) {
  // 十字：四根辐条从中心伸出
  const rot = (rotOf(o, o._renderTime ?? 0) * Math.PI) / 180;
  const segCount = o.segCount;
  const segAngle = TAU / segCount;
  for (let i = 0; i < segCount; i += 1) {
    const a = -Math.PI / 2 + rot + i * segAngle;
    const c = COLORS[o.colors[i]];
    const isMatch = o.colors[i] === ballColor;
    const x2 = x + Math.cos(a) * RADIUS;
    const y2 = y + Math.sin(a) * RADIUS;
    ctx.strokeStyle = rgba(c.hex, isMatch ? 1 : 0.8);
    ctx.lineWidth = isMatch ? THICK + 5 : THICK;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = rgba(c.hex, isMatch ? 0.55 : 0.3);
    ctx.lineWidth = THICK + 10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
}

function drawWindmill(ctx, o, x, y, ballColor) {
  // 风车：12 段细叶片
  const rot = (rotOf(o, o._renderTime ?? 0) * Math.PI) / 180;
  const segCount = o.segCount;
  const segAngle = TAU / segCount;
  for (let i = 0; i < segCount; i += 1) {
    const a = -Math.PI / 2 + rot + i * segAngle;
    const c = COLORS[o.colors[i]];
    const isMatch = o.colors[i] === ballColor;
    ctx.beginPath();
    ctx.arc(x, y, RADIUS, a, a + segAngle);
    ctx.strokeStyle = rgba(c.hex, isMatch ? 1 : 0.7);
    ctx.lineWidth = isMatch ? 16 : 12;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, RADIUS - 40, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
}

function drawNested(ctx, o, x, y, ballColor) {
  // 嵌套双环：内环参与判定，外环反向旋转装饰
  const arcs = segmentArcs(o);
  drawSegments(ctx, o, x, y, RADIUS - 34, 18, arcs, 1, ballColor);
  // 外环装饰（反向）
  const rot = (rotOf(o, o._renderTime ?? 0) * Math.PI) / 180;
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI / 2 - rot + (i / 6) * TAU;
    ctx.beginPath();
    ctx.arc(x, y, RADIUS + 16, a, a + TAU / 12);
    ctx.strokeStyle = rgba(COLORS[i].hex, 0.5);
    ctx.lineWidth = 10;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, RADIUS - 60, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
}

export function drawObstacle(ctx, o, time, sceneAccent, ballColor = -1) {
  const x = CX;
  const y = o.y;
  o._renderTime = time;

  // 韵律环脉冲光晕
  if (o.isRhythm) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 12);
    const g = ctx.createRadialGradient(x, y, 0, x, y, RADIUS + 30);
    g.addColorStop(0, `rgba(255,255,255,${0.10 + 0.12 * pulse})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - RADIUS - 40, y - RADIUS - 40, (RADIUS + 40) * 2, (RADIUS + 40) * 2);
  }

  switch (o.shape) {
    case 'arc2': drawArc2(ctx, o, x, y, ballColor); break;
    case 'cross': drawCross(ctx, o, x, y, ballColor); break;
    case 'windmill': drawWindmill(ctx, o, x, y, ballColor); break;
    case 'nested': drawNested(ctx, o, x, y, ballColor); break;
    default: drawRing(ctx, o, x, y, ballColor);
  }

  // 场景 accent 外圈光
  ctx.beginPath();
  ctx.arc(x, y, RADIUS + 24, 0, TAU);
  ctx.strokeStyle = sceneAccent;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.25;
  ctx.stroke();
  ctx.globalAlpha = 1;
}
