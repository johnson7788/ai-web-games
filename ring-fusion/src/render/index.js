// Ring Fusion · Canvas 2D 渲染（霓虹街机，纯程序化，无素材无外链）
// 画：星空背景 + 3×3 环点盘 + 底部手牌 + 粒子特效。
// 文字/数值全部交给 DOM HUD，canvas 不画文字（i18n 安全）。
import { WORLD, COLORS } from '../../config/game.config.js';
import { EMPTY, STONE, SLOTS, POINTS, HAND } from '../game/sim.js';

const BOARD = { ox: 54, oy: 58, cell: 152, gap: 24 };
const HAND_Y = 648;
const HAND_XS = [128, 306, 484];
const RING_RADIUS = [62, 44, 27]; // 大/中/小
const HAND_RING_RADIUS = [46, 33, 20];
const POINT_CENTER = [];
for (let i = 0; i < POINTS; i += 1) {
  const col = i % 3;
  const row = Math.floor(i / 3);
  POINT_CENTER.push({
    x: BOARD.ox + col * (BOARD.cell + BOARD.gap) + BOARD.cell / 2,
    y: BOARD.oy + row * (BOARD.cell + BOARD.gap) + BOARD.cell / 2,
  });
}

export const LAYOUT = {
  BOARD,
  POINT_CENTER,
  HAND_XS,
  HAND_Y,
  HAND_PLATE: { w: 144, h: 120 },
  POINT_R: 84,
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let reduced = false;
  let particles = [];
  let flash = 0;      // 全屏闪烁强度 0..1
  let shake = 0;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(WORLD.WIDTH * dpr);
    canvas.height = Math.floor(WORLD.HEIGHT * dpr);
    canvas.style.width = `${WORLD.WIDTH}px`;
    canvas.style.height = `${WORLD.HEIGHT}px`;
  }
  resize();

  function setReduced(b) { reduced = !!b; }

  function spawnParticles(x, y, color, n, speed) {
    if (reduced) return;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = (speed || 120) * (0.4 + Math.random() * 0.9);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.5,
        age: 0,
        r: 2 + Math.random() * 4,
        color,
      });
    }
  }

  function spawnClear(affectedPoints, color) {
    const col = color || '#ffffff';
    for (const pi of affectedPoints) {
      const c = POINT_CENTER[pi];
      spawnParticles(c.x, c.y, col, 14, 160);
      particles.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 0.4, age: 0, r: 0, grow: 60, color: col, ring: true });
    }
    flash = Math.max(flash, 0.25);
    shake = Math.max(shake, 6);
  }

  function spawnPlace(p) {
    const c = POINT_CENTER[p];
    spawnParticles(c.x, c.y, '#9ff3ff', 6, 90);
  }

  function spawnBurst(p) {
    const c = POINT_CENTER[p];
    spawnParticles(c.x, c.y, '#ffffff', 26, 220);
    particles.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 0.5, age: 0, r: 0, grow: 120, color: '#fff', ring: true });
    flash = Math.max(flash, 0.5);
    shake = Math.max(shake, 12);
  }

  function update(dt) {
    if (reduced) { flash = 0; shake = 0; }
    for (const pt of particles) {
      pt.age += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      if (pt.ring) pt.r += (pt.grow || 60) * dt;
    }
    particles = particles.filter((p) => p.age < p.life);
    flash = Math.max(0, flash - dt * 2.2);
    shake = Math.max(0, shake - dt * 40);
  }

  function drawBg() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0a0a16');
    g.addColorStop(0.55, '#120b24');
    g.addColorStop(1, '#08121f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星点
    ctx.fillStyle = 'rgba(180,220,255,0.5)';
    for (let i = 0; i < 70; i += 1) {
      const sx = (i * 173.3) % WORLD.WIDTH;
      const sy = (i * 97.7) % WORLD.HEIGHT;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(i * 1.7));
      ctx.globalAlpha = tw * 0.7;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // 右侧装饰光带（HUD 面板区背后）
    const rg = ctx.createLinearGradient(640, 0, 1280, 0);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(20,14,40,0.55)');
    ctx.fillStyle = rg;
    ctx.fillRect(640, 0, 640, WORLD.HEIGHT);
  }

  function ringPath(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }

  function drawRing(x, y, r, color, glow) {
    ctx.save();
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
    }
    ctx.strokeStyle = color;
    ringPath(x, y, r);
    ctx.stroke();
    // 高光弧
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(x, y, r, -2.2, -1.0);
    ctx.stroke();
    ctx.restore();
  }

  function drawStone(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.3);
    ctx.fillStyle = '#3a4152';
    ctx.strokeStyle = '#8a93a8';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(140,150,170,0.5)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    const n = 6;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawSlot(x, y, r, value, isHand) {
    const rr = (isHand ? HAND_RING_RADIUS : RING_RADIUS)[r];
    if (value === EMPTY) {
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(150,170,220,0.28)';
      ctx.lineWidth = 2;
      ringPath(x, y, rr);
      ctx.stroke();
      ctx.restore();
    } else if (value === STONE) {
      drawStone(x, y, rr * 0.72);
    } else {
      drawRing(x, y, rr, COLORS[value % COLORS.length], true);
    }
  }

  function drawPointPlate(x, y) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,24,0.72)';
    ringPath(x, y, 84);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,140,220,0.25)';
    ctx.lineWidth = 2;
    ringPath(x, y, 84);
    ctx.stroke();
    // 中心小点
    ctx.fillStyle = 'rgba(150,170,220,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHandPlate(x, y) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,30,0.85)';
    ctx.beginPath();
    ctx.roundRect(x - 72, y - 60, 144, 120, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,140,220,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawPoint(sim, i, highlight) {
    const c = POINT_CENTER[i];
    drawPointPlate(c.x, c.y);
    if (highlight) {
      ctx.save();
      ctx.strokeStyle = '#9ff3ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#9ff3ff';
      ctx.shadowBlur = 12;
      ringPath(c.x, c.y, 88);
      ctx.stroke();
      ctx.restore();
    }
    const pt = sim.points[i];
    for (let s = 0; s < SLOTS; s += 1) drawSlot(c.x, c.y, s, pt[s], false);
  }

  function drawHandTile(tile, x, y, ghost) {
    drawHandPlate(x, y);
    for (let s = 0; s < SLOTS; s += 1) {
      if (ghost && tile[s] !== EMPTY) {
        drawRing(x, y, HAND_RING_RADIUS[s], '#9ff3ff', true);
      } else {
        drawSlot(x, y, s, tile[s], true);
      }
    }
  }

  function render(sim, view = {}) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawBg();

    ctx.save();
    if (shake > 0 && !reduced) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    if (sim) {
      const targetSet = view.targets || new Set();
      for (let i = 0; i < POINTS; i += 1) {
        drawPoint(sim, i, !!view.drag && targetSet.has(i));
      }

      // 手牌
      for (let h = 0; h < HAND; h += 1) {
        if (view.drag && view.drag.h === h) continue; // 拖拽中的那张画在指针处
        drawHandTile(sim.hand[h], HAND_XS[h], HAND_Y, false);
      }

      // 拖拽中的手牌
      if (view.drag && view.drag.h != null) {
        drawHandTile(sim.hand[view.drag.h], view.drag.x, view.drag.y, true);
      }
    }

    // 粒子
    for (const pt of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - pt.age / pt.life);
      if (pt.ring) {
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();

    // 全屏闪烁
    if (flash > 0 && !reduced) {
      ctx.fillStyle = `rgba(220,240,255,${flash.toFixed(3)})`;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
  }

  return { render, update, spawnClear, spawnPlace, spawnBurst, setReduced, resize };
}
