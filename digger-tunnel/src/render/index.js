// src/render/index.js — Canvas 2D 霓虹街机渲染：网格土壤/岩石/宝石/传送门/钻核 + 粒子。
import { WORLD, CELL, COLS, ROWS, ORB, GOAL_R, GEM_R } from '../../config/game.config.js';
import { SOIL, ROCK } from '../game/sim.js';

const C = {
  bg0: '#070b16',
  bg1: '#0c1124',
  soil: '#161d3a',
  soilEdge: '#2c3f7e',
  rock: '#ff2d78',
  rockHi: '#ff86b4',
  gem: '#ffd23e',
  gemHi: '#fff3b0',
  goal: '#2bff9e',
  goalDim: '#0f7a55',
  orb: '#7df9ff',
  orbCore: '#ffffff',
  orbGlow: '#00c8ff',
};

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  const particles = [];

  function resize() {
    dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));
    canvas.width = Math.round(WORLD.WIDTH * dpr);
    canvas.height = Math.round(WORLD.HEIGHT * dpr);
  }

  function burst(x, y, color, n = 8, speed = 160) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, maxLife: 0.3 + Math.random() * 0.35,
        color, size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, C.bg0);
    g.addColorStop(1, C.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 细网格点
    ctx.fillStyle = 'rgba(120, 150, 255, 0.05)';
    for (let gx = 0; gx <= COLS; gx += 1) {
      for (let gy = 0; gy <= ROWS; gy += 1) {
        ctx.fillRect(gx * CELL - 0.5, gy * CELL - 0.5, 1, 1);
      }
    }
  }

  function drawSoil(grid) {
    ctx.fillStyle = C.soil;
    for (let gy = 0; gy < ROWS; gy += 1) {
      for (let gx = 0; gx < COLS; gx += 1) {
        const v = grid[gy * COLS + gx];
        if (v !== SOIL) continue;
        const shade = 0.92 + hash(gx, gy) * 0.12;
        ctx.fillStyle = `rgba(22,29,58,${shade})`;
        ctx.fillRect(gx * CELL + 0.5, gy * CELL + 0.5, CELL - 1, CELL - 1);
        // 顶面受光：上方为空则亮边
        if (gy === 0 || grid[(gy - 1) * COLS + gx] !== SOIL) {
          ctx.fillStyle = C.soilEdge;
          ctx.fillRect(gx * CELL + 0.5, gy * CELL + 0.5, CELL - 1, 2.5);
        }
      }
    }
  }

  function drawRocks(grid, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    for (let gy = 0; gy < ROWS; gy += 1) {
      for (let gx = 0; gx < COLS; gx += 1) {
        if (grid[gy * COLS + gx] !== ROCK) continue;
        const x = gx * CELL + CELL / 2;
        const y = gy * CELL + CELL / 2;
        ctx.fillStyle = C.rock;
        ctx.fillRect(gx * CELL + 1, gy * CELL + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = C.rockHi;
        ctx.fillRect(gx * CELL + 3, gy * CELL + 3, CELL - 6, 3);
        // 外发光
        ctx.strokeStyle = `rgba(255,45,120,${0.35 + pulse * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gx * CELL + 0.5, gy * CELL + 0.5, CELL - 1, CELL - 1);
      }
    }
  }

  function drawGems(gems, time) {
    const tw = 0.6 + 0.4 * Math.sin(time * 4);
    for (const g of gems) {
      if (g.collected) continue;
      const { x, y } = g;
      ctx.save();
      ctx.translate(x, y);
      // 光晕
      ctx.fillStyle = `rgba(255,210,62,${0.14 * tw + 0.06})`;
      ctx.beginPath();
      ctx.arc(0, 0, GEM_R * 1.7, 0, Math.PI * 2);
      ctx.fill();
      // 菱形
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = C.gem;
      ctx.fillRect(-GEM_R * 0.7, -GEM_R * 0.7, GEM_R * 1.4, GEM_R * 1.4);
      ctx.fillStyle = C.gemHi;
      ctx.fillRect(-GEM_R * 0.35, -GEM_R * 0.7, GEM_R * 0.7, GEM_R * 0.5);
      ctx.restore();
    }
  }

  function drawGoal(state, time) {
    const { goalX, goalY } = state.level;
    const pulse = 0.6 + 0.4 * Math.sin(time * 2.4);
    ctx.save();
    ctx.translate(goalX, goalY);
    // 外环
    ctx.strokeStyle = `rgba(43,255,158,${0.35 + pulse * 0.3})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, GOAL_R * (0.7 + pulse * 0.12), 0, Math.PI * 2);
    ctx.stroke();
    // 内填充（暗绿，可读为「终点洞」）
    ctx.fillStyle = 'rgba(15,122,85,0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, GOAL_R * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.goal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, GOAL_R * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawOrb(state, time) {
    const o = state.orb;
    const { x, y } = o;
    // 外光晕
    const glow = ctx.createRadialGradient(x, y, ORB.R * 0.5, x, y, ORB.R * 2.2);
    glow.addColorStop(0, 'rgba(0,200,255,0.35)');
    glow.addColorStop(1, 'rgba(0,200,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, ORB.R * 2.2, 0, Math.PI * 2);
    ctx.fill();
    // 本体
    const body = ctx.createRadialGradient(x - ORB.R * 0.35, y - ORB.R * 0.35, 2, x, y, ORB.R);
    body.addColorStop(0, C.orbCore);
    body.addColorStop(0.4, C.orb);
    body.addColorStop(1, C.orbGlow);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, ORB.R, 0, Math.PI * 2);
    ctx.fill();
    // 白色描边，让钻核在暗色背景上更清晰
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, ORB.R, 0, Math.PI * 2);
    ctx.stroke();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x - ORB.R * 0.32, y - ORB.R * 0.36, ORB.R * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = 1 - p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function render(state, dt, time) {
    updateParticles(dt || 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    if (!state) return;
    drawSoil(state.grid);
    drawRocks(state.grid, time);
    drawGems(state.gems, time);
    drawGoal(state, time);
    drawOrb(state, time);
    drawParticles();
  }

  resize();
  return { render, burst, resize, particles };
}
