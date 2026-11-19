// Canvas 2D 渲染：霓虹街机星域 + 程序化星体宝石 + 岩石 + 粒子/震屏。
// 零素材：所有视觉均由 canvas 程序化绘制；宝石/岩石/背景预烘焙成离屏 sprite，保证 ≥50 FPS。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const CELL = LAYOUT.CELL;
const BX = LAYOUT.BOARD_X;
const BY = LAYOUT.BOARD_Y;
const ROCK = GAME.ROCK_TYPE;

const STAR_COLORS = {
  1: '#2de2ff',
  2: '#ff4fd8',
  3: '#ffe14d',
  4: '#43ff9d',
  5: '#ff8a3d',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 80);
  const g = Math.min(255, ((n >> 8) & 255) + 80);
  const b = Math.min(255, (n & 255) + 80);
  return `rgb(${r},${g},${b})`;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function makeGemSprite(color, selected) {
  const c = makeCanvas(CELL, CELL);
  const g = c.getContext('2d');
  const cx = CELL / 2;
  const cy = CELL / 2;
  const r = (CELL - 14) / 2;

  // 霓虹光晕（径向渐变烘焙，避免逐帧 shadowBlur）
  const glow = g.createRadialGradient(cx, cy, r * 0.35, cx, cy, CELL * 0.52);
  glow.addColorStop(0, rgba(color, selected ? 0.85 : 0.5));
  glow.addColorStop(1, rgba(color, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, CELL, CELL);

  // 宝石主体
  const grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, lighten(color));
  grad.addColorStop(1, color);
  g.fillStyle = grad;
  roundRect(g, cx - r, cy - r, r * 2, r * 2, r * 0.34);
  g.fill();

  if (selected) {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    roundRect(g, cx - r, cy - r, r * 2, r * 2, r * 0.34);
    g.stroke();
  }

  // 中心四角星光
  g.fillStyle = 'rgba(255,255,255,0.92)';
  const s = r * 0.34;
  g.beginPath();
  g.moveTo(cx, cy - s);
  g.quadraticCurveTo(cx + s * 0.18, cy - s * 0.18, cx + s, cy);
  g.quadraticCurveTo(cx + s * 0.18, cy + s * 0.18, cx, cy + s);
  g.quadraticCurveTo(cx - s * 0.18, cy + s * 0.18, cx - s, cy);
  g.quadraticCurveTo(cx - s * 0.18, cy - s * 0.18, cx, cy - s);
  g.fill();

  return c;
}

function makeRockSprite() {
  const c = makeCanvas(CELL, CELL);
  const g = c.getContext('2d');
  const cx = CELL / 2;
  const cy = CELL / 2;
  const r = (CELL - 12) / 2;

  const glow = g.createRadialGradient(cx, cy, r * 0.4, cx, cy, CELL * 0.5);
  glow.addColorStop(0, 'rgba(120,126,140,0.35)');
  glow.addColorStop(1, 'rgba(120,126,140,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, CELL, CELL);

  const grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, '#6b7280');
  grad.addColorStop(1, '#3a3f4b');
  g.fillStyle = grad;
  roundRect(g, cx - r, cy - r, r * 2, r * 2, r * 0.28);
  g.fill();

  g.strokeStyle = '#23262e';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - r * 0.5, cy - r * 0.4);
  g.lineTo(cx - r * 0.1, cy);
  g.lineTo(cx - r * 0.5, cy + r * 0.45);
  g.moveTo(cx + r * 0.15, cy - r * 0.45);
  g.lineTo(cx + r * 0.05, cy + r * 0.1);
  g.lineTo(cx + r * 0.4, cy + r * 0.5);
  g.stroke();

  return c;
}

function makeBackground() {
  const c = makeCanvas(WORLD.WIDTH, WORLD.HEIGHT);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  grad.addColorStop(0, '#070714');
  grad.addColorStop(0.55, '#0d0a24');
  grad.addColorStop(1, '#160a2e');
  g.fillStyle = grad;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  for (let i = 0; i < 90; i += 1) {
    const x = Math.random() * WORLD.WIDTH;
    const y = Math.random() * WORLD.HEIGHT;
    const r = 0.6 + Math.random() * 1.6;
    g.globalAlpha = 0.3 + Math.random() * 0.5;
    g.fillStyle = '#cfe9ff';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  const hg = g.createLinearGradient(0, 0, 0, 90);
  hg.addColorStop(0, 'rgba(120, 80, 255, 0.16)');
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hg;
  g.fillRect(0, 0, WORLD.WIDTH, 90);
  return c;
}

function makeBoardBase() {
  const w = GAME.GRID * CELL + 24;
  const c = makeCanvas(w, w);
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10, 10, 30, 0.55)';
  roundRect(g, 0, 0, w, w, 16);
  g.fill();
  g.strokeStyle = 'rgba(140, 120, 255, 0.35)';
  g.lineWidth = 2;
  roundRect(g, 0, 0, w, w, 16);
  g.stroke();

  for (let x = 0; x < GAME.GRID; x += 1) {
    for (let y = 0; y < GAME.GRID; y += 1) {
      const px = 12 + x * CELL;
      const py = 12 + y * CELL;
      g.fillStyle = 'rgba(255,255,255,0.028)';
      roundRect(g, px + 3, py + 3, CELL - 6, CELL - 6, 10);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.lineWidth = 1;
      roundRect(g, px + 3, py + 3, CELL - 6, CELL - 6, 10);
      g.stroke();
    }
  }
  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const background = makeBackground();
  const boardBase = makeBoardBase();
  const gemSprites = {};
  for (const t of Object.keys(STAR_COLORS)) {
    gemSprites[t] = makeGemSprite(STAR_COLORS[t], false);
    gemSprites[`${t}-sel`] = makeGemSprite(STAR_COLORS[t], true);
  }
  const rockSprite = makeRockSprite();

  const particles = [];
  let shake = 0;
  let reducedMotion = false;
  let flash = 0;

  function onEvent(e) {
    if (!e) return;
    if (e.type === 'pop' || e.type === 'rockBreak') {
      shake = reducedMotion ? 0 : Math.min(shake + (e.type === 'pop' ? 4 : 2.5), 9);
      flash = reducedMotion ? 0 : Math.min(flash + 0.16, 0.38);
    }
    if (e.type === 'win' || e.type === 'levelClear') {
      flash = reducedMotion ? 0 : Math.min(flash + 0.28, 0.5);
    }
  }

  function spawnPop(cells, type) {
    if (reducedMotion) return;
    const color = STAR_COLORS[type] || '#ffffff';
    const n = Math.min(cells.length * 2, 80);
    for (let i = 0; i < n; i += 1) {
      const c0 = cells[i % cells.length];
      particles.push({
        x: BX + c0[0] * CELL + CELL / 2,
        y: BY + (GAME.GRID - 1 - c0[1]) * CELL + CELL / 2,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.7) * 6,
        life: 0.5 + Math.random() * 0.4,
        age: 0,
        size: 2 + Math.random() * 4,
        color,
      });
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render(sim) {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (shake > 0.05) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.85;
    } else {
      shake = 0;
    }

    ctx.drawImage(background, 0, 0);
    ctx.drawImage(boardBase, BX - 12, BY - 12);

    if (sim) {
      const selectedSet = new Set();
      if (sim.selected) for (const [x, y] of sim.selected) selectedSet.add(`${x},${y}`);

      for (let x = 0; x < GAME.GRID; x += 1) {
        for (let y = 0; y < GAME.GRID; y += 1) {
          const v = sim.grid[x][y];
          if (v === 0) continue;
          const px = BX + x * CELL;
          const py = BY + (GAME.GRID - 1 - y) * CELL;
          if (v === ROCK) {
            ctx.drawImage(rockSprite, px, py);
          } else {
            const key = selectedSet.has(`${x},${y}`) ? `${v}-sel` : `${v}`;
            ctx.drawImage(gemSprites[key], px, py);
          }
        }
      }

      if (sim.selected && sim.selected.length >= 2) {
        const size = sim.selected.length;
        const preview = size * size * GAME.BASE_SCORE;
        const cx = BX + (sim.selected.reduce((a, cc) => a + cc[0], 0) / size) * CELL + CELL / 2;
        const topY = Math.min(...sim.selected.map((cc) => GAME.GRID - 1 - cc[1]));
        const cy = BY + topY * CELL - 6;
        ctx.font = '700 20px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`+${preview}`, cx, cy);
      }
    }

    drawParticles(1 / 60);

    if (flash > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(flash, 0.5)})`;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      flash *= 0.86;
    } else {
      flash = 0;
    }

    ctx.restore();
  }

  return {
    render,
    onEvent,
    spawnPop,
    setReducedMotion(v) { reducedMotion = !!v; },
    particles,
  };
}
