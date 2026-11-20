// STACK SKY · Canvas 2D 渲染：三场景包天空 + 云端浮空岛塔 + 移动岛 + 特效
// 纯程序化，零外部素材；只画不碰 sim 逻辑。契约：createRender(canvas) → { draw, fx, reset }
import { WORLD, STACK, islandTheme } from '../../config/gameplay.js';
import { cameraYFor } from '../game/sim.js';
import { paletteFor } from './theme.js';

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function makeStars(seed, count) {
  let s = seed >>> 0;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out.push({ x: (s % 1280), y: (s % 360), r: 0.6 + ((s >> 8) % 10) / 6 });
  }
  return out;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const stars = makeStars(20241119, 90);
  const state = {
    fallers: [],      // 裁掉的碎片 {x,y,vx,vy,rot,vr,w,life}
    particles: [],    // 粒子 {x,y,vx,vy,life,maxLife,color,size}
    cloudWrapUntil: 0,
    windFlashUntil: 0,
    shakeUntil: 0,
    lastTopY: WORLD.GROUND_Y - STACK.BLOCK_H,
    lastNow: 0,
    time: 0,
  };

  function spawnBurst(x, y, color, n, spread) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * (spread || 180);
      state.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.55 + Math.random() * 0.5, maxLife: 1,
        color, size: 2 + Math.random() * 4,
      });
    }
  }

  function drawSky(scene, t) {
    const p = paletteFor(scene);
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, p.skyTop);
    g.addColorStop(0.55, p.skyMid);
    g.addColorStop(1, p.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    if (scene === 0) {
      // 晨曦：太阳光晕
      const sg = ctx.createRadialGradient(640, 90, 10, 640, 90, 220);
      sg.addColorStop(0, 'rgba(255,250,230,0.95)');
      sg.addColorStop(0.25, 'rgba(255,230,170,0.55)');
      sg.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(420, -130, 440, 440);
    } else if (scene === 1) {
      // 雷雨：远处电光（周期性闪烁）
      const flash = (Math.sin(t * 7) + 1) / 2;
      if (flash > 0.86) {
        ctx.fillStyle = `rgba(190,220,255,${(flash - 0.86) * 3.2})`;
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        ctx.strokeStyle = 'rgba(230,240,255,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        let lx = 900, ly = 40;
        ctx.moveTo(lx, ly);
        for (let i = 0; i < 6; i += 1) {
          lx += (Math.random() - 0.5) * 60;
          ly += 55 + Math.random() * 30;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }
    } else {
      // 星夜：星星 + 月亮
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const s of stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + s.x);
        ctx.globalAlpha = 0.3 + 0.6 * tw;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const mg = ctx.createRadialGradient(1010, 110, 8, 1010, 110, 70);
      mg.addColorStop(0, 'rgba(255,244,214,0.95)');
      mg.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(1010, 110, 60, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawClouds(scene, t) {
    const p = paletteFor(scene);
    for (let i = 0; i < 6; i += 1) {
      const cx = ((i * 340 + t * (12 + i * 4)) % 1500) - 110;
      const cy = 120 + i * 46;
      const w = 260 + i * 40;
      ctx.fillStyle = i % 2 ? p.cloudB : p.cloudA;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2, 30, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - w * 0.18, cy + 14, w / 3.4, 26, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + w * 0.16, cy + 12, w / 3.2, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawIsland(x, width, y, theme, palette, opts = {}) {
    const alpha = opts.alpha ?? 1;
    const h = STACK.BLOCK_H;
    const left = x - width / 2;
    const topY = y - h;
    ctx.globalAlpha = alpha;

    // 岛体（侧面 + 顶面）
    ctx.fillStyle = palette.islandSide;
    roundRect(ctx, left, topY + 6, width, h - 6, 8);
    ctx.fill();
    ctx.fillStyle = palette.islandTop;
    roundRect(ctx, left, topY, width, 14, 7);
    ctx.fill();
    ctx.fillStyle = palette.islandTopLight;
    roundRect(ctx, left + 2, topY + 1, width - 4, 6, 5);
    ctx.fill();

    // 顶部装饰（按主题）
    const cx = x;
    const scale = Math.min(1, width / 180);
    ctx.save();
    ctx.translate(cx, topY);
    ctx.scale(scale, scale);
    if (theme === 'house') {
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.moveTo(-26, 0); ctx.lineTo(0, -24); ctx.lineTo(26, 0); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-14, -14, 28, 14);
    } else if (theme === 'garden') {
      ctx.fillStyle = palette.accent2;
      ctx.beginPath(); ctx.arc(-24, -8, 11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -14, 13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(24, -8, 11, 0, Math.PI * 2); ctx.fill();
    } else if (theme === 'pagoda') {
      ctx.fillStyle = palette.accent;
      for (let i = 0; i < 3; i += 1) {
        const w = 34 - i * 8;
        ctx.beginPath();
        ctx.moveTo(-w, -i * 12); ctx.lineTo(0, -i * 12 - 13); ctx.lineTo(w, -i * 12); ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = palette.accent2;
      ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(0, -20); ctx.lineTo(34, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-8, -8, 16, 8);
    }
    ctx.restore();

    // 边缘描边（深色，提高剪影辨识度）
    ctx.strokeStyle = 'rgba(50,34,18,0.55)';
    ctx.lineWidth = 2;
    roundRect(ctx, left, topY, width, h, 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawTower(run, camY, palette) {
    if (!run) return;
    for (const layer of run.layers) {
      drawIsland(layer.x, layer.width, layer.y - camY, layer.theme, palette, {});
    }
    // 塔顶表面高亮（落点目标）
    const top = run.top;
    const ty = run.topY - camY;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, top.x - top.width / 2, ty - 2, top.width, 4, 2);
    ctx.fill();
  }

  function drawMoving(run, camY, palette) {
    if (!run || run.phase !== 'playing') return;
    const m = run.moving;
    const my = run.topY - camY;
    const theme = islandTheme(run.score);

    // 落点引导线：从移动岛中心垂直到塔顶，明确「对齐塔心」的目标
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(70,40,16,0.62)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m.x, my - STACK.BLOCK_H);
    ctx.lineTo(m.x, my + 40);
    ctx.stroke();
    ctx.restore();

    // 落点阴影（垂直下落到塔顶）
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    roundRect(ctx, m.x - m.width / 2, my - 2, m.width, 4, 2);
    ctx.fill();

    // 发光移动岛（高对比 + 深色描边，眯眼也能与背景云层分清）
    ctx.save();
    ctx.shadowColor = palette.movingRim;
    ctx.shadowBlur = 22;
    drawIsland(m.x, m.width, my, theme, {
      ...palette,
      islandTop: palette.moving,
      islandTopLight: '#ffffff',
      islandSide: palette.movingRim,
      accent: palette.accent,
      accent2: palette.accent2,
      islandRim: palette.movingRim,
    }, {});
    ctx.restore();
    ctx.strokeStyle = 'rgba(60,36,14,0.9)';
    ctx.lineWidth = 3;
    roundRect(ctx, m.x - m.width / 2, my - STACK.BLOCK_H, m.width, STACK.BLOCK_H, 8);
    ctx.stroke();

    // 神龛层标记
    if (run.shrineDue) {
      ctx.strokeStyle = palette.accent2;
      ctx.lineWidth = 2;
      roundRect(ctx, m.x - m.width / 2 - 5, my - STACK.BLOCK_H - 5, m.width + 10, STACK.BLOCK_H + 10, 10);
      ctx.stroke();
    }
  }

  function drawWind(run, camY, palette, now) {
    if (!run || !run.windActive) return;
    const a = 0.5 + 0.3 * Math.sin(now * 0.02);
    ctx.strokeStyle = `rgba(255,255,255,${0.25 * a})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const y = 140 + i * 60 + ((now * 0.6) % 60);
      const x = ((now * (300 + i * 40)) % (WORLD.WIDTH + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 90, y - 10);
      ctx.stroke();
    }
  }

  function drawCloudWrap(run, camY, palette, now) {
    if (!run || now > state.cloudWrapUntil) return;
    const k = 1 - (state.cloudWrapUntil - now) / 3000;
    const a = Math.max(0, 1 - k) * 0.5;
    // 塔身泛金光
    ctx.save();
    ctx.globalAlpha = a;
    for (const layer of run.layers) {
      ctx.fillStyle = palette.accent2;
      roundRect(ctx, layer.x - layer.width / 2, layer.y - camY - STACK.BLOCK_H, layer.width, STACK.BLOCK_H, 8);
      ctx.fill();
    }
    // 底部云海翻涌
    for (let i = 0; i < 10; i += 1) {
      const cx = ((i * 160 + now * 40) % 1400) - 60;
      ctx.fillStyle = `rgba(255,224,138,${0.25 * a})`;
      ctx.beginPath();
      ctx.ellipse(cx, 660 + Math.sin(now * 0.004 + i) * 12, 110, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFx(camY, dt) {
    // 碎片
    const keepF = [];
    for (const f of state.fallers) {
      f.life -= dt;
      f.vy += 900 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (f.life > 0) {
        ctx.save();
        ctx.translate(f.x, f.y - camY);
        ctx.rotate(f.rot);
        ctx.fillStyle = 'rgba(90,70,50,0.85)';
        roundRect(ctx, -f.w / 2, -10, f.w, 20, 4);
        ctx.fill();
        ctx.restore();
        keepF.push(f);
      }
    }
    state.fallers = keepF;

    // 粒子
    const keepP = [];
    for (const p of state.particles) {
      p.life -= dt;
      p.vy += 320 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life > 0) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y - camY, p.size, 0, Math.PI * 2);
        ctx.fill();
        keepP.push(p);
      }
    }
    ctx.globalAlpha = 1;
    state.particles = keepP;
  }

  // 标题/暂停等无 run 场景：画一个固定的示例塔 + 移动岛，保证静态屏也有游戏剪影
  // 刻意缩短到 5 层：让示例塔落在屏幕下半部，不顶到上半部的标题文字（避免 HUD 遮挡）
  function drawDemoTower(palette) {
    const widths = [220, 204, 188, 172, 156];
    let y = WORLD.GROUND_Y;
    let x = WORLD.WIDTH / 2;
    for (let i = 0; i < widths.length; i += 1) {
      if (i > 0) x += (i % 2 ? -9 : 9);
      drawIsland(x, widths[i], y, islandTheme(i), palette, {});
      y -= STACK.BLOCK_H;
    }
    // 移动岛（带深色描边）
    const my = y;
    const mx = x + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    roundRect(ctx, mx - widths[widths.length - 1] / 2, my - 2, widths[widths.length - 1], 4, 2);
    ctx.fill();
    drawIsland(mx, widths[widths.length - 1], my, islandTheme(widths.length), {
      ...palette,
      islandTop: palette.moving,
      islandTopLight: '#ffffff',
      islandSide: palette.movingRim,
      islandRim: palette.movingRim,
    }, {});
    ctx.strokeStyle = 'rgba(60,36,14,0.9)';
    ctx.lineWidth = 3;
    roundRect(ctx, mx - widths[widths.length - 1] / 2, my - STACK.BLOCK_H, widths[widths.length - 1], STACK.BLOCK_H, 8);
    ctx.stroke();
  }

  function draw(run, alpha) {
    const now = performance.now();
    if (!state.lastNow) state.lastNow = now;
    const dt = Math.min(0.05, (now - state.lastNow) / 1000);
    state.lastNow = now;
    state.time += dt;

    const scene = run ? run.scene : 0;
    const camY = run ? cameraYFor(run) : 0;
    if (run) state.lastTopY = run.topY;

    const palette = paletteFor(scene);
    drawSky(scene, state.time);
    drawClouds(scene, state.time);
    if (run) {
      drawTower(run, camY, palette);
      drawMoving(run, camY, palette);
      drawWind(run, camY, palette, now);
      drawCloudWrap(run, camY, palette, now);
    } else {
      drawDemoTower(palette);
    }
    drawFx(camY, dt);
  }

  function fx(type, payload = {}) {
    const p = paletteFor(0);
    if (type === 'cut') {
      state.fallers.push({
        x: payload.x ?? WORLD.WIDTH / 2,
        y: state.lastTopY,
        vx: (Math.random() - 0.5) * 220,
        vy: -60 - Math.random() * 80,
        rot: (Math.random() - 0.5) * 1,
        vr: (Math.random() - 0.5) * 6,
        w: Math.max(8, payload.cutWidth || 16),
        life: 1.1 + Math.random() * 0.5,
      });
    } else if (type === 'perfect') {
      spawnBurst(payload.x ?? WORLD.WIDTH / 2, state.lastTopY, '#ffe08a', 8, 160);
    } else if (type === 'comboUp') {
      spawnBurst(payload.x ?? WORLD.WIDTH / 2, state.lastTopY - STACK.BLOCK_H, '#ffffff', 4, 120);
    } else if (type === 'cloudWrap') {
      state.cloudWrapUntil = performance.now() + 3000;
    } else if (type === 'windGust') {
      state.windFlashUntil = performance.now() + 400;
    } else if (type === 'shrineSuccess') {
      spawnBurst(payload.x ?? WORLD.WIDTH / 2, state.lastTopY - STACK.BLOCK_H, '#ffe08a', 18, 220);
    }
  }

  function reset() {
    state.fallers = [];
    state.particles = [];
    state.cloudWrapUntil = 0;
    state.windFlashUntil = 0;
    state.shakeUntil = 0;
  }

  return { draw, fx, reset };
}
