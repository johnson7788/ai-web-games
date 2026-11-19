// HOOP FRENZY · Canvas 2D 渲染（霓虹街机 synthwave，纯程序化，零素材零外链）
// 目标环：发光的当前目标环带「TARGET」信标 + 旋转瞄准圈，非目标环变暗。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function neon(ctx, color, blur = 18) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noNeon(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

function rrPath(ctx, x, y, w, h, r) {
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
  let t = 0;
  let showHints = true;

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0d0318');
    g.addColorStop(0.5, '#24104a');
    g.addColorStop(0.72, '#38135a');
    g.addColorStop(1, '#0a0820');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星空
    noNeon(ctx);
    ctx.fillStyle = 'rgba(220,235,255,0.6)';
    for (let i = 0; i < 60; i += 1) {
      const sx = (i * 97.3) % WORLD.WIDTH;
      const sy = (i * 61.7) % 420;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.globalAlpha = tw * 0.7;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // 地平线辉光
    const hg = ctx.createLinearGradient(0, 470, 0, 520);
    hg.addColorStop(0, 'rgba(255,45,120,0)');
    hg.addColorStop(0.5, 'rgba(255,45,120,0.35)');
    hg.addColorStop(1, 'rgba(255,45,120,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 470, WORLD.WIDTH, 50);

    // 透视网格地面
    ctx.strokeStyle = 'rgba(0,229,255,0.28)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i <= 12; i += 1) {
      const x = (i / 12) * WORLD.WIDTH;
      ctx.moveTo(x, WORLD.HEIGHT);
      ctx.lineTo(WORLD.WIDTH / 2 + (x - WORLD.WIDTH / 2) * 0.16, 492);
    }
    for (let j = 0; j <= 6; j += 1) {
      const yy = 492 + Math.pow(j / 6, 1.7) * (WORLD.HEIGHT - 492);
      ctx.moveTo(0, yy);
      ctx.lineTo(WORLD.WIDTH, yy);
    }
    ctx.stroke();
  }

  function drawBackboard(x, y, side) {
    ctx.save();
    noNeon(ctx);
    const dir = side < 0 ? 1 : -1;
    const bx = x + dir * (LAYOUT.RIM_R + 26);
    ctx.fillStyle = 'rgba(20,10,40,0.75)';
    ctx.strokeStyle = 'rgba(0,229,255,0.5)';
    ctx.lineWidth = 2;
    rrPath(ctx, bx - 6, y - 56, 12, 112, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawRing(x, y, side, opts = {}) {
    const { active = false, golden = false } = opts;
    const color = golden ? '#ff2d78' : (active ? '#00e5ff' : '#4a3a7a');
    const pulse = active ? (0.7 + 0.3 * Math.sin(t * 5)) : 0.55;

    drawBackboard(x, y, side);

    ctx.save();
    neon(ctx, color, active ? 30 : 6);
    ctx.strokeStyle = color;
    ctx.lineWidth = active ? 7 : 5;
    ctx.globalAlpha = active ? 0.95 * pulse : 0.35;
    ctx.beginPath();
    ctx.arc(x, y, LAYOUT.RIM_R, 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = active ? 0.5 : 0.2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, LAYOUT.RIM_R - 8, 0, TAU);
    ctx.stroke();

    // 网
    ctx.globalAlpha = active ? 0.55 : 0.2;
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + i * 18, y + LAYOUT.RIM_R - 4);
      ctx.lineTo(x + i * 26, y + LAYOUT.RIM_R + 34);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 26, y + LAYOUT.RIM_R + 34);
    ctx.lineTo(x + 26, y + LAYOUT.RIM_R + 34);
    ctx.stroke();
    ctx.restore();
    noNeon(ctx);

    if (!active) return;
    if (!showHints) return;

    // 旋转瞄准圈（虚线）
    ctx.save();
    neon(ctx, golden ? '#ffd54a' : '#00e5ff', 14);
    ctx.strokeStyle = golden ? '#ffd54a' : '#00e5ff';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    ctx.arc(x, y, LAYOUT.RIM_R + 20, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    noNeon(ctx);

    // 目标信标（上方倒三角 + 竖线）
    const by = y - LAYOUT.RIM_R - 34;
    const bob = Math.sin(t * 4) * 4;
    ctx.save();
    neon(ctx, golden ? '#ffd54a' : '#00e5ff', 16);
    ctx.strokeStyle = golden ? '#ffd54a' : '#00e5ff';
    ctx.fillStyle = golden ? '#ffd54a' : '#00e5ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, by - 18 + bob);
    ctx.lineTo(x, by + 6 + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 12, by + bob);
    ctx.lineTo(x, by + 10 + bob);
    ctx.lineTo(x + 12, by + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    noNeon(ctx);
  }

  function drawTargetLabel(state, view) {
    if (!showHints) return;
    if (state.targetSide === undefined) return;
    const x = state.targetSide === -1 ? LAYOUT.RING_X_L : LAYOUT.RING_X_R;
    const y = state.targetRingY - LAYOUT.RIM_R - 70;
    ctx.save();
    neon(ctx, state.golden ? '#ffd54a' : '#00e5ff', 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(view.targetLabel || 'TARGET', x, y);
    ctx.restore();
    noNeon(ctx);
  }

  function drawPad(x, y) {
    ctx.save();
    neon(ctx, '#00e5ff', 16);
    ctx.fillStyle = 'rgba(0,229,255,0.16)';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 46, y);
    ctx.lineTo(x - 28, y - 18);
    ctx.lineTo(x + 28, y - 18);
    ctx.lineTo(x + 46, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    noNeon(ctx);
  }

  function drawBall(bx, by, fiery) {
    ctx.save();
    const r = LAYOUT.BALL_R;
    // 呼吸光环
    neon(ctx, fiery ? '#ff5a2d' : '#ffd54a', 22);
    ctx.strokeStyle = fiery ? 'rgba(255,90,60,0.6)' : 'rgba(255,213,74,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, by, r + 7 + Math.sin(t * 4) * 2, 0, TAU);
    ctx.stroke();
    // 球体
    neon(ctx, fiery ? '#ff5a2d' : '#ffd54a', 26);
    const g = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, fiery ? '#ff8a3c' : '#ffe27a');
    g.addColorStop(1, fiery ? '#ff3d2e' : '#ffb300');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, TAU);
    ctx.fill();
    ctx.restore();
    noNeon(ctx);
  }

  function drawMeter(state, view) {
    if (!showHints) return;
    const cx = WORLD.WIDTH / 2;
    const y = LAYOUT.METER_Y;
    const w = LAYOUT.METER_W;
    const x0 = cx - w / 2;
    const power = state.power;
    const ideal = clamp(0.5 + (state.targetRingY - GAME.RING_BASE_Y) * GAME.AIM_K, 0.12, 0.88);
    const cfg = GAME.STAGES[clamp(state.stage, 1, GAME.STAGES.length) - 1];

    ctx.save();
    ctx.fillStyle = 'rgba(8,6,22,0.9)';
    ctx.strokeStyle = 'rgba(0,229,255,0.5)';
    ctx.lineWidth = 2;
    rrPath(ctx, x0 - 14, y - 16, w + 28, 34, 10);
    ctx.fill();
    ctx.stroke();

    // 绿色甜区
    const zx0 = x0 + (ideal - cfg.clean) * w;
    const zx1 = x0 + (ideal + cfg.clean) * w;
    ctx.fillStyle = 'rgba(0,255,140,0.6)';
    ctx.fillRect(zx0, y - 7, zx1 - zx0, 14);

    // 理想中心刻度
    ctx.fillStyle = 'rgba(255,209,84,0.95)';
    ctx.fillRect(x0 + ideal * w - 1, y - 13, 2, 26);

    // 指针
    const nx = x0 + power * w;
    neon(ctx, '#ffffff', 14);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(nx, y - 15);
    ctx.lineTo(nx, y + 15);
    ctx.stroke();
    ctx.restore();
    noNeon(ctx);

    // TAP 提示
    ctx.save();
    ctx.fillStyle = 'rgba(0,255,140,0.95)';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText((view.tapLabel || 'TAP') + '!', cx, y - 24);
    ctx.restore();
  }

  function drawFx(view) {
    for (const fx of view.fxQueue) {
      const k = 1 - (fx.ttl / fx.ttl0);
      if (fx.type === 'spark') {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        neon(ctx, fx.hue, 14);
        ctx.fillStyle = fx.hue;
        ctx.beginPath();
        ctx.arc(fx.x + fx.vx * k, fx.y + fx.vy * k, fx.r * (1 - k * 0.6), 0, TAU);
        ctx.fill();
        ctx.restore();
        noNeon(ctx);
      } else if (fx.type === 'ringFlash') {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        neon(ctx, fx.hue, 22);
        ctx.strokeStyle = fx.hue;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, LAYOUT.RIM_R + 6 + k * 26, 0, TAU);
        ctx.stroke();
        ctx.restore();
        noNeon(ctx);
      }
    }
  }

  function debugLayout(state) {
    return {
      meter: { x: WORLD.WIDTH / 2 - LAYOUT.METER_W / 2, y: LAYOUT.METER_Y - 18, w: LAYOUT.METER_W, h: 40 },
      ringL: { x: LAYOUT.RING_X_L - LAYOUT.RIM_R, y: (state ? state.targetRingY : GAME.RING_BASE_Y) - LAYOUT.RIM_R, w: LAYOUT.RIM_R * 2, h: LAYOUT.RIM_R * 2 },
      ringR: { x: LAYOUT.RING_X_R - LAYOUT.RIM_R, y: (state ? state.targetRingY : GAME.RING_BASE_Y) - LAYOUT.RIM_R, w: LAYOUT.RIM_R * 2, h: LAYOUT.RIM_R * 2 },
    };
  }

  return {
    draw(state, dt, view) {
      t += dt;
      showHints = view.showHints !== false;
      const shake = view.shake || 0;
      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }
      drawBackground();

      if (state) {
        drawRing(LAYOUT.RING_X_L, state.targetSide === -1 ? state.targetRingY : state.ringBaseYL, -1, { active: state.targetSide === -1, golden: state.golden && state.targetSide === -1 });
        drawRing(LAYOUT.RING_X_R, state.targetSide === 1 ? state.targetRingY : state.ringBaseYR, 1, { active: state.targetSide === 1, golden: state.golden && state.targetSide === 1 });
        drawTargetLabel(state, view);
        drawPad(LAYOUT.PAD_X, LAYOUT.PAD_Y);

        let bx = LAYOUT.PAD_X;
        let by = LAYOUT.PAD_Y - LAYOUT.BALL_R - 4;
        const shotFx = view.fxQueue.find((f) => f.type === 'shot');
        if (shotFx) {
          const k = 1 - shotFx.ttl / shotFx.ttl0;
          const { from, to, arc } = shotFx;
          bx = from.x + (to.x - from.x) * k;
          const ctrlY = Math.min(from.y, to.y) - arc;
          by = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * ctrlY + k * k * to.y;
        }
        drawBall(bx, by, state.combo >= 3);

        drawMeter(state, view);
      }

      drawFx(view);
      ctx.restore();
      noNeon(ctx);
    },
    debugLayout,
  };
}
