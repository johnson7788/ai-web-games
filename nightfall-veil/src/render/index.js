// Canvas 2D 渲染：霓虹街机风「夜幕结界」。
// 只画程序化背景 + 结界线 + 算式符文；HUD/键盘/结算都是 DOM。
import { WORLD, GAME } from '../../config/game.config.js';

const NEON = {
  cyan: '#57f6ff',
  cyanDim: 'rgba(87, 246, 255, 0.35)',
  magenta: '#ff4fd8',
  magentaDim: 'rgba(255, 79, 216, 0.32)',
  gold: '#ffd84e',
  goldDim: 'rgba(255, 216, 78, 0.4)',
  veil: '#ff3b5c',
  veilDim: 'rgba(255, 59, 92, 0.45)',
  text: '#eafcff',
};

// 稳定星空（固定随机，不随帧跳动）
function makeStars(count, seed) {
  let a = seed >>> 0;
  const rand = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({ x: rand() * WORLD.WIDTH, y: rand() * GAME.VEIL_Y, r: 0.6 + rand() * 1.6, p: rand() * Math.PI * 2, s: 0.5 + rand() * 1.5 });
  }
  return stars;
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const stars = makeStars(140, 20261120);

  function drawBackground(time) {
    // 夜空渐变
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#07030f');
    g.addColorStop(0.5, '#130b2e');
    g.addColorStop(0.85, '#2a0f3f');
    g.addColorStop(1, '#3a0f34');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星空
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(time * s.s + s.p);
      ctx.fillStyle = `rgba(190, 230, 255, ${0.25 + 0.6 * tw})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 霓虹地平网格（透视感，向结界线收拢）
    ctx.strokeStyle = 'rgba(87, 246, 255, 0.14)';
    ctx.lineWidth = 1;
    const horizon = GAME.VEIL_Y;
    for (let i = 0; i <= 12; i += 1) {
      const x = (i / 12) * WORLD.WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (WORLD.WIDTH / 2 - x) * 0.45, horizon);
      ctx.stroke();
    }
    for (let j = 0; j <= 6; j += 1) {
      const y = (j / 6) * horizon * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y + (horizon - y) * 0.35);
      ctx.stroke();
    }
  }

  function drawVeil(time) {
    const y = GAME.VEIL_Y;
    // 发光横线
    const glow = 3 + Math.sin(time * 2.4) * 1.2;
    ctx.save();
    ctx.shadowColor = NEON.veil;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = NEON.veil;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.WIDTH, y);
    ctx.stroke();
    ctx.restore();

    // 线下轻微红色渐变（危险区）
    const g = ctx.createLinearGradient(0, y, 0, WORLD.HEIGHT);
    g.addColorStop(0, 'rgba(255, 59, 92, 0.16)');
    g.addColorStop(1, 'rgba(255, 59, 92, 0.02)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, WORLD.WIDTH, WORLD.HEIGHT - y);

    // 线上脉冲
    ctx.fillStyle = `rgba(255, 59, 92, ${0.5 + glow * 0.04})`;
    ctx.fillRect(0, y - 1, WORLD.WIDTH, 2);
  }

  function drawSubject(s, time) {
    const len = s.subject.length;
    const w = Math.max(96, 44 + len * 22);
    const h = 46;
    const x = s.x - w / 2;
    const y = s.y - h / 2;
    const color = s.golden ? NEON.gold : NEON.cyan;
    const dim = s.golden ? NEON.goldDim : NEON.cyanDim;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = s.golden ? 20 : 12;
    ctx.fillStyle = 'rgba(10, 6, 22, 0.86)';
    roundedRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = color;
    ctx.lineWidth = s.golden ? 2.5 : 1.6;
    roundedRect(ctx, x, y, w, h, 12);
    ctx.stroke();

    // 金色符文加一道内圈
    if (s.golden) {
      ctx.strokeStyle = dim;
      ctx.lineWidth = 1;
      roundedRect(ctx, x + 4, y + 4, w - 8, h - 8, 8);
      ctx.stroke();
    }

    ctx.fillStyle = s.golden ? '#ffe9a3' : NEON.text;
    ctx.font = 'bold 24px "Courier New", ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.subject, s.x, s.y + 1);

    // 目标值小角标（右下，帮助瞄一眼）
    ctx.fillStyle = 'rgba(190, 240, 255, 0.5)';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('=' + s.result, s.x + w / 2 - 18, s.y + h / 2 - 10);
  }

  function drawCountdown(state) {
    if (state.phase !== 'countdown') return;
    const n = Math.max(1, Math.ceil(state.countdownLeft));
    ctx.fillStyle = 'rgba(234, 252, 255, 0.92)';
    ctx.font = 'bold 64px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = NEON.cyan;
    ctx.shadowBlur = 24;
    ctx.fillText(String(n), WORLD.WIDTH / 2, 260);
    ctx.shadowBlur = 0;
  }

  function drawFx(view) {
    for (const fx of view.fx || []) {
      const k = fx.ttl;
      if (k <= 0) continue;
      if (fx.kind === 'burst') {
        const r = 18 + (1 - k / 0.4) * 26;
        ctx.save();
        ctx.globalAlpha = Math.max(0, k / 0.4);
        ctx.strokeStyle = fx.color || NEON.cyan;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (fx.kind === 'veilFlash') {
        ctx.fillStyle = `rgba(255, 59, 92, ${0.25 * Math.max(0, k / 0.35)})`;
        ctx.fillRect(0, GAME.VEIL_Y - 6, WORLD.WIDTH, 12);
      }
    }
  }

  return {
    draw(state, dt, view = {}) {
      const time = view.time || 0;
      drawBackground(time);
      drawVeil(time);

      if (state && state.phase !== 'countdown') {
        for (const s of state.subjects) drawSubject(s, time);
      }
      if (view.demo) drawSubject(view.demo, time);
      if (state) drawCountdown(state);
      drawFx(view);
    },
    debugLayout() {
      return {
        veil: { x: 0, y: GAME.VEIL_Y, w: WORLD.WIDTH, h: 6 },
        field: { x: 0, y: GAME.HUD_H, w: WORLD.WIDTH, h: GAME.VEIL_Y - GAME.HUD_H },
      };
    },
  };
}
