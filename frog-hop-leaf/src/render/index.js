// FROG HOP LEAF · Canvas 2D 渲染（手绘卡通风，全程序化，零素材）
// 坐标：世界 alt 向上为正；屏幕 y = camAlt + WORLD.HEIGHT - alt。
import { WORLD, LEAF, GAME } from '../../config/game.config.js';
import { SCENES } from '../../config/levels.js';

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// 柔和圆角矩形
function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(GAME.DPR_MAX, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;

  const sceneOf = (state) => SCENES[state?.scene] || SCENES.shallows;

  function sx(state, x) { return x; }
  function sy(state, alt) { return state.camAlt + WORLD.HEIGHT - alt; }

  // ---- 背景（天空 / 云 / 太阳 / 池水）----
  function drawBackground(state, clock) {
    const sc = sceneOf(state);
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, sc.skyTop);
    g.addColorStop(1, sc.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 太阳
    const sunX = 1080;
    const sunY = clamp(120 + state.camAlt * 0.02, 40, 160);
    ctx.fillStyle = 'rgba(255,244,180,0.9)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,220,0.5)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 66, 0, Math.PI * 2);
    ctx.fill();

    // 云（随相机缓慢漂移）
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 5; i += 1) {
      const cx = ((i * 260 + 80) + ((clock * 12 + state.camAlt * 0.3) % 260)) % (WORLD.WIDTH + 200) - 100;
      const cy = 90 + ((i * 137) % 300);
      cloud(cx, cy, 1 + (i % 3) * 0.25);
    }

    // 池水（屏幕底部）
    const waterTop = sy(state, state.camAlt) - 20;
    if (waterTop < WORLD.HEIGHT) {
      const wg = ctx.createLinearGradient(0, waterTop, 0, WORLD.HEIGHT);
      wg.addColorStop(0, sc.water);
      wg.addColorStop(1, sc.waterDeep);
      ctx.fillStyle = wg;
      ctx.fillRect(0, waterTop, WORLD.WIDTH, WORLD.HEIGHT - waterTop);
      // 波光
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i += 1) {
        const wx = ((i * 170 + clock * 40) % (WORLD.WIDTH + 120)) - 60;
        const wy = waterTop + 26 + (i % 3) * 22;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + 30, wy - 8, wx + 60, wy);
        ctx.stroke();
      }
    }
  }

  function cloud(cx, cy, s) {
    ctx.beginPath();
    ctx.arc(cx, cy, 26 * s, 0, Math.PI * 2);
    ctx.arc(cx + 26 * s, cy - 12 * s, 22 * s, 0, Math.PI * 2);
    ctx.arc(cx + 52 * s, cy, 24 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 荷叶 ----
  function drawLeaf(state, leaf) {
    const sc = sceneOf(state);
    const x = sx(state, leaf.x);
    const y = sy(state, leaf.y);
    const w = leaf.w;
    const h = leaf.h;
    const isSpecial = leaf.kind !== 'leaf';

    // 叶柄阴影
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 3, w / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 叶身
    const col = isSpecial
      ? (leaf.kind === 'golden' ? '#f6c453' : '#7fd45e')
      : sc.leaf;
    const dark = isSpecial
      ? (leaf.kind === 'golden' ? '#d99a2b' : '#5ab83f')
      : sc.leafDark;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, col);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    rr(ctx, x, y - 2, w, h + 4, h / 2);
    ctx.fill();

    // 叶脉
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h / 2);
    ctx.lineTo(x + w - 8, y + h / 2);
    ctx.stroke();

    // 特殊叶标记
    if (leaf.kind === 'spring') {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(x + w / 2 - 14 + i * 14, y + 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (leaf.kind === 'golden') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      star(x + w / 2, y - 1, 8, 4);
    }
  }

  function star(cx, cy, r, n) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i += 1) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ---- 尖刺 ----
  function drawThorn(state, t) {
    const leaf = state.leaves[t.leafId];
    if (!leaf) return;
    const y = sy(state, leaf.y);
    ctx.fillStyle = '#7b4bb0';
    for (let i = 0; i < Math.floor(t.w / 18); i += 1) {
      const tx = t.x + i * 18;
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.lineTo(tx + 9, y - 14);
      ctx.lineTo(tx + 18, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- 瓢虫 / 滚石 ----
  function drawEnemy(state, e, clock) {
    const x = sx(state, e.x);
    const y = sy(state, e.y);
    if (e.kind === 'ladybug') {
      ctx.fillStyle = '#e23b3b';
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(x, y, 15, Math.PI * 0.6, Math.PI * 1.4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - 5, y - 6, 2.4, 0, Math.PI * 2);
      ctx.arc(x + 5, y - 6, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#9aa3ad';
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6f7883';
      ctx.beginPath();
      ctx.arc(x - 6, y - 6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c6cdd5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 12, Math.PI * 0.2, Math.PI * 1.2);
      ctx.stroke();
    }
  }

  // ---- 香蒲 + 气泡 ----
  function drawCattail(state, c) {
    const leaf = state.leaves[c.leafId];
    if (!leaf) return;
    const x = sx(state, c.x);
    const y = sy(state, leaf.y);
    ctx.strokeStyle = '#4f7d3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.quadraticCurveTo(x + (c.side < 0 ? 6 : -6), y - 26, x, y - 40);
    ctx.stroke();
    ctx.fillStyle = '#7a5a34';
    ctx.beginPath();
    ctx.ellipse(x, y - 42, 6, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBubble(state, b, clock) {
    const x = sx(state, b.x);
    const y = sy(state, b.y);
    ctx.fillStyle = 'rgba(160,220,255,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ---- 萤火虫 ----
  function drawFirefly(state, f, clock) {
    const x = sx(state, f.x);
    const y = sy(state, f.y + Math.sin(clock * 3 + f.x * 0.05) * 6);
    const glow = 0.6 + 0.4 * Math.sin(clock * 6 + f.x);
    ctx.fillStyle = `rgba(255,224,90,${0.25 + 0.25 * glow})`;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 青蛙 ----
  function drawFrog(state, f, clock) {
    const x = sx(state, f.x);
    const y = sy(state, f.y);
    // 竖直速度驱动拉伸/压缩
    const stretch = clamp(Math.abs(f.vy) / 900, 0, 1);
    const bw = LEAF.FROG_W * (1 + stretch * 0.12);
    const bh = LEAF.FROG_H * (1 - stretch * 0.16);
    const face = f.dir;

    // 腿
    ctx.fillStyle = '#2c8a4c';
    ctx.beginPath();
    ctx.ellipse(x - 10, y + 12, 7, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 10, y + 12, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 身体（亮黄绿 + 深色描边，和绿叶拉开对比）
    const bg = ctx.createRadialGradient(x - 6, y - 8, 4, x, y, bh);
    bg.addColorStop(0, '#c9f27a');
    bg.addColorStop(1, '#57c04f');
    ctx.fillStyle = bg;
    ctx.strokeStyle = '#1e4a2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, bw / 2, bh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 肚皮
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.ellipse(x, y + 6, bw / 2 - 5, bh / 2 - 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    const ex = x + face * 6;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex - 6, y - 8, 7, 0, Math.PI * 2);
    ctx.arc(ex + 6, y - 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22303c';
    ctx.beginPath();
    ctx.arc(ex - 6 + face * 2, y - 8, 3.4, 0, Math.PI * 2);
    ctx.arc(ex + 6 + face * 2, y - 8, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 莲花门（目标）：金色大拱门 + 旗帜，一眼看出是终点 ----
  function drawGoal(state, clock) {
    const y = sy(state, state.goalY);
    const gx = WORLD.WIDTH / 2;
    const pulse = 0.7 + 0.3 * Math.sin(clock * 3);
    // 只在接近屏幕时画（离线时由 HUD 的 Top 距离提示目标）
    if (y < -140 || y > WORLD.HEIGHT + 80) return;

    // 两侧金柱
    ctx.fillStyle = '#c98a1b';
    rr(ctx, gx - 190, y - 120, 30, 120, 8); ctx.fill();
    rr(ctx, gx + 160, y - 120, 30, 120, 8); ctx.fill();
    ctx.fillStyle = '#f0c050';
    rr(ctx, gx - 190, y - 120, 10, 120, 5); ctx.fill();
    rr(ctx, gx + 180, y - 120, 10, 120, 5); ctx.fill();

    // 顶部横梁
    ctx.fillStyle = '#c98a1b';
    rr(ctx, gx - 190, y - 132, 380, 28, 8); ctx.fill();

    // 横幅「GOAL」
    ctx.fillStyle = '#ffe08a';
    rr(ctx, gx - 150, y - 96, 300, 46, 10); ctx.fill();
    ctx.strokeStyle = '#c98a1b';
    ctx.lineWidth = 3;
    rr(ctx, gx - 150, y - 96, 300, 46, 10); ctx.stroke();
    ctx.fillStyle = '#7a4a10';
    ctx.font = 'bold 30px "Comic Sans MS", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GOAL', gx, y - 73);
    ctx.textBaseline = 'alphabetic';

    // 顶端大金星（脉冲发光）
    ctx.fillStyle = `rgba(255,224,138,${0.25 + 0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(gx, y - 132, 30 + pulse * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    star(gx, y - 132, 20, 5);
  }

  // ---- 粒子 ----
  function drawParticles(state, view, dt) {
    if (!view.particles) return;
    const arr = view.particles;
    for (let i = arr.length - 1; i >= 0; i -= 1) {
      const p = arr[i];
      p.ttl -= dt;
      if (p.ttl <= 0) { arr.splice(i, 1); continue; }
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      const a = clamp(p.ttl / p.life, 0, 1);
      const py = sy(state, p.y);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color || '#fff';
      ctx.beginPath();
      ctx.arc(p.x, py, p.size || 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return {
    dpr,
    draw(state, dt, view = {}) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const clock = state ? state.clock : 0;
      if (!state) {
        drawBackground({ camAlt: 0, scene: 'shallows' }, 0);
        return;
      }
      if (view.shake && view.shake > 0) {
        ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
      }
      drawBackground(state, clock);
      for (const leaf of state.leaves) drawLeaf(state, leaf);
      for (const t of state.thorns) drawThorn(state, t);
      for (const c of state.cattails) drawCattail(state, c);
      drawGoal(state, clock);
      for (const e of state.enemies) drawEnemy(state, e, clock);
      for (const b of state.bubbles) drawBubble(state, b, clock);
      for (const f of state.fireflyList) if (!f.taken) drawFirefly(state, f, clock);
      drawFrog(state, state.frog, clock);
      drawParticles(state, view, dt);
    },
    spawn(view, kind, x, yAlt) {
      if (!view.particles) view.particles = [];
      const colors = {
        ripple: '#bff0ff',
        spark: '#fff3a0',
        puff: '#d9ffd0',
        splat: '#ffd9a0',
        golden: '#ffe08a',
      };
      const n = view.particles.length >= GAME.PARTICLE_MAX ? 6 : 14;
      for (let i = 0; i < n; i += 1) {
        view.particles.push({
          x,
          y: yAlt,
          vx: (Math.random() - 0.5) * 160,
          vy: (Math.random() - 0.5) * 160,
          ttl: 0.5 + Math.random() * 0.4,
          life: 0.9,
          size: 3 + Math.random() * 4,
          color: colors[kind] || '#fff',
        });
      }
    },
  };
}
