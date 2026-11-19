// SPIN CYCLE ORBIT · Canvas 2D 渲染（霓虹街机风格，全程序化，零素材）
// 场景：深空背景 + 网格 + 星点；目标链（金核/岩核/普通能量球）+ 双臂光轨 + 狂热特效。

import { WORLD, ORBIT } from '../../config/game.config.js';
import { mulberry32 } from '../game/sim.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const { BALL_DISTANCE } = ORBIT;
const SCALE = 1.45; // 世界放大倍率：让主体更大、剪影更清晰

const PALETTE = {
  bgTop: '#05050f',
  bgBottom: '#0d0d24',
  grid: 'rgba(90, 100, 190, 0.07)',
  normal: '#2bd7ff',
  golden: '#ffd34d',
  rock: '#9a8bd8',
  anchor: '#eaf6ff',
  orbiter: '#ff4d8d',
  armA: '#2bd7ff',
  armB: '#ff4d8d',
  nextRing: '#ffffff',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const stars = [];
  {
    const rng = mulberry32(20261120);
    for (let i = 0; i < 90; i += 1) {
      stars.push({
        x: rng() * W,
        y: rng() * H,
        r: 0.5 + rng() * 1.4,
        tw: rng() * Math.PI * 2,
      });
    }
  }

  function glow(ctx, x, y, r, color, intensity = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = 0.35 * intensity;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function circle(ctx, x, y, r, fill, stroke, lineWidth = 2) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function labelPill(ctx, x, y, text, bg, fg) {
    ctx.save();
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 14;
    const h = 18;
    const px = x - w / 2;
    const py = y - h / 2;
    ctx.fillStyle = bg;
    ctx.beginPath();
    const r = 9;
    ctx.moveTo(px + r, py);
    ctx.arcTo(px + w, py, px + w, py + h, r);
    ctx.arcTo(px + w, py + h, px, py + h, r);
    ctx.arcTo(px, py + h, px, py, r);
    ctx.arcTo(px, py, px + w, py, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PALETTE.bgTop);
    g.addColorStop(1, PALETTE.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 透视网格（缓慢滚动）
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    const off = (time * 14) % 80;
    ctx.beginPath();
    for (let x = -80; x < W + 80; x += 80) {
      ctx.moveTo(x + off, 0);
      ctx.lineTo(x + off, H);
    }
    for (let y = -80; y < H + 80; y += 80) {
      ctx.moveTo(0, y + off * 0.4);
      ctx.lineTo(W, y + off * 0.4);
    }
    ctx.stroke();

    // 星点闪烁
    for (const s of stars) {
      const a = 0.35 + 0.3 * Math.sin(time * 2 + s.tw);
      ctx.globalAlpha = Math.max(0.05, a);
      ctx.fillStyle = '#cfe0ff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  function nodeVisual(kind) {
    if (kind === 'golden') return { fill: PALETTE.golden, ring: '#fff2c0' };
    if (kind === 'rock') return { fill: PALETTE.rock, ring: '#cfc4f2' };
    return { fill: PALETTE.normal, ring: '#bff0ff' };
  }

  function drawNode(ctx, n, i, time, isNext) {
    const alpha = Math.max(0.12, 1 - i / ORBIT.VISIBLE_TARGETS);
    const v = nodeVisual(n.kind);
    const r = isNext ? 16 : 12;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (n.kind === 'rock') {
      // 岩核：六边形硬轮廓
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (Math.PI / 3) * k - Math.PI / 6;
        const px = n.x + r * Math.cos(a);
        const py = n.y + r * Math.sin(a);
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = v.fill;
      ctx.fill();
      ctx.strokeStyle = v.ring;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      glow(ctx, n.x, n.y, r * 2.6, v.fill, isNext ? 1.4 : 0.8);
      circle(ctx, n.x, n.y, r, v.fill, v.ring, 2);
    }

    if (isNext) {
      // 命中窗口环：呼吸
      const pr = r + 7 + 3 * Math.sin(time * 8);
      circle(ctx, n.x, n.y, pr, null, PALETTE.nextRing, 2.5);
      // 中心白点 = 明确的可收集标记
      circle(ctx, n.x, n.y, 4, '#ffffff', null);
      // NEXT 标签：明确目标，避免与玩家混淆
      labelPill(ctx, n.x, n.y - r - 16, 'NEXT', '#ffffff', '#0a0a1e');
    }
    ctx.restore();
  }

  function drawScene(state, time) {
    if (!state) return;
    ctx.save();
    ctx.translate(W / 2, H * 0.42);
    ctx.scale(SCALE, SCALE);
    ctx.translate(-state.camX, -state.camY);

    // 目标链
    for (let i = state.nodes.length - 1; i >= 0; i -= 1) {
      const isNext = i === 1;
      drawNode(ctx, state.nodes[i], i, time, isNext);
    }

    // 双臂光轨
    const grad = ctx.createLinearGradient(state.anchor.x, state.anchor.y, state.orbiter.x, state.orbiter.y);
    grad.addColorStop(0, PALETTE.armA);
    grad.addColorStop(1, PALETTE.armB);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(state.anchor.x, state.anchor.y);
    ctx.lineTo(state.orbiter.x, state.orbiter.y);
    ctx.stroke();
    glow(ctx, state.anchor.x, state.anchor.y, 30, PALETTE.armA, 1.2);

    // 锚球（较暗，不与玩家抢视觉）
    circle(ctx, state.anchor.x, state.anchor.y, 8, PALETTE.anchor, PALETTE.armA, 2.5);

    // 旋转球（玩家：最亮最粗 + YOU 标签）
    glow(ctx, state.orbiter.x, state.orbiter.y, 44, PALETTE.orbiter, 1.9);
    circle(ctx, state.orbiter.x, state.orbiter.y, 16, PALETTE.orbiter, '#ffd0e2', 4);
    circle(ctx, state.orbiter.x, state.orbiter.y, 6, '#ffffff', null);
    labelPill(ctx, state.orbiter.x, state.orbiter.y - 30, 'YOU', PALETTE.orbiter, '#1a0410');

    // 狂热特效：速度线
    const frenzy = state.frenzyUntil > 0 && state.time < state.frenzyUntil;
    if (frenzy) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 77, 141, 0.5)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 10; k += 1) {
        const a = state.angle + (k / 10) * Math.PI * 2;
        const r1 = BALL_DISTANCE + 40;
        const r2 = r1 + 26 + 12 * Math.sin(time * 20 + k);
        ctx.beginPath();
        ctx.moveTo(state.orbiter.x + r1 * Math.cos(a), state.orbiter.y + r1 * Math.sin(a));
        ctx.lineTo(state.orbiter.x + r2 * Math.cos(a), state.orbiter.y + r2 * Math.sin(a));
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  return {
    /** 主绘制入口：state 为 null 时画标题 demo 场景 */
    draw(state, dt, view = {}) {
      const time = view.reduced ? 0 : (view.time ?? 0);
      drawBackground(time);
      if (state) {
        drawScene(state, time);
      } else {
        drawDemo(time);
      }
    },

    debugLayout() {
      return null;
    },
  };

  // 标题屏 demo：一个缓动的双臂 + 目标链剪影，保证标题图也有可辨识主体
  function drawDemo(time) {
    const ang = time * 0.9;
    const ax = 0;
    const ay = 0;
    const ox = -BALL_DISTANCE * Math.sin(ang);
    const oy = BALL_DISTANCE * Math.cos(ang);

    ctx.save();
    ctx.translate(W / 2, H * 0.56);
    ctx.scale(SCALE, SCALE);

    // 一串目标
    const demoNodes = [
      { x: ax, y: ay, kind: 'normal' },
      { x: BALL_DISTANCE * Math.cos(0.5), y: BALL_DISTANCE * Math.sin(0.5), kind: 'normal' },
      { x: BALL_DISTANCE * 1.9, y: BALL_DISTANCE * 0.9, kind: 'golden' },
    ];
    demoNodes.forEach((n, i) => {
      const v = nodeVisual(n.kind);
      glow(ctx, n.x, n.y, 26, v.fill, 0.9);
      circle(ctx, n.x, n.y, i === 0 ? 9 : 11, v.fill, v.ring, 2);
      if (i === 1) labelPill(ctx, n.x, n.y - 26, 'NEXT', '#ffffff', '#0a0a1e');
    });

    const grad = ctx.createLinearGradient(ax, ay, ox, oy);
    grad.addColorStop(0, PALETTE.armA);
    grad.addColorStop(1, PALETTE.armB);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ox, oy);
    ctx.stroke();
    glow(ctx, ax, ay, 30, PALETTE.armA, 1.2);
    circle(ctx, ax, ay, 8, PALETTE.anchor, PALETTE.armA, 2.5);
    glow(ctx, ox, oy, 44, PALETTE.orbiter, 1.9);
    circle(ctx, ox, oy, 16, PALETTE.orbiter, '#ffd0e2', 4);
    circle(ctx, ox, oy, 6, '#ffffff', null);
    labelPill(ctx, ox, oy - 30, 'YOU', PALETTE.orbiter, '#1a0410');

    ctx.restore();
  }
}
