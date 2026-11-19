// BUBBLE SHOOTER POP · Canvas 2D 渲染（霓虹街机）
// 职责：背景网格 / 炮台 / 子弹 / 泡泡（四种）/ 道具 / 粒子 / 震屏。
// 全部程序化绘制，零图片零外链。DPR ≤2。
import { WORLD, LAYOUT, GAME as G } from '../../config/game.config.js';

const NEON = ['#ff2d95', '#00e5ff', '#ffe14d', '#7cff4f'];
const ROCK_COLOR = '#8f7bff';
const GOLD_COLOR = '#ffd23f';
const BOMB_COLOR = '#ff5b2d';

function glow(ctx, x, y, r, color, alpha = 0.45) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.1);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (typeof ctx.roundRect !== 'function') {
    ctx.roundRect = function (x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      this.moveTo(x + rr, y);
      this.arcTo(x + w, y, x + w, y + h, rr);
      this.arcTo(x + w, y + h, x, y + h, rr);
      this.arcTo(x, y + h, x, y, rr);
      this.arcTo(x, y, x + w, y, rr);
      this.closePath();
      return this;
    };
  }
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  let titleT = 0;

  function bg() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0a0a1c');
    g.addColorStop(0.55, '#101033');
    g.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 霓虹网格
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.WIDTH; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, LAYOUT.HUD_H); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
    }
    for (let y = LAYOUT.HUD_H; y <= WORLD.HEIGHT; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
    }

    // 地平线发光
    const hg = ctx.createLinearGradient(0, LAYOUT.HUD_H, 0, LAYOUT.HUD_H + 120);
    hg.addColorStop(0, 'rgba(255, 45, 149, 0.16)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, LAYOUT.HUD_H, WORLD.WIDTH, 120);

    // 底部危险线
    ctx.fillStyle = 'rgba(255, 91, 45, 0.10)';
    ctx.fillRect(0, G.CANNON_Y - 40, WORLD.WIDTH, 90);

    // 晕影
    const v = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, WORLD.HEIGHT * 0.4, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, WORLD.HEIGHT * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawCannon(c) {
    const x = c.x;
    const y = c.y;
    glow(ctx, x, y, 30, '#00e5ff', 0.5);

    // 基座
    ctx.fillStyle = '#0b1626';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - G.CANNON_W / 2, y + G.CANNON_H / 2);
    ctx.lineTo(x - G.CANNON_W / 2 - 8, y + G.CANNON_H / 2 + 16);
    ctx.lineTo(x + G.CANNON_W / 2 + 8, y + G.CANNON_H / 2 + 16);
    ctx.lineTo(x + G.CANNON_W / 2, y + G.CANNON_H / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 炮管
    ctx.fillStyle = '#12263f';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x - 16, y - G.CANNON_H / 2 - 8, 32, G.CANNON_H - 4, 8);
    ctx.fill();
    ctx.stroke();

    // 发光核心
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y - 4, 9, 0, Math.PI * 2);
    ctx.fill();
    glow(ctx, x, y - 4, 9, '#00e5ff', 0.8);
  }

  function drawBullet(b) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.stroke();
    ctx.shadowBlur = 0;
    glow(ctx, b.x, b.y, 5, '#00e5ff', 0.6);
  }

  function bubbleColor(b) {
    if (b.kind === 'rock') return ROCK_COLOR;
    if (b.kind === 'gold') return GOLD_COLOR;
    if (b.kind === 'bomb') return BOMB_COLOR;
    return NEON[(b.color - 1 + 4) % 4] || NEON[1];
  }

  function drawBubble(b, t) {
    const color = bubbleColor(b);
    const pulse = 1 + Math.sin(t * 4 + b.id) * 0.04;
    const r = b.r * pulse;
    glow(ctx, b.x, b.y, r, color, 0.4);

    // 主体
    const g = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, r * 0.15, b.x, b.y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.35, color);
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(b.x - r * 0.32, b.y - r * 0.34, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();

    if (b.kind === 'rock') {
      // 盾牌徽记：表示装甲（需多次命中）
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x - r * 0.32, b.y - r * 0.18);
      ctx.lineTo(b.x, b.y - r * 0.5);
      ctx.lineTo(b.x + r * 0.32, b.y - r * 0.18);
      ctx.closePath();
      ctx.stroke();
    } else if (b.kind === 'gold') {
      drawStar(ctx, b.x, b.y, r * 0.5);
    } else if (b.kind === 'bomb') {
      // 引信
      ctx.strokeStyle = '#3a1c10';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x + r * 0.2, b.y - r * 0.7);
      ctx.quadraticCurveTo(b.x + r * 0.55, b.y - r * 0.95, b.x + r * 0.3, b.y - r * 1.15);
      ctx.stroke();
      glow(ctx, b.x + r * 0.3, b.y - r * 1.15, 5, '#ffd23f', 0.8);
    }

    // HP 数字（>1 时显示，提示装甲）
    if (b.hp > 1) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(r * 0.9)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(String(b.hp), b.x, b.y + 1);
      ctx.shadowBlur = 0;
    }
  }

  function drawStar(ctx, x, y, r) {
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(ang) * rr;
      const py = y + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawPowerup(p, t) {
    const color = p.kind === 'rapid' ? '#ffe14d' : '#00e5ff';
    const bob = Math.sin(t * 5 + p.x) * 3;
    glow(ctx, p.x, p.y + bob, p.r, color, 0.55);
    ctx.fillStyle = 'rgba(8,12,24,0.85)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(p.x - p.r, p.y + bob - p.r * 0.6, p.r * 2, p.r * 1.2, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `700 ${p.r}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.kind === 'rapid' ? '⚡' : '≋', p.x, p.y + bob + 1);
  }

  function kindColor(kind) {
    if (kind === 'rock') return ROCK_COLOR;
    if (kind === 'gold') return GOLD_COLOR;
    if (kind === 'bomb') return BOMB_COLOR;
    return NEON[0];
  }

  function drawFx(fx, dt) {
    if (fx.kind === 'pop') {
      ctx.globalAlpha = Math.max(0, fx.ttl / 0.5);
      ctx.strokeStyle = kindColor(fx.bubbleKind);
      ctx.lineWidth = 3;
      const rr = (1 - fx.ttl / 0.5) * 46 + 8;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, rr, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        const ang = (i / 6) * Math.PI * 2 + fx.x;
        const d = (1 - fx.ttl / 0.5) * 60;
        ctx.fillStyle = NEON[i % 4];
        ctx.fillRect(fx.x + Math.cos(ang) * d - 2, fx.y + Math.sin(ang) * d - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'hit') {
      ctx.globalAlpha = Math.max(0, fx.ttl / 0.3);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'miss') {
      ctx.globalAlpha = Math.max(0, fx.ttl / 0.6);
      ctx.strokeStyle = 'rgba(255,91,45,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx.x - 14, fx.y);
      ctx.lineTo(fx.x + 14, fx.y);
      ctx.moveTo(fx.x, fx.y - 14);
      ctx.lineTo(fx.x, fx.y + 14);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'wave') {
      ctx.globalAlpha = Math.max(0, fx.ttl / 1.0);
      ctx.fillStyle = '#00e5ff';
      ctx.font = '900 44px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(fx.text, WORLD.WIDTH / 2, WORLD.HEIGHT / 2 - 60);
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'combo') {
      ctx.globalAlpha = Math.max(0, fx.ttl / 0.9);
      ctx.fillStyle = '#ffe14d';
      ctx.font = '900 34px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(fx.text, WORLD.WIDTH / 2, WORLD.HEIGHT / 2 - 20);
      ctx.globalAlpha = 1;
    }
  }

  return {
    draw(state, dt, view) {
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      const t = state ? state.time : (titleT += dt);
      const shakeX = view && view.shake ? (Math.random() - 0.5) * view.shake : 0;
      const shakeY = view && view.shake ? (Math.random() - 0.5) * view.shake : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);
      bg();

      if (!state) {
        // 标题屏演示场景：静态炮台 + 漂浮泡泡
        drawCannon({ x: WORLD.WIDTH / 2, y: G.CANNON_Y });
        const demo = [
          { x: 300, y: 200 + Math.sin(t) * 14, r: 34, color: 1, hp: 1 },
          { x: 640, y: 140 + Math.sin(t + 1) * 16, r: 34, color: 2, hp: 1 },
          { x: 960, y: 240 + Math.sin(t + 2) * 12, r: 34, color: 3, hp: 1 },
          { x: 500, y: 360 + Math.sin(t + 3) * 10, r: 40, kind: 'rock', hp: 5 },
        ];
        for (const d of demo) drawBubble({ ...d, id: d.x, y: d.y }, t);
        ctx.restore();
        return;
      }

      drawCannon(state.cannon);
      for (const b of state.bullets) drawBullet(b);
      for (const b of state.bubbles) drawBubble(b, t);
      for (const p of state.powerups) drawPowerup(p, t);

      ctx.restore();

      // 粒子与全屏文字不参与震屏
      if (view && view.fx) {
        for (const fx of view.fx) drawFx(fx, dt);
      }
    },

    debugLayout() {
      return {
        playfield: { x: 0, y: LAYOUT.HUD_H, w: WORLD.WIDTH, h: WORLD.HEIGHT - LAYOUT.HUD_H },
        cannon: { x: WORLD.WIDTH / 2, y: G.CANNON_Y, w: G.CANNON_W, h: G.CANNON_H },
      };
    },
  };
}
