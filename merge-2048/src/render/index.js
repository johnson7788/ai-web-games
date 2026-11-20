// MERGE 2048 · Canvas 2D 渲染：三场景星野 + 4×4/3×4 舰队盘 + 引力井 + 跃迁粒子
// 数字=殖民舰吨位；合并瞬间跃迁光轨（signature）；锁定舰带红色锁环。
import { WORLD } from '../../config/game.config.js';
import { THEMES, tileColor, emblemFor } from './theme.js';

const BOARD_TOP = 150;
const BOARD_H = 500;
const PAD = 12;

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const state = {
    run: null,
    tiles: new Map(),     // id -> {x,y,tx,ty,scale,alpha,value,locked,pop}
    particles: [],        // {x,y,vx,vy,life,maxLife,color,size}
    stars: [],
    starTheme: null,
    selection: [],        // warp 选中的 [[r,c],...]
    time: 0,
  };

  function theme() {
    const decor = state.run?.level?.decor || 'orbit';
    return THEMES[decor] || THEMES.orbit;
  }

  function boardMetrics() {
    const run = state.run;
    const rows = run?.rows || 4;
    const cols = run?.cols || 4;
    const boardW = BOARD_H * cols / rows;
    const boardX = (WORLD.WIDTH - boardW) / 2;
    const cellW = (boardW - PAD * (cols + 1)) / cols;
    const cellH = (BOARD_H - PAD * (rows + 1)) / rows;
    return { boardX, boardY: BOARD_TOP, boardW, boardH: BOARD_H, cellW, cellH, rows, cols };
  }

  function cellCenter(r, c) {
    const m = boardMetrics();
    return {
      x: m.boardX + PAD + m.cellW * (c + 0.5),
      y: m.boardY + PAD + m.cellH * (r + 0.5),
    };
  }

  function ensureStars() {
    const t = theme();
    if (state.starTheme === t) return;
    state.starTheme = t;
    state.stars = [];
    for (let i = 0; i < 90; i += 1) {
      state.stars.push({
        x: Math.random() * WORLD.WIDTH,
        y: Math.random() * BOARD_TOP + Math.random() * 30,
        r: 0.4 + Math.random() * 1.4,
        c: t.star[Math.floor(Math.random() * t.star.length)],
        tw: 0.5 + Math.random() * 2,
      });
    }
  }

  function syncTiles() {
    const run = state.run;
    if (!run) return;
    const seen = new Set();
    for (let r = 0; r < run.rows; r += 1) {
      for (let c = 0; c < run.cols; c += 1) {
        const t = run.grid[r][c];
        if (!t) continue;
        const p = cellCenter(r, c);
        let e = state.tiles.get(t.id);
        if (!e) {
          e = { x: p.x, y: p.y, tx: p.x, ty: p.y, scale: 0, alpha: 1, value: t.value, locked: !!t.locked, pop: 0 };
          state.tiles.set(t.id, e);
        }
        e.tx = p.x;
        e.ty = p.y;
        e.value = t.value;
        e.locked = !!t.locked;
        if (t.mergedFrom) e.pop = 1;
        seen.add(t.id);
      }
    }
    for (const [id, e] of state.tiles) {
      if (!seen.has(id)) {
        e.alpha -= 0.18;
        if (e.alpha <= 0) state.tiles.delete(id);
      }
    }
  }

  function updateTiles() {
    for (const e of state.tiles.values()) {
      e.x += (e.tx - e.x) * 0.24;
      e.y += (e.ty - e.y) * 0.24;
      e.scale += (1 - e.scale) * 0.22;
      if (e.pop > 0) e.pop = Math.max(0, e.pop - 0.06);
    }
  }

  function updateParticles() {
    const out = [];
    for (const p of state.particles) {
      p.life -= 1 / 60;
      if (p.life <= 0) continue;
      p.x += p.vx / 60;
      p.y += p.vy / 60;
      p.vx *= 0.96;
      p.vy *= 0.96;
      out.push(p);
    }
    state.particles = out;
  }

  function drawBackground() {
    const t = theme();
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, t.bgTop);
    g.addColorStop(1, t.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    ensureStars();
    ctx.save();
    for (const s of state.stars) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(state.time * s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBoard() {
    const t = theme();
    const m = boardMetrics();
    const run = state.run;

    ctx.fillStyle = t.board;
    roundRect(ctx, m.boardX - 8, m.boardY - 8, m.boardW + 16, m.boardH + 16, 18);
    ctx.fill();

    for (let r = 0; r < m.rows; r += 1) {
      for (let c = 0; c < m.cols; c += 1) {
        const x = m.boardX + PAD + m.cellW * c;
        const y = m.boardY + PAD + m.cellH * r;
        const blocked = run?.blocked.has(r + ':' + c);
        const isGravity = run?.gravity && run.gravity.row === r && run.gravity.col === c;
        ctx.fillStyle = blocked ? 'rgba(0,0,0,0.4)' : (isGravity ? 'rgba(120,30,90,0.55)' : t.cellEmpty);
        roundRect(ctx, x, y, m.cellW, m.cellH, 10);
        ctx.fill();
        ctx.strokeStyle = t.gridLine;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (blocked) {
          ctx.strokeStyle = t.accentDim;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + m.cellW * 0.3, y + m.cellH * 0.3);
          ctx.lineTo(x + m.cellW * 0.7, y + m.cellH * 0.7);
          ctx.moveTo(x + m.cellW * 0.7, y + m.cellH * 0.3);
          ctx.lineTo(x + m.cellW * 0.3, y + m.cellH * 0.7);
          ctx.stroke();
        }
        if (isGravity) drawGravityWell(x + m.cellW / 2, y + m.cellH / 2, Math.min(m.cellW, m.cellH) * 0.42);
      }
    }
  }

  function drawGravityWell(cx, cy, radius) {
    const t = theme();
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 3; i += 1) {
      const a = state.time * 2 + i * 2.1;
      ctx.strokeStyle = i === 1 ? t.gold : t.accentDim;
      ctx.lineWidth = 2 + i;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(a);
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.4 + i * 0.22), a, a + Math.PI * 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTile(e) {
    const t = theme();
    const m = boardMetrics();
    const size = Math.min(m.cellW, m.cellH) * 0.86;
    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.x, e.y);
    const s = e.scale * (1 + e.pop * 0.18);
    ctx.scale(s, s);
    ctx.fillStyle = tileColor(e.value);
    roundRect(ctx, -size / 2, -size / 2, size, size, 10);
    ctx.fill();

    // 高值舰发光
    if (e.value >= 128) {
      ctx.shadowColor = tileColor(e.value);
      ctx.shadowBlur = 18;
      roundRect(ctx, -size / 2, -size / 2, size, size, 10);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 吨位数字
    ctx.fillStyle = t.tileText;
    const fs = e.value >= 1000 ? size * 0.3 : e.value >= 100 ? size * 0.36 : size * 0.44;
    ctx.font = `700 ${fs}px 'Segoe UI', 'PingFang SC', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(e.value), 0, -size * 0.04);

    // 吨位徽记
    ctx.font = `${size * 0.16}px monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(emblemFor(e.value), 0, size * 0.3);

    // 锁定舰：红色锁环
    if (e.locked) {
      ctx.strokeStyle = t.tileLock;
      ctx.lineWidth = 3;
      ctx.shadowColor = t.tileLock;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function drawSelection() {
    const t = theme();
    const m = boardMetrics();
    for (const [r, c] of state.selection) {
      const x = m.boardX + PAD + m.cellW * c;
      const y = m.boardY + PAD + m.cellH * r;
      ctx.strokeStyle = t.gold;
      ctx.lineWidth = 3;
      ctx.shadowColor = t.gold;
      ctx.shadowBlur = 14;
      roundRect(ctx, x - 2, y - 2, m.cellW + 4, m.cellH + 4, 12);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of state.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    setRun(run) { state.run = run; syncTiles(); },
    draw(alpha) {
      state.time += 1 / 60;
      updateTiles();
      updateParticles();
      drawBackground();
      drawBoard();
      for (const e of state.tiles.values()) drawTile(e);
      drawSelection();
      drawParticles();
    },
    cellAt(px, py) {
      const m = boardMetrics();
      const relX = px - m.boardX;
      const relY = py - m.boardY;
      if (relX < 0 || relY < 0 || relX > m.boardW || relY > m.boardH) return null;
      const c = Math.floor(relX / ((m.boardW) / m.cols));
      const r = Math.floor(relY / ((m.boardH) / m.rows));
      if (r < 0 || c < 0 || r >= m.rows || c >= m.cols) return null;
      return { r, c };
    },
    onEvent(ev) {
      const t = theme();
      if (ev.type === 'merge' || ev.type === 'warp') {
        const p = cellCenter(ev.row, ev.col);
        const color = ev.type === 'warp' ? t.gold : t.accent;
        for (let i = 0; i < 14; i += 1) {
          const ang = (i / 14) * Math.PI * 2 + Math.random();
          const sp = 120 + Math.random() * 260;
          state.particles.push({
            x: p.x, y: p.y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
            color, size: 1.5 + Math.random() * 2.5,
          });
        }
        // 跃迁光轨：一条横扫的光束
        if (ev.type === 'warp') {
          state.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, color: '#ffffff', size: 3 });
        }
      } else if (ev.type === 'gravitySpawn') {
        const p = cellCenter(ev.row, ev.col);
        for (let i = 0; i < 10; i += 1) {
          state.particles.push({
            x: p.x + (Math.random() - 0.5) * 60, y: p.y + (Math.random() - 0.5) * 60,
            vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
            life: 0.6, maxLife: 0.6, color: t.gold, size: 1.5,
          });
        }
      }
    },
    setSelection(cells) { state.selection = cells || []; },
    debugLayout() {
      const m = boardMetrics();
      return { board: { x: m.boardX, y: m.boardY, w: m.boardW, h: m.boardH }, cols: m.cols, rows: m.rows };
    },
  };
}

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
