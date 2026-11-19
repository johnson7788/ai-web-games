// SUNFLOWER SASSY · 渲染层（canvas 程序化，霓虹街机风，零素材零外链）
// 职责：霓虹舞台背景 / 跳舞向日葵 / 方向牌队列 / 倒计时环 / FEVER 光效 / 粒子。
// 逻辑分辨率 1280×720；DPR ≤2；prefers-reduced-motion 时关闭大幅动效。

import { WORLD } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

const C = {
  bgTop: '#0d0221',
  bgBot: '#24104a',
  pink: '#ff2d95',
  cyan: '#00e5ff',
  yellow: '#ffd23f',
  green: '#39ff88',
  purple: '#a855f7',
  rock: '#8b7bd8',
  white: '#fff6ff',
};

// 方向牌几何
const TILE = { w: 84, h: 96, gap: 12 };
const STRIP = {
  y: 500,
  n: 7,
  startX: (W - (TILE.w * 7 + TILE.gap * 6)) / 2, // 310
};

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let reduceMotion = false;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  try {
    reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { reduceMotion = false; }

  resize();
  window.addEventListener('resize', resize);

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function glow(color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function noGlow() { ctx.shadowBlur = 0; }

  // ---------- 背景 ----------
  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.bgTop);
    g.addColorStop(1, C.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 顶部霓虹灯串
    for (let i = 0; i < 16; i += 1) {
      const x = 40 + i * 80;
      const y = 26 + Math.sin(t * 2 + i) * 3;
      ctx.fillStyle = i % 2 ? C.pink : C.cyan;
      glow(ctx.fillStyle, 12);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    noGlow();

    // 聚光灯
    for (const [bx, col] of [[200, C.pink], [640, C.cyan], [1080, C.purple]]) {
      const g2 = ctx.createLinearGradient(bx, 0, bx, 460);
      g2.addColorStop(0, col + '33');
      g2.addColorStop(1, col + '00');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(bx - 70, 0);
      ctx.lineTo(bx + 70, 0);
      ctx.lineTo(bx + 190, 460);
      ctx.lineTo(bx - 190, 460);
      ctx.closePath();
      ctx.fill();
    }

    // 舞池地面网格
    ctx.strokeStyle = C.purple + '88';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 6; i += 1) {
      const y = 470 + i * 42;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let i = -6; i <= 6; i += 1) {
      const x = 640 + i * 120;
      ctx.beginPath();
      ctx.moveTo(x, 470);
      ctx.lineTo(640 + i * 40, 720);
      ctx.stroke();
    }
  }

  // ---------- 向日葵 ----------
  function drawSunflower(state, t) {
    const speed = state ? state.speed : 0.5;
    const fever = !!(state && state.fever);
    const cx = 640;
    const cy = 250 + (state ? Math.sin(t * 1.6) * 6 : Math.sin(t * 0.8) * 8);
    const bob = reduceMotion ? 0 : Math.sin(t * 4 * speed) * 8;
    const sway = reduceMotion ? 0 : Math.sin(t * 2 * speed) * 0.14;

    // 茎
    ctx.strokeStyle = C.green;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    glow(C.green, 10);
    ctx.beginPath();
    ctx.moveTo(cx, cy + 84);
    ctx.quadraticCurveTo(cx - 18 + sway * 40, cy + 150, cx + sway * 30, cy + 210);
    ctx.stroke();
    // 叶子
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.ellipse(cx - 30 + sway * 40, cy + 150, 26, 12, -0.5, 0, Math.PI * 2);
    ctx.fill();
    noGlow();

    const r = 86;
    ctx.save();
    ctx.translate(cx, cy + bob * 0.4);
    ctx.rotate(sway);
    const petalCount = 14;
    for (let i = 0; i < petalCount; i += 1) {
      const a = (i / petalCount) * Math.PI * 2 + t * (fever ? 2.2 : speed * 0.6);
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + Math.PI / 2);
      const pg = ctx.createLinearGradient(0, -40, 0, 40);
      pg.addColorStop(0, fever ? C.pink : C.yellow);
      pg.addColorStop(1, fever ? C.yellow : '#e8971f');
      ctx.fillStyle = pg;
      glow(fever ? C.pink : C.yellow, fever ? 22 : 14);
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    noGlow();

    // 花盘（脸）
    const faceR = 58;
    const fg = ctx.createRadialGradient(cx, cy + bob * 0.4 - 8, 4, cx, cy + bob * 0.4, faceR);
    fg.addColorStop(0, '#4a2b12');
    fg.addColorStop(1, '#2a150a');
    ctx.fillStyle = fg;
    glow(C.yellow, 18);
    ctx.beginPath();
    ctx.arc(0, 0, faceR, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
    ctx.strokeStyle = C.yellow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, faceR, 0, Math.PI * 2);
    ctx.stroke();

    // 脸（眼睛 + 微笑）
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(-20, -12, 9, 0, Math.PI * 2);
    ctx.arc(20, -12, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-20, -12, 4, 0, Math.PI * 2);
    ctx.arc(20, -12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 8, 20, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- 方向牌 ----------
  function tileColor(dir) {
    if (dir === 'left') return C.cyan;
    if (dir === 'right') return C.pink;
    return C.rock;
  }

  function drawArrow(dir, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    glow(color, 16);
    if (dir === 'left') {
      ctx.beginPath();
      ctx.moveTo(size * 0.7, -size);
      ctx.lineTo(-size * 0.6, 0);
      ctx.lineTo(size * 0.7, size);
      ctx.closePath();
      ctx.fill();
    } else if (dir === 'right') {
      ctx.beginPath();
      ctx.moveTo(-size * 0.7, -size);
      ctx.lineTo(size * 0.6, 0);
      ctx.lineTo(-size * 0.7, size);
      ctx.closePath();
      ctx.fill();
    } else {
      // 岩石：不规则多边形 + 裂纹
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.9, -size * 0.4);
      ctx.lineTo(size * 0.6, size * 0.7);
      ctx.lineTo(-size * 0.6, size * 0.8);
      ctx.lineTo(-size * 0.95, size * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2a1a4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-size * 0.3, -size * 0.3);
      ctx.lineTo(size * 0.1, size * 0.1);
      ctx.lineTo(-size * 0.2, size * 0.5);
      ctx.stroke();
    }
    noGlow();
    ctx.restore();
  }

  function drawTiles(state, t) {
    if (!state) return;
    const q = state.queue;
    for (let i = 0; i < q.length && i < STRIP.n; i += 1) {
      const cur = i === 0;
      const x = STRIP.startX + i * (TILE.w + TILE.gap) + TILE.w / 2;
      const y = STRIP.y + TILE.h / 2;
      const scale = cur ? 1.0 : 0.82;
      const w = TILE.w * scale;
      const h = TILE.h * scale;
      const color = tileColor(q[i].dir);
      const pulse = cur ? 1 + Math.sin(t * 6) * 0.06 : 0;

      ctx.save();
      ctx.translate(x, y + (cur ? -10 : 4));
      ctx.scale(scale + pulse, scale + pulse);

      // 底
      ctx.fillStyle = cur ? color : '#1c0f38';
      const alpha = cur ? 1 : 0.45;
      ctx.globalAlpha = alpha;
      glow(cur ? color : '#00000000', cur ? 24 : 0);
      rr(-w / 2, -h / 2, w, h, 12);
      ctx.fill();
      noGlow();
      ctx.globalAlpha = 1;

      // 边框
      ctx.strokeStyle = color;
      ctx.lineWidth = cur ? 4 : 2;
      ctx.globalAlpha = cur ? 1 : 0.35;
      rr(-w / 2, -h / 2, w, h, 12);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 图标
      const iconSize = cur ? 30 : 22;
      drawArrow(q[i].dir, 0, 0, iconSize, color);

      // 当前牌的倒计时环
      if (cur) {
        const frac = state.deadlineMax > 0 ? clamp01(state.deadline / state.deadlineMax) : 1;
        const ringColor = frac > 0.55 ? C.green : frac > 0.25 ? C.yellow : C.pink;
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 6;
        glow(ringColor, 12);
        ctx.beginPath();
        ctx.arc(0, 0, w / 2 + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
        noGlow();
      }

      ctx.restore();
    }

    // 当前牌上方的「TAP」指示箭头（闪烁）
    const curX = STRIP.startX + TILE.w / 2;
    const curY = STRIP.y + TILE.h / 2 - 10;
    const blink = 0.5 + 0.5 * Math.sin(t * 8);
    ctx.fillStyle = C.white;
    ctx.globalAlpha = 0.35 + 0.65 * blink;
    ctx.beginPath();
    ctx.moveTo(curX - 14, curY - 78);
    ctx.lineTo(curX + 14, curY - 78);
    ctx.lineTo(curX, curY - 60);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---------- FEVER 光效 ----------
  function drawFever(state, t) {
    if (!state || !state.fever) return;
    const a = 0.16 + 0.08 * Math.sin(t * 8);
    const g = ctx.createRadialGradient(640, 250, 60, 640, 250, 460);
    g.addColorStop(0, C.pink + '55');
    g.addColorStop(0.5, C.cyan + '22');
    g.addColorStop(1, C.pink + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    ctx.fillStyle = C.pink;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // ---------- 粒子 ----------
  function drawParticles(view, dt) {
    if (!view || !view.fxQueue) return;
    for (const fx of view.fxQueue) {
      if (fx.type === 'pop') {
        ctx.globalAlpha = clamp01(fx.ttl / 0.4);
        ctx.fillStyle = fx.color || C.yellow;
        glow(fx.color || C.yellow, 16);
        ctx.beginPath();
        ctx.arc(fx.x, fx.y - fx.ttl * 120, 6 + fx.ttl * 20, 0, Math.PI * 2);
        ctx.fill();
        noGlow();
        ctx.globalAlpha = 1;
      } else if (fx.type === 'float') {
        ctx.globalAlpha = clamp01(fx.ttl / 0.7);
        ctx.fillStyle = fx.color || C.white;
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(fx.text || '', fx.x, fx.y - fx.ttl * 50);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }
    }
  }

  function draw(state, dt, view) {
    const t = (view && view.t) || 0;
    ctx.clearRect(0, 0, W, H);
    drawBackground(t);
    drawSunflower(state, t);
    drawTiles(state, t);
    drawFever(state, t);
    drawParticles(view, dt);

    // 震屏
    if (view && view.shake > 0) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
      ctx.restore();
    }
  }

  function debugLayout() {
    return {
      stage: { x: 340, y: 80, w: 600, h: 320 },
      queue: { x: STRIP.startX, y: STRIP.y - 20, w: TILE.w * STRIP.n + TILE.gap * (STRIP.n - 1), h: TILE.h + 40 },
      buttons: {
        left: { x: 210, y: 596, w: 250, h: 96 },
        dodge: { x: 515, y: 596, w: 250, h: 96 },
        right: { x: 820, y: 596, w: 250, h: 96 },
      },
    };
  }

  return { draw, debugLayout, resize };
}
