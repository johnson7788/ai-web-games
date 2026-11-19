// SOKO WAREHOUSE · 渲染层（canvas 2D，程序化霓虹街机风，零素材）
// 职责：棋盘/墙/岩石/目标/箱子/玩家 + 辉光 + 粒子 + 震屏。
// 视角：固定棋盘居中，DPR ≤2。

import { LEVELS } from '../../config/levels.js';
import { parseLevel } from '../game/level.js';
import { WORLD, LAYOUT } from '../../config/game.config.js';

const SCENES = {
  'crate-yard': { bg: ['#0b1026', '#0a0e1a'], wall: '#22d3ee', wallGlow: 'rgba(34,211,238,0.55)', floor: '#111831', floorLine: 'rgba(148,163,184,0.08)' },
  'neon-docks': { bg: ['#0d0a1f', '#08060f'], wall: '#818cf8', wallGlow: 'rgba(129,140,248,0.55)', floor: '#16102e', floorLine: 'rgba(148,163,184,0.08)' },
  'plasma-vault': { bg: ['#08150f', '#050d0a'], wall: '#34d399', wallGlow: 'rgba(52,211,153,0.55)', floor: '#0c1f18', floorLine: 'rgba(148,163,184,0.08)' },
};

const BOX_COLOR = '#f97316';
const BOX_ON = '#34d399';
const TARGET_COLOR = '#4ade80';
const ROCK_COLOR = '#c026d3';
const PLAYER_COLOR = '#e0f2fe';

function rr(x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  return { x, y, w, h, rad };
}

function fillRound(ctx, rc) {
  const { x, y, w, h, rad } = rc;
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
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = WORLD.WIDTH;
    const h = WORLD.HEIGHT;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  if (typeof window !== 'undefined') {
    resize();
    window.addEventListener('resize', resize);
  }

  let previewState = null;

  function boardLayout(state) {
    const rows = state.rows;
    const cols = state.cols;
    const availW = WORLD.WIDTH - LAYOUT.PAD_X * 2;
    const availH = WORLD.HEIGHT - LAYOUT.HUD_H - LAYOUT.PAD_Y - LAYOUT.BOARD_BOTTOM_PAD;
    const cell = Math.max(LAYOUT.CELL_MIN, Math.min(LAYOUT.CELL_MAX, Math.floor(Math.min(availW / cols, availH / rows))));
    const bw = cols * cell;
    const bh = rows * cell;
    const x = Math.round((WORLD.WIDTH - bw) / 2);
    const y = Math.round(LAYOUT.HUD_H + LAYOUT.PAD_Y + (availH - bh) / 2);
    return { x, y, w: bw, h: bh, cell };
  }

  function cellRect(lay, r, c) {
    return { x: lay.x + c * lay.cell, y: lay.y + r * lay.cell, w: lay.cell, h: lay.cell };
  }

  function ensurePreview() {
    if (previewState) return previewState;
    const level = LEVELS[0];
    const p = parseLevel(level);
    previewState = {
      level: level.index, phase: 'title', rows: p.rows, cols: p.cols,
      terrain: p.terrain, walls: p.walls, rocks: p.rocks, targets: p.targets,
      player: p.player, boxes: p.boxes.map((b) => ({ id: b.id, r: b.r, c: b.c })),
      boxesOnTarget: 0, moves: 0, par: level.par,
    };
    return previewState;
  }

  function draw(state, dt, view) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = state || ensurePreview();
    const sceneKey = (view && view.sceneKey) || 'crate-yard';
    const scene = SCENES[sceneKey] || SCENES['crate-yard'];
    const lay = boardLayout(s);

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    bg.addColorStop(0, scene.bg[0]);
    bg.addColorStop(1, scene.bg[1]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 扫线/网格（廉价装饰）
    ctx.fillStyle = scene.floorLine;
    for (let gy = 0; gy < WORLD.HEIGHT; gy += 44) ctx.fillRect(0, gy, WORLD.WIDTH, 1);

    // 震屏
    ctx.save();
    if (view && view.shake > 0) {
      ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    }

    // 棋盘底
    ctx.fillStyle = scene.floor;
    ctx.fillRect(lay.x, lay.y, lay.w, lay.h);

    // 网格线
    ctx.strokeStyle = scene.floorLine;
    ctx.lineWidth = 1;
    for (let c = 0; c <= s.cols; c += 1) {
      ctx.beginPath();
      ctx.moveTo(lay.x + c * lay.cell, lay.y);
      ctx.lineTo(lay.x + c * lay.cell, lay.y + lay.h);
      ctx.stroke();
    }
    for (let r = 0; r <= s.rows; r += 1) {
      ctx.beginPath();
      ctx.moveTo(lay.x, lay.y + r * lay.cell);
      ctx.lineTo(lay.x + lay.w, lay.y + r * lay.cell);
      ctx.stroke();
    }

    // 目标格：亮绿圆形泊位 + 白色靶环（圆形 vs 方形货箱，一眼区分）
    const pulse = 0.5 + 0.5 * Math.sin((view ? view.time : 0) * 3);
    for (let r = 0; r < s.rows; r += 1) {
      for (let c = 0; c < s.cols; c += 1) {
        if (!s.terrain[r][c].target) continue;
        const rc = cellRect(lay, r, c);
        const cx = rc.x + rc.w / 2;
        const cy = rc.y + rc.h / 2;
        const hasBox = s.boxes.some((b) => b.r === r && b.c === c);
        ctx.save();
        ctx.shadowColor = TARGET_COLOR;
        ctx.shadowBlur = 16 + pulse * 10;
        ctx.fillStyle = TARGET_COLOR;
        ctx.globalAlpha = hasBox ? 0.95 : 0.85 + pulse * 0.12;
        ctx.beginPath();
        ctx.arc(cx, cy, rc.w * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        // 白色靶环（空泊位 = 目标）
        ctx.strokeStyle = 'rgba(255,255,255,0.98)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rc.w * 0.28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.98)';
        ctx.beginPath();
        ctx.arc(cx, cy, rc.w * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 墙
    for (let r = 0; r < s.rows; r += 1) {
      for (let c = 0; c < s.cols; c += 1) {
        if (s.terrain[r][c].kind !== 'wall') continue;
        const rc = cellRect(lay, r, c);
        ctx.save();
        ctx.shadowColor = scene.wallGlow;
        ctx.shadowBlur = 6;
        ctx.fillStyle = scene.wall;
        const wrc = rr(rc.x + 2, rc.y + 2, rc.w - 4, rc.h - 4, 5);
        fillRound(ctx, wrc);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(8,10,20,0.5)';
        const inner = rr(rc.x + rc.w * 0.22, rc.y + rc.h * 0.22, rc.w * 0.56, rc.h * 0.56, 3);
        fillRound(ctx, inner);
        ctx.fill();
        ctx.restore();
      }
    }

    // 岩石
    for (let r = 0; r < s.rows; r += 1) {
      for (let c = 0; c < s.cols; c += 1) {
        if (s.terrain[r][c].kind !== 'rock') continue;
        const rc = cellRect(lay, r, c);
        ctx.save();
        ctx.shadowColor = 'rgba(192,38,211,0.5)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = ROCK_COLOR;
        // 碎石：不规则多边形
        ctx.beginPath();
        const cx = rc.x + rc.w / 2;
        const cy = rc.y + rc.h / 2;
        const pts = 6;
        for (let i = 0; i < pts; i += 1) {
          const a = (i / pts) * Math.PI * 2;
          const rad = (rc.w * 0.36) * (i % 2 ? 0.72 : 1);
          const px = cx + Math.cos(a) * rad;
          const py = cy + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 箱子
    for (const b of s.boxes) {
      const rc = cellRect(lay, b.r, b.c);
      const onTarget = s.terrain[b.r][b.c].target;
      const col = onTarget ? BOX_ON : BOX_COLOR;
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.fillStyle = col;
      const brc = rr(rc.x + rc.w * 0.14, rc.y + rc.h * 0.14, rc.w * 0.72, rc.h * 0.72, 4);
      fillRound(ctx, brc);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(20,16,10,0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 十字绑带
      ctx.strokeStyle = 'rgba(30,20,12,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rc.x + rc.w * 0.5, rc.y + rc.h * 0.2);
      ctx.lineTo(rc.x + rc.w * 0.5, rc.y + rc.h * 0.8);
      ctx.moveTo(rc.x + rc.w * 0.2, rc.y + rc.h * 0.5);
      ctx.lineTo(rc.x + rc.w * 0.8, rc.y + rc.h * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // 玩家（全场最亮：亮黄核心 + 白圈 + 朝向箭头）
    {
      const rc = cellRect(lay, s.player.r, s.player.c);
      const cx = rc.x + rc.w / 2;
      const cy = rc.y + rc.h / 2;
      ctx.save();
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx, cy, rc.w * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, rc.w * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b1026';
      ctx.beginPath();
      ctx.arc(cx, cy, rc.w * 0.11, 0, Math.PI * 2);
      ctx.fill();
      // 朝向箭头（亮黄）
      const dir = view && view.facing ? view.facing : 'down';
      const ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[dir] || 0;
      ctx.fillStyle = '#fde047';
      ctx.save();
      ctx.translate(cx + Math.cos(ang) * rc.w * 0.24, cy + Math.sin(ang) * rc.h * 0.24);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(rc.w * 0.15, 0);
      ctx.lineTo(-rc.w * 0.08, -rc.w * 0.1);
      ctx.lineTo(-rc.w * 0.08, rc.w * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    // 粒子
    if (view && view.fxQueue) {
      for (const fx of view.fxQueue) {
        if (fx.ttl <= 0) continue;
        const rc = cellRect(lay, fx.r, fx.c);
        const a = Math.max(0, fx.ttl / fx.maxTtl);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = fx.color || '#fbbf24';
        const size = rc.w * (0.3 + (1 - a) * 0.5);
        ctx.beginPath();
        ctx.arc(rc.x + rc.w / 2, rc.y + rc.h / 2, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore(); // 震屏

    // 棋盘外框
    ctx.strokeStyle = scene.wall;
    ctx.lineWidth = 2;
    ctx.strokeRect(lay.x - 3, lay.y - 3, lay.w + 6, lay.h + 6);
  }

  function debugLayout() {
    const s = previewState || ensurePreview();
    const lay = boardLayout(s);
    return {
      board: { x: lay.x, y: lay.y, w: lay.w, h: lay.h },
      cell: lay.cell,
      player: cellRect(lay, s.player.r, s.player.c),
      box: cellRect(lay, s.boxes[0] ? s.boxes[0].r : 0, s.boxes[0] ? s.boxes[0].c : 0),
      target: firstEmptyTarget(lay, s),
    };
  }

  function firstEmptyTarget(lay, s) {
    for (let r = 0; r < s.rows; r += 1) {
      for (let c = 0; c < s.cols; c += 1) {
        if (s.terrain[r][c].target && !s.boxes.some((b) => b.r === r && b.c === c)) {
          return cellRect(lay, r, c);
        }
      }
    }
    return cellRect(lay, 0, 0);
  }

  return { draw, debugLayout };
}
