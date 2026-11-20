// HAPPY CHICK HOP · canvas 程序化渲染（手绘卡通风，零素材零外链）
import { WORLD, TIERS, GAME, LAYOUT } from '../../config/game.config.js';
import { radiusOf } from '../game/sim.js';

const W_WORLD = WORLD.WIDTH;
const H_WORLD = WORLD.HEIGHT;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let reducedMotion = false;
  try {
    reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { /* noop */ }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  // 井口（世界 → 屏幕）几何
  function computeLayout() {
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    const top = LAYOUT.HUD_H + 10;
    const bottom = ch - 8;
    let wellH = bottom - top;
    let wellW = wellH * LAYOUT.WELL_ASPECT;
    if (wellW > cw - 16) {
      wellW = cw - 16;
      wellH = wellW / LAYOUT.WELL_ASPECT;
    }
    const wellX = (cw - wellW) / 2;
    const wellY = top;
    const scale = wellW / W_WORLD;
    return { cw, ch, top, bottom, wellX, wellY, wellW, wellH, scale };
  }

  function toScreen(lay, wx, wy) {
    return { x: lay.wellX + wx * lay.scale, y: lay.wellY + wy * lay.scale };
  }

  // 背景：天空渐变 + 太阳 + 草地远山（稳定不闪）
  function drawBackground(lay) {
    const { cw, ch } = lay;
    const sky = ctx.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, '#BFE3F7');
    sky.addColorStop(0.6, '#EAF7E4');
    sky.addColorStop(1, '#D8F0C8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);

    // 太阳
    ctx.fillStyle = 'rgba(255,236,150,0.9)';
    ctx.beginPath();
    ctx.arc(cw - 90, 74, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,236,150,0.35)';
    ctx.beginPath();
    ctx.arc(cw - 90, 74, 56, 0, Math.PI * 2);
    ctx.fill();

    // 远山/草坡
    ctx.fillStyle = '#A8D98A';
    ctx.beginPath();
    ctx.moveTo(0, ch);
    ctx.lineTo(0, ch * 0.82);
    ctx.quadraticCurveTo(cw * 0.3, ch * 0.68, cw * 0.55, ch * 0.84);
    ctx.quadraticCurveTo(cw * 0.8, ch * 0.96, cw, ch * 0.8);
    ctx.lineTo(cw, ch);
    ctx.closePath();
    ctx.fill();
  }

  function drawWell(lay) {
    const { wellX, wellY, wellW, wellH } = lay;
    // 地面草皮
    ctx.fillStyle = '#7CC469';
    ctx.fillRect(wellX - 14, wellY + wellH - 6, wellW + 28, 18);
    ctx.fillStyle = '#5FA84F';
    ctx.fillRect(wellX - 14, wellY + wellH + 8, wellW + 28, 8);
    // 两侧围栏
    ctx.strokeStyle = '#B97A4B';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(wellX - 4, wellY - 6);
    ctx.lineTo(wellX - 4, wellY + wellH + 10);
    ctx.moveTo(wellX + wellW + 4, wellY - 6);
    ctx.lineTo(wellX + wellW + 4, wellY + wellH + 10);
    ctx.stroke();
    // 顶部红线（危险线）
    const danger = toScreen(lay, W_WORLD / 2, GAME.DANGER_Y);
    ctx.strokeStyle = 'rgba(224,58,58,0.85)';
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(wellX, danger.y);
    ctx.lineTo(wellX + wellW, danger.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawRock(lay, x, y, r) {
    const p = toScreen(lay, x, y);
    const rr = Math.max(4, r * lay.scale);
    const g = ctx.createRadialGradient(p.x - rr * 0.3, p.y - rr * 0.3, rr * 0.2, p.x, p.y, rr);
    g.addColorStop(0, '#B7B7B7');
    g.addColorStop(1, '#7A7A7A');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 裂纹
    ctx.strokeStyle = 'rgba(60,60,60,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - rr * 0.4, p.y - rr * 0.2);
    ctx.lineTo(p.x, p.y);
    ctx.lineTo(p.x + rr * 0.4, p.y + rr * 0.3);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - rr * 0.1, p.y + rr * 0.5);
    ctx.stroke();
  }

  function findTarget(state) {
    if (!state || !state.current || state.current.rock) return null;
    let best = null;
    for (const o of state.objects) {
      if (!o.alive || o.rock || o.tier !== state.current.tier) continue;
      if (!best || o.y < best.y) best = o;
    }
    return best;
  }

  function drawTargetRing(lay, o) {
    const r = radiusOf(o) * lay.scale;
    const p = toScreen(lay, o.x, o.y);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 170);
    ctx.save();
    // 金色脉冲环：给视觉模型一个明确「目标落点」
    ctx.strokeStyle = `rgba(255, 193, 7, ${0.55 + 0.45 * pulse})`;
    ctx.lineWidth = 5;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // 顶部向下的箭头标记
    const ay = p.y - r - 26;
    ctx.fillStyle = '#FFC107';
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, ay + 16);
    ctx.lineTo(p.x - 9, ay);
    ctx.lineTo(p.x + 9, ay);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawCreature(lay, o, x, y, r, opts = {}) {
    const p = toScreen(lay, x, y);
    const rr = Math.max(3, r * lay.scale);
    const tier = TIERS[o.tier];
    const g = ctx.createRadialGradient(p.x - rr * 0.3, p.y - rr * 0.4, rr * 0.15, p.x, p.y, rr);
    g.addColorStop(0, tier.color);
    g.addColorStop(1, tier.accent);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,10,0.35)';
    ctx.lineWidth = Math.max(1.5, rr * 0.06);
    ctx.stroke();

    if (opts.preview) {
      // 预览只画轮廓，不画五官
      return;
    }

    const eyeR = Math.max(1.5, rr * 0.11);
    const eyeY = p.y - rr * 0.12;
    const eyeDx = rr * 0.34;
    ctx.fillStyle = '#3B2B1A';
    ctx.beginPath();
    ctx.arc(p.x - eyeDx, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(p.x + eyeDx, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(p.x - eyeDx + eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
    ctx.arc(p.x + eyeDx + eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
    ctx.fill();

    if (o.tier === 0) {
      // 蛋：雀斑
      ctx.fillStyle = 'rgba(150,110,50,0.4)';
      ctx.beginPath();
      ctx.arc(p.x - rr * 0.3, p.y + rr * 0.25, rr * 0.06, 0, Math.PI * 2);
      ctx.arc(p.x + rr * 0.2, p.y + rr * 0.4, rr * 0.05, 0, Math.PI * 2);
      ctx.arc(p.x + rr * 0.4, p.y + rr * 0.1, rr * 0.05, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.tier === 10) {
      // 金鸡：皇冠
      ctx.fillStyle = '#FFC107';
      ctx.beginPath();
      const cy = p.y - rr * 0.62;
      ctx.moveTo(p.x - rr * 0.34, cy + rr * 0.34);
      ctx.lineTo(p.x - rr * 0.4, cy - rr * 0.2);
      ctx.lineTo(p.x - rr * 0.16, cy);
      ctx.lineTo(p.x, cy - rr * 0.34);
      ctx.lineTo(p.x + rr * 0.16, cy);
      ctx.lineTo(p.x + rr * 0.4, cy - rr * 0.2);
      ctx.lineTo(p.x + rr * 0.34, cy + rr * 0.34);
      ctx.closePath();
      ctx.fill();
      // 小嘴
      ctx.fillStyle = '#E8692A';
      ctx.beginPath();
      ctx.moveTo(p.x - rr * 0.12, p.y + rr * 0.18);
      ctx.lineTo(p.x + rr * 0.12, p.y + rr * 0.18);
      ctx.lineTo(p.x, p.y + rr * 0.34);
      ctx.closePath();
      ctx.fill();
    } else {
      // 小鸟嘴 / 小动物嘴
      ctx.fillStyle = '#E8692A';
      ctx.beginPath();
      ctx.moveTo(p.x - rr * 0.12, p.y + rr * 0.14);
      ctx.lineTo(p.x + rr * 0.12, p.y + rr * 0.14);
      ctx.lineTo(p.x, p.y + rr * 0.28);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawParticles(lay, particles, dt) {
    for (const pt of particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 900 * dt;
      pt.life -= dt;
    }
    for (const pt of particles) {
      if (pt.life <= 0) continue;
      const p = toScreen(lay, pt.x, pt.y);
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, pt.r * lay.scale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawComboTexts(lay, comboTexts, dt) {
    for (const c of comboTexts) {
      c.y -= 40 * dt;
      c.life -= dt;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of comboTexts) {
      if (c.life <= 0) continue;
      const p = toScreen(lay, c.x, c.y);
      ctx.globalAlpha = Math.max(0, c.life / c.maxLife);
      ctx.fillStyle = c.color;
      ctx.font = `700 ${Math.max(14, 18 * lay.scale * 0.6 + 12)}px system-ui, sans-serif`;
      ctx.fillText(c.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function draw(state, dt, view) {
    const lay = computeLayout();
    ctx.clearRect(0, 0, lay.cw, lay.ch);

    // 震屏
    ctx.save();
    if (view.shake > 0 && !reducedMotion) {
      ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    }

    drawBackground(lay);
    drawWell(lay);

    // 瞄准线（当前对象到井底）
    if (state && state.current && state.phase === 'playing' && view.phase === 'playing') {
      const aim = toScreen(lay, state.aimX, GAME.SPAWN_Y);
      const r = radiusOf(state.current) * lay.scale;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(aim.x, aim.y + r);
      ctx.lineTo(aim.x, lay.wellY + lay.wellH - 6);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 已落井对象
    if (state) {
      for (const o of state.objects) {
        if (!o.alive) continue;
        const r = radiusOf(o);
        if (o.rock) drawRock(lay, o.x, o.y, r);
        else drawCreature(lay, o, o.x, o.y, r);
      }
      // 目标高亮：当前对象有可合并的同阶同伴时，画脉冲环 + 箭头
      if (state.phase === 'playing' && view.phase === 'playing') {
        const target = findTarget(state);
        if (target) drawTargetRing(lay, target);
      }
      // 当前瞄准对象（画在最上层，带阴影 + 金色描边让它最突出）
      if (state.current && state.phase === 'playing') {
        const r = radiusOf(state.current);
        const aim = toScreen(lay, state.aimX, GAME.SPAWN_Y);
        const rr = r * lay.scale;
        // 投影
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(aim.x, lay.wellY + lay.wellH - 4, rr * 0.8, rr * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        if (state.current.rock) drawRock(lay, state.aimX, GAME.SPAWN_Y, r);
        else drawCreature(lay, state.current, state.aimX, GAME.SPAWN_Y, r);
        // 手持对象外发光圈
        ctx.strokeStyle = 'rgba(255, 213, 79, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(aim.x, aim.y, rr + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 下一只预览
    if (state && state.next) {
      const px = lay.wellX + lay.wellW - 42;
      const py = lay.wellY - 0;
      const pr = 18;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(px, py, pr + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.stroke();
      if (state.next.rock) drawRockAt(px, py, pr);
      else drawCreatureAt(state.next.tier, px, py, pr, true);
    }

    drawParticles(lay, view.particles, dt);
    drawComboTexts(lay, view.comboTexts, dt);
    ctx.restore();
  }

  // 以屏幕像素直接画（预览用）
  function drawRockAt(x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
    g.addColorStop(0, '#B7B7B7');
    g.addColorStop(1, '#7A7A7A');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCreatureAt(tier, x, y, r, preview) {
    const t = TIERS[tier];
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.15, x, y, r);
    g.addColorStop(0, t.color);
    g.addColorStop(1, t.accent);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (!preview) {
      ctx.fillStyle = '#3B2B1A';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.1, r * 0.12, 0, Math.PI * 2);
      ctx.arc(x + r * 0.3, y - r * 0.1, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 教程/验收用：命名的屏幕矩形
  function layoutRect(name) {
    const lay = computeLayout();
    if (name === 'well') {
      return { x: lay.wellX, y: lay.wellY, w: lay.wellW, h: lay.wellH };
    }
    if (name === 'aim') {
      const a = toScreen(lay, WORLD.WIDTH / 2, GAME.SPAWN_Y);
      return { x: a.x - 60, y: a.y - 60, w: 120, h: 120 };
    }
    if (name === 'danger') {
      const d = toScreen(lay, WORLD.WIDTH / 2, GAME.DANGER_Y);
      return { x: lay.wellX, y: d.y - 10, w: lay.wellW, h: 20 };
    }
    return { x: lay.wellX, y: lay.wellY, w: lay.wellW, h: lay.wellH };
  }

  return {
    draw,
    resize,
    debugLayout: computeLayout,
    layoutRect,
    worldFromScreen(px, py) {
      const lay = computeLayout();
      return {
        x: (px - lay.wellX) / lay.scale,
        y: (py - lay.wellY) / lay.scale,
      };
    },
    screenPoint(px, py) {
      const lay = computeLayout();
      return toScreen(lay, px, py);
    },
  };
}
