// CAT TACTICS · Canvas 2D 渲染：霓虹街机风，全程序化（零素材）。
// 布局：左侧 3×4 车位网格，右侧霓虹赛道，左下回收区。猫 = 几何霓虹猫。
import { WORLD, coinPerSec, lapSeconds } from '../../config/game.config.js';
import { SLOT_COUNT } from '../game/sim.js';

// ---------- 布局常量（与 sim 无关，纯像素） ----------
const SLOT_COLS = [36, 214, 392];
const SLOT_W = 166;
const SLOT_H = 116;
const SLOT_ROWS = [96, 228, 360, 492];

const TRACK_OUTER = { x: 660, y: 118, w: 580, h: 524, r: 30 };
const TRACK_INNER = { x: 736, y: 194, w: 428, h: 372, r: 30 };
const TRACK_CENTER = { left: 698, right: 1202, top: 156, bottom: 604 };
const RECYCLE = { x: 28, y: 622, w: 330, h: 74 };

const PALETTE = ['#ff5c8a', '#ffb13c', '#ffe95c', '#7dff6a', '#19e3ff', '#5c7cff', '#b26bff', '#ff6bff', '#7cffd0', '#ffffff'];
const MAX_PARTICLES = 140;

function catColor(level) {
  return PALETTE[Math.min(9, level | 0)] || '#ffffff';
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

// 赛道中心线取点（顺时针，进度 0..1）
function trackPoint(p) {
  const L = TRACK_CENTER.left;
  const R = TRACK_CENTER.right;
  const T = TRACK_CENTER.top;
  const B = TRACK_CENTER.bottom;
  const W = R - L;
  const H = B - T;
  const P = 2 * (W + H);
  let d = ((p % 1) + 1) % 1 * P;
  if (d < W) return { x: L + d, y: T, dir: 1 };
  d -= W;
  if (d < H) return { x: R, y: T + d, dir: -1 };
  d -= H;
  if (d < W) return { x: R - d, y: B, dir: -1 };
  d -= W;
  return { x: L, y: B - d, dir: 1 };
}

function slotRect(i) {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return { x: SLOT_COLS[col], y: SLOT_ROWS[row], w: SLOT_W, h: SLOT_H };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  let particles = [];
  let tGlobal = 0;

  function burst(x, y, color, count = 12) {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < count; i += 1) {
      if (particles.length >= MAX_PARTICLES) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.4, ttl: 0.5 + Math.random() * 0.4, color });
    }
  }

  function drawCat(x, y, size, level, opts = {}) {
    const color = catColor(level);
    const s = size;
    const running = !!opts.running;
    const flip = opts.dir === -1 ? -1 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);
    if (opts.glow) {
      ctx.globalAlpha = 0.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
    }
    // 身体（圆角方块）
    ctx.fillStyle = color;
    roundRect(ctx, -s / 2, -s / 3, s, s * 0.66, s * 0.22);
    ctx.fill();
    if (opts.glow) { ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
    // 耳朵（两个三角）
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -s * 0.28);
    ctx.lineTo(-s * 0.3, -s * 0.58);
    ctx.lineTo(-s * 0.08, -s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.42, -s * 0.28);
    ctx.lineTo(s * 0.3, -s * 0.58);
    ctx.lineTo(s * 0.08, -s * 0.3);
    ctx.closePath();
    ctx.fill();
    // 眼睛
    ctx.fillStyle = running ? '#ffffff' : '#12060f';
    ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.05, s * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.18, -s * 0.05, s * 0.08, 0, Math.PI * 2); ctx.fill();
    // 等级
    ctx.fillStyle = '#12060f';
    ctx.font = `800 ${Math.round(s * 0.34)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(level), 0, s * 0.16);
    ctx.restore();
  }

  function drawBackground(pulse) {
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 网格
    ctx.strokeStyle = 'rgba(38, 46, 82, 0.5)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < WORLD.WIDTH; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, WORLD.HEIGHT); ctx.stroke();
    }
    for (let gy = 0; gy < WORLD.HEIGHT; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(WORLD.WIDTH, gy); ctx.stroke();
    }
    // 顶部 HUD 背板下缘光带
    const g = ctx.createLinearGradient(0, 44, 0, 88);
    g.addColorStop(0, 'rgba(25,227,255,0.22)');
    g.addColorStop(1, 'rgba(25,227,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 44, WORLD.WIDTH, 44);
  }

  function drawTrack(pulse) {
    // 环带：外圈 + 内圈
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 26, 0.9)';
    roundRect(ctx, TRACK_OUTER.x, TRACK_OUTER.y, TRACK_OUTER.w, TRACK_OUTER.h, TRACK_OUTER.r);
    ctx.fill();
    const glow = 0.5 + pulse * 0.5;
    ctx.lineWidth = 10;
    ctx.strokeStyle = `rgba(25, 227, 255, ${0.10 * glow})`;
    roundRect(ctx, TRACK_OUTER.x, TRACK_OUTER.y, TRACK_OUTER.w, TRACK_OUTER.h, TRACK_OUTER.r);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(25, 227, 255, ${0.85})`;
    roundRect(ctx, TRACK_OUTER.x, TRACK_OUTER.y, TRACK_OUTER.w, TRACK_OUTER.h, TRACK_OUTER.r);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(92, 124, 255, 0.6)';
    roundRect(ctx, TRACK_INNER.x, TRACK_INNER.y, TRACK_INNER.w, TRACK_INNER.h, TRACK_INNER.r);
    ctx.stroke();
    // 起点标记
    ctx.fillStyle = '#ffe95c';
    ctx.beginPath();
    ctx.arc(TRACK_CENTER.left, TRACK_CENTER.top, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSlot(i, cat, pulse) {
    const r = slotRect(i);
    const empty = !cat;
    ctx.save();
    ctx.fillStyle = empty ? 'rgba(18, 22, 40, 0.85)' : 'rgba(26, 34, 64, 0.95)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.lineWidth = empty ? 1.5 : 3;
    ctx.strokeStyle = empty ? 'rgba(120, 132, 180, 0.35)' : (cat.running ? 'rgba(125, 255, 106, 0.8)' : `rgba(200, 210, 255, 0.5)`);
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.stroke();
    if (cat && !cat.running) {
      drawCat(r.x + r.w / 2, r.y + r.h / 2 + 4, 74, cat.level, { glow: true });
    } else if (cat && cat.running) {
      // 车位留一个淡出的占位
      ctx.globalAlpha = 0.25;
      drawCat(r.x + r.w / 2, r.y + r.h / 2 + 4, 64, cat.level, {});
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(125, 255, 106, 0.9)';
      ctx.font = '700 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ON TRACK', r.x + r.w / 2, r.y + r.h - 12);
    }
    if (empty) {
      ctx.fillStyle = 'rgba(215, 224, 255, 0.75)';
      ctx.font = '700 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EMPTY', r.x + r.w / 2, r.y + r.h / 2);
      ctx.fillStyle = 'rgba(255, 92, 138, 0.9)';
      ctx.font = '700 12px monospace';
      ctx.fillText('+ RECRUIT', r.x + r.w / 2, r.y + r.h / 2 + 20);
    }
    ctx.restore();
  }

  function drawRecycle(pulse) {
    ctx.save();
    ctx.fillStyle = 'rgba(40, 16, 22, 0.9)';
    roundRect(ctx, RECYCLE.x, RECYCLE.y, RECYCLE.w, RECYCLE.h, 12);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `rgba(255, 92, 138, ${0.5 + pulse * 0.5})`;
    roundRect(ctx, RECYCLE.x, RECYCLE.y, RECYCLE.w, RECYCLE.h, 12);
    ctx.stroke();
    ctx.fillStyle = '#ff5c8a';
    ctx.font = '800 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('♻  DROP TO SELL', RECYCLE.x + RECYCLE.w / 2, RECYCLE.y + RECYCLE.h / 2 + 6);
    ctx.restore();
  }

  function drawGoal(state) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 目标徽标（赛道顶部，金色）
    ctx.font = '800 19px monospace';
    ctx.fillStyle = '#ffe95c';
    ctx.fillText(`TARGET ⛁ ${state.target}`, TRACK_OUTER.x + TRACK_OUTER.w / 2, TRACK_OUTER.y + 18);
    // 赛道空时给出操作提示
    if (state.runningCount === 0) {
      ctx.font = '800 15px monospace';
      ctx.fillStyle = 'rgba(25, 227, 255, 0.9)';
      ctx.fillText('DRAG CATS HERE TO PATROL', TRACK_OUTER.x + TRACK_OUTER.w / 2, TRACK_CENTER.top + 70);
    }
    ctx.restore();
  }

  function drawAttract() {
    // 标题屏背景：赛道 + 几只装饰猫
    drawTrack(0.4);
    drawCat(TRACK_CENTER.left + 120, TRACK_CENTER.top + 90, 90, 4, { glow: true });
    drawCat(TRACK_CENTER.right - 140, TRACK_CENTER.bottom - 80, 90, 2, { glow: true, dir: -1 });
    drawCat(TRACK_CENTER.right - 60, TRACK_CENTER.top + 200, 90, 6, { glow: true });
  }

  function draw(state, dt, view) {
    const v = view || {};
    tGlobal += dt || 0;
    const pulse = 0.5 + 0.5 * Math.sin(tGlobal * 2.4);

    drawBackground(pulse);

    if (!state) {
      drawAttract();
      return;
    }

    drawTrack(pulse);
    drawGoal(state);
    drawRecycle(pulse);

    // 车位
    const draggedSlot = v.drag && v.drag.slotIdx != null ? v.drag.slotIdx : -1;
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const cat = state.slots[i];
      if (i === draggedSlot) continue; // 拖拽中的猫单独画在光标处
      drawSlot(i, cat, pulse);
    }

    // 巡逻中的猫（画在赛道上）
    const running = [];
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const cat = state.slots[i];
      if (cat && cat.running) running.push({ i, cat });
    }
    running.forEach(({ cat }) => {
      const pt = trackPoint(cat.progress);
      drawCat(pt.x, pt.y, 66, cat.level, { running: true, glow: true, dir: pt.dir });
    });

    // 拖拽中的猫（跟随光标）
    if (draggedSlot >= 0 && v.cursor) {
      const cat = state.slots[draggedSlot];
      if (cat) drawCat(v.cursor.x, v.cursor.y, 74, cat.level, { glow: true });
    }

    // 粒子
    const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.x += p.vx * (dt || 1 / 60);
        p.y += p.vy * (dt || 1 / 60);
        p.vy += 160 * (dt || 1 / 60);
        p.ttl -= dt || 1 / 60;
        if (p.ttl <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, p.ttl / p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
    }
  }

  function debugLayout() {
    const slots = [];
    for (let i = 0; i < SLOT_COUNT; i += 1) slots.push(slotRect(i));
    return {
      slots,
      track: { x: TRACK_OUTER.x, y: TRACK_OUTER.y, w: TRACK_OUTER.w, h: TRACK_OUTER.h },
      recycle: RECYCLE,
    };
  }

  // 命中检测：车位 / 赛道 / 回收区
  function hitTest(p) {
    const lay = debugLayout();
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const r = lay.slots[i];
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return { kind: 'slot', index: i };
    }
    if (p.x >= lay.track.x && p.x <= lay.track.x + lay.track.w && p.y >= lay.track.y && p.y <= lay.track.y + lay.track.h) return { kind: 'track' };
    if (p.x >= RECYCLE.x && p.x <= RECYCLE.x + RECYCLE.w && p.y >= RECYCLE.y && p.y <= RECYCLE.y + RECYCLE.h) return { kind: 'recycle' };
    return null;
  }

  return { draw, burst, debugLayout, hitTest, slotRect, trackPoint, catColor, coinPerSec, lapSeconds };
}
