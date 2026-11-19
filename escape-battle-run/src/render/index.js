// Canvas 2D 渲染：霓虹街机 · 竞技场逃生。
// 背景网格 + 岩石/晶体/无人机/玩家/粒子/爆发环/波次横幅。
import { WORLD, PLAYER, ENEMY, GEM, ROCK, SKILL } from '../../config/game.config.js';

const COLORS = {
  bg: '#0a0a18',
  bg2: '#0d0d22',
  grid: '#1b2440',
  gridHot: '#233a6a',
  player: '#2be8ff',
  playerGlow: 'rgba(43,232,255,0.5)',
  enemy: '#ff2d78',
  enemyGlow: 'rgba(255,45,120,0.55)',
  gem: '#ffd84e',
  gemGlow: 'rgba(255,216,78,0.6)',
  rock: '#5b6b8c',
  rockEdge: '#8a9dc0',
  nova: '#7df9ff',
  text: '#eaffff',
};

function glowCircle(ctx, x, y, r, fill, glow, glowR) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, glowR || r * 2.4);
  g.addColorStop(0, glow);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, glowR || r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  function drawBackground(t) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 径向底色
    const g = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 80, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 720);
    g.addColorStop(0, '#12122c');
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 网格
    const gap = 48;
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.WIDTH; x += gap) {
      const hot = Math.abs(x - WORLD.WIDTH / 2) < gap * 3;
      ctx.strokeStyle = hot ? COLORS.gridHot : COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, WORLD.HUD_H);
      ctx.lineTo(x + 0.5, WORLD.HEIGHT);
      ctx.stroke();
    }
    for (let y = WORLD.HUD_H; y <= WORLD.HEIGHT; y += gap) {
      const hot = Math.abs(y - WORLD.HEIGHT / 2) < gap * 3;
      ctx.strokeStyle = hot ? COLORS.gridHot : COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(WORLD.WIDTH, y + 0.5);
      ctx.stroke();
    }
    // 活动区描边
    ctx.strokeStyle = 'rgba(43,232,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(WORLD.MARGIN - 4, WORLD.HUD_H + WORLD.MARGIN - 4,
      WORLD.WIDTH - WORLD.MARGIN * 2 + 8, WORLD.HEIGHT - WORLD.HUD_H - WORLD.MARGIN * 2 + 8);

    void t;
  }

  function drawRocks(state) {
    for (const r of state.rocks) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(state.time * 0.5);
      ctx.fillStyle = COLORS.rock;
      ctx.strokeStyle = COLORS.rockEdge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI * 2 * i) / 6;
        const rad = r.r * (i % 2 === 0 ? 1 : 0.78);
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawGems(state) {
    // 找出离玩家最近的晶体，作为「目标」高亮
    let nearest = null; let nd = Infinity;
    const p = state.player;
    for (const g of state.gems) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < nd) { nd = d; nearest = g; }
    }
    for (const g of state.gems) {
      const pulse = 1 + Math.sin(state.time * 6 + g.x) * 0.15;
      const isGoal = g === nearest;
      if (isGoal) {
        // 目标高亮：脉冲双环
        const rr = g.r + 10 + Math.sin(state.time * 5) * 4;
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(g.x, g.y, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      glowCircle(ctx, g.x, g.y, g.r * pulse, COLORS.gem, COLORS.gemGlow, g.r * 3.2);
      // 菱形（白边，与敌人区分）
      ctx.strokeStyle = '#fff7d6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - g.r);
      ctx.lineTo(g.x + g.r, g.y);
      ctx.lineTo(g.x, g.y + g.r);
      ctx.lineTo(g.x - g.r, g.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 高光点
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(g.x - g.r * 0.2, g.y - g.r * 0.25, g.r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEnemies(state) {
    for (const e of state.enemies) {
      const pulse = 1 + Math.sin(state.time * 9 + e.y) * 0.12;
      glowCircle(ctx, e.x, e.y, e.r * pulse, COLORS.enemy, COLORS.enemyGlow, e.r * 3);
      // 内部「眼」点
      ctx.fillStyle = '#1a0010';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd0e2';
      ctx.beginPath();
      ctx.arc(e.x + e.r * 0.16, e.y - e.r * 0.12, e.r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // 红色「!」威胁标记
      ctx.fillStyle = '#ff2d78';
      ctx.font = '700 15px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('!', e.x, e.y - e.r * pulse - 4);
    }
  }

  function drawPlayer(state, view) {
    const p = state.player;
    if (p.dead) return;
    // 尾迹
    if (view.trail && view.trail.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < view.trail.length; i += 1) {
        const tr = view.trail[i];
        const a = (i / view.trail.length) * 0.35;
        ctx.fillStyle = `rgba(43,232,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, p.r * (i / view.trail.length) * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // 朝向角
    let ang = Math.atan2(p.vy, p.vx);
    if (Math.hypot(p.vx, p.vy) < 1) ang = -Math.PI / 2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    glowCircle(ctx, 0, 0, p.r, COLORS.player, 'rgba(43,232,255,0.75)', p.r * 4.2);
    // 箭头三角
    ctx.fillStyle = '#06222a';
    ctx.beginPath();
    ctx.moveTo(p.r, 0);
    ctx.lineTo(-p.r * 0.7, p.r * 0.62);
    ctx.lineTo(-p.r * 0.35, 0);
    ctx.lineTo(-p.r * 0.7, -p.r * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // 眩晕指示
    if (p.stunned > 0) {
      ctx.strokeStyle = COLORS.text;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 6, state.time * 8, state.time * 8 + Math.PI * 1.2);
      ctx.stroke();
    }
  }

  function drawNova(view, dt) {
    if (!view.novaRing) return;
    const n = view.novaRing;
    const k = 1 - n.ttl / n.maxTtl;
    const r = n.r * (0.3 + 0.7 * k);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = COLORS.nova;
    ctx.lineWidth = Math.max(1, 6 * (1 - k));
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    void dt;
  }

  function drawParticles(view, dt) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of view.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    void dt;
  }

  function drawBanner(view, t) {
    if (!view.banner || view.banner.ttl <= 0) return;
    const b = view.banner;
    const a = Math.min(1, b.ttl / 0.4) * Math.min(1, (b.maxTtl - b.ttl) / 0.4 + 0.2);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.fillStyle = 'rgba(10,10,24,0.55)';
    ctx.fillRect(0, WORLD.HEIGHT / 2 - 46, WORLD.WIDTH, 92);
    ctx.fillStyle = COLORS.nova;
    ctx.font = '700 44px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.text, WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
    ctx.restore();
    void t;
  }

  return {
    draw(state, view = {}) {
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      if (!state) {
        drawBackground(0);
        // 标题屏漂浮光点
        for (let i = 0; i < 26; i += 1) {
          const x = (i * 197 + 40) % WORLD.WIDTH;
          const y = WORLD.HUD_H + ((i * 89 + 20) % (WORLD.HEIGHT - WORLD.HUD_H));
          const r = 2 + (i % 4);
          ctx.fillStyle = i % 3 === 0 ? COLORS.gem : i % 3 === 1 ? COLORS.player : COLORS.enemy;
          ctx.globalAlpha = 0.5 + 0.4 * Math.sin(i + (performance.now ? performance.now() / 900 : 0));
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        return;
      }
      const t = state.time;
      drawBackground(t);
      drawRocks(state);
      drawGems(state);
      drawEnemies(state);
      drawPlayer(state, view);
      drawNova(view, 0);
      drawParticles(view, 0);
      drawBanner(view, t);
    },
    debugLayout() {
      return null;
    },
  };
}
