// zone≥3 的光半径暗角：径向遮罩，珠多亮、珠少暗。
import { WORLD, LIGHT, hexToRgb, rgbCss, clamp } from './theme.js';

export function drawLightMask(ctx, o) {
  const alpha = clamp(o.alpha, 0, 1);
  if (!o.active || alpha <= 0.001) return;
  const r = Math.max(60, o.radius);
  const hx = o.headX;
  const hy = o.headY;
  // 暗角：中心透明 → 半径外暗
  const g = ctx.createRadialGradient(hx, hy, r * 0.12, hx, hy, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.72, `rgba(0,0,0,${(0.22 * alpha).toFixed(3)})`);
  g.addColorStop(1, `rgba(0,0,0,${(LIGHT.darkAlpha * alpha).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  // 中心微光
  const glowRgb = hexToRgb(o.glow);
  const c = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.55);
  c.addColorStop(0, rgbCss(glowRgb, LIGHT.centerGlow * alpha));
  c.addColorStop(1, rgbCss(glowRgb, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = c;
  ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
  ctx.restore();
}
