// Canvas 2D 渲染：球桌 + 球网 + 球拍 + 球 + 比分 + 得分闪光。
import { WORLD, TABLE, PADDLE, BALL_R, COLORS } from '../../config/game.config.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const CX = TABLE.X + TABLE.W / 2;
const CY = TABLE.Y + TABLE.H / 2;

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
  let pointFlash = 0;
  const trail = [];

  function flashPoint() { pointFlash = 0.5; }
  function update(dt) { pointFlash = Math.max(0, pointFlash - dt); }

  function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(CX, CY, 60, CX, CY, 800);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawTable() {
    ctx.fillStyle = COLORS.table;
    roundRect(ctx, TABLE.X, TABLE.Y, TABLE.W, TABLE.H, 12);
    ctx.fill();
    ctx.strokeStyle = COLORS.tableEdge;
    ctx.lineWidth = 6;
    ctx.stroke();
    // 边线
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 3;
    ctx.strokeRect(TABLE.X + 12, TABLE.Y + 12, TABLE.W - 24, TABLE.H - 24);
    // 中线（网）
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(TABLE.X + 12, CY);
    ctx.lineTo(TABLE.X + TABLE.W - 12, CY);
    ctx.stroke();
    ctx.setLineDash([]);
    // 中竖线
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CX, TABLE.Y + 12);
    ctx.lineTo(CX, TABLE.Y + TABLE.H - 12);
    ctx.stroke();
  }

  function drawPaddles(run) {
    ctx.fillStyle = COLORS.ai;
    roundRect(ctx, run.ai.x - PADDLE.W / 2, PADDLE.AI_Y, PADDLE.W, PADDLE.H, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    roundRect(ctx, run.player.x - PADDLE.W / 2, PADDLE.PLAYER_Y, PADDLE.W, PADDLE.H, 8);
    ctx.fill();
  }

  function drawBall(run) {
    const b = run.ball;
    if (run.phase === 'play') {
      trail.push({ x: b.x, y: b.y });
      if (trail.length > 8) trail.shift();
    } else {
      trail.length = 0;
    }
    trail.forEach((t, i) => {
      ctx.globalAlpha = (i / trail.length) * 0.3;
      ctx.fillStyle = COLORS.ball;
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_R * (i / trail.length), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.ball;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawScores(run) {
    ctx.font = `900 72px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.player;
    ctx.fillText(String(run.scores[0]), TABLE.X - 90, CY + 60);
    ctx.fillStyle = COLORS.ai;
    ctx.fillText(String(run.scores[1]), TABLE.X + TABLE.W + 90, CY - 60);
    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = 'rgba(238,242,246,0.6)';
    ctx.fillText('YOU', TABLE.X - 90, CY + 110);
    ctx.fillText('BOT', TABLE.X + TABLE.W + 90, CY - 110);
    if (pointFlash > 0) {
      ctx.globalAlpha = pointFlash;
      ctx.fillStyle = COLORS.accent;
      ctx.font = `900 40px ${FONT}`;
      ctx.fillText('POINT!', CX, CY);
      ctx.globalAlpha = 1;
    }
  }

  function render(view) {
    const { run } = view;
    drawBackground();
    if (run) {
      drawTable();
      drawPaddles(run);
      drawBall(run);
      drawScores(run);
    }
  }

  function clearEffects() { pointFlash = 0; trail.length = 0; }

  return { render, update, flashPoint, clearEffects };
}