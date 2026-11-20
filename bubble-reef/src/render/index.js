// src/render/index.js — Canvas2D 渲染：场景包背景 + 发光水母泡 + 潮汐炮台 + 弹道 + 粒子。
// 泡泡用离屏 sprite 预渲染（每色一张），避免每帧重建径向渐变。
import {
  WORLD, BUBBLE_R, BUBBLE_DIAM, TOP_Y, DEATH_Y, SHOOTER, MAX_AIM, X0, COLS,
  colsInRow, parityOf, rowColToPos, rowX, rowY,
} from '../../config/gameplay.js';
import { themeFor, bubbleColor, ROCK_COLOR, GOLD_GLOW, BUBBLE_COLORS } from './theme.js';
import { traceShot } from '../game/grid.js';

const SPRITE = 4 * BUBBLE_R;   // 96px 离屏 sprite

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function makeBubbleSprite(colorId) {
  const c = makeCanvas(SPRITE);
  const g = c.getContext('2d');
  const cx = SPRITE / 2;
  const cy = SPRITE / 2;
  const col = bubbleColor(colorId);
  const R = BUBBLE_R;

  // 外发光
  const glow = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.9);
  glow.addColorStop(0, col.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, SPRITE, SPRITE);

  // 本体（径向渐变，左上高光）
  const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
  body.addColorStop(0, col.light);
  body.addColorStop(0.55, col.core);
  body.addColorStop(1, col.core);
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();

  // 水母钟顶高光
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(cx - R * 0.3, cy - R * 0.45, R * 0.28, R * 0.18, -0.6, 0, Math.PI * 2);
  g.fill();

  // 触须（3 条短线）
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 2;
  for (let i = -1; i <= 1; i += 1) {
    g.beginPath();
    g.moveTo(cx + i * R * 0.4, cy + R * 0.8);
    g.quadraticCurveTo(cx + i * R * 0.55, cy + R * 1.35, cx + i * R * 0.35, cy + R * 1.6);
    g.stroke();
  }
  return c;
}

function makeRockSprite() {
  const c = makeCanvas(SPRITE);
  const g = c.getContext('2d');
  const cx = SPRITE / 2;
  const cy = SPRITE / 2;
  const R = BUBBLE_R;
  g.fillStyle = ROCK_COLOR.glow;
  g.beginPath();
  g.arc(cx, cy, R * 1.4, 0, Math.PI * 2);
  g.fill();
  const body = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
  body.addColorStop(0, ROCK_COLOR.light);
  body.addColorStop(1, ROCK_COLOR.core);
  g.fillStyle = body;
  g.beginPath();
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    const rr = R * (i % 2 === 0 ? 1 : 0.88);
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  g.stroke();
  return c;
}

function makeWildcardSprite(t = 0) {
  const c = makeCanvas(SPRITE);
  const g = c.getContext('2d');
  const cx = SPRITE / 2;
  const cy = SPRITE / 2;
  const R = BUBBLE_R;
  const hue = (t * 60) % 360;
  const glow = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.9);
  glow.addColorStop(0, `hsla(${hue},90%,70%,0.6)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, SPRITE, SPRITE);
  // 彩虹环
  for (let k = 0; k < 6; k += 1) {
    g.strokeStyle = `hsl(${(hue + k * 60) % 360},90%,65%)`;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, R * 0.6, (k / 6) * Math.PI * 2, ((k + 0.5) / 6) * Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(cx, cy, R * 0.45, 0, Math.PI * 2);
  g.fill();
  return c;
}

function makeDecorations(theme, pack) {
  const deco = [];
  const rng = mulberryLite(pack.length * 131 + 7);
  if (pack === 'shallow') {
    for (let i = 0; i < 8; i += 1) {
      deco.push({ kind: 'coral', x: rng() * WORLD.WIDTH, y: WORLD.HEIGHT - 30 - rng() * 40, s: 0.6 + rng() * 0.8, c: theme.deco[i % 3] });
    }
  } else if (pack === 'night') {
    for (let i = 0; i < 26; i += 1) {
      deco.push({ kind: 'glow', x: rng() * WORLD.WIDTH, y: 60 + rng() * 500, s: 1 + rng() * 2, c: theme.deco[i % 3] });
    }
  } else {
    deco.push({ kind: 'mast', x: WORLD.WIDTH * 0.82, y: 0, s: 1, c: theme.deco[2] });
    deco.push({ kind: 'hull', x: WORLD.WIDTH * 0.7, y: 40, s: 1, c: theme.deco[1] });
    for (let i = 0; i < 10; i += 1) {
      deco.push({ kind: 'rust', x: rng() * WORLD.WIDTH, y: 60 + rng() * 520, s: 0.6 + rng() * 0.8, c: theme.deco[i % 3] });
    }
  }
  return deco;
}

function mulberryLite(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const sprites = {};
  for (const c of BUBBLE_COLORS) sprites[c.id] = makeBubbleSprite(c.id);
  sprites.rock = makeRockSprite();

  const decorations = {};
  const packs = ['shallow', 'night', 'wreck'];
  for (const pack of packs) decorations[pack] = makeDecorations(themeFor(pack), pack);

  let particles = [];
  let shake = 0;
  let t = 0;

  function drawBackground(theme, pack, time) {
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    grad.addColorStop(0, theme.bgTop);
    grad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 海面微光 + 悬浮尘
    ctx.fillStyle = theme.bubbleTint;
    for (let i = 0; i < 40; i += 1) {
      const px = ((i * 137.5 + time * 6) % WORLD.WIDTH + WORLD.WIDTH) % WORLD.WIDTH;
      const py = ((i * 211.3 + time * 10) % WORLD.HEIGHT + WORLD.HEIGHT) % WORLD.HEIGHT;
      ctx.beginPath();
      ctx.arc(px, py, 1.2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const d of decorations[pack]) {
      ctx.save();
      if (d.kind === 'coral') {
        ctx.strokeStyle = d.c;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (let b = 0; b < 3; b += 1) {
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.quadraticCurveTo(d.x + (b - 1) * 22 * d.s, d.y - 40 * d.s, d.x + (b - 1) * 26 * d.s, d.y - 60 * d.s);
          ctx.stroke();
        }
      } else if (d.kind === 'glow') {
        const pulse = 0.5 + 0.5 * Math.sin(time * 1.5 + d.x);
        ctx.fillStyle = d.c;
        ctx.globalAlpha = 0.25 * pulse + 0.1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.s * 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.kind === 'mast') {
        ctx.strokeStyle = d.c;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y + 220);
        ctx.stroke();
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(d.x - 80, d.y + 70);
        ctx.lineTo(d.x + 80, d.y + 40);
        ctx.stroke();
      } else if (d.kind === 'hull') {
        ctx.fillStyle = d.c;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(d.x - 220, d.y);
        ctx.quadraticCurveTo(d.x, d.y + 90, d.x + 260, d.y + 10);
        ctx.lineTo(d.x + 200, d.y + 40);
        ctx.lineTo(d.x - 180, d.y + 50);
        ctx.closePath();
        ctx.fill();
      } else if (d.kind === 'rust') {
        ctx.fillStyle = d.c;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.s * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawBubbleAt(x, y, r, colorId, gold, time, scale = 1) {
    const sprite = sprites[colorId] || sprites[1];
    const s = SPRITE * scale;
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
    if (gold) {
      ctx.strokeStyle = GOLD_GLOW;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 4 + Math.sin(time * 4 + x) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGrid(run, time) {
    for (let r = 0; r < run.grid.length; r += 1) {
      const row = run.grid[r];
      if (!row) continue;
      const pr = parityOf(run.parities, r);
      for (let c = 0; c < row.length; c += 1) {
        const cell = row[c];
        if (!cell) continue;
        const p = rowColToPos(pr, r, c);
        if (cell.c === 0) {
          ctx.save();
          if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
          ctx.drawImage(sprites.rock, p.x - SPRITE / 2, p.y - SPRITE / 2, SPRITE, SPRITE);
          ctx.restore();
        } else {
          drawBubbleAt(p.x, p.y, BUBBLE_R, cell.c, cell.gold, time);
        }
      }
    }
  }

  function drawCannon(run, time) {
    const theme = themeFor(run.level.pack);
    const sx = SHOOTER.x;
    const sy = SHOOTER.y;
    const angle = run.aimAngle;

    // 底座
    ctx.fillStyle = theme.cannon;
    ctx.beginPath();
    ctx.arc(sx, sy + 6, 34, 0, Math.PI * 2);
    ctx.fill();

    // 旋转炮管
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.fillStyle = theme.cannon;
    ctx.strokeStyle = theme.cannonGlow;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(0, -52);
    ctx.lineTo(14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 炮口高光
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(0, -52, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 当前待发射泡泡（炮口）
    if (run.current) {
      const px = sx + Math.sin(angle) * 66;
      const py = sy - Math.cos(angle) * 66;
      if (run.current.wildcard) {
        const w = makeWildcardSprite(time);
        ctx.drawImage(w, px - SPRITE / 2, py - SPRITE / 2, SPRITE, SPRITE);
      } else {
        drawBubbleAt(px, py, BUBBLE_R * 0.72, run.current.c, false, time, 0.72);
      }
    }
  }

  function drawAim(run) {
    if (run.flying) return;
    const theme = themeFor(run.level.pack);
    const angle = run.aimAngle;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const sx = SHOOTER.x;
    const sy = SHOOTER.y;

    ctx.strokeStyle = theme.cannonGlow;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(sx + dx * 66, sy + dy * 66);
    ctx.lineTo(sx + dx * 170, sy + dy * 170);
    ctx.stroke();
    ctx.setLineDash([]);

    if (run.previewActive) {
      const tr = traceShot(run.grid, run.parities, angle, { drift: run.level.drift });
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      for (let i = 0; i < tr.points.length; i += 1) {
        const p = tr.points[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (tr.landing) {
        const p = rowColToPos(parityOf(run.parities, tr.landing.row), tr.landing.row, tr.landing.col);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, BUBBLE_R + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function burst(x, y, kind) {
    let palette;
    if (kind === 'wildcard') palette = ['#ff6ec7', '#ffd93b', '#5ce87a', '#37d6ff', '#b58cff'];
    else if (kind === 'gold') palette = ['#ffd93b', '#fff3c0', '#ffb020'];
    else palette = ['#7ff0ff', '#b7f6ff', '#5ce87a', '#ffd93b'];
    const n = kind === 'drop' ? 14 : 8;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: kind === 'drop' ? -40 - Math.random() * 60 : Math.sin(a) * sp,
        g: kind === 'drop' ? -20 : 160,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        size: 2 + Math.random() * 3,
        color: palette[i % palette.length],
      });
    }
  }

  function draw(run, alpha = 1) {
    t += 1 / 60;
    const pack = run ? run.level.pack : 'shallow';
    const theme = themeFor(pack);
    drawBackground(theme, pack, t);

    if (run) {
      // 天花板 + 触底线
      ctx.strokeStyle = theme.ceiling;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(X0 - 10, TOP_Y + BUBBLE_R - 2);
      ctx.lineTo(X0 + COLS * BUBBLE_DIAM + 10, TOP_Y + BUBBLE_R - 2);
      ctx.stroke();

      ctx.strokeStyle = theme.deathLine;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(40, DEATH_Y);
      ctx.lineTo(WORLD.WIDTH - 40, DEATH_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      drawGrid(run, t);
      if (run.flying) {
        const f = run.flying;
        if (f.wildcard) {
          const w = makeWildcardSprite(t);
          ctx.drawImage(w, f.x - SPRITE / 2, f.y - SPRITE / 2, SPRITE, SPRITE);
        } else {
          drawBubbleAt(f.x, f.y, BUBBLE_R, f.c, false, t);
        }
      }
      drawCannon(run, t);
      drawAim(run);
    }

    drawParticles(1 / 60);
  }

  return { draw, burst, setShake: (v) => { shake = v; } };
}
