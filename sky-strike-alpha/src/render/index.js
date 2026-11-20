// SKY STRIKE ALPHA · Canvas 2D 渲染（霓虹街机风，全程序化，零素材）
// 职责：星野视差背景 + 合成波网格地平线、闸门/陨石/核心/护盾、玩家战机、粒子层。
// 玩家是画面里最亮（白/青 + 强辉光）的剪影，障碍用洋红/橙区分。
import { WORLD, GAME } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 调色板（霓虹街机统一）
const PAL = {
  skyTop: '#07030f',
  skyMid: '#1a0b2e',
  skyBot: '#2b0f3e',
  horizon: '#ff2e88',
  grid: 'rgba(120, 60, 200, 0.5)',
  gateEdge: '#ff2e88',
  gateFill: 'rgba(255, 46, 136, 0.18)',
  gateCore: '#ffd1e6',
  rock: '#ff9f1c',
  rockDark: '#6b3400',
  core: '#39f7ff',
  coreHi: '#ffffff',
  shield: '#2dffb0',
  player: '#ffffff',
  playerGlow: '#39f7ff',
  playerAccent: '#ff2e88',
  exhaust: '#ff7a2e',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = clamp(window.devicePixelRatio || 1, 1, GAME.DPR_MAX);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  // 不设内联 style 宽高：让 styles.css 的 `canvas { width:100%; height:100% }` 负责响应式缩放，
  // 否则内联 1280px 会在移动端溢出容器（container max-width:100vw）导致画面被裁到只剩左半。
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  // 视差星野（固定种子，环绕）
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    const seed = (i * 2654435761) % 4294967296;
    stars.push({
      x: ((seed % 1000) / 1000) * WORLD.WIDTH,
      y: (((seed >> 8) % 1000) / 1000) * WORLD.HEIGHT,
      z: 0.3 + ((seed >> 16) % 1000) / 1000 * 0.7, // 0.3..1.0
    });
  }

  let scroll = 0;
  let time = 0;
  const particles = [];

  function spawnParticle(p) {
    if (particles.length > 320) particles.shift();
    particles.push({ ...p, life: p.life ?? 0.6, ttl: p.life ?? 0.6 });
  }

  function drawBackground(speed) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, PAL.skyTop);
    g.addColorStop(0.55, PAL.skyMid);
    g.addColorStop(1, PAL.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星野（近的星更快）
    for (const s of stars) {
      const sx = (s.x - scroll * s.z) % WORLD.WIDTH;
      const x = sx < 0 ? sx + WORLD.WIDTH : sx;
      const a = 0.25 + s.z * 0.75;
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      const r = s.z > 0.8 ? 1.6 : 1.0;
      ctx.fillRect(x, s.y, r, r);
    }

    // 合成波网格地平线
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i += 1) {
      const y = WORLD.HEIGHT - 30 - i * i * 8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
    for (let i = 0; i < 14; i += 1) {
      const x = ((i * 120 - scroll * 1.4) % (WORLD.WIDTH + 120));
      const gx = x < 0 ? x + WORLD.WIDTH + 120 : x;
      ctx.beginPath();
      ctx.moveTo(gx, WORLD.HEIGHT - 30);
      ctx.lineTo(gx + 40, WORLD.HEIGHT);
      ctx.stroke();
    }
    // 地平线霓虹带
    ctx.fillStyle = PAL.horizon;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(0, WORLD.HEIGHT - 4, WORLD.WIDTH, 4);
    ctx.globalAlpha = 1;
  }

  function glow(color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function drawGate(o) {
    const top = o.gapY - o.gap / 2;
    const bot = o.gapY + o.gap / 2;
    const w = o.halfW * 2;
    const x = o.x - o.halfW;
    // 上闸 / 下闸（从 HUD 下方开始，避免与 HUD 视觉重叠）
    drawBar(x, GAME.CEIL_Y, w, Math.max(0, top - GAME.CEIL_Y));
    drawBar(x, bot, w, WORLD.HEIGHT - bot);
    // 缝隙边缘亮线
    glow(PAL.gateCore, 12);
    ctx.fillStyle = PAL.gateCore;
    ctx.fillRect(x - 2, top - 3, w + 4, 3);
    ctx.fillRect(x - 2, bot, w + 4, 3);
    glow('transparent', 0);
    drawGapChevrons(o.x, top, bot);
  }

  function drawBar(x, y, w, h) {
    if (h <= 0) return;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(255,46,136,0.9)');
    g.addColorStop(0.5, PAL.gateFill);
    g.addColorStop(1, 'rgba(255,46,136,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PAL.gateEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, Math.max(0, h - 2));
    // 内部能量条纹
    ctx.fillStyle = 'rgba(255,209,230,0.25)';
    for (let yy = y + 8; yy < y + h - 8; yy += 22) ctx.fillRect(x + 4, yy, w - 8, 5);
  }

  function drawRock(o) {
    const top = o.gapY - o.gap / 2;
    const bot = o.gapY + o.gap / 2;
    const w = o.halfW * 2;
    const x = o.x - o.halfW;
    drawRockBar(x, GAME.CEIL_Y, w, Math.max(0, top - GAME.CEIL_Y));
    drawRockBar(x, bot, w, WORLD.HEIGHT - bot);
    // 缝隙边缘提示
    glow(PAL.rock, 10);
    ctx.fillStyle = PAL.rock;
    ctx.fillRect(x - 2, top - 3, w + 4, 3);
    ctx.fillRect(x - 2, bot, w + 4, 3);
    glow('transparent', 0);
    drawGapChevrons(o.x, top, bot);
  }

  // 岩石墙：橙色岩体 + 左缘锯齿 + 陨石坑，视觉上仍是「要避开的墙」
  function drawRockBar(x, y, w, h) {
    if (h <= 0) return;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ff9f1c');
    g.addColorStop(0.5, '#b34a12');
    g.addColorStop(1, '#6b3400');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // 左缘锯齿
    ctx.fillStyle = PAL.rockDark;
    ctx.beginPath();
    for (let yy = y; yy < y + h; yy += 26) {
      ctx.moveTo(x, yy);
      ctx.lineTo(x - 8, yy + 13);
      ctx.lineTo(x, yy + 26);
    }
    ctx.fill();
    // 陨石坑
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let yy = y + 14; yy < y + h - 8; yy += 36) {
      ctx.beginPath();
      ctx.arc(x + w * 0.6, yy, 7, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,159,28,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, Math.max(0, h - 2));
  }

  // 缝隙引导箭头：两道右指 chevron 标出「从这里穿过」
  function drawGapChevrons(x, top, bot) {
    const cy = (top + bot) / 2;
    const pulse = 1 + Math.sin(time * 7) * 0.15;
    glow(PAL.core, 14);
    ctx.strokeStyle = PAL.core;
    ctx.lineWidth = 4 * pulse;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 16, cy - 14);
    ctx.lineTo(x - 4, cy);
    ctx.lineTo(x - 16, cy + 14);
    ctx.stroke();
    ctx.strokeStyle = PAL.coreHi;
    ctx.lineWidth = 3 * pulse;
    ctx.beginPath();
    ctx.moveTo(x - 27, cy - 20);
    ctx.lineTo(x - 14, cy);
    ctx.lineTo(x - 27, cy + 20);
    ctx.stroke();
    glow('transparent', 0);
  }

  function drawCore(c) {
    const pulse = 1 + Math.sin(time * 6 + c.x * 0.1) * 0.15;
    const R = c.r * 1.5 * pulse;
    // 金币：通用「可拾取」语言（金圆 + 内圈 + 高光），与粉色闸门/橙色岩墙明确区分
    glow('#ffd23e', 16);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(c.x, c.y, R, 0, TAU);
    ctx.fill();
    glow('transparent', 0);
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, R * 0.66, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c.x - R * 0.3, c.y - R * 0.3, R * 0.22, 0, TAU);
    ctx.fill();
  }

  function drawShieldPick(s) {
    glow(PAL.shield, 16);
    ctx.strokeStyle = PAL.shield;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 16, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s.x, s.y, 9, time * 2, time * 2 + Math.PI);
    ctx.stroke();
    glow('transparent', 0);
  }

  function drawPlayer(p, shieldHits) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt * 0.28);
    // 引擎尾焰
    const trail = 14 + Math.abs(p.vy) * 0.05;
    glow(PAL.exhaust, 14);
    ctx.fillStyle = PAL.exhaust;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-16 - trail, -5);
    ctx.lineTo(-16 - trail * 0.7, 0);
    ctx.lineTo(-16 - trail, 5);
    ctx.closePath();
    ctx.fill();
    glow('transparent', 0);
    // 机身
    glow(PAL.playerGlow, 20);
    ctx.fillStyle = PAL.player;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -13);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-14, 13);
    ctx.closePath();
    ctx.fill();
    glow('transparent', 0);
    // 座舱 + 翼尖
    ctx.fillStyle = PAL.playerAccent;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-8, -6);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.playerGlow;
    ctx.fillRect(-14, -1, 4, 2);
    ctx.fillRect(-2, -13, 6, 2);
    ctx.fillRect(-2, 11, 6, 2);
    ctx.restore();

    // 护盾光环
    if (shieldHits > 0) {
      glow(PAL.shield, 18);
      ctx.strokeStyle = PAL.shield;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 + Math.sin(time * 5) * 3, 0, TAU);
      ctx.stroke();
      glow('transparent', 0);
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const pt = particles[i];
      pt.ttl -= dt;
      if (pt.ttl <= 0) { particles.splice(i, 1); continue; }
      const k = pt.ttl / pt.life;
      pt.x += (pt.vx || 0) * dt;
      pt.y += (pt.vy || 0) * dt;
      ctx.globalAlpha = k;
      ctx.fillStyle = pt.color;
      if (pt.kind === 'streak') {
        ctx.fillRect(pt.x - pt.len, pt.y - 1, pt.len, 2);
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * (pt.ttl / pt.life), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function emitFx(queue) {
    for (const fx of queue) {
      switch (fx.type) {
        case 'engine': {
          const p = fx.p;
          spawnParticle({ kind: 'streak', x: p.x - 18, y: p.y, vx: -160 - Math.abs(p.vy), vy: (Math.random() - 0.5) * 20, color: PAL.exhaust, len: 10 + Math.random() * 8, life: 0.4 });
          break;
        }
        case 'score': {
          const { x, y } = fx;
          for (let i = 0; i < 8; i += 1) {
            const a = (i / 8) * TAU;
            spawnParticle({ x, y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, color: PAL.core, r: 3, life: 0.4 });
          }
          break;
        }
        case 'shieldGot': {
          for (let i = 0; i < 14; i += 1) {
            const a = (i / 14) * TAU;
            spawnParticle({ x: fx.x, y: fx.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, color: PAL.shield, r: 3, life: 0.5 });
          }
          break;
        }
        case 'nearMiss': {
          spawnParticle({ kind: 'streak', x: fx.x, y: fx.y, vx: -300, vy: 0, color: PAL.gateCore, len: 30, life: 0.3 });
          break;
        }
        case 'shieldBlock': {
          for (let i = 0; i < 16; i += 1) {
            const a = (i / 16) * TAU;
            spawnParticle({ x: fx.x, y: fx.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, color: PAL.shield, r: 3.5, life: 0.5 });
          }
          break;
        }
        case 'explode': {
          for (let i = 0; i < 30; i += 1) {
            const a = Math.random() * TAU;
            const sp = 80 + Math.random() * 220;
            spawnParticle({ x: fx.x, y: fx.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color: i % 2 ? PAL.exhaust : PAL.gateEdge, r: 2 + Math.random() * 3, life: 0.6 });
          }
          break;
        }
        default:
          break;
      }
    }
  }

  function draw(state, dt, view) {
    const speed = state ? (LEVELS[state.level - 1]?.scroll ?? 240) : 120;
    time += dt;
    scroll = (scroll + speed * dt * 0.4) % WORLD.WIDTH;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (view && view.shake > 0) {
      ctx.translate((Math.random() - 0.5) * view.shake * 2, (Math.random() - 0.5) * view.shake * 2);
    }
    drawBackground(speed);

    if (state) {
      for (const o of state.obstacles) {
        if (o.removed) continue;
        if (o.kind === 'rock') drawRock(o);
        else drawGate(o);
        if (o.core && !o.core.collected) drawCore({ x: o.x, y: o.gapY + o.core.offsetY, r: o.core.r });
        if (o.shieldPick && !o.shieldPick.collected) drawShieldPick({ x: o.x, y: o.gapY });
      }
      drawPlayer(state.player, state.shieldHits);
    }

    if (view) emitFx(view.fxQueue);
    drawParticles(dt);
  }

  function debugLayout() {
    return {
      playfield: { x: 0, y: WORLD.HUD_H, w: WORLD.WIDTH, h: WORLD.HEIGHT - WORLD.HUD_H },
      gap: { x: GAME.PLAYER_X, y: WORLD.HEIGHT / 2, w: 200, h: 200 },
    };
  }

  return { draw, debugLayout, spawnParticle };
}
