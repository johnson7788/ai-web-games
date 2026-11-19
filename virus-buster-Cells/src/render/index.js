// Canvas 2D 程序化渲染：霓虹街机风（零素材文件）。
// 背景网格 + 飞船 + 激光 + 病毒细胞 + 晶体碎片 + 道具球 + 粒子上限分档。
import { WORLD, SHIP, GERM } from '../../config/game.config.js';

const TAU = Math.PI * 2;

// 病毒按血量分层配色（霓虹）
function germColor(hp) {
  if (hp <= 3) return { fill: '#9bff4f', glow: '#4aff7a' };
  if (hp <= 8) return { fill: '#4fff8a', glow: '#2fff7a' };
  if (hp <= 18) return { fill: '#4fd8ff', glow: '#2fb8ff' };
  if (hp <= 40) return { fill: '#a54fff', glow: '#8a2fff' };
  return { fill: '#ff3b5c', glow: '#ff2f4f' }; // boss
}

function drawSpikyCell(ctx, x, y, r, hp, flash, time, boss) {
  const c = germColor(hp);
  const spikes = boss ? 14 : 10;
  const wob = boss ? Math.sin(time * 6) * 0.12 + 1 : 1;
  const R = r * wob;

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = boss ? 26 : 14;
  ctx.beginPath();
  for (let i = 0; i <= spikes; i += 1) {
    const a = (i / spikes) * TAU + (boss ? time * 1.4 : time * 0.6);
    const rad = i % 2 === 0 ? R : R * 0.68;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  // 内圈
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.52, 0, TAU);
  ctx.fillStyle = 'rgba(4, 6, 18, 0.72)';
  ctx.fill();
  // 受击闪白
  if (flash > 0) {
    ctx.globalAlpha = Math.min(1, flash * 9);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.52, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawShip(ctx, s, time) {
  const x = s.x;
  const y = s.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(s.bank * 0.32);
  // 推进器尾焰
  const flame = 10 + Math.sin(time * 30) * 4;
  ctx.shadowColor = '#ff4fd8';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(-8, 14);
  ctx.lineTo(0, 14 + flame + 12);
  ctx.lineTo(8, 14);
  ctx.closePath();
  ctx.fillStyle = '#ff4fd8';
  ctx.fill();
  ctx.shadowBlur = 0;
  // 机身
  ctx.shadowColor = '#39f5ff';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(0, -SHIP.RADIUS - 6);
  ctx.lineTo(-SHIP.RADIUS * 0.72, SHIP.RADIUS * 0.5);
  ctx.lineTo(-SHIP.RADIUS * 0.36, SHIP.RADIUS * 0.24);
  ctx.lineTo(SHIP.RADIUS * 0.36, SHIP.RADIUS * 0.24);
  ctx.lineTo(SHIP.RADIUS * 0.72, SHIP.RADIUS * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#39f5ff';
  ctx.fill();
  ctx.shadowBlur = 0;
  // 座舱
  ctx.beginPath();
  ctx.arc(0, -6, SHIP.RADIUS * 0.28, 0, TAU);
  ctx.fillStyle = '#0b1030';
  ctx.fill();
  ctx.restore();
}

function drawCrystal(ctx, c, time) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(time * 1.2 + c.id);
  ctx.shadowColor = '#b26bff';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(0, -c.r);
  ctx.lineTo(c.r * 0.6, 0);
  ctx.lineTo(0, c.r);
  ctx.lineTo(-c.r * 0.6, 0);
  ctx.closePath();
  ctx.fillStyle = '#7a3bff';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(0, -c.r * 0.5);
  ctx.lineTo(c.r * 0.28, 0);
  ctx.lineTo(0, c.r * 0.5);
  ctx.lineTo(-c.r * 0.28, 0);
  ctx.closePath();
  ctx.fillStyle = '#d3a8ff';
  ctx.fill();
  ctx.restore();
}

const ORB_STYLE = {
  rapid: '#ffb84f',
  spread: '#4fd8ff',
  shield: '#7a3bff',
  heal: '#4fff8a',
  nuke: '#ff3b5c',
};
const ORB_LETTER = { rapid: 'R', spread: 'S', shield: 'D', heal: '+', nuke: 'N' };

function drawOrb(ctx, o, time) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.shadowColor = ORB_STYLE[o.kind];
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, 0, o.r, 0, TAU);
  ctx.fillStyle = ORB_STYLE[o.kind];
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#05060f';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ORB_LETTER[o.kind], 0, 1);
  ctx.restore();
}

function drawBackground(ctx, time) {
  // 深空底
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, '#060714');
  g.addColorStop(0.55, '#0a0c22');
  g.addColorStop(1, '#12051f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  // 网格
  ctx.strokeStyle = 'rgba(57, 245, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.WIDTH; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
  }
  for (let y = 0; y <= WORLD.HEIGHT; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
  }
  // 底部地面光
  const g2 = ctx.createLinearGradient(0, WORLD.HEIGHT - 90, 0, WORLD.HEIGHT);
  g2.addColorStop(0, 'rgba(57, 245, 255, 0)');
  g2.addColorStop(1, 'rgba(57, 245, 255, 0.10)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, WORLD.HEIGHT - 90, WORLD.WIDTH, 90);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const fx = [];
  let shake = 0;

  function addFx(type, data = {}) {
    if (fx.length > 420) fx.splice(0, fx.length - 420); // 粒子上限分档
    fx.push({ type, x: data.x ?? 0, y: data.y ?? 0, ttl: 0.5, max: 0.5, ...data });
  }

  function render(run, time = 0) {
    drawBackground(ctx, time);
    if (shake > 0) {
      const s = shake;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    if (run && run.state) {
      const st = run.state;
      // 护盾环
      if (st.shield > 0 && st.ship.alive) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(st.ship.x, st.ship.y, SHIP.RADIUS + 14, 0, TAU);
        ctx.strokeStyle = 'rgba(122, 59, 255, 0.85)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#7a3bff';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }
      // 子弹
      ctx.save();
      for (const b of st.bullets) {
        ctx.shadowColor = '#ff4fd8';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ff4fd8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
        ctx.stroke();
      }
      ctx.restore();
      // 病毒
      for (const g of st.germs) drawSpikyCell(ctx, g.x, g.y, g.r, g.hp, g.flash, time, g.boss);
      // 晶体
      for (const c of st.crystals) drawCrystal(ctx, c, time);
      // 道具球
      for (const o of st.orbs) drawOrb(ctx, o, time);
      // 飞船（无敌闪烁）
      if (st.ship.alive) {
        const blink = st.ship.invulnT > 0 && Math.floor(time * 14) % 2 === 0;
        if (!blink) drawShip(ctx, st.ship, time);
      }
      // 病毒血量数字
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const g of st.germs) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${g.boss ? 15 : 11}px monospace`;
        ctx.fillText(String(g.hp), g.x, g.y + 1);
      }
    }

    // 粒子 FX
    ctx.save();
    for (let i = fx.length - 1; i >= 0; i -= 1) {
      const f = fx[i];
      f.ttl -= 1 / 60;
      const k = Math.max(0, f.ttl / f.max);
      if (f.ttl <= 0) { fx.splice(i, 1); continue; }
      if (f.type === 'burst') {
        ctx.globalAlpha = k;
        ctx.fillStyle = f.color || '#4fd8ff';
        ctx.beginPath();
        ctx.arc(f.x, f.y, (1 - k) * 26 + 4, 0, TAU);
        ctx.fill();
      } else if (f.type === 'coin') {
        ctx.globalAlpha = k;
        ctx.fillStyle = '#ffd94f';
        ctx.beginPath();
        ctx.arc(f.x, f.y + (1 - k) * -24, 3, 0, TAU);
        ctx.fill();
      } else if (f.type === 'ring') {
        ctx.globalAlpha = k;
        ctx.strokeStyle = f.color || '#7a3bff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, (1 - k) * 40 + 6, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    if (shake > 0) {
      ctx.restore();
      shake = Math.max(0, shake - 1);
    }
  }

  return { render, addFx, get shake() { return shake; }, set shake(v) { shake = v; } };
}
