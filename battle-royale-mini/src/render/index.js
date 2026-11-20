// src/render/index.js — Canvas 2D 渲染：桌面战场 / 玩具兵 / 文具掩体 / 缩圈 / 台灯聚光。
// 契约：createRender(canvas) → { draw(run, alpha), burst(x, y, kind) }
import { WORLD } from '../../config/game.config.js';
import { weaponById, ARENA } from '../../config/gameplay.js';
import { themeFor } from './theme.js';

const AI_COLORS = ['#ff5d5d', '#5da8ff', '#6bff8a', '#ffe14d', '#ff9d3d', '#c88bff', '#4dfff0', '#ff7ad9', '#b08a5a', '#9aa7b0', '#3dffb0', '#c0e84a', '#4a6bff', '#ffd94d', '#d0d0d0'];
const ITEM_COLORS = { weapon: '#ffffff', med: '#7affd0', armor: '#8fd0ff' };

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];

  function theme(run) {
    return themeFor(run ? run.match + 1 : 1);
  }

  function drawBackground(th) {
    ctx.fillStyle = th.floor;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 桌面纹理：交错地板 + 细网格
    ctx.fillStyle = th.grid;
    for (let x = 0; x < WORLD.WIDTH; x += 40) {
      ctx.fillRect(x, 0, 1, WORLD.HEIGHT);
    }
    for (let y = 0; y < WORLD.HEIGHT; y += 40) {
      ctx.fillRect(0, y, WORLD.WIDTH, 1);
    }
    // 桌面边框
    ctx.strokeStyle = th.obstacleEdge;
    ctx.lineWidth = 8;
    ctx.strokeRect(ARENA.minX - 4, ARENA.minY - 4, ARENA.maxX - ARENA.minX + 8, ARENA.maxY - ARENA.minY + 8);
  }

  function drawObstacles(run, th) {
    for (const o of run.obstacles) {
      ctx.fillStyle = th.obstacle;
      ctx.strokeStyle = th.obstacleEdge;
      ctx.lineWidth = 3;
      roundRect(o.x, o.y, o.w, o.h, 6);
      ctx.fill();
      ctx.stroke();
      // 文具高光
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      roundRect(o.x + 5, o.y + 5, o.w - 10, 8, 4);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawGas(run, th) {
    const g = run.gas;
    if (!g) return;
    // 圈外危险遮罩（挖洞）
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.arc(g.cx, g.cy, Math.max(1, g.r), 0, Math.PI * 2, true);
    ctx.fillStyle = th.danger;
    ctx.fill('evenodd');
    ctx.restore();
    // 圈边（虚线亮环，一眼看懂安全区边界）
    ctx.save();
    ctx.strokeStyle = g.state === 'shrink' ? '#ff5a5a' : '#ffffff';
    ctx.lineWidth = g.state === 'shrink' ? 4 : 3;
    ctx.setLineDash([14, 8]);
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, Math.max(1, g.r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // 安全区中心目标点：脉冲环 + 向下箭头 + 文字标签（清晰指明「去哪」）
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    ctx.fillStyle = `rgba(126, 240, 255, ${0.24 + pulse * 0.16})`;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, 30 + pulse * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(126, 240, 255, ${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, 30 + pulse * 10, 0, Math.PI * 2);
    ctx.stroke();
    // 向下箭头（指向目标点）
    ctx.fillStyle = '#9ff2ff';
    ctx.beginPath();
    ctx.moveTo(g.cx, g.cy - 6);
    ctx.lineTo(g.cx - 9, g.cy - 20);
    ctx.lineTo(g.cx + 9, g.cy - 20);
    ctx.closePath();
    ctx.fill();
    ctx.font = '900 16px "Courier New", monospace';
    const label = 'SAFE ZONE';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(10, 8, 4, 0.92)';
    ctx.fillRect(g.cx - tw / 2 - 10, g.cy - 70, tw + 20, 24);
    ctx.strokeStyle = 'rgba(159, 242, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(g.cx - tw / 2 - 10, g.cy - 70, tw + 20, 24);
    ctx.fillStyle = '#eaffff';
    ctx.textAlign = 'center';
    ctx.fillText(label, g.cx, g.cy - 52);
    ctx.textAlign = 'start';
  }

  function drawItems(run, th) {
    for (const it of run.items) {
      if (!it.alive) continue;
      const c = ITEM_COLORS[it.kind] || '#fff';
      if (it.kind === 'weapon') {
        const w = weaponById(it.weaponId);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(it.x, it.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        ctx.stroke();
        // 枪管方向
        const a = (w ? w.id.length : 0) * 1.3;
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(it.x, it.y);
        ctx.lineTo(it.x + Math.cos(a) * 13, it.y + Math.sin(a) * 13);
        ctx.stroke();
      } else if (it.kind === 'med') {
        ctx.fillStyle = c;
        ctx.fillRect(it.x - 7, it.y - 3, 14, 6);
        ctx.fillRect(it.x - 3, it.y - 7, 6, 14);
      } else if (it.kind === 'armor') {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(it.x, it.y - 9);
        ctx.lineTo(it.x + 9, it.y - 4);
        ctx.lineTo(it.x + 9, it.y + 4);
        ctx.lineTo(it.x, it.y + 9);
        ctx.lineTo(it.x - 9, it.y + 4);
        ctx.lineTo(it.x - 9, it.y - 4);
        ctx.closePath();
        ctx.fill();
      }
      // 呼吸光
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300 + it.x);
      ctx.strokeStyle = `rgba(255,255,255,${0.2 * pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(it.x, it.y, 12 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPlayers(run, th) {
    // 先画 AI（垫底），玩家最亮最粗画在最上，保证剪影可辨
    const sorted = [...run.players].sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
    for (const e of sorted) {
      if (!e.alive) continue;
      const color = e.isPlayer ? '#ffffff' : (AI_COLORS[(e.name.charCodeAt(e.name.length - 1) + (e.x | 0)) % AI_COLORS.length] || '#ff5d5d');
      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.r * 0.7, e.r, e.r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // 身体
      ctx.fillStyle = color;
      ctx.strokeStyle = e.isPlayer ? '#ffd94d' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = e.isPlayer ? 4 : 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 枪管（更长更粗，明确「这是持枪玩具兵」）
      ctx.strokeStyle = e.isPlayer ? '#ffd94d' : '#222';
      ctx.lineWidth = e.isPlayer ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.aimAngle) * (e.r + 20), e.y + Math.sin(e.aimAngle) * (e.r + 20));
      ctx.stroke();
      // 玩家：头盔 + 头顶箭头 + YOU 标签，和 AI/拾取物一眼区分
      if (e.isPlayer) {
        ctx.fillStyle = '#ffd94d';
        ctx.beginPath();
        ctx.arc(e.x, e.y - e.r * 0.35, e.r * 0.55, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#ffd94d';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y - e.r - 16);
        ctx.lineTo(e.x - 6, e.y - e.r - 24);
        ctx.lineTo(e.x + 6, e.y - e.r - 24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd94d';
        ctx.font = '900 13px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(10, 8, 4, 0.9)';
        ctx.lineWidth = 3;
        ctx.strokeText('YOU', e.x, e.y + e.r + 18);
        ctx.fillText('YOU', e.x, e.y + e.r + 18);
        ctx.textAlign = 'start';
      }
      // 血条
      const bw = e.r * 2.4;
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 9, bw, 4);
      ctx.fillStyle = frac > 0.5 ? '#7affa0' : frac > 0.25 ? '#ffd94d' : '#ff5d5d';
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 9, bw * frac, 4);
    }
  }

  function drawBullets(run, th) {
    for (const b of run.bullets) {
      ctx.fillStyle = b.ownerIsPlayer ? '#ffd94d' : '#ff8a5a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.explosive ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
      // 拖尾
      ctx.strokeStyle = b.ownerIsPlayer ? 'rgba(255,217,77,0.5)' : 'rgba(255,138,90,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      ctx.stroke();
    }
  }

  function drawSpotlight(run, th) {
    // 决赛圈（最后两圈 / 只剩 2 人）时台灯从天打聚光
    const alive = run.players.filter((p) => p.alive);
    const g = run.gas;
    const final = g && g.phase >= 6;
    if (!final && alive.length > 2) return;
    const cx = g ? g.cx : 640;
    const cy = g ? g.cy : 360;
    const r = (g ? g.r : 200) * 1.1;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(255, 250, 210, 0.0)');
    grad.addColorStop(0.75, 'rgba(255, 240, 180, 0.05)');
    grad.addColorStop(1, 'rgba(255, 240, 180, 0.18)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // 光锥
    ctx.strokeStyle = 'rgba(255, 246, 200, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, -20);
    ctx.lineTo(cx - r * 0.25, cy);
    ctx.lineTo(cx + r * 0.25, cy);
    ctx.lineTo(cx + r * 0.6, -20);
    ctx.stroke();
  }

  function drawParticles(th) {
    const now = performance.now();
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      const age = (now - p.t0) / 1000;
      if (age > p.life) { particles.splice(i, 1); continue; }
      const k = 1 - age / p.life;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = k;
      ctx.beginPath();
      ctx.arc(p.x + p.vx * age, p.y + p.vy * age, p.r * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function burst(x, y, kind) {
    const colors = { shot: ['#ffd94d', '#fff', '#ff9d3d'], hit: ['#ff5d5d', '#ffd94d', '#fff'], kill: ['#ffd94d', '#7affa0', '#fff'] };
    const cs = colors[kind] || colors.shot;
    for (let i = 0; i < 8; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2 + Math.random() * 3, t0: performance.now(), life: 0.4 + Math.random() * 0.4, color: cs[i % cs.length] });
    }
  }

  return {
    draw(run, _alpha) {
      const th = theme(run);
      drawBackground(th);
      if (!run) return;
      drawObstacles(run, th);
      drawItems(run, th);
      drawGas(run, th);
      drawSpotlight(run, th);
      drawPlayers(run, th);
      drawBullets(run, th);
      drawParticles(th);
    },
    burst,
  };
}

export default createRender;
