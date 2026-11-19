// 霓虹街机 · 深海逃亡渲染（Canvas 2D 程序化，零素材零外链）。
// 相机：鱼群始终居中，世界坐标 (entity - school) 平移到屏幕中心；背景用 travelX/Y 滚动网格。
import { WORLD, GAME } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const TAU = Math.PI * 2;

const COLORS = {
  bgTop: '#04060f',
  bgBottom: '#0a1230',
  grid: 'rgba(90, 220, 255, 0.09)',
  gridBright: 'rgba(120, 240, 255, 0.16)',
  player: '#eafcff',
  playerGlow: 'rgba(34, 230, 255, 0.85)',
  member: '#8ef4ff',
  memberGlow: 'rgba(60, 220, 255, 0.5)',
  prey: '#41f0a4',
  preyGlow: 'rgba(60, 240, 160, 0.6)',
  pred: '#ff3b6b',
  predDark: '#7a1230',
  predGlow: 'rgba(255, 59, 107, 0.7)',
  coin: '#ffd84d',
  coinGlow: 'rgba(255, 216, 77, 0.7)',
  star: '#fff3b0',
  starGlow: 'rgba(255, 230, 120, 0.9)',
  rock: '#b44bff',
  rockFill: '#1c0f38',
  frenzy: 'rgba(255, 200, 60, 0.22)',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toScreen(state, x, y) {
    return { x: x - state.school.x + W / 2, y: y - state.school.y + H / 2 };
  }

  function drawFish(x, y, dir, bodyLen, bodyColor, opts = {}) {
    const { glow = 'transparent', dark = null, teeth = false, alpha = 1 } = opts;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dir);
    ctx.globalAlpha = alpha;
    if (glow && glow !== 'transparent' && !reduced()) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = bodyLen * 0.9;
    }
    const ry = bodyLen * 0.42;
    // 尾鳍
    ctx.fillStyle = dark || bodyColor;
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.85, 0);
    ctx.lineTo(-bodyLen * 1.35, -ry * 1.1);
    ctx.lineTo(-bodyLen * 1.35, ry * 1.1);
    ctx.closePath();
    ctx.fill();
    // 身体
    const grad = ctx.createLinearGradient(-bodyLen, 0, bodyLen, 0);
    grad.addColorStop(0, dark || bodyColor);
    grad.addColorStop(1, bodyColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen, ry, 0, 0, TAU);
    ctx.fill();
    // 背鳍
    ctx.fillStyle = dark || bodyColor;
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.2, -ry * 0.7);
    ctx.lineTo(0, -ry * 1.6);
    ctx.lineTo(bodyLen * 0.25, -ry * 0.7);
    ctx.closePath();
    ctx.fill();
    // 眼睛
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0f1e';
    ctx.beginPath();
    ctx.arc(bodyLen * 0.5, -ry * 0.15, bodyLen * 0.13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bodyLen * 0.52, -ry * 0.18, bodyLen * 0.05, 0, TAU);
    ctx.fill();
    if (teeth) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i += 1) {
        const tx = bodyLen * (0.72 - i * 0.16);
        ctx.beginPath();
        ctx.moveTo(tx, ry * 0.35);
        ctx.lineTo(tx - bodyLen * 0.05, ry * 0.95);
        ctx.lineTo(tx - bodyLen * 0.1, ry * 0.35);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawRock(state, r, t) {
    const p = toScreen(state, r.x, r.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(r.rot + t * 0.08);
    ctx.fillStyle = COLORS.rockFill;
    ctx.strokeStyle = COLORS.rock;
    ctx.lineWidth = 3;
    if (!reduced()) {
      ctx.shadowColor = COLORS.rock;
      ctx.shadowBlur = 16;
    }
    ctx.beginPath();
    for (let i = 0; i < r.verts; i += 1) {
      const a = (i / r.verts) * TAU;
      const rr = r.r * (0.8 + 0.2 * Math.sin(i * 2.4 + r.rot));
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawCoin(state, c, t) {
    const p = toScreen(state, c.x, c.y);
    const s = 1 + 0.15 * Math.sin(t * 4 + c.ph);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(s, s);
    if (!reduced()) {
      ctx.shadowColor = COLORS.coinGlow;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(0, 0, GAME.COIN_R, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#8a5d00';
    ctx.beginPath();
    ctx.arc(0, 0, GAME.COIN_R * 0.55, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.coin;
    ctx.font = `bold ${GAME.COIN_R * 0.9}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('¢', 0, 1);
    ctx.restore();
  }

  function drawStar(state, st, t) {
    const p = toScreen(state, st.x, st.y);
    const s = 1 + 0.2 * Math.sin(t * 5 + st.ph);
    const R = GAME.STAR_R * s;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (!reduced()) {
      ctx.shadowColor = COLORS.starGlow;
      ctx.shadowBlur = 20;
    }
    ctx.fillStyle = COLORS.star;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? R : R * 0.45;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFx(state, fx, t) {
    const p = toScreen(state, fx.x, fx.y);
    const k = Math.max(0, fx.ttl / fx.max);
    ctx.save();
    ctx.globalAlpha = k;
    if (fx.type === 'join') {
      ctx.strokeStyle = COLORS.memberGlow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (1 - k) * 40 + 8, 0, TAU);
      ctx.stroke();
    } else if (fx.type === 'eat' || fx.type === 'rockHit') {
      ctx.fillStyle = fx.type === 'eat' ? COLORS.predGlow : COLORS.rock;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * TAU + fx.seed;
        const d = (1 - k) * 30 + 4;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function draw(state, dt, view) {
    ctx.clearRect(0, 0, W, H);
    const t = state ? state.time : 0;

    // 背景渐变
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, COLORS.bgTop);
    bg.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 滚动网格（用累计行程做 offset，制造强移动感）
    const spacing = 72;
    const offX = state ? ((state.travelX % spacing) + spacing) % spacing : 0;
    const offY = state ? ((state.travelY % spacing) + spacing) % spacing : 0;
    ctx.fillStyle = COLORS.grid;
    for (let gx = -offX; gx < W + spacing; gx += spacing) {
      for (let gy = -offY; gy < H + spacing; gy += spacing) {
        ctx.fillRect(gx, gy, 2, 2);
      }
    }
    // 更亮的大网格线
    ctx.strokeStyle = COLORS.gridBright;
    ctx.lineWidth = 1;
    const big = spacing * 4;
    const bOffX = state ? ((state.travelX % big) + big) % big : 0;
    const bOffY = state ? ((state.travelY % big) + big) % big : 0;
    ctx.beginPath();
    for (let gx = -bOffX; gx < W + big; gx += big) {
      ctx.moveTo(gx, 0); ctx.lineTo(gx, H);
    }
    for (let gy = -bOffY; gy < H + big; gy += big) {
      ctx.moveTo(0, gy); ctx.lineTo(W, gy);
    }
    ctx.stroke();

    if (!state) return;

    const s = state.school;
    const center = toScreen(state, s.x, s.y);

    // 狂暴光环
    if (state.frenzy > 0 && !reduced()) {
      const a = Math.min(1, state.frenzy);
      ctx.save();
      ctx.fillStyle = COLORS.frenzy;
      ctx.globalAlpha = 0.5 * a;
      ctx.beginPath();
      ctx.arc(center.x, center.y, 120, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // 暗礁
    for (const r of state.rocks) drawRock(state, r, t);
    // 金币
    for (const c of state.coins) drawCoin(state, c, t);
    // 狂暴星
    for (const st of state.stars) drawStar(state, st, t);

    // 小鱼（猎物）+ 亮色「+」收集标记
    for (const p of state.prey) {
      const pos = toScreen(state, p.x, p.y);
      drawFish(pos.x, pos.y, p.dir, GAME.PREY_R + 3, COLORS.prey, { glow: COLORS.preyGlow });
      const pulse = 1 + 0.25 * Math.sin(t * 5 + p.turnT);
      ctx.save();
      ctx.translate(pos.x, pos.y - GAME.PREY_R - 14);
      ctx.fillStyle = '#ffffff';
      if (!reduced()) { ctx.shadowColor = COLORS.preyGlow; ctx.shadowBlur = 12; }
      ctx.font = `bold ${Math.round(15 * pulse)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', 0, 0);
      ctx.restore();
    }

    // 红鲨（捕食者）
    for (const pr of state.predators) {
      const pos = toScreen(state, pr.x, pr.y);
      drawFish(pos.x, pos.y, pr.dir, pr.r, COLORS.pred, { glow: COLORS.predGlow, dark: COLORS.predDark, teeth: true });
    }

    // 鱼群成员（环绕领队）
    const leader = s.members[0] || { ph: 0, ox: 0, oy: 0, r: 0 };
    for (let i = 1; i < s.members.length; i += 1) {
      const m = s.members[i];
      const ox = m.ox + Math.cos(t * 2.4 + m.ph) * m.r;
      const oy = m.oy + Math.sin(t * 2.1 + m.ph) * m.r;
      const pos = toScreen(state, s.x + ox, s.y + oy);
      drawFish(pos.x, pos.y, s.dir, GAME.PREY_R + 2, COLORS.member, { glow: COLORS.memberGlow });
    }
    // 领队（最亮最粗 = 玩家剪影）
    drawFish(center.x, center.y, s.dir, 24 + Math.min(10, s.size), COLORS.player, { glow: COLORS.playerGlow });

    // 冲刺速度线
    if (state.boosting && !reduced()) {
      ctx.strokeStyle = 'rgba(150, 240, 255, 0.5)';
      ctx.lineWidth = 2;
      const bx = -Math.cos(s.dir);
      const by = -Math.sin(s.dir);
      for (let i = 0; i < 8; i += 1) {
        const jx = center.x - Math.cos(s.dir) * (i * 26) + Math.cos(s.dir + Math.PI / 2) * (Math.sin(t * 30 + i) * 40);
        const jy = center.y - Math.sin(s.dir) * (i * 26) + Math.sin(s.dir + Math.PI / 2) * (Math.sin(t * 30 + i) * 40);
        ctx.beginPath();
        ctx.moveTo(jx, jy);
        ctx.lineTo(jx + bx * 20, jy + by * 20);
        ctx.stroke();
      }
    }

    // 粒子特效
    for (const fx of view.fx) drawFx(state, fx, t);
  }

  function debugLayout() {
    return {
      school: { x: W / 2 - 30, y: H / 2 - 30, w: 60, h: 60 },
      arena: { x: 0, y: 0, w: W, h: H },
    };
  }

  return { draw, debugLayout };
}
