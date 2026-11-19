// ASSAULT DUO 3D · Canvas 2D 程序化渲染（霓虹街机风，零素材零外链）
import { WORLD, PLAYER, COMPANION, WEAPONS } from '../../config/game.config.js';

const PALETTE = {
  skyTop: '#0a0a1e',
  skyBottom: '#181238',
  building: '#141432',
  window: '#2a2a5e',
  ground: '#0d0d26',
  grid: 'rgba(70, 220, 255, 0.16)',
  groundLine: '#38d9ff',
  player: '#38e1ff',
  playerDark: '#0a3344',
  visor: '#eaffff',
  companion: '#59ff9e',
  enemy: '#ff3d7f',
  enemyShield: '#ff8a3d',
  enemyBoss: '#c13bff',
  bullet: '#ffe14d',
  enemyBullet: '#ff6a9f',
  pickup: '#6ff7ff',
  hpBack: '#241038',
  hpFront: '#38e1ff',
  hpEnemy: '#ff3d7f',
};

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function glowCircle(ctx, x, y, r, color, blur = 12) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  circle(ctx, x, y, r, color);
  ctx.restore();
}

function drawPlayer(ctx, p, t) {
  const { x, y } = p;
  const w = PLAYER.WIDTH;
  const h = PLAYER.HEIGHT;
  const bob = p.onGround ? Math.sin(t * 8) * 1.2 : 0;

  ctx.save();
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 14;

  // 腿
  rect(ctx, x + 8, y + h - 16, 9, 16, PALETTE.playerDark);
  rect(ctx, x + w - 17, y + h - 16, 9, 16, PALETTE.playerDark);
  // 身体（霓虹装甲）
  const grd = ctx.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, '#57ecff');
  grd.addColorStop(1, '#0e86b8');
  ctx.fillStyle = grd;
  ctx.fillRect(x + 4, y + 10 + bob, w - 8, h - 22);
  // 头
  ctx.fillStyle = PALETTE.player;
  ctx.fillRect(x + 9, y + bob, w - 18, 14);
  // 面罩
  ctx.fillStyle = PALETTE.visor;
  ctx.fillRect(x + 14, y + 4 + bob, w - 28, 5);
  ctx.restore();

  // 武器
  ctx.save();
  ctx.translate(x + w / 2, y + 20 + bob);
  const facing = p.facing;
  ctx.scale(facing, 1);
  ctx.fillStyle = '#b8f4ff';
  ctx.fillRect(0, -2, 22, 5);
  ctx.fillStyle = PALETTE.playerDark;
  ctx.fillRect(16, -4, 7, 9);
  ctx.restore();
}

function drawCompanion(ctx, c, t) {
  const hover = Math.sin(t * 6) * 3;
  const x = c.x;
  const y = c.y + hover;
  ctx.save();
  ctx.shadowColor = PALETTE.companion;
  ctx.shadowBlur = 12;
  ctx.fillStyle = PALETTE.companion;
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x + 20, y - 6);
  ctx.lineTo(x, y + 14);
  ctx.lineTo(x - 20, y - 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#0c2e1e';
  ctx.beginPath();
  ctx.arc(x, y - 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eafff4';
  ctx.fillRect(x - 3, y - 8, 6, 3);
}

function drawEnemy(ctx, e, t) {
  const type = e.type;
  const r = e.radius;
  const color = e.boss ? PALETTE.enemyBoss : e.shield ? PALETTE.enemyShield : PALETTE.enemy;
  const flash = e.hitFlash > 0;

  ctx.save();
  if (flash) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 18;
  } else {
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = flash ? '#ffffff' : color;
  if (e.shield) {
    // 六边形护盾
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i + t * 0.4;
      const px = e.x + Math.cos(a) * r;
      const py = e.y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd7b0';
    circle(ctx, e.x, e.y, r * 0.45, '#ffd7b0');
  } else {
    // 无人机圆盘
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 红「!」目标标记
  ctx.fillStyle = '#ff2244';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', e.x, e.y - r - 16);

  // 血条
  const bw = r * 2 + 8;
  const bh = 5;
  const bx = e.x - bw / 2;
  const by = e.y - r - 12;
  rect(ctx, bx, by, bw, bh, PALETTE.hpBack);
  const ratio = Math.max(0, e.hp / e.maxHp);
  rect(ctx, bx, by, bw * ratio, bh, PALETTE.hpEnemy);
}

function drawBackground(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.62, PALETTE.skyBottom);
  g.addColorStop(1, '#241b4d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 远景楼群
  ctx.fillStyle = '#12122e';
  const seedOff = 0;
  for (let i = 0; i < 16; i += 1) {
    const bx = i * 90 - ((t * 8) % 90);
    const bh = 120 + ((i * 37) % 120);
    ctx.fillRect(bx, WORLD.GROUND_Y - bh, 70, bh);
  }
  // 窗户
  ctx.fillStyle = PALETTE.window;
  for (let i = 0; i < 16; i += 1) {
    const bx = i * 90 - ((t * 8) % 90);
    const bh = 120 + ((i * 37) % 120);
    for (let wy = WORLD.GROUND_Y - bh + 14; wy < WORLD.GROUND_Y - 16; wy += 20) {
      for (let wx = bx + 8; wx < bx + 62; wx += 16) {
        if (((wx * 7 + wy * 13) % 5) < 3) ctx.fillRect(wx, wy, 6, 8);
      }
    }
  }

  // 霓虹太阳
  ctx.save();
  ctx.shadowColor = '#ff4fd8';
  ctx.shadowBlur = 40;
  circle(ctx, 1030, 130, 52, '#ff4fd8');
  ctx.restore();
  circle(ctx, 1030, 130, 52, 'rgba(255,79,216,0.25)');
}

function drawGround(ctx, t) {
  rect(ctx, 0, WORLD.GROUND_Y, WORLD.WIDTH, WORLD.HEIGHT - WORLD.GROUND_Y, PALETTE.ground);
  // 网格
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  for (let x = -(t * 40 % 80); x < WORLD.WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, WORLD.GROUND_Y);
    ctx.lineTo(x, WORLD.HEIGHT);
    ctx.stroke();
  }
  for (let y = WORLD.GROUND_Y + 40; y < WORLD.HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.WIDTH, y);
    ctx.stroke();
  }
  // 地面霓虹线
  ctx.save();
  ctx.shadowColor = PALETTE.groundLine;
  ctx.shadowBlur = 10;
  ctx.fillStyle = PALETTE.groundLine;
  ctx.fillRect(0, WORLD.GROUND_Y, WORLD.WIDTH, 3);
  ctx.restore();
}

export function createRenderer(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  const reduced = opts.reducedMotion || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  let parts = [];
  let shake = 0;
  const MAX_PARTS = reduced ? 120 : 380;

  function addPart(p) {
    if (parts.length >= MAX_PARTS) parts.shift();
    parts.push(p);
  }

  return {
    feedEvents(events) {
      for (const e of events) {
        switch (e.type) {
          case 'shoot':
            if (!reduced) addPart({ kind: 'spark', x: e.x, y: e.y, life: 0.18, maxLife: 0.18, vx: Math.cos(Math.random() * 6) * 60, vy: -30 - Math.random() * 60, color: PALETTE.bullet });
            break;
          case 'hit':
            addPart({ kind: 'spark', x: e.x, y: e.y, life: 0.22, maxLife: 0.22, vx: (Math.random() - 0.5) * 180, vy: (Math.random() - 0.5) * 180, color: '#ffffff' });
            break;
          case 'kill':
            addPart({ kind: 'explode', x: e.x, y: e.y, life: 0.4, maxLife: 0.4, r: 8 });
            if (!reduced) shake = Math.max(shake, 0.12);
            break;
          case 'duo':
          case 'blast':
            addPart({ kind: 'ring', x: e.x, y: e.y, life: 0.5, maxLife: 0.5, r: 0, maxR: 300 });
            if (!reduced) shake = Math.max(shake, 0.3);
            break;
          case 'jump':
            addPart({ kind: 'dust', x: e.x, y: WORLD.GROUND_Y, life: 0.3, maxLife: 0.3 });
            break;
          case 'pickup':
            addPart({ kind: 'spark', x: e.x, y: e.y, life: 0.3, maxLife: 0.3, vx: 0, vy: -50, color: PALETTE.pickup });
            break;
          case 'hurt':
            if (!reduced) shake = Math.max(shake, 0.2);
            break;
          default:
            break;
        }
      }
    },

    render(run, dt) {
      // 推进粒子 / 震屏
      if (dt > 0) {
        for (let i = parts.length - 1; i >= 0; i -= 1) {
          const p = parts[i];
          p.life -= dt;
          if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; }
          if (p.kind === 'ring') { p.r = p.maxR * (1 - p.life / p.maxLife); }
          if (p.kind === 'explode') { p.r = (p.r || 8) + 30 * dt; }
          if (p.life <= 0) parts.splice(i, 1);
        }
        if (shake > 0) shake = Math.max(0, shake - dt * 1.4);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake * 20, (Math.random() - 0.5) * shake * 14);
      }
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

      const s = run.state;
      const t = s.t;

      drawBackground(ctx, t);
      drawGround(ctx, t);

      // 拾取能量球
      for (const pk of s.pickups) {
        glowCircle(ctx, pk.x, pk.y, 8 + Math.sin(t * 6 + pk.x) * 2, PALETTE.pickup, 10);
      }

      // 玩家与搭档
      drawCompanion(ctx, s.companion, t);
      drawPlayer(ctx, s.player, t);

      // 敌人
      for (const e of s.enemies) drawEnemy(ctx, e, t);

      // 玩家子弹
      for (const b of s.bullets) {
        glowCircle(ctx, b.x, b.y, b.radius > 0 ? 6 : 4, PALETTE.bullet, 10);
      }
      // 敌人子弹
      for (const b of s.enemyBullets) {
        glowCircle(ctx, b.x, b.y, 5, PALETTE.enemyBullet, 8);
      }

      // 粒子
      for (const p of parts) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        if (p.kind === 'spark') circle(ctx, p.x, p.y, 3, p.color || '#ffffff');
        else if (p.kind === 'explode') circle(ctx, p.x, p.y, p.r || 8, PALETTE.enemy);
        else if (p.kind === 'dust') circle(ctx, p.x, p.y, 4, 'rgba(140,240,255,0.5)');
        else if (p.kind === 'ring') {
          ctx.strokeStyle = PALETTE.pickup;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r || 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}

export { WEAPONS };
