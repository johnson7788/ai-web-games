// PIXEL SQUADRON · Canvas 2D 渲染（霓虹街机像素风，全部程序化，零素材）
// 职责：星空背景、玩家/敌机/岩石/子弹、粒子特效、震屏。HUD 走 DOM（main 直写）。
import { WORLD, LAYOUT } from '../../config/game.config.js';

function makeStars(n) {
  const stars = [];
  for (let i = 0; i < n; i += 1) {
    stars.push({
      x: Math.random() * WORLD.WIDTH,
      y: Math.random() * WORLD.HEIGHT,
      s: 0.5 + Math.random() * 1.2,
      v: 16 + Math.random() * 44,
      c: Math.random() < 0.9 ? '255,255,255' : Math.random() < 0.5 ? '120,240,255' : '255,200,120',
    });
  }
  return stars;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const stars = makeStars(46);

  function drawBackground(dt) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#070a18');
    g.addColorStop(0.55, '#0a1026');
    g.addColorStop(1, '#0d0a1f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星空（向下滚动制造前进感）
    ctx.fillStyle = '#fff';
    for (const st of stars) {
      st.y += st.v * dt;
      if (st.y > WORLD.HEIGHT) { st.y = -2; st.x = Math.random() * WORLD.WIDTH; }
      ctx.fillStyle = `rgba(${st.c},${0.3 + st.s * 0.1})`;
      ctx.fillRect(st.x, st.y, st.s, st.s * 2.2);
    }
  }

  function glow(color, x, y, r, alpha = 0.35) {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawShip(x, y, color, bodyColor) {
    // 像素风格三角战机 + 引擎尾焰
    ctx.save();
    ctx.translate(x, y);
    glow('rgba(79,240,255,0.28)', 0, 0, 34);
    ctx.scale(1.18, 1.18);
    // 尾焰
    const flick = 8 + Math.sin(performance.now() * 0.03) * 3;
    ctx.fillStyle = 'rgba(255,160,60,0.9)';
    ctx.beginPath();
    ctx.moveTo(-6, 16);
    ctx.lineTo(0, 26 + flick);
    ctx.lineTo(6, 16);
    ctx.closePath();
    ctx.fill();
    // 机身
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(14, 14);
    ctx.lineTo(0, 8);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 座舱
    ctx.fillStyle = '#eaffff';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(5, 2);
    ctx.lineTo(0, 6);
    ctx.lineTo(-5, 2);
    ctx.closePath();
    ctx.fill();
    // 机翼灯
    ctx.fillStyle = color;
    ctx.fillRect(-12, 12, 4, 4);
    ctx.fillRect(8, 12, 4, 4);
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const boss = e.type === 'boss';
    const R = e.r;
    glow('rgba(255,53,90,0.42)', 0, 0, R * 1.8);
    const base = boss ? 1.12 : 1.15;
    const pulse = boss ? 1 + Math.sin(performance.now() * 0.01) * 0.08 : 1;
    // 目标锁定环：明确「这是要打的目标」
    const ringR = R * 1.45 + Math.sin(performance.now() * 0.006) * 3;
    ctx.strokeStyle = 'rgba(255,90,120,0.9)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.scale(base * pulse, base * pulse);
    // 外星舰：倒三角 + 两侧翼
    ctx.fillStyle = boss ? '#ff2d55' : '#ff3355';
    ctx.strokeStyle = boss ? '#ffd0da' : '#ffd0da';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, R);
    ctx.lineTo(R, -R * 0.7);
    ctx.lineTo(R * 0.4, -R * 0.3);
    ctx.lineTo(-R * 0.4, -R * 0.3);
    ctx.lineTo(-R, -R * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 核心眼
    ctx.fillStyle = '#ffd9e0';
    ctx.beginPath();
    ctx.arc(0, R * 0.1, R * 0.28, 0, Math.PI * 2);
    ctx.fill();
    if (boss) {
      // 首领双炮口
      ctx.fillStyle = '#ffd0da';
      ctx.fillRect(-R * 0.7, -R * 0.6, 5, 12);
      ctx.fillRect(R * 0.7 - 5, -R * 0.6, 5, 12);
    }
    ctx.restore();
  }

  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.spin);
    const R = a.r;
    ctx.fillStyle = a.size === 0 ? '#6d608f' : a.size === 1 ? '#5f5680' : '#4a4270';
    ctx.strokeStyle = '#9a8fc0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 7; i += 1) {
      const ang = (i / 7) * Math.PI * 2;
      const rr = R * (0.78 + 0.22 * Math.sin(i * 2.6 + a.spin * 3));
      const px = Math.cos(ang) * rr;
      const py = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawBullet(b, kind) {
    if (kind === 'player') {
      glow('rgba(127,244,255,0.45)', b.x, b.y, 8);
      ctx.fillStyle = '#eafdff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      glow('rgba(255,79,216,0.5)', b.x, b.y, 10);
      ctx.fillStyle = '#ff4fd8';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(view) {
    for (const p of view.particles) {
      ctx.globalAlpha = Math.max(0, p.ttl / p.maxTtl);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.ttl / p.maxTtl), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return {
    draw(state, dt, view = {}) {
      ctx.save();
      if (view.shake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * view.shake * 2,
          (Math.random() - 0.5) * view.shake * 2,
        );
      }
      drawBackground(dt);

      if (state) {
        // 敌机
        for (const e of state.enemies) drawEnemy(e);
        // 岩石
        for (const a of state.asteroids) drawAsteroid(a);
        // 玩家
        if (state.player.hp > 0) drawShip(state.player.x, state.player.y, '#4ff0ff', '#0e2f45');
        // 玩家子弹
        for (const b of state.bullets) drawBullet(b, 'player');
        // 敌弹
        for (const b of state.enemyBullets) drawBullet(b, 'enemy');
        // 粒子
        if (view.particles) drawParticles(view);
      } else {
        // 标题屏：远处装饰性战舰编队剪影
        ctx.save();
        ctx.globalAlpha = 0.34;
        const t = performance.now() * 0.0004;
        for (let i = 0; i < 5; i += 1) {
          const x = (WORLD.WIDTH * 0.5 + Math.sin(t + i * 1.7) * 320 + i * 60) % WORLD.WIDTH;
          const y = 120 + ((t * 40 + i * 90) % 360);
          drawEnemy({ x, y, r: 22, type: 'grunt' });
        }
        ctx.restore();
      }

      ctx.restore();
    },

    debugLayout() {
      return {
        field: { x: 0, y: 0, w: WORLD.WIDTH, h: WORLD.HEIGHT },
        player: { x: WORLD.WIDTH / 2 - 40, y: LAYOUT.PLAYER_Y - 40, w: 80, h: 70 },
      };
    },
  };
}
