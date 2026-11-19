// APACHE TRAIL · Canvas 2D 渲染（低多边形扁平 / 落日峡谷风）。
// 全部程序化，无素材文件。draw(state, dt)：state 为 run.state 或 null（标题背景）。
import { WORLD, PLAYER } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const PAL = {
  skyTop: '#2b1a4a',
  skyMid: '#a84a63',
  skyHorizon: '#f2a65a',
  mesaFar: '#6b3550',
  mesaNear: '#4a2438',
  groundTop: '#c0694a',
  groundLow: '#8a4636',
  platTop: '#d07a55',
  platBody: '#a04a3a',
  crystal: '#ffd24a',
  crystalCore: '#fff3c4',
  shield: '#7fe0d0',
  shieldCore: '#e8fffb',
  time: '#ff9d3f',
  spike: '#e5484d',
  saw: '#cfd2d6',
  sawCore: '#e5484d',
  boulder: '#8a8f98',
  boulderEdge: '#b6bcc4',
  fire: '#ff7b3d',
  fireCore: '#ffd24a',
  tumble: '#d94f3d',
  spring: '#ffd24a',
  playerBody: '#ff8c42',
  playerBelly: '#ffe0b0',
  playerHead: '#ff6b3d',
  playerLeg: '#7a3b52',
  playerBeak: '#ffd24a',
  playerEye: '#1f1a2e',
  endFlag: '#ffd24a',
  endPole: '#7a3b52',
  endGlow: '#7fe0d0',
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

function glowCircle(ctx, x, y, r, color, alpha = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let t = 0;
  let shake = 0;
  const particles = [];

  function spawn(x, y, color, n = 6, life = 0.5, speed = 60) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      particles.push({
        x, y,
        vx: Math.cos(a) * speed * (0.4 + Math.random() * 0.8),
        vy: Math.sin(a) * speed * (0.4 + Math.random() * 0.8) - 20,
        life,
        max: life,
        color,
        r: 2 + Math.random() * 3,
      });
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }

  // ---------- 背景 ----------
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, PAL.skyTop);
    g.addColorStop(0.45, PAL.skyMid);
    g.addColorStop(0.72, PAL.skyHorizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 落日
    glowCircle(ctx, 1020, 150, 90, '#ffd24a', 0.9);
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(1020, 150, 42, 0, TAU);
    ctx.fill();
  }

  function drawMesas() {
    // 远景山
    ctx.fillStyle = PAL.mesaFar;
    ctx.beginPath();
    ctx.moveTo(0, 430);
    ctx.lineTo(140, 340);
    ctx.lineTo(300, 420);
    ctx.lineTo(460, 330);
    ctx.lineTo(640, 430);
    ctx.lineTo(860, 350);
    ctx.lineTo(1040, 420);
    ctx.lineTo(1280, 340);
    ctx.lineTo(1280, 660);
    ctx.lineTo(0, 660);
    ctx.closePath();
    ctx.fill();
    // 近景山
    ctx.fillStyle = PAL.mesaNear;
    ctx.beginPath();
    ctx.moveTo(0, 500);
    ctx.lineTo(200, 420);
    ctx.lineTo(430, 500);
    ctx.lineTo(700, 430);
    ctx.lineTo(980, 500);
    ctx.lineTo(1280, 440);
    ctx.lineTo(1280, 660);
    ctx.lineTo(0, 660);
    ctx.closePath();
    ctx.fill();
  }

  function drawGroundTop() {
    ctx.fillStyle = PAL.groundTop;
    ctx.fillRect(0, 640, WORLD.WIDTH, 80);
  }

  // ---------- 平台 ----------
  function drawPlatform(p) {
    ctx.fillStyle = PAL.platBody;
    roundRect(ctx, p.x, p.y, p.w, p.h, 6);
    ctx.fill();
    ctx.fillStyle = PAL.platTop;
    roundRect(ctx, p.x, p.y, p.w, Math.min(14, p.h), 6);
    ctx.fill();
    // 岩石纹理缝
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    for (let x = p.x + 28; x < p.x + p.w - 10; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, p.y + 10);
      ctx.lineTo(x - 8, p.y + p.h);
      ctx.stroke();
    }
  }

  // ---------- 终点图腾 ----------
  function drawEnd(level) {
    const ex = level.end.x;
    const ey = level.end.y;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    glowCircle(ctx, ex, ey - 60, 70 + pulse * 14, PAL.endGlow, 0.55);
    // 图腾柱
    ctx.fillStyle = PAL.endPole;
    roundRect(ctx, ex - 14, ey - 110, 28, 110, 6);
    ctx.fill();
    // 发光顶部菱形
    ctx.fillStyle = PAL.endFlag;
    ctx.save();
    ctx.translate(ex, ey - 122);
    ctx.rotate(t * 0.8);
    ctx.fillRect(-12, -12, 24, 24);
    ctx.restore();
    // 旗帜
    ctx.fillStyle = PAL.endFlag;
    ctx.beginPath();
    ctx.moveTo(ex + 14, ey - 104);
    ctx.lineTo(ex + 62 + pulse * 6, ey - 96);
    ctx.lineTo(ex + 14, ey - 80);
    ctx.closePath();
    ctx.fill();
    // GOAL 标签
    ctx.fillStyle = '#fff6df';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GOAL', ex, ey + 26);
  }

  // ---------- 水晶 ----------
  function drawCrystal(c) {
    if (c._got) return;
    const cx = c.x;
    const cy = c.y + Math.sin(t * 4 + cx) * 3;
    glowCircle(ctx, cx, cy, 18, PAL.crystal, 0.6);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PAL.crystal;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = PAL.crystalCore;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }

  // ---------- 道具 ----------
  function drawPowerup(pu) {
    if (pu._got) return;
    const cx = pu.x;
    const cy = pu.y + Math.sin(t * 3 + cx) * 4;
    if (pu.type === 'shield') {
      glowCircle(ctx, cx, cy, 20, PAL.shield, 0.65);
      ctx.strokeStyle = PAL.shield;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = PAL.shieldCore;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, TAU);
      ctx.fill();
    } else if (pu.type === 'time') {
      glowCircle(ctx, cx, cy, 20, PAL.time, 0.6);
      ctx.fillStyle = PAL.time;
      roundRect(ctx, cx - 10, cy - 10, 20, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 1, cy - 7, 3, 7);
      ctx.fillRect(cx - 1, cy + 1, 3, 5);
    }
  }

  // ---------- 机关 ----------
  function moverRect(h) {
    if (h.p1 || h.p2) {
      const period = Math.max(0.01, h.period || 2);
      const tt = ((t + (h.phase || 0)) % period) / period;
      const k = tt < 0.5 ? tt * 2 : (1 - tt) * 2;
      return {
        x: h.p1.x + (h.p2.x - h.p1.x) * k,
        y: h.p1.y + (h.p2.y - h.p1.y) * k,
        w: h.w,
        h: h.h,
      };
    }
    return { x: h.x, y: h.y, w: h.w, h: h.h };
  }

  function drawHazards(level) {
    for (const h of level.hazards) {
      const r = moverRect(h);
      if (h.type === 'spike') {
        ctx.fillStyle = PAL.spike;
        const n = Math.floor(r.w / 12);
        for (let i = 0; i < n; i += 1) {
          const x0 = r.x + i * (r.w / n);
          ctx.beginPath();
          ctx.moveTo(x0, r.y + r.h);
          ctx.lineTo(x0 + (r.w / n) / 2, r.y);
          ctx.lineTo(x0 + r.w / n, r.y + r.h);
          ctx.closePath();
          ctx.fill();
        }
      } else if (h.type === 'saw') {
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        ctx.fillStyle = PAL.saw;
        ctx.beginPath();
        ctx.arc(cx, cy, r.w / 2, 0, TAU);
        ctx.fill();
        // 锯齿
        ctx.fillStyle = PAL.sawCore;
        for (let i = 0; i < 8; i += 1) {
          const a = t * 6 + (i / 8) * TAU;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r.w * 0.5, cy + Math.sin(a) * r.w * 0.5);
          ctx.lineTo(cx + Math.cos(a + 0.12) * r.w * 0.28, cy + Math.sin(a + 0.12) * r.w * 0.28);
          ctx.lineTo(cx + Math.cos(a - 0.12) * r.w * 0.28, cy + Math.sin(a - 0.12) * r.w * 0.28);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = PAL.saw;
        ctx.beginPath();
        ctx.arc(cx, cy, r.w * 0.16, 0, TAU);
        ctx.fill();
      } else if (h.type === 'boulder') {
        ctx.fillStyle = PAL.boulder;
        roundRect(ctx, r.x, r.y, r.w, r.h, 14);
        ctx.fill();
        ctx.fillStyle = PAL.boulderEdge;
        ctx.beginPath();
        ctx.arc(r.x + r.w * 0.35, r.y + r.h * 0.38, r.w * 0.22, 0, TAU);
        ctx.fill();
      } else if (h.type === 'fire') {
        // 喷口
        ctx.fillStyle = '#5a2a34';
        roundRect(ctx, r.x, r.y, r.w, r.h, 3);
        ctx.fill();
        // 火焰（活动时）
        const cycle = (h.interval || 2) + (h.duration || 2);
        const active = ((t + (h.phase || 0)) % cycle) >= (h.interval || 2);
        if (active) {
          const flick = Math.sin(t * 22) * 6;
          ctx.fillStyle = PAL.fire;
          ctx.beginPath();
          ctx.moveTo(r.x + 2, r.y);
          ctx.quadraticCurveTo(r.x + r.w / 2, r.y - 52 - flick, r.x + r.w - 2, r.y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = PAL.fireCore;
          ctx.beginPath();
          ctx.moveTo(r.x + r.w * 0.28, r.y);
          ctx.quadraticCurveTo(r.x + r.w / 2, r.y - 30 - flick, r.x + r.w * 0.72, r.y);
          ctx.closePath();
          ctx.fill();
        }
      } else if (h.type === 'tumble') {
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 3);
        ctx.fillStyle = PAL.tumble;
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * TAU;
          const rr = i % 2 === 0 ? r.w * 0.5 : r.w * 0.3;
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f0a08a';
        ctx.beginPath();
        ctx.arc(0, 0, r.w * 0.16, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ---------- 弹簧 / 风 ----------
  function drawSprings(level) {
    for (const s of level.springs) {
      ctx.strokeStyle = PAL.spring;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 4; i += 1) {
        const y = s.y + s.h - i * (s.h / 4);
        ctx.moveTo(s.x + 4, y);
        ctx.lineTo(s.x + s.w - 4, y - s.h / 8);
      }
      ctx.stroke();
    }
  }

  function drawWinds(level) {
    for (const w of level.winds) {
      const cycle = (w.interval || 2) + (w.duration || 2);
      const active = ((t + (w.phase || 0)) % cycle) >= (w.interval || 2);
      ctx.fillStyle = active ? 'rgba(160, 220, 255, 0.35)' : 'rgba(160, 220, 255, 0.12)';
      roundRect(ctx, w.x, w.y, w.w, w.h, 8);
      ctx.fill();
      // 风扇叶片
      const cx = w.x + w.w / 2;
      const cy = w.y + w.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (active ? 10 : 1));
      ctx.fillStyle = '#cfd2d6';
      for (let i = 0; i < 3; i += 1) {
        ctx.rotate(TAU / 3);
        ctx.beginPath();
        ctx.ellipse(0, -w.h * 0.3, 6, w.h * 0.3, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---------- 玩家（公路跑者小鸟） ----------
  function drawPlayer(p) {
    if (!p || p.state === 'dead') return;
    const blink = p.invuln > 0 && Math.floor(t * 20) % 2 === 0;
    if (blink) return;

    const cx = p.x + PLAYER.W / 2;
    const feetY = p.y + PLAYER.H;
    const dir = p.facing;

    // 护盾环
    if (p.shield > 0) {
      ctx.strokeStyle = PAL.shield;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 5);
      ctx.beginPath();
      ctx.arc(cx, p.y + PLAYER.H / 2, 34, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(cx, feetY);
    ctx.scale(dir, 1);

    // 腿（跑动摆腿）
    const runPhase = p.state === 'run' ? Math.sin(t * 16) * 7 : 0;
    ctx.strokeStyle = PAL.playerLeg;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -PLAYER.H + 6);
    ctx.lineTo(-6 + runPhase, -2);
    ctx.moveTo(0, -PLAYER.H + 6);
    ctx.lineTo(6 - runPhase, -2);
    ctx.stroke();

    // 身体（椭圆，低多边形感用圆角）
    const squash = p.state === 'jump' || p.state === 'doubleJump' ? 1.06 : p.state === 'fall' ? 0.94 : 1;
    ctx.fillStyle = PAL.playerBody;
    ctx.beginPath();
    ctx.ellipse(0, -PLAYER.H * 0.5, PLAYER.W * 0.55 * squash, PLAYER.H * 0.42, 0, 0, TAU);
    ctx.fill();
    // 肚皮
    ctx.fillStyle = PAL.playerBelly;
    ctx.beginPath();
    ctx.ellipse(2, -PLAYER.H * 0.42, PLAYER.W * 0.3, PLAYER.H * 0.26, 0, 0, TAU);
    ctx.fill();
    // 头
    ctx.fillStyle = PAL.playerHead;
    ctx.beginPath();
    ctx.arc(8, -PLAYER.H - 4, 11, 0, TAU);
    ctx.fill();
    // 喙
    ctx.fillStyle = PAL.playerBeak;
    ctx.beginPath();
    ctx.moveTo(16, -PLAYER.H - 6);
    ctx.lineTo(28, -PLAYER.H - 2);
    ctx.lineTo(16, -PLAYER.H + 0);
    ctx.closePath();
    ctx.fill();
    // 眼睛
    ctx.fillStyle = PAL.playerEye;
    ctx.beginPath();
    ctx.arc(12, -PLAYER.H - 7, 2.4, 0, TAU);
    ctx.fill();
    // 尾羽
    ctx.fillStyle = PAL.playerBody;
    ctx.beginPath();
    ctx.moveTo(-PLAYER.W * 0.5, -PLAYER.H * 0.6);
    ctx.lineTo(-PLAYER.W * 0.85, -PLAYER.H * 0.75);
    ctx.lineTo(-PLAYER.W * 0.5, -PLAYER.H * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ---------- 粒子 ----------
  function drawParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.life -= dt;
      if (p.life <= 0) continue;
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
  }

  function draw(state, dt, view = {}) {
    t += dt;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake = Math.max(0, shake - dt * 60);
    }

    drawSky();
    drawMesas();
    drawGroundTop();

    const level = state ? LEVELS[state.levelIndex] : LEVELS[0];
    for (const p of level.platforms) drawPlatform(p);
    drawEnd(level);
    drawSprings(level);
    drawWinds(level);
    for (const c of level.crystals) drawCrystal(c);
    for (const pu of level.powerups) drawPowerup(pu);
    drawHazards(level);

    drawPlayer(state ? state.player : null);
    drawParticles(dt);

    ctx.restore();
  }

  return {
    draw,
    spawn,
    shake: (amt) => { shake = Math.max(shake, amt); },
    debugLayout() {
      return { canvas: { w: WORLD.WIDTH, h: WORLD.HEIGHT } };
    },
  };
}
