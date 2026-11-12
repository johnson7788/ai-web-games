// Canvas 2D 渲染：工业车间背景 + 拉丝金属板 + 螺丝 + 粒子/拖影/震屏。
// 所有材质均为程序化绘制，固定 seed（不每帧随机），无图片。
import { WORLD, GAME } from '../../config/game.config.js';
import { screwWorld } from '../game/level.js';

// 兼容旧浏览器：roundRect 缺失时补齐（本项目只用单圆角半径）。
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
    return this;
  };
}

// —— 颜色工具 ——
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
function shade(hex, amt) {
  const [r, g, b] = rgb(hex);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
function rgba(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// 确定性伪随机（固定 seed，避免每帧闪动）。
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// —— 背景：暗色工业车间（径向聚光 + 蓝图网格 + 暗角）——
function makeBackground() {
  const c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  const g = c.getContext('2d');

  // 基底
  g.fillStyle = '#101216';
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 顶部径向聚光（车间顶灯）
  const spot = g.createRadialGradient(WORLD.WIDTH / 2, 70, 40, WORLD.WIDTH / 2, 70, WORLD.WIDTH * 0.85);
  spot.addColorStop(0, 'rgba(120,140,165,0.34)');
  spot.addColorStop(0.45, 'rgba(60,70,88,0.12)');
  spot.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = spot;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 蓝图网格（低对比，主/次两档）
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(96,120,150,0.10)';
  g.beginPath();
  for (let x = 0; x <= WORLD.WIDTH; x += 40) { g.moveTo(x, 0); g.lineTo(x, WORLD.HEIGHT); }
  for (let y = 0; y <= WORLD.HEIGHT; y += 40) { g.moveTo(0, y); g.lineTo(WORLD.WIDTH, y); }
  g.stroke();
  g.strokeStyle = 'rgba(120,150,185,0.16)';
  g.beginPath();
  for (let x = 0; x <= WORLD.WIDTH; x += 160) { g.moveTo(x, 0); g.lineTo(x, WORLD.HEIGHT); }
  for (let y = 0; y <= WORLD.HEIGHT; y += 160) { g.moveTo(0, y); g.lineTo(WORLD.WIDTH, y); }
  g.stroke();

  // 四角暗角
  const vig = g.createRadialGradient(
    WORLD.WIDTH / 2, WORLD.HEIGHT / 2, WORLD.HEIGHT * 0.42,
    WORLD.WIDTH / 2, WORLD.HEIGHT / 2, WORLD.WIDTH * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.62)');
  g.fillStyle = vig;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  return c;
}

// 漂浮尘埃（固定 seed 生成，按时间缓慢漂移）
function makeDust(count) {
  const rnd = mulberry32(0xc0ffee);
  const dust = [];
  for (let i = 0; i < count; i += 1) {
    dust.push({
      x: rnd() * WORLD.WIDTH,
      y: rnd() * WORLD.HEIGHT,
      r: 1 + rnd() * 2.4,
      speed: 6 + rnd() * 18,
      drift: (rnd() - 0.5) * 8,
      phase: rnd() * Math.PI * 2,
      a: 0.05 + rnd() * 0.12,
    });
  }
  return dust;
}

function drawDustField(ctx, dust, now) {
  const t = now / 1000;
  for (const d of dust) {
    const y = (d.y + t * d.speed) % (WORLD.HEIGHT + 20) - 10;
    const x = ((d.x + d.drift * t) % (WORLD.WIDTH + 40) + WORLD.WIDTH + 40) % (WORLD.WIDTH + 40) - 20 + Math.sin(t * 0.4 + d.phase) * 10;
    ctx.globalAlpha = d.a;
    ctx.fillStyle = '#c8d4e0';
    ctx.beginPath();
    ctx.arc(x, y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// —— 螺丝 ——
function drawScrew(ctx, x, y, r, { cross, covered, alpha = 1, rot = 0, scale = 1, glow = false }) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  // 投影
  ctx.beginPath();
  ctx.arc(2, 3, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fill();

  // 金属外环（上亮下暗）
  const ring = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  ring.addColorStop(0, covered ? '#9aa0a8' : '#eef2f6');
  ring.addColorStop(0.55, covered ? '#565c64' : '#aab4bd');
  ring.addColorStop(1, covered ? '#262a30' : '#525c66');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();

  // 内凹盘
  const hr = r * 0.62;
  const dish = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, hr);
  dish.addColorStop(0, covered ? '#33383f' : '#cdd6de');
  dish.addColorStop(1, covered ? '#16181c' : '#5d6872');
  ctx.beginPath();
  ctx.arc(0, 0, hr, 0, Math.PI * 2);
  ctx.fillStyle = dish;
  ctx.fill();

  // 十字/一字槽
  ctx.strokeStyle = covered ? '#0b0d10' : '#232b33';
  ctx.lineWidth = Math.max(1.6, r * 0.17);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-hr * 0.74, 0);
  ctx.lineTo(hr * 0.74, 0);
  if (cross) { ctx.moveTo(0, -hr * 0.74); ctx.lineTo(0, hr * 0.74); }
  ctx.stroke();
  // 槽内高光
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-hr * 0.74, -r * 0.09);
  ctx.lineTo(hr * 0.74, -r * 0.09);
  ctx.stroke();

  // 顶部高光弧
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, r - 1.4, -2.35, -0.9);
  ctx.stroke();

  // 暖色辉光（悬停）
  if (glow) {
    ctx.strokeStyle = 'rgba(255,196,110,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// 小锁（被遮挡螺丝的提示，替换掉原来的黑色实心块）
function drawLock(ctx, x, y, r) {
  const s = r * 0.5;
  ctx.save();
  ctx.translate(x, y - r - s * 0.55);
  ctx.strokeStyle = '#f0c060';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -s * 0.28, s * 0.42, Math.PI, 0);
  ctx.stroke();
  const g = ctx.createLinearGradient(0, -s * 0.3, 0, s * 0.6);
  g.addColorStop(0, '#f4cf7a');
  g.addColorStop(1, '#c9942f');
  ctx.fillStyle = g;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-s * 0.5, -s * 0.3, s, s * 0.85, 2);
  else ctx.rect(-s * 0.5, -s * 0.3, s, s * 0.85);
  ctx.fill();
  ctx.fillStyle = '#5a4413';
  ctx.beginPath();
  ctx.arc(0, s * 0.04, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-s * 0.07, s * 0.04, s * 0.14, s * 0.3);
  ctx.restore();
}

// —— 板：拉丝金属 + 高光边 + 投影 + 铆钉 + 划痕 ——
function drawPlate(ctx, p, layer) {
  const hw = p.w / 2;
  const hh = p.h / 2;
  const rad = Math.min(8, hh * 0.14);
  const rnd = mulberry32((p.id + 1) * 0x9e3779b9);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);

  // 外投影（上层板更重、更远）
  const dx = 4 + layer * 2.5;
  const dy = 6 + layer * 2.5;
  ctx.fillStyle = `rgba(0,0,0,${0.26 + layer * 0.07})`;
  ctx.beginPath();
  ctx.roundRect(-hw + dx, -hh + dy, p.w, p.h, rad);
  ctx.fill();

  // 拉丝金属主体（多层线性渐变：上亮下暗）
  const grad = ctx.createLinearGradient(0, -hh, 0, hh);
  grad.addColorStop(0, shade(p.color, 36));
  grad.addColorStop(0.22, shade(p.color, 12));
  grad.addColorStop(0.5, p.color);
  grad.addColorStop(0.85, shade(p.color, -24));
  grad.addColorStop(1, shade(p.color, -42));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, p.w, p.h, rad);
  ctx.fill();

  // 侧面冷暖反光（左亮右暗）
  const sheen = ctx.createLinearGradient(-hw, 0, hw, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, p.w, p.h, rad);
  ctx.fill();

  // 拉丝纹理 + 划痕（固定 seed，裁剪在板内）
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, p.w, p.h, rad);
  ctx.clip();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  for (let y = -hh + 6; y < hh - 3; y += 9) {
    const j = (rnd() - 0.5) * 2.5;
    ctx.moveTo(-hw + 6, y + j);
    ctx.lineTo(hw - 6, y + j);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.beginPath();
  for (let y = -hh + 10; y < hh - 4; y += 17) {
    ctx.moveTo(-hw + 6, y);
    ctx.lineTo(hw - 6, y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.beginPath();
  for (let i = 0; i < 4; i += 1) {
    const yy = -hh * 0.45 + rnd() * p.h * 0.9;
    const xx = -hw * 0.7 + rnd() * p.w * 0.7;
    const len = 10 + rnd() * 30;
    ctx.moveTo(xx, yy);
    ctx.lineTo(xx + len, yy + (rnd() - 0.5) * 2);
  }
  ctx.stroke();
  ctx.restore();

  // 描边 + 内高光边
  ctx.strokeStyle = shade(p.color, -66);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, p.w, p.h, rad);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-hw + rad, -hh + 1);
  ctx.lineTo(hw - rad, -hh + 1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.32)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-hw + rad, hh - 1);
  ctx.lineTo(hw - rad, hh - 1);
  ctx.stroke();

  // 角部铆钉（4 个）
  const rx = Math.min(22, hw * 0.12, hh * 0.24);
  const ry = Math.min(22, hh * 0.24);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const bx = sx * (hw - rx);
    const by = sy * (hh - ry);
    ctx.beginPath();
    ctx.arc(bx, by, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = shade(p.color, -62);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx - 0.9, by - 0.9, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
  }

  ctx.restore();
}

// —— 粒子：飞向 HUD 的螺丝（旋转 + 缩小 + 拖影）——
function drawFlyScrew(ctx, e, r) {
  const k = Math.min(1, e.t / e.ttl);
  const alpha = k > 0.8 ? (1 - k) / 0.2 : 1;
  // 按下先缩到 0.94，再边旋边缩飞向 HUD
  const scale = k < 0.2 ? 0.94 + (k / 0.2) * 0.06 : 1 - 0.85 * ((k - 0.2) / 0.8);
  // 拖影：沿路径回退几个幽灵（vx/vy 为每帧位移）
  for (let i = 1; i <= 3; i += 1) {
    const gx = e.x - e.vx * i;
    const gy = e.y - e.vy * i;
    drawScrew(ctx, gx, gy, r * (scale + 0.1), { cross: e.cross, alpha: alpha * 0.25 * (1 - i / 4), rot: e.rot });
  }
  drawScrew(ctx, e.x, e.y, r, { cross: e.cross, alpha, rot: e.rot, scale: Math.max(0.15, scale) });
}

// —— 粒子：落地烟尘（柔软上升）——
function drawDust(ctx, e) {
  const k = e.t / e.ttl;
  const a = (1 - k) * 0.5;
  const r = e.size * (1 + k * 1.6);
  const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
  grad.addColorStop(0, `rgba(178,186,196,${a})`);
  grad.addColorStop(1, 'rgba(178,186,196,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const bg = makeBackground();
  const dust = makeDust(22);

  return {
    render(view) {
      ctx.drawImage(bg, 0, 0);
      drawDustField(ctx, dust, performance.now());

      const level = view.level;
      if (!level) return;
      const st = level.getState();

      ctx.save();
      ctx.translate(view.shakeX || 0, view.shakeY || 0);

      for (const p of st.plates) {
        if (!p.removed) drawPlate(ctx, p, p.id);
      }
      for (const p of st.plates) {
        if (p.removed) continue;
        for (const s of p.screws) {
          if (s.removed) continue;
          const w = screwWorld(p, s);
          const hover = view.hoverScrewId === s.id && !s.covered;
          drawScrew(ctx, w.x, w.y, GAME.SCREW_RADIUS, {
            cross: s.cross,
            covered: s.covered,
            alpha: s.covered ? 0.5 : 1,
            rot: 0,
            scale: hover ? 1.08 : 1,
            glow: hover,
          });
          if (s.covered) {
            // 暗色环 + 小锁
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(w.x, w.y, GAME.SCREW_RADIUS + 2, 0, Math.PI * 2);
            ctx.stroke();
            drawLock(ctx, w.x, w.y, GAME.SCREW_RADIUS);
          }
          if (view.lockFlash && view.lockFlash.id === s.id && view.lockFlash.t > 0) {
            ctx.strokeStyle = `rgba(240,192,96,${Math.min(1, view.lockFlash.t * 6)})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(w.x, w.y, GAME.SCREW_RADIUS + 7, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      for (const e of view.effects || []) {
        if (e.kind === 'flyScrew') drawFlyScrew(ctx, e, GAME.SCREW_RADIUS);
        else if (e.kind === 'dust') drawDust(ctx, e);
      }

      ctx.restore();
    },
  };
}
