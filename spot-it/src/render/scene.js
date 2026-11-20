// src/render/scene.js — 3 套场景包背景（换章必换：色板 + 构图 + 装饰）。
// 只画背景与装饰（非交互），供 render/index.js 的「已照亮图层」使用。
import { WORLD } from '../../config/game.config.js';
import { SCENE_PACKS } from '../../config/gameplay.js';
import { mulberry32 } from '../game/rng.js';

/** 背景渐变 + 地面。 */
export function drawBackground(ctx, packIndex) {
  const pack = SCENE_PACKS[packIndex % SCENE_PACKS.length];
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, pack.bgTop);
  g.addColorStop(1, pack.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 地面
  ctx.fillStyle = pack.floor;
  ctx.fillRect(0, WORLD.HEIGHT - 90, WORLD.WIDTH, 90);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, WORLD.HEIGHT - 90);
  ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT - 90);
  ctx.stroke();
}

/** 确定性装饰（每包一套构图：货架 / 悬挂 / 散件）。 */
export function drawDecor(ctx, packIndex) {
  const pack = SCENE_PACKS[packIndex % SCENE_PACKS.length];
  const rng = mulberry32(1000 + packIndex * 97);

  if (pack.shelves) {
    // 旧书摊 / 鬼市：货架横板 + 竖撑
    ctx.strokeStyle = pack.accents[1];
    ctx.lineWidth = 5;
    const shelfYs = [150, 300, 460, 610];
    for (const y of shelfYs) {
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(WORLD.WIDTH - 24, y);
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    for (let x = 60; x < WORLD.WIDTH; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, 96);
      ctx.lineTo(x, 690);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.stroke();
    }
    ctx.strokeStyle = pack.accents[1];
  }

  // 悬挂装饰（玩具堆：气球/灯串；鬼市：灯笼；旧书摊：书堆剪影）
  const accent = pack.accents[2];
  if (packIndex === 1) {
    // 玩具堆：漂浮气球串
    for (let i = 0; i < 10; i += 1) {
      const x = 40 + rng() * (WORLD.WIDTH - 80);
      const y = 100 + rng() * 220;
      const r = 10 + rng() * 22;
      ctx.fillStyle = pack.accents[Math.floor(rng() * pack.accents.length)];
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.7, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.lineTo(x, y + r + 26);
      ctx.stroke();
    }
  } else if (packIndex === 2) {
    // 鬼市：悬挂灯笼
    for (let i = 0; i < 8; i += 1) {
      const x = 50 + rng() * (WORLD.WIDTH - 100);
      const y = 100 + rng() * 60;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 96);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 旧书摊：书堆剪影（浅色，不抢物品）
    ctx.fillStyle = 'rgba(242,227,192,0.10)';
    for (let i = 0; i < 8; i += 1) {
      const x = 60 + rng() * (WORLD.WIDTH - 120);
      const y = 150 + rng() * 480;
      ctx.fillRect(x, y, 46 + rng() * 40, 14);
      ctx.fillRect(x, y - 14, 40 + rng() * 30, 14);
    }
  }
}
