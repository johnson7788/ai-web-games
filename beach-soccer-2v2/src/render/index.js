// BEACH SOCCER 2V2 · Canvas 2D 渲染（程序化霓虹沙滩，零图片素材）
// 世界坐标 y-up → 屏幕坐标 y-down；DPR ≤2；prefers-reduced-motion 关闭大幅动效。
import { WORLD, PHYS } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const GROUND_Y = WORLD.GROUND_Y;

function sx(x) { return x + W / 2; }
function sy(y) { return H / 2 - y; }

function starPath(ctx, cx, cy, r, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const rad = (i % 2 === 0 ? r : r * 0.45);
    const a = (Math.PI / points) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.scale(dpr, dpr);

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let t = 0;

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1030');
    g.addColorStop(0.45, '#1b1a4d');
    g.addColorStop(0.62, '#4a1d6b');
    g.addColorStop(0.72, '#c2336b');
    g.addColorStop(1, '#0a0f28');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 霓虹落日
    const sunX = sx(0);
    const sunY = sy(-40);
    ctx.save();
    ctx.shadowColor = '#ff5da2';
    ctx.shadowBlur = 60;
    const sg = ctx.createLinearGradient(0, sunY - 70, 0, sunY + 70);
    sg.addColorStop(0, '#ffd86b');
    sg.addColorStop(0.5, '#ff8a5c');
    sg.addColorStop(1, '#ff3d8a');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 天空小星
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 26; i += 1) {
      const px = ((i * 97) % W);
      const py = ((i * 53) % (H * 0.4)) + 20;
      ctx.fillRect(px, py, 2, 2);
    }
  }

  function drawOcean() {
    const top = sy(0);
    const bottom = sy(GROUND_Y);
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, '#7a2f9e');
    g.addColorStop(1, '#1b3a7a');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, bottom - top);
    // 波光
    ctx.strokeStyle = 'rgba(120,220,255,0.18)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i += 1) {
      const y = top + 18 + i * 18 + (reducedMotion ? 0 : Math.sin(t * 0.8 + i) * 2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function drawSand() {
    const top = sy(GROUND_Y);
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#2a1248');
    g.addColorStop(1, '#160b2c');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);

    // 霓虹网格（弱化，避免抢前景主体）
    ctx.strokeStyle = 'rgba(255,90,200,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i += 1) {
      const x = i * (W / 12);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + (i - 6) * 10, H);
      ctx.stroke();
    }
    for (let j = 0; j <= 4; j += 1) {
      const y = top + j * ((H - top) / 4);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function drawPalm(cx, baseY, flip) {
    ctx.save();
    ctx.translate(cx, sy(baseY));
    ctx.scale(flip ? -1 : 1, 1);
    ctx.strokeStyle = '#120a24';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(18, -46, 6, -92);
    ctx.stroke();
    ctx.lineWidth = 5;
    for (let i = 0; i < 5; i += 1) {
      const a = -0.5 + i * 0.4;
      ctx.beginPath();
      ctx.moveTo(6, -92);
      ctx.quadraticCurveTo(6 + Math.sin(a) * 40, -108, 6 + Math.sin(a) * 78, -88 + Math.cos(a) * 16);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWall(w) {
    const x = sx(w.x) - w.w / 2;
    const y = sy(w.y + w.h / 2);
    ctx.fillStyle = '#0e0824';
    ctx.strokeStyle = '#3ee6ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#3ee6ff';
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y, w.w, w.h);
    ctx.strokeRect(x, y, w.w, w.h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(62,230,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 4, w.w - 8, w.h - 8);
  }

  function drawGoal(goal, taken = false) {
    const cx = sx(goal.x);
    const cy = sy(goal.y);
    const hw = goal.w / 2;
    const hh = goal.h / 2;
    const pulse = reducedMotion ? 0 : Math.sin(t * 3) * 2;

    // 球网（半透明发光填充 + 网格）
    ctx.fillStyle = 'rgba(34, 255, 194, 0.22)';
    ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.strokeStyle = 'rgba(200,255,244,0.55)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy - hh + (hh * 2 * i) / 6);
      ctx.lineTo(cx + hw, cy - hh + (hh * 2 * i) / 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - hw + (hw * 2 * i) / 6, cy - hh);
      ctx.lineTo(cx - hw + (hw * 2 * i) / 6, cy + hh);
      ctx.stroke();
    }

    // 门柱 + 横梁（粗白框 + 强光，经典球门轮廓）
    ctx.save();
    ctx.strokeStyle = '#eafffb';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#22ffc2';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy - hh);
    ctx.lineTo(cx - hw, cy + hh);
    ctx.lineTo(cx + hw, cy + hh);
    ctx.lineTo(cx + hw, cy - hh);
    ctx.stroke();
    ctx.restore();

    // 「GOAL」标签（悬浮在球门上方，明确目标）
    ctx.save();
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(8,10,26,0.85)';
    ctx.strokeText('GOAL', cx, cy - hh - 10 + pulse);
    ctx.fillStyle = '#22ffc2';
    ctx.shadowColor = '#22ffc2';
    ctx.shadowBlur = 12;
    ctx.fillText('GOAL', cx, cy - hh - 10 + pulse);
    ctx.restore();

    if (taken) {
      ctx.fillStyle = 'rgba(34,255,194,0.35)';
      ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
    }
  }

  function drawBumper(c, hit = 0) {
    const cx = sx(c.x);
    const cy = sy(c.y);
    ctx.save();
    ctx.strokeStyle = '#ff4fd8';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ff4fd8';
    ctx.shadowBlur = hit > 0 ? 30 : 16;
    ctx.beginPath();
    ctx.arc(cx, cy, c.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,79,216,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, c.r - 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - c.r, cy);
    ctx.lineTo(cx + c.r, cy);
    ctx.moveTo(cx, cy - c.r);
    ctx.lineTo(cx, cy + c.r);
    ctx.stroke();
    ctx.restore();
  }

  function drawMega(c, taken = false) {
    if (taken) return;
    const cx = sx(c.x);
    const cy = sy(c.y);
    const pulse = reducedMotion ? 0 : Math.sin(t * 4) * 3;
    ctx.save();
    ctx.shadowColor = '#b36bff';
    ctx.shadowBlur = 20;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, c.r + 6);
    g.addColorStop(0, '#e8d5ff');
    g.addColorStop(1, '#8a2be2');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, c.r + pulse * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(10, 14, 34, 0.85)';
    roundRect(ctx, cx - 16, cy - 12, 32, 24, 7);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×2', cx, cy + 1);
  }

  function drawStar(c, taken = false) {
    const cx = sx(c.x);
    const cy = sy(c.y);
    if (taken) {
      ctx.fillStyle = 'rgba(255,220,90,0.18)';
      starPath(ctx, cx, cy, c.r * 0.7);
      ctx.fill();
      return;
    }
    const pulse = reducedMotion ? 0 : Math.sin(t * 3 + c.x) * 3;
    ctx.save();
    ctx.shadowColor = '#ffd54a';
    ctx.shadowBlur = 20;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, c.r + 8);
    g.addColorStop(0, '#fff7c0');
    g.addColorStop(1, '#ffb400');
    ctx.fillStyle = g;
    starPath(ctx, cx, cy, c.r + pulse * 0.25);
    ctx.fill();
    ctx.restore();
  }

  function drawBall(ball, trail) {
    if (!ball) return;
    // 拖尾
    if (trail && trail.length > 1 && !reducedMotion) {
      for (let i = 0; i < trail.length; i += 1) {
        const p = trail[i];
        const a = (i / trail.length) * 0.5;
        ctx.fillStyle = `rgba(120,240,255,${a})`;
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), R * 0.55 * (i / trail.length), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const R = WORLD.BALL_R;
    const cx = sx(ball.x);
    const cy = sy(ball.y);
    ctx.save();
    ctx.shadowColor = '#7af0ff';
    ctx.shadowBlur = 18;
    const g = ctx.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, R + 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#c8f6ff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#06202a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    // 足球纹理
    ctx.fillStyle = '#16213e';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#16213e';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.36, cy + Math.sin(a) * R * 0.36);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }
  }

  function drawAim(ball, aim, mega) {
    if (!ball || !aim) return;
    const x0 = ball.x;
    const y0 = ball.y;
    const vx = aim.vx;
    const vy = aim.vy;
    const g = PHYS.GRAVITY;
    // 方向线
    ctx.strokeStyle = mega ? 'rgba(179,107,255,0.9)' : 'rgba(122,240,255,0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(sx(x0), sy(y0));
    ctx.lineTo(sx(x0 + vx * 0.35), sy(y0 + vy * 0.35));
    ctx.stroke();
    ctx.setLineDash([]);
    // 预测轨迹点
    for (let i = 1; i <= 12; i += 1) {
      const tt = 0.14 * i;
      const px = x0 + vx * tt;
      const py = y0 + vy * tt - 0.5 * g * tt * tt;
      if (py < WORLD.GROUND_Y) break;
      ctx.fillStyle = 'rgba(122,240,255,0.8)';
      ctx.beginPath();
      ctx.arc(sx(px), sy(py), 4 - i * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(fx) {
    for (const p of fx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.ttl / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function draw(state, dt, view) {
    t += reducedMotion ? 0 : dt;
    const level = state ? LEVELS[state.level - 1] : LEVELS[0];
    const ball = state ? state.ball : null;

    drawSky();
    drawOcean();
    drawSand();
    drawPalm(-590, GROUND_Y + 6, false);
    drawPalm(560, GROUND_Y + 6, true);

    for (const w of level.walls) drawWall(w);
    drawGoal(level.goal);
    for (const b of level.bumpers) drawBumper(b, view && view.bumperHit);
    for (const m of level.mega) drawMega(m, state && state.mega === false && m.taken);
    for (const s of level.stars) drawStar(s, s.taken);

    // 球 + 拖尾 + 瞄准
    if (ball) {
      drawBall(ball, view ? view.trail : null);
      if (view && view.aim && !ball.active) drawAim(ball, view.aim, !!(state && state.mega));
    }
    if (view && view.fxQueue) drawParticles(view.fxQueue);
  }

  function debugLayout() {
    const level = LEVELS[0];
    return {
      ball: { x: sx(level.tee.x) - 30, y: sy(level.tee.y) - 30, w: 60, h: 60 },
      field: { x: sx(-400), y: sy(80), w: 800, h: 320 },
      goal: { x: sx(level.goal.x) - level.goal.w / 2 - 8, y: sy(level.goal.y + level.goal.h / 2) - 8, w: level.goal.w + 16, h: level.goal.h + 16 },
    };
  }

  return { draw, debugLayout };
}
