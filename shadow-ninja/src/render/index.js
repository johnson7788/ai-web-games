// Shadow Ninja Cat · Canvas 2D 渲染：月夜屋顶 / 尖刺 / 敌忍 / 飞镖 / 风铃 / 忍者猫剪影。
// 只消费 run.state + view（fxQueue/shake）。像素换算全部在此完成（sim 只给世界坐标）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize() }。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const GROUND_Y = LAYOUT.GROUND_LOW_Y;   // 低层地面（屋顶）上沿的屏幕 y
const HIGH_H = GAME.HIGH;

const SCENE_PALETTES = {
  'dusk-tiles': {
    skyTop: '#2B1A4A', skyMid: '#5A2A5E', skyBot: '#C85B3C',
    farFar: '#3A2150', farNear: '#4A2350',
    tile: '#2A1B38', tileTop: '#3E2A54', tileEdge: '#1A1024',
    glow: 'rgba(255,190,90,0.5)',
    accent: '#FFD98A',
    chime: '#FFD84E',
    ground: '#20142E',
  },
  'rain-alley': {
    skyTop: '#0B1626', skyMid: '#12233A', skyBot: '#1A3A55',
    farFar: '#0E2036', farNear: '#132A44',
    tile: '#16283C', tileTop: '#23425E', tileEdge: '#0B1826',
    glow: 'rgba(120,190,255,0.4)',
    accent: '#FFE0A0',
    chime: '#FFD84E',
    ground: '#0B1524',
  },
  'moon-bamboo': {
    skyTop: '#0E2A1E', skyMid: '#163820', skyBot: '#20482C',
    farFar: '#0E261A', farNear: '#143222',
    tile: '#1C3A24', tileTop: '#2A5234', tileEdge: '#0E2014',
    glow: 'rgba(200,255,170,0.55)',
    accent: '#CFFFAA',
    chime: '#FFD84E',
    ground: '#0A1A10',
  },
};

const bgCache = new Map();

function getBackground(sceneKey) {
  let c = bgCache.get(sceneKey);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  drawBackground(c.getContext('2d'), sceneKey);
  bgCache.set(sceneKey, c);
  return c;
}

function drawBackground(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['dusk-tiles'];
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.6, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (sceneKey === 'dusk-tiles') {
    drawMoon(g, W - 220, 120, 46, P.glow);
    drawFarTiles(g, P);
  } else if (sceneKey === 'rain-alley') {
    drawMoon(g, W - 200, 110, 38, P.glow);
    drawRain(g, P);
    drawLanterns(g, P);
  } else {
    drawMoon(g, W - 200, 110, 56, P.glow);
    drawBamboo(g, P);
  }

  // 底部远景剪影层
  g.fillStyle = P.farFar;
  g.fillRect(0, H * 0.62, W, H * 0.14);
  g.fillStyle = P.farNear;
  g.beginPath();
  g.moveTo(0, H * 0.70);
  for (let i = 0; i <= 8; i += 1) {
    const x = (W / 8) * i;
    g.lineTo(x, H * 0.70 - Math.sin(i * 1.9 + 0.6) * 34 - 12);
  }
  g.lineTo(W, H * 0.78); g.lineTo(0, H * 0.78); g.closePath(); g.fill();
}

function drawMoon(g, x, y, r, glow) {
  const halo = g.createRadialGradient(x, y, r * 0.4, x, y, r * 2.8);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(x, y, r * 2.8, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#F4F0E0';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(140,150,170,0.4)';
  g.beginPath(); g.arc(x - r * 0.3, y - r * 0.2, r * 0.2, 0, Math.PI * 2); g.arc(x + r * 0.24, y + r * 0.28, r * 0.14, 0, Math.PI * 2); g.fill();
}

function drawFarTiles(g, P) {
  g.strokeStyle = P.farFar;
  g.lineWidth = 3;
  for (let i = 0; i < 9; i += 1) {
    const x = i * 150;
    g.beginPath();
    g.moveTo(x, H * 0.62);
    g.lineTo(x + 60, H * 0.46);
    g.lineTo(x + 150, H * 0.62);
    g.stroke();
  }
}

function drawRain(g, P) {
  g.strokeStyle = 'rgba(160,200,255,0.14)';
  g.lineWidth = 2;
  for (let i = 0; i < 60; i += 1) {
    const x = (i * 47 + 13) % W;
    const y = (i * 89 + 7) % H;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 8, y + 22);
    g.stroke();
  }
}

function drawLanterns(g, P) {
  for (let i = 0; i < 4; i += 1) {
    const x = 180 + i * 320;
    g.fillStyle = '#0E1A28';
    g.fillRect(x, 0, 10, H * 0.5);
    g.fillStyle = P.accent;
    g.beginPath(); g.arc(x + 5, H * 0.5, 12, 0, Math.PI * 2); g.fill();
  }
}

function drawBamboo(g, P) {
  g.strokeStyle = '#12301F';
  g.lineWidth = 12;
  for (let i = 0; i < 6; i += 1) {
    const x = 120 + i * 210;
    g.beginPath();
    g.moveTo(x, H);
    g.quadraticCurveTo(x - 18, H * 0.5, x + 8, 0);
    g.stroke();
    g.strokeStyle = '#143820';
    g.lineWidth = 2;
    for (let k = 0; k < 4; k += 1) {
      const yy = H - (k + 1) * 140;
      g.beginPath(); g.moveTo(x - 16, yy); g.lineTo(x + 16, yy); g.stroke();
    }
    g.strokeStyle = '#12301F';
    g.lineWidth = 12;
  }
}

// ---------- 几何辅助 ----------
function cellScreenX(state, i) {
  return LAYOUT.PLAYER_X - state.x + i * GAME.CELL_W;
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

// ---------- 忍者猫（剪影 + 金色风铃尾迹）----------
function drawCat(ctx, x, y, pose, clock, trailLen) {
  // 金色风铃尾迹
  const n = Math.min(7, trailLen || 6);
  for (let i = 1; i <= n; i += 1) {
    const a = 0.5 - i * 0.06;
    ctx.fillStyle = `rgba(255,216,78,${a})`;
    ctx.beginPath();
    ctx.arc(x - i * 26, y - 8 + Math.sin(clock * 6 - i) * 4, 5 - i * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(x, y);
  const bob = pose === 'jump' ? 0 : Math.sin(clock * 8) * 2;

  // 剪影身体
  ctx.fillStyle = '#0B0812';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;

  // 尾巴
  ctx.beginPath();
  ctx.moveTo(-16, bob - 6);
  ctx.quadraticCurveTo(-40, bob - 24 + Math.sin(clock * 4) * 6, -46, bob - 6 + Math.sin(clock * 4) * 8);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0B0812';
  ctx.stroke();

  // 身体（蹲伏椭圆）
  ctx.beginPath();
  ctx.ellipse(0, bob, 22, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // 头
  ctx.beginPath();
  ctx.arc(16, bob - 10, 15, 0, Math.PI * 2);
  ctx.fill();

  // 耳朵
  ctx.beginPath();
  ctx.moveTo(6, bob - 22); ctx.lineTo(12, bob - 38); ctx.lineTo(20, bob - 24); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, bob - 24); ctx.lineTo(26, bob - 40); ctx.lineTo(30, bob - 22); ctx.closePath(); ctx.fill();

  // 眼睛（金色，剪影上的亮点）
  ctx.fillStyle = '#FFD84E';
  ctx.beginPath(); ctx.arc(20, bob - 12, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(28, bob - 12, 2.4, 0, Math.PI * 2); ctx.fill();

  // 金色围巾
  ctx.strokeStyle = '#FFD84E';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(2, bob + 2);
  ctx.quadraticCurveTo(-10, bob + 14, -24, bob + 10 + Math.sin(clock * 10) * 5);
  ctx.stroke();

  ctx.restore();
}

function drawShuriken(ctx, x, y, clock) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(clock * 12);
  // 危险飞镖：红橙色，与银白尖刺区分
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
  glow.addColorStop(0, 'rgba(255,120,80,0.5)');
  glow.addColorStop(1, 'rgba(255,120,80,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FF5A4E';
  ctx.strokeStyle = '#7A1A18';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(6, -15); ctx.lineTo(2, -19); ctx.lineTo(-2, -19); ctx.lineTo(-6, -15);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#FFD84E';
  ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawChime(ctx, x, y, clock, collected) {
  if (collected) return;
  const pulse = 0.7 + 0.3 * Math.sin(clock * 5);
  ctx.fillStyle = '#FFD84E';
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, 11 * pulse, 0, Math.PI * 2); ctx.stroke();
  // 铃舌
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x, y + 13); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y + 14, 2, 0, Math.PI * 2); ctx.fill();
}

function drawSpike(ctx, x, groundY) {
  ctx.fillStyle = '#C8CCD8';
  ctx.strokeStyle = '#4A5068';
  ctx.lineWidth = 1;
  const n = 3;
  for (let i = 0; i < n; i += 1) {
    const sx = x + (i + 0.5) * (GAME.CELL_W / n);
    ctx.beginPath();
    ctx.moveTo(sx - 12, groundY);
    ctx.lineTo(sx, groundY - GAME.SPIKE_TOP);
    ctx.lineTo(sx + 12, groundY);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
}

function drawEnemy(ctx, x, groundY, clock) {
  ctx.save();
  ctx.translate(x + GAME.CELL_W / 2, groundY);
  ctx.fillStyle = '#1A0E22';
  const bob = Math.sin(clock * 5) * 2;
  ctx.beginPath(); ctx.ellipse(0, -18 + bob, 14, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -36 + bob, 12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-8, -44 + bob); ctx.lineTo(-4, -54 + bob); ctx.lineTo(2, -46 + bob); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4, -46 + bob); ctx.lineTo(10, -54 + bob); ctx.lineTo(12, -44 + bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#E0454E';
  ctx.beginPath(); ctx.arc(-4, -37 + bob, 2, 0, Math.PI * 2); ctx.arc(5, -37 + bob, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawDog(ctx, x, y, clock) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#140C1E';
  const run = Math.sin(clock * 14) * 4;
  ctx.beginPath(); ctx.ellipse(0, -16, 26, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(28, -26, 13, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(20, -36); ctx.lineTo(26, -48); ctx.lineTo(32, -36); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#140C1E'; ctx.lineWidth = 5;
  for (let i = 0; i < 4; i += 1) {
    const lx = -18 + i * 10;
    ctx.beginPath(); ctx.moveTo(lx, -6); ctx.lineTo(lx - run, -2); ctx.stroke();
  }
  ctx.fillStyle = '#FF6A5E';
  ctx.beginPath(); ctx.arc(31, -28, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawZip(ctx, x1, x2, y, clock) {
  ctx.strokeStyle = '#8A94A8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y - 8);
  ctx.lineTo(x2, y - 8);
  ctx.stroke();
  // 滑索吊环
  ctx.fillStyle = '#FFD84E';
  ctx.beginPath(); ctx.arc(x1 + 10 + ((clock * 40) % (x2 - x1 - 20)), y - 8, 4, 0, Math.PI * 2); ctx.fill();
}

function drawGoalArrow(ctx, clock) {
  const x = W - 46, y = GROUND_Y - 158;
  const pulse = 0.55 + 0.45 * Math.sin(clock * 4);
  const glow = ctx.createRadialGradient(x, y, 4, x, y, 40);
  glow.addColorStop(0, `rgba(255,216,78,${0.55 * pulse})`);
  glow.addColorStop(1, 'rgba(255,216,78,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFD84E';
  ctx.strokeStyle = '#8A6A10';
  ctx.lineWidth = 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-16, -13); ctx.lineTo(8, 0); ctx.lineTo(-16, 13); ctx.lineTo(-9, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏁', x - 4, y - 30);
}

function drawFinishGate(ctx, x, groundY, clock) {
  const pulse = 0.6 + 0.4 * Math.sin(clock * 4);
  const glow = ctx.createRadialGradient(x, groundY - 90, 6, x, groundY - 90, 90);
  glow.addColorStop(0, `rgba(255,216,78,${0.5 * pulse})`);
  glow.addColorStop(1, 'rgba(255,216,78,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 90, groundY - 180, 180, 200);
  // 金色鸟居（终点）
  ctx.strokeStyle = '#FFD84E';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(x - 26, groundY);
  ctx.lineTo(x - 26, groundY - 88);
  ctx.lineTo(x + 26, groundY - 88);
  ctx.lineTo(x + 26, groundY);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 40, groundY - 72);
  ctx.lineTo(x + 40, groundY - 72);
  ctx.stroke();
  ctx.fillStyle = '#FFD84E';
  ctx.font = '700 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏁', x, groundY - 116);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  let clock = 0;
  let lastState = null;

  function resize(w, h) {
    return { w, h, world: { width: W, height: H } };
  }

  function debugLayout() {
    return {
      play: { x: 0, y: LAYOUT.HUD_H, w: W, h: H - LAYOUT.HUD_H },
      hud: { x: 0, y: 0, w: W, h: LAYOUT.HUD_H },
      player: { x: LAYOUT.PLAYER_X - 30, y: GROUND_Y - 60, w: 70, h: 70 },
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(getBackground('dusk-tiles'), 0, 0);
    // 标题屏只画背景 + 猫剪影 + 风铃尾迹
    drawCat(ctx, W / 2, GROUND_Y + 8, 'idle', clock, 8);
  }

  function draw(state, dt, view) {
    if (!state || !state.course) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    const P = SCENE_PALETTES[state.scene] || SCENE_PALETTES['dusk-tiles'];
    ctx.drawImage(getBackground(state.scene), 0, 0);

    // 可见格子
    const first = Math.max(0, Math.floor((state.x - LAYOUT.PLAYER_X) / GAME.CELL_W) - 1);
    const last = Math.min(state.course.length - 1, first + Math.ceil(W / GAME.CELL_W) + 2);

    // 地面/屋顶带（先画连续的瓦海屋顶）
    ctx.fillStyle = P.tile;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = P.tileTop;
    ctx.fillRect(0, GROUND_Y, W, 8);
    ctx.fillStyle = P.tileEdge;
    ctx.fillRect(0, GROUND_Y + 8, W, 3);

    // 屋顶瓦楞纹理
    ctx.strokeStyle = P.tileEdge;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 24) {
      ctx.beginPath(); ctx.moveTo(gx, GROUND_Y + 8); ctx.lineTo(gx - 20, H); ctx.stroke();
    }

    // 每个格子：断口挖掉屋顶，画尖刺/敌忍/飞镖/风铃/平台
    for (let i = first; i <= last; i += 1) {
      const cell = state.course[i];
      if (!cell) continue;
      const sx = cellScreenX(state, i);
      if (sx > W + GAME.CELL_W || sx + GAME.CELL_W < -GAME.CELL_W) continue;

      if (cell.t === 'gap') {
        // 挖掉屋顶（露出深渊）
        ctx.fillStyle = '#050308';
        ctx.fillRect(sx, GROUND_Y, GAME.CELL_W + 1, H - GROUND_Y);
      } else if (cell.glide) {
        ctx.fillStyle = '#050308';
        ctx.fillRect(sx, GROUND_Y, GAME.CELL_W + 1, H - GROUND_Y);
        drawZip(ctx, sx, sx + GAME.CELL_W, GROUND_Y - GAME.GLIDE_H, clock);
      } else {
        // 屋顶瓦
        ctx.fillStyle = P.tile;
        ctx.fillRect(sx, GROUND_Y, GAME.CELL_W + 1, 10);
        ctx.fillStyle = P.tileEdge;
        ctx.fillRect(sx, GROUND_Y + 10, GAME.CELL_W + 1, 2);
        if (cell.high) {
          // 悬浮上层平台
          ctx.fillStyle = P.tileTop;
          roundRect(ctx, sx + 4, GROUND_Y - HIGH_H, GAME.CELL_W - 8, 12, 4);
          ctx.fill();
          ctx.fillStyle = P.tileEdge;
          ctx.fillRect(sx + 4, GROUND_Y - HIGH_H + 12, GAME.CELL_W - 8, 3);
        }
        if (cell.t === 'spike') drawSpike(ctx, sx, GROUND_Y);
        if (cell.t === 'enemy') drawEnemy(ctx, sx, GROUND_Y, clock);
      }

      if (cell.t === 'shuriken') {
        drawShuriken(ctx, sx + GAME.CELL_W / 2, GROUND_Y - GAME.SHURIKEN_LO, clock);
      }
      if (cell.chime) drawChime(ctx, sx + GAME.CELL_W / 2, GROUND_Y - 18, clock, cell.collected);
      if (cell.chimeHigh) drawChime(ctx, sx + GAME.CELL_W / 2, GROUND_Y - HIGH_H - 18, clock, cell.collected);
    }

    // 终点门（金色鸟居，明确目标）
    const gateSx = cellScreenX(state, state.course.length - 1) + GAME.CELL_W / 2;
    if (gateSx > -90 && gateSx < W + 90) drawFinishGate(ctx, gateSx, GROUND_Y, clock);

    // 常驻目标箭头（始终指向右方终点）
    if (state.phase === 'playing' || state.phase === 'countdown') drawGoalArrow(ctx, clock);

    // 夜雾
    if (state.fogRange && state.x / GAME.CELL_W > state.fogRange[0] - 5) {
      const fx0 = cellScreenX(state, state.fogRange[0]);
      const fx1 = cellScreenX(state, state.fogRange[1]);
      const grad = ctx.createLinearGradient(fx0, 0, fx1, 0);
      grad.addColorStop(0, 'rgba(190,210,230,0)');
      grad.addColorStop(0.5, 'rgba(190,210,230,0.28)');
      grad.addColorStop(1, 'rgba(190,210,230,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(fx0, 0, fx1 - fx0, H);
    }

    // 追击犬（在玩家身后，加速区间可见）
    const frontCell = state.course[Math.min(state.course.length - 1, Math.floor(state.x / GAME.CELL_W))] || {};
    if (frontCell.dog) {
      drawDog(ctx, LAYOUT.PLAYER_X - 150, GROUND_Y, clock);
    }

    // 玩家（剪影 + 尾迹）
    const py = GROUND_Y - state.y;
    const pose = state.phase === 'won' ? 'idle' : (!state.onGround ? 'jump' : 'idle');
    drawCat(ctx, LAYOUT.PLAYER_X, py, pose, clock, 6);

    // 护盾光罩
    if (state.shield > 0 || state.invincibleT > 0) {
      ctx.strokeStyle = `rgba(255,216,78,${0.5 + 0.3 * Math.sin(clock * 8)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(LAYOUT.PLAYER_X, py - 10, 40, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  return { draw, debugLayout, resize };
}
