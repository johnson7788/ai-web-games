// Canvas 2D 渲染：霓虹街机星际防线。全部程序化，无图片无外链。
import { WORLD, TUNE } from '../../config/game.config.js';

const NEON = {
  bg0: '#070819',
  bg1: '#0d1030',
  star: '#a8c8ff',
  base: '#19e6ff',
  baseDark: '#0a3f55',
  main: '#ff4fd8',
  side: '#31ffc8',
  drone: '#ff5a3c',
  tank: '#ffd23c',
  boss: '#ff2d95',
  bullet: '#dffcff',
  rapid: '#ffe14d',
  freeze: '#55e8ff',
  shield: '#5dff8a',
  white: '#eaffff',
};

function glow(ctx, color, blur = 12) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const W = WORLD.W;
  const H = WORLD.H;
  const dpr = Math.min(TUNE.DPR_MAX, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  // 预生成星空
  const stars = [];
  for (let i = 0; i < 130; i += 1) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.4, s: 4 + Math.random() * 22 });
  }

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, NEON.bg0);
    g.addColorStop(0.7, NEON.bg1);
    g.addColorStop(1, '#131a44');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 星云（左上 / 右上两团，增加画面层次）
    noGlow(ctx);
    for (const neb of [
      { x: 180, y: 150, r: 240, c: 'rgba(90,60,180,0.16)' },
      { x: 1100, y: 120, r: 280, c: 'rgba(20,140,190,0.14)' },
      { x: 640, y: 420, r: 300, c: 'rgba(180,40,140,0.10)' },
    ]) {
      const rg = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
      rg.addColorStop(0, neb.c);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(neb.x - neb.r, neb.y - neb.r, neb.r * 2, neb.r * 2);
    }

    // 一颗带环的星（远处视觉锚点）
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(140,200,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(1050, 220, 74, 20, -0.35, 0, Math.PI * 2);
    ctx.stroke();
    const pg = ctx.createRadialGradient(1050, 220, 0, 1050, 220, 34);
    pg.addColorStop(0, 'rgba(150,210,255,0.7)');
    pg.addColorStop(1, 'rgba(20,60,120,0.1)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(1050, 220, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 星空（缓慢下移制造俯冲感；刻意调暗，避免与子弹/敌人混淆）
    for (const st of stars) {
      const y = (st.y + time * st.s) % H;
      ctx.globalAlpha = 0.18 + 0.3 * (st.r / 2);
      ctx.fillStyle = NEON.star;
      ctx.fillRect(st.x, y, st.r, st.r);
    }
    ctx.globalAlpha = 1;
  }

  function drawBase(state) {
    const baseY = WORLD.BASE_Y;
    // 基座平台（更高、更亮，明确「这是要守的星港」）
    const g = ctx.createLinearGradient(0, baseY - 30, 0, H);
    g.addColorStop(0, '#154a66');
    g.addColorStop(0.35, '#0c2a44');
    g.addColorStop(1, '#050a18');
    ctx.fillStyle = g;
    ctx.fillRect(0, baseY - 30, W, H - baseY + 30);

    // 中央能量核心（防线的视觉锚点；用青色，把洋红留给玩家飞船）
    const coreX = W / 2;
    const coreY = baseY + 26;
    const pulse = 1 + 0.05 * Math.sin(state.time * 3);
    glow(ctx, NEON.base, 22);
    const cg = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, 40 * pulse);
    cg.addColorStop(0, 'rgba(120,240,255,0.8)');
    cg.addColorStop(0.5, 'rgba(30,120,170,0.45)');
    cg.addColorStop(1, 'rgba(10,20,40,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(coreX, coreY, 40 * pulse, 0, Math.PI * 2);
    ctx.fill();
    noGlow(ctx);

    glow(ctx, NEON.base, 16);
    ctx.strokeStyle = NEON.base;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(W, baseY);
    ctx.stroke();
    // 甲板网格线
    ctx.strokeStyle = 'rgba(25,230,255,0.25)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 64) {
      ctx.beginPath();
      ctx.moveTo(gx, baseY);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    noGlow(ctx);

    // 侧翼副炮（自动，较小）
    for (const t of state.turrets) {
      if (t.x === W / 2) continue;
      const x = t.x;
      const y = t.y + 4;
      if (!t.unlocked) ctx.globalAlpha = 0.3;
      glow(ctx, NEON.side, 12);
      ctx.fillStyle = NEON.baseDark;
      ctx.fillRect(x - 26, y, 52, 20);
      ctx.fillStyle = NEON.side;
      ctx.fillRect(x - 18, y - 8, 36, 10);
      ctx.fillRect(x - 3, y - 26, 6, 22);
      noGlow(ctx);
      ctx.globalAlpha = 1;
    }

    // 中央主炮 = 玩家飞船（大、亮、向上，明确的玩家剪影）
    const px = W / 2;
    const py = baseY - 14;
    const main = state.turrets[0];
    if (!main.unlocked) ctx.globalAlpha = 0.5;
    // 深色护盾板衬在飞船后方，把亮色船体从星空/核心光晕里「抠」出来
    ctx.fillStyle = 'rgba(4, 7, 20, 0.9)';
    ctx.beginPath();
    ctx.ellipse(px, py - 34, 50, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    // 脉冲光环 + ▲ 标记
    glow(ctx, NEON.main, 22);
    ctx.strokeStyle = NEON.main;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py - 34, 54 + Math.sin(time * 5) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = NEON.main;
    ctx.beginPath();
    ctx.moveTo(px, py - 122);
    ctx.lineTo(px - 13, py - 96);
    ctx.lineTo(px + 13, py - 96);
    ctx.closePath();
    ctx.fill();
    // 船体（亮青→白渐变，比背景亮得多）
    const hull = ctx.createLinearGradient(0, py - 110, 0, py + 10);
    hull.addColorStop(0, '#ffffff');
    hull.addColorStop(0.4, '#ff8af0');
    hull.addColorStop(1, '#c82ad0');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(px, py - 110);
    ctx.lineTo(px + 26, py - 40);
    ctx.lineTo(px + 40, py - 8);
    ctx.lineTo(px + 18, py + 8);
    ctx.lineTo(px - 18, py + 8);
    ctx.lineTo(px - 40, py - 8);
    ctx.lineTo(px - 26, py - 40);
    ctx.closePath();
    ctx.fill();
    // 深色描边强化轮廓
    ctx.strokeStyle = 'rgba(4,6,18,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // 机舱（亮白 + 描边）
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py - 44, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#12233a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 主炮管（粗、亮白）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - 6, py - 112, 12, 40);
    ctx.fillStyle = NEON.main;
    ctx.fillRect(px - 2, py - 112, 4, 40);
    noGlow(ctx);
    ctx.globalAlpha = 1;
  }

  function drawEnemy(e, time) {
    const pulse = 1 + 0.06 * Math.sin(time * 6 + e.id);
    ctx.save();
    ctx.translate(e.x, e.y);
    const color = e.type === 'boss' ? NEON.boss : e.type === 'tank' ? NEON.tank : NEON.drone;
    // 深色光环，把敌人从星空里「抠」出来（提高剪影辨识度）
    ctx.fillStyle = 'rgba(3, 5, 14, 0.72)';
    ctx.beginPath();
    ctx.arc(0, 0, e.size + 5, 0, Math.PI * 2);
    ctx.fill();
    glow(ctx, color, e.type === 'boss' ? 22 : 10);
    ctx.fillStyle = color;
    if (e.type === 'boss') {
      // 大型菱形战舰
      ctx.beginPath();
      ctx.moveTo(0, -e.size * pulse);
      ctx.lineTo(e.size * pulse, 0);
      ctx.lineTo(0, e.size * pulse);
      ctx.lineTo(-e.size * pulse, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, e.size * 0.24, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'tank') {
      // 六边形装甲
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i;
        const px = Math.cos(a) * e.size * pulse;
        const py = Math.sin(a) * e.size * pulse;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = NEON.white;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // 向下三角小兵
      ctx.beginPath();
      ctx.moveTo(0, e.size * pulse);
      ctx.lineTo(-e.size * 0.9 * pulse, -e.size * 0.7 * pulse);
      ctx.lineTo(e.size * 0.9 * pulse, -e.size * 0.7 * pulse);
      ctx.closePath();
      ctx.fill();
    }
    noGlow(ctx);
    ctx.restore();

    // 逼近基座的敌人加红色「!」威胁标记
    if (e.y > WORLD.BASE_Y - 280) {
      ctx.fillStyle = '#ff3b4a';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', e.x, e.y - e.size - 14);
    }

    // 血条
    if (e.hp < e.maxHp) {
      const w = e.type === 'boss' ? 90 : 40;
      const x = e.x - w / 2;
      const y = e.y - e.size - 16;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = e.type === 'boss' ? NEON.boss : NEON.tank;
      ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  function drawBullet(b) {
    // 深色底描边 + 亮色主体，和星空星点区分开
    ctx.strokeStyle = 'rgba(3, 5, 14, 0.85)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 14, b.y - b.vy * 14);
    ctx.stroke();
    glow(ctx, NEON.bullet, 9);
    ctx.strokeStyle = NEON.bullet;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 12, b.y - b.vy * 12);
    ctx.stroke();
    noGlow(ctx);
  }

  function drawPowerup(p, time) {
    const color = p.type === 'rapid' ? NEON.rapid : p.type === 'freeze' ? NEON.freeze : NEON.shield;
    const pulse = 1 + 0.12 * Math.sin(time * 8);
    glow(ctx, color, 14);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12 * pulse, 0, Math.PI * 2);
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = '#081018';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.type === 'rapid' ? 'R' : p.type === 'freeze' ? 'F' : 'S', p.x, p.y + 1);
  }

  function drawParticles(view, dt) {
    for (const p of view.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      const a = Math.max(0, p.life / p.maxLife);
      glow(ctx, p.color, 8);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      noGlow(ctx);
    }
    ctx.globalAlpha = 1;
    view.particles = view.particles.filter((p) => p.life > 0);
    if (view.particles.length > TUNE.MAX_PARTICLES) view.particles.length = TUNE.MAX_PARTICLES;
  }

  function drawBeam(view, dt) {
    if (!view.beam || view.beam.ttl <= 0) return;
    view.beam.ttl -= dt;
    const a = Math.max(0, view.beam.ttl / 0.5);
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.BASE_Y);
    g.addColorStop(0, `rgba(255,79,216,${0.5 * a})`);
    g.addColorStop(1, `rgba(25,230,255,${0.2 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, WORLD.BASE_Y);
    glow(ctx, NEON.main, 30);
    ctx.strokeStyle = `rgba(234,255,255,${a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.BASE_Y - 8);
    ctx.lineTo(W, WORLD.BASE_Y - 8);
    ctx.stroke();
    noGlow(ctx);
  }

  function drawShield(state) {
    if (state.shield <= 0) return;
    glow(ctx, NEON.shield, 18);
    ctx.strokeStyle = NEON.shield;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(W / 2, WORLD.BASE_Y + 40, 90, Math.PI, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    noGlow(ctx);
  }

  function drawFreeze(state) {
    if (state.time >= state.freezeUntil) return;
    ctx.fillStyle = 'rgba(85,232,255,0.08)';
    ctx.fillRect(0, 0, W, WORLD.BASE_Y);
  }

  return {
    W,
    H,
    draw(state, dt, view) {
      ctx.clearRect(0, 0, W, H);
      const time = state ? state.time : 0;
      drawBackground(time);
      if (!state) return;
      drawFreeze(state);
      drawBeam(view, dt);
      drawBase(state);
      drawShield(state);
      for (const e of state.enemies) drawEnemy(e, time);
      for (const b of state.bullets) drawBullet(b);
      for (const p of state.powerups) drawPowerup(p, time);
      drawParticles(view, dt);
    },
  };
}
