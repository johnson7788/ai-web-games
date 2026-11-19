// src/render/index.js — Canvas2D 深空星云弹珠台渲染（零依赖，纯程序化）
// 契约：createRender(canvas) → { draw(run, alpha), burst(x, y, kind), tick(now), particles }
import { WORLD } from '../../config/game.config.js';
import { LAUNCH, REACTOR, SUPERNOVA } from '../../config/gameplay.js';
import { THEME } from './theme.js';

function glow(ctx, x, y, r, color, alpha = 0.9) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function circle(ctx, x, y, r, fill, stroke, lw = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function flipperTip(f) {
  return { x: f.px + Math.cos(f.angle) * f.len, y: f.py + Math.sin(f.angle) * f.len };
}

// 深空星点背景（确定性伪随机，避免每次重绘闪烁）
const STARS = [];
{
  let s = 42;
  for (let i = 0; i < 90; i += 1) {
    s = (s * 16807) % 2147483647;
    STARS.push({ x: (s % 10000) / 10000 * WORLD.WIDTH, y: ((s >> 7) % 10000) / 10000 * WORLD.HEIGHT, r: 0.5 + ((s >> 13) % 100) / 80, tw: ((s >> 5) % 100) / 100 });
  }
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];

  function burst(x, y, kind) {
    const colors = kind === 'super' ? ['#eaffff', '#41e6ff', '#ffffff']
      : kind === 'gold' ? ['#ffe082', '#ffb347', '#fff2cc']
      : kind === 'reactor' ? ['#ff4cd8', '#ffe082', '#ffffff']
      : ['#41e6ff', '#ff4cd8', '#ffffff'];
    for (let i = 0; i < 12; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 320;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.4, max: 0.9, color: colors[i % colors.length] });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) if (particles[i].life <= 0) particles.splice(i, 1);
  }

  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, t.bgTop);
    g.addColorStop(1, t.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 星点
    ctx.fillStyle = '#cfefff';
    for (const st of STARS) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(st.tw * 6.28 + performance.now() * 0.001);
      ctx.fillRect(st.x, st.y, st.r, st.r);
    }
    ctx.globalAlpha = 1;
    // 星云光晕
    glow(ctx, 240, 140, 260, 'rgba(92,124,255,0.35)', 0.6);
    glow(ctx, 1040, 180, 260, 'rgba(255,76,216,0.25)', 0.55);
    glow(ctx, 640, 620, 320, 'rgba(47,214,255,0.16)', 0.5);
  }

  function drawPanels(t) {
    ctx.fillStyle = t.panel;
    ctx.fillRect(0, 0, WORLD.PF_LEFT, WORLD.HEIGHT);
    ctx.fillRect(WORLD.PF_RIGHT, 0, WORLD.WIDTH - WORLD.PF_RIGHT, WORLD.HEIGHT);
    ctx.strokeStyle = t.frameDim;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(WORLD.PF_LEFT, 0); ctx.lineTo(WORLD.PF_LEFT, WORLD.HEIGHT); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(WORLD.PF_RIGHT, 0); ctx.lineTo(WORLD.PF_RIGHT, WORLD.HEIGHT); ctx.stroke();
    ctx.strokeStyle = t.grid;
    for (let y = 40; y < WORLD.HEIGHT; y += 60) {
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(WORLD.PF_LEFT - 20, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(WORLD.PF_RIGHT + 20, y); ctx.lineTo(WORLD.WIDTH - 20, y); ctx.stroke();
    }
  }

  function drawFrame(t) {
    ctx.strokeStyle = t.frame;
    ctx.lineWidth = 4;
    ctx.shadowColor = t.frame;
    ctx.shadowBlur = 18;
    ctx.strokeRect(WORLD.PF_LEFT, WORLD.PF_TOP, WORLD.PF_RIGHT - WORLD.PF_LEFT, WORLD.PF_BOTTOM - WORLD.PF_TOP);
    ctx.shadowBlur = 0;
  }

  function drawSegments(t, run) {
    for (const s of run.table.segments) {
      if (s.kind === 'launchpad') continue;
      ctx.strokeStyle = s.kind === 'deflector' ? t.deflector : t.frameDim;
      ctx.lineWidth = s.kind === 'deflector' ? 5 : 3;
      ctx.shadowColor = s.kind === 'deflector' ? t.deflector : t.frame;
      ctx.shadowBlur = s.kind === 'deflector' ? 8 : 0;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // 发射台
    for (const s of run.table.segments) {
      if (s.kind !== 'launchpad') continue;
      ctx.strokeStyle = t.launchpad;
      ctx.lineWidth = 5;
      ctx.shadowColor = t.launchpad;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawFlippers(t, run) {
    for (const f of run.flippers) {
      const tip = flipperTip(f);
      const chargeGlow = 1 + f.charge * 1.6;
      ctx.strokeStyle = t.cyan;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.shadowColor = t.cyan;
      ctx.shadowBlur = 10 * chargeGlow;
      ctx.beginPath();
      ctx.moveTo(f.px, f.py);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      circle(ctx, f.px, f.py, 7, t.cyan, null);
      if (f.charge > 0.05) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(f.px - 20, f.py - 26, 40, 6);
        ctx.fillStyle = t.cyan;
        ctx.fillRect(f.px - 20, f.py - 26, 40 * f.charge, 6);
      }
    }
  }

  function drawBumpers(t, run) {
    const superOn = run.supernovaT > 0;
    for (const bp of run.table.bumpers) {
      const col = superOn ? '#eaffff' : t.bumper;
      glow(ctx, bp.x, bp.y, bp.r * 2.2, col, 0.5);
      circle(ctx, bp.x, bp.y, bp.r, superOn ? '#cfefff' : 'rgba(0,0,0,0.25)', col, 3);
      circle(ctx, bp.x, bp.y, bp.r * 0.45, col, null);
    }
  }

  function drawReactor(t, run) {
    const rc = run.table.reactor;
    const col = run.supernovaT > 0 ? '#eaffff' : t.reactor;
    glow(ctx, rc.x, rc.y, rc.r * 1.9, col, 0.55);
    circle(ctx, rc.x, rc.y, rc.r, 'rgba(6,2,18,0.6)', col, 3);
    // 点灯分段
    for (let i = 0; i < REACTOR.LIGHTS; i += 1) {
      const a = -Math.PI / 2 + (i / REACTOR.LIGHTS) * Math.PI * 2;
      const lit = i < run.reactorLights;
      const lx = rc.x + Math.cos(a) * (rc.r * 0.62);
      const ly = rc.y + Math.sin(a) * (rc.r * 0.62);
      circle(ctx, lx, ly, 6, lit ? t.reactorLit : 'rgba(0,0,0,0.4)', lit ? t.reactorLit : t.frameDim, lit ? 0 : 1.5);
    }
    circle(ctx, rc.x, rc.y, 9, col, null);
  }

  function drawBlackHole(t, run) {
    for (const bh of run.table.blackHoles) {
      glow(ctx, bh.x, bh.y, bh.r * 2.4, t.blackholeRing, 0.7);
      circle(ctx, bh.x, bh.y, bh.r, t.blackhole, t.blackholeRing, 3);
      // 旋转吸积环
      ctx.strokeStyle = t.blackholeRing;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, bh.r + 5, run.time * 2, run.time * 2 + Math.PI * 1.4);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawPortal(t, run) {
    const p = run.table.portal;
    circle(ctx, p.in.x, p.in.y, p.in.r, 'rgba(0,0,0,0.3)', t.portal, 3);
    ctx.strokeStyle = t.portal;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(p.in.x, p.in.y, p.in.r, run.time * 3, run.time * 3 + Math.PI * 1.6); ctx.stroke();
    ctx.setLineDash([]);
    // 出口
    circle(ctx, p.out.x, p.out.y, p.out.r, 'rgba(0,0,0,0.3)', t.portal, 3);
    circle(ctx, p.out.x, p.out.y, 5, t.portal, null);
  }

  function drawButtons(t, run) {
    for (const b of run.buttons) {
      const col = b.pressed ? t.buttonPressed : t.button;
      glow(ctx, b.x, b.y, b.pressed ? 20 : 14, col, b.pressed ? 0.8 : 0.4);
      circle(ctx, b.x, b.y, b.r, b.pressed ? col : 'rgba(0,0,0,0.3)', col, 2.5);
    }
  }

  function drawGates(t, run) {
    for (const g of run.gates) {
      const col = g.active ? t.gateActive : t.gate;
      glow(ctx, g.x, g.y, 16, col, g.active ? 0.8 : 0.4);
      // 菱形
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - 10);
      ctx.lineTo(g.x + 8, g.y);
      ctx.lineTo(g.x, g.y + 10);
      ctx.lineTo(g.x - 8, g.y);
      ctx.closePath();
      ctx.fillStyle = g.active ? col : 'rgba(0,0,0,0.3)';
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawShards(t, run) {
    for (const sh of run.shards) {
      const col = t.shard;
      glow(ctx, sh.x, sh.y, 18, col, 0.5);
      circle(ctx, sh.x, sh.y, sh.r, 'rgba(0,0,0,0.3)', col, 2.5);
      circle(ctx, sh.x, sh.y, 4, col, null);
    }
  }

  function drawUpgradePads(t, run) {
    for (const up of run.upgradePads) {
      const col = up.active ? t.gold : t.upgradePad;
      glow(ctx, up.x, up.y, 16, col, up.active ? 0.8 : 0.4);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(up.x - 8, up.y - 8, 16, 16);
    }
  }

  function drawAsteroids(t, run) {
    for (const a of run.asteroids) {
      if (a.dead) continue;
      const crack = ASTEROID_HP_TO_CRACK(a);
      ctx.fillStyle = t.asteroid;
      ctx.strokeStyle = t.frameDim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // 不规则多边形岩石
      const pts = 7;
      for (let i = 0; i < pts; i += 1) {
        const ang = (i / pts) * Math.PI * 2;
        const rr = a.r * (0.8 + 0.2 * Math.sin(i * 2.7 + a.x));
        const px = a.x + Math.cos(ang) * rr;
        const py = a.y + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 裂纹
      if (crack > 0) {
        ctx.strokeStyle = t.asteroidCrack;
        ctx.lineWidth = 2;
        for (let i = 0; i < crack; i += 1) {
          ctx.beginPath();
          ctx.moveTo(a.x - 6 + i * 5, a.y - 6);
          ctx.lineTo(a.x + 4 + i * 4, a.y + 6);
          ctx.stroke();
        }
      }
    }
  }

  function drawStars(t, run) {
    for (const st of run.stars) {
      if (st.lit) {
        glow(ctx, st.x, st.y, 26, t.starLit, 0.9);
        drawStarShape(ctx, st.x, st.y, 12, t.starLit);
      } else {
        glow(ctx, st.x, st.y, 20, t.star, 0.5);
        drawStarShape(ctx, st.x, st.y, 10, t.star);
      }
    }
  }

  function drawLauncher(t, run) {
    const x = LAUNCH.X, y = LAUNCH.Y;
    ctx.strokeStyle = t.frameDim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 40);
    ctx.lineTo(x - 16, y + 30);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 24, y - 52, 48, 8);
    ctx.fillStyle = t.cyan;
    ctx.fillRect(x - 24, y - 52, 48 * run.launchCharge, 8);
  }

  function drawBalls(t, run) {
    const superOn = run.supernovaT > 0;
    for (const b of run.balls) {
      if (b.state === 'blackhole') continue;
      if (superOn && b.state === 'live' && b.trail) {
        for (let i = 0; i < b.trail.length; i += 1) {
          const p = b.trail[i];
          const tt = (i + 1) / b.trail.length;
          glow(ctx, p.x, p.y, b.r * (0.5 + tt), '#eaffff', 0.16);
        }
      }
      const col = superOn ? '#eaffff' : t.ball;
      const glowCol = superOn ? '#41e6ff' : t.ballGlow;
      glow(ctx, b.x, b.y, b.r * 3, glowCol, 0.85);
      circle(ctx, b.x, b.y, b.r, col, glowCol, 2);
      circle(ctx, b.x, b.y, 3, '#ffffff', null);
    }
  }

  function drawSupernovaOverlay(t, run) {
    if (run.supernovaT <= 0) return;
    const k = run.supernovaT / SUPERNOVA.DURATION;
    ctx.fillStyle = `rgba(200, 240, 255, ${0.08 + 0.05 * Math.sin(run.time * 8)})`;
    ctx.fillRect(WORLD.PF_LEFT, WORLD.PF_TOP, WORLD.PF_RIGHT - WORLD.PF_LEFT, WORLD.PF_BOTTOM - WORLD.PF_TOP);
    void k;
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      glow(ctx, p.x, p.y, 8 * a + 2, p.color, a * 0.8);
    }
  }

  function draw(run, alpha = 1) {
    void alpha;
    const t = THEME;
    drawBackground(t);
    if (run) {
      drawPanels(t);
      drawFrame(t);
      drawSegments(t, run);
      drawBumpers(t, run);
      drawReactor(t, run);
      drawBlackHole(t, run);
      drawPortal(t, run);
      drawButtons(t, run);
      drawGates(t, run);
      drawShards(t, run);
      drawUpgradePads(t, run);
      drawAsteroids(t, run);
      drawStars(t, run);
      drawFlippers(t, run);
      drawLauncher(t, run);
      drawSupernovaOverlay(t, run);
      drawBalls(t, run);
    } else {
      drawFrame(t);
      drawPanels(t);
    }
    drawParticles();
  }

  let lastT = 0;
  return {
    draw,
    burst,
    tick(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
      lastT = now;
      updateParticles(dt);
    },
    get particles() { return particles.length; },
  };
}

function drawStarShape(ctx, x, y, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(ang) * rr;
    const py = y + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function ASTEROID_HP_TO_CRACK(a) {
  return Math.max(0, 3 - (a.hp ?? 3));
}
