// Canvas 2D 渲染：六边形棋盘 + 蜂巢块组 + 封蜡/花粉 + 悬停幽灵 + 粒子。
// 三场景包（春巢/蜜库/冬巢）换色板 + 装饰主题；HUD 数值走 DOM。
import { WORLD } from '../../config/game.config.js';
import { axialToXY, neighbors } from '../game/hex.js';
import { SCENE_PACKS, scenePackOf } from '../../config/gameplay.js';

function hexPath(ctx, cx, cy, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = Math.PI / 180 * (60 * i - 90);
    const x = cx + size * Math.cos(a);
    const y = cy + size * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const particles = [];

  function cellXY(q, r) {
    const p = axialToXY(q, r, WORLD.HEX_SIZE);
    return { x: WORLD.BOARD_X + p.x, y: WORLD.BOARD_Y + p.y };
  }

  function burst(x, y, kind) {
    const colors = kind === 'cascade' ? ['#ffd45e', '#ffe9a8', '#fff4cc'] : kind === 'clear' ? ['#aef7c0', '#eafff0'] : ['#ffffff'];
    for (let i = 0; i < (kind === 'cascade' ? 26 : 14); i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * (kind === 'cascade' ? 200 : 120);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.5 + Math.random() * 0.5, age: 0, color: colors[(Math.random() * colors.length) | 0],
      });
    }
  }

  function drawDecor(pack, t) {
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = pack.accent;
    ctx.lineWidth = 1;
    const n = 6;
    for (let i = 0; i < n; i += 1) {
      const x = 90 + ((i * 211 + 40) % 1180);
      const y = 90 + ((i * 137 + 20) % 620);
      const size = 40 + (i % 3) * 22;
      const drift = Math.sin(t * 0.4 + i) * 6;
      hexPath(ctx, x + drift, y, size);
      ctx.stroke();
    }
    // 主题装饰点缀
    ctx.fillStyle = pack.accent;
    if (pack.decor === 'blossom') {
      for (let i = 0; i < 5; i += 1) {
        const x = 130 + i * 240, y = 120 + (i % 2) * 480;
        ctx.beginPath();
        ctx.arc(x + Math.sin(t * 0.5 + i) * 4, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pack.decor === 'comb') {
      for (let i = 0; i < 7; i += 1) {
        const x = 120 + i * 170, y = 110 + (i % 2) * 500;
        hexPath(ctx, x, y, 8);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 7; i += 1) {
        const x = 140 + i * 150, y = 100 + (i % 2) * 520;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.2 + i);
        for (let k = 0; k < 3; k += 1) {
          ctx.rotate(Math.PI * 2 / 3);
          ctx.beginPath();
          ctx.moveTo(0, -7); ctx.lineTo(2, 0); ctx.lineTo(0, 7); ctx.lineTo(-2, 0);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawCell(cell, pack) {
    const { x, y } = cellXY(cell.q, cell.r);
    const size = WORLD.HEX_SIZE * 0.94;
    hexPath(ctx, x, y, size);
    if (cell.wall) {
      ctx.fillStyle = pack.wall;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }
    if (!cell.filled) {
      ctx.fillStyle = pack.boardEmpty;
      ctx.fill();
      ctx.strokeStyle = pack.boardEmptyEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = pack.cells[cell.color % pack.cells.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 高光
      ctx.beginPath();
      ctx.arc(x - size * 0.2, y - size * 0.25, size * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fill();
    }
    // 封蜡帽
    if (cell.wax > 0) {
      hexPath(ctx, x, y, size * (cell.wax >= 2 ? 0.55 : 0.42));
      ctx.fillStyle = cell.filled ? 'rgba(255, 224, 130, 0.75)' : '#ffd98a';
      ctx.fill();
      ctx.strokeStyle = '#9a6b12';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (cell.filled && cell.wax === 1) {
        ctx.strokeStyle = 'rgba(60,40,0,0.6)';
        ctx.beginPath();
        ctx.moveTo(x - size * 0.2, y - size * 0.2);
        ctx.lineTo(x + size * 0.2, y + size * 0.2);
        ctx.stroke();
      }
    }
    // 花粉块
    if (cell.pollen) {
      ctx.fillStyle = 'rgba(255,255,240,0.95)';
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * size * 0.32, y + Math.sin(a) * size * 0.32, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawGhost(run, pack) {
    if (!run || run.phase !== 'playing' || run.hover == null) return;
    const shape = run.shapes[run.selected];
    if (!shape) return;
    const anchor = run.cells[run.hover];
    const offs = (() => {
      let o = shape.offsets;
      for (let i = 0; i < shape.rot; i += 1) {
        o = o.map(([q, r]) => [-r, q + r]);
      }
      return o;
    })();
    let valid = true;
    for (const [dq, dr] of offs) {
      const idx = run.indexByCoord.get(`${anchor.q + dq},${anchor.r + dr}`);
      if (idx == null || run.cells[idx].wall || run.cells[idx].filled) valid = false;
    }
    for (const [dq, dr] of offs) {
      const idx = run.indexByCoord.get(`${anchor.q + dq},${anchor.r + dr}`);
      if (idx == null) continue;
      const c = run.cells[idx];
      const { x, y } = cellXY(c.q, c.r);
      hexPath(ctx, x, y, WORLD.HEX_SIZE * 0.94);
      ctx.fillStyle = valid ? 'rgba(140, 255, 170, 0.30)' : 'rgba(255, 90, 90, 0.28)';
      ctx.fill();
      ctx.strokeStyle = valid ? '#aef7c0' : '#ff7a7a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawPreviews(run, pack) {
    if (!run) return;
    const x0 = 1090;
    const y0 = 92;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.font = '600 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', x0, y0 - 6);
    run.shapes.forEach((shape, i) => {
      const sy = y0 + 12 + i * 62;
      const selected = i === run.selected;
      ctx.globalAlpha = selected ? 1 : 0.55;
      const color = pack.cells[i % pack.cells.length];
      for (const [q, r] of shape.offsets) {
        const px = x0 + 22 + q * 26 + r * 13;
        const py = sy + 16 + r * 22.5;
        hexPath(ctx, px, py, 12);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (shape.pollen) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x0 + 22, sy + 12, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (selected) {
        ctx.strokeStyle = pack.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 - 8, sy - 6, 96, 44);
      }
    });
    ctx.restore();
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  let lastNow = 0;
  let sceneTime = 0;

  return {
    burst,
    draw(run, alpha = 1) {
      const now = performance.now();
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
      lastNow = now;
      sceneTime += dt;

      const tier = run ? run.tier : 1;
      const pack = SCENE_PACKS[scenePackOf(tier)];

      // 背景
      const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
      g.addColorStop(0, pack.bgTop);
      g.addColorStop(1, pack.bgBottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      drawDecor(pack, sceneTime);

      if (!run) return;

      for (const cell of run.cells) drawCell(cell, pack);
      drawGhost(run, pack);
      drawPreviews(run, pack);
      drawParticles(dt);
    },
  };
}
