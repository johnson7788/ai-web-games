// Canvas 2D 软件 3D 体素渲染：面投影 + 画家算法 + 雾效。第一人称。
import { WORLD, SX, SY, SZ, BLOCKS, HOTBAR, PLAYER, RENDER, COLORS } from '../../config/game.config.js';
import { getBlock, raycast } from '../game/sim.js';
import { t } from '../core/i18n.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const CX = WORLD.WIDTH / 2, CY = WORLD.HEIGHT / 2;
const FOCAL = (WORLD.HEIGHT / 2) / Math.tan((RENDER.FOV * Math.PI / 180) / 2);
const NEAR = 0.12;

// 6 个面：法线 + 4 角（单位方块偏移）+ 亮度
const FACES = [
  { n: [0, 1, 0], c: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]], s: 1.0, k: 'top' },
  { n: [0, -1, 0], c: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]], s: 0.5, k: 'bottom' },
  { n: [0, 0, -1], c: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], s: 0.8, k: 'side' },
  { n: [0, 0, 1], c: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]], s: 0.8, k: 'side' },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]], s: 0.66, k: 'side' },
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], s: 0.66, k: 'side' },
];

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const BLOCK_RGB = {};
for (const id in BLOCKS) {
  const b = BLOCKS[id];
  if (!b.top) continue;
  BLOCK_RGB[id] = { top: hexRgb(b.top), side: hexRgb(b.side), bottom: hexRgb(b.bottom) };
}
const FOG_RGB = hexRgb(RENDER.FOG);

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function clearEffects() {}
  function update() {}

  function drawSky(p) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#5ab0d8'); g.addColorStop(0.6, COLORS.sky); g.addColorStop(1, COLORS.fog);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 太阳（随 yaw 移动）
    const sx = CX - Math.sin(p.yaw) * 600;
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.arc(sx, 120 - p.pitch * 300, 40, 0, Math.PI * 2); ctx.fill();
  }

  function render({ run }) {
    if (!run) return;
    const p = run.player;
    drawSky(p);
    const camX = p.x, camY = p.y + PLAYER.EYE, camZ = p.z;
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
    const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
    const D = RENDER.DIST;
    const x0 = Math.max(0, Math.floor(camX - D)), x1 = Math.min(SX - 1, Math.ceil(camX + D));
    const z0 = Math.max(0, Math.floor(camZ - D)), z1 = Math.min(SZ - 1, Math.ceil(camZ + D));
    const y0 = Math.max(0, Math.floor(camY - D)), y1 = Math.min(SY - 1, Math.ceil(camY + D));

    const faces = [];
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const id = run.world[x + SX * (z + SZ * y)];
          if (id === 0) continue;
          const rgb = BLOCK_RGB[id];
          for (const f of FACES) {
            const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
            if (getBlock(run, nx, ny, nz) !== 0) continue;
            // 背面剔除
            const fcx = x + 0.5 + f.n[0] * 0.5, fcy = y + 0.5 + f.n[1] * 0.5, fcz = z + 0.5 + f.n[2] * 0.5;
            if (f.n[0] * (camX - fcx) + f.n[1] * (camY - fcy) + f.n[2] * (camZ - fcz) <= 0) continue;
            // 投影 4 角
            const pts = [];
            let depth = 0, ok = true;
            for (const c of f.c) {
              const dx = x + c[0] - camX, dy = y + c[1] - camY, dz = z + c[2] - camZ;
              const vx = dx * cy + dz * sy;
              const vz = dx * sy - dz * cy;
              const vy = dy;
              const y2 = vy * cp - vz * sp;
              const z2 = vy * sp + vz * cp;
              if (z2 <= NEAR) { ok = false; break; }
              pts.push(CX + (vx / z2) * FOCAL, CY - (y2 / z2) * FOCAL);
              depth += z2;
            }
            if (!ok) continue;
            depth /= 4;
            if (depth > D + 2) continue;
            faces.push({ pts, depth, rgb: rgb[f.k], s: f.s });
          }
        }

    faces.sort((a, b) => b.depth - a.depth);
    for (const f of faces) {
      const fog = Math.min(0.85, Math.max(0, (f.depth - D * 0.45) / (D * 0.7)));
      const sh = f.s;
      const r = Math.round((f.rgb[0] * sh) * (1 - fog) + FOG_RGB[0] * fog);
      const g = Math.round((f.rgb[1] * sh) * (1 - fog) + FOG_RGB[1] * fog);
      const b = Math.round((f.rgb[2] * sh) * (1 - fog) + FOG_RGB[2] * fog);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(f.pts[0], f.pts[1]);
      ctx.lineTo(f.pts[2], f.pts[3]);
      ctx.lineTo(f.pts[4], f.pts[5]);
      ctx.lineTo(f.pts[6], f.pts[7]);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(0,0,0,${0.12 * (1 - fog)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    drawTarget(run);
    drawHud(run);
    drawCrosshair();
  }

  function drawTarget(run) {
    const target = raycast(run);
    if (!target) return;
    const { x, y, z } = target.hit;
    const p = run.player;
    const camX = p.x, camY = p.y + PLAYER.EYE, camZ = p.z;
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
    const corners = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]];
    const pr = corners.map((c) => {
      const dx = x + c[0] - camX, dy = y + c[1] - camY, dz = z + c[2] - camZ;
      const vx = dx * cy + dz * sy, vz = dx * sy - dz * cy, vy = dy;
      const y2 = vy * cp - vz * sp, z2 = vy * sp + vz * cp;
      if (z2 <= NEAR) return null;
      return [CX + (vx / z2) * FOCAL, CY - (y2 / z2) * FOCAL];
    });
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    for (const [a, b] of edges) {
      if (!pr[a] || !pr[b]) continue;
      ctx.beginPath(); ctx.moveTo(pr[a][0], pr[a][1]); ctx.lineTo(pr[b][0], pr[b][1]); ctx.stroke();
    }
  }

  function drawCrosshair() {
    ctx.strokeStyle = COLORS.crosshair; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CX - 12, CY); ctx.lineTo(CX - 4, CY);
    ctx.moveTo(CX + 4, CY); ctx.lineTo(CX + 12, CY);
    ctx.moveTo(CX, CY - 12); ctx.lineTo(CX, CY - 4);
    ctx.moveTo(CX, CY + 4); ctx.lineTo(CX, CY + 12);
    ctx.stroke();
  }

  function drawHud(run) {
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(12, 12, 280, 36);
    ctx.textAlign = 'left';
    ctx.font = `bold 13px ${FONT}`; ctx.fillStyle = '#fff';
    ctx.fillText(`${t('mined')}: ${run.mined}   ${t('placed')}: ${run.placed}`, 24, 30);
    // 快捷栏
    const n = HOTBAR.length, sw = 56, gap = 6, total = n * sw + (n - 1) * gap;
    let x = (WORLD.WIDTH - total) / 2;
    const y = WORLD.HEIGHT - sw - 14;
    for (let i = 0; i < n; i++) {
      const id = HOTBAR[i];
      const sel = i === run.selected;
      ctx.fillStyle = sel ? 'rgba(251,191,36,0.25)' : 'rgba(8,12,26,0.72)';
      ctx.fillRect(x, y, sw, sw);
      ctx.strokeStyle = sel ? COLORS.select : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = sel ? 3 : 1.5;
      ctx.strokeRect(x, y, sw, sw);
      ctx.fillStyle = BLOCKS[id].side;
      ctx.fillRect(x + 14, y + 12, 28, 28);
      ctx.fillStyle = BLOCKS[id].top;
      ctx.fillRect(x + 14, y + 12, 28, 8);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(x + 14, y + 12, 28, 28);
      ctx.fillStyle = '#fff'; ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'right';
      ctx.fillText(String(run.inventory[id] || 0), x + sw - 5, y + sw - 9);
      ctx.textAlign = 'left'; ctx.font = `bold 9px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(String(i + 1), x + 4, y + 9);
      x += sw + gap;
    }
  }

  return { render, update, clearEffects };
}