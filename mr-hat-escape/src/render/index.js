// MR HAT ESCAPE · Canvas 2D 渲染（程序化霓虹街机风，零素材零外链）。
// 逻辑分辨率 1280×720；DPR ≤2；prefers-reduced-motion 时关闭粒子/大幅动效。

import { WORLD, PLAYER } from '../../config/game.config.js';

const TILE = WORLD.TILE;

const COL = {
  bgTop: '#0a0a1f',
  bgBottom: '#16163a',
  grid: 'rgba(0,255,255,0.05)',
  platform: '#141433',
  platformEdge: '#00e5ff',
  platformStroke: '#ff2ea6',
  spike: '#ff2ea6',
  spikeDark: '#8b1258',
  blade: '#00e5ff',
  bladeTooth: '#ff2ea6',
  star: '#ffd23f',
  starDim: 'rgba(255,210,63,0.35)',
  key: '#ffd23f',
  keyGlow: 'rgba(255,210,63,0.35)',
  doorLocked: '#ff5a5a',
  doorOpen: '#3dffa0',
  doorGlow: 'rgba(61,255,160,0.4)',
  crate: '#ff8a3d',
  crateEdge: '#ffb36b',
  bridge: '#00e5ff',
  playerBody: '#eef4ff',
  playerHat: '#ff2ea6',
  playerHatBand: '#00e5ff',
  trail: 'rgba(0,229,255,0.4)',
};

function glowCircle(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;

  function bg(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, COL.bgTop);
    g.addColorStop(1, COL.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 网格
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.WIDTH; x += TILE) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); }
    for (let y = 0; y <= WORLD.HEIGHT; y += TILE) { ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); }
    ctx.stroke();
  }

  function platform(ctx, pl) {
    ctx.fillStyle = COL.platform;
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    // 顶部霓虹边
    ctx.fillStyle = COL.platformEdge;
    ctx.fillRect(pl.x, pl.y, pl.w, pl.kind === 'oneway' ? 3 : 4);
    ctx.strokeStyle = COL.platformStroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(pl.x + 1, pl.y + 1, pl.w - 2, pl.h - 2);
    if (pl.kind === 'oneway') {
      ctx.fillStyle = COL.platformEdge;
      for (let x = pl.x + 8; x < pl.x + pl.w - 8; x += 20) ctx.fillRect(x, pl.y + 4, 8, 2);
    }
  }

  function spike(ctx, sp) {
    const n = Math.max(2, Math.round(sp.w / 24));
    const step = sp.w / n;
    ctx.fillStyle = COL.spike;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const x0 = sp.x + i * step;
      ctx.moveTo(x0, sp.y + sp.h);
      ctx.lineTo(x0 + step / 2, sp.y);
      ctx.lineTo(x0 + step, sp.y + sp.h);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COL.spikeDark;
    ctx.fillRect(sp.x, sp.y + sp.h - 3, sp.w, 3);
  }

  function blade(ctx, b, time) {
    const ang = b.angle != null ? b.angle : time * 2;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(ang);
    const teeth = 8;
    ctx.fillStyle = COL.blade;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i += 1) {
      const r = i % 2 === 0 ? b.r : b.r - 9;
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COL.bladeTooth;
    ctx.beginPath();
    ctx.arc(0, 0, b.r - 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function star(ctx, st, time, collected) {
    const pulse = reduced ? 0 : Math.sin(time * 3 + st.x) * 2;
    const r = 12 + pulse;
    const cx = st.x;
    const cy = st.y;
    if (!collected) glowCircle(ctx, cx, cy, 26, COL.keyGlow);
    ctx.fillStyle = collected ? COL.starDim : COL.star;
    ctx.beginPath();
    const spikes = 5;
    for (let i = 0; i < spikes * 2; i += 1) {
      const rr = i % 2 === 0 ? r : r * 0.5;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function keyShape(ctx, k, time, collected) {
    const cx = k.x + k.w / 2;
    const cy = k.y + k.h / 2;
    const s = (k.w || 34) / 34;
    if (!collected) {
      glowCircle(ctx, cx, cy, 34 * s, COL.keyGlow);
      const pr = 22 * s + (reduced ? 0 : Math.sin(time * 4 + k.x) * 3);
      ctx.strokeStyle = 'rgba(255,210,63,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, pr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = COL.key;
    ctx.strokeStyle = COL.key;
    ctx.lineWidth = 3.5;
    // 钥匙柄（圆环）
    ctx.beginPath();
    ctx.arc(-8, -4, 8, 0, Math.PI * 2);
    ctx.stroke();
    // 钥匙杆（上下齿）
    ctx.fillRect(0, -3, 20, 6);
    ctx.beginPath();
    ctx.moveTo(12, 3); ctx.lineTo(12, 8); ctx.lineTo(8, 8); ctx.lineTo(8, 3);
    ctx.moveTo(16, -3); ctx.lineTo(16, -8); ctx.lineTo(12, -8); ctx.lineTo(12, -3);
    ctx.fill();
    ctx.restore();
  }

  function door(ctx, d, open, time) {
    const cx = d.x + d.w / 2;
    const cy = d.y + d.h / 2;
    if (open) {
      glowCircle(ctx, cx, cy, 44, COL.doorGlow);
      ctx.fillStyle = COL.doorOpen;
    } else {
      ctx.fillStyle = COL.doorLocked;
    }
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = open ? COL.doorOpen : COL.doorLocked;
    ctx.lineWidth = 3;
    ctx.strokeRect(d.x + 2, d.y + 2, d.w - 4, d.h - 4);
    // 门内符号：锁定/箭头
    ctx.fillStyle = '#0a0a1f';
    if (open) {
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy);
      ctx.lineTo(cx + 4, cy + 12);
      ctx.lineTo(cx + 14, cy - 12);
      ctx.lineWidth = 5;
      ctx.strokeStyle = COL.doorOpen;
      ctx.stroke();
    } else {
      ctx.fillRect(cx - 10, cy - 12, 20, 4);
      ctx.fillRect(cx - 4, cy - 8, 8, 12);
      ctx.beginPath();
      ctx.arc(cx, cy + 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function crate(ctx, c) {
    ctx.fillStyle = COL.crate;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = COL.crateEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    ctx.beginPath();
    ctx.moveTo(c.x + 4, c.y + 4); ctx.lineTo(c.x + c.w - 4, c.y + c.h - 4);
    ctx.moveTo(c.x + c.w - 4, c.y + 4); ctx.lineTo(c.x + 4, c.y + c.h - 4);
    ctx.stroke();
  }

  function player(ctx, p, time) {
    const cx = p.x + PLAYER.W / 2;
    const feet = p.y + PLAYER.H;
    // 尾迹
    if (!reduced && Math.abs(p.vx) > 0.5 && p.onGround) {
      ctx.fillStyle = COL.trail;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(cx - p.facing * (8 + i * 8), feet - 8, 3 - i, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 身体
    ctx.fillStyle = COL.playerBody;
    ctx.fillRect(p.x + 4, p.y + 18, PLAYER.W - 8, PLAYER.H - 18);
    // 眼睛
    ctx.fillStyle = '#0a0a1f';
    const eyeX = p.facing > 0 ? p.x + PLAYER.W - 12 : p.x + 6;
    ctx.fillRect(eyeX, p.y + 24, 5, 5);
    // 帽子（fedora）：帽檐 + 帽顶
    ctx.fillStyle = COL.playerHat;
    ctx.fillRect(p.x, p.y + 10, PLAYER.W, 8);
    ctx.fillRect(p.x + 6, p.y, PLAYER.W - 12, 12);
    ctx.fillStyle = COL.playerHatBand;
    ctx.fillRect(p.x + 4, p.y + 12, PLAYER.W - 8, 3);
    // 腿（跑步摆动）
    const leg = reduced ? 0 : Math.sin(time * 14) * (Math.abs(p.vx) > 0.5 ? 4 : 0);
    ctx.fillStyle = COL.playerBody;
    ctx.fillRect(p.x + 5, p.y + PLAYER.H - 2, 8, 2 + leg);
    ctx.fillRect(p.x + PLAYER.W - 13, p.y + PLAYER.H - 2, 8, 2 - leg);
  }

  function draggable(ctx, d, time) {
    if (d.kind === 'keyword') {
      ctx.fillStyle = COL.doorGlow;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = COL.doorOpen;
      ctx.lineWidth = 3;
      ctx.strokeRect(d.x + 2, d.y + 2, d.w - 4, d.h - 4);
      ctx.fillStyle = '#0a0a1f';
      ctx.font = 'bold 28px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('KEY', d.x + d.w / 2, d.y + d.h / 2 + 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    } else {
      platform(ctx, { ...d, kind: 'solid' });
      ctx.fillStyle = COL.bridge;
      for (let x = d.x + 8; x < d.x + d.w - 8; x += 22) {
        ctx.fillRect(x, d.y - 4, 4, 8);
      }
    }
  }

  return {
    reduced,
    render(sim, view = {}) {
      const cameraX = view.cameraX || 0;
      const time = view.time || 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      bg(ctx);
      ctx.save();
      ctx.translate(-cameraX, 0);

      if (!sim) { ctx.restore(); return; }

      const s = sim.state;
      for (const pl of s.platforms) platform(ctx, pl);
      for (const d of s.draggables) draggable(ctx, d, time);
      for (const c of s.crates) crate(ctx, c);
      for (const sp of s.spikes) spike(ctx, sp);
      for (const st of s.stars) star(ctx, st, time, st.collected);
      if (s.key && !s.keyCollected) keyShape(ctx, s.key, time, false);
      door(ctx, s.door, s.doorOpen, time);
      for (const b of s.blades) blade(ctx, b, time);
      player(ctx, s.player, time);

      ctx.restore();
    },

    renderTitle(time = 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      bg(ctx);
      // 演示场景：地面 + 玩家 + 钥匙 + 门 + 尖刺 + 星星
      const ground = { x: 0, y: 620, w: WORLD.WIDTH, h: 100, kind: 'solid' };
      platform(ctx, ground);
      spike(ctx, { x: 700, y: 600, w: 96, h: 20 });
      star(ctx, { x: 560, y: 560 }, time, false);
      star(ctx, { x: 980, y: 540 }, time, false);
      keyShape(ctx, { x: 780, y: 582, w: 26, h: 26 }, time, false);
      door(ctx, { x: 1080, y: 556, w: 64, h: 64 }, true, time);
      player(ctx, { x: 420, y: 576, vx: 0, facing: 1, onGround: true }, time);
    },
  };
}
