// BEAR DASH RUN · Canvas 2D 渲染（霓虹街机，程序化，无素材）
import { WORLD, PLAYER } from '../../config/game.config.js';

const NEON = {
  cyan: '#4FF8FF',
  magenta: '#FF4FD8',
  yellow: '#FFD84E',
  orange: '#FF8A3C',
  green: '#7CFF6B',
  pink: '#FF5FA2',
  purple: '#9D6BFF',
  bgTop: '#0a0620',
  bgBottom: '#1a0b3a',
  grid: 'rgba(79, 248, 255, 0.16)',
  ground: '#0e1030',
};

function glow(ctx, color, blur = 16) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function star(ctx, cx, cy, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function drawBackdrop(t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, NEON.bgTop);
    g.addColorStop(1, NEON.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 合成波太阳
    const sunCx = WORLD.WIDTH * 0.72;
    const sunCy = WORLD.GROUND_Y - 40;
    const grad = ctx.createLinearGradient(0, sunCy - 190, 0, sunCy);
    grad.addColorStop(0, 'rgba(255, 79, 216, 0.0)');
    grad.addColorStop(1, 'rgba(255, 79, 216, 0.55)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sunCx, sunCy, 190, Math.PI, 0);
    ctx.fill();
    const sunGrad = ctx.createLinearGradient(0, sunCy - 120, 0, sunCy);
    sunGrad.addColorStop(0, '#FF4FD8');
    sunGrad.addColorStop(1, '#FF2E7E');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunCx, sunCy, 120, Math.PI, 0);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      ctx.strokeStyle = 'rgba(255, 79, 216, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sunCx - 120 - i * 26, sunCy);
      ctx.lineTo(sunCx + 120 + i * 26, sunCy);
      ctx.stroke();
    }

    // 远景楼宇
    for (let i = 0; i < 26; i += 1) {
      const bx = i * 56 - ((t * 12) % 56);
      const bh = 60 + ((i * 37) % 140);
      ctx.fillStyle = 'rgba(58, 34, 120, 0.55)';
      ctx.fillRect(bx, WORLD.GROUND_Y - bh, 34, bh);
      ctx.fillStyle = NEON.magenta;
      ctx.globalAlpha = 0.5;
      for (let w = 0; w < 4; w += 1) ctx.fillRect(bx + 5 + w * 8, WORLD.GROUND_Y - bh + 8, 3, 4);
      ctx.globalAlpha = 1;
    }

    // 网格地面
    ctx.fillStyle = NEON.ground;
    ctx.fillRect(0, WORLD.GROUND_Y, WORLD.WIDTH, WORLD.HEIGHT - WORLD.GROUND_Y);
    ctx.strokeStyle = NEON.grid;
    ctx.lineWidth = 1;
    const off = (t * 40) % 56;
    for (let x = -off; x < WORLD.WIDTH; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, WORLD.GROUND_Y);
      ctx.lineTo(x + 40, WORLD.HEIGHT);
      ctx.stroke();
    }
    ctx.strokeStyle = NEON.cyan;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.GROUND_Y);
    ctx.lineTo(WORLD.WIDTH, WORLD.GROUND_Y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawPlayer(p, t) {
    const x = p.x;
    const y = p.y;
    const facing = p.facing;
    const run = p.onGround && Math.abs(p.vx) > 10;
    const bob = run ? Math.sin(t * 18) * 2 : 0;
    ctx.save();
    ctx.translate(x + PLAYER.W / 2, y + PLAYER.H + bob);
    if (facing < 0) ctx.scale(-1, 1);

    // 身体（亮青，最亮最粗，保证剪影清晰）
    glow(ctx, NEON.cyan, 18);
    ctx.fillStyle = '#E9FBFF';
    rr(ctx, -PLAYER.W / 2, -PLAYER.H, PLAYER.W, PLAYER.H - 8, 14);
    ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = 'rgba(5, 3, 15, 0.9)';
    ctx.lineWidth = 2;
    rr(ctx, -PLAYER.W / 2, -PLAYER.H, PLAYER.W, PLAYER.H - 8, 14);
    ctx.stroke();
    ctx.fillStyle = NEON.cyan;
    rr(ctx, -PLAYER.W / 2 + 3, -PLAYER.H + 3, PLAYER.W - 6, PLAYER.H - 14, 12);
    ctx.fill();

    // 耳朵
    ctx.fillStyle = '#E9FBFF';
    ctx.beginPath();
    ctx.arc(-12, -PLAYER.H + 4, 9, 0, Math.PI * 2);
    ctx.arc(12, -PLAYER.H + 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NEON.magenta;
    ctx.beginPath();
    ctx.arc(-12, -PLAYER.H + 4, 4, 0, Math.PI * 2);
    ctx.arc(12, -PLAYER.H + 4, 4, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#0a0620';
    ctx.beginPath();
    ctx.arc(9, -PLAYER.H + 16, 3.4, 0, Math.PI * 2);
    ctx.arc(20, -PLAYER.H + 16, 3.4, 0, Math.PI * 2);
    ctx.fill();

    // 围巾
    ctx.fillStyle = NEON.orange;
    rr(ctx, -16, -16, 32, 8, 4);
    ctx.fill();

    // 无敌闪烁
    if (p.invT > 0) {
      ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 30);
      ctx.fillStyle = '#FFFFFF';
      rr(ctx, -PLAYER.W / 2 - 4, -PLAYER.H - 4, PLAYER.W + 8, PLAYER.H, 16);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawRock(r) {
    glow(ctx, NEON.purple, 12);
    ctx.fillStyle = '#1c1140';
    rr(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = NEON.purple;
    ctx.lineWidth = 2;
    rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(157, 107, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(r.x + 6, r.y + r.h - 8);
    ctx.lineTo(r.x + r.w - 6, r.y + r.h - 8);
    ctx.stroke();
  }

  function drawSpike(s) {
    const n = Math.max(2, Math.floor(s.w / 40));
    for (let i = 0; i < n; i += 1) {
      const sx = s.x + (s.w / n) * i;
      const sw = s.w / n;
      glow(ctx, NEON.orange, 8);
      ctx.fillStyle = '#2a0d08';
      ctx.beginPath();
      ctx.moveTo(sx, s.y + s.h);
      ctx.lineTo(sx + sw / 2, s.y);
      ctx.lineTo(sx + sw, s.y + s.h);
      ctx.closePath();
      ctx.fill();
      noGlow(ctx);
      ctx.strokeStyle = NEON.orange;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawRing(r, t) {
    glow(ctx, NEON.magenta, 14);
    ctx.strokeStyle = NEON.magenta;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(255, 79, 216, 0.18)';
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r - 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEnemy(e, t) {
    const bob = Math.sin(t * 8) * 2;
    glow(ctx, NEON.magenta, 12);
    ctx.fillStyle = '#3a0b30';
    rr(ctx, e.x, e.y + bob, e.w, e.h, 8);
    ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = NEON.magenta;
    ctx.lineWidth = 2;
    rr(ctx, e.x + 2, e.y + 2 + bob, e.w - 4, e.h - 4, 6);
    ctx.stroke();
    // 眼睛（红色，朝巡逻方向）
    ctx.fillStyle = '#FF3A3A';
    const eyeX = e.dir > 0 ? e.x + e.w - 14 : e.x + 8;
    ctx.beginPath();
    ctx.arc(eyeX, e.y + 14 + bob, 5, 0, Math.PI * 2);
    ctx.arc(eyeX + (e.dir > 0 ? 0 : 12), e.y + 14 + bob, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawChomper(c, t) {
    glow(ctx, NEON.green, 10);
    ctx.fillStyle = '#0b2a12';
    rr(ctx, c.x, c.y, c.w, c.h, 10);
    ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = NEON.green;
    ctx.lineWidth = 2;
    rr(ctx, c.x + 2, c.y + 2, c.w - 4, c.h - 4, 8);
    ctx.stroke();
    // 牙齿
    ctx.fillStyle = '#E9FBFF';
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(c.x + 12 + i * 16, c.y + 8);
      ctx.lineTo(c.x + 20 + i * 16, c.y + 8);
      ctx.lineTo(c.x + 16 + i * 16, c.y + 18);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBooster(b, t) {
    glow(ctx, NEON.yellow, 10);
    ctx.fillStyle = '#241a05';
    rr(ctx, b.x, b.y, b.w, b.h, 6);
    ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = NEON.yellow;
    ctx.lineWidth = 2;
    rr(ctx, b.x + 2, b.y + 2, b.w - 4, b.h - 4, 5);
    ctx.stroke();
    ctx.fillStyle = NEON.yellow;
    const pulse = 1 + Math.sin(t * 10) * 0.3;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w / 2, b.y + b.h - 8);
    ctx.lineTo(b.x + b.w / 2 - 7, b.y + b.h - 2);
    ctx.lineTo(b.x + b.w / 2 + 7, b.y + b.h - 2);
    ctx.closePath();
    ctx.fill();
  }

  function drawGoal(goalX, camX) {
    const x = goalX - camX;
    glow(ctx, NEON.yellow, 14);
    ctx.strokeStyle = '#E9FBFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, WORLD.GROUND_Y);
    ctx.lineTo(x, WORLD.GROUND_Y - 130);
    ctx.stroke();
    noGlow(ctx);
    ctx.fillStyle = NEON.yellow;
    ctx.beginPath();
    ctx.moveTo(x, WORLD.GROUND_Y - 130);
    ctx.lineTo(x + 66, WORLD.GROUND_Y - 108);
    ctx.lineTo(x, WORLD.GROUND_Y - 86);
    ctx.closePath();
    ctx.fill();
    glow(ctx, NEON.yellow, 8);
    ctx.fillStyle = NEON.yellow;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('GOAL', x + 4, WORLD.GROUND_Y - 140);
    noGlow(ctx);
  }

  function drawGoalBeacon(t) {
    const x = WORLD.WIDTH - 48;
    const y = WORLD.GROUND_Y - 130;
    glow(ctx, NEON.yellow, 16);
    ctx.fillStyle = NEON.yellow;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GOAL →', x, y - 20);
    noGlow(ctx);
    ctx.fillStyle = '#E9FBFF';
    ctx.fillRect(x - 2, y, 4, 44);
    ctx.fillStyle = NEON.yellow;
    ctx.beginPath();
    ctx.moveTo(x + 2, y);
    ctx.lineTo(x + 26, y + 10);
    ctx.lineTo(x + 2, y + 20);
    ctx.closePath();
    ctx.fill();
  }

  function render(view) {
    const t = view.time || 0;
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    drawBackdrop(t);

    if (!view.run) return;

    const run = view.run;
    const s = run.state;
    const p = s.player;
    // 相机跟随玩家
    const camX = Math.max(0, Math.min(s.width - WORLD.WIDTH, p.x - 240));

    ctx.save();
    ctx.translate(-camX, 0);

    // 障碍与实体
    for (const r of run.entities.boosters) drawBooster(r, t);
    for (const r of run.entities.rocks) drawRock(r);
    for (const sp of run.entities.spikes) drawSpike(sp);
    for (const rg of run.entities.rings) drawRing(rg, t);
    for (const c of run.entities.chompers) drawChomper(c, t);
    for (const e of run.entities.enemies) if (!e.dead) drawEnemy(e, t);
    for (const st of run.entities.stars) {
      if (st.taken) continue;
      const tw = 1 + Math.sin(t * 6 + st.x) * 0.12;
      ctx.strokeStyle = 'rgba(255, 216, 78, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(st.x, st.y, 24 * tw, 0, Math.PI * 2);
      ctx.stroke();
      glow(ctx, NEON.yellow, 16);
      star(ctx, st.x, st.y, 18 * tw, NEON.yellow);
      noGlow(ctx);
    }
    drawGoal(s.goalX, camX);
    if (p.alive) drawPlayer(p, t);
    ctx.restore();

    // 终点在屏外时，右侧给出明确的目标方向指示
    if (s.goalX - camX > WORLD.WIDTH - 40) drawGoalBeacon(t);

    // 加速时的速度线
    if (p.boostT > 0) {
      ctx.strokeStyle = 'rgba(79, 248, 255, 0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const ly = 80 + ((i * 79) % 480);
        const lx = ((t * 1400 + i * 173) % WORLD.WIDTH);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 70, ly);
        ctx.stroke();
      }
    }
  }

  return { render };
}
