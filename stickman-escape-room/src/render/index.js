// STICKMAN ESCAPE ROOM · Canvas 2D 渲染（霓虹街机，全程序化，零素材）
// 画：房间背景 + 9 根柱子 + 下坠的天花板（安全缺口发光）+ 火柴人 + 道具 + 粒子 + 震屏。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const TOP_Y = 604;          // 柱子站人面
const GROUND_Y = 682;       // 地板
const CEIL_REST = 150;      // 天花板静止下沿
const CEIL_TRAVEL = 430;    // 天花板下坠总行程
const NOTCH = 162;          // 安全缺口凹入高度
const PLAYER_H = 66;        // 火柴人身高
const SPIKE_H = 20;

const COL = {
  margin: LAYOUT.MARGIN_X,
  get width() { return (WORLD.WIDTH - COL.margin * 2) / GAME.COLUMNS; },
};

function colCenterX(i) {
  return COL.margin + i * COL.width + COL.width / 2;
}

export function columnCenter(i) {
  return colCenterX(i);
}

function colRect(i) {
  const w = COL.width - LAYOUT.COL_GAP;
  return { x: colCenterX(i) - w / 2, w, y: TOP_Y, h: GROUND_Y - TOP_Y };
}

const NEON = {
  cyan: '#5cf2ff',
  magenta: '#ff4fd8',
  green: '#6cff7a',
  yellow: '#ffe14d',
  red: '#ff4d5e',
  blue: '#4d7cff',
  purple: '#b06cff',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  canvas.style.width = WORLD.WIDTH + 'px';
  canvas.style.height = WORLD.HEIGHT + 'px';
  ctx.scale(dpr, dpr);

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function glow(x, y, color, radius) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0a0618');
    g.addColorStop(0.55, '#160a2b');
    g.addColorStop(1, '#1c0f22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 霓虹地板网格
    ctx.strokeStyle = 'rgba(92,242,255,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 8; i += 1) {
      const x = colCenterX(i);
      ctx.moveTo(x, TOP_Y + 8);
      ctx.lineTo(x + (x - WORLD.WIDTH / 2) * 0.55, GROUND_Y + 40);
    }
    for (let k = 0; k < 6; k += 1) {
      const y = TOP_Y + 8 + k * ((GROUND_Y + 40 - TOP_Y - 8) / 5);
      ctx.moveTo(COL.margin - 30, y);
      ctx.lineTo(WORLD.WIDTH - COL.margin + 30, y);
    }
    ctx.stroke();

    // 顶部出口门（目标暗示）
    const doorX = WORLD.WIDTH / 2;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
    ctx.strokeStyle = `rgba(255,225,77,${0.35 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(doorX - 46, 4, 92, 62);
    ctx.fillStyle = `rgba(255,225,77,${0.5 + pulse * 0.3})`;
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', doorX, 32);
  }

  function drawColumn(i, state) {
    const r = colRect(i);
    const isRock = state.rocks[i];
    const isHaz = state.hazards[i];
    const isSafe = state.safe[i];

    // 柱体
    const bodyG = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    bodyG.addColorStop(0, '#241a3a');
    bodyG.addColorStop(1, '#0e0a1c');
    ctx.fillStyle = bodyG;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    // 边线霓虹
    ctx.strokeStyle = isRock ? 'rgba(120,90,140,0.7)' : 'rgba(92,242,255,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    // 岩石墙
    if (isRock) {
      ctx.fillStyle = '#2a2038';
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + r.w, r.y);
      ctx.lineTo(r.x + r.w * 0.82, r.y - 26);
      ctx.lineTo(r.x + r.w * 0.5, r.y - 40);
      ctx.lineTo(r.x + r.w * 0.2, r.y - 24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,120,170,0.8)';
      ctx.stroke();
    }

    // 熔岩（顶面红光）
    if (isHaz) {
      const lg = ctx.createLinearGradient(0, r.y, 0, r.y + 20);
      lg.addColorStop(0, '#ff4d5e');
      lg.addColorStop(1, 'rgba(255,77,94,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(r.x, r.y - 6, r.w, 26);
      ctx.fillStyle = '#ff9d5e';
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2, r.y + 4, 5 + 3 * Math.sin(performance.now() / 120), 0, Math.PI * 2);
      ctx.fill();
    }

    // 安全缺口地面标记（发光下沿 + 悬浮 EXIT 目标标记）
    if (isSafe) {
      glow(colCenterX(i), r.y, 'rgba(108,255,122,0.55)', 50);
      ctx.fillStyle = 'rgba(108,255,122,0.35)';
      ctx.fillRect(r.x + 2, r.y - 3, r.w - 4, 8);
      ctx.strokeStyle = NEON.green;
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x + 2, r.y - 3, r.w - 4, 8);

      const cx = colCenterX(i);
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 220 + i);
      const ay = r.y - 118;
      ctx.strokeStyle = `rgba(108,255,122,${0.75 + 0.25 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 10, ay);
      ctx.lineTo(cx, ay + 12);
      ctx.lineTo(cx + 10, ay);
      ctx.stroke();
      ctx.fillStyle = `rgba(108,255,122,${0.8 + 0.2 * pulse})`;
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', cx, ay - 8);
    }
  }

  function drawPowerup(i, state, view) {
    const kind = state.powers[i];
    if (!kind) return;
    const x = colCenterX(i);
    const bob = Math.sin(view.t * 3 + i) * 5;
    const y = TOP_Y - 46 + bob;
    const colors = { gem: NEON.cyan, shield: NEON.blue, slow: NEON.purple };
    const c = colors[kind];
    glow(x, y, c, 34);
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineWidth = 2;
    if (kind === 'gem') {
      // Lead 补丁：目标引导光圈（旋转虚线环）
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(view.t * 1.6);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(x, y - 15);
      ctx.lineTo(x + 12, y);
      ctx.lineTo(x, y + 15);
      ctx.lineTo(x - 12, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 9);
      ctx.closePath();
      ctx.stroke();
    } else if (kind === 'shield') {
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = Math.PI / 3 * k - Math.PI / 2;
        const px = x + Math.cos(a) * 9;
        const py = y + Math.sin(a) * 10;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x, y + 6);
      ctx.moveTo(x - 5, y + 6);
      ctx.lineTo(x + 5, y + 6);
      ctx.stroke();
    }
  }

  function drawStickman(i, state, view) {
    const x = colCenterX(i);
    const feetY = TOP_Y;
    const headY = feetY - PLAYER_H;
    const sway = Math.sin(view.t * 4) * 2;
    const crouch = state.phase === 'descending' ? state.descend * 8 : 0;

    // 外发光
    glow(x, headY + 22, 'rgba(255,255,255,0.35)', 42);

    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // 头
    ctx.beginPath();
    ctx.arc(x, headY + 8 + crouch, 9, 0, Math.PI * 2);
    ctx.fill();

    // 身体
    const shoulderY = headY + 20 + crouch;
    const hipY = headY + 40 + crouch;
    ctx.beginPath();
    ctx.moveTo(x, headY + 17 + crouch);
    ctx.lineTo(x, hipY);
    ctx.stroke();

    // 手臂
    ctx.beginPath();
    ctx.moveTo(x, shoulderY);
    ctx.lineTo(x - 12, shoulderY + 12 + sway);
    ctx.moveTo(x, shoulderY);
    ctx.lineTo(x + 12, shoulderY + 12 - sway);
    ctx.stroke();

    // 腿
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(x - 8, feetY - 2);
    ctx.moveTo(x, hipY);
    ctx.lineTo(x + 8, feetY - 2);
    ctx.stroke();

    // 眼睛（看向安全缺口的方向）
    ctx.fillStyle = '#0a0618';
    const look = state.safe[i] ? 0 : (state.safe[Math.min(state.columns - 1, i + 1)] ? 2 : (state.safe[Math.max(0, i - 1)] ? -2 : 0));
    ctx.beginPath();
    ctx.arc(x + look - 3, headY + 7 + crouch, 1.8, 0, Math.PI * 2);
    ctx.arc(x + look + 3, headY + 7 + crouch, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCeiling(state) {
    const bot = CEIL_REST + state.descend * CEIL_TRAVEL;
    for (let i = 0; i < state.columns; i += 1) {
      const r = colRect(i);
      const isSafe = state.safe[i];
      const stripBot = isSafe ? bot - NOTCH : bot;

      // 天花板主体（每列一条）
      const g = ctx.createLinearGradient(0, 0, 0, stripBot);
      g.addColorStop(0, '#2a1a45');
      g.addColorStop(1, '#1a1030');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, 0, r.w, stripBot);

      // 底部尖刺
      ctx.fillStyle = '#3a2a5a';
      const nSpikes = 3;
      for (let s = 0; s < nSpikes; s += 1) {
        const sx = r.x + (r.w / nSpikes) * s;
        const sw = r.w / nSpikes;
        ctx.beginPath();
        ctx.moveTo(sx, stripBot);
        ctx.lineTo(sx + sw / 2, stripBot + SPIKE_H);
        ctx.lineTo(sx + sw, stripBot);
        ctx.closePath();
        ctx.fill();
      }

      // 下沿霓虹边
      ctx.strokeStyle = isSafe ? NEON.green : NEON.magenta;
      ctx.lineWidth = isSafe ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(r.x, stripBot);
      ctx.lineTo(r.x + r.w, stripBot);
      ctx.stroke();

      // 安全缺口：发光填充（头顶空间）
      if (isSafe) {
        const gapG = ctx.createLinearGradient(0, stripBot, 0, bot);
        gapG.addColorStop(0, 'rgba(108,255,122,0.0)');
        gapG.addColorStop(1, 'rgba(108,255,122,0.28)');
        ctx.fillStyle = gapG;
        ctx.fillRect(r.x + 3, stripBot, r.w - 6, NOTCH);
        ctx.strokeStyle = `rgba(108,255,122,${0.5 + 0.4 * Math.sin(performance.now() / 200 + i)})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x + 3, stripBot, r.w - 6, NOTCH);
      }
    }
  }

  function drawParticles(view) {
    for (const fx of view.fxQueue) {
      const a = Math.max(0, Math.min(1, fx.ttl / fx.max));
      const fxX = fx.col != null ? colCenterX(fx.col) : fx.x;
      const fxY = fx.col != null ? TOP_Y - 40 : fx.y;
      if (fx.type === 'spark') {
        ctx.fillStyle = `rgba(92,242,255,${a})`;
        ctx.fillRect(fxX - 2, fxY - 2, 4, 4);
      } else if (fx.type === 'gem') {
        glow(fxX, fxY, `rgba(108,255,122,${a * 0.8})`, 26 * a + 6);
      } else if (fx.type === 'crushDebris') {
        ctx.fillStyle = `rgba(255,79,216,${a})`;
        ctx.fillRect(fxX - 3, fxY - 3, 6, 6);
      }
    }
  }

  return {
    draw(state, dt, view) {
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.save();
      if (view.shake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * view.shake * 2,
          (Math.random() - 0.5) * view.shake * 2,
        );
      }
      drawBackground();
      if (state) {
        for (let i = 0; i < state.columns; i += 1) drawColumn(i, state);
        drawCeiling(state);
        for (let i = 0; i < state.columns; i += 1) drawPowerup(i, state, view);
        drawStickman(state.playerIndex, state, view);
      }
      drawParticles(view);
      ctx.restore();
    },

    // 教程聚光用：返回几个关键区域
    debugLayout() {
      return {
        moveLeft: { x: COL.margin - 20, y: TOP_Y, w: COL.width + 20, h: GROUND_Y - TOP_Y },
        moveRight: { x: WORLD.WIDTH - COL.margin - COL.width, y: TOP_Y, w: COL.width + 20, h: GROUND_Y - TOP_Y },
        ceiling: { x: WORLD.WIDTH / 2 - 140, y: 60, w: 280, h: 90 },
        columns: { x: COL.margin, y: TOP_Y - 60, w: WORLD.WIDTH - COL.margin * 2, h: 140 },
      };
    },
  };
}
