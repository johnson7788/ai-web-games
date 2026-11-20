// 鳗头 + 珠链（径向渐变光球/加法混合）+ 沿轨迹切线游动弯曲 + dash 光束。
import { EEL, clamp, hexToRgb, rgbCss } from './theme.js';

const TAU = Math.PI * 2;

function drawGlowSprite(ctx, spr, x, y, r, alpha) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, x - r, y - r, r * 2, r * 2);
}

function smoothPath(ctx, points) {
  ctx.beginPath();
  if (points.length === 1) {
    ctx.moveTo(points[0].x, points[0].y);
    return;
  }
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i += 1) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawBody(ctx, points, pal, dashing) {
  if (points.length < 2) return;
  const wGlow = dashing ? EEL.bodyGlowWidth * 2.4 : EEL.bodyGlowWidth;
  const wCore = dashing ? EEL.bodyWidth * 1.8 : EEL.bodyWidth;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgbCss(hexToRgb(pal.glow), dashing ? 0.5 : 0.28);
  ctx.lineWidth = wGlow;
  smoothPath(ctx, points);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = dashing ? '#eaffff' : 'rgba(220,255,255,0.85)';
  ctx.lineWidth = wCore;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  smoothPath(ctx, points);
  ctx.stroke();
}

function drawHead(ctx, x, y, ang, dashing, now, sprites) {
  const R = EEL.headRadius;
  const L = R * 2.1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  // 头部光晕
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlowSprite(ctx, sprites.orbCyan, 0, 0, EEL.headGlow, dashing ? 1 : 0.85);
  ctx.restore();
  // 头身（泪滴，鼻尖朝 +x）
  ctx.fillStyle = dashing ? '#bfefff' : '#8ee6ff';
  ctx.beginPath();
  ctx.moveTo(L, 0);
  ctx.quadraticCurveTo(R * 0.5, -R, -R * 0.7, -R * 0.72);
  ctx.quadraticCurveTo(-R * 0.9, 0, -R * 0.7, R * 0.72);
  ctx.quadraticCurveTo(R * 0.5, R, L, 0);
  ctx.closePath();
  ctx.fill();
  // 背鳍（扇动）
  const flap = Math.sin(now * 0.001 * EEL.finFlapSpeed) * 0.6;
  ctx.fillStyle = 'rgba(120,230,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(-R * 0.2, -R * 0.6);
  ctx.quadraticCurveTo(R * 0.1, -R * (1.3 + flap), -R * 0.4, -R * 0.5);
  ctx.closePath();
  ctx.fill();
  // 眼
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(R * 0.5, -R * 0.3, R * 0.34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#062030';
  ctx.beginPath();
  ctx.arc(R * 0.62, -R * 0.3, R * 0.17, 0, TAU);
  ctx.fill();
  // dash 蓝色喷焰
  if (dashing) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i += 1) {
      const fl = Math.sin(now * 0.02 + i * 1.7) * 5;
      const fx = -R * 0.6 - i * 6;
      ctx.fillStyle = `rgba(${70 + i * 30},${160 + i * 20},255,${0.75 - i * 0.13})`;
      ctx.beginPath();
      ctx.moveTo(fx, 0);
      ctx.lineTo(fx - 14 - fl, -R * 0.5);
      ctx.lineTo(fx - 14 - fl, R * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawDashBeam(ctx, x, y, ang, pal) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalCompositeOperation = 'lighter';
  const len = EEL.dashBeamLen;
  const glowRgb = hexToRgb(pal.glow);
  const g = ctx.createLinearGradient(-len * 0.6, 0, len, 0);
  g.addColorStop(0, rgbCss(glowRgb, 0));
  g.addColorStop(0.5, rgbCss(glowRgb, 0.55));
  g.addColorStop(1, rgbCss(glowRgb, 0));
  ctx.strokeStyle = g;
  ctx.lineWidth = EEL.bodyGlowWidth * 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len * 0.6, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  // 白色核心
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = EEL.bodyWidth * 1.4;
  ctx.beginPath();
  ctx.moveTo(-len * 0.3, 0);
  ctx.lineTo(len * 0.8, 0);
  ctx.stroke();
  // 叠半透明层模拟轻微径向模糊感
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#7df9ff';
  ctx.lineWidth = EEL.bodyGlowWidth * 3.2;
  ctx.beginPath();
  ctx.moveTo(-len * 0.4, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.restore();
}

export function drawEel(ctx, o) {
  const { headX, headY, orbs, dashing, now, sprites, pal } = o;
  const pts = [{ x: headX, y: headY }];
  if (orbs && orbs.length) for (const b of orbs) pts.push({ x: b.x, y: b.y });

  // 头朝向：沿轨迹切线（鼻尖朝行进方向，与珠链方向相反）。
  let ang = -Math.PI / 2;
  if (pts.length >= 2) {
    ang = Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x);
  } else if (o.headVx !== undefined) {
    ang = -Math.PI / 2 + clamp(o.headVx * 0.004, -0.6, 0.6);
  }

  drawBody(ctx, pts, pal, dashing);

  // 珠链（加法混合径向光球）
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const breathe = 0.82 + 0.18 * Math.sin(now * 0.0032);
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const a = i === 0 ? 1 : 0.85 * breathe;
    const r = i === 0 ? EEL.orbGlow : EEL.orbGlow * 0.9;
    drawGlowSprite(ctx, sprites.orbCyan, p.x, p.y, r, a);
  }
  ctx.restore();

  // 珠核
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const r = i === 0 ? EEL.orbRadius + 1 : EEL.orbRadius;
    ctx.fillStyle = '#eaffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
  }

  if (dashing) drawDashBeam(ctx, headX, headY, ang, pal);
  drawHead(ctx, headX, headY, ang, dashing, now, sprites);
}
