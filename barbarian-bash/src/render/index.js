// BARBARIAN BASH · 程序化霓虹街机渲染（纯 Canvas 2D，零素材）
// 职责：只读 sim state + view，绘制竞技场 / 野蛮人 / 机器人 / 障碍 / 岩石 / 粒子。
import { WORLD, THROW, PLAYER } from '../../config/game.config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const PAL = {
  bgTop: '#0b0620',
  bgBot: '#1a0f3d',
  horizon: '#5b2fb8',
  floor: '#22e0ff',
  grid: 'rgba(120, 80, 255, 0.28)',
  player: '#ffb13c',
  playerDark: '#c2472a',
  skin: '#ffe9c4',
  boulder: '#7fe8ff',
  boulderDark: '#1b7f9e',
  enemy: '#ff3d81',
  enemyDark: '#8a1440',
  boss: '#ff5a3c',
  core: '#4dffef',
  crate: '#b07a3f',
  crateDark: '#6b4426',
  tnt: '#ff5a3c',
  tntDark: '#8a1f12',
  glass: 'rgba(140, 230, 255, 0.45)',
  captive: '#6dff9e',
  captiveDark: '#1f7a4d',
  white: '#ffffff',
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
  let DPR = 1;
  const particles = [];
  const texts = [];
  let shake = 0;

  function resize() {
    DPR = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = WORLD.WIDTH * DPR;
    canvas.height = WORLD.HEIGHT * DPR;
  }
  resize();
  window.addEventListener('resize', resize);

  function spawn(kind, x, y, extra = {}) {
    const TTL = kind === 'explode' ? 0.55 : kind === 'break' ? 0.5 : kind === 'crit' ? 0.5 : 0.4;
    if (kind === 'explode') {
      for (let i = 0; i < 18; i += 1) {
        const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
        const sp = 120 + Math.random() * 260;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: TTL * (0.6 + Math.random() * 0.6), color: i % 2 ? '#ffd84e' : '#ff5a3c', r: 2 + Math.random() * 4 });
      }
      particles.push({ x, y, vx: 0, vy: 0, life: 0.35, color: '#ffffff', r: 40, ring: true });
    } else if (kind === 'break') {
      for (let i = 0; i < 10; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 180;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: TTL * (0.6 + Math.random() * 0.5), color: extra.color || '#b07a3f', r: 2 + Math.random() * 3 });
      }
    } else if (kind === 'crit') {
      for (let i = 0; i < 12; i += 1) {
        const a = (Math.PI * 2 * i) / 12;
        particles.push({ x, y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 0.45, color: '#4dffef', r: 2 + Math.random() * 2 });
      }
    }
  }

  function spawnText(x, y, str, color = '#ffe95c', size = 22) {
    texts.push({ x, y, str, color, size, life: 0.9, vy: -40 });
  }

  // ---------- 背景 ----------
  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, PAL.bgTop);
    g.addColorStop(0.72, '#160b33');
    g.addColorStop(1, PAL.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 霓虹地平线
    const hg = ctx.createLinearGradient(0, 470, 0, 620);
    hg.addColorStop(0, 'rgba(91,47,184,0)');
    hg.addColorStop(1, 'rgba(120,60,255,0.55)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 470, WORLD.WIDTH, 150);

    // 透视网格地面
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i += 1) {
      const y = 500 + i * 16 + Math.sin(i) * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
    for (let i = -8; i <= 16; i += 1) {
      const x = i * 90 + (t * 20) % 90;
      ctx.beginPath();
      ctx.moveTo(x, 500);
      ctx.lineTo(x * 1.6 - 200, WORLD.HEIGHT);
      ctx.stroke();
    }

    // 地面平台（霓虹发光线 + 下方填充）
    ctx.fillStyle = 'rgba(12, 8, 26, 0.9)';
    ctx.fillRect(0, WORLD.GROUND_Y, WORLD.WIDTH, WORLD.HEIGHT - WORLD.GROUND_Y);
    ctx.strokeStyle = PAL.floor;
    ctx.lineWidth = 3;
    ctx.shadowColor = PAL.floor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.GROUND_Y);
    ctx.lineTo(WORLD.WIDTH, WORLD.GROUND_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 地面点缀
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 173) % WORLD.WIDTH;
      const y = WORLD.GROUND_Y + 16 + ((i * 97) % 60);
      ctx.fillStyle = 'rgba(120,80,255,0.16)';
      ctx.fillRect(x, y, 3, 10);
    }
  }

  // ---------- 野蛮人 ----------
  function drawPlayer(aim) {
    const x = PLAYER.BODY_X;
    const feet = PLAYER.FEET_Y;
    const hx = PLAYER.HX;
    const hy = PLAYER.HY;
    ctx.save();
    ctx.translate(x, feet);
    ctx.lineWidth = 3;
    ctx.strokeStyle = PAL.playerDark;
    // 腿
    ctx.fillStyle = PAL.playerDark;
    ctx.fillRect(-14, -26, 11, 26);
    ctx.fillRect(3, -26, 11, 26);
    // 身体
    ctx.fillStyle = PAL.player;
    roundRect(ctx, -22, -74, 44, 52, 10); ctx.fill();
    ctx.stroke();
    // 头
    ctx.fillStyle = PAL.skin;
    ctx.beginPath(); ctx.arc(0, -88, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 角盔
    ctx.fillStyle = PAL.playerDark;
    ctx.beginPath(); ctx.moveTo(-14, -96); ctx.lineTo(-8, -118); ctx.lineTo(-4, -96); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, -96); ctx.lineTo(8, -118); ctx.lineTo(4, -96); ctx.closePath(); ctx.fill();
    // 眼
    ctx.fillStyle = '#1a0f3d';
    ctx.fillRect(-7, -90, 4, 4);
    ctx.fillRect(4, -90, 4, 4);

    // 持石手臂：朝瞄准方向
    const mag = Math.hypot(aim.dx, aim.dy);
    let ang = -Math.PI / 4;
    if (mag > 1) ang = Math.atan2(aim.dy, aim.dx);
    ctx.save();
    ctx.translate(0, -64);
    ctx.rotate(ang);
    ctx.fillStyle = PAL.skin;
    ctx.strokeStyle = PAL.playerDark;
    roundRect(ctx, 0, -6, 34, 12, 6); ctx.fill(); ctx.stroke();
    // 手里的岩石（更大、发光，一眼看出「要扔的东西」）
    ctx.fillStyle = PAL.boulder;
    ctx.strokeStyle = PAL.boulderDark;
    ctx.lineWidth = 2;
    ctx.shadowColor = PAL.boulder;
    ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(38, 0, THROW.BOULDER_R + 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(35, -2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // ---------- 机器人敌人 ----------
  function drawEnemy(e, t) {
    if (!e.alive && e.deadTimer <= 0) return;
    const x = e.cx;
    const w = e.w;
    const h = e.h;
    const top = e.cy - h / 2;
    const col = e.boss ? PAL.boss : PAL.enemy;
    const colDark = e.boss ? '#7a1a08' : PAL.enemyDark;
    ctx.save();
    ctx.translate(x, e.cy);
    // 死亡：倒地塌缩 + 淡出
    if (!e.alive) {
      const p = clamp(1 - e.deadTimer / 0.9, 0, 1);
      ctx.globalAlpha = 1 - p;
      ctx.rotate(p * 1.4);
      ctx.translate(0, p * 10);
    }
    // 腿（让机器人读作「站立的敌人」而非方块）
    ctx.fillStyle = colDark;
    ctx.strokeStyle = colDark;
    ctx.lineWidth = 3;
    ctx.fillRect(-w / 2 + 4, h / 2 - 16, 10, 16);
    ctx.fillRect(w / 2 - 14, h / 2 - 16, 10, 16);
    // 身体
    ctx.fillStyle = col;
    ctx.strokeStyle = colDark;
    ctx.lineWidth = 3;
    roundRect(ctx, -w / 2, -h / 2, w, h - 6, 8); ctx.fill(); ctx.stroke();
    // 装甲板
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, -w / 2 + 6, -h / 2 + 8, w - 12, 10, 4); ctx.fill();
    // 天线
    ctx.strokeStyle = colDark;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, -h / 2 - 14); ctx.stroke();
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath(); ctx.arc(0, -h / 2 - 16, 5, 0, Math.PI * 2); ctx.fill();
    // 怒眼（发光红）
    ctx.fillStyle = '#ff2d55';
    ctx.shadowColor = '#ff2d55';
    ctx.shadowBlur = 6;
    ctx.fillRect(-w / 4 - 4, -h / 6, 8, 8);
    ctx.fillRect(w / 4 - 4, -h / 6, 8, 8);
    ctx.shadowBlur = 0;
    // 怒嘴
    ctx.strokeStyle = colDark;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-w / 5, h / 5); ctx.lineTo(w / 5, h / 5); ctx.stroke();
    // 弱点核心（发光）
    if (e.alive) {
      const cx = e.core.dx;
      const cy = e.core.dy;
      const pulse = 1 + Math.sin(t * 6) * 0.15;
      ctx.fillStyle = PAL.core;
      ctx.shadowColor = PAL.core;
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx, cy, e.core.r * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#0a4a44';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, e.core.r * pulse, 0, Math.PI * 2); ctx.stroke();
    }
    // 血量 pips
    if (e.alive && e.hpMax > 1) {
      for (let i = 0; i < e.hpMax; i += 1) {
        ctx.fillStyle = i < e.hp ? '#ffe95c' : 'rgba(255,255,255,0.2)';
        ctx.fillRect(-w / 2 + 6 + i * 10, -h / 2 - 14, 7, 6);
      }
    }
    // 受击闪白
    if (e.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      roundRect(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill();
    }
    // 目标标记：红色「!」徽章 + TARGET 文字（存活时，明确这是要砸的目标）
    if (e.alive) {
      const my = -h / 2 - 38;
      ctx.save();
      ctx.translate(0, my);
      ctx.fillStyle = '#ff2d55';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 1);
      ctx.font = 'bold 13px sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#2a0410';
      ctx.strokeText('TARGET', 0, 25);
      ctx.fillStyle = '#ffd9e0';
      ctx.fillText('TARGET', 0, 25);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- 障碍 ----------
  function drawBarrier(bar, t) {
    if (!bar.alive && bar.breakTimer <= 0) return;
    const x = bar.cx;
    const top = bar.cy - bar.h / 2;
    ctx.save();
    ctx.translate(bar.cx, bar.cy);
    if (!bar.alive) {
      const p = clamp(1 - bar.breakTimer / 0.6, 0, 1);
      ctx.globalAlpha = 1 - p;
      ctx.rotate(p * 0.5);
    }
    ctx.lineWidth = 3;
    if (bar.type === 'crate') {
      ctx.fillStyle = PAL.crate;
      ctx.strokeStyle = PAL.crateDark;
      roundRect(ctx, -bar.w / 2, -bar.h / 2, bar.w, bar.h, 4); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = PAL.crateDark;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-bar.w / 2 + 4, -bar.h / 2 + 4); ctx.lineTo(bar.w / 2 - 4, bar.h / 2 - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bar.w / 2 - 4, -bar.h / 2 + 4); ctx.lineTo(-bar.w / 2 + 4, bar.h / 2 - 4); ctx.stroke();
    } else if (bar.type === 'tnt') {
      ctx.fillStyle = PAL.tnt;
      ctx.strokeStyle = PAL.tntDark;
      roundRect(ctx, -bar.w / 2, -bar.h / 2, bar.w, bar.h, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd84e';
      ctx.fillRect(-bar.w / 2, -6, bar.w, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TNT', 0, 5);
    } else if (bar.type === 'glass') {
      ctx.fillStyle = PAL.glass;
      ctx.strokeStyle = '#9fe9ff';
      ctx.fillRect(-bar.w / 2, -bar.h / 2, bar.w, bar.h);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.moveTo(-bar.w / 4, -bar.h / 2); ctx.lineTo(-bar.w / 4, bar.h / 2); ctx.moveTo(bar.w / 4, -bar.h / 2); ctx.lineTo(bar.w / 4, bar.h / 2); ctx.stroke();
    }
    if (bar.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      roundRect(ctx, -bar.w / 2, -bar.h / 2, bar.w, bar.h, 6); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- 人质 ----------
  function drawCaptive(c, t) {
    if (!c || !c.alive) return;
    const x = c.cx;
    const top = c.cy - c.h / 2;
    ctx.save();
    ctx.translate(c.cx, c.cy);
    ctx.lineWidth = 3;
    ctx.strokeStyle = PAL.captiveDark;
    ctx.fillStyle = PAL.captive;
    roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a0f3d';
    ctx.fillRect(-c.w / 4 - 3, -c.h / 6, 6, 6);
    ctx.fillRect(c.w / 4 - 3, -c.h / 6, 6, 6);
    // 头顶警示
    ctx.fillStyle = '#ffe95c';
    ctx.shadowColor = '#ffe95c';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -c.h / 2 - 12);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ---------- 岩石 ----------
  function drawBoulders(state) {
    for (const b of state.boulders) {
      ctx.save();
      // 拖尾
      ctx.strokeStyle = 'rgba(127,232,255,0.25)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      ctx.stroke();
      ctx.fillStyle = PAL.boulder;
      ctx.strokeStyle = PAL.boulderDark;
      ctx.lineWidth = 2;
      ctx.shadowColor = PAL.boulder;
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(b.x - 3, b.y - 3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // ---------- 弹道预览 ----------
  function drawTrajectory(aim) {
    if (!aim.active) return;
    const mag = Math.hypot(aim.dx, aim.dy);
    if (mag < THROW.DEAD_ZONE) return;
    const nx = aim.dx / mag;
    const ny = aim.dy / mag;
    const speed = THROW.SPEED * aim.power;
    let x = PLAYER.HX;
    let y = PLAYER.HY;
    let vx = nx * speed;
    let vy = ny * speed;
    const stepT = 0.06;
    for (let i = 0; i < 26; i += 1) {
      x += vx * stepT;
      y += vy * stepT;
      vy += WORLD.GRAVITY * stepT;
      if (y > WORLD.GROUND_Y || x < 0 || x > WORLD.WIDTH) break;
      const a = 1 - i / 26;
      ctx.fillStyle = i < 4 ? 'rgba(255,233,92,0.9)' : 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(x, y, i < 4 ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- 粒子 / 漂浮文字 ----------
  function drawFx(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      const a = clamp(p.life / 0.5, 0, 1);
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - a * 0.6), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        ctx.globalAlpha = 1;
      }
    }
    particles.splice(0, Math.max(0, particles.length - 300));
    for (const tx of texts) {
      tx.life -= dt;
      tx.y += tx.vy * dt;
      ctx.globalAlpha = clamp(tx.life / 0.6, 0, 1);
      ctx.fillStyle = tx.color;
      ctx.font = `bold ${tx.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(tx.str, tx.x, tx.y);
      ctx.fillText(tx.str, tx.x, tx.y);
      ctx.globalAlpha = 1;
    }
    texts.splice(0, Math.max(0, texts.length - 60));
  }

  // ---------- 主绘制 ----------
  function draw(state, dt, view = {}) {
    const t = performance.now() / 1000;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 24);
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawBackground(t);

    // 标题屏：无 state 时画一个演示野蛮人 + 两个机器人
    if (!state) {
      drawPlayer({ dx: 0.7, dy: -0.4 });
      const demo = [
        { cx: 820, w: 64, h: 84, hp: 1, hpMax: 1, boss: false, core: { dx: 0, dy: -6, r: 22 }, alive: true, flash: 0 },
        { cx: 1010, w: 64, h: 84, hp: 1, hpMax: 1, boss: false, core: { dx: 0, dy: -6, r: 22 }, alive: true, flash: 0 },
      ];
      for (const e of demo) drawEnemy(e, t);
      drawFx(dt);
      return;
    }

    // 障碍 / 人质 / 敌人（层级：后→前）
    for (const bar of state.barriers) drawBarrier(bar, t);
    drawCaptive(state.captive, t);
    for (const e of state.enemies) drawEnemy(e, t);
    drawBoulders(state);
    drawTrajectory(state.aim);
    drawPlayer(state.aim);
    drawFx(dt);
  }

  function debugLayout() {
    return {
      player: { x: PLAYER.BODY_X - 24, y: PLAYER.FEET_Y - 120, w: 60, h: 120 },
      hand: { x: PLAYER.HX, y: PLAYER.HY, w: 26, h: 26 },
    };
  }

  return { draw, debugLayout, spawn, spawnText, addShake(v) { shake = Math.max(shake, v); } };
}
