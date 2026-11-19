// Canvas 2D 渲染：霓虹街机风格的泡泡点消。
// 只消费 run.state（sim 契约）+ dt；像素换算全部在此完成（sim 不依赖像素）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), hitTest(x,y,state),
//   bubbleRects(state), debugLayout(state), burst(x,y,colorKey), shake(amp), float(x,y,text,color), resize() }。

import { WORLD, GAME } from '../../config/game.config.js';
import { t } from '../core/i18n.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

const NEON = {
  blue:   { main: '#3BA7FF', glow: 'rgba(59,167,255,0.55)', deep: '#0A3E6B' },
  red:    { main: '#FF4D6D', glow: 'rgba(255,77,109,0.55)', deep: '#5C0E24' },
  green:  { main: '#3DF5A8', glow: 'rgba(61,245,168,0.55)', deep: '#0A4A33' },
  orange: { main: '#FF9F3D', glow: 'rgba(255,159,61,0.55)', deep: '#5C2E0A' },
  purple: { main: '#C26BFF', glow: 'rgba(194,107,255,0.55)', deep: '#3A0A5C' },
  rock:   { main: '#8A93A6', glow: 'rgba(138,147,166,0.40)', deep: '#2B2F38' },
};

const REDUCE_MOTION = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ 布局
function targetRect() {
  return { x: W / 2 - 190, y: 96, w: 380, h: 82 };
}

function timerRect() {
  return { x: 200, y: 638, w: 880, h: 16 };
}

function bubbleRects(state) {
  const n = state.bubbles.length;
  const maxR = n <= 5 ? 84 : 72;
  const cy = 470;
  const rects = [];
  for (let i = 0; i < n; i += 1) {
    const x = ((i + 1) / (n + 1)) * W;
    rects.push({ id: state.bubbles[i].id, x, y: cy, r: maxR });
  }
  return rects;
}

// ------------------------------------------------------------------ 背景
function drawBackground(ctx, dt) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0B0F1E');
  g.addColorStop(0.55, '#11152A');
  g.addColorStop(1, '#160F2B');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 霓虹地平线
  ctx.save();
  ctx.strokeStyle = 'rgba(194,107,255,0.28)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(194,107,255,0.7)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(0, 560);
  ctx.lineTo(W, 560);
  ctx.stroke();
  ctx.restore();

  // 透视网格（下半屏）
  ctx.save();
  ctx.strokeStyle = 'rgba(59,167,255,0.10)';
  ctx.lineWidth = 1;
  const horizon = 560;
  for (let i = 1; i <= 8; i += 1) {
    const y = horizon + Math.pow(i / 8, 2) * (H - horizon - 24);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  const vp = W / 2;
  for (let i = -8; i <= 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(vp + i * 60, horizon);
    ctx.lineTo(vp + i * 260, H);
    ctx.stroke();
  }
  ctx.restore();

  // 扫描线
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.restore();
}

// 标题屏装饰泡泡（纯程序化）
const TITLE_BUBBLES = (() => {
  const cols = ['blue', 'red', 'green', 'orange', 'purple'];
  const out = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 26; i += 1) {
    out.push({
      x: rnd() * W,
      y: 200 + rnd() * (H - 260),
      r: 8 + rnd() * 26,
      c: cols[i % cols.length],
      spd: 6 + rnd() * 22,
      phase: rnd() * Math.PI * 2,
    });
  }
  return out;
})();

function drawTitleDecor(ctx, dt) {
  for (const b of TITLE_BUBBLES) {
    const y = b.y + Math.sin(b.phase + dt * b.spd * 0.1) * 14;
    const c = NEON[b.c];
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.shadowColor = c.main;
    ctx.shadowBlur = 14;
    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.arc(b.x, y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ------------------------------------------------------------------ 泡泡
function drawBubble(ctx, rect, b, dt, pulse) {
  const c = b.kind === 'rock' ? NEON.rock : NEON[b.color];
  const { x, y, r } = rect;

  ctx.save();
  // 外发光
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 22;
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  grad.addColorStop(0, b.kind === 'rock' ? '#B7BDCE' : '#EAF6FF');
  grad.addColorStop(0.35, c.main);
  grad.addColorStop(1, c.deep);
  ctx.fillStyle = grad;
  ctx.beginPath();
  if (b.kind === 'rock') {
    // 岩石：多边形 + 裂纹
    const sides = 8;
    for (let i = 0; i < sides; i += 1) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const rr = r * (i % 2 === 0 ? 1 : 0.88);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#565D6E';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.38, r * 0.32, r * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 泡泡上的「文字」（斯特鲁普干扰）：白字 + 深色描边
  ctx.save();
  ctx.font = `900 ${Math.max(22, Math.floor(r * 0.52))}px "Courier New", "PingFang SC", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelText = t('color_' + b.label);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.strokeText(labelText, x, y);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(labelText, x, y);
  ctx.restore();
}

// ------------------------------------------------------------------ 目标条 / 计时条
function drawTargetPill(ctx, state, dt) {
  const r = targetRect();
  const c = NEON[state.target] || NEON.blue;

  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 20;
  ctx.fillStyle = 'rgba(8,10,20,0.88)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 18);
  ctx.fill();
  ctx.strokeStyle = c.main;
  ctx.lineWidth = 2.5;
  roundRect(ctx, r.x, r.y, r.w, r.h, 18);
  ctx.stroke();
  ctx.restore();

  // 目标色块
  ctx.save();
  ctx.shadowColor = c.main;
  ctx.shadowBlur = 14;
  ctx.fillStyle = c.main;
  ctx.beginPath();
  ctx.arc(r.x + 46, r.y + r.h / 2, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 目标词
  ctx.save();
  const targetText = t('color_' + state.target);
  ctx.font = '900 34px "Courier New", "PingFang SC", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(targetText, r.x + 92, r.y + r.h / 2 + 2);
  ctx.restore();
}

function drawTimer(ctx, state, dt) {
  const r = timerRect();
  const frac = Math.max(0, Math.min(1, state.roundTtl / GAME.ROUND_TTL));
  const color = frac < 0.3 ? '#FF4D6D' : frac < 0.6 ? '#FF9F3D' : '#3DF5A8';

  ctx.save();
  ctx.fillStyle = 'rgba(8,10,20,0.85)';
  roundRect(ctx, r.x - 8, r.y - 8, r.w + 16, r.h + 16, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 6);
  ctx.fill();

  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  roundRect(ctx, r.x, r.y, Math.max(4, r.w * frac), r.h, 6);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ------------------------------------------------------------------ 粒子 / 浮动分 / 闪屏
function makeParticles(fx, x, y, colorKey, count) {
  const c = NEON[colorKey] || NEON.blue;
  for (let i = 0; i < count; i += 1) {
    if (fx.particles.length >= GAME.MAX_PARTICLES) break;
    const a = Math.random() * Math.PI * 2;
    const sp = 120 + Math.random() * 260;
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 90,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1,
      size: 2 + Math.random() * 4,
      color: c.main,
    });
  }
}

// ------------------------------------------------------------------ 渲染器
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  const fx = { particles: [], floaters: [], shake: 0, flash: 0 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, GAME.DPR_MAX);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  function updateFx(dt) {
    for (const p of fx.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 520 * dt;
      p.life -= dt;
    }
    fx.particles = fx.particles.filter((p) => p.life > 0);
    for (const f of fx.floaters) {
      f.y -= 46 * dt;
      f.life -= dt;
    }
    fx.floaters = fx.floaters.filter((f) => f.life > 0);
    if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt * 26);
    if (fx.flash > 0) fx.flash = Math.max(0, fx.flash - dt * 2.4);
  }

  function draw(state, dt, view) {
    const step = dt == null ? 0 : dt;
    updateFx(step);
    drawBackground(ctx, step);

    ctx.save();
    if (fx.shake > 0) {
      ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    }

    if (!state) {
      drawTitleDecor(ctx, step);
    } else {
      drawTimer(ctx, state, step);
      drawTargetPill(ctx, state, step);
      const rects = bubbleRects(state);
      for (let i = 0; i < rects.length; i += 1) {
        const b = state.bubbles[i];
        const pulse = REDUCE_MOTION ? 0 : Math.sin(step * 3 + i) * 0.02 + 1;
        const rr = { ...rects[i], r: rects[i].r * pulse };
        drawBubble(ctx, rr, b, step, pulse);
      }
    }
    ctx.restore();

    // 粒子
    ctx.save();
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 浮动得分
    ctx.save();
    ctx.font = '900 30px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of fx.floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();

    // 闪白
    if (fx.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, fx.flash);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  return {
    draw,
    resize,
    hitTest(x, y, state) {
      if (!state || state.phase === 'over') return null;
      const rects = bubbleRects(state);
      for (let i = rects.length - 1; i >= 0; i -= 1) {
        const r = rects[i];
        const dx = x - r.x;
        const dy = y - r.y;
        if (dx * dx + dy * dy <= (r.r + 8) * (r.r + 8)) return state.bubbles[i].id;
      }
      return null;
    },
    bubbleRects,
    debugLayout(state) {
      const t = targetRect();
      const timer = timerRect();
      const rects = bubbleRects(state || { bubbles: [] });
      return {
        target: { x: t.x, y: t.y, w: t.w, h: t.h },
        timer: { x: timer.x, y: timer.y, w: timer.w, h: timer.h },
        bubble: rects.length ? { x: rects[0].x - rects[0].r, y: rects[0].y - rects[0].r, w: rects[0].r * 2, h: rects[0].r * 2 } : null,
        bubbles: rects.map((r) => ({ id: r.id, x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 })),
      };
    },
    burst(x, y, colorKey, count = 14) {
      if (REDUCE_MOTION) return;
      makeParticles(fx, x, y, colorKey, count);
    },
    float(x, y, text, color) {
      fx.floaters.push({ x, y, text, color, life: 1 });
    },
    shake(amp = 6) {
      if (REDUCE_MOTION) return;
      fx.shake = Math.min(14, Math.max(fx.shake, amp));
    },
    flash() {
      if (REDUCE_MOTION) return;
      fx.flash = 1;
    },
  };
}
