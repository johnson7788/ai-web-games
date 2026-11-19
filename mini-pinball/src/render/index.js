// MINI PINBALL · Canvas 2D 渲染（全程序化，零素材零外链）。
// 霓虹街机气质：暗夜底 + 荧光网格 + 发光球/方块/挡板 + 扫线。
import { WORLD, BALL, ARENA, SCORING } from '../../config/game.config.js';

const COLORS = {
  bg0: '#06060f',
  bg1: '#0b0b1e',
  grid: 'rgba(90, 90, 160, 0.10)',
  brick: '#ff4d9e',
  brickEdge: '#ff8ec4',
  rubber: '#5dff8c',
  rubberEdge: '#b6ffd0',
  bumper: '#ffb84d',
  bumperEdge: '#ffd99b',
  ball: '#4df3ff',
  ballCore: '#eaffff',
  orb: '#ffe066',
  pad: '#4df3ff',
  aim: '#dffcff',
};

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

function glow(ctx, color, blur = 18) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, COLORS.bg0);
    g.addColorStop(1, COLORS.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 网格
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x <= WORLD.WIDTH; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD.HEIGHT; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }

    // 底部发射台地面光带
    const band = ctx.createLinearGradient(0, WORLD.HEIGHT - 150, 0, WORLD.HEIGHT);
    band.addColorStop(0, 'rgba(77, 243, 255, 0)');
    band.addColorStop(1, 'rgba(77, 243, 255, 0.10)');
    ctx.fillStyle = band;
    ctx.fillRect(0, WORLD.HEIGHT - 150, WORLD.WIDTH, 150);

    // 扫线（reduced-motion 关闭）
    if (!reduceMotion) {
      ctx.fillStyle = 'rgba(255,255,255,0.020)';
      for (let y = 0; y < WORLD.HEIGHT; y += 4) {
        ctx.fillRect(0, y, WORLD.WIDTH, 1);
      }
    }
  }

  function drawBlock(b, time) {
    if (!b.alive) return;
    if (b.type === 'bumper') {
      const r = b.r * (1 + (b.pulse || 0) * 0.22);
      const cx = b.x;
      const cy = b.y;
      ctx.save();
      glow(ctx, COLORS.bumper, 22);
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      grad.addColorStop(0, COLORS.bumperEdge);
      grad.addColorStop(1, COLORS.bumper);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.bumperEdge;
      ctx.lineWidth = 3;
      ctx.stroke();
      // 内环
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      return;
    }
    const color = b.type === 'rubber' ? COLORS.rubber : COLORS.brick;
    const edge = b.type === 'rubber' ? COLORS.rubberEdge : COLORS.brickEdge;
    const x = b.x - b.w / 2;
    const y = b.y - b.h / 2;
    ctx.save();
    glow(ctx, color, b.type === 'rubber' ? 16 : 14);
    const grad = ctx.createLinearGradient(x, y, x, y + b.h);
    grad.addColorStop(0, edge);
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    const rr = b.type === 'rubber' ? Math.min(b.w / 2, 6) : 8;
    roundRect(ctx, x, y, b.w, b.h, rr);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, b.w, b.h, rr);
    ctx.stroke();
    ctx.restore();

    // 目标标记：白色菱形（可破坏方块）/ 白色圆点（橡皮细条），明确「可击中」。
    ctx.save();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    if (b.type === 'rubber') {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const s = Math.min(b.w, b.h) * 0.22;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - s);
      ctx.lineTo(b.x + s, b.y);
      ctx.lineTo(b.x, b.y + s);
      ctx.lineTo(b.x - s, b.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOrb(o, time) {
    if (!o.alive) return;
    const bob = reduceMotion ? 0 : Math.sin(time * 4 + o.x * 0.01) * 3;
    const cy = o.y + bob;
    ctx.save();
    glow(ctx, COLORS.orb, 18);
    const grad = ctx.createRadialGradient(o.x - 4, cy - 4, 2, o.x, cy, 14);
    grad.addColorStop(0, '#fff8d0');
    grad.addColorStop(1, COLORS.orb);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(o.x, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff8d0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawPad(time) {
    const px = BALL.LAUNCH_X;
    const py = BALL.LAUNCH_Y;
    ctx.save();
    glow(ctx, COLORS.pad, 16);
    ctx.fillStyle = 'rgba(77,243,255,0.18)';
    ctx.beginPath();
    ctx.arc(px, py, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.pad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBall(state, trail) {
    const b = state.ball;
    if (!b.active && state.phase !== 'aiming') return;
    if (!b.active) {
      // 待发球：停在发射台
      ctx.save();
      glow(ctx, COLORS.ball, 20);
      const grad = ctx.createRadialGradient(b.x - 5, b.y - 5, 2, b.x, b.y, BALL.RADIUS);
      grad.addColorStop(0, COLORS.ballCore);
      grad.addColorStop(1, COLORS.ball);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL.RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    // 拖尾
    if (trail && trail.length > 1) {
      ctx.save();
      for (let i = 1; i < trail.length; i += 1) {
        const p = trail[i];
        const a = i / trail.length;
        ctx.fillStyle = `rgba(77,243,255,${(a * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, BALL.RADIUS * a * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.save();
    glow(ctx, COLORS.ball, 22);
    const grad = ctx.createRadialGradient(b.x - 5, b.y - 5, 2, b.x, b.y, BALL.RADIUS);
    grad.addColorStop(0, COLORS.ballCore);
    grad.addColorStop(1, COLORS.ball);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL.RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.ballCore;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawAim(view) {
    if (!view.aim || !view.aim.active) return;
    const px = BALL.LAUNCH_X;
    const py = BALL.LAUNCH_Y;
    const ang = view.aim.angle;
    ctx.save();
    glow(ctx, COLORS.aim, 10);
    ctx.strokeStyle = 'rgba(223,252,255,0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(ang) * 200, py + Math.sin(ang) * 200);
    ctx.stroke();
    ctx.setLineDash([]);
    // 预测点
    ctx.fillStyle = COLORS.aim;
    for (let i = 1; i <= 8; i += 1) {
      const d = i * 26;
      const a = i / 8;
      ctx.globalAlpha = 1 - a * 0.7;
      ctx.beginPath();
      ctx.arc(px + Math.cos(ang) * d, py + Math.sin(ang) * d, 3.5 * (1 - a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawParticles(view, dt) {
    for (const p of view.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.ttl / p.maxTtl));
      glow(ctx, p.color, 10);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.ttl / p.maxTtl), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPopups(view) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of view.popups) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.ttl / p.maxTtl));
      ctx.font = '700 22px system-ui, sans-serif';
      glow(ctx, p.color, 8);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - (1 - p.ttl / p.maxTtl) * 26);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  return {
    draw(state, time, view) {
      drawBackground(time);
      if (state) {
        for (const b of state.blocks) drawBlock(b, time);
        for (const o of state.orbs) drawOrb(o, time);
        drawPad(time);
        drawAim(view);
        drawBall(state, view.trail);
      }
      drawParticles(view);
      drawPopups(view);
    },

    // 供教程 / 调试定位：发射台与第一块砖的屏幕区域
    debugLayout(state) {
      const pad = { x: BALL.LAUNCH_X - 40, y: BALL.LAUNCH_Y - 40, w: 80, h: 80 };
      let block = pad;
      if (state) {
        const first = state.blocks.find((b) => b.alive);
        if (first) {
          block = first.type === 'bumper'
            ? { x: first.x - first.r, y: first.y - first.r, w: first.r * 2, h: first.r * 2 }
            : { x: first.x - first.w / 2, y: first.y - first.h / 2, w: first.w, h: first.h };
        }
      }
      return { pad, block, board: { x: 0, y: 0, w: WORLD.WIDTH, h: WORLD.HEIGHT } };
    },
  };
}
