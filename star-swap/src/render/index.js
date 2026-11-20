// src/render/index.js — Canvas 2D 渲染：深空背景 + 8×8 星阵 + 特殊星 + 暗物质 + 粒子 + 超新星白闪
// 契约：createRender(canvas) → { draw(run, alpha), burst, setSelection, setHover, setLens, flashNova, layout }
import { WORLD } from '../../config/game.config.js';
import { SPECIAL, GRAVITY } from '../../config/gameplay.js';
import { scenePalette, layout, cellCenter, SHAPES } from './theme.js';
import { mulberry32 } from '../game/rng.js';

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const state = {
    particles: [],
    novaFlash: 0,       // 0..1，白闪强度
    selection: null,    // 选中的格索引
    hover: null,
    lens: null,         // { a, b }
    time: 0,
    floaters: [],       // 飘分文字 { x, y, text, life, color }
  };

  // 背景星（确定性，不闪烁）
  const bgStars = (() => {
    const rng = mulberry32(20241120);
    const out = [];
    for (let i = 0; i < 140; i += 1) {
      out.push({ x: rng() * WORLD.WIDTH, y: rng() * WORLD.HEIGHT, r: 0.4 + rng() * 1.3, a: 0.15 + rng() * 0.5 });
    }
    return out;
  })();

  // ---------- 背景 ----------
  function drawBackground(scene) {
    const p = scenePalette(scene);
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, p.bg[0]);
    g.addColorStop(0.55, p.bg[1]);
    g.addColorStop(1, p.bg[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星云
    for (let i = 0; i < 5; i += 1) {
      const nx = ((i * 353) % WORLD.WIDTH);
      const ny = ((i * 211) % WORLD.HEIGHT);
      const nr = 160 + (i % 3) * 90;
      const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      ng.addColorStop(0, p.nebula[i % 2] + '55');
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng;
      ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
    }

    // 背景星
    for (const s of bgStars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 星屑形状 ----------
  function pathStar(cx, cy, r, points, inset) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const ang = (Math.PI / points) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * inset;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function pathShape(cx, cy, r, shape) {
    switch (shape) {
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.82, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.82, cy);
        ctx.closePath();
        return;
      case 'star':
        pathStar(cx, cy, r, 5, 0.5);
        return;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * 0.75); ctx.lineTo(cx - r, cy + r * 0.75);
        ctx.closePath();
        return;
      case 'hexagon':
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const a = (Math.PI / 3) * i - Math.PI / 2;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        return;
      case 'ring':
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
        return;
      default: // circle
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        return;
    }
  }

  function drawStar(cx, cy, r, color, shape, special, pulse) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    pathShape(cx, cy, r, shape);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 内高光
    pathShape(cx - r * 0.18, cy - r * 0.18, r * 0.5, shape);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();

    // 特殊星标记
    if (special) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
      if (special === SPECIAL.ROW) {
        // 横向双箭头
        ctx.beginPath();
        ctx.moveTo(cx - r * 1.5, cy); ctx.lineTo(cx + r * 1.5, cy);
        ctx.moveTo(cx - r * 1.5 + 6, cy - 5); ctx.lineTo(cx - r * 1.5, cy); ctx.lineTo(cx - r * 1.5 + 6, cy + 5);
        ctx.moveTo(cx + r * 1.5 - 6, cy - 5); ctx.lineTo(cx + r * 1.5, cy); ctx.lineTo(cx + r * 1.5 - 6, cy + 5);
        ctx.stroke();
      } else if (special === SPECIAL.COL) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 1.5); ctx.lineTo(cx, cy + r * 1.5);
        ctx.moveTo(cx - 5, cy - r * 1.5 + 6); ctx.lineTo(cx, cy - r * 1.5); ctx.lineTo(cx + 5, cy - r * 1.5 + 6);
        ctx.moveTo(cx - 5, cy + r * 1.5 - 6); ctx.lineTo(cx, cy + r * 1.5); ctx.lineTo(cx + 5, cy + r * 1.5 - 6);
        ctx.stroke();
      } else if (special === SPECIAL.NOVA) {
        // 超新星：脉冲外环
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1.15 + 0.18 * Math.sin(pulse * 6)), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function drawDarkCell(cx, cy, r, scene) {
    const p = scenePalette(scene);
    ctx.save();
    ctx.fillStyle = 'rgba(8, 6, 16, 0.72)';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.strokeStyle = p.frame + '88';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
    // 暗物质旋涡纹理
    ctx.strokeStyle = 'rgba(160, 120, 220, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0.3, 4.4);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- 主绘制 ----------
  function draw(run, alpha = 1) {
    state.time += 1 / 60;
    const hud = run && run.getHud ? run.getHud() : null;
    const scene = hud ? hud.scene : 0;
    const grid = run ? run.grid : null;
    const L = layout();

    drawBackground(scene);

    // 版面底
    const p = scenePalette(scene);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(L.x - 12, L.y - 12, L.bw + 24, L.bh + 24);
    ctx.strokeStyle = p.frame;
    ctx.lineWidth = 2;
    ctx.shadowColor = p.frame;
    ctx.shadowBlur = 12;
    ctx.strokeRect(L.x - 12, L.y - 12, L.bw + 24, L.bh + 24);
    ctx.shadowBlur = 0;

    // 单元格
    for (let r = 0; r < L.rows; r += 1) {
      for (let c = 0; c < L.cols; c += 1) {
        const x = L.x + c * (L.cell + L.gap);
        const y = L.y + r * (L.cell + L.gap);
        ctx.fillStyle = p.grid;
        ctx.fillRect(x, y, L.cell, L.cell);
      }
    }

    // 重力反转提示（星屑从底部回落时，版面顶部加一条流光）
    if (hud && hud.gravity === GRAVITY.UP) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(L.x - 12, L.y - 12);
      ctx.lineTo(L.x + L.bw + 12, L.y - 12);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 星屑
    if (grid) {
      for (let i = 0; i < grid.length; i += 1) {
        const cell = grid[i];
        if (!cell) continue;
        const { x, y } = cellCenter(i);
        if (cell.dark) {
          drawDarkCell(x, y, L.cell / 2 - 2, scene);
          continue;
        }
        const color = p.colors[cell.color % p.colors.length];
        const shape = SHAPES[cell.color % SHAPES.length];
        const selected = state.selection === i;
        const hovered = state.hover === i;
        if (selected) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.beginPath();
          ctx.arc(x, y, L.cell / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (hovered) {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.arc(x, y, L.cell / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        drawStar(x, y, L.cell / 2 - 5, color, shape, cell.special, state.time);
      }
    }

    // 透镜选区高亮
    if (state.lens && grid) {
      const a = state.lens.a; const b = state.lens.b;
      for (const i of [a, b]) {
        if (i == null) continue;
        const { x, y } = cellCenter(i);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 12;
        ctx.strokeRect(x - L.cell / 2, y - L.cell / 2, L.cell, L.cell);
        ctx.shadowBlur = 0;
      }
    }

    // 粒子
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r * pt.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 飘分
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';

    // 超新星白闪
    if (state.novaFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, state.novaFlash)})`;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
  }

  // ---------- 特效 API ----------
  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      state.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 2 + Math.random() * 3.5,
        life: 1,
        color,
      });
    }
    if (state.particles.length > 260) state.particles.splice(0, state.particles.length - 260);
  }

  function tickParticles() {
    for (const pt of state.particles) {
      pt.x += pt.vx / 60;
      pt.y += pt.vy / 60;
      pt.vy += 60 / 60;
      pt.life -= 0.045;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const f of state.floaters) {
      f.y -= 0.8;
      f.life -= 0.02;
    }
    state.floaters = state.floaters.filter((f) => f.life > 0);
    if (state.novaFlash > 0) state.novaFlash = Math.max(0, state.novaFlash - 0.06);
  }

  return {
    draw,
    burst,
    tick: tickParticles,
    setSelection: (i) => { state.selection = i; },
    setHover: (i) => { state.hover = i; },
    setLens: (l) => { state.lens = l; },
    flashNova: () => { state.novaFlash = 1; },
    addFloater: (x, y, text, color) => {
      state.floaters.push({ x, y, text, life: 1, color });
      if (state.floaters.length > 24) state.floaters.splice(0, state.floaters.length - 24);
    },
    layout,
    cellCenter,
  };
}
