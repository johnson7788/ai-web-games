// src/render/index.js — Q ADVENTURE · 全程序化 Canvas 渲染（三场景包 + 果冻豆骑士 + 敌人 + 特效）。
// 只读 run 状态与事件驱动粒子；不碰 DOM（HUD 由 src/ui 负责）。
import { WORLD } from '../../config/game.config.js';
import { P, ENEMY, COLLECT, clamp } from '../../config/gameplay.js';
import { GROUND_Y, PACKS } from '../../config/levels.js';

// 三套场景包色板（换章必换：色板 + 构图 + 装饰）
const THEMES = {
  candy: {
    skyTop: '#ffe3f0', skyBottom: '#ffc2dd', far: '#f4a8cd', mid: '#e98fc0',
    ground: '#c96f9e', groundTop: '#ff8fc4', groundLine: '#a65280',
    plat: '#ff9dcc', platLine: '#c9649a', accent: '#ff5fae', cloud: 'rgba(255,255,255,0.85)',
  },
  cloud: {
    skyTop: '#eaf6ff', skyBottom: '#bfe2ff', far: '#cfe9ff', mid: '#a9d6f5',
    ground: '#7fb6d9', groundTop: '#dff2ff', groundLine: '#5f92b8',
    plat: '#d7ecff', platLine: '#86b6d9', accent: '#4aa3e8', cloud: 'rgba(255,255,255,0.95)',
  },
  night: {
    skyTop: '#241a3a', skyBottom: '#3c2a55', far: '#2f2246', mid: '#3f2d5c',
    ground: '#4a3568', groundTop: '#7a5aa0', groundLine: '#33254a',
    plat: '#6a4d92', platLine: '#8f6fb5', accent: '#9d7bff', cloud: 'rgba(180,160,220,0.4)',
  },
};

const PACK_THEME = { 1: 'candy', 2: 'cloud', 3: 'night' };

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];
  let tGlobal = 0;

  function burst(x, y, kind) {
    const colors = { coin: ['#ffd54a', '#ffe082'], star: ['#ffd54a', '#fff3b0'], stomp: ['#ff9dcc', '#ffffff'], beat: ['#7dffce', '#ffffff'], death: ['#ff5d73', '#ffb3c0'] };
    const cols = colors[kind] || colors.stomp;
    const n = kind === 'star' ? 12 : 8;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.5 + Math.random() * 0.3, age: 0, size: 2 + Math.random() * 3, color: cols[i % cols.length] });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) if (particles[i].age >= particles[i].life) particles.splice(i, 1);
  }

  function drawBackground(th, run, cam) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(1, th.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 远景装饰（随场景包变化：糖果=圆糖山，云端=云，夜林=月+树影）
    const w = run ? run.level.width : WORLD.WIDTH;
    if (th === THEMES.candy) {
      for (let i = 0; i < 24; i += 1) {
        const x = ((i * 320 - cam * 0.25) % (w + 400) + w + 400) % (w + 400) - 200;
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.5)' : 'rgba(255,160,210,0.55)';
        ctx.beginPath();
        ctx.arc(x, 620 + (i % 3) * 22, 46 + (i % 4) * 10, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (th === THEMES.cloud) {
      for (let i = 0; i < 18; i += 1) {
        const x = ((i * 380 - cam * 0.3) % (w + 500) + w + 500) % (w + 500) - 250;
        const y = 90 + (i % 4) * 60;
        ctx.fillStyle = th.cloud;
        ctx.beginPath();
        ctx.arc(x, y, 40, 0, Math.PI * 2);
        ctx.arc(x + 40, y + 8, 30, 0, Math.PI * 2);
        ctx.arc(x - 40, y + 10, 28, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#f4e8b0';
      ctx.beginPath();
      ctx.arc(1080 - cam * 0.02, 120, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,12,32,0.6)';
      for (let i = 0; i < 14; i += 1) {
        const x = ((i * 260 - cam * 0.4) % (w + 400) + w + 400) % (w + 400) - 200;
        ctx.fillRect(x, 0, 6, 140 + (i % 3) * 40);
        ctx.beginPath();
        ctx.arc(x + 3, 140, 60, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawGround(run, cam, th) {
    for (const seg of run.level.ground) {
      const x = seg.x - cam;
      const y = seg.y;
      if (x + seg.w < -20 || x > WORLD.WIDTH + 20) continue;
      ctx.fillStyle = th.ground;
      ctx.fillRect(x, y, seg.w, WORLD.HEIGHT - y);
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y, seg.w, 14);
      ctx.fillStyle = th.groundLine;
      ctx.fillRect(x, y + 14, seg.w, 2);
      // 纹理点
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let gx = Math.ceil(x / 46) * 46; gx < x + seg.w; gx += 46) {
        ctx.fillRect(gx, y + 26 + (gx % 3) * 18, 6, 6);
      }
    }
  }

  function drawPlatforms(run, cam, th) {
    for (const s of run.level.platforms) {
      const x = s.x - cam;
      const y = s.y;
      if (x + s.w < -40 || x > WORLD.WIDTH + 40) continue;
      if (s.type === 'spike') {
        ctx.fillStyle = th === THEMES.night ? '#d94f8a' : '#c94f6a';
        for (let sx = x; sx < x + s.w; sx += 20) {
          ctx.beginPath();
          ctx.moveTo(sx, y + s.h);
          ctx.lineTo(sx + 10, y);
          ctx.lineTo(sx + 20, y + s.h);
          ctx.closePath();
          ctx.fill();
        }
        continue;
      }
      if (s.type === 'spring') {
        ctx.fillStyle = '#e14f6a';
        ctx.fillRect(x + 8, y + 6, s.w - 16, 8);
        ctx.fillRect(x + 14, y + 14, s.w - 28, s.h - 14);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 8, y + 2, s.w - 16, 4);
        continue;
      }
      roundedRect(ctx, x, y, s.w, s.h, 8);
      ctx.fillStyle = s.type === 'moving' ? th.accent : th.plat;
      ctx.fill();
      ctx.strokeStyle = th.platLine;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (s.type === 'moving') {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x + 6, y + 3, s.w - 12, 4);
      }
    }
  }

  function drawStar(ctx, x, y, r, spin) {
    ctx.save();
    ctx.translate(x, y);
    // 白色光晕，与金币（橙色圆）区分
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(spin);
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const ang = (i * Math.PI) / 5 - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffe066';
    ctx.fill();
    ctx.strokeStyle = '#c8860b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawCollectibles(run, cam) {
    const bob = Math.sin(tGlobal * 3) * 4;
    for (const c of run.coins) {
      const x = c.x - cam;
      const y = c.y + bob;
      if (x < -20 || x > WORLD.WIDTH + 20) continue;
      // 金币：橙色圆 + 深色描边 + 内环，明确区别于黄色星星
      ctx.fillStyle = '#f5a623';
      ctx.beginPath();
      ctx.arc(x, y, COLLECT.COIN_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a5a00';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = '#fff0c0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, COLLECT.COIN_R - 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const s of run.stars) {
      const x = s.x - cam;
      const y = s.y + bob * 1.4;
      if (x < -24 || x > WORLD.WIDTH + 24) continue;
      drawStar(ctx, x, y, COLLECT.STAR_R, tGlobal * 0.8);
    }
  }

  function drawEnemy(ctx, e, cam, th) {
    const x = e.x - cam;
    const y = e.y;
    const sq = 1 - e.squash * 0.4;
    ctx.save();
    ctx.translate(x + ENEMY.W / 2, y + ENEMY.H);
    ctx.scale(1 / sq, sq);
    // 身体
    ctx.fillStyle = th === THEMES.night ? '#e0566a' : '#ff6a4d';
    ctx.beginPath();
    ctx.arc(0, -ENEMY.H / 2, ENEMY.W / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a2430';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-6, -ENEMY.H / 2 - 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -ENEMY.H / 2 - 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#202020';
    const look = e.state === 'chase' ? 2 : 0;
    ctx.beginPath(); ctx.arc(-6 + look, -ENEMY.H / 2 - 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6 + look, -ENEMY.H / 2 - 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 红色「!」标记（目标/敌人可辨识）
    ctx.fillStyle = '#ff2d55';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', x + ENEMY.W / 2, y - 10);
  }

  function drawPlayer(ctx, p, cam, beat) {
    const x = p.x - cam;
    const y = p.y;
    const sq = 1 - p.squash * 0.3;
    ctx.save();
    ctx.translate(x + P.W / 2, y + P.H);
    ctx.scale(1 / sq, sq);
    // 果冻身体
    const g = ctx.createRadialGradient(-4, -P.H / 2 - 4, 2, 0, -P.H / 2, P.W);
    g.addColorStop(0, '#a9ffe2');
    g.addColorStop(1, '#2fd98b');
    ctx.fillStyle = g;
    roundedRect(ctx, -P.W / 2, -P.H, P.W, P.H, 15);
    ctx.fill();
    ctx.strokeStyle = '#0f6b4a';
    ctx.lineWidth = 3;
    ctx.stroke();
    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.facing * 5 - 4, -P.H + 14, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.facing * 5 + 9, -P.H + 14, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10301f';
    ctx.beginPath(); ctx.arc(p.facing * 5 - 3, -P.H + 14, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.facing * 5 + 10, -P.H + 14, 2.4, 0, Math.PI * 2); ctx.fill();
    // 果冻冠（小皇冠）
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(-8, -P.H);
    ctx.lineTo(-8, -P.H - 7);
    ctx.lineTo(-4, -P.H - 3);
    ctx.lineTo(0, -P.H - 9);
    ctx.lineTo(4, -P.H - 3);
    ctx.lineTo(8, -P.H - 7);
    ctx.lineTo(8, -P.H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // 鼓点跳命中闪光
    if (beat) {
      ctx.strokeStyle = 'rgba(125,255,206,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + P.W / 2, y + P.H / 2, P.W * 0.8 + Math.sin(tGlobal * 20) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawGoal(ctx, run, cam) {
    const g = run.level.goal;
    if (!g) return;
    const x = g.x - cam;
    const y = g.y;
    ctx.fillStyle = '#8a6b4a';
    ctx.fillRect(x - 4, y - 90, 8, 90);
    // 旗帜
    ctx.fillStyle = '#ff5fae';
    ctx.beginPath();
    ctx.moveTo(x + 4, y - 90);
    ctx.lineTo(x + 60 + Math.sin(tGlobal * 3) * 4, y - 74);
    ctx.lineTo(x + 4, y - 58);
    ctx.closePath();
    ctx.fill();
    // 目标标记（暗色背板 + 大箭头 + 文字，保证弱光/浅色背景下可读）
    const arrowY = y - 120 + Math.sin(tGlobal * 4) * 5;
    ctx.fillStyle = 'rgba(20, 8, 16, 0.82)';
    roundedRect(ctx, x - 40, arrowY - 52, 120, 66, 14);
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼', x + 20, arrowY + 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('GOAL', x + 20, arrowY - 20);
  }

  function drawWind(ctx, run, cam) {
    const w = run.level.wind;
    if (!w) return;
    const x0 = w.x0 - cam;
    const x1 = w.x1 - cam;
    if (x1 < 0 || x0 > WORLD.WIDTH) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const y = 80 + i * 60 + ((tGlobal * 60) % 60);
      const sx = w.dir === 1 ? x0 : x1;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + w.dir * 50, y);
      ctx.stroke();
    }
  }

  function drawDark(ctx, run, cam) {
    if (!run.level.dark) return;
    const p = run.player;
    const px = p.x + p.w / 2 - cam;
    const py = p.y + p.h / 2;
    const r = 240;
    const g = ctx.createRadialGradient(px, py, r * 0.5, px, py, r);
    g.addColorStop(0, 'rgba(8,4,18,0)');
    g.addColorStop(1, 'rgba(8,4,18,0.78)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function draw(run, alpha = 1) {
    tGlobal += 1 / 60;
    const th = run ? THEMES[PACK_THEME[run.level.pack] || 'candy'] : THEMES.candy;
    const cam = run ? run.cameraX : 0;
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    drawBackground(th, run, cam);

    if (run) {
      drawWind(ctx, run, cam);
      drawGround(run, cam, th);
      drawPlatforms(run, cam, th);
      drawCollectibles(run, cam);
      for (const e of run.enemies) drawEnemy(ctx, e, cam, th);
      drawGoal(ctx, run, cam);
      drawPlayer(ctx, run.player, cam, run.getHud().beat);
      drawDark(ctx, run, cam);
    } else {
      // 标题屏背板：画一个静止的果冻豆骑士剪影
      ctx.save();
      ctx.translate(WORLD.WIDTH / 2, 470);
      ctx.fillStyle = '#2fd98b';
      roundedRect(ctx, -30, -60, 60, 60, 20);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-8, -30, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(14, -30, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.moveTo(-12, -60); ctx.lineTo(-12, -70); ctx.lineTo(-6, -65); ctx.lineTo(0, -74); ctx.lineTo(6, -65); ctx.lineTo(12, -70); ctx.lineTo(12, -60); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    updateParticles(1 / 60);
    for (const p of particles) {
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cam, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { draw, burst };
}

export default createRender;
