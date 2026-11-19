// Pirate Escape Run · Canvas 2D 程序化渲染（neon arcade，零素材零外链）。
// 只画：霓虹天空/海水、双绳桅杆、上升的海潮、主角海盗、木板障碍、金币/星星/宝箱。
// DPR ≤2；prefers-reduced-motion 关闭大幅动效与震屏；粒子上限分档。

import { WORLD, RULES } from '../../config/game.config.js';
import { peekRow } from '../game/sim.js';

const { WIDTH, HEIGHT, LANE_OFFSET, ITEM_OFFSET, HERO_Y, ROW_PX, WATER_CLAMP } = WORLD;

const PAL = {
  skyTop: '#0a0e27',
  skyBot: '#0d1a33',
  seaTop: '#07131f',
  seaBot: '#03101b',
  rope: '#3a4a72',
  ropeKnot: '#22304f',
  heroGlow: '#3fe0ff',
  heroCore: '#eafcff',
  hatGold: '#ffd23e',
  hatDark: '#141a33',
  skin: '#ffd9a0',
  bodyDark: '#0f1b3a',
  plank: '#ff2e63',
  plankGlow: '#ff6a93',
  coin: '#ffd23e',
  coinDark: '#c8921e',
  star: '#ffe066',
  starGlow: '#fff3b0',
  box: '#3dff9a',
  boxGlow: '#8dffc4',
  shield: '#3fe0ff',
  magnet: '#c07bff',
  dash: '#7dffd6',
};

const MAX_PARTICLES = 140;
const reducedMotion = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

  function setup() {
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setup();

  const particles = [];
  let shake = 0;
  let flash = { color: null, alpha: 0 };
  let clock = 0;

  // ---------- 特效接口 ----------

  function spawn(kind, x, y) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ kind, x, y, vx: 0, vy: 0, life: 1, ttl: kind === 'trail' ? 0.4 : 0.7, size: 3 + Math.random() * 3 });
  }

  function burst(kind, x, y, n = 8) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      if (particles.length >= MAX_PARTICLES) particles.shift();
      particles.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 1, ttl: 0.5 + Math.random() * 0.4, size: 2 + Math.random() * 3 });
    }
  }

  function screenShake(amount) { if (!reducedMotion) shake = Math.min(12, amount); }
  function screenFlash(color, alpha = 0.35) { flash = { color, alpha }; }

  // ---------- 绘制工具 ----------

  function glowCircle(x, y, r, color, alpha = 0.5) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- 背景 ----------

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, PAL.skyTop);
    g.addColorStop(0.55, PAL.skyBot);
    g.addColorStop(0.75, PAL.seaTop);
    g.addColorStop(1, PAL.seaBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 星星（固定伪随机分布）
    ctx.fillStyle = '#8fa7d8';
    for (let i = 0; i < 46; i += 1) {
      const sx = (i * 197.3) % WIDTH;
      const sy = (i * 113.7) % (HEIGHT * 0.55);
      const tw = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(clock * 2 + i));
      ctx.globalAlpha = tw;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // 月亮
    glowCircle(1010, 96, 70, 'rgba(120,200,255,0.16)', 1);
    ctx.fillStyle = '#d7f2ff';
    ctx.beginPath();
    ctx.arc(1010, 96, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.skyTop;
    ctx.beginPath();
    ctx.arc(1000, 88, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- 桅杆/绳子 ----------

  function drawRopes() {
    for (const off of LANE_OFFSET) {
      const x = WIDTH / 2 + off;
      ctx.strokeStyle = PAL.rope;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
      // 绳结（向上滚动，制造攀爬感）
      ctx.fillStyle = PAL.ropeKnot;
      const scroll = (clock * 60) % 40;
      for (let y = -40 + scroll; y < HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---------- 海水 ----------

  function drawWater(displayHeight) {
    const waterY = Math.max(WATER_CLAMP[0], Math.min(WATER_CLAMP[1], HERO_Y + displayHeight * 40));
    const g = ctx.createLinearGradient(0, waterY, 0, HEIGHT);
    g.addColorStop(0, '#0a3350');
    g.addColorStop(0.35, '#07243c');
    g.addColorStop(1, '#04141f');
    ctx.fillStyle = g;
    ctx.fillRect(0, waterY, WIDTH, HEIGHT - waterY);

    // 浪尖（reduced-motion 时静止）
    const amp = reducedMotion ? 0 : 4;
    ctx.strokeStyle = '#2fd0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 8) {
      const y = waterY + Math.sin(x * 0.025 + clock * 3) * amp;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 靠近海面时的警示红光
    if (displayHeight < 3.5) {
      const danger = 1 - (displayHeight - 1) / 2.5;
      ctx.fillStyle = `rgba(255,46,99,${Math.max(0, Math.min(0.25, danger * 0.22))})`;
      ctx.fillRect(0, HERO_Y + 24, WIDTH, Math.max(0, waterY - HERO_Y - 24));
    }
  }

  // ---------- 目标指示（上箭头 + 下一星级目标线） ----------

  function nextTarget(score) {
    const [a, b, c] = RULES.RATING;
    if (score < a) return a;
    if (score < b) return b;
    if (score < c) return c;
    return null;
  }

  function drawGoal(displayHeight, sim, goalLabel) {
    const cx = WIDTH / 2;
    const ay = 96;
    const pulse = reducedMotion ? 0 : Math.sin(clock * 4);
    ctx.save();
    ctx.globalAlpha = 0.7 + 0.3 * (0.5 + 0.5 * pulse);
    ctx.strokeStyle = '#3fe0ff';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#3fe0ff';
    ctx.shadowBlur = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 双 chevron 上箭头
    ctx.beginPath();
    ctx.moveTo(cx - 26, ay + 6);
    ctx.lineTo(cx, ay - 16);
    ctx.lineTo(cx + 26, ay + 6);
    ctx.moveTo(cx - 26, ay + 22);
    ctx.lineTo(cx, ay);
    ctx.lineTo(cx + 26, ay + 22);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#3fe0ff';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(goalLabel || 'CLIMB', cx, ay + 42);
    ctx.restore();

    // 下一星级目标线（世界锚定）
    if (!sim) return;
    const target = nextTarget(sim.score);
    if (target == null) return;
    const y = HERO_Y - (target - displayHeight) * ROW_PX;
    if (y < 70 || y > HERO_Y - 20) return;
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = '#ffe066';
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 150, y);
    ctx.lineTo(cx + 150, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`★ ${target}m`, cx + 160, y + 4);
    ctx.restore();
  }

  // ---------- 木板障碍 ----------

  function drawPlank(x, y) {
    glowCircle(x, y, 34, PAL.plankGlow, 0.4);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = PAL.plank;
    ctx.shadowColor = PAL.plankGlow;
    ctx.shadowBlur = 10;
    roundRect(-46, -12, 92, 24, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#5c0a22';
    roundRect(-46, -12, 92, 24, 8);
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    // 骷髅标记
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-6, 3, 12, 3);
    ctx.restore();
  }

  // ---------- 收集物 ----------

  function drawCoin(x, y) {
    glowCircle(x, y, 20, PAL.coin, 0.55);
    ctx.fillStyle = PAL.coin;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.coinDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = PAL.coinDark;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', x, y + 1);
  }

  function drawStar(x, y) {
    glowCircle(x, y, 22, PAL.starGlow, 0.6);
    ctx.fillStyle = PAL.star;
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const bx = x + Math.cos(a) * 12;
      const by = y + Math.sin(a) * 12;
      if (i === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawBox(x, y) {
    glowCircle(x, y, 26, PAL.boxGlow, 0.5);
    ctx.fillStyle = PAL.box;
    ctx.fillRect(x - 14, y - 11, 28, 22);
    ctx.fillStyle = '#073d24';
    ctx.fillRect(x - 14, y - 4, 28, 4);
    ctx.fillStyle = PAL.box;
    ctx.fillRect(x - 4, y - 15, 8, 6);
  }

  // ---------- 主角海盗 ----------

  function drawHero(x, y, lane, opts = {}) {
    const { time = 0, shield = false, dash = false } = opts;
    const bob = reducedMotion ? 0 : Math.sin(time * 7) * 3;
    const climb = reducedMotion ? 0 : Math.sin(time * 11) * 2;
    const cy = y + bob;

    if (dash) glowCircle(x, cy, 60, PAL.dash, 0.35);
    if (shield) {
      ctx.strokeStyle = PAL.shield;
      ctx.lineWidth = 3;
      ctx.shadowColor = PAL.shield;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, cy, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    glowCircle(x, cy, 44, PAL.heroGlow, 0.45);

    // 身体
    ctx.fillStyle = PAL.bodyDark;
    ctx.strokeStyle = PAL.heroGlow;
    ctx.lineWidth = 2.5;
    roundRect(x - 14, cy - 6, 28, 34, 10);
    ctx.fill();
    ctx.stroke();

    // 手臂（攀爬交替）
    ctx.strokeStyle = PAL.heroGlow;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x - 12, cy - 2);
    ctx.lineTo(x - 22, cy - 18 - climb);
    ctx.moveTo(x + 12, cy - 2);
    ctx.lineTo(x + 22, cy - 18 + climb);
    ctx.stroke();

    // 头
    ctx.fillStyle = PAL.skin;
    ctx.beginPath();
    ctx.arc(x, cy - 16, 13, 0, Math.PI * 2);
    ctx.fill();

    // 三角帽
    ctx.fillStyle = PAL.hatDark;
    ctx.strokeStyle = PAL.hatGold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 20, cy - 24);
    ctx.lineTo(x + 20, cy - 24);
    ctx.lineTo(x, cy - 42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PAL.hatGold;
    ctx.fillRect(x - 20, cy - 25, 40, 3);

    // 眼睛（朝前看）
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 4 + (lane === 0 ? -1 : 1), cy - 18, 2.4, 0, Math.PI * 2);
    ctx.arc(x + 5 + (lane === 0 ? -1 : 1), cy - 18, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- 粒子 ----------

  function updateAndDrawParticles(dt) {
    const colors = { spark: PAL.coin, starlet: PAL.star, trail: PAL.dash, splash: PAL.heroGlow };
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt / p.ttl;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'trail' ? -20 : 180) * dt;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = colors[p.kind] || '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * Math.max(0.2, p.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 主渲染 ----------

  function render(view, dt = 1 / 60) {
    clock += dt;
    const sim = view.sim;
    const peek = view.peek || (() => ({ barrier: 0, items: ['none', 'none'] }));
    const displayHeight = view.displayHeight != null ? view.displayHeight : (sim ? sim.height : RULES.START_HEIGHT);
    const phase = view.phase || 'title';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 震屏
    if (shake > 0 && !reducedMotion) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.86;
      if (shake < 0.3) shake = 0;
    }

    drawBackground();
    drawRopes();

    // 行（障碍 + 收集物）：从脚下一行到头顶 12 行
    const base = Math.floor(displayHeight);
    for (let r = base - 1; r <= base + 12; r += 1) {
      if (r < 1) continue;
      const y = HERO_Y - (r - displayHeight) * ROW_PX;
      if (y < -90 || y > HEIGHT + 90) continue;
      const row = peek(r);
      if (row.barrier === -1) drawPlank(WIDTH / 2 + LANE_OFFSET[0], y);
      else if (row.barrier === 1) drawPlank(WIDTH / 2 + LANE_OFFSET[1], y);
      for (let li = 0; li < 2; li += 1) {
        const it = row.items[li];
        const ix = WIDTH / 2 + ITEM_OFFSET[li];
        if (it === 'coin') drawCoin(ix, y);
        else if (it === 'star') drawStar(ix, y);
        else if (it === 'box') drawBox(ix, y);
      }
    }

    drawWater(displayHeight);

    if (phase === 'playing') drawGoal(displayHeight, sim, view.goalLabel);

    if (sim) {
      drawHero(
        WIDTH / 2 + LANE_OFFSET[sim.lane],
        HERO_Y,
        sim.lane,
        { time: clock, shield: sim.shieldCharges > 0, dash: sim.items.speed > 0 },
      );
    } else if (phase === 'title' || phase === 'paused') {
      drawHero(WIDTH / 2 + LANE_OFFSET[0], HERO_Y, 0, { time: clock });
    }

    updateAndDrawParticles(dt);

    // 全屏闪光
    if (flash.alpha > 0) {
      ctx.globalAlpha = flash.alpha;
      ctx.fillStyle = flash.color || '#fff';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalAlpha = 1;
      flash.alpha = Math.max(0, flash.alpha - dt * 1.8);
    }
  }

  return { render, spawn, burst, screenShake, screenFlash, setDpr: (v) => { dpr = Math.min(2, v); setup(); } };
}
