// src/render/index.js — BILLION HUSTLE · 程序化 Canvas 渲染
// 三场景包（车库/孵化器/摩天办公）+ 风口轮盘 + 金币粒子 + 融资翻牌 confetti。
// 契约：createRender(canvas) → { draw(run, alpha), burst(x, y, kind) }。
import { WORLD } from '../../config/game.config.js';
import { themeFor } from './theme.js';

// 与 styles.css 里 #btn-tap 对齐的逻辑坐标（canvas 与 DOM 一起随 letterbox 缩放）
export const LAYOUT = {
  tapX: 420,
  tapY: 360,
  tapR: 150,
};

const SECTOR_COLORS = ['#ff6b6b', '#4dd0ff', '#b06bff', '#5ee06a', '#ffc94a', '#ff9ad5'];

function rngColor(seed) {
  return SECTOR_COLORS[Math.abs(seed) % SECTOR_COLORS.length];
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  let lastNow = 0;
  const particles = [];

  function spawn(x, y, kind, n) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 240;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        life: 0.5 + Math.random() * 0.6,
        maxLife: 1.1,
        size: kind === 'coin' ? 4 + Math.random() * 5 : 5 + Math.random() * 8,
        color: kind === 'coin' ? '#ffc94a' : rngColor(Math.floor(Math.random() * 6)),
        kind,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 6,
      });
    }
  }

  function burst(x, y, kind) {
    spawn(x, y, kind, kind === 'confetti' ? 60 : 10);
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'coin' ? 300 : 160) * dt;
      p.rot += p.vr * dt;
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = a;
      if (p.kind === 'coin') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.32, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }
  }

  // ---------------- 三场景 ----------------
  function drawScene(sceneId, t) {
    const th = themeFor(sceneId);
    const W = WORLD.WIDTH;
    const H = WORLD.HEIGHT;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bg);
    g.addColorStop(1, th.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (sceneId === 'garage') drawGarage(th, t);
    else if (sceneId === 'incubator') drawIncubator(th, t);
    else drawSkyscraper(th, t);

    // 底部暗化，让 HUD 与 shop 更清晰
    const vg = ctx.createLinearGradient(0, H - 220, 0, H);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, H - 220, W, 220);
  }

  function drawGarage(th, t) {
    // 车库卷帘门
    ctx.fillStyle = th.line;
    ctx.fillRect(700, 90, 520, 430);
    ctx.fillStyle = th.bg2;
    ctx.fillRect(712, 102, 496, 406);
    for (let i = 0; i < 9; i += 1) {
      ctx.fillStyle = 'rgba(58,44,26,0.14)';
      ctx.fillRect(712, 102 + i * 45, 496, 6);
    }
    // 工作台
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(60, 470, 420, 26);
    ctx.fillStyle = '#7a4e22';
    ctx.fillRect(80, 496, 24, 90);
    ctx.fillRect(436, 496, 24, 90);
    // 台灯（暖光闪烁）
    const flick = 0.85 + 0.15 * Math.sin(t * 7);
    ctx.fillStyle = '#e88a2e';
    ctx.fillRect(150, 360, 90, 8);
    ctx.fillRect(232, 360, 8, 70);
    const lg = ctx.createRadialGradient(236, 430, 4, 236, 430, 130);
    lg.addColorStop(0, `rgba(255,184,77,${0.55 * flick})`);
    lg.addColorStop(1, 'rgba(255,184,77,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(100, 300, 280, 200);
    // 工具盒
    ctx.fillStyle = '#b98a4a';
    ctx.fillRect(470, 430, 120, 60);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(500, 412, 60, 20);
  }

  function drawIncubator(th, t) {
    // 玻璃隔断
    for (let i = 0; i < 4; i += 1) {
      ctx.fillStyle = th.glass;
      ctx.fillRect(120 + i * 300, 60, 8, 560);
    }
    // 工位 + 显示器
    for (let i = 0; i < 3; i += 1) {
      const x = 150 + i * 300;
      ctx.fillStyle = '#043038';
      ctx.fillRect(x, 400, 240, 12);
      ctx.fillStyle = '#031e22';
      ctx.fillRect(x + 20, 320, 200, 80);
      const blink = (Math.sin(t * 2 + i) > 0.2) ? th.accent : '#0a5a55';
      ctx.fillStyle = blink;
      ctx.fillRect(x + 30, 330, 180, 60);
      ctx.fillStyle = '#0a2a2a';
      ctx.fillRect(x + 40, 410, 20, 50);
    }
    // 绿植
    for (let i = 0; i < 3; i += 1) {
      const x = 260 + i * 300;
      ctx.fillStyle = '#0f6a52';
      ctx.beginPath();
      ctx.arc(x, 452, 30, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#2f9e6e';
      ctx.beginPath();
      ctx.arc(x - 16, 470, 16, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 16, 470, 16, Math.PI, 0);
      ctx.fill();
    }
  }

  function drawSkyscraper(th, t) {
    // 落地窗格
    for (let gx = 0; gx < 8; gx += 1) {
      for (let gy = 0; gy < 6; gy += 1) {
        const x = 80 + gx * 140;
        const y = 60 + gy * 90;
        ctx.fillStyle = 'rgba(123,92,255,0.10)';
        ctx.fillRect(x, y, 132, 82);
        ctx.strokeStyle = 'rgba(77,155,255,0.20)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, 132, 82);
        // 城市灯光（闪烁）
        if ((gx * 7 + gy * 13) % 3 === 0) {
          const tw = 0.5 + 0.5 * Math.sin(t * 3 + gx * gy);
          ctx.fillStyle = `rgba(255,220,120,${0.3 + 0.5 * tw})`;
          ctx.beginPath();
          ctx.arc(x + 20 + (gx * 17) % 90, y + 24 + (gy * 13) % 40, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // 远景天际线
    ctx.fillStyle = 'rgba(10,14,40,0.85)';
    for (let i = 0; i < 20; i += 1) {
      const bw = 30 + (i * 37) % 60;
      const bh = 60 + (i * 53) % 140;
      ctx.fillRect(i * 70 - 10, 720 - bh - 130, bw, bh + 130);
    }
    // 办公桌
    ctx.fillStyle = '#2a2f5c';
    ctx.fillRect(60, 470, 420, 22);
    ctx.fillStyle = '#1c2048';
    ctx.fillRect(90, 492, 20, 80);
    ctx.fillRect(440, 492, 20, 80);
  }

  // ---------------- 标题屏纯色背景（无杂噪，剪影更干净） ----------------
  function drawTitleBackdrop(t) {
    const W = WORLD.WIDTH;
    const H = WORLD.HEIGHT;
    const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 700);
    g.addColorStop(0, '#241d12');
    g.addColorStop(1, '#0c0a06');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 稀疏金币
    for (let i = 0; i < 14; i += 1) {
      const x = ((i * 97) % W);
      const y = ((i * 61) % H) + Math.sin(t + i) * 12;
      ctx.fillStyle = 'rgba(255,201,74,0.16)';
      ctx.beginPath();
      ctx.arc(x, y, 5 + (i % 3) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------------- 主绘制 ----------------
  function draw(run, alpha, phase) {
    const now = performance.now() / 1000;
    if (!lastNow) lastNow = now;
    const dt = Math.min(0.1, now - lastNow);
    lastNow = now;

    const hud = run ? run.getHud() : null;
    const sceneId = hud ? hud.sceneId : 'garage';

    if (run && (phase === 'playing' || phase === 'paused' || phase === 'won')) drawScene(sceneId, now);
    else drawTitleBackdrop(now);

    // 点击按钮背后的呼吸光晕
    if (hud) {
      const pulse = 0.6 + 0.4 * Math.sin(now * 4);
      const th = themeFor(sceneId);
      const g = ctx.createRadialGradient(LAYOUT.tapX, LAYOUT.tapY, 20, LAYOUT.tapX, LAYOUT.tapY, LAYOUT.tapR + 40);
      g.addColorStop(0, `rgba(255,201,74,${0.35 * pulse})`);
      g.addColorStop(1, 'rgba(255,201,74,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(LAYOUT.tapX, LAYOUT.tapY, LAYOUT.tapR + 40, 0, Math.PI * 2);
      ctx.fill();
      // 倍率光环（烧钱/风口激活时更亮）
      if (hud.mult > 1) {
        ctx.strokeStyle = th.accent;
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now * 8);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(LAYOUT.tapX, LAYOUT.tapY, LAYOUT.tapR + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    updateParticles(dt);
    drawParticles();
  }

  return { draw, burst };
}
