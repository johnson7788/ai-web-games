// LINK LINE PAIR · Canvas 2D 渲染（霓虹街机：程序化星座 + 星空背景）
import { WORLD, PLAY } from '../../config/game.config.js';

const COLS = WORLD.COLS;
const ROWS = WORLD.ROWS;
const CELL = 58;
const BOARD = {
  x: Math.round((WORLD.WIDTH - COLS * CELL) / 2),
  y: Math.round((WORLD.HEIGHT - ROWS * CELL) / 2) + 14,
  w: COLS * CELL,
  h: ROWS * CELL,
};

const NEON = {
  hint: 'rgba(255, 214, 90, 0.55)',
  linkA: '#3fe2ff',
  linkB: '#ff4fd8',
  star: '#3fe2ff',
  starSel: '#ffffff',
  rock: '#2b3150',
  rockEdge: '#5b6a94',
};

function px(c) { return BOARD.x + c * CELL + CELL / 2; }
function py(r) { return BOARD.y + r * CELL + CELL / 2; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;

  let starField = null;

  function ensureStars() {
    if (starField) return;
    starField = [];
    const rng = (n) => (n * 9301 + 49297) % 233280 / 233280;
    for (let i = 0; i < 70; i += 1) {
      starField.push({
        x: rng(i * 3 + 1) * WORLD.WIDTH,
        y: rng(i * 5 + 2) * WORLD.HEIGHT,
        r: 0.5 + rng(i * 7 + 3) * 1.4,
        a: 0.2 + rng(i * 11 + 5) * 0.5,
      });
    }
  }

  function dotPoint(state, dot) { return { x: px(dot.c), y: py(dot.r) }; }

  function line(ctx2, a, b, color, width, glow) {
    ctx2.save();
    ctx2.strokeStyle = color;
    ctx2.lineWidth = width;
    ctx2.lineCap = 'round';
    if (glow) {
      ctx2.shadowColor = color;
      ctx2.shadowBlur = glow;
    }
    ctx2.beginPath();
    ctx2.moveTo(a.x, a.y);
    ctx2.lineTo(b.x, b.y);
    ctx2.stroke();
    ctx2.restore();
  }

  function circle(ctx2, x, y, r, fill, stroke, strokeW = 2, glow = 0) {
    ctx2.save();
    if (glow) {
      ctx2.shadowColor = fill || stroke;
      ctx2.shadowBlur = glow;
    }
    ctx2.beginPath();
    ctx2.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx2.fillStyle = fill; ctx2.fill(); }
    if (stroke) { ctx2.strokeStyle = stroke; ctx2.lineWidth = strokeW; ctx2.stroke(); }
    ctx2.restore();
  }

  function pointAlongTrail(trail, t) {
    if (!trail || trail.length === 0) return null;
    if (trail.length === 1) return { x: px(trail[0].c), y: py(trail[0].r) };
    const pts = trail.map((n) => ({ x: px(n.c), y: py(n.r) }));
    const seg = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      seg.push(d);
      total += d;
    }
    let target = t * total;
    for (let i = 0; i < seg.length; i += 1) {
      if (target <= seg[i]) {
        const k = seg[i] ? target / seg[i] : 0;
        return {
          x: pts[i].x + (pts[i + 1].x - pts[i].x) * k,
          y: pts[i].y + (pts[i + 1].y - pts[i].y) * k,
        };
      }
      target -= seg[i];
    }
    return pts[pts.length - 1];
  }

  function drawBg() {
    ensureStars();
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#05060f');
    g.addColorStop(0.6, '#0a0f2a');
    g.addColorStop(1, '#12081f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    for (const s of starField) {
      ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(performance.now() / 1400 + s.x));
      ctx.fillStyle = '#cdd8ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBoardFrame() {
    ctx.save();
    ctx.strokeStyle = 'rgba(63, 226, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(BOARD.x - 12, BOARD.y - 12, BOARD.w + 24, BOARD.h + 24);
    ctx.restore();
  }

  function drawRock(state, rock) {
    const x = px(rock.c);
    const y = py(rock.r);
    const r = CELL * 0.32;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.55);
    ctx.lineTo(-r * 0.55, -r * 0.2);
    ctx.lineTo(-r * 0.15, -r);
    ctx.lineTo(r * 0.5, -r * 0.4);
    ctx.lineTo(r, r * 0.3);
    ctx.lineTo(r * 0.3, r);
    ctx.closePath();
    ctx.fillStyle = NEON.rock;
    ctx.fill();
    ctx.strokeStyle = NEON.rockEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawStar(state, dot) {
    const x = px(dot.c);
    const y = py(dot.r);
    const selected = state.sel === dot.id;
    const done = state.segments.some((s, i) => state.connected[i] && (s.a === dot.id || s.b === dot.id));
    const r = selected ? 15 : (done ? 13 : 12);
    const glow = selected ? 22 : (done ? 12 : 6);
    if (selected) {
      circle(ctx, x, y, r + 4, null, NEON.starSel, 2, 14);
    }
    circle(ctx, x, y, r, done ? '#10324a' : '#0a1630', NEON.star, 2.5, glow);
    circle(ctx, x, y, r * 0.34, selected ? NEON.starSel : NEON.star, null, 0, 0);
  }

  function drawHintLines(state) {
    // 淡色参考线：全部段（已连的会盖在下面）
    for (let i = 0; i < state.segCount; i += 1) {
      const s = state.segments[i];
      const a = state.dots[s.a];
      const b = state.dots[s.b];
      if (!state.connected[i]) {
        line(ctx, dotPoint(state, a), dotPoint(state, b), NEON.hint, 4, 6);
      }
    }
    // 已连段：霓虹渐变
    for (let i = 0; i < state.segCount; i += 1) {
      if (!state.connected[i]) continue;
      const s = state.segments[i];
      const a = state.dots[s.a];
      const b = state.dots[s.b];
      const pa = dotPoint(state, a);
      const pb = dotPoint(state, b);
      const grad = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
      grad.addColorStop(0, NEON.linkA);
      grad.addColorStop(1, NEON.linkB);
      line(ctx, pa, pb, grad, 5, 14);
    }
  }

  function drawCursorLine(state, view) {
    if (state.sel == null || !view || !view.cursor) return;
    const a = state.dots[state.sel];
    line(ctx, dotPoint(state, a), view.cursor, 'rgba(255,255,255,0.5)', 3, 8);
  }

  function drawHintFinger(state) {
    if (!(state.hintUntil > state.elapsed) || !state.hintTrail || state.hintTrail.length === 0) return;
    const t = 1 - (state.hintUntil - state.elapsed) / PLAY.HINT_DURATION;
    const p = pointAlongTrail(state.hintTrail, Math.max(0, Math.min(1, t)));
    if (!p) return;
    circle(ctx, p.x, p.y, 16, null, '#ffe08a', 3, 16);
    circle(ctx, p.x, p.y, 7, '#ffe08a', null, 0, 12);
  }

  function drawFx(state, view) {
    if (!view || !view.fx) return;
    for (const fx of view.fx) {
      const ttl01 = Math.max(0, Math.min(1, fx.ttl / fx.maxTtl));
      ctx.save();
      ctx.globalAlpha = ttl01;
      if (fx.type === 'connectPop') {
        const x = px(fx.c);
        const y = py(fx.r);
        circle(ctx, x, y, (1 - ttl01) * 26 + 6, null, '#9ff3ff', 2, 10);
      } else if (fx.type === 'rockBurst') {
        const x = px(fx.c);
        const y = py(fx.r);
        for (let i = 0; i < 6; i += 1) {
          const ang = (i / 6) * Math.PI * 2 + fx.seed;
          const d = (1 - ttl01) * 20 + 3;
          ctx.fillStyle = NEON.rockEdge;
          ctx.fillRect(x + Math.cos(ang) * d - 2, y + Math.sin(ang) * d - 2, 4, 4);
        }
      } else if (fx.type === 'missFlash') {
        ctx.strokeStyle = `rgba(255,90,120,${ttl01})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(BOARD.x - 8, BOARD.y - 8, BOARD.w + 16, BOARD.h + 16);
      }
      ctx.restore();
    }
  }

  function drawCombo(state) {
    if (state.combo >= 2) {
      ctx.save();
      ctx.font = '700 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe08a';
      ctx.shadowColor = '#ff9d2e';
      ctx.shadowBlur = 14;
      ctx.fillText(`×${state.combo}`, BOARD.x + BOARD.w + 46, BOARD.y + 30);
      ctx.restore();
    }
  }

  function hitRadius(state, type) {
    return type === 'dot' ? 24 : 20;
  }

  return {
    hitTest(state, p) {
      if (!state) return null;
      for (let i = 0; i < state.dots.length; i += 1) {
        const d = state.dots[i];
        if (Math.hypot(p.x - px(d.c), p.y - py(d.r)) <= hitRadius(state, 'dot')) return { type: 'dot', id: i };
      }
      for (let i = 0; i < state.rocks.length; i += 1) {
        const r = state.rocks[i];
        if (Math.hypot(p.x - px(r.c), p.y - py(r.r)) <= hitRadius(state, 'rock')) return { type: 'rock', id: i };
      }
      return null;
    },

    debugLayout() {
      return {
        grid: { x: BOARD.x, y: BOARD.y, w: BOARD.w, h: BOARD.h },
        cell: CELL,
        board: { x: BOARD.x - 12, y: BOARD.y - 12, w: BOARD.w + 24, h: BOARD.h + 24 },
      };
    },

    draw(state, dt, view) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBg();
      if (!state) return;
      drawBoardFrame();
      drawHintLines(state);
      drawCursorLine(state, view);
      for (const rock of state.rocks) drawRock(state, rock);
      for (const dot of state.dots) drawStar(state, dot);
      drawHintFinger(state);
      drawFx(state, view);
      drawCombo(state);
    },
  };
}
