// src/render/index.js — Canvas 2D 霓虹街机渲染（程序化，无素材）
// 玩家最亮（青），敌人红/洋红并带红色「!」标记，可交互物（能量球/护盾）高对比。
// DPR ≤2；prefers-reduced-motion 关闭大幅动效（闪烁/扫描线）。
import { WORLD } from '../../config/game.config.js';

const PALETTE = {
  skyTop: '#0a0618',
  skyBottom: '#1b0b33',
  sun: '#ff3d81',
  sunCore: '#ffd166',
  grid: '#3b2a6e',
  ground: '#151033',
  groundLine: '#00f0ff',
  player: '#00f0ff',
  playerCore: '#eaffff',
  enemy: '#ff2d6f',
  enemyBoss: '#ff1140',
  enemyMark: '#ffd166',
  target: '#ffd166',
  orb: '#39ff88',
  shield: '#4dc3ff',
  bolt: '#7df9ff',
};

const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function rr(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.rect(x, y, w, h);
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;

  function camX(run) {
    if (!run) return 0;
    const p = run.player;
    const w = run.levelDef.width || WORLD.LEVEL_W;
    const half = WORLD.WIDTH / 2;
    if (w <= WORLD.WIDTH) return 0;
    return Math.max(0, Math.min(p.x - half, w - WORLD.WIDTH));
  }

  function drawBackground(cam) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 合成太阳
    const sx = 980, sy = 210;
    const sun = ctx.createRadialGradient(sx, sy, 10, sx, sy, 150);
    sun.addColorStop(0, PALETTE.sunCore);
    sun.addColorStop(0.5, PALETTE.sun);
    sun.addColorStop(1, 'rgba(255,61,129,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(sx - 160, sy - 160, 320, 320);

    // 星空
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 60; i += 1) {
      const x = (i * 137.5) % WORLD.WIDTH;
      const y = (i * 89.3) % (WORLD.GROUND_Y * 0.7);
      ctx.fillRect(x, y, 2, 2);
    }

    // 远处城市剪影
    ctx.fillStyle = '#120a26';
    for (let i = 0; i < 14; i += 1) {
      const bw = 46 + ((i * 53) % 40);
      const bh = 80 + ((i * 37) % 130);
      const bx = i * 110 - ((cam * 0.2) % 110);
      ctx.fillRect(bx - 40, WORLD.GROUND_Y - bh, bw, bh);
    }

    // 地面
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, WORLD.GROUND_Y, WORLD.WIDTH, WORLD.HEIGHT - WORLD.GROUND_Y);

    // 透视网格
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 24; i += 1) {
      const x = i * 55 - ((cam * 0.5) % 55);
      ctx.beginPath();
      ctx.moveTo(x, WORLD.GROUND_Y);
      ctx.lineTo(x + 140, WORLD.HEIGHT);
      ctx.stroke();
    }
    for (let j = 0; j <= 6; j += 1) {
      const y = WORLD.GROUND_Y + j * 20;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawGroundLine() {
    ctx.strokeStyle = PALETTE.groundLine;
    ctx.lineWidth = 3;
    ctx.shadowColor = PALETTE.groundLine;
    ctx.shadowBlur = reduced ? 0 : 12;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.GROUND_Y);
    ctx.lineTo(WORLD.WIDTH, WORLD.GROUND_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function glow(color) {
    ctx.shadowColor = color;
    ctx.shadowBlur = reduced ? 0 : 14;
  }
  function unglow() {
    ctx.shadowBlur = 0;
  }

  function drawBody(x, feetY, h, facing, color) {
    const w = 40;
    ctx.save();
    ctx.translate(x, feetY);
    ctx.scale(facing, 1);
    ctx.fillStyle = color;
    glow(color);
    ctx.beginPath();
    rr(ctx, -w / 2, -h, w, h * 0.78, 8);
    ctx.fill();
    unglow();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(0, -h + 5, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.playerCore;
    ctx.lineWidth = 5;
    glow(PALETTE.playerCore);
    ctx.beginPath();
    ctx.moveTo(w / 2 + 2, -h * 0.55);
    ctx.lineTo(w / 2 + 32, -h * 0.95);
    ctx.stroke();
    unglow();
    ctx.restore();
  }

  function drawPlayer(run) {
    const p = run.player;
    if (p.state === 'dead') return;
    const x = p.x - camX(run);
    const feetY = WORLD.GROUND_Y - p.y;
    const h = 74;

    if (p.state === 'dash') {
      ctx.globalAlpha = 0.35;
      for (let i = 1; i <= 3; i += 1) {
        drawBody(x - p.facing * i * 16, feetY, h, p.facing, PALETTE.player);
      }
      ctx.globalAlpha = 1;
    }

    drawBody(x, feetY, h, p.facing, PALETTE.player);

    if (p.shield) {
      ctx.strokeStyle = PALETTE.shield;
      ctx.lineWidth = 3;
      glow(PALETTE.shield);
      ctx.beginPath();
      ctx.arc(x, feetY - h / 2, 46, 0, Math.PI * 2);
      ctx.stroke();
      unglow();
    }

    if (p.hurtT > 0 && !reduced) {
      ctx.globalAlpha = 0.35;
      drawBody(x, feetY, h, p.facing, '#ff0000');
      ctx.globalAlpha = 1;
    }
  }

  function drawEnemy(run, e) {
    const x = e.x - camX(run);
    const feetY = WORLD.GROUND_Y;
    const h = e.h;
    const w = e.w;
    const color = e.boss ? PALETTE.enemyBoss : PALETTE.enemy;

    if (e.dead) {
      if (e.deadT > 30) return;
      ctx.globalAlpha = 1 - e.deadT / 30;
      ctx.fillStyle = color;
      ctx.save();
      ctx.translate(x, feetY - h / 2);
      ctx.rotate(e.deadT * 0.1);
      ctx.beginPath();
      rr(ctx, -w / 2, -h / 2, w, h, 8);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }

    // 身体
    ctx.fillStyle = color;
    glow(color);
    ctx.beginPath();
    rr(ctx, x - w / 2, feetY - h, w, h, 10);
    ctx.fill();
    unglow();

    // 尖角（让它读作「敌人」而非方块）
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 2, feetY - h + 8);
    ctx.lineTo(x - w / 2 - 11, feetY - h - 12);
    ctx.lineTo(x - w / 2 + 14, feetY - h + 4);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 2, feetY - h + 8);
    ctx.lineTo(x + w / 2 + 11, feetY - h - 12);
    ctx.lineTo(x + w / 2 - 14, feetY - h + 4);
    ctx.closePath(); ctx.fill();

    // 怒目（白底 + 黑瞳，发光）
    const eyeDir = run.player.x > e.x ? 1 : -1;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x + eyeDir * w * 0.14, feetY - h * 0.7, 5.5, 0, Math.PI * 2);
    ctx.arc(x + eyeDir * w * 0.34, feetY - h * 0.7, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a0008';
    ctx.beginPath();
    ctx.arc(x + eyeDir * w * 0.14, feetY - h * 0.7, 2.4, 0, Math.PI * 2);
    ctx.arc(x + eyeDir * w * 0.34, feetY - h * 0.7, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // 金色「!」目标徽章（高对比，一眼看到目标）
    const by = feetY - h - 26;
    ctx.fillStyle = PALETTE.enemyMark;
    glow(PALETTE.enemyMark);
    ctx.beginPath();
    ctx.arc(x, by, 15, 0, Math.PI * 2);
    ctx.fill();
    unglow();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, by, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#6b1200';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x, by + 1);

    if (e.hp < e.maxHp) {
      const bw = w;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x - bw / 2, feetY - h - 44, bw, 6);
      ctx.fillStyle = '#ff5f5f';
      ctx.fillRect(x - bw / 2, feetY - h - 44, bw * Math.max(0, e.hp / e.maxHp), 6);
    }

    if (e.hurtT > 0 && !reduced) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      rr(ctx, x - w / 2, feetY - h, w, h, 10);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawNearestTarget(run) {
    const alive = run.enemies.filter((e) => !e.dead);
    if (!alive.length) return;
    const t = alive.reduce((a, b) => (Math.abs(a.x - run.player.x) < Math.abs(b.x - run.player.x) ? a : b));
    const x = t.x - camX(run);
    const feetY = WORLD.GROUND_Y;
    const h = t.h;
    const ty = feetY - h - 60;
    // 金色向下箭头，明确指向当前目标
    ctx.fillStyle = PALETTE.target;
    glow(PALETTE.target);
    ctx.beginPath();
    ctx.moveTo(x, ty + 16);
    ctx.lineTo(x - 14, ty - 6);
    ctx.lineTo(x + 14, ty - 6);
    ctx.closePath();
    ctx.fill();
    unglow();
  }

  function drawOrb(run, o) {
    const x = o.x - camX(run);
    const y = WORLD.GROUND_Y + o.y;
    if (o.type === 'energy') {
      ctx.fillStyle = PALETTE.orb;
      glow(PALETTE.orb);
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      unglow();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.4);
      ctx.fillStyle = PALETTE.shield;
      glow(PALETTE.shield);
      ctx.fillRect(-8, -8, 16, 16);
      unglow();
      ctx.restore();
    }
  }

  function drawProjectile(run, b) {
    const x = b.x - camX(run);
    const y = WORLD.GROUND_Y + b.y;
    ctx.fillStyle = PALETTE.bolt;
    glow(PALETTE.bolt);
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    unglow();
    ctx.fillStyle = 'rgba(125,249,255,0.3)';
    ctx.beginPath();
    ctx.arc(x - Math.sign(b.vx) * 14, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStaticHero() {
    // 标题屏静态英雄（居中偏左，带剑光）
    drawBody(WORLD.WIDTH * 0.42, WORLD.GROUND_Y, 86, 1, PALETTE.player);
  }

  return {
    draw(run, alpha = 1) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackground(camX(run));
      drawGroundLine();
      if (!run) {
        drawStaticHero();
        return;
      }
      for (const o of run.orbs) drawOrb(run, o);
      for (const b of run.projectiles) drawProjectile(run, b);
      for (const e of run.enemies) drawEnemy(run, e);
      drawNearestTarget(run);
      drawPlayer(run);
    },
    get dpr() { return dpr; },
  };
}
