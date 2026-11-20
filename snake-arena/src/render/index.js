// SNAKE ARENA · Canvas2D 渲染：竞技场 / 数据点 / 光带蛇 / 粒子特效。
// 三段主题色板来自 theme.js；所有视觉数值就地取自 config/gameplay.js。
import { WORLD } from '../../config/game.config.js';
import { SNAKE, FOOD, COLLIDE } from '../../config/gameplay.js';
import { themeOf } from './theme.js';
import { createParticles } from './particles.js';

function roundedPath(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const mx = (prev.x + cur.x) / 2;
    const my = (prev.y + cur.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = createParticles();
  let lastTime = 0;

  function drawBackground(themeName, theme, t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, theme.bgTop);
    g.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    if (themeName === 'core') {
      ctx.strokeStyle = theme.grid;
      ctx.lineWidth = 1;
      for (let x = 0; x <= WORLD.WIDTH; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke(); }
      for (let y = 0; y <= WORLD.HEIGHT; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke(); }
      ctx.strokeStyle = theme.decor;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 7; i += 1) {
        const x = 90 + i * 180;
        const off = (t * (30 + i * 8)) % (WORLD.HEIGHT + 200);
        ctx.beginPath(); ctx.moveTo(x, off - 120); ctx.lineTo(x, off); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (themeName === 'meltdown') {
      ctx.fillStyle = theme.grid;
      for (let y = 0; y < WORLD.HEIGHT; y += 90) ctx.fillRect(0, y, WORLD.WIDTH, 34);
      ctx.fillStyle = theme.decor;
      for (let i = 0; i < 24; i += 1) {
        const x = (i * 97) % WORLD.WIDTH;
        const y = WORLD.HEIGHT - ((i * 53 + t * 24) % WORLD.HEIGHT);
        ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      const step = 96;
      for (let y = 60; y < WORLD.HEIGHT; y += step) {
        for (let x = 60; x < WORLD.WIDTH; x += step) {
          ctx.fillStyle = theme.gridHi;
          ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = theme.grid;
          ctx.lineWidth = 1;
          if (x + step < WORLD.WIDTH) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + step, y); ctx.stroke(); }
          if (y + step < WORLD.HEIGHT) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + step); ctx.stroke(); }
        }
      }
      ctx.fillStyle = theme.decor;
      for (let i = 0; i < 10; i += 1) {
        const x = (i * 173) % WORLD.WIDTH;
        const y = (i * 137) % WORLD.HEIGHT;
        const r = 2 + Math.sin(t * 2 + i) * 1.5;
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 竞技场边界（即死墙）；顶部墙在 HUD 预留带下缘，避免玩法被 HUD 压住
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.85;
    const m = COLLIDE.WALL_MARGIN - 2;
    const top = WORLD.HUD_TOP;
    ctx.strokeRect(m, top, WORLD.WIDTH - m * 2, WORLD.HEIGHT - m - top);
    ctx.globalAlpha = 1;
  }

  function drawFood(run, theme) {
    const t = run.time;
    for (const f of run.foods) {
      const r = f.kind === 'shard' ? FOOD.SHARD_R : FOOD.ORB_R;
      const col = f.kind === 'shard' ? theme.shard : theme.food;
      const pulse = 1 + Math.sin(t * 4 + f.x * 0.011 + f.y * 0.013) * 0.15;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // 脉冲外环：让数据点一眼像「可拾取的能量球」而非背景噪点
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 2.1 * pulse, 0, Math.PI * 2); ctx.stroke();
      // 光晕
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.34;
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 2.5, 0, Math.PI * 2); ctx.fill();
      // 亮核
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawSnake(s, theme) {
    if (!s.alive) return;
    const isPlayer = s.isPlayer;
    const col = isPlayer ? theme.player : theme.enemies[s.colorIdx % theme.enemies.length];
    const glow = isPlayer ? theme.playerGlow : theme.enemyGlow;
    const pts = s.segments;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = glow;
    ctx.globalAlpha = isPlayer ? 0.5 : 0.3;
    ctx.lineWidth = (isPlayer ? SNAKE.BODY_R * 2 : SNAKE.BODY_R * 1.7) + 8;
    roundedPath(ctx, pts);
    ctx.stroke();

    ctx.strokeStyle = col;
    ctx.globalAlpha = isPlayer ? 0.95 : 0.7;
    ctx.lineWidth = isPlayer ? SNAKE.BODY_R * 2 : SNAKE.BODY_R * 1.7;
    roundedPath(ctx, pts);
    ctx.stroke();

    const h = pts[0];
    ctx.fillStyle = col;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(h.x, h.y, SNAKE.HEAD_R + (isPlayer ? 2 : 0), 0, Math.PI * 2);
    ctx.fill();

    const ex = Math.cos(s.heading);
    const ey = Math.sin(s.heading);
    const px = -ey;
    const py = ex;
    ctx.fillStyle = '#020617';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(h.x + ex * 4 + px * side * 4, h.y + ey * 4 + py * side * 4, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 名字标签（正常合成，别被加法混合冲淡）：只给玩家画 YOU，敌我靠颜色+亮度区分，避免边缘标签与 HUD 重叠
    if (isPlayer) {
      ctx.save();
      ctx.font = 'bold 14px ' + "'PingFang SC', 'Segoe UI', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.strokeText('YOU', h.x, h.y - SNAKE.HEAD_R - 9);
      ctx.fillStyle = theme.playerLabel;
      ctx.globalAlpha = 1;
      ctx.fillText('YOU', h.x, h.y - SNAKE.HEAD_R - 9);
      ctx.restore();
    }
  }

  function drawDecoSnake(theme) {
    // 标题屏装饰：一条固定霓虹光带蛇 + 数据点，保证首屏就有「玩家/敌人」剪影
    const pts = [];
    for (let x = -60; x <= WORLD.WIDTH + 60; x += 26) {
      pts.push({ x, y: WORLD.HEIGHT * 0.56 + Math.sin(x / 92) * 66 });
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = theme.playerGlow;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 30;
    roundedPath(ctx, pts);
    ctx.stroke();
    ctx.strokeStyle = theme.player;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 20;
    roundedPath(ctx, pts);
    ctx.stroke();
    const h = pts[Math.floor(pts.length * 0.62)];
    ctx.fillStyle = theme.player;
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(h.x, h.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#020617';
    ctx.beginPath(); ctx.arc(h.x + 6, h.y - 5, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(h.x + 6, h.y + 5, 2.6, 0, Math.PI * 2); ctx.fill();
    // 数据点
    ctx.fillStyle = theme.food;
    for (let i = 0; i < 8; i += 1) {
      const fx = 120 + i * 148;
      const fy = 150 + (i % 3) * 60;
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(fx, fy, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function draw(run) {
    const now = performance.now();
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
    lastTime = now;

    if (!run) {
      const themeName = 'core';
      drawBackground(themeName, themeOf(themeName), now / 1000);
      drawDecoSnake(themeOf(themeName));
      particles.update(dt);
      particles.draw(ctx);
      return;
    }

    const hud = run.getHud();
    const themeName = hud.theme;
    const theme = themeOf(themeName);
    drawBackground(themeName, theme, run.time);
    drawFood(run, theme);
    for (const s of run.snakes) drawSnake(s, theme);
    particles.update(dt);
    particles.draw(ctx);
  }

  return {
    draw,
    burst: (x, y, kind) => particles.burstData(x, y, kind === 'shard' ? '#7dd3fc' : themeOf('core').accent, kind === 'shard' ? 12 : 26),
    shockwave: (x, y) => particles.shockwave(x, y, '#7dd3fc', 190),
    eatPop: (x, y) => particles.eatPop(x, y, '#22d3ee'),
    shard: (x, y) => particles.shard(x, y, '#e0f2fe'),
    setBoost: () => {},
  };
}

export default createRender;
