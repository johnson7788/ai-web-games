// Canvas 2D 渲染：路径 + 塔位 + 塔 + 敌人(血条) + 弹道 + 爆炸/击杀粒子。
// 美术件（背景/塔/敌人/要塞门）走 assets/ 精灵，玩法层（路径/塔位/高亮/血条/弹道/粒子）保持程序化。
import { WORLD, COLORS, TOWERS } from '../../config/game.config.js';
import { PATH, SPOTS, PATH_LENGTH, pointAt } from '../../config/map.js';
import { enemyPos, towerStats } from '../game/sim.js';
import { getArt, artMeta } from './art.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const towerById = Object.fromEntries(TOWERS.map((t) => [t.id, t]));

const TOWER_H = 80;    // 塔精灵统一高（底对齐塔位）
const GATE_H = 96;     // 要塞门精灵高
const towerKey = (type) => (type === 'arrow' ? 'towerArrow' : type === 'cannon' ? 'towerCannon' : 'towerFrost');
const enemyKey = (type) => (type === 'grunt' ? 'enemyGrunt' : type === 'runner' ? 'enemyRunner' : 'enemyBrute');

// 按 manifest 的 w/h/pivot 画精灵（bottom 脚底对齐、center 中心对齐）；素材缺失画带名占位色块。
function drawSprite(ctx, key, x, y, h) {
  const meta = artMeta(key);
  if (!meta) return;
  const dh = h ?? meta.h;
  const dw = meta.w * (dh / meta.h);
  const dx = x - dw / 2;
  const dy = meta.pivot === 'bottom' ? y - dh : y - dh / 2;
  const img = getArt(key);
  if (img) {
    ctx.drawImage(img, dx, dy, dw, dh);
    return;
  }
  ctx.fillStyle = meta.color;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(dx, dy, dw, dh);
  ctx.fillStyle = '#160f1e';
  ctx.font = `700 ${Math.max(8, Math.min(12, dw / 3.5))}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(meta.label, x, dy + dh / 2);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];
  const rings = [];

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 160;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.3, t: 0, color, size: 3 + Math.random() * 3 });
    }
  }
  function splash(x, y, r) { rings.push({ x, y, r, t: 0, life: 0.35 }); }
  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      rings[i].t += dt;
      if (rings[i].t >= rings[i].life) rings.splice(i, 1);
    }
  }

  function drawBackground() {
    const bg = getArt('bg');
    if (bg) {
      ctx.drawImage(bg, 0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      return;
    }
    // 占位：程序化渐变（素材未到位）
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(640, 300, 60, 640, 360, 900);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawPath() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.pathEdge;
    ctx.lineWidth = 56;
    ctx.beginPath();
    PATH.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.stroke();
    ctx.strokeStyle = COLORS.path;
    ctx.lineWidth = 46;
    ctx.stroke();
    // 终点要塞门：贴在路径终点稍内侧，脚底对齐路径
    const gate = pointAt(PATH_LENGTH - 100);
    drawSprite(ctx, 'gate', gate.x, gate.y, GATE_H);
  }

  function drawSpots(run, view) {
    SPOTS.forEach((s, i) => {
      const occupied = run.towers.some((t) => t.spotIndex === i);
      if (occupied) return;
      ctx.fillStyle = COLORS.spot;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = view.selectedType ? COLORS.accent : COLORS.spotEdge;
      ctx.lineWidth = view.selectedType ? 3 : 2;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawTower(t, selected) {
    const stats = towerStats(t);
    if (selected) {
      ctx.fillStyle = 'rgba(192,132,252,0.1)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, stats.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(192,132,252,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    drawSprite(ctx, towerKey(t.type), t.x, t.y, TOWER_H);
    // 等级点（程序化，保留）
    for (let lv = 0; lv < t.level; lv += 1) {
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(t.x - 12 + lv * 12, t.y + 30, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEnemies(run) {
    for (const e of run.enemies) {
      const p = enemyPos(e);
      const sh = e.r * 3;
      const meta = artMeta(enemyKey(e.type));
      const sw = meta ? meta.w * (sh / meta.h) : sh;
      drawSprite(ctx, enemyKey(e.type), p.x, p.y, sh);
      if (e.slow > 0) {
        // 减速冰环：画在脚下（程序化，保留）
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, Math.max(e.r, sw * 0.4), Math.max(e.r * 0.5, sw * 0.2), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 血条（程序化，保留）—— 贴精灵头顶
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x - sw / 2, p.y - sh - 6, sw, 4);
      ctx.fillStyle = frac > 0.4 ? COLORS.good : COLORS.danger;
      ctx.fillRect(p.x - sw / 2, p.y - sh - 6, sw * frac, 4);
    }
  }

  function drawProjectiles(run) {
    for (const p of run.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.splash > 0 ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBuildPreview(run, view) {
    if (!view.selectedType || view.hoverSpot == null) return;
    if (run.towers.some((t) => t.spotIndex === view.hoverSpot)) return;
    const s = SPOTS[view.hoverSpot];
    const base = towerById[view.selectedType];
    ctx.fillStyle = 'rgba(192,132,252,0.08)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, base.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(192,132,252,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawSprite(ctx, towerKey(view.selectedType), s.x, s.y, TOWER_H);
    ctx.restore();
  }

  function drawEffects() {
    for (const r of rings) {
      const k = r.t / r.life;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (0.4 + k * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function render(view) {
    const { run } = view;
    drawBackground();
    if (run) {
      drawPath();
      drawSpots(run, view);
      drawBuildPreview(run, view);
      for (const t of run.towers) drawTower(t, t.id === view.selectedTower);
      drawEnemies(run);
      drawProjectiles(run);
    }
    drawEffects();
  }

  function clearEffects() { particles.length = 0; rings.length = 0; }

  return { render, update, burst, splash, clearEffects };
}