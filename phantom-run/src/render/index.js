// PHANTOM RUN · Canvas 2D 渲染：三场景背景 / 瓦檐·符文砖·符文墙·尖刺·月光斑·星屑 / 幽影角色。
// 只消费 run.state（契约）+ view（shake/fxQueue/sceneKey）。
// 像素换算全部在此完成（sim 只给世界坐标与状态）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize() }。
import { WORLD, PLAYER } from '../../config/game.config.js';

const SCENE_PALETTES = {
  'dusk-tower': {
    skyTop: '#2A1B4E', skyMid: '#3D2A6B', skyBot: '#1A1030',
    far: '#4A3478', near: '#33214F',
    tile: '#6B4E9E', tileDark: '#4A3478', tileEdge: '#2B1A4A',
    runeGlow: 'rgba(180,150,255,0.9)', runeLine: '#C9A6FF',
    wall: '#7EE0F0', wallGlow: 'rgba(126,224,240,0.55)',
    accent: '#FFD27A', moon: '#C9F0FF',
  },
  'moon-market': {
    skyTop: '#0B1E3A', skyMid: '#12305A', skyBot: '#081422',
    far: '#14304F', near: '#0E2438',
    tile: '#1F4E6E', tileDark: '#163A52', tileEdge: '#0C2436',
    runeGlow: 'rgba(120,200,255,0.9)', runeLine: '#8FD8FF',
    wall: '#FFD27A', wallGlow: 'rgba(255,210,122,0.5)',
    accent: '#FFB84E', moon: '#DFF2FF',
  },
  'dawn-wall': {
    skyTop: '#7A2D2D', skyMid: '#C96A3A', skyBot: '#5A1E2E',
    far: '#8E4A38', near: '#5C2E24',
    tile: '#B8784E', tileDark: '#8A5636', tileEdge: '#5C3620',
    runeGlow: 'rgba(255,190,120,0.9)', runeLine: '#FFD0A0',
    wall: '#7EE0F0', wallGlow: 'rgba(126,224,240,0.5)',
    accent: '#FFE08A', moon: '#FFF2D0',
  },
};

const bgCache = new Map();

function getBackground(sceneKey) {
  let c = bgCache.get(sceneKey);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  drawBackground(c.getContext('2d'), sceneKey);
  bgCache.set(sceneKey, c);
  return c;
}

function drawBackground(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['dusk-tower'];
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'moon-market') { drawStars(g, W, H); drawMoon(g, W, H); }
  else if (sceneKey === 'dusk-tower') { drawStars(g, W, H); drawTowerSilhouette(g, P, W, H); }
  else { drawSunRise(g, P, W, H); drawWallSilhouette(g, P, W, H); }

  // 远景层
  g.fillStyle = P.far;
  g.beginPath();
  g.moveTo(0, H * 0.66);
  for (let i = 0; i <= 8; i += 1) {
    const x = (W / 8) * i;
    g.lineTo(x, H * 0.66 - Math.sin(i * 1.9 + 0.6) * 60 - 18);
  }
  g.lineTo(W, H * 0.66 + 50); g.lineTo(0, H * 0.66 + 50); g.closePath(); g.fill();
  g.fillStyle = P.near;
  g.beginPath();
  g.moveTo(0, H * 0.78);
  for (let i = 0; i <= 9; i += 1) {
    const x = (W / 9) * i;
    g.lineTo(x, H * 0.78 - Math.sin(i * 2.3 + 2.2) * 42 - 12);
  }
  g.lineTo(W, H * 0.78 + 40); g.lineTo(0, H * 0.78 + 40); g.closePath(); g.fill();

  // 地面底色
  const grd = g.createLinearGradient(0, H * 0.7, 0, H);
  grd.addColorStop(0, P.tile);
  grd.addColorStop(1, P.skyBot);
  g.fillStyle = grd;
  g.fillRect(0, H * 0.7, W, H * 0.3);
}

function drawStars(g, W, H) {
  for (let i = 0; i < 70; i += 1) {
    const x = ((i * 137.5) % W);
    const y = ((i * 89.7) % (H * 0.5));
    const r = 0.5 + ((i * 7) % 10) / 10;
    g.fillStyle = `rgba(220,235,255,${0.3 + ((i * 13) % 10) / 14})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

function drawMoon(g, W, H) {
  const mx = W - 200, my = 120, r = 42;
  const halo = g.createRadialGradient(mx, my, r * 0.5, mx, my, r * 2.6);
  halo.addColorStop(0, 'rgba(200,235,255,0.5)');
  halo.addColorStop(1, 'rgba(200,235,255,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(mx, my, r * 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#EAF4FF';
  g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill();
}

function drawTowerSilhouette(g, P, W, H) {
  g.fillStyle = P.skyBot;
  for (let i = 0; i < 5; i += 1) {
    const x = 180 + i * 230;
    const w = 60 + (i % 2) * 24;
    const h = 200 + (i * 37) % 120;
    g.fillRect(x, H - h - 60, w, h + 60);
    // 塔顶小旗
    g.beginPath();
    g.moveTo(x + w / 2, H - h - 60);
    g.lineTo(x + w / 2, H - h - 96);
    g.lineTo(x + w / 2 + 26, H - h - 82);
    g.closePath(); g.fill();
  }
}

function drawSunRise(g, P, W, H) {
  const halo = g.createRadialGradient(W - 240, 210, 20, W - 240, 210, 340);
  halo.addColorStop(0, 'rgba(255,190,110,0.55)');
  halo.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = halo; g.fillRect(0, 0, W, H);
  g.fillStyle = '#FFDCA0';
  g.beginPath(); g.arc(W - 240, 210, 46, 0, Math.PI * 2); g.fill();
}

function drawWallSilhouette(g, P, W, H) {
  g.fillStyle = P.skyBot;
  g.fillRect(0, H - 120, W, 40);
  for (let i = 0; i < 8; i += 1) {
    const x = 60 + i * 160;
    g.fillRect(x, H - 190, 60, 70);
    g.fillRect(x + 18, H - 210, 24, 20);
  }
}

// ---- 幽影角色（程序化）----
function drawGhost(ctx, x, y, size, form, clock, dissolve = 0) {
  const s = size / 60;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const bob = Math.sin(clock * 3.0) * 2.5;

  const alpha = form === 'corporeal' ? 0.95 : 0.55;
  const bodyCol = form === 'corporeal' ? '#EFFFFF' : '#B9D4FF';
  const glow = form === 'corporeal' ? 'rgba(150,240,255,0.8)' : 'rgba(150,190,255,0.4)';

  // 虚化散烟：绕着角色打散几缕烟
  if (dissolve > 0) {
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2 + clock * 2;
      const rr = 20 + dissolve * 46;
      ctx.fillStyle = `rgba(185,212,255,${0.4 * (1 - dissolve)})`;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr - 6, 7 + dissolve * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 拖尾光晕
  const halo = ctx.createRadialGradient(0, 0 + bob, 4, 0, 0 + bob, 46);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, 'rgba(150,190,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0 + bob, 46, 0, Math.PI * 2); ctx.fill();

  // 身体（上圆下波浪）
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bodyCol;
  ctx.beginPath();
  ctx.arc(0, -10 + bob, 17, Math.PI, 0);
  ctx.quadraticCurveTo(20, 6 + bob, 14, 16 + bob);
  ctx.quadraticCurveTo(8, 22 + bob + Math.sin(clock * 6) * 3, 0, 16 + bob);
  ctx.quadraticCurveTo(-8, 22 + bob - Math.sin(clock * 6) * 3, -14, 16 + bob);
  ctx.quadraticCurveTo(-20, 6 + bob, 0, -10 + bob);
  ctx.closePath();
  ctx.fill();

  // 眼睛
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#1A1030';
  ctx.beginPath(); ctx.arc(-6, -12 + bob, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -12 + bob, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(-5, -13 + bob, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(7, -13 + bob, 1.1, 0, Math.PI * 2); ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPlatform(ctx, pl, sx, P, clock) {
  const y = pl.y;
  if (pl.kind === 'rune') {
    const solid = pl.state === 'solid';
    ctx.globalAlpha = solid ? 0.95 : 0.22;
    ctx.fillStyle = solid ? P.runeGlow : P.tileDark;
    roundRect(ctx, sx, y, pl.w, pl.h, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (solid) {
      ctx.strokeStyle = P.runeLine;
      ctx.lineWidth = 2;
      roundRect(ctx, sx, y, pl.w, pl.h, 5);
      ctx.stroke();
      // 符文刻痕
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      const cx = sx + pl.w / 2;
      ctx.beginPath();
      ctx.moveTo(cx, y + 2); ctx.lineTo(cx, y + pl.h - 2);
      ctx.moveTo(cx - 8, y + 3); ctx.lineTo(cx + 8, y + 3);
      ctx.stroke();
    }
    return;
  }
  if (pl.kind === 'collapse') {
    const solid = pl.state === 'solid';
    ctx.globalAlpha = solid ? 1 : 0.2;
    ctx.fillStyle = solid ? P.tile : P.tileDark;
    roundRect(ctx, sx, y, pl.w, pl.h, 4);
    ctx.fill();
    ctx.strokeStyle = P.tileEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  if (pl.kind === 'moving') {
    ctx.fillStyle = P.accent;
    roundRect(ctx, sx, y, pl.w, pl.h, 8);
    ctx.fill();
    ctx.strokeStyle = P.tileEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    // 吊绳
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + pl.w / 2, y); ctx.lineTo(sx + pl.w / 2, y - 30);
    ctx.stroke();
    return;
  }
  // 普通瓦檐 / 地面
  ctx.fillStyle = P.tile;
  ctx.fillRect(sx, y, pl.w, pl.h);
  ctx.fillStyle = P.tileDark;
  ctx.fillRect(sx, y, pl.w, 5);           // 顶面亮边
  ctx.fillStyle = P.tileEdge;
  ctx.fillRect(sx, y + 6, pl.w, 2);
  // 瓦楞
  ctx.strokeStyle = P.tileEdge;
  ctx.lineWidth = 1.5;
  const step = 26;
  for (let xx = sx + 8; xx < sx + pl.w - 4; xx += step) {
    ctx.beginPath(); ctx.moveTo(xx, y + 8); ctx.lineTo(xx, y + pl.h - 2); ctx.stroke();
  }
}

function drawSpike(ctx, sp, sx, P) {
  ctx.fillStyle = P.tileEdge;
  for (let x = sx; x < sx + sp.w; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, sp.y);
    ctx.lineTo(x + 5, sp.y - 14);
    ctx.lineTo(x + 10, sp.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(sx + 5, sp.y);
  ctx.lineTo(sx + 10, sp.y - 14);
  ctx.lineTo(sx + 13, sp.y);
  ctx.closePath(); ctx.fill();
}

function drawWall(ctx, w, sx, P, clock) {
  const pulse = 0.5 + 0.5 * Math.sin(clock * 4);
  const g = ctx.createLinearGradient(sx, w.y, sx + w.w, w.y);
  g.addColorStop(0, P.wall);
  g.addColorStop(1, P.wallGlow);
  ctx.fillStyle = g;
  ctx.fillRect(sx, w.y, w.w, w.h);
  ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.3 * pulse})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, w.y, w.w, w.h);
}

function drawMoonPatch(ctx, m, sx, P, clock) {
  const pulse = 0.6 + 0.4 * Math.sin(clock * 4);
  const halo = ctx.createRadialGradient(sx, m.y, 4, sx, m.y, m.r * 1.8);
  halo.addColorStop(0, `rgba(200,235,255,${0.7 * pulse})`);
  halo.addColorStop(1, 'rgba(200,235,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(sx, m.y, m.r * 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.moon;
  ctx.beginPath(); ctx.arc(sx, m.y, m.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(sx - 3, m.y - 3, m.r * 0.4, 0, Math.PI * 2); ctx.fill();
}

function drawStar(ctx, st, sx, clock) {
  const tw = 0.5 + 0.5 * Math.sin(clock * 5 + st.x);
  const R = st.r * 1.9;
  const bobY = st.y + Math.sin(clock * 3 + st.x) * 4;
  // 光晕
  const halo = ctx.createRadialGradient(sx, bobY, 2, sx, bobY, R * 2.2);
  halo.addColorStop(0, `rgba(255,214,90,${0.55 + 0.35 * tw})`);
  halo.addColorStop(1, 'rgba(255,214,90,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(sx, bobY, R * 2.2, 0, Math.PI * 2); ctx.fill();
  // 五角星
  ctx.fillStyle = '#FFD24A';
  ctx.strokeStyle = '#8A5A10';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? R : R * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = sx + Math.cos(a) * rad;
    const py = bobY + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(sx - R * 0.15, bobY - R * 0.2, R * 0.18, 0, Math.PI * 2); ctx.fill();
}

function drawChaseFire(ctx, ch, sx, clock) {
  const flick = 0.7 + 0.3 * Math.sin(clock * 12);
  const halo = ctx.createRadialGradient(sx, 560, 6, sx, 560, 60);
  halo.addColorStop(0, 'rgba(120,240,220,0.7)');
  halo.addColorStop(1, 'rgba(120,240,220,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(sx, 560, 60, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8FF0E0';
  ctx.beginPath(); ctx.arc(sx, 560, 16 * flick, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#E8FFFA';
  ctx.beginPath(); ctx.arc(sx - 4, 556, 6, 0, Math.PI * 2); ctx.fill();
}

function drawFinishGate(ctx, sx, P, clock) {
  const pulse = 0.5 + 0.5 * Math.sin(clock * 3);
  // 门柱
  ctx.fillStyle = P.accent;
  ctx.fillRect(sx - 4, 470, 8, 130);
  ctx.fillRect(sx + 44, 470, 8, 130);
  ctx.fillStyle = P.tileDark;
  ctx.fillRect(sx - 2, 470, 4, 20);
  ctx.fillRect(sx + 46, 470, 4, 20);
  // 光门
  const gg = ctx.createLinearGradient(sx, 470, sx + 48, 470);
  gg.addColorStop(0, P.accent);
  gg.addColorStop(1, '#FFF6D0');
  ctx.fillStyle = gg;
  ctx.globalAlpha = 0.35 + 0.25 * pulse;
  ctx.fillRect(sx + 4, 470, 40, 130);
  ctx.globalAlpha = 1;
  // 脉冲环
  ctx.strokeStyle = `rgba(255,224,138,${0.5 + 0.4 * pulse})`;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(sx + 24, 535, 48 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
  // 旗
  ctx.fillStyle = P.accent;
  ctx.beginPath();
  ctx.moveTo(sx - 4, 470); ctx.lineTo(sx - 4, 430); ctx.lineTo(sx + 34, 442);
  ctx.closePath(); ctx.fill();
  // EXIT 标签（胶囊底衬，任何场景可读）
  ctx.fillStyle = 'rgba(20,14,40,0.85)';
  const tw2 = ctx.measureText('EXIT').width;
  ctx.beginPath();
  const bx = sx + 24 - tw2 / 2 - 10;
  ctx.roundRect ? ctx.roundRect(bx, 574, tw2 + 20, 24, 12) : ctx.rect(bx, 574, tw2 + 20, 24);
  ctx.fill();
  ctx.fillStyle = '#FFD24A';
  ctx.font = '800 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', sx + 24, 591);
}

// ---- 布局（调试/引导用）----
function computeLayout(state) {
  const camX = state.player.x - PLAYER.SCREEN_X;
  const player = {
    x: PLAYER.SCREEN_X - PLAYER.W / 2,
    y: state.player.y,
    w: PLAYER.W,
    h: PLAYER.H,
  };
  const runway = { x: 0, y: 560, w: WORLD.WIDTH, h: 130 };
  let rune = null;
  let wall = null;
  let finish = { x: state.finishX - camX - 24, y: 480, w: 56, h: 120 };
  for (const pl of state.platforms) {
    if (pl.kind === 'rune' && !rune && pl.x > state.player.x) {
      rune = { x: pl.x - camX, y: pl.y, w: pl.w, h: pl.h };
    }
  }
  for (const w of state.walls) {
    if (!wall && w.x > state.player.x) {
      wall = { x: w.x - camX, y: w.y, w: w.w, h: w.h };
    }
  }
  return { player, runway, rune, wall, finish };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;
  let dissolve = 0;

  function resize(w, h) {
    return { w, h, world: { width: WORLD.WIDTH, height: WORLD.HEIGHT } };
  }

  function debugLayout() {
    if (!lastState) return null;
    return computeLayout(lastState);
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('dusk-tower'), 0, 0);
    drawGhost(ctx, WORLD.WIDTH / 2, 520, 110, 'corporeal', clock);
  }

  function draw(state, dt, view) {
    if (!state || !state.platforms) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.scene || v.sceneKey || 'dusk-tower';
    clock += dt || 0;
    lastState = state;

    const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['dusk-tower'];
    const camX = state.player.x - PLAYER.SCREEN_X;

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);

    // 平台
    for (const pl of state.platforms) {
      const sx = pl.x - camX;
      if (sx + pl.w < -20 || sx > WORLD.WIDTH + 20) continue;
      drawPlatform(ctx, pl, sx, P, clock);
    }
    // 尖刺
    for (const sp of state.spikes) {
      const sx = sp.x - camX;
      if (sx + sp.w < -20 || sx > WORLD.WIDTH + 20) continue;
      drawSpike(ctx, sp, sx, P);
    }
    // 符文墙
    for (const w of state.walls) {
      const sx = w.x - camX;
      if (sx + w.w < -20 || sx > WORLD.WIDTH + 20) continue;
      drawWall(ctx, w, sx, P, clock);
    }
    // 月光斑
    for (const m of state.moons) {
      if (m.taken) continue;
      const sx = m.x - camX;
      if (sx < -40 || sx > WORLD.WIDTH + 40) continue;
      drawMoonPatch(ctx, m, sx, P, clock);
    }
    // 星屑
    for (const st of state.stars) {
      if (st.taken) continue;
      const sx = st.x - camX;
      if (sx < -40 || sx > WORLD.WIDTH + 40) continue;
      drawStar(ctx, st, sx, clock);
    }
    // 终点
    if (state.finishX - camX < WORLD.WIDTH + 60) {
      drawFinishGate(ctx, state.finishX - camX, P, clock);
    }
    // 追兵
    if (state.chase) {
      const sx = state.chase.x - camX;
      if (sx > -80 && sx < WORLD.WIDTH + 80) drawChaseFire(ctx, state.chase, sx, clock);
    }

    // 虚化散烟（签名瞬间）
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.type === 'dissolve' && fx.ttl > 0) {
          dissolve = Math.max(0, fx.ttl / 0.5);
        }
      }
    }

    const form = state.player.form;
    drawGhost(ctx, PLAYER.SCREEN_X, state.player.y + PLAYER.H / 2, 56, form, clock, dissolve);

    ctx.restore();
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize };
}
