// src/render/index.js — 渲染装配：已照亮图层（离屏）→ 手电光圈合成 + 找到标记 + 市场点亮。
import { WORLD } from '../../config/game.config.js';
import { LIGHT, SCENE_PACKS } from '../../config/gameplay.js';
import { drawBackground, drawDecor } from './scene.js';
import { drawItem } from './items.js';

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  // 离屏「全亮」图层：背景 + 装饰 + 物品（手电只照亮这一层）
  const lit = document.createElement('canvas');
  lit.width = WORLD.WIDTH;
  lit.height = WORLD.HEIGHT;
  const lctx = lit.getContext('2d');

  let lastNow = 0;
  let flareUntil = 0;      // 市场点亮动画截止时间戳
  let flarePack = 0;
  const bursts = [];       // {x, y, born} 找到目标时的火花环

  function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  function drawLitScene(run) {
    lctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const packIndex = run ? run.levelData.scenePack : 0;
    drawBackground(lctx, packIndex);
    drawDecor(lctx, packIndex);
    if (run) {
      for (const it of run.items) {
        if (it.found) {
          lctx.globalAlpha = 0.38; // 已找到：留在场上但变淡
          drawItem(lctx, it.itemId, it.x, it.y, it.s, it.variant);
          lctx.globalAlpha = 1;
        } else {
          drawItem(lctx, it.itemId, it.x, it.y, it.s, it.variant);
        }
      }
    }
  }

  function drawFoundMarks(run) {
    if (!run) return;
    for (const it of run.items) {
      if (!it.found) continue;
      // 小对勾徽章叠在物品右上角（始终叠在黑暗之上，且与物品强关联）
      const bx = it.x + it.s * 0.55;
      const by = it.y - it.s * 0.55;
      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = 'rgba(74, 200, 120, 0.97)';
      ctx.strokeStyle = 'rgba(10, 40, 20, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#0c2a18';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-1, 3);
      ctx.lineTo(5, -4);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFlare(packIndex, p) {
    // 市场点亮：顶部灯笼依次亮起 + 暖色全屏脉冲
    const pack = SCENE_PACKS[packIndex % SCENE_PACKS.length];
    const n = 6;
    for (let i = 0; i < n; i += 1) {
      const on = p * n > i;
      if (!on) continue;
      const x = 120 + (i / (n - 1)) * (WORLD.WIDTH - 240);
      const y = 122 + (i % 2) * 26;   // 挂灯贴在 HUD 下方，不压 HUD
      ctx.fillStyle = '#ffd66a';
      ctx.shadowColor = '#ffd66a';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    const a = (1 - p) * 0.30;
    if (a > 0) {
      const g = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 60, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, WORLD.WIDTH * 0.7);
      g.addColorStop(0, `rgba(255, 214, 106, ${a})`);
      g.addColorStop(1, 'rgba(255, 214, 106, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
  }

  function draw(run, flash, alpha = 1) {
    const t = now();
    if (!lastNow) lastNow = t;
    lastNow = t;

    if (!run) {
      // 标题/暂停背后：一张被照亮的静态场景预览 + 若干样品物品（保证剪影可辨）
      drawBackground(ctx, 0);
      drawDecor(ctx, 0);
      const preview = [
        ['cat', 200, 300, 40], ['mug', 420, 470, 34], ['wallclock', 640, 260, 38],
        ['key', 880, 480, 32], ['teddy', 1080, 300, 40], ['lantern', 320, 600, 34],
      ];
      for (const [id, x, y, s] of preview) drawItem(ctx, id, x, y, s, 0);
      return;
    }

    drawLitScene(run);

    // 主画布：先铺满已照亮图层，再用径向渐变把光圈外压暗
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.fillStyle = LIGHT.AMBIENT;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(lit, 0, 0);

    const fx = flash ? flash.x : WORLD.WIDTH / 2;
    const fy = flash ? flash.y : WORLD.HEIGHT / 2;
    const radius = run.getHud().radius;
    const g = ctx.createRadialGradient(fx, fy, radius * LIGHT.SOFT, fx, fy, radius);
    g.addColorStop(0, `rgba(4,6,10,${LIGHT.CORE_ALPHA})`);
    g.addColorStop(LIGHT.SOFT, `rgba(4,6,10,0.10)`);
    g.addColorStop(1, `rgba(4,6,10,${LIGHT.EDGE_ALPHA})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 光圈边缘一道细光晕（手电质感）
    ctx.strokeStyle = 'rgba(255, 214, 106, 0.14)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fx, fy, radius * 0.96, 0, Math.PI * 2);
    ctx.stroke();

    // 找到标记（叠在黑暗之上）
    drawFoundMarks(run);

    // 火花环
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const b = bursts[i];
      const age = (t - b.born) / 400;
      if (age >= 1) { bursts.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(255, 214, 106, ${(1 - age) * 0.9})`;
      ctx.lineWidth = 3 * (1 - age) + 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8 + age * 34, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 市场点亮动画
    if (flareUntil > t) {
      drawFlare(run.levelData.scenePack, 1 - (flareUntil - t) / 1500);
    }
  }

  function lightUp(packIndex = 0) {
    flarePack = packIndex;
    flareUntil = now() + 1500;
  }

  function burst(x = WORLD.WIDTH / 2, y = WORLD.HEIGHT / 2) {
    bursts.push({ x, y, born: now() });
    if (bursts.length > 24) bursts.shift();
  }

  return { draw, lightUp, burst, ctx };
}
