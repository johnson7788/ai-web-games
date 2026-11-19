// Canvas 2D 程序化渲染：卡通花园（天空/山丘/草场/九块花田/三块岩石），零素材零外链。
// 风格：手绘卡通扁平 —— 圆角、柔和渐变、统一描边、明亮色板。
import { WORLD } from '../../config/game.config.js';
import { plantById } from '../game/sim.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

export const LAYOUT = {
  grid: { x: 401, y: 180, cols: 3, rows: 3, cellW: 150, cellH: 128, gapX: 14, gapY: 12 },
  rocks: [
    { x: 220, y: 606, w: 100, h: 70 },
    { x: 590, y: 606, w: 100, h: 70 },
    { x: 960, y: 606, w: 100, h: 70 },
  ],
};

function plotRect(index) {
  const g = LAYOUT.grid;
  const col = index % g.cols;
  const row = Math.floor(index / g.cols);
  return {
    x: g.x + col * (g.cellW + g.gapX),
    y: g.y + row * (g.cellH + g.gapY),
    w: g.cellW,
    h: g.cellH,
  };
}

function rockRect(id) {
  return LAYOUT.rocks[id] || null;
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

function drawBackground(ctx, time) {
  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#a8e2f8');
  sky.addColorStop(0.55, '#d9f2fb');
  sky.addColorStop(1, '#f2fbf3');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 太阳
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffd86b';
  ctx.beginPath();
  ctx.arc(1080, 96, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#ffd86b';
  ctx.lineWidth = 5;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + time * 0.05;
    ctx.beginPath();
    ctx.moveTo(1080 + Math.cos(a) * 56, 96 + Math.sin(a) * 56);
    ctx.lineTo(1080 + Math.cos(a) * 76, 96 + Math.sin(a) * 76);
    ctx.stroke();
  }
  ctx.restore();

  // 云
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const clouds = [[180, 90, 1], [620, 60, 0.8], [880, 120, 1.1]];
  for (const [cx, cy, s] of clouds) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 52 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 34 * s, cy - 12 * s, 34 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 36 * s, cy - 6 * s, 28 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 远山丘
  ctx.fillStyle = '#b9e0a5';
  ctx.beginPath();
  ctx.moveTo(0, 240);
  ctx.quadraticCurveTo(240, 120, 520, 240);
  ctx.quadraticCurveTo(760, 150, 1040, 240);
  ctx.quadraticCurveTo(1180, 190, W, 240);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // 草场
  const grass = ctx.createLinearGradient(0, 200, 0, H);
  grass.addColorStop(0, '#8fd079');
  grass.addColorStop(1, '#6abf63');
  ctx.fillStyle = grass;
  ctx.fillRect(0, 180, W, H - 180);

  // 草地纹理点
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i < 60; i += 1) {
    const gx = ((i * 137) % W);
    const gy = 190 + ((i * 89) % (H - 210));
    ctx.fillRect(gx, gy, 3, 10);
  }
}

function drawFlower(ctx, cx, cy, r, hue, petals, openness) {
  const sat = 72;
  const light = 58;
  ctx.save();
  const spread = r * (0.45 + 0.55 * openness);
  const petalLen = r * (0.55 + 0.75 * openness);
  // 花瓣
  for (let i = 0; i < petals; i += 1) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(a) * (spread + petalLen * 0.5),
      cy + Math.sin(a) * (spread + petalLen * 0.5),
      petalLen * 0.5,
      petalLen * 0.28,
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // 花心
  ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light + 12}%)`;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.1, cy - r * 0.1, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlant(ctx, x, y, w, h, species, level, info) {
  const cfg = plantById(species);
  const cx = x + w / 2;
  const baseY = y + h - 14;
  const openness = Math.min(1, 0.25 + info.progress);
  const height = Math.max(18, 60 + 26 * openness);
  const headY = baseY - height;

  // 茎
  ctx.strokeStyle = '#3e8e41';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, baseY);
  ctx.quadraticCurveTo(cx + 4, (baseY + headY) / 2, cx, headY + 12);
  ctx.stroke();

  // 叶
  ctx.fillStyle = '#4aa34a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 16, baseY - height * 0.4, 13, 6, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 花头
  drawFlower(ctx, cx, headY, 15 + level * 1.6, cfg.hue, cfg.petals, openness);

  // 等级豆
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, x + 6, y + 6, 34, 16, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Lv${level}`, x + 11, y + 15);

  // 收获气泡（收集物标记）
  if (info.accumulated >= 1) {
    const bx = cx;
    const by = headY - 20;
    const label = info.accumulated >= 1000 ? `${Math.round(info.accumulated / 100) / 10}k` : String(Math.floor(info.accumulated));
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(ctx, bx - 26, by - 13, 52, 24, 12);
    ctx.fill();
    ctx.strokeStyle = '#f5b400';
    ctx.lineWidth = 2;
    roundRect(ctx, bx - 26, by - 13, 52, 24, 12);
    ctx.stroke();
    ctx.fillStyle = '#b8860b';
    ctx.beginPath();
    ctx.arc(bx - 15, by - 1, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a4a12';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, bx - 4, by + 1);
  }
}

function drawPlot(ctx, plot, time) {
  const r = plotRect(plot.index);
  // 土壤
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  roundRect(ctx, r.x + 3, r.y + 5, r.w, r.h, 16);
  ctx.fill();
  ctx.fillStyle = '#9c6a42';
  roundRect(ctx, r.x, r.y, r.w, r.h, 16);
  ctx.fill();
  ctx.fillStyle = '#b07c50';
  roundRect(ctx, r.x + 7, r.y + 7, r.w - 14, r.h - 14, 12);
  ctx.fill();

  if (!plot.unlocked) {
    // 锁定态：灰罩 + 锁 + 需求
    ctx.fillStyle = 'rgba(60,46,38,0.45)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fill();
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    ctx.fillStyle = '#e8dcc8';
    roundRect(ctx, cx - 26, cy - 22, 52, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#8a6a3a';
    ctx.beginPath();
    ctx.arc(cx, cy - 12, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 13, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#6b4a22';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${plot.needBloom} ✿`, cx, cy + 24);
  } else if (plot.species >= 1) {
    drawPlantAt(ctx, plot, time);
  }
}

function drawPlantAt(ctx, plot, time) {
  const cfg = plantById(plot.species);
  const onceTime = Math.max(0.3, cfg.baseTime - (plot.level - 1) * cfg.speedUp);
  const onceGold = cfg.goldOnce + (plot.level - 1) * cfg.goldUp;
  const elapsed = Math.max(0, time - plot.growthStart);
  let count = Math.floor(elapsed / onceTime);
  count = Math.min(count, 50);
  const rest = elapsed - count * onceTime;
  const accumulated = plot.stageGold + count * onceGold;
  const progress = rest / onceTime;
  drawPlant(ctx, plotRect(plot.index).x, plotRect(plot.index).y, plotRect(plot.index).w, plotRect(plot.index).h, plot.species, plot.level, { progress, accumulated });
}

function drawRock(ctx, rock, time) {
  const { x, y, w, h } = rock;
  if (rock.ready) {
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    roundRect(ctx, x + 3, y + 4, w, h, 18);
    ctx.fill();
    ctx.fillStyle = '#9aa0a8';
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.fillStyle = '#b9c0c8';
    roundRect(ctx, x + 10, y + 10, w - 20, h - 24, 14);
    ctx.fill();
    ctx.strokeStyle = '#6d7278';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 22, y + h * 0.55);
    ctx.lineTo(x + 34, y + h * 0.34);
    ctx.lineTo(x + 46, y + h * 0.5);
    ctx.lineTo(x + 58, y + h * 0.28);
    ctx.stroke();
    // 闪烁提示
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.fillStyle = `rgba(255,220,90,${0.35 + 0.4 * pulse})`;
    ctx.beginPath();
    ctx.arc(x + w - 16, y + 14, 7, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const remain = Math.max(0, rock.respawnAt - time);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#8a8f96';
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(remain)}s`, x + w / 2, y + h / 2 + 5);
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  function draw(state, dt, view) {
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, state ? state.time : performance.now() / 1000);

    if (!state) {
      // 标题场景：画一朵大英雄花 + 一行花田示意
      drawFlower(ctx, W / 2, 270, 74, 322, 12, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      roundRect(ctx, W / 2 - 210, 330, 420, 34, 17);
      ctx.fill();
      ctx.fillStyle = '#3f6a34';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🌸  🌼  🌷  🌻', W / 2, 352);
      return;
    }

    // 花田
    for (const plot of state.plots) drawPlot(ctx, plot, state.time);
    // 岩石
    for (const rock of state.rocks) drawRock(ctx, rock, state.time);

    // 浮动 +N 粒子
    if (view && view.fxQueue) {
      for (const fx of view.fxQueue) {
        ctx.globalAlpha = Math.max(0, Math.min(1, fx.ttl / fx.maxTtl));
        ctx.fillStyle = fx.color || '#ffd86b';
        ctx.font = `bold ${fx.size || 20}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(fx.text, fx.x, fx.y);
      }
      ctx.globalAlpha = 1;
    }
  }

  function hitTest(px, py) {
    for (let i = 0; i < LAYOUT.rocks.length; i += 1) {
      const r = LAYOUT.rocks[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return { kind: 'rock', id: i };
    }
    for (let i = 0; i < 9; i += 1) {
      const r = plotRect(i);
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return { kind: 'plot', index: i };
    }
    return null;
  }

  function debugLayout() {
    return {
      grid: LAYOUT.grid,
      plots: Array.from({ length: 9 }, (_, i) => plotRect(i)),
      rocks: LAYOUT.rocks.map((r, i) => ({ ...r, id: i })),
      plot0: plotRect(0),
    };
  }

  return { draw, hitTest, debugLayout };
}
