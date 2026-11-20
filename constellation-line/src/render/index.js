// src/render/index.js — Canvas 2D 渲染：星空背景 + 星点 + 线段 + 连线轨迹 + 流星 + 点亮动画。
// 三个场景包（theme.js）换章必换色板/构图/装饰；所有坐标从逻辑 1000×562 等比映射进玩法安全区。
import { WORLD } from '../../config/game.config.js';
import { LOGICAL } from '../../config/levels.js';
import { sceneOf } from './theme.js';

const STAR_R = 6.5;
const START_PULSE_MS = 1400;

export function createRender(canvas) {
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const ctx = canvas.getContext('2d');

  // 逻辑 → 画布映射（等比，居中）
  const scale = Math.min(WORLD.PLAY_W / LOGICAL.W, WORLD.PLAY_H / LOGICAL.H);
  const ox = WORLD.PLAY_X + (WORLD.PLAY_W - LOGICAL.W * scale) / 2;
  const oy = WORLD.PLAY_Y + (WORLD.PLAY_H - LOGICAL.H * scale) / 2;
  const X = (x) => ox + x * scale;
  const Y = (y) => oy + y * scale;

  let particles = [];
  let winAt = -Infinity;
  let prevPhase = 'title';
  let bgStars = null;

  function makeBgStars() {
    // 确定性背景星野（LCG 种子按场景变化 → 构图差异）
    const list = [];
    let seed = 1337;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 220; i += 1) {
      list.push({ x: rnd() * LOGICAL.W, y: rnd() * LOGICAL.H, r: 0.5 + rnd() * 1.6, tw: rnd() * Math.PI * 2 });
    }
    return list;
  }

  function drawBackground(scene, now) {
    const g = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT * 0.4, 40, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 900);
    g.addColorStop(0, scene.bg[0]);
    g.addColorStop(0.55, scene.bg[1]);
    g.addColorStop(1, scene.bg[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星云团（构图装饰之一）
    for (let i = 0; i < 3; i += 1) {
      const cx = WORLD.WIDTH * (0.2 + i * 0.3);
      const cy = WORLD.HEIGHT * (0.3 + (i % 2) * 0.35);
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 260);
      rg.addColorStop(0, scene.nebula[0]);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(cx - 260, cy - 260, 520, 520);
    }

    if (scene.decoration === 'moon') drawMoon(scene);
    else if (scene.decoration === 'milkyway') drawMilkyWay(scene);
    else drawAurora(scene, now);

    // 背景星点（慢闪）
    if (!bgStars) bgStars = makeBgStars();
    for (const s of bgStars) {
      const a = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(now / 900 + s.tw));
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(X(s.x), Y(s.y), s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMoon(scene) {
    ctx.fillStyle = scene.decor;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(X(920), Y(92), 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = scene.bg[0];
    ctx.beginPath();
    ctx.arc(X(906), Y(84), 40, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMilkyWay(scene) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = scene.decor;
    ctx.lineWidth = 120;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(X(-40), Y(500));
    ctx.quadraticCurveTo(X(500), Y(240), X(1040), Y(40));
    ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 240;
    ctx.stroke();
    ctx.restore();
  }

  function drawAurora(scene, now) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = scene.decor;
    for (let k = 0; k < 3; k += 1) {
      ctx.lineWidth = 30 + k * 16;
      ctx.beginPath();
      for (let x = -20; x <= 1020; x += 20) {
        const y = 60 + k * 55 + Math.sin(x / 140 + now / 1600 + k) * 46;
        if (x === -20) ctx.moveTo(X(x), Y(y));
        else ctx.lineTo(X(x), Y(y));
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function starAt(run, gi, now) {
    const n = run.nodes[gi];
    const scene = sceneOf(run.level.scene);
    const sx = X(n.x);
    const sy = Y(n.y);
    const isStart = gi === run.compStartGlobal[n.component];
    const isCurrent = gi === run.current && run.phase === 'playing';
    const isWaypoint = run.level.waypoint != null && gi === run.localToGlobal[0][run.level.waypoint];

    // 光晕
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, STAR_R * 3.2);
    glow.addColorStop(0, scene.starGlow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, STAR_R * 3.2, 0, Math.PI * 2);
    ctx.fill();

    // 核心
    ctx.fillStyle = scene.starCore;
    ctx.beginPath();
    ctx.arc(sx, sy, STAR_R, 0, Math.PI * 2);
    ctx.fill();

    if (isStart) {
      const p = 0.5 + 0.5 * Math.sin(now / START_PULSE_MS * Math.PI * 2);
      ctx.strokeStyle = scene.startRing;
      ctx.globalAlpha = 0.55 + 0.45 * p;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, STAR_R + 6 + p * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (isCurrent) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, STAR_R + 11, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (isWaypoint) {
      drawNorthStar(ctx, sx, sy, scene.waypoint, now);
    }
  }

  function drawNorthStar(ctx, sx, sy, color, now) {
    const p = 0.5 + 0.5 * Math.sin(now / 500);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    const r = STAR_R + 9 + p * 4;
    for (let k = 0; k < 4; k += 1) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      ctx.lineTo(sx + Math.cos(a) * (r + 9), sy + Math.sin(a) * (r + 9));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function edgeLine(run, gi, gj, style, width, now) {
    const a = run.nodes[gi];
    const b = run.nodes[gj];
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(X(a.x), Y(a.y));
    ctx.lineTo(X(b.x), Y(b.y));
    ctx.stroke();
  }

  function drawEdges(run, scene, now) {
    // 未走边（暗线）
    for (const e of run.edges) {
      if (run.usedEdges.has(e.key)) continue;
      const blocked = run.meteorBlockedKey === e.key;
      if (blocked) {
        edgeLine(run, e.a, e.b, scene.meteor, 3, now);
        // 流星划过
        drawMeteorStreak(run, e, scene, now);
      } else {
        edgeLine(run, e.a, e.b, scene.edgeIdle, 2, now);
      }
    }
    // 已走边（亮线 + 光晕）
    for (const e of run.edges) {
      if (!run.usedEdges.has(e.key)) continue;
      edgeLine(run, e.a, e.b, scene.edgeUsed, 4, now);
    }
    // 当前轨迹高亮
    if (run.trail.length > 1) {
      ctx.strokeStyle = scene.edgeTrail;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < run.trail.length; i += 1) {
        const p = run.nodes[run.trail[i]];
        if (i === 0) ctx.moveTo(X(p.x), Y(p.y));
        else ctx.lineTo(X(p.x), Y(p.y));
      }
      ctx.stroke();
    }
  }

  function drawMeteorStreak(run, e, scene, now) {
    const a = run.nodes[e.a];
    const b = run.nodes[e.b];
    const mx = (X(a.x) + X(b.x)) / 2;
    const my = (Y(a.y) + Y(b.y)) / 2;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = scene.meteor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(mx - 34, my - 34);
    ctx.lineTo(mx + 34, my + 34);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawWinFlourish(run, now) {
    // 点亮瞬间：全图轮廓放大淡出 + 流星扫过 + 星座名浮起
    const t = now - winAt;
    if (t < 0 || t > 2600) return;
    const k = Math.min(1, t / 2600);
    const scene = sceneOf(run.level.scene);
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - k);
    ctx.fillStyle = scene.starGlow;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.restore();

    // 流星扫过
    const sweep = (t % 700) / 700;
    ctx.save();
    ctx.strokeStyle = scene.meteor;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9 * (1 - k);
    const sx = X(LOGICAL.W) * sweep - 120;
    const sy = Y(0) + sweep * (WORLD.PLAY_H - 40);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 120, sy - 120);
    ctx.stroke();
    ctx.restore();

    // 星座名浮起
    ctx.save();
    ctx.globalAlpha = Math.min(1, t / 400) * (1 - Math.max(0, (t - 1800) / 800));
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 44px "PingFang SC", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = scene.starGlow;
    ctx.shadowBlur = 24;
    ctx.fillText(run.level.name.toUpperCase(), WORLD.WIDTH / 2, Y(80) - k * 30);
    ctx.restore();
  }

  function draw(run, now) {
    now = now ?? performance.now();
    const scene = sceneOf(run ? run.level.scene : 0);
    drawBackground(scene, now);

    if (run) {
      drawEdges(run, scene, now);
      for (let i = 0; i < run.nodes.length; i += 1) starAt(run, i, now);
      if (run.phase === 'won') {
        if (prevPhase !== 'won') { winAt = now; prevPhase = 'won'; }
        drawWinFlourish(run, now);
      } else {
        prevPhase = run.phase;
      }
    }

    // 粒子
    updateParticles(now);
    drawParticles(now);
  }

  function burst(x, y, kind) {
    const scene = sceneOf(0);
    const colors = kind === 'win' ? ['#ffffff', '#ffe9a8', '#a7fff0'] : [scene.starGlow, '#ffffff'];
    for (let i = 0; i < (kind === 'win' ? 22 : 8); i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.5, ttl: 0.5 + Math.random() * 0.5,
        r: 1 + Math.random() * 2.4, color: colors[i % colors.length],
      });
    }
  }

  function updateParticles(now) {
    const dt = 1 / 60;
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function drawParticles(now) {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.ttl);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return {
    draw,
    burst,
    get scale() { return scale; },
    toCanvas: (x, y) => ({ x: X(x), y: Y(y) }),
  };
}
