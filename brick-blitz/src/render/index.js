// BRICK BLITZ · Canvas 2D 渲染：三座陶窑场景 / 釉砖 / 烧红陶珠拖尾 / 挡板 / 道具 / 窑火全开。
// 只消费 run.state + view（shake/fxQueue/cursor）。像素换算全部在此完成。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。

import { WORLD, GAME } from '../../config/game.config.js';

const SCENE_PALETTES = {
  celadon: {
    skyTop: '#2E5A50', skyMid: '#23463F', skyBot: '#1A352F',
    wall: '#3A2E22', wallDark: '#2A211A', floor: '#453327',
    glow: 'rgba(160,220,190,0.35)',
    brick: '#8FD4BC', brickHard: '#57A08B', brickGold: '#F4C14E', brickBlast: '#E87A5A',
    brickEdge: 'rgba(20,40,32,0.55)',
  },
  'jun-red': {
    skyTop: '#6B2A28', skyMid: '#55201E', skyBot: '#3A1515',
    wall: '#2E1B16', wallDark: '#21130F', floor: '#3A2218',
    glow: 'rgba(255,150,80,0.4)',
    brick: '#E8846B', brickHard: '#C0563F', brickGold: '#FFD84E', brickBlast: '#FF7A3C',
    brickEdge: 'rgba(60,20,14,0.55)',
  },
  'sky-blue': {
    skyTop: '#1F3B55', skyMid: '#182E44', skyBot: '#101F30',
    wall: '#20242E', wallDark: '#15181F', floor: '#232733',
    glow: 'rgba(150,200,255,0.35)',
    brick: '#7FB7E0', brickHard: '#4F84AD', brickGold: '#FFD84E', brickBlast: '#FF8A5C',
    brickEdge: 'rgba(12,20,36,0.55)',
  },
};

const POWER_STYLE = {
  wide: '#FFB13C',
  multi: '#FFD84E',
  pierce: '#B98AFF',
  fire: '#FF5A3C',
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
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
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.celadon;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // 窑内拱门砖墙（两侧）
  g.fillStyle = P.wallDark;
  g.fillRect(0, 0, 26, H);
  g.fillRect(W - 26, 0, 26, H);
  for (let y = 0; y < H; y += 34) {
    g.fillStyle = P.wall;
    g.fillRect(0, y, 26, 2);
    g.fillRect(W - 26, y, 26, 2);
  }

  // 底部窑底
  const floorGrad = g.createLinearGradient(0, H - 70, 0, H);
  floorGrad.addColorStop(0, P.floor);
  floorGrad.addColorStop(1, P.wallDark);
  g.fillStyle = floorGrad;
  g.fillRect(0, H - 70, W, 70);

  // 窑口暖光（底部中央）
  const mouth = g.createRadialGradient(W / 2, H - 40, 20, W / 2, H - 40, 340);
  mouth.addColorStop(0, P.glow);
  mouth.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mouth;
  g.fillRect(0, H - 160, W, 160);

  // 顶部炉口光带
  const topGlow = g.createLinearGradient(0, 0, 0, 140);
  topGlow.addColorStop(0, 'rgba(255,180,90,0.18)');
  topGlow.addColorStop(1, 'rgba(255,180,90,0)');
  g.fillStyle = topGlow;
  g.fillRect(0, 0, W, 140);
}

function drawEmbers(g, sceneKey, clock) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.celadon;
  for (let i = 0; i < 14; i += 1) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * WORLD.WIDTH;
    const y = WORLD.HEIGHT * 0.5 + (Math.sin(clock * 1.1 + i * 2.1) * 0.5 + 0.5) * 190;
    const a = 0.10 + Math.sin(clock * 2.6 + i) * 0.08;
    g.fillStyle = `rgba(255,${160 + (i % 5) * 15},80,${Math.max(0, a)})`;
    g.beginPath();
    g.arc(x, y, 1.6 + (i % 3), 0, Math.PI * 2);
    g.fill();
  }
}

function brickBase(P, brick) {
  if (brick.kind === 'gold') return P.brickGold;
  if (brick.kind === 'blast') return P.brickBlast;
  if (brick.kind === 'hard') return P.brickHard;
  return P.brick;
}

function drawBrick(g, P, brick, clock) {
  if (!brick.alive) return;
  const { x, y, w, h } = brick;
  const base = brickBase(P, brick);
  const darken = 1 - (brick.hp / brick.maxHp);
  const fill = darken > 0 ? shade(base, 1 - darken * 0.5) : base;

  // 釉面渐变
  const grad = g.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, fill);
  grad.addColorStop(1, shade(fill, 0.72));
  g.fillStyle = grad;
  roundRect(g, x, y, w, h, 5);
  g.fill();
  g.strokeStyle = P.brickEdge;
  g.lineWidth = 1.5;
  roundRect(g, x, y, w, h, 5);
  g.stroke();

  // 顶部高光
  g.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(g, x + 3, y + 2, w - 6, 4, 2);
  g.fill();

  // 目标光晕（微弱的暖色轮廓，提示可击打）
  g.strokeStyle = 'rgba(255,220,140,0.16)';
  g.lineWidth = 2;
  roundRect(g, x - 2, y - 2, w + 4, h + 4, 6);
  g.stroke();

  if (brick.kind === 'gold') {
    // 金釉十字亮斑
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.arc(x + w / 2, y + h / 2, 4, 0, Math.PI * 2);
    g.fill();
  } else if (brick.kind === 'blast') {
    // 炸窑火花脉冲
    const pulse = 0.4 + Math.sin(clock * 6) * 0.3;
    g.fillStyle = `rgba(255,230,120,${Math.max(0, pulse)})`;
    g.beginPath();
    g.arc(x + w / 2, y + h / 2, 3.4, 0, Math.PI * 2);
    g.fill();
  } else if (brick.hp < brick.maxHp) {
    // 裂纹
    g.strokeStyle = 'rgba(30,16,8,0.55)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x + w * 0.28, y + 3);
    g.lineTo(x + w * 0.44, y + h * 0.55);
    g.lineTo(x + w * 0.3, y + h - 3);
    g.stroke();
  }
}

function drawBall(g, ball, clock, idx) {
  if (ball.dead) return;
  const { x, y, r } = ball;
  // 火星拖尾（沿速度反方向）
  const spd = Math.hypot(ball.vx, ball.vy) || 1;
  const nx = -ball.vx / spd;
  const ny = -ball.vy / spd;
  for (let i = 1; i <= 5; i += 1) {
    const t = i / 5;
    const a = 0.5 * (1 - t);
    g.fillStyle = `rgba(255,${150 - i * 12},50,${a})`;
    g.beginPath();
    g.arc(x + nx * i * r * 1.05, y + ny * i * r * 1.05, r * (1 - t * 0.55), 0, Math.PI * 2);
    g.fill();
  }
  // 外发光
  const glow = g.createRadialGradient(x, y, r * 0.4, x, y, r * 3.2);
  glow.addColorStop(0, 'rgba(255,220,150,0.9)');
  glow.addColorStop(0.4, 'rgba(255,120,50,0.55)');
  glow.addColorStop(1, 'rgba(255,80,30,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(x, y, r * 2.6, 0, Math.PI * 2);
  g.fill();
  // 珠体
  const bg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  bg.addColorStop(0, '#FFF3D6');
  bg.addColorStop(0.5, '#FFB066');
  bg.addColorStop(1, '#D94A22');
  g.fillStyle = bg;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function drawPaddle(g, P, paddle) {
  const { x, y, w, h } = paddle;
  const grad = g.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#C86A3A');
  grad.addColorStop(0.5, '#8A4526');
  grad.addColorStop(1, '#5C2A16');
  g.fillStyle = grad;
  roundRect(g, x, y, w, h, h / 2);
  g.fill();
  g.strokeStyle = '#2A1410';
  g.lineWidth = 2;
  roundRect(g, x, y, w, h, h / 2);
  g.stroke();
  // 顶缘耐热亮线
  g.fillStyle = 'rgba(255,200,130,0.6)';
  roundRect(g, x + 6, y + 2, w - 12, 3, 1.5);
  g.fill();
}

function drawPowerUp(g, pu, clock) {
  if (!pu.alive) return;
  const { kind, x, y } = pu;
  const half = GAME.POWER_SIZE / 2;
  const col = POWER_STYLE[kind] || '#fff';
  // 光晕
  g.fillStyle = `rgba(255,255,255,0.14)`;
  g.beginPath();
  g.arc(x, y, half + 8 + Math.sin(clock * 5) * 2, 0, Math.PI * 2);
  g.fill();
  // 胶囊
  g.fillStyle = col;
  roundRect(g, x - half, y - half, GAME.POWER_SIZE, GAME.POWER_SIZE, 6);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 1.5;
  roundRect(g, x - half, y - half, GAME.POWER_SIZE, GAME.POWER_SIZE, 6);
  g.stroke();
  // 图标
  g.fillStyle = 'rgba(30,16,8,0.85)';
  if (kind === 'wide') {
    roundRect(g, x - 6, y - 2, 12, 4, 2); g.fill();
  } else if (kind === 'multi') {
    g.beginPath(); g.arc(x - 3, y, 3, 0, Math.PI * 2); g.arc(x + 4, y, 3, 0, Math.PI * 2); g.fill();
  } else if (kind === 'pierce') {
    g.beginPath(); g.moveTo(x + 6, y); g.lineTo(x - 4, y - 5); g.lineTo(x - 4, y + 5); g.closePath(); g.fill();
  } else if (kind === 'fire') {
    g.beginPath();
    g.moveTo(x, y - 7);
    g.quadraticCurveTo(x + 7, y, x, y + 7);
    g.quadraticCurveTo(x - 7, y, x, y - 7);
    g.fill();
  }
}

function drawKilnFire(g, clock) {
  const a = 0.16 + Math.sin(clock * 8) * 0.06;
  const grad = g.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 120, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 760);
  grad.addColorStop(0, `rgba(255,170,60,${a})`);
  grad.addColorStop(0.6, `rgba(255,90,30,${a * 0.6})`);
  grad.addColorStop(1, 'rgba(255,60,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  // 边缘火舌
  for (let i = 0; i < 20; i += 1) {
    const ang = (i / 20) * Math.PI * 2 + clock * 0.5;
    const r0 = 500 + Math.sin(clock * 7 + i) * 60;
    const x = WORLD.WIDTH / 2 + Math.cos(ang) * r0;
    const y = WORLD.HEIGHT / 2 + Math.sin(ang) * r0 * 0.55;
    g.fillStyle = `rgba(255,${120 + (i % 5) * 20},40,${0.25 + Math.sin(clock * 9 + i) * 0.12})`;
    g.beginPath();
    g.arc(x, y, 4 + (i % 4), 0, Math.PI * 2);
    g.fill();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;

  function resize(w, h) {
    return { w, h, world: { width: WORLD.WIDTH, height: WORLD.HEIGHT } };
  }

  function debugLayout() {
    const p = (lastState && lastState.paddle) || { x: 0, y: GAME.PADDLE_Y, w: GAME.PADDLE_W, h: GAME.PADDLE_H };
    return {
      paddle: { x: p.x, y: p.y, w: p.w, h: p.h },
      playfield: { x: 0, y: 0, w: WORLD.WIDTH, h: WORLD.HEIGHT },
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: 44 },
      bricks: { x: 0, y: GAME.BRICK_TOP, w: WORLD.WIDTH, h: 320 },
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('celadon'), 0, 0);
    drawEmbers(ctx, 'celadon', clock);
    const P = SCENE_PALETTES.celadon;
    // 标题背后的示例砖墙
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const w = 130, h = 26;
        const x = 90 + c * 140, y = 150 + r * 36;
        drawBrick(ctx, P, { x, y, w, h, hp: 1, maxHp: 1, kind: r === 1 ? 'hard' : 'normal', alive: true }, clock);
      }
    }
    drawBall(ctx, { x: WORLD.WIDTH / 2, y: 480, vx: 200, vy: -320, r: GAME.BALL_R, dead: false }, clock, 0);
    drawPaddle(ctx, P, { x: WORLD.WIDTH / 2 - 60, y: GAME.PADDLE_Y, w: 120, h: GAME.PADDLE_H });
  }

  function draw(state, dt, view) {
    if (!state || !state.bricks) { drawTitleScene(); return; }
    const v = view || {};
    const sceneKey = state.scene || v.sceneKey || 'celadon';
    clock += dt || 0;
    lastState = state;
    const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.celadon;

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);
    drawEmbers(ctx, sceneKey, clock);

    for (const brick of state.bricks) drawBrick(ctx, P, brick, clock);
    for (const pu of state.powerUps) drawPowerUp(ctx, pu, clock);
    drawPaddle(ctx, P, state.paddle);

    let bi = 0;
    for (const ball of state.balls) {
      drawBall(ctx, ball, clock, bi);
      bi += 1;
    }

    // 破碎闪光（fxQueue）
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.type === 'breakFlash' && fx.ttl > 0) {
          const a = Math.max(0, fx.ttl / 0.3) * 0.6;
          const gr = ctx.createRadialGradient(fx.x, fx.y, 2, fx.x, fx.y, 46);
          gr.addColorStop(0, `rgba(255,220,140,${a})`);
          gr.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, 46, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 窑火全开：全屏暖光
    if (state.kilnFire > 0) drawKilnFire(ctx, clock);

    ctx.restore();
  }

  return { draw, debugLayout, resize };
}
