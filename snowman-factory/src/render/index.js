// SNOWMAN FACTORY · Canvas 2D 程序化渲染（手绘卡通 · 零素材零外链）
//
// 场景永远可见：标题/结算/暂停都在 canvas 上保留「雪人工厂」英雄场景，
// DOM 只放顶部 HUD 条、右下发射钮与居中的文字面板，确保每张截图都有
// 清晰的「玩家=雪人 / 目标=蛋筒 / 落点=发光接住区」。

import { WORLD, LAYOUT, PALETTE } from '../../config/game.config.js';

const TAU = Math.PI * 2;

// 标题背景的「环境物品」（无 run 时用，缓慢滑动画装饰）
const AMBIENT = [
  { kind: 'cone', color: 'red', golden: false, x: 260, y: LAYOUT.BELT_Y - LAYOUT.ITEM_HALF, topped: false },
  { kind: 'cone', color: 'blue', golden: false, x: 600, y: LAYOUT.BELT_Y - LAYOUT.ITEM_HALF, topped: true },
  { kind: 'cone', color: 'green', golden: false, x: 880, y: LAYOUT.BELT_Y - LAYOUT.ITEM_HALF, topped: false },
  { kind: 'rock', color: 'grey', golden: false, x: 1080, y: LAYOUT.BELT_Y - LAYOUT.ITEM_HALF, topped: false },
];

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.closePath();
}

function coneColor(it) {
  if (it.kind === 'rock') return PALETTE.rock;
  if (it.golden) return PALETTE.golden;
  return PALETTE.cone[it.color] || PALETTE.cone.red;
}

// 画一个蛋筒（三角 + 网格花纹 + 顶球如果 topped）
function drawCone(ctx, it, t) {
  const { x, y } = it;
  const wob = it.topped ? Math.sin(t * 6 + x) * 1.5 : 0;
  // 蛋筒主体（倒三角）
  ctx.save();
  ctx.translate(x + wob, y + 12);
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.outline;
  ctx.fillStyle = PALETTE.coneWaffle;
  ctx.beginPath();
  ctx.moveTo(-20, -16);
  ctx.lineTo(20, -16);
  ctx.lineTo(0, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 网格花纹
  ctx.strokeStyle = 'rgba(120,80,40,0.35)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-12, -6); ctx.lineTo(12, -6);
  ctx.moveTo(-6, 4); ctx.lineTo(6, 4);
  ctx.moveTo(0, -16); ctx.lineTo(0, 22);
  ctx.moveTo(-9, -10); ctx.lineTo(9, 18);
  ctx.moveTo(9, -10); ctx.lineTo(-9, 18);
  ctx.stroke();

  if (it.topped) {
    // 顶上冰激凌球
    const sc = it.golden ? PALETTE.golden : PALETTE.scoopPink;
    circle(ctx, 0, -22, 15);
    ctx.fillStyle = sc;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.outline;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    circle(ctx, -5, -26, 3.5);
    ctx.fill();
  } else {
    // 空蛋筒顶部的小球帽
    circle(ctx, 0, -16, 7);
    ctx.fillStyle = it.golden ? PALETTE.goldenDeep : PALETTE.scoop;
    ctx.fill();
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  if (it.golden) {
    drawSparkle(ctx, x, y - 34, t);
  }
}

function drawSparkle(ctx, x, y, t) {
  const s = 4 + Math.sin(t * 8 + x) * 1.2;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.fillStyle = '#fff7d6';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i += 1) {
    const a = (t * 1.5) + (i * Math.PI) / 2;
    const px = x + Math.cos(a) * s;
    const py = y + Math.sin(a) * s;
    ctx.beginPath();
    ctx.moveTo(px - 3, py);
    ctx.lineTo(px + 3, py);
    ctx.moveTo(px, py - 3);
    ctx.lineTo(px, py + 3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRock(ctx, it, t) {
  const { x, y } = it;
  ctx.save();
  ctx.translate(x, y + 8);
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.outline;
  ctx.fillStyle = PALETTE.rock;
  ctx.beginPath();
  ctx.moveTo(-22, 14);
  ctx.lineTo(-16, -6);
  ctx.lineTo(-4, -16);
  ctx.lineTo(12, -10);
  ctx.lineTo(21, 4);
  ctx.lineTo(16, 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 岩石棱面
  ctx.strokeStyle = PALETTE.rockDeep;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-4, -16); ctx.lineTo(-1, 12);
  ctx.moveTo(12, -10); ctx.lineTo(8, 12);
  ctx.stroke();
  ctx.restore();
}

function drawSnowman(ctx, t, reduced) {
  const x = LAYOUT.SNOWMAN_X;
  const base = LAYOUT.BELT_Y - 4;
  ctx.save();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineJoin = 'round';

  // 身体（三个雪球，从下往上）
  const bob = reduced ? 0 : Math.sin(t * 2) * 1.5;
  const segs = [
    { y: base - 40, r: 62 },
    { y: base - 128, r: 48 },
    { y: base - 198, r: 38 },
  ];
  for (const s of segs) {
    circle(ctx, x, s.y + (s.r === 62 ? bob : 0), s.r);
    ctx.fillStyle = PALETTE.snowman;
    ctx.fill();
    ctx.stroke();
    // 侧影
    circle(ctx, x - s.r * 0.3, s.y + (s.r === 62 ? bob : 0), s.r);
    ctx.fillStyle = 'rgba(180,200,220,0.18)';
    ctx.fill();
  }
  // 阴影复位（避免影圈盖住眼睛）
  ctx.fillStyle = PALETTE.snowman;

  // 帽子
  const hy = base - 232;
  ctx.fillStyle = '#2e4a6a';
  rr(ctx, x - 34, hy - 14, 68, 16, 5);
  ctx.fill(); ctx.stroke();
  rr(ctx, x - 20, hy - 44, 40, 34, 5);
  ctx.fill(); ctx.stroke();

  // 眼睛
  for (const dx of [-13, 13]) {
    circle(ctx, x + dx, hy - 2, 4.6);
    ctx.fillStyle = PALETTE.coal;
    ctx.fill();
  }
  // 胡萝卜鼻
  ctx.fillStyle = PALETTE.carrot;
  ctx.beginPath();
  ctx.moveTo(x - 4, hy + 6);
  ctx.lineTo(x + 4, hy + 6);
  ctx.lineTo(x + 16, hy + 10);
  ctx.lineTo(x, hy + 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 围巾
  const sy = base - 168;
  ctx.fillStyle = PALETTE.scarf;
  rr(ctx, x - 42, sy - 10, 84, 20, 9);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 26, sy + 6);
  ctx.lineTo(x + 40, sy + 40);
  ctx.lineTo(x + 20, sy + 44);
  ctx.lineTo(x + 14, sy + 16);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // 手臂（伸向传送带上方，准备丢球）
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.moveTo(x - 44, base - 140); ctx.lineTo(x - 70, base - 108); ctx.stroke();
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(x + 40, base - 132); ctx.lineTo(x + 52, base - 96); ctx.stroke();
  ctx.restore();
}

function drawScoop(ctx, scoop) {
  if (!scoop) return;
  ctx.save();
  ctx.translate(scoop.x, scoop.y);
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.outline;
  circle(ctx, 0, 0, 15);
  ctx.fillStyle = PALETTE.scoopPink;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  circle(ctx, -5, -4, 4);
  ctx.fill();
  ctx.restore();
}

function drawBelt(ctx, t) {
  const y = LAYOUT.BELT_Y - LAYOUT.ITEM_HALF + 8;
  // 传送带主体
  ctx.fillStyle = PALETTE.belt;
  ctx.fillRect(0, y, WORLD.WIDTH, LAYOUT.BELT_H);
  ctx.fillStyle = PALETTE.beltEdge;
  ctx.fillRect(0, y, WORLD.WIDTH, 6);
  ctx.fillRect(0, y + LAYOUT.BELT_H - 6, WORLD.WIDTH, 6);
  // 滚轮/履带纹理
  ctx.fillStyle = PALETTE.beltTread;
  const off = (t * 60) % 56;
  for (let x = -56 + off; x < WORLD.WIDTH + 56; x += 56) {
    ctx.fillRect(x, y + 6, 3, LAYOUT.BELT_H - 12);
  }
}

function drawCatchZone(ctx, t) {
  const x = LAYOUT.SNOWMAN_X;
  const y = LAYOUT.BELT_Y - LAYOUT.ITEM_HALF;
  const bob = Math.sin(t * 4) * 5;
  ctx.save();
  // 接住区发光底座（比判定窗口略大，醒目）
  const w = LAYOUT.CATCH_HALF * 2 + 28;
  ctx.fillStyle = 'rgba(255,209,102,0.32)';
  rr(ctx, x - w / 2, y - 26, w, 54, 16);
  ctx.fill();
  ctx.strokeStyle = '#ffc04d';
  ctx.lineWidth = 3;
  rr(ctx, x - w / 2, y - 26, w, 54, 16);
  ctx.stroke();
  // 下落虚线
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, LAYOUT.SNOWMAN_HAND_Y - 20);
  ctx.lineTo(x, y - 26);
  ctx.stroke();
  ctx.setLineDash([]);
  // 大向下箭头（明确的落点提示）
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(x - 15, y - 44 + bob);
  ctx.lineTo(x + 15, y - 44 + bob);
  ctx.lineTo(x, y - 12 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(43,43,58,0.5)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

function drawDoor(ctx, t) {
  const x = LAYOUT.DOOR_X;
  const y = LAYOUT.BELT_Y - LAYOUT.ITEM_HALF - 8;
  ctx.save();
  ctx.fillStyle = PALETTE.door;
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 3.5;
  rr(ctx, x - 46, y - 90, 92, 110, 10);
  ctx.fill();
  ctx.stroke();
  // 门框发光
  ctx.strokeStyle = PALETTE.doorGlow;
  ctx.lineWidth = 3;
  rr(ctx, x - 40, y - 84, 80, 98, 8);
  ctx.stroke();
  // 收集箭头
  const bob = Math.sin(t * 4) * 6;
  ctx.fillStyle = PALETTE.doorGlow;
  ctx.beginPath();
  ctx.moveTo(x - 26, y + bob);
  ctx.lineTo(x + 26, y + bob);
  ctx.lineTo(x, y + 22 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBackground(ctx, t, reduced) {
  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, LAYOUT.BELT_Y);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.WIDTH, LAYOUT.BELT_Y);

  // 远处工厂轮廓（压低对比度，避免与雪人白身体混淆）
  ctx.fillStyle = 'rgba(140,170,195,0.20)';
  for (let i = 0; i < 5; i += 1) {
    const fx = 180 + i * 220;
    rr(ctx, fx, 250, 120, 210, 6);
    ctx.fill();
    ctx.fillRect(fx + 30, 372, 30, 84);
  }

  // 雪地
  const snow = ctx.createLinearGradient(0, LAYOUT.BELT_Y + LAYOUT.BELT_H, 0, WORLD.HEIGHT);
  snow.addColorStop(0, PALETTE.snowShadow);
  snow.addColorStop(1, PALETTE.snowFloor);
  ctx.fillStyle = snow;
  ctx.fillRect(0, LAYOUT.BELT_Y + LAYOUT.BELT_H, WORLD.WIDTH, WORLD.HEIGHT - LAYOUT.BELT_Y - LAYOUT.BELT_H);

  // 雪花（reduced motion 下只画静态）
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const count = reduced ? 24 : 40;
  for (let i = 0; i < count; i += 1) {
    const seed = (i * 137.5) % 1280;
    const speed = 14 + ((i * 53) % 40);
    const sy = ((t * speed + i * 91) % (LAYOUT.BELT_Y + 40));
    const sx = (seed + Math.sin(t * 0.5 + i) * 30 + 640) % WORLD.WIDTH;
    circle(ctx, sx, sy, 1.8 + (i % 3));
    ctx.fill();
  }

  // 左上入料口：一条窄而短的投料槽，蛋筒从这里落下（刻意低调，避免被误读成 UI/喇叭）
  ctx.save();
  const px = LAYOUT.PIPE_X;
  const py = LAYOUT.PIPE_Y;
  ctx.fillStyle = 'rgba(138,160,184,0.9)';
  ctx.strokeStyle = 'rgba(43,43,58,0.5)';
  ctx.lineWidth = 2.5;
  rr(ctx, px - 9, py - 46, 18, 52, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(112,135,159,0.9)';
  ctx.fillRect(px - 9, py - 46, 18, 8);
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  // 显示尺寸交给 CSS（width:100%/height:100%），这里只设内部分辨率，保证移动端自适应缩放
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return {
    draw(state, dt, view = {}) {
      const t = (view.t || 0);
      const reduced = !!view.reducedMotion;
      const shake = view.shake > 0 ? view.shake : 0;

      ctx.save();
      if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

      drawBackground(ctx, t, reduced);

      // 传送带 / 门 / 雪人 / 接住区
      drawBelt(ctx, t);
      drawDoor(ctx, t);
      const playing = state && (state.phase === 'playing' || state.phase === 'paused');
      if (playing) drawCatchZone(ctx, t);
      drawSnowman(ctx, t, reduced);
      // Lead 补丁：接球区光圈（目标可见性）
      {
        const cx = LAYOUT.SNOWMAN_X, cy = LAYOUT.SNOWMAN_HAND_Y;
        const pulse = 1 + 0.12 * Math.sin(t * 4);
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 225, 75, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy, LAYOUT.CATCH_HALF * pulse + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 物品
      const items = state && state.items && state.items.length ? state.items : AMBIENT;
      const ambient = !state;
      for (const it of items) {
        if (it.kind === 'rock') drawRock(ctx, it, t);
        else drawCone(ctx, it, t);
      }
      // 环境物品缓慢滑动（标题背景）
      if (ambient && !reduced) {
        for (let i = 0; i < AMBIENT.length; i += 1) {
          AMBIENT[i].x += 34 * dt;
          if (AMBIENT[i].x > WORLD.WIDTH + 40) AMBIENT[i].x = -40;
        }
      }

      // 在飞的冰激凌球
      if (state && state.scoop) drawScoop(ctx, state.scoop);

      // 粒子特效
      if (view.fx) {
        for (const fx of view.fx) {
          if (fx.ttl <= 0) continue;
          const a = Math.max(0, fx.ttl / fx.max);
          ctx.save();
          ctx.globalAlpha = a;
          if (fx.type === 'splat') {
            ctx.fillStyle = 'rgba(255,220,240,0.9)';
            circle(ctx, fx.x, fx.y + 10, fx.r * (1 + (1 - a) * 2));
            ctx.fill();
          } else if (fx.type === 'burst') {
            for (let k = 0; k < 6; k += 1) {
              const ang = (k / 6) * TAU + fx.seed;
              const rr2 = fx.r * (1 + (1 - a) * 1.6);
              ctx.fillStyle = '#9aa8b6';
              circle(ctx, fx.x + Math.cos(ang) * rr2, fx.y + Math.sin(ang) * rr2, 3.5);
              ctx.fill();
            }
          } else if (fx.type === 'star') {
            ctx.fillStyle = fx.golden ? '#ffd166' : '#fff';
            drawSparkle(ctx, fx.x, fx.y, t + fx.seed);
          }
          ctx.restore();
        }
      }

      ctx.restore();
    },

    debugLayout() {
      return {
        snowman: { x: LAYOUT.SNOWMAN_X - 60, y: LAYOUT.BELT_Y - 240, w: 120, h: 250 },
        catchZone: { x: LAYOUT.SNOWMAN_X - LAYOUT.CATCH_HALF, y: LAYOUT.BELT_Y - 46, w: LAYOUT.CATCH_HALF * 2, h: 52 },
        belt: { x: 0, y: LAYOUT.BELT_Y - 26, w: WORLD.WIDTH, h: LAYOUT.BELT_H + 26 },
        combo: { x: 0, y: LAYOUT.BELT_Y - 30, w: WORLD.WIDTH, h: LAYOUT.BELT_H + 20 },
        door: { x: LAYOUT.DOOR_X - 46, y: LAYOUT.BELT_Y - 124, w: 92, h: 132 },
      };
    },
  };
}
