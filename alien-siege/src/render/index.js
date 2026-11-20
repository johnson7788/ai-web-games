// src/render/index.js — ALIEN SIEGE · 伪 3D 光线投射渲染（Canvas 2D，零依赖）。
// 每列一条 DDA 射线 → 墙面竖条；敌人作为 billboard 竖条，按列与 zbuffer 做深度测试。
import { WORLD } from '../../config/game.config.js';
import { ENEMIES, FX, clamp } from '../../config/gameplay.js';
import { THEMES } from './theme.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const N_SHADES = 48;
const TAN_FOV = Math.tan(WORLD.FOV);

const ENEMY_COLORS = {
  crawler:  { body: '#ff4f9a', head: '#ff86bd', core: '#ffffff' },
  floater:  { body: '#35e0c0', head: '#82ffe6', core: '#eaffff' },
  behemoth: { body: '#e0483f', head: '#ff7a55', core: '#ffd9a0' },
  nest:     { body: '#8a4fff', head: '#c08bff', core: '#ffe0ff' },
};

function mixc(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgb(arr) {
  return `rgb(${arr[0]},${arr[1]},${arr[2]})`;
}

function buildShades(theme) {
  const top = [];
  const side = [];
  for (let i = 0; i < N_SHADES; i += 1) {
    const t = i / (N_SHADES - 1);
    top.push(rgb(mixc(theme.wallTop, theme.fog, t)));
    side.push(rgb(mixc(theme.wallSide, theme.fog, t)));
  }
  return { top, side };
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  const zbuf = new Float32Array(W);
  const themes = THEMES.map((t) => ({
    ...t,
    shades: buildShades(t),
    skyGrad: null,
    floorGrad: null,
  }));

  let cam = { px: 0, py: 0, dirX: 1, dirY: 0, planeX: 0, planeY: TAN_FOV };
  let splat = 0;       // 紫浆全屏强度 0..1
  let muzzle = 0;      // 枪口焰强度
  let particles = [];
  let starSeed = 1;

  function themeFor(run) {
    const idx = (run && run.scene ? run.scene : 1) - 1;
    return themes[clamp(idx, 0, 2)];
  }

  function drawSkyAndFloor(t) {
    const sky = ctx.createLinearGradient(0, 0, 0, H / 2);
    sky.addColorStop(0, t.ceiling);
    sky.addColorStop(1, rgb(t.fog));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H / 2 + 1);

    const fl = ctx.createLinearGradient(0, H / 2, 0, H);
    fl.addColorStop(0, rgb(t.fog));
    fl.addColorStop(1, t.floor);
    ctx.fillStyle = fl;
    ctx.fillRect(0, H / 2, W, H / 2);

    if (t.decor === 'stars') {
      // 夜空港：上半屏散落星点（确定性伪随机）
      ctx.fillStyle = 'rgba(180,210,255,0.7)';
      let s = starSeed;
      for (let i = 0; i < 60; i += 1) {
        s = (s * 9301 + 49297) % 233280;
        const x = (s / 233280) * W;
        s = (s * 9301 + 49297) % 233280;
        const y = (s / 233280) * (H / 2);
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  function drawWalls(run, t) {
    const p = run.player;
    const dirX = Math.cos(p.angle);
    const dirY = Math.sin(p.angle);
    const planeX = -dirY * TAN_FOV;
    const planeY = dirX * TAN_FOV;
    cam = { px: p.x, py: p.y, dirX, dirY, planeX, planeY };

    for (let x = 0; x < W; x += 1) {
      const cameraX = (2 * x) / W - 1;
      const rdx = dirX + planeX * cameraX;
      const rdy = dirY + planeY * cameraX;
      const hit = raycastGrid(run.map, p.x, p.y, rdx, rdy);
      const dist = Math.max(0.02, hit.dist);
      zbuf[x] = dist;
      const lineH = H / dist;
      const y0 = H / 2 - lineH / 2;
      const shade = Math.min(N_SHADES - 1, Math.floor(dist * 0.75));
      ctx.fillStyle = hit.side === 0 ? t.shades.side[shade] : t.shades.top[shade];
      ctx.fillRect(x, y0, 1, lineH);

      // 装饰：墙上霓虹/网格高光条
      if (t.decor === 'neon' && hit.hit && (hit.mapX + hit.mapY) % 4 === 0 && lineH > 24) {
        ctx.fillStyle = 'rgba(180,122,255,0.35)';
        ctx.fillRect(x, y0 + lineH * 0.28, 1, Math.max(2, lineH * 0.06));
      } else if (t.decor === 'grid' && hit.hit && (hit.mapX + hit.mapY) % 3 === 0 && lineH > 20) {
        ctx.fillStyle = 'rgba(84,255,216,0.28)';
        ctx.fillRect(x, y0 + lineH * 0.5, 1, Math.max(2, lineH * 0.05));
      }
    }
  }

  function darken(hex, f = 0.55) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f);
    const g = Math.round(((n >> 8) & 255) * f);
    const b = Math.round((n & 255) * f);
    return `rgb(${r},${g},${b})`;
  }

  function drawSprites(run) {
    const p = run.player;
    const sprites = run.enemies
      .map((e) => {
        const relX = e.x - p.x;
        const relY = e.y - p.y;
        const invDet = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY);
        const tx = invDet * (cam.dirY * relX - cam.dirX * relY);
        const ty = invDet * (-cam.planeY * relX + cam.planeX * relY);
        return { e, tx, ty };
      })
      .filter((s) => s.ty > 0.05)
      .sort((a, b) => b.ty - a.ty); // 远→近

    for (const s of sprites) {
      const e = s.e;
      const colors = ENEMY_COLORS[e.type] || ENEMY_COLORS.crawler;
      const screenX = (W / 2) * (1 + s.tx / s.ty);
      const bob = e.drift ? Math.sin(run.time * 1.7 + (e.driftPhase || 0)) * (H / s.ty) * 0.12 : 0;
      const spriteH = (H / s.ty) * e.radius * 3.4;
      const spriteW = spriteH * (e.type === 'behemoth' ? 1.05 : e.type === 'nest' ? 1.25 : 0.8);
      const yTop = H / 2 - spriteH / 2 + bob;
      const x0 = Math.floor(screenX - spriteW / 2);
      const x1 = Math.ceil(screenX + spriteW / 2);
      const headH = spriteH * 0.22;
      const legH = e.type === 'floater' ? 0 : spriteH * 0.16;
      const darkBody = darken(colors.body, 0.5);

      for (let cx = x0; cx <= x1; cx += 1) {
        if (cx < 0 || cx >= W) continue;
        if (s.ty >= zbuf[cx]) continue;
        const fx = (cx - x0) / Math.max(1, x1 - x0);
        // 头冠（亮）
        ctx.fillStyle = colors.head;
        ctx.fillRect(cx, yTop, 1, headH);
        // 躯干（左右两侧略暗，中间亮）
        ctx.fillStyle = (fx < 0.2 || fx > 0.8) ? darkBody : colors.body;
        ctx.fillRect(cx, yTop + headH, 1, spriteH - headH - legH);
        // 腿部（爬行/巨兽/母巢有，浮游者无）
        if (legH > 0) {
          ctx.fillStyle = darkBody;
          ctx.fillRect(cx, yTop + spriteH - legH, 1, legH);
        }
      }

      // 躯干描边（暗色轮廓，提升剪影可辨度）
      ctx.strokeStyle = 'rgba(10,6,14,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, yTop, Math.max(1, x1 - x0), spriteH);

      // 发光核心眼（外光晕 + 内瞳）
      const coreX = screenX;
      const coreY = H / 2 + bob - spriteH * 0.06;
      const coreR = Math.max(4, spriteH * 0.13);
      const glow = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR * 2.6);
      glow.addColorStop(0, e.marked ? '#ffe14a' : colors.core);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(coreX - coreR * 2.6, coreY - coreR * 2.6, coreR * 5.2, coreR * 5.2);
      ctx.fillStyle = e.marked ? '#ffe14a' : '#ffffff';
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#120a16';
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreR * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // 标记：黄色三角 + 光环
      if (e.marked) {
        const mx = screenX;
        const my = yTop - 10;
        ctx.fillStyle = '#ffe14a';
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx - 8, my - 14);
        ctx.lineTo(mx + 8, my - 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,225,74,0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 - 3, yTop - 3, Math.max(1, x1 - x0) + 6, spriteH + 6);
      }
    }
  }

  function drawGun(run) {
    const gx = W / 2;
    const gy = H - 12;
    // 枪体（大轮廓）
    ctx.fillStyle = '#1c1c28';
    ctx.beginPath();
    ctx.moveTo(gx - 74, H);
    ctx.lineTo(gx - 42, gy - 54);
    ctx.lineTo(gx + 42, gy - 54);
    ctx.lineTo(gx + 74, H);
    ctx.closePath();
    ctx.fill();
    // 枪管（指向准星）
    ctx.fillStyle = '#101018';
    ctx.fillRect(gx - 13, gy - 100, 26, 50);
    // 准星尖端
    ctx.fillStyle = '#2c2c3a';
    ctx.fillRect(gx - 6, gy - 108, 12, 12);
    // 武器色条
    ctx.fillStyle = themeFor(run).accent;
    ctx.fillRect(gx - 40, gy - 48, 80, 6);
    // 侧护木高光
    ctx.fillStyle = '#33334a';
    ctx.fillRect(gx - 48, gy - 40, 96, 8);

    if (muzzle > 0) {
      const m = muzzle;
      ctx.fillStyle = `rgba(255,220,140,${(m * 0.9).toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(gx - 14, gy - 100);
      ctx.lineTo(gx - 32, gy - 128);
      ctx.lineTo(gx, gy - 116);
      ctx.lineTo(gx + 32, gy - 128);
      ctx.lineTo(gx + 14, gy - 100);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCrosshair(run) {
    const ready = run && run.player ? run.player.markCooldown <= 0 : true;
    const col = ready ? '#ffe14a' : 'rgba(255,255,255,0.85)';
    const cx = W / 2;
    const cy = H / 2;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 10);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles() {
    const alive = [];
    for (const pt of particles) {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= 1;
      if (pt.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      ctx.globalAlpha = 1;
      alive.push(pt);
    }
    particles = alive;
  }

  function drawSplatOverlay() {
    if (splat <= 0) return;
    const a = clamp(splat, 0, 1);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(120,20,180,0)');
    g.addColorStop(1, `rgba(120,20,180,${(a * 0.5).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawShield(run) {
    if (!run || !run.player || !run.player.shieldActive) return;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.7);
    g.addColorStop(0, 'rgba(84,255,216,0)');
    g.addColorStop(1, 'rgba(84,255,216,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(84,255,216,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, W - 40, H - 40);
  }

  function draw(run, alpha = 1) {
    const t = themeFor(run);
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    ctx.save();
    if (run && run.player && !reduce) {
      const sh = run.player.shake || 0;
      if (sh > 0.01) {
        ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
      }
    }

    drawSkyAndFloor(t);
    if (run && run.player) {
      drawWalls(run, t);
      drawSprites(run);
      drawGun(run);
      drawShield(run);
      drawParticles();
      drawSplatOverlay();
      drawCrosshair(run);
    }

    ctx.restore();

    // 衰减
    splat = Math.max(0, splat - 0.028);
    muzzle = Math.max(0, muzzle - 0.16);
  }

  function burst(x, y, kind) {
    const colors = kind === 'splat' ? ['#c24bff', '#9b2fd6', '#ff6ae0'] : kind === 'kill' ? ['#ffd24a', '#ff8a3d'] : ['#b47aff', '#7fffe8'];
    const n = kind === 'splat' ? 42 : kind === 'kill' ? 18 : 8;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 4;
      particles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 18 + Math.random() * 18,
        maxLife: 36,
        size: 2 + Math.random() * 3,
        color: colors[i % colors.length],
      });
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }

  function splatBurst() {
    splat = 1;
    burst(W / 2, H / 2, 'splat');
  }

  function muzzleFlash() {
    muzzle = 1;
  }

  // 世界坐标 → 屏幕坐标 → 粒子
  function burstWorld(wx, wy, kind) {
    const relX = wx - cam.px;
    const relY = wy - cam.py;
    const invDet = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY);
    const ty = invDet * (-cam.planeY * relX + cam.planeX * relY);
    if (ty <= 0.05) return;
    const tx = invDet * (cam.dirY * relX - cam.dirX * relY);
    const sx = (W / 2) * (1 + tx / ty);
    const sy = H / 2;
    burst(sx, sy, kind);
  }

  return { draw, burst, burstWorld, splatBurst, muzzleFlash };
}

// 本地 DDA（与 sim 共用 map.js 的 raycast 逻辑；这里内联一版避免额外 import 层）
function raycastGrid(grid, px, py, dx, dy, maxDist = 64) {
  let mapX = Math.floor(px);
  let mapY = Math.floor(py);
  const deltaX = Math.abs(1 / (dx === 0 ? 1e-9 : dx));
  const deltaY = Math.abs(1 / (dy === 0 ? 1e-9 : dy));
  let stepX; let stepY; let sideDistX; let sideDistY;
  if (dx < 0) { stepX = -1; sideDistX = (px - mapX) * deltaX; }
  else { stepX = 1; sideDistX = (mapX + 1 - px) * deltaX; }
  if (dy < 0) { stepY = -1; sideDistY = (py - mapY) * deltaY; }
  else { stepY = 1; sideDistY = (mapY + 1 - py) * deltaY; }

  let side = 0;
  for (let i = 0; i < 256; i += 1) {
    if (sideDistX < sideDistY) { sideDistX += deltaX; mapX += stepX; side = 0; }
    else { sideDistY += deltaY; mapY += stepY; side = 1; }
    if (mapX < 0 || mapY < 0 || mapX >= grid[0].length || mapY >= grid.length) return { dist: maxDist, side, mapX, mapY, hit: false };
    if (grid[mapY][mapX] === 1) {
      let dist;
      if (side === 0) dist = Math.abs((mapX - px + (1 - stepX) / 2) / (dx || 1e-9));
      else dist = Math.abs((mapY - py + (1 - stepY) / 2) / (dy || 1e-9));
      return { dist: Math.min(dist, maxDist), side, mapX, mapY, hit: true };
    }
  }
  return { dist: maxDist, side, mapX, mapY, hit: false };
}
