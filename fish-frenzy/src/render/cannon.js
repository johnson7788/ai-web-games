// FISH FRENZY · 炮台绘制：底部中心旋转炮管 + 档位指示（颜色随档位）。
import { CANNON_COL, TIER_COLORS, WORLD } from './theme.js';

export function drawCannon(ctx, cannon, now = 0) {
  const cx = WORLD.CANNON_X;
  const cy = WORLD.CANNON_Y;
  const tier = Math.max(1, Math.min(7, cannon.tier || 1));
  const tierCol = TIER_COLORS[tier - 1];

  // 底座
  ctx.fillStyle = CANNON_COL.base;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 底座辉光
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 34);
  g.addColorStop(0, CANNON_COL.glow);
  g.addColorStop(1, 'rgba(84,231,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - 40, cy - 40, 80, 80);

  // 炮管（随角度旋转，颜色随档位）
  const ang = cannon.angle ?? -Math.PI / 2;
  const len = 46 + tier * 4;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);

  ctx.fillStyle = tierCol;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-8, -len, 16, len + 8, 8);
  ctx.fill();
  ctx.stroke();

  // 炮口亮斑
  ctx.fillStyle = CANNON_COL.tip;
  ctx.beginPath();
  ctx.arc(0, -len - 3, 5 + Math.sin(now * 6) * 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 档位文字
  ctx.fillStyle = '#0b1020';
  ctx.font = 'bold 15px ' + '"SF Mono","Menlo",monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(tier), cx, cy + 1);
}
