// Canvas 2D 渲染：程序化北极小房间 + 卡通企鹅 + 心愿气泡 + 粒子。
// 只画场景与角色；HUD / 动作条 / 结算 / 教程全部走 DOM（ui.js）。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { t } from '../core/i18n.js';

const WISH_EMOJI = {
  feed: '🐟',
  wash: '💦',
  rest: '💤',
  play: '⚽',
  train: '📖',
};
const WISH_KEY = {
  feed: 'wishFeed',
  wash: 'wishWash',
  rest: 'wishRest',
  play: 'wishPlay',
  train: 'wishTrain',
};

const PALETTE = {
  skyTop: '#aee2ff',
  skyBottom: '#e8f7ff',
  ice: '#dff4ff',
  iceEdge: '#bfe8ff',
  snow: '#ffffff',
  body: '#26324a',
  belly: '#f6fbff',
  beak: '#ff9f43',
  feet: '#ff9f43',
  cheek: '#ffb3c1',
  bubble: '#ffffff',
};

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

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let particles = [];
  let popups = [];
  let flash = 0;            // 升级/胜利全屏闪白
  let snow = [];
  for (let i = 0; i < 40; i += 1) {
    snow.push({
      x: Math.random() * WORLD.WIDTH,
      y: Math.random() * WORLD.HEIGHT,
      s: 0.6 + Math.random() * 1.4,
      v: 0.3 + Math.random() * 0.7,
      drift: (Math.random() - 0.5) * 0.4,
    });
  }

  function drawBackground(now) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 极光（柔和飘带）
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 3; i += 1) {
      const base = 120 + i * 90 + Math.sin(now * 0.0003 + i) * 20;
      ctx.fillStyle = i % 2 ? '#8ef0d0' : '#c9a7ff';
      ctx.beginPath();
      ctx.ellipse(WORLD.WIDTH * (0.2 + i * 0.3), base, 220, 40, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 雪地 / 冰面
    ctx.fillStyle = PALETTE.ice;
    ctx.fillRect(0, LAYOUT.GROUND_Y, WORLD.WIDTH, WORLD.HEIGHT - LAYOUT.GROUND_Y);
    ctx.fillStyle = PALETTE.iceEdge;
    ctx.fillRect(0, LAYOUT.GROUND_Y, WORLD.WIDTH, 8);
    // 冰面纹理线
    ctx.strokeStyle = 'rgba(140,200,235,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const yy = LAYOUT.GROUND_Y + 24 + i * 26;
      ctx.beginPath();
      ctx.moveTo(0, yy + Math.sin(i) * 6);
      ctx.bezierCurveTo(WORLD.WIDTH / 3, yy - 10, (WORLD.WIDTH * 2) / 3, yy + 12, WORLD.WIDTH, yy);
      ctx.stroke();
    }

    // 雪花
    ctx.fillStyle = PALETTE.snow;
    for (const f of snow) {
      f.y += f.v;
      f.x += f.drift;
      if (f.y > WORLD.HEIGHT) { f.y = -6; f.x = Math.random() * WORLD.WIDTH; }
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPenguin(sim, now) {
    const cx = LAYOUT.PENGUIN_CX;
    const feetY = LAYOUT.GROUND_Y;
    const bob = Math.sin(now * 0.0022) * 4;
    const bodyY = feetY - 150 + bob;

    // 影子
    ctx.fillStyle = 'rgba(60,100,140,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, feetY + 6, 74, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 脚
    ctx.fillStyle = PALETTE.feet;
    ctx.beginPath();
    ctx.ellipse(cx - 24, feetY - 4, 20, 10, 0.15, 0, Math.PI * 2);
    ctx.ellipse(cx + 24, feetY - 4, 20, 10, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // 身体（黑）
    ctx.fillStyle = PALETTE.body;
    ctx.beginPath();
    ctx.ellipse(cx, bodyY, 58, 92, 0, 0, Math.PI * 2);
    ctx.fill();

    // 肚皮（白）
    ctx.fillStyle = PALETTE.belly;
    ctx.beginPath();
    ctx.ellipse(cx, bodyY + 18, 40, 62, 0, 0, Math.PI * 2);
    ctx.fill();

    // 鳍状翅膀
    ctx.fillStyle = PALETTE.body;
    const wing = Math.sin(now * 0.0022) * 6;
    ctx.beginPath();
    ctx.ellipse(cx - 56, bodyY - 8 + wing, 16, 44, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 56, bodyY - 8 - wing, 16, 44, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛 + 眨眼
    const eyeY = bodyY - 52;
    const blink = (now % 3200) < 120;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 20, eyeY, 13, 0, Math.PI * 2);
    ctx.arc(cx + 20, eyeY, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1f2a';
    if (blink) {
      ctx.fillRect(cx - 25, eyeY - 1, 10, 3);
      ctx.fillRect(cx + 15, eyeY - 1, 10, 3);
    } else {
      ctx.beginPath();
      ctx.arc(cx - 19, eyeY + 1, 6, 0, Math.PI * 2);
      ctx.arc(cx + 19, eyeY + 1, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 嘴（表情随心情）
    const mood = sim ? sim.mood : 70;
    ctx.strokeStyle = PALETTE.beak;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const my = bodyY - 30;
    if (mood >= 55) {
      ctx.arc(cx, my, 12, 0.15 * Math.PI, 0.85 * Math.PI);   // 微笑
    } else if (mood >= 30) {
      ctx.moveTo(cx - 10, my + 4); ctx.lineTo(cx + 10, my + 4);   // 平静
    } else {
      ctx.arc(cx, my + 10, 10, 1.15 * Math.PI, 1.85 * Math.PI);   // 沮丧
    }
    ctx.stroke();

    // 腮红
    ctx.fillStyle = PALETTE.cheek;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(cx - 30, bodyY - 34, 8, 0, Math.PI * 2);
    ctx.arc(cx + 30, bodyY - 34, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawWishBubble(sim, now) {
    if (!sim || sim.won) return;
    const cx = LAYOUT.PENGUIN_CX;
    const bob = Math.sin(now * 0.0022) * 4;
    const headY = LAYOUT.GROUND_Y - 150 - 92 + bob;
    const bx = cx + 90;
    const by = headY - 60 + Math.sin(now * 0.003) * 4;

    // 尾巴
    ctx.fillStyle = PALETTE.bubble;
    ctx.beginPath();
    ctx.moveTo(cx + 34, headY + 4);
    ctx.lineTo(bx - 20, by + 40);
    ctx.lineTo(bx - 44, by + 22);
    ctx.closePath();
    ctx.fill();

    // 气泡主体
    ctx.strokeStyle = '#c7e6f5';
    ctx.lineWidth = 3;
    rr(ctx, bx - 72, by - 40, 144, 80, 20);
    ctx.fillStyle = PALETTE.bubble;
    ctx.fill();
    ctx.stroke();

    // emoji 图标
    ctx.font = '40px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(WISH_EMOJI[sim.wish] || '⭐', bx - 26, by);
    // 文字标签
    ctx.font = '600 15px "PingFang SC","Hiragino Sans","Segoe UI",sans-serif';
    ctx.fillStyle = '#33445c';
    ctx.fillText(t(WISH_KEY[sim.wish] || 'wishTrain'), bx + 22, by);
  }

  function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= p.decay;
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.06;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.kind === 'heart') {
        ctx.fillStyle = p.color || '#ff8fb3';
        ctx.font = `${p.size}px sans-serif`;
        ctx.fillText('♥', p.x, p.y);
      } else if (p.kind === 'star') {
        ctx.fillStyle = p.color || '#ffd166';
        ctx.font = `${p.size}px sans-serif`;
        ctx.fillText('✦', p.x, p.y);
      } else {
        ctx.fillStyle = p.color || '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      const p = popups[i];
      p.life -= 0.02;
      p.y -= 0.7;
      if (p.life <= 0) { popups.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.font = `800 ${p.size}px "PingFang SC","Hiragino Sans","Segoe UI",sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color || '#ff5d8f';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  return {
    render(sim, now, opts = {}) {
      drawBackground(now);
      if (sim) {
        drawPenguin(sim, now);
        drawWishBubble(sim, now);
      }
      drawParticles();

      if (flash > 0) {
        ctx.globalAlpha = Math.min(0.7, flash);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        ctx.globalAlpha = 1;
        flash = Math.max(0, flash - (opts.flashDecay || 0.05));
      }
    },
    burst(x, y, kind = 'heart', n = 6, color = null) {
      for (let i = 0; i < n; i += 1) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 5,
          vy: Math.random() * 3 + 1,
          life: 0.9,
          decay: 0.03,
          size: 14 + Math.random() * 14,
          kind,
          color,
        });
      }
    },
    popup(x, y, text, opts = {}) {
      popups.push({
        x, y,
        text,
        life: 1.2,
        size: opts.size || 28,
        color: opts.color || '#ff5d8f',
      });
    },
    flashScreen(amount = 0.6) {
      flash = Math.max(flash, amount);
    },
    reset() {
      particles = [];
      popups = [];
      flash = 0;
    },
  };
}
