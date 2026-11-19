// Canvas 2D 渲染：霓虹街机风（统一色板、程序化几何，零素材）。
// 角色 = 发光 smash drone；实体 = 陨石/尖刺/核心/推进器/修复台；背景 = 视差星野 + 霓虹甲板。
import { WORLD, PLAYER, PHYS } from '../../config/game.config.js';

const PAL = {
  skyTop: '#05050f',
  skyBottom: '#141133',
  star: '#9fd8ff',
  nebula1: '#2a1b5e',
  nebula2: '#123a5a',
  grid: '#2446ff',
  deckTop: '#1a1140',
  deck: '#0d0a24',
  player: '#4ff3ff',
  playerCore: '#eafeff',
  flame: '#ffcf4f',
  meteor: '#ff5ea8',
  meteorFill: '#3a1440',
  spike: '#ff5a3c',
  spikeFill: '#3a0f14',
  core: '#ffd23e',
  coreFill: '#3a2a08',
  thruster: '#5a8bff',
  thrusterFill: '#0f1f4a',
  pad: '#43e97b',
  padFill: '#0d2a1a',
  text: '#eaf4ff',
};

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawStars(ctx, t, scroll) {
  // 确定性星野：用固定种子与视差，随距离滚动
  const layers = [
    { n: 70, speed: 0.15, size: 1.2, alpha: 0.5 },
    { n: 40, speed: 0.35, size: 2.0, alpha: 0.8 },
    { n: 16, speed: 0.7, size: 3.0, alpha: 1.0 },
  ];
  ctx.save();
  for (const L of layers) {
    for (let i = 0; i < L.n; i += 1) {
      const seed = (i * 2654435761) % 2147483647;
      const baseX = ((seed % 10000) / 10000) * WORLD.WIDTH;
      const y = (((seed >> 7) % 10000) / 10000) * (WORLD.GROUND_Y - 40);
      const x = ((baseX - scroll * L.speed) % WORLD.WIDTH + WORLD.WIDTH) % WORLD.WIDTH;
      const tw = 0.5 + 0.5 * Math.sin(t * (0.5 + (seed % 10) / 20) + seed);
      ctx.globalAlpha = L.alpha * tw;
      ctx.fillStyle = PAL.star;
      ctx.beginPath();
      ctx.arc(x, y, L.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawNebula(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.GROUND_Y);
  g.addColorStop(0, PAL.skyTop);
  g.addColorStop(1, PAL.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.GROUND_Y);
  // 两团星云
  ctx.save();
  ctx.globalAlpha = 0.35;
  const r1 = ctx.createRadialGradient(240, 180, 20, 240, 180, 260);
  r1.addColorStop(0, PAL.nebula1);
  r1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = r1;
  ctx.fillRect(0, 0, 640, 420);
  const r2 = ctx.createRadialGradient(1040, 240, 20, 1040, 240, 300);
  r2.addColorStop(0, PAL.nebula2);
  r2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = r2;
  ctx.fillRect(500, 0, 780, 460);
  ctx.restore();
}

function drawDeck(ctx, scroll) {
  const gy = WORLD.GROUND_Y;
  // 甲板主体
  const g = ctx.createLinearGradient(0, gy, 0, WORLD.HEIGHT);
  g.addColorStop(0, PAL.deckTop);
  g.addColorStop(1, PAL.deck);
  ctx.fillStyle = g;
  ctx.fillRect(0, gy, WORLD.WIDTH, WORLD.HEIGHT - gy);
  // 霓虹网格线（滚动，压低亮度避免干扰实体轮廓）
  ctx.strokeStyle = PAL.grid;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.16;
  const spacing = 64;
  const offset = -(scroll % spacing);
  ctx.beginPath();
  for (let x = offset; x < WORLD.WIDTH + spacing; x += spacing) {
    ctx.moveTo(x, gy);
    ctx.lineTo(x, WORLD.HEIGHT);
  }
  for (let y = gy + 8; y < WORLD.HEIGHT; y += 24) {
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.WIDTH, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  // 甲板顶边发光
  ctx.strokeStyle = PAL.player;
  ctx.lineWidth = 3;
  ctx.shadowColor = PAL.player;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(WORLD.WIDTH, gy);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawEntity(ctx, e) {
  const cy = WORLD.GROUND_Y - 4; // 实体底部贴地
  switch (e.kind) {
    case 'meteor': {
      const r = e.w / 2;
      const cx = e.x + r;
      // 不规则岩石
      ctx.save();
      ctx.fillStyle = PAL.meteorFill;
      ctx.strokeStyle = PAL.meteor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = PAL.meteor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      const pts = 7;
      for (let i = 0; i < pts; i += 1) {
        const a = (i / pts) * Math.PI * 2;
        const rr = r * (0.78 + 0.22 * Math.sin(i * 3.7 + e.id));
        const px = cx + Math.cos(a) * rr;
        const py = cy - r * 0.72 + Math.sin(a) * rr * 0.82;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 目标环：标记「可砸」目标
      ctx.strokeStyle = 'rgba(255,210,62,0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.72, r + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      break;
    }
    case 'spike': {
      const r = e.w / 2;
      const cx = e.x + r;
      ctx.save();
      ctx.fillStyle = PAL.spikeFill;
      ctx.strokeStyle = PAL.spike;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = PAL.spike;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      const pts = 9;
      for (let i = 0; i < pts; i += 1) {
        const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
        const spike = i % 2 === 0 ? r : r * 0.55;
        const px = cx + Math.cos(a) * spike;
        const py = cy - r * 0.7 + Math.sin(a) * spike * 0.8;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 危险警示标
      ctx.fillStyle = '#ff5a3c';
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r - 22);
      ctx.lineTo(cx - 9, cy - r - 38);
      ctx.lineTo(cx + 9, cy - r - 38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', cx, cy - r - 29);
      ctx.restore();
      break;
    }
    case 'core': {
      const cx = e.x + e.w / 2;
      const r = e.w / 2 - 4;
      ctx.save();
      ctx.fillStyle = PAL.coreFill;
      ctx.strokeStyle = PAL.core;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = PAL.core;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.6, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 内核亮点
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath();
      ctx.arc(cx - r * 0.25, cy - r * 0.8, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'thruster': {
      const cx = e.x + e.w / 2;
      const w = e.w;
      const h = 30;
      ctx.save();
      ctx.fillStyle = PAL.thrusterFill;
      ctx.strokeStyle = PAL.thruster;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = PAL.thruster;
      ctx.shadowBlur = 12;
      roundedRect(ctx, e.x, cy - h - 10, w, h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 喷口
      ctx.fillStyle = PAL.thruster;
      ctx.beginPath();
      ctx.moveTo(e.x + w * 0.2, cy - 10);
      ctx.lineTo(e.x + w * 0.5, cy - 2);
      ctx.lineTo(e.x + w * 0.8, cy - 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'pad': {
      const cy2 = WORLD.GROUND_Y;
      const w = e.w;
      ctx.save();
      ctx.fillStyle = PAL.padFill;
      ctx.strokeStyle = PAL.pad;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = PAL.pad;
      ctx.shadowBlur = 10;
      roundedRect(ctx, e.x, cy2 - 14, w, 14, 6);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = PAL.pad;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(e.x + w * 0.25, cy2 - 8, w * 0.5, 3);
      ctx.restore();
      break;
    }
    default:
      break;
  }
}

function drawPlayer(ctx, state, view) {
  const p = state.player;
  const px = WORLD.PLAYER_X;
  const py = WORLD.GROUND_Y - p.y;
  const r = PLAYER.VISUAL_R;
  const slamming = p.value > 1;

  ctx.save();
  // 砸击引导线（标明落点，让目标更清晰）
  ctx.strokeStyle = 'rgba(79,243,255,0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(px, py + r);
  ctx.lineTo(px, WORLD.GROUND_Y - 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(79,243,255,0.65)';
  ctx.beginPath();
  ctx.moveTo(px, WORLD.GROUND_Y - 2);
  ctx.lineTo(px - 6, WORLD.GROUND_Y - 14);
  ctx.lineTo(px + 6, WORLD.GROUND_Y - 14);
  ctx.closePath();
  ctx.fill();

  // 砸击残影
  if (slamming || p.vy < -2) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = PAL.player;
    ctx.beginPath();
    ctx.arc(px, py - 12, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 外圈光环（突出玩家）
  ctx.strokeStyle = PAL.playerCore;
  ctx.lineWidth = 3;
  ctx.shadowColor = PAL.player;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(px, py, r + 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 主体：六边形飞行器
  ctx.fillStyle = PAL.player;
  ctx.strokeStyle = PAL.player;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = PAL.player;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2 + (state.time * 0.6);
    const px2 = px + Math.cos(a) * r;
    const py2 = py + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px2, py2);
    else ctx.lineTo(px2, py2);
  }
  ctx.closePath();
  ctx.fillStyle = '#0a2230';
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  // 内核
  ctx.fillStyle = PAL.playerCore;
  ctx.beginPath();
  ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  // 下喷焰
  const flame = slamming ? 26 : 14 + Math.sin(state.time * 20) * 4;
  ctx.fillStyle = PAL.flame;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(px - 7, py + r * 0.6);
  ctx.lineTo(px, py + r * 0.6 + flame);
  ctx.lineTo(px + 7, py + r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawParticles(ctx, view) {
  for (const fx of view.fxQueue) {
    const k = fx.ttl / fx.max;
    ctx.save();
    ctx.globalAlpha = Math.max(0, k);
    if (fx.type === 'explode') {
      for (const s of fx.shards || []) {
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(fx.x + s.dx * (1 - k), fx.y + s.dy * (1 - k), s.r * k, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (fx.type === 'ring') {
      ctx.strokeStyle = fx.color || PAL.player;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, (1 - k) * (fx.r || 40), 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.type === 'text') {
      ctx.fillStyle = fx.color || PAL.text;
      ctx.font = `bold ${fx.size || 20}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(fx.text || '', fx.x, fx.y - (1 - k) * 30);
    }
    ctx.restore();
  }
}

function drawShowcase(ctx, t) {
  // 标题屏展示：悬浮的玩家 + 三个待砸实体，让标题也有可读的玩法剪影
  const fake = {
    time: t,
    player: { y: 205, vy: 0, value: 0.5 },
    entities: [
      { id: 1, kind: 'meteor', x: 250, w: 74, speed: 0 },
      { id: 2, kind: 'spike', x: 460, w: 70, speed: 0 },
      { id: 3, kind: 'core', x: 850, w: 50, speed: 0 },
    ],
  };
  for (const e of fake.entities) drawEntity(ctx, e);
  drawPlayer(ctx, fake, { shake: 0, flash: 0, fxQueue: [] });
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  return {
    draw(state, dt, view) {
      const t = (state ? state.time : performance.now() / 1000);
      const scroll = state ? state.distance : 0;

      ctx.save();
      // 震屏
      if (view.shake > 0) {
        const a = view.shake;
        ctx.translate((Math.random() - 0.5) * a * 2, (Math.random() - 0.5) * a * 2);
      }

      // 背景
      drawNebula(ctx);
      drawStars(ctx, t, scroll);
      drawDeck(ctx, scroll);

      // 实体 / 玩家 / 标题展示
      if (state) {
        for (const e of state.entities) drawEntity(ctx, e);
        drawPlayer(ctx, state, view);
      } else {
        drawShowcase(ctx, t);
      }

      // 粒子
      drawParticles(ctx, view);

      ctx.restore();

      // 全屏闪光
      if (view.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, view.flash)})`;
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      }
    },
  };
}
