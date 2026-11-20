// Canvas 2D 渲染：霓虹街机风，程序化绘制所有元素（零素材）。
import { WORLD, GAME } from '../../config/game.config.js';

const DPR_CAP = 2;

function brickColor(hp) {
  const palette = ['#22e6ff', '#2bff9d', '#ffe14d', '#ff9d2e', '#ff4dd2', '#ff3b4d'];
  const idx = Math.min(palette.length - 1, Math.max(0, Math.ceil(hp) - 1));
  return palette[idx];
}

function drawPoly(ctx, x, y, r, sides, rot, color, glow = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  if (glow > 0) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(DPR_CAP, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const particles = [];
  let lastTime = 0;

  function burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 260;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.4,
        ttl: 0.5 + Math.random() * 0.4,
        r: 2 + Math.random() * 3,
        color,
      });
    }
  }

  function drawBackground(dt) {
    // 深空渐变
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#08081a');
    g.addColorStop(0.55, '#0d0d24');
    g.addColorStop(1, '#120a1e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 蛛网网格线
    ctx.strokeStyle = 'rgba(80, 90, 190, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.WIDTH; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD.HEIGHT; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
    // 中心放射线
    ctx.strokeStyle = 'rgba(120, 130, 255, 0.06)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(WORLD.LAUNCH_X, WORLD.LAUNCH_Y);
      ctx.lineTo(WORLD.LAUNCH_X + Math.cos(a) * 900, WORLD.LAUNCH_Y + Math.sin(a) * 900);
      ctx.stroke();
    }
  }

  function drawBounds() {
    // 地面与侧墙
    ctx.strokeStyle = 'rgba(80, 240, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(WORLD.WALL_L, WORLD.FLOOR_Y);
    ctx.lineTo(WORLD.WALL_R, WORLD.FLOOR_Y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(80, 240, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(WORLD.WALL_L, WORLD.TOP_Y);
    ctx.lineTo(WORLD.WALL_L, WORLD.FLOOR_Y);
    ctx.moveTo(WORLD.WALL_R, WORLD.TOP_Y);
    ctx.lineTo(WORLD.WALL_R, WORLD.FLOOR_Y);
    ctx.stroke();
  }

  function drawLauncher() {
    // 发射口底座
    const g = ctx.createRadialGradient(WORLD.LAUNCH_X, WORLD.LAUNCH_Y, 4, WORLD.LAUNCH_X, WORLD.LAUNCH_Y, 60);
    g.addColorStop(0, 'rgba(60, 220, 255, 0.9)');
    g.addColorStop(1, 'rgba(60, 220, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(WORLD.LAUNCH_X, WORLD.LAUNCH_Y, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3cdcff';
    ctx.beginPath();
    ctx.arc(WORLD.LAUNCH_X, WORLD.LAUNCH_Y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAimGuide(aimAngle, time) {
    if (aimAngle == null) return;
    const len = 2200;
    const ex = WORLD.LAUNCH_X + Math.sin(aimAngle) * len;
    const ey = WORLD.LAUNCH_Y - Math.cos(aimAngle) * len;
    ctx.strokeStyle = 'rgba(255, 240, 150, 0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 12]);
    ctx.lineDashOffset = -time * 80;
    ctx.beginPath();
    ctx.moveTo(WORLD.LAUNCH_X, WORLD.LAUNCH_Y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    // 箭头顶端
    ctx.fillStyle = '#fff0a0';
    ctx.beginPath();
    ctx.arc(ex, ey, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBrick(b, time) {
    if (!b.alive) return;
    const pulse = b.isPower ? 1 + 0.12 * Math.sin(time * 5 + b.col + b.row) : 1;
    const r = b.r * pulse;
    const rot = b.rot * (Math.PI / 180) + (b.isPower ? time * 0.6 : 0);

    if (b.indestructible) {
      // 岩石：灰色六边形 + 裂纹
      drawPoly(ctx, b.x, b.y, r * 0.86, 6, rot, '#5a5f78', 8);
      ctx.strokeStyle = 'rgba(30, 32, 44, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - r * 0.3, b.y - r * 0.3);
      ctx.lineTo(b.x + r * 0.1, b.y);
      ctx.lineTo(b.x - r * 0.2, b.y + r * 0.3);
      ctx.stroke();
      return;
    }

    if (b.type === 'addBall') {
      drawPoly(ctx, b.x, b.y, r * 0.92, 6, rot, '#22e6ff', 14);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(b.x - r * 0.4, b.y);
      ctx.lineTo(b.x + r * 0.4, b.y);
      ctx.moveTo(b.x, b.y - r * 0.4);
      ctx.lineTo(b.x, b.y + r * 0.4);
      ctx.stroke();
      return;
    }
    if (b.type === 'laser') {
      drawPoly(ctx, b.x, b.y, r * 0.9, 4, rot + Math.PI / 4, '#ff4d5e', 14);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - r * 0.5);
      ctx.lineTo(b.x, b.y + r * 0.5);
      ctx.stroke();
      return;
    }
    if (b.type === 'violet') {
      drawPoly(ctx, b.x, b.y, r * 0.88, 8, rot, '#c44dff', 16);
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + rot;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * r * 0.2, b.y + Math.sin(a) * r * 0.2);
        ctx.lineTo(b.x + Math.cos(a) * r * 0.6, b.y + Math.sin(a) * r * 0.6);
        ctx.stroke();
      }
      return;
    }

    // 普通数字砖：按类型画多边形
    const sides = { penta: 5, rect: 4, tri: 3, cir: 20, hex: 6 }[b.type] || 5;
    const baseRot = b.type === 'tri' ? rot : rot;
    drawPoly(ctx, b.x, b.y, r * 0.94, sides, baseRot, brickColor(b.hp), 12);
    // 外圈描边
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 0.94, 0, Math.PI * 2);
    ctx.stroke();
    // 数字
    ctx.fillStyle = '#0b0b18';
    ctx.font = "bold 26px 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(b.hp), b.x, b.y + 1);

    // 目标标记：红色「!」提醒玩家这些节点要全部清除（vision 目标可见性）
    const bx = b.x + r * 0.74;
    const by = b.y - r * 0.74;
    ctx.fillStyle = '#ff3b4d';
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillText('!', bx, by + 0.5);
    ctx.font = "bold 26px 'Courier New', monospace";
  }

  function drawBall(ball) {
    if (!ball) return;
    // 拖尾
    const trail = 8;
    for (let i = trail; i > 0; i -= 1) {
      const k = i / trail;
      const px = ball.x - ball.vx * k * 0.016;
      const py = ball.y - ball.vy * k * 0.016;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.08 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(px, py, WORLD.BALL_R * (1 - k * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(ball.x, ball.y, 1, ball.x, ball.y, WORLD.BALL_R + 6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, '#9ef0ff');
    g.addColorStop(1, 'rgba(60, 220, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, WORLD.BALL_R + 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBallQueue(shotsLeft) {
    const n = Math.min(12, Math.max(0, shotsLeft));
    for (let i = 0; i < n; i += 1) {
      const x = WORLD.LAUNCH_X + (i - (n - 1) / 2) * 26;
      const y = WORLD.FLOOR_Y - 26;
      ctx.fillStyle = 'rgba(160, 240, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.ttl -= dt;
      if (p.ttl <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      const a = Math.max(0, p.ttl / p.life);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(state, dt, view) {
    const now = (state && state.time) || lastTime;
    lastTime = now;
    const v = view || {};
    const shake = v.shake || 0;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawBackground(now);

    if (!state) {
      ctx.restore();
      return;
    }

    drawBounds();
    drawLauncher();

    for (const b of state.bricks) drawBrick(b, now);
    drawBallQueue(state.shotsLeft);
    if (v.aimActive) drawAimGuide(v.aimAngle, now);
    drawBall(state.ball);
    drawParticles(dt);

    ctx.restore();
  }

  return { draw, burst, debugLayout: () => ({ launcher: { x: WORLD.LAUNCH_X, y: WORLD.LAUNCH_Y, w: 60, h: 60 } }) };
}
