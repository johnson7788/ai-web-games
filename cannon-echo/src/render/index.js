// CANNON ECHO · 渲染装配：场景 + 炮台 + 目标 + 炮弹 + 粒子（Canvas2D 程序化，零素材）
import { WORLD } from '../../config/game.config.js';
import { TARGET } from '../../config/gameplay.js';
import { drawScene } from './scene.js';
import { themeAt, TARGET_COLORS } from './theme.js';
import { createParticles } from './particles.js';

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = createParticles();
  let time = 0;
  let lastTime = 0;

  function drawCannon(run, accent, fortressLight) {
    const cx = WORLD.CANNON_X;
    const cy = WORLD.CANNON_Y;
    const over = run && run.overheated;

    // 底座光晕
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.20;
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 底座
    ctx.fillStyle = '#14100c';
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.stroke();

    // 炮管（朝 run.angle）
    const angle = run ? run.angle : -0.35;
    const len = 72;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, over ? '#ff5a3a' : '#6a6452');
    grad.addColorStop(1, over ? '#ffb0a0' : fortressLight);
    ctx.fillStyle = grad;
    ctx.fillRect(0, -16, len, 32);
    ctx.fillStyle = over ? '#fff0e0' : accent;
    ctx.fillRect(len - 10, -20, 10, 40);
    ctx.restore();

    // 顶部圆帽
    ctx.fillStyle = over ? '#ff7a5a' : '#eafbe8';
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawTarget(t, th) {
    const c = TARGET_COLORS[t.type] || TARGET_COLORS.crate;
    const flash = t.hitFlash != null && time - t.hitFlash < 0.08;
    const w = t.type === 'boss' ? TARGET.W * 2.2 : TARGET.W;
    const h = t.type === 'boss' ? TARGET.H * 2.2 : TARGET.H;
    const x = t.x - w / 2;
    const y = t.y - h / 2;

    ctx.save();
    if (flash) ctx.globalAlpha = 0.75;

    // 下坠拖尾（diver 更明显）
    if (t.type === 'diver') {
      ctx.fillStyle = c.rim;
      ctx.globalAlpha *= 0.4;
      ctx.fillRect(x + 6, y - 18, w - 12, 18);
      ctx.globalAlpha = flash ? 0.75 : 1;
    }

    // 主体
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = c.fill;
    ctx.fill();
    ctx.strokeStyle = c.rim;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 护盾（shielded）
    if (t.shield) {
      ctx.strokeStyle = c.shield;
      ctx.lineWidth = 5;
      roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 10);
      ctx.stroke();
      ctx.fillStyle = c.shield;
      ctx.fillRect(x + 4, y - 4, w - 8, 8); // 护盾条
    }

    // 装甲铆钉
    if (t.armor) {
      ctx.fillStyle = c.rim;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.arc(x + 10 + dx * (w - 20), y + 10 + dy * (h - 20), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HP 数字
    ctx.fillStyle = c.text;
    ctx.font = `bold ${t.type === 'boss' ? 30 : 19}px 'Segoe UI', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = c.rim;
    ctx.strokeText(String(Math.max(0, Math.ceil(t.hp))), t.x, t.y + 1);
    ctx.fillText(String(Math.max(0, Math.ceil(t.hp))), t.x, t.y + 1);

    ctx.restore();
  }

  function drawBullet(b, th) {
    const lx = b.x - b.vx * 0.04;
    const ly = b.y - b.vy * 0.04;
    ctx.strokeStyle = b.bounces > 0 ? '#7fe0ff' : th.accent;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = b.bounces > 0 ? '#cfeaff' : '#fff0c0';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawDemo(th) {
    // 标题屏背后的静态演示：一门炮 + 几个货箱
    drawCannon(null, th.accent, th.fortressLight);
    const demos = [
      { x: 420, y: 150, type: 'crate' },
      { x: 640, y: 220, type: 'shielded' },
      { x: 880, y: 130, type: 'armored' },
    ];
    for (const d of demos) {
      const t = { ...d, w: TARGET.W, h: TARGET.H, hp: 99, hitFlash: -Infinity };
      drawTarget(t, th);
    }
  }

  function draw(run, alpha) {
    const now = performance.now();
    if (lastTime) time += Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    const scene = run ? run.scene : 0;
    const th = themeAt(scene);

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    drawScene(ctx, scene, time);

    if (run) {
      for (const t of run.targets) drawTarget(t, th);
      for (const b of run.bullets) drawBullet(b, th);
      drawCannon(run, th.accent, th.fortressLight);
    } else {
      drawDemo(th);
    }

    particles.update(1 / 60);
    particles.draw(ctx);
  }

  return {
    draw,
    burst(x, y, kind) {
      const th = themeAt(0);
      particles.burst(x, y, kind, th.accent);
    },
    setAccent(scene) {
      // 预留：切场景时粒子用对应 accent（简单起见 burst 已带 accent）
    },
    get particles() { return particles; },
  };
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
