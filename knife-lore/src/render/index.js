// KNIFE LORE · createRender 装配：渲染函数纯消费 sim 状态，不持有游戏逻辑。
// 导出 createRender(canvas) → { draw(run, interp), resize(), burst(x,y,kind), triggerSignature() }。
// 三大场景包（竹庭绿/暮城朱红/雪岳蓝白）+ 卷轴桩（圆/方/双/移动）+ 手里剑 + 墨点粒子 + 绽裂签名。
import { WORLD, DPR_CAP, KNIFE, POST as POST_THEME, FONT, packOf, clamp } from './theme.js';
import { createParticles } from './particles.js';
import { normalizeDeg } from '../../config/gameplay.js';

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = createParticles();
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let lastNow = 0;
  let sigT = 0; // 绽裂签名动画进度 0..1
  let sigDur = 1.3;
  let sigInk = null;

  function resize() {
    const dpr = clamp(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1, DPR_CAP);
    const cssW = canvas.clientWidth || WORLD.WIDTH;
    const cssH = canvas.clientHeight || WORLD.HEIGHT;
    const scale = Math.min(cssW / WORLD.WIDTH, cssH / WORLD.HEIGHT);
    const ox = (cssW - WORLD.WIDTH * scale) / 2;
    const oy = (cssH - WORLD.HEIGHT * scale) / 2;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  }

  function triggerSignature() {
    if (reduceMotion) { sigT = 0.001; return; }
    sigT = 0.001;
    sigInk = { x: WORLD.WIDTH / 2, y: 360 };
  }

  function burst(x, y, kind) {
    particles.burst(x, y, kind);
  }

  // ---------- 背景 ----------
  function drawBackground(pal, t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.55, pal.mid);
    g.addColorStop(1, pal.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    if (pal.decor === 'bamboo') drawBamboo(pal, t);
    else if (pal.decor === 'city') drawCity(pal, t);
    else if (pal.decor === 'peak') drawPeak(pal, t);
  }

  function drawBamboo(pal, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let i = 0; i < 7; i += 1) {
      const x = 60 + i * 190;
      ctx.fillRect(x, 0, 14, WORLD.HEIGHT);
      ctx.fillRect(x - 3, 120, 20, 4);
      ctx.fillRect(x - 3, 300, 20, 4);
      ctx.fillRect(x - 3, 520, 20, 4);
    }
    ctx.fillStyle = 'rgba(126, 240, 176, 0.20)';
    for (let i = 0; i < 9; i += 1) {
      const x = 30 + ((i * 151) % 1220);
      const y = 40 + ((i * 97) % 320);
      ctx.beginPath();
      ctx.ellipse(x, y, 60, 16, -0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCity(pal, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 5, 7, 0.6)';
    const horizon = 520;
    for (let i = 0; i < 9; i += 1) {
      const x = i * 150;
      const w = 90 + (i % 3) * 30;
      const h = 120 + ((i * 61) % 180);
      ctx.fillRect(x, horizon - h + 60, w, h);
    }
    ctx.fillStyle = 'rgba(255, 180, 95, 0.55)';
    for (let i = 0; i < 9; i += 1) {
      const x = i * 150 + 40;
      const y = horizon - 60 - ((i * 37) % 90);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPeak(pal, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(230, 244, 255, 0.12)';
    for (let i = 0; i < 3; i += 1) {
      const bx = i * 420 - 60;
      ctx.beginPath();
      ctx.moveTo(bx, 720);
      ctx.lineTo(bx + 230, 300 - i * 60);
      ctx.lineTo(bx + 470, 720);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(230, 244, 255, 0.5)';
    for (let i = 0; i < 26; i += 1) {
      const x = (i * 211 + Math.floor(t * 40)) % 1280;
      const y = (i * 97) % 460;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- 卷轴桩 ----------
  function drawPost(p, run, pal) {
    const knives = run.stuck.filter((s) => s.postIndex === p.id);
    const inkCount = knives.length;

    ctx.save();
    ctx.translate(p.x, p.y);

    // 绽裂签名：桩裂成两半
    if (sigT > 0) {
      const split = sigT * p.radius * 0.9;
      drawHalf(p, pal, inkCount, -split);
      drawHalf(p, pal, inkCount, split, true);
      ctx.restore();
      return;
    }

    if (p.shape === 'square') {
      ctx.rotate(p.angle * RAD);
      const s = p.radius * 0.72;
      const wood = ctx.createLinearGradient(-s, -s, s, s);
      wood.addColorStop(0, POST_THEME.woodInner);
      wood.addColorStop(1, POST_THEME.woodOuter);
      ctx.fillStyle = wood;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeStyle = POST_THEME.cap;
      ctx.lineWidth = 8;
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      // 纸卷带
      ctx.fillStyle = POST_THEME.paper;
      ctx.fillRect(-s * 0.55, -s, s * 1.1, s * 2);
    } else {
      ctx.rotate(p.angle * RAD);
      // 木质圆盘
      const wood = ctx.createRadialGradient(0, 0, p.radius * 0.2, 0, 0, p.radius);
      wood.addColorStop(0, POST_THEME.woodInner);
      wood.addColorStop(0.72, POST_THEME.woodOuter);
      wood.addColorStop(1, POST_THEME.cap);
      ctx.fillStyle = wood;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, TAU);
      ctx.fill();
      // 纸卷环
      ctx.strokeStyle = POST_THEME.paper;
      ctx.lineWidth = POST_THEME.ringWidth;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius - POST_THEME.ringWidth * 0.7, 0, TAU);
      ctx.stroke();
    }

    // 墨痕：每插一刀刻一圈（局部角度位置画一小段墨弧）
    ctx.strokeStyle = POST_THEME.ink;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const k of knives) {
      const a = k.localAngle * RAD;
      const r = p.radius - 8;
      ctx.beginPath();
      ctx.arc(0, 0, r, a - 0.16, a + 0.16);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHalf(p, pal, inkCount, dx, right) {
    ctx.save();
    ctx.translate(dx, 0);
    ctx.beginPath();
    ctx.rect(right ? 0 : -p.radius, -p.radius, p.radius, p.radius * 2);
    ctx.clip();
    ctx.rotate(p.angle * RAD);
    const wood = ctx.createRadialGradient(0, 0, p.radius * 0.2, 0, 0, p.radius);
    wood.addColorStop(0, POST_THEME.woodInner);
    wood.addColorStop(1, POST_THEME.woodOuter);
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = POST_THEME.paper;
    ctx.lineWidth = POST_THEME.ringWidth;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius - POST_THEME.ringWidth * 0.7, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = POST_THEME.ink;
    ctx.lineWidth = 5;
    for (let i = 0; i < inkCount; i += 1) {
      const a = (i * 360 / Math.max(1, inkCount)) * RAD;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius - 8, a - 0.16, a + 0.16);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- 手里剑 ----------
  function drawShuriken(x, y, angleDeg, scale, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angleDeg * RAD);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = KNIFE.bladeColor;
    ctx.strokeStyle = KNIFE.edgeColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = KNIFE.glow;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    // 四尖手里剑
    for (let i = 0; i < 4; i += 1) {
      const a = i * (Math.PI / 2);
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * KNIFE.bladeLen, Math.sin(a) * KNIFE.bladeLen);
      ctx.lineTo(Math.cos(a + Math.PI / 2) * KNIFE.bladeW, Math.sin(a + Math.PI / 2) * KNIFE.bladeW);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, TAU);
    ctx.fillStyle = KNIFE.edgeColor;
    ctx.fill();
    ctx.restore();
  }

  function drawSafeArc(p, run) {
    const hud = run.getHud();
    const arc = hud.safeArc;
    if (!arc || arc.width <= 0) return;
    const a0 = (arc.center - arc.width / 2) * RAD;
    const a1 = (arc.center + arc.width / 2) * RAD;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = 'rgba(255, 240, 170, 0.95)';
    ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(255, 240, 170, 0.9)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 14, a0, a1);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ---------- 绽裂签名：光圆环 ----------
  function drawSignature(pal) {
    if (sigT <= 0) return;
    const t = Math.min(1, sigT);
    const r = 40 + t * 300;
    const cx = sigInk ? sigInk.x : WORLD.WIDTH / 2;
    const cy = sigInk ? sigInk.y : 360;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.strokeStyle = pal.glow;
    ctx.lineWidth = 6;
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- 主绘制 ----------
  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;

    particles.update(dt);
    if (sigT > 0) sigT = Math.min(1, sigT + dt / sigDur);

    // 清屏 + letterbox
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#02060a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const pal = packOf(run ? run.level.pack : 'bamboo');
    drawBackground(pal, now / 1000);

    if (!run) {
      // 标题屏：只画背景氛围
      particles.draw(ctx);
      return;
    }

    // 桩
    for (const p of run.posts) drawPost(p, run, pal);

    // 已插手里剑（随桩旋转：世界角 = 桩角 + 局部角）
    for (const p of run.posts) {
      for (const s of run.stuck) {
        if (s.postIndex !== p.id) continue;
        const wa = p.angle + s.localAngle;
        const x = p.x + Math.sin(wa * RAD) * (p.radius - 6);
        const y = p.y - Math.cos(wa * RAD) * (p.radius - 6);
        drawShuriken(x, y, normalizeDeg(180 - wa), 0.8, 0.96);
      }
    }

    // 飞行中的手里剑
    if (run.flying) {
      const f = run.flying;
      const p = run.posts[f.postIndex];
      const t = Math.min(1, f.progress);
      const sx = p.x;
      const sy = p.y + p.radius + KNIFE.SPAWN_OFFSET;
      const ex = p.x;
      const ey = p.y + p.radius - 6;
      const x = sx + (ex - sx) * t;
      const y = sy + (ey - sy) * t;
      drawShuriken(x, y, 0, 1.15, 1);
    }

    // 斩铁安全角
    if (run.zantieActive) {
      for (const p of run.posts) drawSafeArc(p, run);
    }

    particles.draw(ctx);
    drawSignature(pal);
  }

  resize();

  return { draw, resize, burst, triggerSignature, particles };
}
