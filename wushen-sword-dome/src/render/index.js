// WUSHEN SWORD DOME · Canvas 2D 渲染（霓虹街机风格，纯程序化，零素材）
// 职责：背景 / 格斗场地 / 两位斗士 / 飞行剑刃 / 星陨石 / 粒子 / 飘字。
import { WORLD } from '../../config/game.config.js';

const PAL = {
  bgTop: '#0a0620',
  bgBot: '#1c0a38',
  grid: 'rgba(120, 80, 220, 0.28)',
  horizon: 'rgba(255, 80, 200, 0.16)',
  self: '#22d3ee',
  selfCore: '#d9feff',
  other: '#f472b6',
  otherCore: '#ffe4f3',
  orb: '#fbbf24',
  orbCore: '#fff7d6',
  hit: '#ffe08a',
  crit: '#ff5a7a',
};

function glow(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

function drawFighter(ctx, cx, footY, cfg) {
  const { color, core, facing, attack, dodging, buff, poison, horned, t } = cfg;
  const dir = facing; // +1 面右，-1 面左
  const bob = Math.sin(t * 2.2) * 4;
  const lunge = attack > 0 ? Math.max(0, 1 - attack / 0.35) * 26 * dir : 0;
  const cx2 = cx + lunge;

  const headY = 292 + bob * 0.4;
  const torsoTop = 324;
  const torsoBot = 470;
  const hipY = 470;

  ctx.save();
  ctx.translate(cx2, 0);

  // 脚下光晕
  glow(ctx, color, 18, () => {
    ctx.beginPath();
    ctx.ellipse(0, footY, 46, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = dodging ? 'rgba(255,255,255,0.10)' : `${color}33`;
    ctx.fill();
  });

  // 腿
  ctx.strokeStyle = color;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  glow(ctx, color, 8, () => {
    ctx.beginPath();
    ctx.moveTo(-14, hipY);
    ctx.lineTo(-16, footY);
    ctx.moveTo(14, hipY);
    ctx.lineTo(18, footY);
    ctx.stroke();
  });

  // 躯干（梯形）
  glow(ctx, color, 12, () => {
    ctx.beginPath();
    ctx.moveTo(-26, torsoTop);
    ctx.lineTo(26, torsoTop);
    ctx.lineTo(17, torsoBot);
    ctx.lineTo(-17, torsoBot);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = core;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // 头
  glow(ctx, core, 14, () => {
    ctx.beginPath();
    ctx.arc(0, headY, 24, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = core;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  // 面罩线
  ctx.strokeStyle = core;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(dir * 6, headY - 8);
  ctx.lineTo(dir * 20, headY + 2);
  ctx.stroke();

  if (horned) {
    glow(ctx, core, 8, () => {
      ctx.beginPath();
      ctx.moveTo(-20, headY - 20); ctx.lineTo(-30, headY - 44); ctx.lineTo(-12, headY - 26); ctx.closePath();
      ctx.moveTo(20, headY - 20); ctx.lineTo(30, headY - 44); ctx.lineTo(12, headY - 26); ctx.closePath();
      ctx.fillStyle = core;
      ctx.fill();
    });
  }

  // 持剑臂 + 剑刃
  const shoulderY = 340;
  const armExt = attack > 0 ? Math.max(0, 1 - attack / 0.35) : 0.15;
  const handX = dir * (30 + armExt * 40);
  glow(ctx, color, 8, () => {
    ctx.beginPath();
    ctx.moveTo(0, shoulderY);
    ctx.lineTo(handX, shoulderY + 16);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.stroke();
    // 剑刃（能量刀）
    ctx.beginPath();
    ctx.moveTo(handX, shoulderY + 16);
    ctx.lineTo(handX + dir * 66, shoulderY + 6);
    ctx.strokeStyle = core;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(handX, shoulderY + 16);
    ctx.lineTo(handX + dir * 66, shoulderY + 6);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // 状态光环
  if (dodging) {
    glow(ctx, core, 20, () => {
      ctx.beginPath();
      ctx.arc(0, (headY + footY) / 2, 80, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }
  if (buff) {
    glow(ctx, PAL.orb, 14, () => {
      ctx.beginPath();
      ctx.arc(0, headY - 30, 12, 0, Math.PI * 2);
      ctx.fillStyle = PAL.orb;
      ctx.fill();
    });
  }
  if (poison) {
    glow(ctx, '#4ade80', 10, () => {
      ctx.beginPath();
      ctx.arc(-dir * 30, headY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#4ade80';
      ctx.fill();
    });
  }

  ctx.restore();
}

function drawBlade(ctx, p, time) {
  const dist = Math.abs(p.endX - p.startX);
  const x = p.startX + p.dir * p.t * dist;
  const y = p.baseY - p.arc * 4 * p.t * (1 - p.t);
  const angle = Math.atan2(-(p.arc * 4 * (1 - 2 * p.t)), p.dir * dist) + (p.dir > 0 ? 0 : Math.PI);
  const color = p.owner === 'self' ? PAL.self : PAL.other;
  const core = p.owner === 'self' ? PAL.selfCore : PAL.otherCore;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  glow(ctx, color, 16, () => {
    // 尾迹
    ctx.beginPath();
    ctx.moveTo(-p.dir * 46, 0);
    ctx.lineTo(-p.dir * 10, -6);
    ctx.lineTo(-p.dir * 10, 6);
    ctx.closePath();
    ctx.fillStyle = `${color}66`;
    ctx.fill();
    // 刃身
    ctx.beginPath();
    ctx.moveTo(p.dir * 26, 0);
    ctx.lineTo(-p.dir * 8, -7);
    ctx.lineTo(-p.dir * 26, 0);
    ctx.lineTo(-p.dir * 8, 7);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
  ctx.restore();
}

function drawOrb(ctx, o, time) {
  const pulse = 1 + Math.sin(time * 5) * 0.12;
  glow(ctx, PAL.orb, 22, () => {
    ctx.beginPath();
    ctx.arc(o.x, o.y, 24 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = PAL.orb;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  glow(ctx, PAL.orbCore, 12, () => {
    ctx.beginPath();
    ctx.arc(o.x, o.y, 13 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = PAL.orbCore;
    ctx.fill();
  });
  ctx.fillStyle = '#5b3a00';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.kind === 'heal' ? '+' : o.kind === 'mp' ? '⚡' : '✸', o.x, o.y + 1);
}

function drawBackground(ctx, time) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, PAL.bgTop);
  g.addColorStop(1, PAL.bgBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 地平线辉光
  glow(ctx, PAL.horizon, 40, () => {
    ctx.fillStyle = PAL.horizon;
    ctx.fillRect(0, 250, WORLD.WIDTH, 3);
  });

  // 透视网格地面
  ctx.strokeStyle = PAL.grid;
  ctx.lineWidth = 1.5;
  const horizonY = 320;
  const baseY = WORLD.GROUND_Y;
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    const y = horizonY + (baseY - horizonY) * t * t;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.WIDTH, y);
    ctx.stroke();
  }
  for (let i = -6; i <= 6; i += 1) {
    const x0 = WORLD.WIDTH / 2 + i * 24;
    ctx.beginPath();
    ctx.moveTo(WORLD.WIDTH / 2, horizonY);
    ctx.lineTo(x0 * 1.9, baseY);
    ctx.stroke();
  }

  // 星点
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 40; i += 1) {
    const sx = ((i * 137.5) % WORLD.WIDTH);
    const sy = ((i * 61.3) % 300);
    const tw = 0.5 + 0.5 * Math.sin(time * 1.5 + i);
    ctx.globalAlpha = 0.2 + 0.5 * tw;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let floaters = [];
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(WORLD.WIDTH * dpr);
    canvas.height = Math.floor(WORLD.HEIGHT * dpr);
    canvas.style.width = `${WORLD.WIDTH}px`;
    canvas.style.height = `${WORLD.HEIGHT}px`;
  }

  function fx(event) {
    const type = event.type;
    if (type === 'hit' || type === 'enemyHit' || type === 'crit') {
      const isCrit = type === 'crit';
      const cx = event.who === 'other' ? WORLD.SELF_X : WORLD.OTHER_X;
      const cy = 380;
      for (let i = 0; i < (isCrit ? 16 : 9); i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 120 + Math.random() * 200;
        particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.5, color: isCrit ? PAL.crit : PAL.hit });
      }
      if (isCrit) floaters.push({ x: cx, y: cy - 60, text: 'CRIT', life: 0.9, color: PAL.crit });
      else floaters.push({ x: cx, y: cy - 50, text: `-${event.attack ?? ''}`, life: 0.7, color: '#fff' });
    } else if (type === 'clash') {
      for (let i = 0; i < 10; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 160;
        particles.push({ x: event.x, y: event.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, color: PAL.orb });
      }
    } else if (type === 'orbTaken') {
      for (let i = 0; i < 12; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 140;
        particles.push({ x: WORLD.WIDTH / 2, y: 420, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, color: PAL.orb });
      }
    } else if (type === 'heal') {
      floaters.push({ x: event.who === 'other' ? WORLD.OTHER_X : WORLD.SELF_X, y: 320, text: `+${event.amount}`, life: 0.9, color: '#4ade80' });
    }
  }

  function stepFx(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const f of floaters) {
      f.life -= dt;
      f.y -= 40 * dt;
    }
    floaters = floaters.filter((f) => f.life > 0);
  }

  function render(run, view = {}) {
    if (!run) return;
    const st = run.state;
    const time = view.time ?? st.time;
    const reduced = view.reducedMotion === true;
    if (reduced) particles = [];

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(ctx, time);

    // 星陨石
    for (const o of st.orbs) drawOrb(ctx, o, time);

    // 飞行剑刃
    for (const p of st.projectiles) if (p.lag <= 0) drawBlade(ctx, p, time);

    // 斗士
    const selfAttack = view.selfAttackT != null ? view.selfAttackT : 0;
    const otherAttack = view.otherAttackT != null ? view.otherAttackT : 0;
    drawFighter(ctx, WORLD.SELF_X, WORLD.GROUND_Y, {
      color: PAL.self, core: PAL.selfCore, facing: 1, attack: selfAttack,
      dodging: st.self.dodging > st.time, buff: st.self.buff && st.self.buff.until > st.time,
      poison: st.self.poison && st.self.poison.until > st.time, horned: false, t: time,
    });
    drawFighter(ctx, WORLD.OTHER_X, WORLD.GROUND_Y, {
      color: PAL.other, core: PAL.otherCore, facing: -1, attack: otherAttack,
      dodging: st.other.dodging > st.time, buff: st.other.buff && st.other.buff.until > st.time,
      poison: st.other.poison && st.other.poison.until > st.time, horned: true, t: time,
    });

    // 粒子
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, f.life / 0.7);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  return { render, fx, stepFx, resize };
}
