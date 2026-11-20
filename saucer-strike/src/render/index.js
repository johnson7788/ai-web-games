// createRender 装配：纯消费 sim 状态渲染，不持有游戏逻辑。
// 导出 createRender(canvas) → { draw(run, interp), resize(), burst(x,y,kind), signature(x,y) }。
import { WORLD, DPR_CAP, CHAPTER_FADE_SEC, GUN_R, PROJ_R, SHAKE, FONT, chapter, hexToRgb, rgbCss, clamp } from './theme.js';
import { drawScene, blendPalette } from './scene.js';
import { createParticles } from './particles.js';
import { saucerVisible } from '../game/sim.js';
import { SAUCER_TYPES } from '../../config/levels.js';

function makeGlowSprite(radius, core, edge) {
  const size = Math.max(2, Math.ceil(radius * 2));
  const s = document.createElement('canvas');
  s.width = size;
  s.height = size;
  const c = s.getContext('2d');
  const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, core);
  g.addColorStop(0.42, core);
  g.addColorStop(1, edge);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return s;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const glow = makeGlowSprite(24, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
  const particles = createParticles();

  let chapterFrom = 1;
  let chapterTo = 1;
  let chapterFadeT = 1;
  let shakeMag = 0;
  let sigFlash = 0;
  let lastNow = 0;
  let lastShakeAt = -1e9;

  function clampChapter(n) {
    return clamp(Math.round(n) || 1, 1, 3);
  }

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

  function requestShake(mag) {
    if (reduceMotion) return;
    const now = performance.now();
    if (now - lastShakeAt < 10000) return;
    lastShakeAt = now;
    shakeMag = Math.max(shakeMag, mag);
  }

  function burst(x, y, kind) {
    particles.burst(x, y, kind);
    if (kind === 'kill') requestShake(SHAKE.boss);
  }

  function signature() {
    if (reduceMotion) return;
    sigFlash = 1;
    requestShake(SHAKE.signature);
  }

  // ---------- 绘制 ----------
  function drawSaucer(s, now, pal) {
    const r = s.radius * 1.4; // 视觉放大，保证远景可读
    const type = SAUCER_TYPES[s.type] || {};
    const color = s.color || type.color || '#7df9ff';
    const colRgb = hexToRgb(color.startsWith('#') ? color : '#7df9ff');

    ctx.save();
    ctx.translate(s.x, s.y);

    // 外圈脉冲光环（强对比，一眼看出「目标」）
    ctx.strokeStyle = rgbCss(colRgb, 0.95);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
    ctx.stroke();

    // 碟身（更不透明）
    ctx.fillStyle = rgbCss(colRgb, 0.55);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 穹顶（亮）
    ctx.fillStyle = rgbCss(colRgb, 1);
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r * 0.55, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // 舷窗灯
    ctx.fillStyle = '#ffffff';
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.arc(i * r * 0.3, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 底部光柱（投射感）
    ctx.fillStyle = rgbCss(colRgb, 0.35);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.4, r * 0.42, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 目标括号（四角）—— 明确「这是敌人」
    const R = r + 12;
    const L = 13;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-R, -R + L); ctx.lineTo(-R, -R); ctx.lineTo(-R + L, -R);
    ctx.moveTo(R - L, -R); ctx.lineTo(R, -R); ctx.lineTo(R, -R + L);
    ctx.moveTo(-R, R - L); ctx.lineTo(-R, R); ctx.lineTo(-R + L, R);
    ctx.moveTo(R - L, R); ctx.lineTo(R, R); ctx.lineTo(R, R - L);
    ctx.stroke();

    ctx.restore();
  }

  function drawSaucerHidden(s, now) {
    // 隐形且未显形：完全不画（或极淡轮廓）——留空让玩家无法预判
  }

  function drawProjectile(p, pal) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, PROJ_R * 3);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, 'rgba(125,249,255,0.8)');
    g.addColorStop(1, 'rgba(125,249,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - PROJ_R * 3, p.y - PROJ_R * 3, PROJ_R * 6, PROJ_R * 6);
    ctx.restore();
  }

  function drawTracer(p, pal) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 12);
    g.addColorStop(0, 'rgba(255,249,220,1)');
    g.addColorStop(0.5, 'rgba(255,209,102,0.9)');
    g.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
    ctx.restore();
  }

  function drawMeteor(m, pal) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,158,79,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(m.x - m.vx * 0.05, m.y - m.vy * 0.05);
    ctx.lineTo(m.x, m.y);
    ctx.stroke();
    ctx.fillStyle = '#ff9e4f';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCannon(run, pal, now) {
    const hud = run.getHud();
    const ang = run.aim.active ? run.lastAngle : -Math.PI / 2;
    const x = WORLD.CANNON_X;
    const y = WORLD.CANNON_Y;
    const overheated = hud.overheated;
    const charge = clamp(hud.charge, 0, 1);

    ctx.save();
    ctx.translate(x, y);

    // 底座外环（高对比，明确「玩家炮塔」）
    ctx.strokeStyle = rgbCss(hexToRgb(pal.accent), 0.95);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, GUN_R + 14, 0, Math.PI * 2);
    ctx.stroke();

    // 底座内盘
    ctx.fillStyle = 'rgba(12,16,26,0.95)';
    ctx.beginPath();
    ctx.arc(0, 0, GUN_R + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgbCss(hexToRgb(pal.accent), 0.6);
    ctx.lineWidth = 2;
    ctx.stroke();

    // 炮管（更粗更长）
    ctx.rotate(ang);
    const barrelLen = 56 + charge * 30;
    ctx.strokeStyle = overheated ? '#ff5d73' : '#eaffff';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(barrelLen, 0);
    ctx.stroke();
    // 炮口亮环
    ctx.fillStyle = overheated ? '#ff5d73' : '#7df9ff';
    ctx.beginPath();
    ctx.arc(barrelLen, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 蓄力光柱 + 瞄准十字
    if (run.aim.active) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glowR = 12 + charge * 18;
      const g = ctx.createRadialGradient(barrelLen * Math.cos(ang) + x, barrelLen * Math.sin(ang) + y, 0, barrelLen * Math.cos(ang) + x, barrelLen * Math.sin(ang) + y, glowR);
      g.addColorStop(0, overheated ? 'rgba(255,93,115,0.9)' : 'rgba(125,249,255,0.9)');
      g.addColorStop(1, 'rgba(125,249,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(barrelLen * Math.cos(ang) + x - glowR, barrelLen * Math.sin(ang) + y - glowR, glowR * 2, glowR * 2);
      ctx.globalCompositeOperation = 'source-over';

      // 瞄准十字
      const ax = run.aim.x;
      const ay = run.aim.y;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ax, ay, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax - 20, ay); ctx.lineTo(ax - 7, ay);
      ctx.moveTo(ax + 7, ay); ctx.lineTo(ax + 20, ay);
      ctx.moveTo(ax, ay - 20); ctx.lineTo(ax, ay - 7);
      ctx.moveTo(ax, ay + 7); ctx.lineTo(ax, ay + 20);
      ctx.stroke();

      // 瞄准虚线
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = `rgba(255,255,255,${0.2 + charge * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * (GUN_R + 18), y + Math.sin(ang) * (GUN_R + 18));
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 过热警示环
    if (overheated) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,93,115,${0.5 + 0.5 * Math.sin(now * 0.02)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, GUN_R + 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawRevealLines(run, pal) {
    if (!run.tracerActive) return;
    ctx.save();
    ctx.strokeStyle = rgbCss(hexToRgb(pal.accent), 0.6);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    for (const s of run.saucers) {
      if (!s.active) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      for (let i = s.wayIndex + 1; i < s.path.length; i += 1) {
        ctx.lineTo(s.path[i].x, s.path[i].y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawObjective(run) {
    if (!run.waveActive) return;
    const wave = Math.max(1, run.wave);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 209, 102, 0.95)';
    ctx.font = `800 34px ${FONT}`;
    ctx.shadowColor = 'rgba(255, 209, 102, 0.7)';
    ctx.shadowBlur = 16;
    ctx.fillText(`WAVE ${wave}`, WORLD.WIDTH / 2, 104);
    ctx.shadowBlur = 0;
    // 剩余目标小圆点
    const left = run.waveSaucers;
    if (left > 0) {
      ctx.fillStyle = 'rgba(244, 234, 216, 0.9)';
      for (let i = 0; i < Math.min(left, 12); i += 1) {
        ctx.beginPath();
        ctx.arc(WORLD.WIDTH / 2 - (Math.min(left, 12) - 1) * 8 + i * 16, 134, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSignatureGrid(ctx2, alpha, now) {
    if (alpha <= 0.001) return;
    ctx2.save();
    ctx2.globalAlpha = alpha * 0.5;
    ctx2.strokeStyle = '#ff3d5a';
    ctx2.lineWidth = 1.5;
    // 同心圆
    for (let r = 60; r < 640; r += 80) {
      ctx2.beginPath();
      ctx2.arc(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, r, 0, Math.PI * 2);
      ctx2.stroke();
    }
    // 放射线
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      ctx2.beginPath();
      ctx2.moveTo(WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
      ctx2.lineTo(WORLD.WIDTH / 2 + Math.cos(a) * 640, WORLD.HEIGHT / 2 + Math.sin(a) * 640);
      ctx2.stroke();
    }
    ctx2.restore();
  }

  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;

    particles.update(dt);
    shakeMag *= Math.max(0, 1 - SHAKE.decay * dt);
    if (shakeMag < 0.15) shakeMag = 0;
    sigFlash *= Math.max(0, 1 - 2.4 * dt);

    // 清屏
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#010409';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (!run) {
      drawScene(ctx, { chapterFrom: 1, chapterTo: 1, fadeT: 1, now, reduceMotion });
      return;
    }

    const hud = run.getHud();
    const chIdx = clampChapter(hud.chapter);
    if (chIdx !== chapterTo) {
      chapterFrom = chapterTo;
      chapterTo = chIdx;
      chapterFadeT = 0;
    }
    chapterFadeT = Math.min(1, chapterFadeT + dt / CHAPTER_FADE_SEC);
    if (chapterFadeT >= 1) { chapterFadeT = 1; chapterFrom = chapterTo; }

    const pal = blendPalette(chapterFrom, chapterTo, chapterFadeT);
    const shx = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;
    const shy = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;

    drawScene(ctx, { chapterFrom, chapterTo, fadeT: chapterFadeT, now, reduceMotion });

    ctx.save();
    ctx.translate(shx, shy);

    drawRevealLines(run, pal);

    // 碟
    for (const s of run.saucers) {
      if (!s.active) continue;
      if (saucerVisible(run, s)) drawSaucer(s, now, pal);
    }

    // 流星
    for (const m of run.meteors) drawMeteor(m, pal);

    // 炮弹 / 曳光弹
    for (const p of run.projectiles) drawProjectile(p, pal);
    for (const t of run.tracers) drawTracer(t, pal);

    drawCannon(run, pal, now);
    particles.draw(ctx);
    ctx.restore();

    // 目标提示：WAVE N + 剩余目标
    drawObjective(run);

    // 签名瞬间：雷达红闪网格
    drawSignatureGrid(ctx, sigFlash, now);
  }

  resize();

  return { draw, resize, burst, signature };
}
