// Canvas 2D 渲染：街头球场 + 篮筐 + 角色 + 球 + 记分板 + 特效。
import { WORLD, COURT, BALL, PLAYER, RULES, COLORS } from '../../config/game.config.js';
import { t } from '../core/i18n.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

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
  const trail = [];
  let shake = 0;

  function clearEffects() { trail.length = 0; shake = 0; }
  function flashScore() { shake = 0.35; }
  function update(dt) { shake = Math.max(0, shake - dt); }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, COLORS.skyTop);
    g.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 远景城市剪影
    ctx.fillStyle = 'rgba(10,14,30,0.55)';
    const bs = [ [40,300,90], [150,250,70], [240,330,110], [380,270,80], [500,310,95], [640,240,75], [760,300,100], [900,265,85], [1020,320,90], [1150,280,80] ];
    for (const [x, top, w] of bs) ctx.fillRect(x, top, w, WORLD.GROUND_Y - top);
    // 窗灯
    ctx.fillStyle = 'rgba(255,220,130,0.18)';
    for (const [x, top, w] of bs) {
      for (let wy = top + 16; wy < WORLD.GROUND_Y - 20; wy += 26)
        for (let wx = x + 10; wx < x + w - 12; wx += 20)
          if ((wx * 7 + wy * 13) % 5 < 2) ctx.fillRect(wx, wy, 7, 9);
    }
    // 地面
    const fg = ctx.createLinearGradient(0, WORLD.GROUND_Y, 0, WORLD.HEIGHT);
    fg.addColorStop(0, COLORS.floor);
    fg.addColorStop(1, COLORS.floorDark);
    ctx.fillStyle = fg;
    ctx.fillRect(0, WORLD.GROUND_Y, WORLD.WIDTH, WORLD.HEIGHT - WORLD.GROUND_Y);
    // 场地线
    ctx.strokeStyle = 'rgba(244,233,216,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, WORLD.GROUND_Y + 2); ctx.lineTo(WORLD.WIDTH, WORLD.GROUND_Y + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(WORLD.WIDTH / 2, WORLD.GROUND_Y + 2); ctx.lineTo(WORLD.WIDTH / 2, WORLD.HEIGHT); ctx.stroke();
    ctx.beginPath(); ctx.arc(WORLD.WIDTH / 2, WORLD.GROUND_Y + 52, 46, 0, Math.PI); ctx.stroke();
    // 三分弧（装饰）
    ctx.strokeStyle = 'rgba(244,233,216,0.25)';
    ctx.beginPath(); ctx.arc(COURT.left.x, WORLD.GROUND_Y + 40, 250, -0.15, Math.PI * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(COURT.right.x, WORLD.GROUND_Y + 40, 250, Math.PI * 0.5, Math.PI + 0.15); ctx.stroke();
  }

  function drawHoop(side) {
    const h = COURT[side];
    const dir = side === 'left' ? 1 : -1;
    // 支柱
    ctx.fillStyle = '#2b3350';
    ctx.fillRect(h.boardX - dir * 6 - 5, h.boardTop - 20, 10, WORLD.GROUND_Y - h.boardTop + 20);
    // 篮板
    ctx.fillStyle = COLORS.board;
    roundRect(ctx, h.boardX - 7, h.boardTop, 14, h.boardBottom - h.boardTop, 4); ctx.fill();
    ctx.strokeStyle = '#9aa7c7'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = COLORS.rim; ctx.lineWidth = 3;
    ctx.strokeRect(h.boardX - 5, h.y - 26, 10, 34);
    // 筐
    ctx.strokeStyle = COLORS.rim; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(h.x - COURT.rimHalf, h.y);
    ctx.lineTo(h.x + COURT.rimHalf, h.y);
    ctx.stroke();
    // 网
    ctx.strokeStyle = 'rgba(248,250,252,0.75)'; ctx.lineWidth = 1.5;
    const rl = h.x - COURT.rimHalf, rr = h.x + COURT.rimHalf;
    for (let i = 0; i <= 4; i++) {
      const tx = rl + (rr - rl) * (i / 4);
      const bx = h.x - 16 + 32 * (i / 4);
      ctx.beginPath(); ctx.moveTo(tx, h.y); ctx.lineTo(bx, h.y + 40); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(h.x - 20, h.y + 22); ctx.lineTo(h.x + 20, h.y + 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h.x - 16, h.y + 40); ctx.lineTo(h.x + 16, h.y + 40); ctx.stroke();
  }

  function drawPlayer(p) {
    const jersey = p.i === 0 ? COLORS.p1 : COLORS.p2;
    const dark = p.i === 0 ? COLORS.p1Dark : COLORS.p2Dark;
    const x = p.x, y = p.y;
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    const airH = Math.max(0, WORLD.GROUND_Y - y);
    const sw = 26 * (1 - Math.min(0.5, airH / 400));
    ctx.beginPath(); ctx.ellipse(x, WORLD.GROUND_Y + 8, sw, 7, 0, 0, Math.PI * 2); ctx.fill();
    // 腿
    ctx.fillStyle = dark;
    ctx.fillRect(x - 15, y - 20, 11, 20);
    ctx.fillRect(x + 4, y - 20, 11, 20);
    // 球衣
    ctx.fillStyle = jersey;
    roundRect(ctx, x - 19, y - 54, 38, 38, 9); ctx.fill();
    // 号码
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.i === 0 ? '1' : '2', x, y - 34);
    // 头
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(x, y - 66, 13, 0, Math.PI * 2); ctx.fill();
    // 发带
    ctx.fillStyle = jersey;
    ctx.fillRect(x - 13, y - 74, 26, 6);
    // 眼睛（朝向）
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(x + p.facing * 5, y - 66, 2.2, 0, Math.PI * 2); ctx.fill();
    // 手臂：持球/蓄力伸向球
    if (p.hasBall) {
      ctx.strokeStyle = '#e8b98a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + p.facing * 12, y - 46);
      ctx.lineTo(x + p.facing * 22, y - 52); ctx.stroke();
    }
    // 名牌
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillStyle = jersey;
    ctx.fillText(p.i === 0 ? t('you') : t('bot'), x, y - 92);
    // 蓄力条
    if (p.charging) {
      const w = 54, hx = x - w / 2, hy = y - 110;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, hx - 2, hy - 2, w + 4, 12, 6); ctx.fill();
      const frac = p.charge;
      const col = frac > 0.55 && frac < 0.95 ? '#4ade80' : '#fbbf24';
      ctx.fillStyle = col;
      roundRect(ctx, hx, hy, w * frac, 8, 4); ctx.fill();
    }
  }

  function drawBall(b) {
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    const sw = 14 * (1 - Math.min(0.5, Math.max(0, WORLD.GROUND_Y - b.y) / 500));
    ctx.beginPath(); ctx.ellipse(b.x, WORLD.GROUND_Y + 8, sw, 5, 0, 0, Math.PI * 2); ctx.fill();
    // 轨迹
    for (let i = 0; i < trail.length; i++) {
      const tr = trail[i];
      ctx.fillStyle = `rgba(249,115,22,${(i / trail.length) * 0.22})`;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, BALL.R * (i / trail.length) * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    // 球
    const g = ctx.createRadialGradient(b.x - 5, b.y - 5, 3, b.x, b.y, BALL.R);
    g.addColorStop(0, '#fb923c'); g.addColorStop(1, COLORS.ball);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL.R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.ballDark; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL.R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x - BALL.R, b.y); ctx.lineTo(b.x + BALL.R, b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x, b.y - BALL.R); ctx.lineTo(b.x, b.y + BALL.R); ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x - BALL.R * 1.4, b.y, BALL.R * 1.2, -0.5, 0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x + BALL.R * 1.4, b.y, BALL.R * 1.2, Math.PI - 0.5, Math.PI + 0.5); ctx.stroke();
  }

  function drawScoreboard(run) {
    const cx = WORLD.WIDTH / 2;
    ctx.fillStyle = 'rgba(8,12,26,0.72)';
    roundRect(ctx, cx - 150, 18, 300, 64, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = COLORS.p1; ctx.fillText(t('you'), cx - 95, 36);
    ctx.fillStyle = COLORS.p2; ctx.fillText(t('bot'), cx + 95, 36);
    ctx.font = `900 34px ${FONT}`;
    ctx.fillStyle = COLORS.p1; ctx.fillText(String(run.scores[0]), cx - 95, 60);
    ctx.fillStyle = '#fff'; ctx.fillText(':', cx, 58);
    ctx.fillStyle = COLORS.p2; ctx.fillText(String(run.scores[1]), cx + 95, 60);
    ctx.font = `bold 10px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`FIRST TO ${RULES.winScore}`, cx, 78);
  }

  function drawFlash(run) {
    if (run.scoreFlash <= 0) return;
    const a = Math.min(1, run.scoreFlash);
    const scorer = run.lastScorer;
    const col = scorer === 0 ? COLORS.p1 : COLORS.p2;
    const hx = scorer === 0 ? COURT.right.x : COURT.left.x;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `900 46px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.fillText(t('scoreFlash'), hx, COURT.right.y - 70 - (1 - run.scoreFlash) * 24);
    ctx.restore();
  }

  function render({ run }) {
    ctx.save();
    if (shake > 0) {
      const m = shake * 8;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawBackground();
    drawHoop('left');
    drawHoop('right');
    if (run) {
      const b = run.ball;
      if (b.holder === null && Math.hypot(b.vx, b.vy) > 240) {
        trail.push({ x: b.x, y: b.y });
        if (trail.length > 9) trail.shift();
      } else if (trail.length) trail.shift();
      drawPlayer(run.players[0]);
      drawPlayer(run.players[1]);
      drawBall(b);
      drawScoreboard(run);
      drawFlash(run);
    }
    ctx.restore();
  }

  return { render, update, clearEffects, flashScore };
}