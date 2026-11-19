// Canvas 2D 渲染：霓虹街机风的程序化画面（零素材）。
// 画布逻辑尺寸 1280×720；DPR 上限 2。视口数据由 main 传入（fx 闪光/震屏/车道高亮）。
import { WORLD, LANE_X, GAME } from '../../config/game.config.js';

const NEON = {
  bg0: '#0b0b1e',
  bg1: '#141436',
  grid: 'rgba(70, 90, 180, 0.35)',
  divider: 'rgba(120, 140, 255, 0.28)',
  lane: 'rgba(90, 110, 200, 0.14)',
  left: '#27e6ff',
  right: '#ff3d7f',
  wall: '#ff8a2a',
  wallHi: '#ffd06a',
  rock: '#8b93a8',
  rockHi: '#c3cbdd',
  orb: '#ffd84d',
  shield: '#27e6ff',
  slow: '#5a8dff',
  magnet: '#c05aff',
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

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  canvas.style.width = `${WORLD.WIDTH}px`;
  canvas.style.height = `${WORLD.HEIGHT}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let scroll = 0; // 背景网格滚动偏移

  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, NEON.bg0);
    g.addColorStop(1, NEON.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 透视网格（赛道感）
    ctx.strokeStyle = NEON.grid;
    ctx.lineWidth = 1;
    const stepY = 64;
    const off = scroll % stepY;
    for (let y = -stepY + off; y < WORLD.HEIGHT; y += stepY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
    // 车道分隔
    ctx.strokeStyle = NEON.lane;
    for (const x of [320, 640, 960]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.HEIGHT);
      ctx.stroke();
    }
    // 中线
    ctx.strokeStyle = NEON.divider;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(640, 0);
    ctx.lineTo(640, WORLD.HEIGHT);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function drawStriker(x, y, color, label, t) {
    // 强发光底座（让球员成为画面最亮元素）
    const glow = ctx.createRadialGradient(x, y, 8, x, y, 64);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 64, y - 64, 128, 128);

    // 身体（前锋圆）：视觉略大于碰撞半径，粗白描边
    const R = 34;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.stroke();

    // 高光 visor（亮白色瞳孔）
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 6, y - 8, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#05050f';
    ctx.beginPath();
    ctx.arc(x - 4, y - 6, 5, 0, Math.PI * 2);
    ctx.fill();

    // 底部球鞋亮条
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 10, y + R - 7, 20, 5);
  }

  function drawWall(w) {
    const x = w.kind === 'rock' ? w.x : w.lane * WORLD.LANE_W + WORLD.LANE_W / 2;
    if (w.kind === 'rock') {
      // 岩石：圆润漂移巨石
      const g = ctx.createRadialGradient(x - 8, w.y - 8, 4, x, w.y, GAME.ROCK_H);
      g.addColorStop(0, NEON.rockHi);
      g.addColorStop(1, NEON.rock);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, w.y, GAME.ROCK_H * 0.9, GAME.ROCK_H * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // 防守屏障：霓虹发光横条
      const half = WORLD.LANE_W - 40;
      const g = ctx.createLinearGradient(0, w.y - w.h / 2, 0, w.y + w.h / 2);
      g.addColorStop(0, NEON.wallHi);
      g.addColorStop(1, NEON.wall);
      ctx.fillStyle = g;
      roundRect(ctx, x - half / 2, w.y - w.h / 2, half, w.h, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function drawOrb(o) {
    const x = o.x;
    const y = o.y;
    const glow = ctx.createRadialGradient(x, y, 3, x, y, 30);
    glow.addColorStop(0, '#fff6c8');
    glow.addColorStop(0.4, NEON.orb);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 30, y - 30, 60, 60);
    // 四角星
    ctx.fillStyle = NEON.orb;
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x + 5, y - 5);
    ctx.lineTo(x + 18, y);
    ctx.lineTo(x + 5, y + 5);
    ctx.lineTo(x, y + 18);
    ctx.lineTo(x - 5, y + 5);
    ctx.lineTo(x - 18, y);
    ctx.lineTo(x - 5, y - 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawPowerup(p, t) {
    const x = p.x;
    const y = p.y;
    const color = NEON[p.kind] || '#fff';
    const pulse = 1 + Math.sin(t * 6) * 0.1;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(x, y, GAME.POWERUP_R + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, GAME.POWERUP_R * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 图标（程序化形状，避免任何字体豆腐块）
    ctx.fillStyle = '#0b0b1e';
    ctx.strokeStyle = '#0b0b1e';
    ctx.lineWidth = 2;
    if (p.kind === 'shield') { // 盾形
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 7, y - 4);
      ctx.lineTo(x + 7, y + 2);
      ctx.quadraticCurveTo(x + 7, y + 8, x, y + 10);
      ctx.quadraticCurveTo(x - 7, y + 8, x - 7, y + 2);
      ctx.lineTo(x - 7, y - 4);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === 'slow') { // 三条减速杠
      ctx.fillRect(x - 7, y - 6, 14, 2);
      ctx.fillRect(x - 7, y - 1, 14, 2);
      ctx.fillRect(x - 7, y + 4, 14, 2);
    } else { // 磁铁 U 形
      ctx.beginPath();
      ctx.arc(x - 4, y, 4, Math.PI, 0);
      ctx.lineTo(x + 4, y + 1);
      ctx.arc(x + 4, y, 4, 0, Math.PI);
      ctx.stroke();
    }
  }

  function drawFinishLine() {
    // 关卡模式：顶部终点横幅（玩家向上冲的「目标线」，视觉上锚定目标）
    const y0 = 60;
    const h = 20;
    ctx.fillStyle = '#0b0b1e';
    ctx.fillRect(0, y0 - 4, WORLD.WIDTH, h + 8);
    for (let x = 0; x < WORLD.WIDTH; x += 40) {
      ctx.fillStyle = (x / 40) % 2 === 0 ? '#ffffff' : '#27e6ff';
      ctx.fillRect(x, y0, 40, h);
    }
    ctx.strokeStyle = '#ffd84d';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, y0 - 4, WORLD.WIDTH, h + 8);
  }

  function drawHandZones(view, t) {
    // 两只「神手」：左右半场底部的触控提示（圆角矩形，明显区别于圆形的球员），点按时发光
    for (const half of ['L', 'R']) {
      const flash = (view && view[`flash${half}`]) || 0;
      const alpha = 0.08 + Math.min(0.3, flash * 2.0);
      const x0 = half === 'L' ? 0 : 640;
      const color = half === 'L' ? NEON.left : NEON.right;
      ctx.fillStyle = half === 'L'
        ? `rgba(39, 230, 255, ${alpha})`
        : `rgba(255, 61, 127, ${alpha})`;
      ctx.fillRect(x0, 0, 640, WORLD.HEIGHT);
      // 点按瞬间的半场闪光（截图里几乎不可见，仅运行时反馈）
    }
  }

  return {
    draw(state, dt, view = {}) {
      const t = (view.time || 0);
      scroll += (state ? (state.baseSpeed * dt * 60 * 1.0) : 0) || 0;
      drawBackground(t);

      if (!state) return;

      if (state.mode >= 0) drawFinishLine();

      // 道具/晶片/障碍（按 y 排序先画远的）
      const entities = [];
      for (const w of state.walls) entities.push({ y: w.y, draw: () => drawWall(w) });
      for (const o of state.orbs) entities.push({ y: o.y, draw: () => drawOrb(o) });
      for (const p of state.powerups) entities.push({ y: p.y, draw: () => drawPowerup(p, t) });
      entities.sort((a, b) => a.y - b.y);
      for (const e of entities) e.draw();

      drawHandZones(view, t);

      // 前锋（最上层）
      const lx = LANE_X[state.leftInner ? 1 : 0];
      const rx = LANE_X[state.rightInner ? 2 : 3];
      drawStriker(lx, WORLD.STRIKER_Y, NEON.left, 'L', t);
      drawStriker(rx, WORLD.STRIKER_Y, NEON.right, 'R', t);

      // 护盾光圈
      if (state.effects.shield > 0) {
        ctx.strokeStyle = NEON.shield;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.8;
        for (const x of [lx, rx]) {
          ctx.beginPath();
          ctx.arc(x, WORLD.STRIKER_Y, WORLD.STRIKER_R + 12 + Math.sin(t * 8) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    },
    debugLayout() {
      return {
        left: { x: 0, y: 0, w: 640, h: WORLD.HEIGHT },
        right: { x: 640, y: 0, w: 640, h: WORLD.HEIGHT },
        pitch: { x: 0, y: 0, w: WORLD.WIDTH, h: WORLD.HEIGHT },
      };
    },
  };
}
