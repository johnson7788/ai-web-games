// ARCHER MISS 3D · Canvas 2D 渲染（低多边形扁平霓虹风，程序化绘制，零素材）
import { WORLD } from '../../config/game.config.js';

const TAU = Math.PI * 2;
const SCALE = 30;               // 世界单位 → 像素
const CX = WORLD.WIDTH / 2;     // 竞技场中心（屏幕）
const CY = 396;

function sx(x) { return CX + x * SCALE; }
function sy(y) { return CY + y * SCALE; }

function poly(ctx, x, y, r, sides, rot, fill, stroke, lw = 2) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rot + (i / sides) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0a0a1e');
    g.addColorStop(1, '#141432');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 网格地板
    ctx.strokeStyle = 'rgba(90, 100, 200, 0.10)';
    ctx.lineWidth = 1;
    for (let x = -WORLD.ARENA_R; x <= WORLD.ARENA_R; x += 2) {
      ctx.beginPath(); ctx.moveTo(sx(x), sy(-WORLD.ARENA_R)); ctx.lineTo(sx(x), sy(WORLD.ARENA_R)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx(-WORLD.ARENA_R), sy(x)); ctx.lineTo(sx(WORLD.ARENA_R), sy(x)); ctx.stroke();
    }

    // 竞技场边界
    ctx.beginPath();
    ctx.arc(CX, CY, WORLD.ARENA_R * SCALE, 0, TAU);
    ctx.strokeStyle = 'rgba(120, 140, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CX, CY, WORLD.ARENA_R * SCALE - 6, 0, TAU);
    ctx.strokeStyle = 'rgba(120, 140, 255, 0.15)';
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  function drawShadow(x, y, r) {
    ctx.beginPath();
    ctx.ellipse(sx(x), sy(y) + r * SCALE * 0.35, r * SCALE * 0.9, r * SCALE * 0.4, 0, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
  }

  function drawRock(rock) {
    const x = sx(rock.x); const y = sy(rock.y);
    const r = rock.r * SCALE;
    drawShadow(rock.x, rock.y, rock.r);
    // 低多边形晶体
    poly(ctx, x, y - r * 0.15, r, 6, 0.2, '#3a3a5c', '#8a8ac0', 3);
    poly(ctx, x, y - r * 0.15, r * 0.6, 6, 0.2, '#4a4a74', null, 0);
    ctx.beginPath(); ctx.moveTo(x - r * 0.25, y + r * 0.1); ctx.lineTo(x + r * 0.2, y + r * 0.15); ctx.lineTo(x, y + r * 0.5); ctx.closePath();
    ctx.fillStyle = '#2e2e4c'; ctx.fill();
  }

  function drawPlayer(p, time) {
    const x = sx(p.x); const y = sy(p.y);
    const r = WORLD.PLAYER_R * SCALE * 1.6;
    drawShadow(p.x, p.y, WORLD.PLAYER_R);
    // 瞄准线
    if (!p.moving || p.aimLock) {
      const ax = x + Math.cos(p.angle) * (r + 14);
      const ay = y + Math.sin(p.angle) * (r + 14);
      ctx.strokeStyle = 'rgba(80, 255, 220, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.setLineDash([]);
    }
    // 弓（朝瞄准方向的圆弧）
    const glow = 0.6 + Math.sin(time * 6) * 0.2;
    ctx.beginPath();
    ctx.arc(x, y, r + 8, p.angle - 0.9, p.angle + 0.9);
    ctx.strokeStyle = `rgba(140, 255, 230, ${glow})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    // 身体（最亮、最粗 → silhouette）
    poly(ctx, x, y, r, 6, p.angle + 0.5, '#17e0c8', '#ffffff', 3);
    ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, TAU); ctx.fillStyle = '#eaffff'; ctx.fill();
  }

  function drawMonster(m, time) {
    const x = sx(m.x); const y = sy(m.y);
    const r = WORLD.MONSTER_R * SCALE * 1.5;
    drawShadow(m.x, m.y, WORLD.MONSTER_R);
    const isCaster = m.type === 'caster';
    if (m.burning > 0) { ctx.beginPath(); ctx.arc(x, y, r + 5, 0, TAU); ctx.fillStyle = 'rgba(255,120,40,0.35)'; ctx.fill(); }
    if (isCaster) {
      // 施法者：橙色圆 + 内环
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#ff8a3d'; ctx.fill();
      ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.fillStyle = '#ffe0c0'; ctx.fill();
    } else {
      // 近战碎片：玫红尖刺
      const sides = 8;
      ctx.beginPath();
      for (let i = 0; i < sides * 2; i += 1) {
        const a = m.angle + (i / (sides * 2)) * TAU;
        const rr = i % 2 === 0 ? r : r * 0.55;
        const px = x + Math.cos(a) * rr; const py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#ff4f9a'; ctx.fill();
      ctx.strokeStyle = '#ffb3d4'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    }
    // 目标标记「!」
    const bounce = Math.sin(time * 8 + m.id) * 3;
    const ty = y - r - 12 + bounce;
    ctx.beginPath(); ctx.arc(x, ty, 8, 0, TAU); ctx.fillStyle = '#ff2d55'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', x, ty + 1);
    // 血条
    const hpW = r * 1.6;
    const hpr = Math.max(0, m.hp / m.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - hpW / 2, y - r - 6, hpW, 4);
    ctx.fillStyle = hpr > 0.5 ? '#7dff6a' : hpr > 0.25 ? '#ffd23f' : '#ff4f6a';
    ctx.fillRect(x - hpW / 2, y - r - 6, hpW * hpr, 4);
  }

  function drawArrow(a) {
    const x = sx(a.x); const y = sy(a.y);
    const ang = Math.atan2(a.vy, a.vx);
    // 拖尾
    const tx = x - Math.cos(ang) * 12; const ty = y - Math.sin(ang) * 12;
    ctx.strokeStyle = 'rgba(255, 240, 140, 0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    // 箭尖
    ctx.strokeStyle = '#fff8d0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * 7, y - Math.sin(ang) * 7); ctx.stroke();
  }

  function drawProjectile(pr) {
    const x = sx(pr.x); const y = sy(pr.y);
    ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU);
    ctx.fillStyle = '#ff5a3d'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU);
    ctx.fillStyle = 'rgba(255,90,61,0.25)'; ctx.fill();
  }

  function drawWarning(w) {
    const x = sx(w.x); const y = sy(w.y);
    const p = 1 - Math.max(0, w.t) / 0.9;
    ctx.beginPath(); ctx.arc(x, y, w.r * SCALE, 0, TAU);
    ctx.fillStyle = `rgba(255,40,70,${0.15 + p * 0.25})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,80,100,${0.5 + p * 0.4})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawPowerup(pu, time) {
    const x = sx(pu.x); const y = sy(pu.y) + Math.sin(time * 6 + pu.x) * 3;
    const r = pu.r * SCALE;
    const col = pu.kind === 'rapid' ? '#7dff6a' : '#ff6ad5';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    poly(ctx, x, y, r * 0.8, 4, time * 2, col, '#fff', 2);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pu.kind === 'rapid' ? '»' : '+', x, y + 1);
  }

  return {
    render(state, time = 0) {
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      drawBackground(time);
      if (!state) return;
      for (const rock of state.rocks) drawRock(rock);
      for (const pu of state.powerups) drawPowerup(pu, time);
      for (const w of state.warnings) drawWarning(w);
      for (const pr of state.projectiles) drawProjectile(pr);
      for (const m of state.monsters) drawMonster(m, time);
      if (state.player && state.player.alive) drawPlayer(state.player, time);
      for (const a of state.arrows) drawArrow(a);
    },
  };
}
