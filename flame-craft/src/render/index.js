// src/render/index.js — Canvas 2D 霓虹街机渲染：背景 / 三层火焰目标 / 坠落物 / 烬灵 / 粒子。
// 纯程序化，无外链；DPR 上限 2；prefers-reduced-motion 由 main 传入禁用动效。
import { WORLD, PLAYER, DROP } from '../../config/game.config.js';
import { THEME } from './theme.js';
import { tierColorName } from '../game/sim.js';

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  const particles = [];
  const floaters = [];
  let flash = 0;
  let shake = 0;
  let emberSeed = 12345;
  const embers = [];
  for (let i = 0; i < 40; i += 1) {
    embers.push({ x: Math.random() * WORLD.WIDTH, y: Math.random() * WORLD.HEIGHT, s: 0.5 + Math.random() * 1.5, v: 0.2 + Math.random() * 0.6 });
  }

  function rnd(n) { emberSeed = (emberSeed * 1103515245 + 12345) & 0x7fffffff; return (emberSeed % 1000) / 1000 * n; }

  function glow(x, y, r, color, alpha = 0.5) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(color, alpha));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawFlameBlob(x, y, w, h, color, glowColor, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    glow(x, y - h * 0.15, w * 1.1, glowColor, 0.55);
    const g = ctx.createLinearGradient(0, y, 0, y - h);
    g.addColorStop(0, hexA(color, 0.95));
    g.addColorStop(1, hexA(glowColor, 0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - w * 0.55, y - h * 0.55, x - w * 0.5, y - h, x, y - h);
    ctx.bezierCurveTo(x + w * 0.5, y - h, x + w * 0.55, y - h * 0.55, x, y);
    ctx.fill();
    ctx.restore();
  }

  function drawCampfire(run) {
    // 目标：三层火焰（焰心蓝 / 内焰金 / 外焰橙），锻造完成即点亮
    const cx = 150;
    const baseY = WORLD.GROUND_Y - 8;
    const tiers = [
      { color: 'core', x: 0, w: 46, h: 120, dy: 0 },
      { color: 'inner', x: 0, w: 72, h: 180, dy: 0 },
      { color: 'outer', x: 0, w: 100, h: 240, dy: 0 },
    ];
    // 目标标记：脉动圆环 + GOAL 标签，让「要锻造什么」一目了然
    const pulse = 1 + Math.sin((run ? run.simTime : 0) * 4) * 0.08;
    ctx.strokeStyle = hexA(THEME.accent || '#ffb020', 0.85);
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.arc(cx, baseY - 110, 118 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    const label = '★ GOAL ★';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(13, 10, 24, 0.85)';
    ctx.fillRect(cx - tw / 2 - 10, baseY - 262, tw + 20, 30);
    ctx.strokeStyle = 'rgba(255, 176, 32, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - tw / 2 - 10, baseY - 262, tw + 20, 30);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(label, cx, baseY - 240);
    // 从外到内绘制，已锻造层点亮，未锻造层为暗色轮廓
    for (let i = tiers.length - 1; i >= 0; i -= 1) {
      const t = tiers[i];
      const lit = run && run.tier >= i + 1;
      const c = THEME.flame[t.color];
      drawFlameBlob(cx, baseY, t.w, t.h, lit ? c.fill : '#2a2340', lit ? c.glow : '#241d38', lit ? 1 : 0.5);
    }
    // 篝火底座
    ctx.fillStyle = '#241a3c';
    ctx.beginPath();
    ctx.moveTo(cx - 74, baseY + 2);
    ctx.lineTo(cx, baseY - 26);
    ctx.lineTo(cx + 74, baseY + 2);
    ctx.closePath();
    ctx.fill();
    if (run) {
      // 未锻造层的「目标标记」：发光的圆点（点亮进度）
      for (let i = 0; i < 3; i += 1) {
        const lit = run.tier >= i + 1;
        const c = THEME.flame[['core', 'inner', 'outer'][i]];
        ctx.beginPath();
        ctx.arc(cx, baseY - 40 - i * 26, lit ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = lit ? c.fill : '#3a2f5a';
        ctx.fill();
      }
    }
  }

  function drawPlayer(run, dt) {
    const p = run.player;
    const y = WORLD.GROUND_Y;
    const t = (run ? run.simTime : 0);
    const bob = Math.sin(t * 6) * 3;
    // 光晕
    glow(p.x, y, 46 + Math.sin(t * 8) * 4, THEME.player.glow, 0.5);
    // 主体：发光余烬
    const g = ctx.createRadialGradient(p.x, y, 0, p.x, y, 22);
    g.addColorStop(0, THEME.player.core);
    g.addColorStop(0.5, THEME.player.fill);
    g.addColorStop(1, THEME.player.glow);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, y + bob * 0.3, 20 + Math.sin(t * 9) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    // 头顶小火苗（明确「我是玩家角色」）
    drawFlameBlob(p.x, y - 22, 14, 30, THEME.player.fill, THEME.player.glow, 0.95);
    // 眼睛
    ctx.fillStyle = '#1a0c00';
    ctx.beginPath();
    ctx.arc(p.x - 7, y - 4 + bob * 0.3, 3, 0, Math.PI * 2);
    ctx.arc(p.x + 7, y - 4 + bob * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
    // 拖尾
    if (dt != null) {
      particles.push({ x: p.x + rnd(12) - 6, y: y + 6, vy: -1.2, vx: rnd(0.6) - 0.3, life: 0.5, color: THEME.player.glow, r: 3 });
    }
  }

  function drawEntity(e, run) {
    if (e.type === 'fuel') {
      const c = THEME.flame[tierColorName(run)] || THEME.fuel;
      glow(e.x, e.y, e.r * 2.2, c.glow, 0.5);
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, c.fill);
      g.addColorStop(1, c.glow);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      // 收集物标记：白色「+」，明确「这是要接的好东西」
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - e.r * 0.55); ctx.lineTo(e.x, e.y + e.r * 0.55);
      ctx.moveTo(e.x - e.r * 0.55, e.y); ctx.lineTo(e.x + e.r * 0.55, e.y);
      ctx.stroke();
    } else if (e.type === 'coal') {
      glow(e.x, e.y, e.r * 1.8, THEME.coal.glow, 0.4);
      ctx.fillStyle = THEME.coal.fill;
      ctx.beginPath();
      // 多边形煤块
      ctx.moveTo(e.x, e.y - e.r);
      ctx.lineTo(e.x + e.r * 0.9, e.y - e.r * 0.3);
      ctx.lineTo(e.x + e.r * 0.6, e.y + e.r * 0.9);
      ctx.lineTo(e.x - e.r * 0.6, e.y + e.r * 0.9);
      ctx.lineTo(e.x - e.r * 0.9, e.y - e.r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = THEME.coal.crack;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x - e.r * 0.3, e.y - e.r * 0.2);
      ctx.lineTo(e.x, e.y + e.r * 0.1);
      ctx.lineTo(e.x + e.r * 0.2, e.y + e.r * 0.5);
      ctx.stroke();
      // 大额燃料标记
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText('+3', e.x, e.y - e.r - 4);
    } else if (e.type === 'water') {
      glow(e.x, e.y, e.r * 2, THEME.water.glow, 0.5);
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
      g.addColorStop(0, '#dff2ff');
      g.addColorStop(0.5, THEME.water.fill);
      g.addColorStop(1, THEME.water.glow);
      ctx.fillStyle = g;
      ctx.beginPath();
      // 水滴形
      ctx.moveTo(e.x, e.y - e.r);
      ctx.bezierCurveTo(e.x + e.r * 0.7, e.y - e.r * 0.1, e.x + e.r * 0.6, e.y + e.r, e.x, e.y + e.r);
      ctx.bezierCurveTo(e.x - e.r * 0.6, e.y + e.r, e.x - e.r * 0.7, e.y - e.r * 0.1, e.x, e.y - e.r);
      ctx.fill();
    } else { // spark
      glow(e.x, e.y, e.r * 2.4, THEME.spark.glow, 0.6);
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
      g.addColorStop(0, '#fff7d6');
      g.addColorStop(0.4, THEME.spark.fill);
      g.addColorStop(1, THEME.spark.glow);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      // 十字光芒
      ctx.strokeStyle = hexA(THEME.spark.glow, 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x - e.r * 1.6, e.y); ctx.lineTo(e.x + e.r * 1.6, e.y);
      ctx.moveTo(e.x, e.y - e.r * 1.6); ctx.lineTo(e.x, e.y + e.r * 1.6);
      ctx.stroke();
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.y += p.vy;
      p.x += p.vx;
      glow(p.x, p.y, p.r * 3, p.color, 0.5 * (p.life / 0.5));
    }
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      const f = floaters[i];
      f.life -= dt;
      if (f.life <= 0) { floaters.splice(i, 1); continue; }
      f.y -= 1.2;
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillStyle = hexA(f.color, f.life / 0.9);
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
  }

  return {
    layout: () => ({ campfireX: 150, groundY: WORLD.GROUND_Y }),
    burst(x, y, color, n = 12) {
      for (let i = 0; i < n; i += 1) {
        const a = (Math.PI * 2 * i) / n + rnd(0.5);
        const sp = 2 + rnd(3);
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + rnd(0.3), color, r: 2 + rnd(2) });
      }
    },
    addFloater(x, y, text, color = '#ffffff') {
      floaters.push({ x, y, text, color, life: 0.9 });
    },
    flashNova() { flash = 0.35; },
    shake(n = 6) { shake = n; },
    setReduced(on) { this.reduced = on; },

    tick() {
      if (flash > 0) flash -= 0.02;
      if (shake > 0) shake -= 0.5;
    },

    draw(run, dt) {
      // 背景
      const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
      g.addColorStop(0, THEME.bg0);
      g.addColorStop(1, THEME.bg1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

      // 飘浮余烬背景
      for (const em of embers) {
        em.y -= em.v * (dt ?? 0.016) * 60;
        if (em.y < -5) { em.y = WORLD.HEIGHT + 5; em.x = Math.random() * WORLD.WIDTH; }
        ctx.fillStyle = hexA(THEME.player.glow, 0.14);
        ctx.beginPath();
        ctx.arc(em.x, em.y, em.s, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      if (shake > 0) ctx.translate(rnd(shake * 2) - shake, rnd(shake * 2) - shake);

      // 地面
      ctx.fillStyle = THEME.ground;
      ctx.fillRect(0, WORLD.GROUND_Y + 20, WORLD.WIDTH, WORLD.HEIGHT - WORLD.GROUND_Y);
      ctx.strokeStyle = THEME.groundLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, WORLD.GROUND_Y + 20);
      ctx.lineTo(WORLD.WIDTH, WORLD.GROUND_Y + 20);
      ctx.stroke();
      ctx.strokeStyle = hexA(THEME.flame.outer.glow, 0.5);
      ctx.beginPath();
      ctx.moveTo(0, WORLD.GROUND_Y + 20);
      ctx.lineTo(WORLD.WIDTH, WORLD.GROUND_Y + 20);
      ctx.stroke();

      drawCampfire(run);

      if (run) {
        for (const e of run.entities) drawEntity(e, run);
        drawPlayer(run, dt);
      }

      drawParticles(dt ?? 0.016);

      ctx.restore();

      // 全屏闪（过关/爆燃）
      if (flash > 0) {
        ctx.fillStyle = hexA('#ffffff', Math.min(0.55, flash));
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      }
    },
  };
}
