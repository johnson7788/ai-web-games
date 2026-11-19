// 霓虹街机背景渲染（canvas）：渐变天空 / 复古太阳 / 星空 / 山影 / 透视网格地面。
// 游戏交互全部走 DOM，本 canvas 只负责氛围背景，始终 60fps 轻量重绘。
import { WORLD } from '../../config/game.config.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rand = rng(1337);
  const stars = Array.from({ length: 90 }, () => ({
    x: rand() * W,
    y: rand() * H * 0.6,
    r: 0.6 + rand() * 1.6,
    ph: rand() * Math.PI * 2,
  }));

  const HORIZON = H * 0.62;
  const MOUNTAINS = [
    { color: '#2A1440', pts: [[0, HORIZON], [120, HORIZON - 90], [260, HORIZON - 40], [430, HORIZON - 150], [620, HORIZON - 60], [820, HORIZON - 180], [1000, HORIZON - 70], [1160, HORIZON - 130], [1280, HORIZON]] },
    { color: '#1B0C30', pts: [[0, HORIZON], [180, HORIZON - 60], [380, HORIZON - 120], [560, HORIZON - 40], [760, HORIZON - 150], [940, HORIZON - 70], [1100, HORIZON - 120], [1280, HORIZON]] },
  ];

  function poly(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  let time = 0;

  return {
    draw(state, dt, view) {
      if (!reduceMotion) time += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 天空渐变
      const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
      sky.addColorStop(0, '#0B0716');
      sky.addColorStop(0.55, '#241A4A');
      sky.addColorStop(0.85, '#5B2A86');
      sky.addColorStop(1, '#B03A78');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, HORIZON + 2);

      // 星空
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const tw = reduceMotion ? 0.8 : 0.5 + 0.5 * Math.sin(time * 1.8 + s.ph);
        ctx.globalAlpha = 0.25 + 0.65 * tw;
        ctx.fillStyle = '#EAF6FF';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 复古太阳（横条扫描线）
      const sunY = HORIZON - 78;
      ctx.save();
      ctx.fillStyle = '#FF4FA0';
      ctx.shadowColor = '#FF4FA0';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(W / 2, sunY, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(11, 7, 22, 0.85)';
      for (let i = 0; i < 6; i += 1) {
        const y = sunY - 78 + i * 24;
        ctx.fillRect(W / 2 - 92, y, 184, 6 + i * 2.5);
      }

      // 山影
      for (const m of MOUNTAINS) {
        ctx.fillStyle = m.color;
        poly(m.pts);
        ctx.fill();
      }

      // 地面
      ctx.fillStyle = '#120B24';
      ctx.fillRect(0, HORIZON, W, H - HORIZON);

      // 透视网格地面
      const scroll = reduceMotion ? 0 : (time * 46) % 56;
      ctx.strokeStyle = 'rgba(255, 60, 180, 0.55)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 14; i += 1) {
        const t = i / 14;
        const x0 = W / 2 + (t - 0.5) * W * 0.14;
        ctx.beginPath();
        ctx.moveTo(W / 2 + (t - 0.5) * W * 0.02, HORIZON);
        ctx.lineTo(x0 * 2.2, H);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      for (let i = 0; i <= 8; i += 1) {
        const y = HORIZON + Math.pow(i / 8, 2.2) * (H - HORIZON);
        ctx.beginPath();
        ctx.moveTo(0, y + scroll * (i / 8));
        ctx.lineTo(W, y + scroll * (i / 8));
        ctx.stroke();
      }

      // 暗角
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    },
  };
}
