// EARN 100 MILLION · Canvas 渲染：霓虹都市背景 + 粒子 + 连击辉光 + 年份过渡闪白。
// 玩法 UI 由 DOM 承担；canvas 只做氛围层（程序化，零素材）。
import { WORLD } from '../../config/game.config.js';

function makeParticles(n) {
  const arr = [];
  for (let i = 0; i < n; i += 1) {
    arr.push({
      x: Math.random() * WORLD.WIDTH,
      y: Math.random() * WORLD.HEIGHT,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(0.2 + Math.random() * 0.8),
      r: 0.8 + Math.random() * 2.2,
      hue: Math.random() < 0.5 ? 190 : 320,
    });
  }
  return arr;
}

function makeSkyline() {
  const b = [];
  let x = -20;
  while (x < WORLD.WIDTH + 20) {
    const w = 60 + Math.random() * 90;
    const h = 90 + Math.random() * 220;
    b.push({ x, w, h });
    x += w + 6 + Math.random() * 30;
  }
  return b;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = makeParticles(70);
  const skyline = makeSkyline();
  let t = 0;

  function drawBackground(dt, mood) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#07030f');
    g.addColorStop(0.55, '#120826');
    g.addColorStop(1, mood === 1 ? '#1a0f2e' : mood === -1 ? '#120a18' : '#0d0a24');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 霓虹网格（透视地面）
    ctx.strokeStyle = 'rgba(88, 40, 180, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i += 1) {
      const y = WORLD.HEIGHT * 0.55 + (i / 12) * WORLD.HEIGHT * 0.45;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 16; i += 1) {
      const x = (i / 16) * WORLD.WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, WORLD.HEIGHT * 0.55);
      ctx.lineTo(x, WORLD.HEIGHT);
      ctx.stroke();
    }

    // 霓虹太阳/金币（天空锚点，给画面一个明亮剪影）
    const sunX = WORLD.WIDTH * 0.82;
    const sunY = WORLD.HEIGHT * 0.2;
    const sunR = 64;
    const sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, sunR);
    sg.addColorStop(0, '#fff3b0');
    sg.addColorStop(0.55, '#ffd54a');
    sg.addColorStop(1, 'rgba(255, 60, 180, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a4a00';
    ctx.font = '900 44px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', sunX, sunY + 2);

    // 城市剪影（更亮，带霓虹顶边）
    for (const b of skyline) {
      const base = WORLD.HEIGHT * 0.78;
      ctx.fillStyle = 'rgba(30, 14, 58, 0.9)';
      ctx.fillRect(b.x, base - b.h, b.w, b.h);
      ctx.fillStyle = 'rgba(255, 60, 180, 0.85)';
      ctx.fillRect(b.x, base - b.h, b.w, 3);
      // 亮窗
      ctx.fillStyle = 'rgba(255, 160, 90, 0.65)';
      for (let wy = base - b.h + 12; wy < base - 14; wy += 20) {
        for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 18) {
          if (Math.random() < 0.04) ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
  }

  function drawParticles(dt) {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) { p.y = WORLD.HEIGHT + 10; p.x = Math.random() * WORLD.WIDTH; }
      if (p.x < -10) p.x = WORLD.WIDTH + 10;
      if (p.x > WORLD.WIDTH + 10) p.x = -10;
      ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, 0.55)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    draw(state, dt, view = {}) {
      t += dt;
      const mood = state?.marketMood ?? 0;
      drawBackground(dt, mood);

      // 连击辉光（右侧竖条）
      const combo = state?.combo ?? 0;
      if (combo > 0) {
        const gx = WORLD.WIDTH - 26;
        const gy = WORLD.HEIGHT * 0.2;
        const gh = WORLD.HEIGHT * 0.6;
        const grad = ctx.createLinearGradient(0, gy, 0, gy + gh);
        grad.addColorStop(0, 'rgba(255, 60, 180, 0.05)');
        grad.addColorStop(1, `rgba(255, 60, 180, ${0.12 + combo * 0.1})`);
        ctx.fillStyle = grad;
        ctx.fillRect(gx - 12, gy, 24, gh);
        for (let i = 0; i < combo; i += 1) {
          const y = gy + gh - (i + 1) * (gh / 6);
          ctx.fillStyle = '#ff3cb4';
          ctx.fillRect(gx - 4, y - 6, 8, 10);
        }
      }

      drawParticles(dt);

      // 年份过渡闪白
      if (view.flash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.5, view.flash)})`;
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      }
    },
  };
}
