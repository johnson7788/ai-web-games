// Canvas 2D 渲染：俯视角足球场 + 球门 + 赛车 + 球 + HUD + 覆盖层。
import { WORLD, ARENA, GOAL, CAR, BALL, RULES, COLORS } from '../../config/game.config.js';
import { t } from '../core/i18n.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const CY = (ARENA.y0 + ARENA.y1) / 2;

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

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let time = 0;
  let goalFlash = 0;
  const trail = [];

  function clearEffects() { trail.length = 0; goalFlash = 0; }
  function flashGoal() { goalFlash = 1.2; }
  function update(dt) { time += dt; goalFlash = Math.max(0, goalFlash - dt); }

  function drawField() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 草坪条纹
    const stripes = 10, sw = (ARENA.x1 - ARENA.x0) / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? COLORS.field : COLORS.fieldAlt;
      ctx.fillRect(ARENA.x0 + i * sw, ARENA.y0, sw, ARENA.y1 - ARENA.y0);
    }
    // 线
    ctx.strokeStyle = COLORS.line; ctx.lineWidth = 3;
    ctx.strokeRect(ARENA.x0, ARENA.y0, ARENA.x1 - ARENA.x0, ARENA.y1 - ARENA.y0);
    ctx.beginPath(); ctx.moveTo(WORLD.WIDTH / 2, ARENA.y0); ctx.lineTo(WORLD.WIDTH / 2, ARENA.y1); ctx.stroke();
    ctx.beginPath(); ctx.arc(WORLD.WIDTH / 2, CY, 80, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(WORLD.WIDTH / 2, CY, 5, 0, Math.PI * 2); ctx.fillStyle = COLORS.line; ctx.fill();
    // 禁区
    ctx.strokeRect(ARENA.x0, CY - 150, 120, 300);
    ctx.strokeRect(ARENA.x1 - 120, CY - 150, 120, 300);
    // 墙
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(ARENA.x0 - 14, ARENA.y0 - 14, ARENA.x1 - ARENA.x0 + 28, 14);
    ctx.fillRect(ARENA.x0 - 14, ARENA.y1, ARENA.x1 - ARENA.x0 + 28, 14);
    // 左右墙（留球门口）
    ctx.fillRect(ARENA.x0 - 14, ARENA.y0 - 14, 14, CY - GOAL.half - ARENA.y0 + 14);
    ctx.fillRect(ARENA.x0 - 14, CY + GOAL.half, 14, ARENA.y1 - CY - GOAL.half + 14);
    ctx.fillRect(ARENA.x1, ARENA.y0 - 14, 14, CY - GOAL.half - ARENA.y0 + 14);
    ctx.fillRect(ARENA.x1, CY + GOAL.half, 14, ARENA.y1 - CY - GOAL.half + 14);
  }

  function drawGoals() {
    // 右门（蓝方目标）
    ctx.fillStyle = 'rgba(56,189,248,0.18)';
    ctx.fillRect(ARENA.x1, CY - GOAL.half, GOAL.depth, GOAL.half * 2);
    ctx.strokeStyle = COLORS.goalBlue; ctx.lineWidth = 4;
    ctx.strokeRect(ARENA.x1, CY - GOAL.half, GOAL.depth, GOAL.half * 2);
    // 左门（红方目标）
    ctx.fillStyle = 'rgba(251,113,133,0.18)';
    ctx.fillRect(ARENA.x0 - GOAL.depth, CY - GOAL.half, GOAL.depth, GOAL.half * 2);
    ctx.strokeStyle = COLORS.goalRed; ctx.lineWidth = 4;
    ctx.strokeRect(ARENA.x0 - GOAL.depth, CY - GOAL.half, GOAL.depth, GOAL.half * 2);
    // 网纹
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    for (let y = CY - GOAL.half + 12; y < CY + GOAL.half; y += 18) {
      ctx.beginPath(); ctx.moveTo(ARENA.x1, y); ctx.lineTo(ARENA.x1 + GOAL.depth, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ARENA.x0 - GOAL.depth, y); ctx.lineTo(ARENA.x0, y); ctx.stroke();
    }
  }

  function drawCar(car) {
    const col = car.id === 0 ? COLORS.carBlue : COLORS.carRed;
    const dark = car.id === 0 ? COLORS.carBlueDark : COLORS.carRedDark;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);
    // 尾焰（boost）
    if (car.speed > CAR.MAX_SPEED + 10) {
      ctx.fillStyle = COLORS.boost;
      ctx.beginPath();
      ctx.moveTo(-CAR.L / 2, -8); ctx.lineTo(-CAR.L / 2 - 18 - Math.random() * 10, 0); ctx.lineTo(-CAR.L / 2, 8);
      ctx.closePath(); ctx.fill();
    }
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -CAR.L / 2 + 3, -CAR.W / 2 + 4, CAR.L, CAR.W, 8); ctx.fill();
    // 轮子
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-CAR.L / 2 + 6, -CAR.W / 2 - 3, 12, 6);
    ctx.fillRect(-CAR.L / 2 + 6, CAR.W / 2 - 3, 12, 6);
    ctx.fillRect(CAR.L / 2 - 18, -CAR.W / 2 - 3, 12, 6);
    ctx.fillRect(CAR.L / 2 - 18, CAR.W / 2 - 3, 12, 6);
    // 车身
    ctx.fillStyle = col;
    roundRect(ctx, -CAR.L / 2, -CAR.W / 2, CAR.L, CAR.W, 8); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    // 座舱
    ctx.fillStyle = dark;
    roundRect(ctx, -6, -CAR.W / 2 + 5, 18, CAR.W - 10, 4); ctx.fill();
    // 前灯
    ctx.fillStyle = '#fff7cc';
    ctx.fillRect(CAR.L / 2 - 4, -CAR.W / 2 + 4, 3, 6);
    ctx.fillRect(CAR.L / 2 - 4, CAR.W / 2 - 10, 3, 6);
    ctx.restore();
  }

  function drawBall(b) {
    for (let i = 0; i < trail.length; i++) {
      const tr = trail[i];
      ctx.fillStyle = `rgba(248,250,252,${(i / trail.length) * 0.2})`;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, BALL.R * (i / trail.length) * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + BALL.R * 0.7, BALL.R * 0.9, BALL.R * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(b.x - 6, b.y - 6, 3, b.x, b.y, BALL.R);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, COLORS.ballDark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL.R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL.R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5 + time;
      ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * 13, b.y + Math.sin(a) * 13, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawHud(run) {
    const cx = WORLD.WIDTH / 2;
    ctx.fillStyle = COLORS.hud;
    roundRect(ctx, cx - 150, 12, 300, 56, 12); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = COLORS.goalBlue; ctx.fillText(t('blue'), cx - 95, 30);
    ctx.fillStyle = COLORS.goalRed; ctx.fillText(t('red'), cx + 95, 30);
    ctx.font = `900 30px ${FONT}`;
    ctx.fillStyle = COLORS.goalBlue; ctx.fillText(String(run.scores[0]), cx - 95, 50);
    ctx.fillStyle = '#fff'; ctx.fillText(':', cx, 48);
    ctx.fillStyle = COLORS.goalRed; ctx.fillText(String(run.scores[1]), cx + 95, 50);
    ctx.font = `bold 10px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`FIRST TO ${RULES.winScore}`, cx, 62);
    // boost 条
    ctx.fillStyle = COLORS.hud;
    roundRect(ctx, 16, WORLD.HEIGHT - 50, 220, 36, 10); ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = `bold 12px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(t('boost'), 28, WORLD.HEIGHT - 32);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, 86, WORLD.HEIGHT - 39, 138, 14, 7); ctx.fill();
    ctx.fillStyle = COLORS.boost;
    roundRect(ctx, 86, WORLD.HEIGHT - 39, 138 * run.cars[0].boost, 14, 7); ctx.fill();
  }

  function drawOverlay(run) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = WORLD.WIDTH / 2;
    if (run.phase === 'kickoff') {
      ctx.fillStyle = 'rgba(8,12,26,0.35)';
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.font = `900 60px ${FONT}`; ctx.fillStyle = '#fbbf24';
      ctx.fillText(t('kickoff'), cx, CY);
    } else if (run.phase === 'goal' || goalFlash > 0) {
      const col = run.lastScorer === 0 ? COLORS.goalBlue : COLORS.goalRed;
      ctx.font = `900 80px ${FONT}`; ctx.fillStyle = col;
      ctx.fillText(t('goal'), cx, CY - 20);
    }
  }

  function render({ run }) {
    drawField();
    drawGoals();
    if (run) {
      const b = run.ball;
      if (Math.hypot(b.vx, b.vy) > 280) { trail.push({ x: b.x, y: b.y }); if (trail.length > 8) trail.shift(); }
      else if (trail.length) trail.shift();
      drawCar(run.cars[0]);
      drawCar(run.cars[1]);
      drawBall(b);
      drawHud(run);
      drawOverlay(run);
    }
  }

  return { render, update, clearEffects, flashGoal };
}