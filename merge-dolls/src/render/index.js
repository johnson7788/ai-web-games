// Canvas 2D 渲染：霓虹街机风。棋盘格 / 玩偶 / 岩块 / 粒子全程序化。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { dollByLevel } from '../../config/levels.js';

// ---- 布局（与 main/ui 共享 hit-testing 几何）----
export const SLOT_W = 132;
export const SLOT_H = 148;
export const GAP = 12;
export const BOARD_X = 286;
export const BOARD_Y = 122;

export function slotCenter(i) {
  const c = i % 4;
  const r = Math.floor(i / 4);
  return {
    x: BOARD_X + c * (SLOT_W + GAP) + SLOT_W / 2,
    y: BOARD_Y + r * (SLOT_H + GAP) + SLOT_H / 2,
  };
}

export function slotAtPoint(x, y) {
  const c = Math.floor((x - BOARD_X) / (SLOT_W + GAP));
  const r = Math.floor((y - BOARD_Y) / (SLOT_H + GAP));
  if (c < 0 || c > 3 || r < 0 || r > 2) return -1;
  const px = BOARD_X + c * (SLOT_W + GAP);
  const py = BOARD_Y + r * (SLOT_H + GAP);
  if (x < px || x > px + SLOT_W || y < py || y > py + SLOT_H) return -1;
  return r * 4 + c;
}

// ---- 颜色 ----
const BG_TOP = '#0a0a16';
const BG_BOT = '#131325';
const SLOT_FILL = 'rgba(255,255,255,0.03)';
const SLOT_EDGE = 'rgba(120,140,255,0.18)';

function neon(color, glow = 16) {
  return { color, glow };
}

// ---- 玩偶绘制（可复用：棋盘 / 标题 demo / 拖拽预览）----
export function drawDoll(ctx, cx, cy, level, t = 0, scale = 1) {
  const d = dollByLevel(level);
  const hue = d.hue;
  const base = `hsl(${hue} 90% 60%)`;
  const light = `hsl(${hue} 95% 72%)`;
  const dark = `hsl(${hue} 80% 40%)`;
  const bodyH = (44 + Math.min(20, level * 1.5)) * scale;
  const bodyW = (34 + Math.min(12, level)) * scale;
  const headR = (16 + Math.min(8, level * 0.5)) * scale;
  const bob = Math.sin(t * 2.4 + level) * 1.6 * scale;

  ctx.save();
  ctx.translate(cx, cy + bob);

  // 辉光
  ctx.shadowColor = base;
  ctx.shadowBlur = 14 * scale;

  // 天线
  ctx.strokeStyle = light;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(0, -headR - bodyH / 2);
  ctx.lineTo(0, -headR - bodyH / 2 - 8 * scale);
  ctx.stroke();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(0, -headR - bodyH / 2 - 10 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // 身体（胶囊）
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.roundRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, bodyW / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // 胸口灯
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(0, bodyH * 0.06, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // 头
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(0, -bodyH / 2, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(-headR * 0.32, -bodyH / 2 - headR * 0.1, 2.4 * scale, 0, Math.PI * 2);
  ctx.arc(headR * 0.32, -bodyH / 2 - headR * 0.1, 2.4 * scale, 0, Math.PI * 2);
  ctx.fill();

  // 等级徽章
  ctx.fillStyle = 'rgba(10,10,22,0.85)';
  ctx.beginPath();
  ctx.arc(bodyW * 0.5, -bodyH * 0.4, 9 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${10 * scale}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(level), bodyW * 0.5, -bodyH * 0.4);

  // 高等级：皇冠 + 星
  if (level >= 10) {
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    const crown = 6 * scale;
    ctx.moveTo(-crown, -bodyH / 2 - headR);
    ctx.lineTo(-crown, -bodyH / 2 - headR - crown);
    ctx.lineTo(-crown / 2, -bodyH / 2 - headR - crown * 0.5);
    ctx.lineTo(0, -bodyH / 2 - headR - crown * 1.4);
    ctx.lineTo(crown / 2, -bodyH / 2 - headR - crown * 0.5);
    ctx.lineTo(crown, -bodyH / 2 - headR - crown);
    ctx.lineTo(crown, -bodyH / 2 - headR);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---- 岩块绘制 ----
function drawRock(ctx, cx, cy, t = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = 30;
  ctx.shadowColor = 'rgba(160,120,255,0.6)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#3a3550';
  ctx.beginPath();
  ctx.moveTo(-s, s * 0.6);
  ctx.lineTo(-s * 0.7, -s * 0.4);
  ctx.lineTo(-s * 0.2, -s);
  ctx.lineTo(s * 0.5, -s * 0.7);
  ctx.lineTo(s, s * 0.1);
  ctx.lineTo(s * 0.4, s);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(190,150,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 裂纹
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 0.2);
  ctx.lineTo(0, s * 0.1);
  ctx.lineTo(-s * 0.1, s * 0.4);
  ctx.moveTo(s * 0.2, -s * 0.3);
  ctx.lineTo(s * 0.1, s * 0.0);
  ctx.stroke();
  ctx.restore();
}

// ---- 粒子 ----
const PARTICLES_MAX = 220;

function makeParticles() {
  const list = [];
  return {
    list,
    spawn(type, x, y) {
      if (list.length >= PARTICLES_MAX) list.splice(0, list.length - PARTICLES_MAX + 20);
      let colors;
      if (type === 'coin') colors = ['#ffd54a', '#ffb300', '#fff3b0'];
      else if (type === 'rock') colors = ['#8f7bb8', '#b7a3e0', '#5f5390'];
      else colors = ['#fff', '#8be0ff', '#ff8bd0', '#ffe08b'];
      const n = type === 'rock' ? 10 : 6;
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = (type === 'coin' ? 40 : 120) * (0.5 + Math.random());
        list.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (type === 'coin' ? 60 : 30),
          life: 0,
          maxLife: 0.5 + Math.random() * 0.4,
          size: 2 + Math.random() * 3,
          color: colors[i % colors.length],
        });
      }
    },
    step(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.life += dt;
        if (p.life >= p.maxLife) { list.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 160 * dt;
      }
    },
    draw(ctx) {
      for (const p of list) {
        const k = 1 - p.life / p.maxLife;
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };
}

// ---- 合并闪光 ----
function makeFlashes() {
  const list = [];
  return {
    list,
    spawn(x, y, hue) {
      list.push({ x, y, hue, life: 0, maxLife: 0.35 });
    },
    step(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const f = list[i];
        f.life += dt;
        if (f.life >= f.maxLife) { list.splice(i, 1); continue; }
      }
    },
    draw(ctx) {
      for (const f of list) {
        const k = 1 - f.life / f.maxLife;
        ctx.globalAlpha = k * 0.7;
        ctx.fillStyle = `hsl(${f.hue} 90% 70%)`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 10 + k * 46, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  const particles = makeParticles();
  const flashes = makeFlashes();
  let t = 0;

  return {
    particles,
    flashes,

    resize() {
      // 尺寸固定（1280×720），无需处理
    },

    /** fx: { coinTarget: {x,y}|null } — 生产金币飘向 HUD 金币处 */
    render(state, dt, fx = {}) {
      t += dt;

      // 背景
      const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
      g.addColorStop(0, BG_TOP);
      g.addColorStop(1, BG_BOT);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

      // 网格线（背景霓虹栅格）
      ctx.strokeStyle = 'rgba(90,110,255,0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < WORLD.WIDTH; x += 44) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
      }
      for (let y = 0; y < WORLD.HEIGHT; y += 44) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
      }

      // 右侧面板区背景
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(888, 84, 380, 620);

      if (!state) return;

      const tab = state.tabs[state.tab];
      // 棋盘格
      for (let i = 0; i < 12; i += 1) {
        const c = slotCenter(i);
        const x = c.x - SLOT_W / 2;
        const y = c.y - SLOT_H / 2;
        const s = tab.slots[i];
        const occupied = s.doll > 0 || s.rock;
        ctx.fillStyle = SLOT_FILL;
        ctx.beginPath();
        ctx.roundRect(x, y, SLOT_W, SLOT_H, 14);
        ctx.fill();
        ctx.strokeStyle = occupied ? 'rgba(120,150,255,0.45)' : SLOT_EDGE;
        ctx.lineWidth = occupied ? 2 : 1;
        ctx.stroke();
      }

      // 玩偶 + 岩块
      for (let i = 0; i < 12; i += 1) {
        const s = tab.slots[i];
        if (s.doll === 0 && !s.rock) continue;
        const c = slotCenter(i);
        if (s.rock) drawRock(ctx, c.x, c.y, t);
        else drawDoll(ctx, c.x, c.y, s.doll, t);
      }

      // 拖拽预览
      if (fx.drag) {
        ctx.save();
        ctx.globalAlpha = 0.72;
        drawDoll(ctx, fx.drag.x, fx.drag.y, fx.drag.level, t, 1.08);
        ctx.restore();
      }

      // 闪光 + 粒子
      flashes.step(dt);
      flashes.draw(ctx);
      particles.step(dt);
      particles.draw(ctx);
    },

    /** 由事件驱动的效果（main 在消费 sim 事件后调用） */
    applyEvent(evt) {
      if (evt.type === 'merge') {
        const c = slotCenter(evt.slot == null ? 0 : evt.slot);
        flashes.spawn(c.x, c.y, dollByLevel(evt.level).hue);
        particles.spawn('coin', c.x, c.y);
      } else if (evt.type === 'buy') {
        const c = slotCenter(evt.slot ?? 0);
        particles.spawn('coin', c.x, c.y);
      } else if (evt.type === 'sell') {
        const c = slotCenter(evt.slot ?? 0);
        particles.spawn('coin', c.x, c.y);
      } else if (evt.type === 'rock') {
        const c = slotCenter(evt.slot ?? 0);
        particles.spawn('rock', c.x, c.y);
      } else if (evt.type === 'combo') {
        flashes.spawn(BOARD_X + 300, BOARD_Y + 180, 40);
      } else if (evt.type === 'stage') {
        flashes.spawn(BOARD_X + 300, BOARD_Y + 180, 200);
        flashes.spawn(BOARD_X + 300, BOARD_Y + 180, 60);
      }
    },
  };
}
