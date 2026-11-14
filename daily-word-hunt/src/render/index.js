// Canvas 2D 渲染：字母网格 + 荧光笔划线（选中/已找到）+ 词表面板 + 反馈粒子。
import { WORLD, GRID, LIST, COLORS } from '../../config/game.config.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const CELL = GRID.CELL;

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function cellRect(r, c) {
  return { x: GRID.X + c * CELL, y: GRID.Y + r * CELL, w: CELL, h: CELL };
}
function cellCenter(r, c) {
  return { x: GRID.X + c * CELL + CELL / 2, y: GRID.Y + r * CELL + CELL / 2 };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];
  const popups = [];
  let shakeT = 0;
  let shakeMag = 0;

  function burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 200;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50, life: 0.5 + Math.random() * 0.3, t: 0, color, size: 3 + Math.random() * 4 });
    }
  }
  function popup(text, x, y, color = COLORS.accent, big = false) {
    popups.push({ text, x, y, color, t: 0, life: big ? 1.1 : 0.8, big });
  }
  function shake(mag = 6) { shakeMag = Math.max(shakeMag, mag); shakeT = 0.24; }
  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.vy += 480 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      popups[i].t += dt;
      if (popups[i].t >= popups[i].life) popups.splice(i, 1);
    }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt); else shakeMag = 0;
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(340, 360, 60, 640, 360, 880);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function capsule(cells, color, width) {
    if (cells.length === 0) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const a = cellCenter(cells[0].r, cells[0].c);
    ctx.moveTo(a.x, a.y);
    for (let i = 1; i < cells.length; i += 1) {
      const p = cellCenter(cells[i].r, cells[i].c);
      ctx.lineTo(p.x, p.y);
    }
    if (cells.length === 1) ctx.lineTo(a.x + 0.1, a.y);
    ctx.stroke();
  }

  function drawGrid(run, view) {
    const sel = view.selection || [];
    const selSet = new Set(sel.map(({ r, c }) => `${r},${c}`));
    const now = view.now || 0;
    const hint = view.hintFlash && now < view.hintFlash.until ? view.hintFlash.cell : null;

    // 格子底
    for (let r = 0; r < run.size; r += 1) {
      for (let c = 0; c < run.size; c += 1) {
        const { x, y } = cellRect(r, c);
        const isFound = run.foundCells.has(`${r},${c}`);
        const isSel = selSet.has(`${r},${c}`);
        ctx.fillStyle = isFound ? 'rgba(251,191,36,0.16)' : (isSel ? 'rgba(134,239,172,0.16)' : COLORS.cell);
        roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.fill();
        ctx.strokeStyle = COLORS.cellEdge;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    // 已找到词的荧光笔
    for (const { word, cells } of run.words) {
      if (run.found.has(word)) capsule(cells, COLORS.found, CELL * 0.66);
    }
    // 当前选中荧光笔
    if (sel.length > 0) capsule(sel, COLORS.sel, CELL * 0.7);
    // 提示闪烁
    if (hint) {
      const { x, y } = cellRect(hint.r, hint.c);
      ctx.fillStyle = COLORS.hint;
      roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 8);
      ctx.fill();
    }
    // 字母
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${CELL * 0.5}px ${FONT}`;
    for (let r = 0; r < run.size; r += 1) {
      for (let c = 0; c < run.size; c += 1) {
        const p = cellCenter(r, c);
        const isFound = run.foundCells.has(`${r},${c}`);
        ctx.fillStyle = isFound ? COLORS.gold : COLORS.ink;
        ctx.fillText(run.grid[r][c], p.x, p.y + 1);
      }
    }
  }

  function drawWordList(run, view) {
    ctx.fillStyle = COLORS.panel;
    roundRect(ctx, LIST.X - 16, LIST.Y - 50, LIST.W + 32, LIST.H + 60, 18);
    ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.accent;
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText(view.listTitle || '', LIST.X, LIST.Y - 22);
    ctx.fillStyle = 'rgba(238,246,238,0.6)';
    ctx.font = `600 15px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(view.themeName || '', LIST.X + LIST.W, LIST.Y - 22);

    ctx.textAlign = 'left';
    const colW = LIST.W / 2;
    run.words.forEach(({ word }, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = LIST.X + col * colW + 8;
      const y = LIST.Y + 24 + row * 52;
      const found = run.found.has(word);
      // 状态点
      ctx.fillStyle = found ? COLORS.gold : 'rgba(238,246,238,0.25)';
      ctx.beginPath();
      ctx.arc(x + 8, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = found ? COLORS.gold : COLORS.ink;
      ctx.font = `700 24px ${FONT}`;
      ctx.fillText(word, x + 26, y + 1);
      if (found) {
        const w = ctx.measureText(word).width;
        ctx.strokeStyle = COLORS.gold;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 26, y);
        ctx.lineTo(x + 26 + w, y);
        ctx.stroke();
      }
    });
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      roundRect(ctx, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, 1.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawPopups() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of popups) {
      const k = p.t / p.life;
      const alpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `800 ${(p.big ? 40 : 24)}px ${FONT}`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y - k * 44);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function render(view) {
    const { run } = view;
    ctx.save();
    if (shakeT > 0 && shakeMag > 0) {
      const m = shakeMag * (shakeT / 0.24);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawBackground();
    if (run) {
      drawGrid(run, view);
      drawWordList(run, view);
    }
    drawParticles();
    drawPopups();
    ctx.restore();
  }

  function cellAt(x, y) {
    const c = Math.floor((x - GRID.X) / CELL);
    const r = Math.floor((y - GRID.Y) / CELL);
    if (r < 0 || r >= GRID.SIZE || c < 0 || c >= GRID.SIZE) return null;
    return { r, c };
  }

  function clearEffects() {
    particles.length = 0;
    popups.length = 0;
    shakeT = 0;
    shakeMag = 0;
  }

  return { render, update, burst, popup, shake, cellAt, cellRect, clearEffects };
}