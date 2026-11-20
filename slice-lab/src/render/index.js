// SLICE LAB · Canvas 2D 渲染（霓虹街机风，全程序化，零素材）
import { WORLD, SHAPE_CENTER, SETTLE_SEC, PASS_SCORE } from '../../config/game.config.js';

const TAU = Math.PI * 2;

// 标题屏展示用演示水晶
const DEMO_SHAPE = (() => {
  const n = 6;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const th = (i / n) * TAU + Math.PI / 6;
    const r = 150 + 34 * Math.cos(th * 2 + 0.6);
    pts.push({ x: SHAPE_CENTER.x + r * Math.cos(th), y: SHAPE_CENTER.y + r * Math.sin(th) });
  }
  return pts;
})();

function poly(ctx, points) {
  if (!points || points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function hex(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const th = (i / 6) * TAU - Math.PI / 2;
    const px = x + r * Math.cos(th);
    const py = y + r * Math.sin(th);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  function bg(time) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#08081a');
    g.addColorStop(0.55, '#0d0a22');
    g.addColorStop(1, '#1a0b2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 网格
    ctx.strokeStyle = 'rgba(0,255,210,0.06)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x <= WORLD.WIDTH; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= WORLD.HEIGHT; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
    }

    // 扫描线
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let y = 0; y < WORLD.HEIGHT; y += 4) ctx.fillRect(0, y, WORLD.WIDTH, 1);
  }

  function glow(color, blur = 18) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function noGlow() {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  function drawShape(points, fill, stroke, strokeWidth = 4, blur = 20) {
    glow(stroke, blur);
    ctx.fillStyle = fill;
    poly(ctx, points);
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
    noGlow();
    // 顶点光点
    ctx.fillStyle = '#eaffff';
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, TAU);
      ctx.fill();
    }
  }

  function drawRock(rock) {
    if (!rock) return;
    glow('#ff5566', 22);
    ctx.fillStyle = 'rgba(255,80,90,0.30)';
    hex(ctx, rock.x, rock.y, rock.r);
    ctx.fill();
    ctx.strokeStyle = '#ff5566';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    noGlow();
    // 警示核心
    ctx.fillStyle = '#ffd7dc';
    ctx.beginPath();
    ctx.arc(rock.x, rock.y, rock.r * 0.32, 0, TAU);
    ctx.fill();
  }

  function drawPieces(state, t) {
    if (!state.pieces || !state.lastCut) return;
    const [a, b] = state.pieces;
    const p1 = state.lastCut.p1;
    const p2 = state.lastCut.p2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const off = t * 22;
    const aOff = state.pieces.map ? null : null;
    // A 向 -n 方向漂，B 向 +n 方向漂
    drawShape(a.points.map((p) => ({ x: p.x - nx * off, y: p.y - ny * off })), 'rgba(0,229,255,0.16)', '#27f2ff', 4, 16);
    drawShape(b.points.map((p) => ({ x: p.x + nx * off, y: p.y + ny * off })), 'rgba(255,95,215,0.16)', '#ff5fd7', 4, 16);
    void aOff;
  }

  function lineColor(score, valid, rockHit) {
    if (rockHit) return '#ff5566';
    if (!valid) return '#ff5a5a';
    if (score >= PASS_SCORE) return '#7dff6a';
    if (score >= 75) return '#ffe14d';
    return '#ff9f43';
  }

  function drawDrag(view) {
    if (!view.dragging || !view.dragStart) return;
    const a = view.dragStart;
    const b = view.dragEnd;
    const pv = view.preview;
    const score = pv && pv.valid ? pv.score : null;
    const color = lineColor(score, pv ? pv.valid : false, pv ? pv.reason === 'rock' : false);
    glow(color, 14);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    noGlow();
    // 端点
    ctx.fillStyle = color;
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, TAU);
      ctx.fill();
    }
    // 实时均分度
    if (score != null) {
      const label = `${score}%`;
      ctx.font = 'bold 30px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      ctx.fillText(label, mid.x, mid.y - 18);
    }
  }

  function drawParticles(view, dt) {
    for (const fx of view.fx) {
      if (fx.ttl <= 0) continue;
      const k = 1 - fx.ttl / fx.life;
      const r = fx.r0 * (1 - k * 0.6);
      ctx.globalAlpha = Math.max(0, fx.ttl / fx.life);
      ctx.fillStyle = fx.color;
      ctx.beginPath();
      ctx.arc(fx.x + fx.vx * k * fx.life, fx.y + fx.vy * k * fx.life, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawGuide(state) {
    // 目标提示：参考中线 + 目标标签（只作参考系，不泄露答案）
    if (!state || state.phase !== 'drawing') return;
    ctx.setLineDash([6, 10]);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(SHAPE_CENTER.x, SHAPE_CENTER.y - 250);
    ctx.lineTo(SHAPE_CENTER.x, SHAPE_CENTER.y + 250);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('TARGET: 50/50 SPLIT', SHAPE_CENTER.x, SHAPE_CENTER.y - 262);
  }

  return {
    draw(state, dt, view) {
      view = view || { dragging: false, fx: [] };
      bg(state ? state.time : 0);
      if (view.shake > 0) {
        ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
      }
      drawGuide(state);
      if (state && state.phase === 'drawing') {
        drawShape(rotatedVerts(state), 'rgba(0,229,255,0.16)', '#27f2ff', 4, 22);
        drawRock(state.rock && currentRockWorld(state));
      } else if (state && state.phase === 'splitting') {
        const t = 1 - state._settleT / SETTLE_SEC;
        drawPieces(state, t);
      } else if (state && (state.phase === 'won' || state.phase === 'lost')) {
        drawPieces(state, 1);
      } else {
        // 标题/暂停：演示水晶
        drawShape(DEMO_SHAPE, 'rgba(0,229,255,0.12)', '#27f2ff', 4, 18);
      }
      drawDrag(view);
      drawParticles(view, dt);
      if (view.shake > 0) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    debugLayout() {
      return { crystal: { x: SHAPE_CENTER.x - 160, y: SHAPE_CENTER.y - 160, w: 320, h: 320 } };
    },
  };
}

function rotatedVerts(state) {
  if (!state.angle) return state.shape;
  const cos = Math.cos(state.angle);
  const sin = Math.sin(state.angle);
  return state.shape.map((p) => {
    const dx = p.x - SHAPE_CENTER.x;
    const dy = p.y - SHAPE_CENTER.y;
    return { x: SHAPE_CENTER.x + dx * cos - dy * sin, y: SHAPE_CENTER.y + dx * sin + dy * cos };
  });
}

function currentRockWorld(state) {
  if (!state.rock) return null;
  const cos = Math.cos(state.angle);
  const sin = Math.sin(state.angle);
  return {
    x: SHAPE_CENTER.x + state.rock.ox * cos - state.rock.oy * sin,
    y: SHAPE_CENTER.y + state.rock.ox * sin + state.rock.oy * cos,
    r: state.rock.r,
  };
}
