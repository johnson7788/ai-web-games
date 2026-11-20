// src/render/index.js — Canvas2D 霓虹弹珠台渲染（零依赖，纯程序化）
// 契约：createRender(canvas) → { draw(run, alpha), burst(x, y, kind) }
import { WORLD } from '../../config/game.config.js';
import { LAUNCH, SUPER } from '../../config/gameplay.js';
import { sceneAt } from './theme.js';

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

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  let shakeT = 0;

  function burst(x, y, kind) {
    const colors = kind === 'super' ? ['#eaffff', '#41e6ff', '#ffffff']
      : kind === 'gold' ? ['#ffe082', '#ffb347', '#fff2cc']
      : kind === 'superLight' ? ['#41e6ff', '#ffffff']
      : ['#ff6ae0', '#41e6ff', '#ffffff'];
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
    while (particles.length && particles[0].life <= 0) particles.shift();
    // 简化为逐项过滤
    for (let i = particles.length - 1; i >= 0; i -= 1) if (particles[i].life <= 0) particles.splice(i, 1);
  }

  function drawBackground(scene) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, scene.bgTop);
    g.addColorStop(1, scene.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 网格
    ctx.strokeStyle = scene.grid;
    ctx.lineWidth = 1;
    for (let x = WORLD.PF_LEFT; x <= WORLD.PF_RIGHT; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, WORLD.PF_TOP); ctx.lineTo(x, WORLD.PF_BOTTOM); ctx.stroke();
    }
    for (let y = WORLD.PF_TOP; y <= WORLD.PF_BOTTOM; y += 40) {
      ctx.beginPath(); ctx.moveTo(WORLD.PF_LEFT, y); ctx.lineTo(WORLD.PF_RIGHT, y); ctx.stroke();
    }
  }

  function drawSidePanels(scene, run) {
    // 左右侧板：装饰 + 机器号/目标
    ctx.fillStyle = scene.panel;
    ctx.fillRect(0, 0, WORLD.PF_LEFT, WORLD.HEIGHT);
    ctx.fillRect(WORLD.PF_RIGHT, 0, WORLD.WIDTH - WORLD.PF_RIGHT, WORLD.HEIGHT);
    ctx.strokeStyle = scene.frameDim;
    ctx.lineWidth = 2;
    ctx.strokeRect(WORLD.PF_LEFT, 0, 0, WORLD.HEIGHT);
    ctx.strokeRect(WORLD.PF_RIGHT, 0, 0, WORLD.HEIGHT);
    // 装饰竖条
    ctx.strokeStyle = scene.grid;
    for (let y = 40; y < WORLD.HEIGHT; y += 60) {
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(WORLD.PF_LEFT - 20, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(WORLD.PF_RIGHT + 20, y); ctx.lineTo(WORLD.WIDTH - 20, y); ctx.stroke();
    }
  }

  function drawFrame(scene) {
    ctx.strokeStyle = scene.frame;
    ctx.lineWidth = 4;
    ctx.shadowColor = scene.frame;
    ctx.shadowBlur = 18;
    ctx.strokeRect(WORLD.PF_LEFT, WORLD.PF_TOP, WORLD.PF_RIGHT - WORLD.PF_LEFT, WORLD.PF_BOTTOM - WORLD.PF_TOP);
    ctx.shadowBlur = 0;
  }

  function drawSegments(scene, run) {
    for (const s of run.table.segments) {
      ctx.strokeStyle = s.kind === 'ramp' ? scene.accent : scene.frameDim;
      ctx.lineWidth = s.kind === 'ramp' ? 5 : 3;
      ctx.shadowColor = s.kind === 'ramp' ? scene.accent : scene.frame;
      ctx.shadowBlur = s.kind === 'ramp' ? 8 : 0;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawFlippers(scene, run) {
    for (const f of run.flippers) {
      const tip = flipperTip(f);
      const chargeGlow = 1 + f.charge * 1.6;
      ctx.strokeStyle = scene.flipper;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.shadowColor = scene.flipper;
      ctx.shadowBlur = 10 * chargeGlow;
      ctx.beginPath();
      ctx.moveTo(f.px, f.py);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      circle(ctx, f.px, f.py, 7, scene.flipper, null);
      if (f.charge > 0.05) {
        // 蓄力条
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(f.px - 20, f.py - 26, 40, 6);
        ctx.fillStyle = scene.cyan;
        ctx.fillRect(f.px - 20, f.py - 26, 40 * f.charge, 6);
      }
    }
  }

  function drawBumpers(scene, run) {
    const superOn = run.superconductT > 0;
    for (const bp of run.table.bumpers) {
      const col = superOn ? '#eaffff' : scene.bumper;
      glow(ctx, bp.x, bp.y, bp.r * 2.2, col, 0.5);
      circle(ctx, bp.x, bp.y, bp.r, superOn ? '#cfefff' : 'rgba(0,0,0,0.25)', col, 3);
      circle(ctx, bp.x, bp.y, bp.r * 0.45, col, null);
    }
  }

  function drawTargets(scene, run) {
    for (const t of run.targets) {
      const col = t.lit ? scene.targetLit : scene.target;
      glow(ctx, t.x, t.y, 24, col, t.lit ? 0.9 : 0.4);
      circle(ctx, t.x, t.y, 11, t.lit ? col : 'rgba(0,0,0,0.3)', col, 2.5);
    }
  }

  function drawSuperconducts(scene, run) {
    for (const sc of run.superconducts) {
      const col = sc.lit ? scene.superLit : scene.super;
      glow(ctx, sc.x, sc.y, 26, col, sc.lit ? 0.95 : 0.5);
      // 三角菱形
      ctx.beginPath();
      ctx.moveTo(sc.x, sc.y - 11);
      ctx.lineTo(sc.x + 9, sc.y);
      ctx.lineTo(sc.x, sc.y + 11);
      ctx.lineTo(sc.x - 9, sc.y);
      ctx.closePath();
      ctx.fillStyle = sc.lit ? col : 'rgba(0,0,0,0.3)';
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawTopRing(scene, run) {
    const ring = run.table.topRing;
    const col = scene.cyan;
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    circle(ctx, ring.x, ring.y, 8, col, null);
  }

  function drawMagnets(scene, run) {
    for (const m of run.table.magnets) {
      ctx.strokeStyle = scene.magnet;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, run.time * 2, run.time * 2 + Math.PI * 1.6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawBlackHoles(scene, run) {
    for (const bh of run.blackHoles) {
      if (bh.open) {
        glow(ctx, bh.x, bh.y, bh.r * 2.4, '#a06bff', 0.8);
        circle(ctx, bh.x, bh.y, bh.r, '#12021f', '#a06bff', 3);
      } else {
        circle(ctx, bh.x, bh.y, bh.r, scene.blackhole, scene.frameDim, 2);
      }
    }
  }

  function drawLauncher(scene, run) {
    // 推杆槽（右下）
    const x = LAUNCH.X, y = LAUNCH.Y;
    ctx.strokeStyle = scene.frameDim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 40);
    ctx.lineTo(x - 16, y + 30);
    ctx.stroke();
    // 蓄力指示
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 24, y - 52, 48, 8);
    ctx.fillStyle = scene.cyan;
    ctx.fillRect(x - 24, y - 52, 48 * run.launchCharge, 8);
  }

  function drawBalls(scene, run) {
    const superOn = run.superconductT > 0;
    for (const b of run.balls) {
      if (b.state === 'drained' || b.state === 'blackhole') continue;
      // 超导拖尾
      if (superOn && b.state === 'live' && b.trail) {
        for (let i = 0; i < b.trail.length; i += 1) {
          const p = b.trail[i];
          const t = (i + 1) / b.trail.length;
          glow(ctx, p.x, p.y, b.r * (0.5 + t), '#eaffff', 0.16);
        }
      }
      const col = superOn ? '#eaffff' : scene.ball;
      const glowCol = superOn ? '#41e6ff' : scene.ballGlow;
      glow(ctx, b.x, b.y, b.r * 3, glowCol, 0.85);
      circle(ctx, b.x, b.y, b.r, col, glowCol, 2);
      circle(ctx, b.x, b.y, 3, '#ffffff', null);
    }
  }

  function drawSuperconductOverlay(scene, run) {
    if (run.superconductT <= 0) return;
    const t = run.superconductT / SUPER.DURATION;
    ctx.fillStyle = `rgba(180, 235, 255, ${0.10 + 0.06 * Math.sin(run.time * 8)})`;
    ctx.fillRect(WORLD.PF_LEFT, WORLD.PF_TOP, WORLD.PF_RIGHT - WORLD.PF_LEFT, WORLD.PF_BOTTOM - WORLD.PF_TOP);
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      glow(ctx, p.x, p.y, 8 * a + 2, p.color, a * 0.8);
    }
  }

  function draw(run, alpha = 1) {
    // 固定步长下 alpha 仅用于标题静态帧；这里统一忽略插值
    const scene = run ? sceneAt(run.table.scene) : sceneAt(1);
    drawBackground(scene);
    if (run) {
      drawSidePanels(scene, run);
      drawFrame(scene);
      drawSegments(scene, run);
      drawRamps(scene, run);
      drawMagnets(scene, run);
      drawBlackHoles(scene, run);
      drawTopRing(scene, run);
      drawSuperconducts(scene, run);
      drawBumpers(scene, run);
      drawTargets(scene, run);
      drawFlippers(scene, run);
      drawLauncher(scene, run);
      drawSuperconductOverlay(scene, run);
      drawBalls(scene, run);
    } else {
      // 标题背景：静态台面 + 一颗装饰球
      drawFrame(scene);
      drawSidePanels(scene, { table: { scene: 1 } });
    }
    drawParticles();
  }

  function drawRamps(scene, run) {
    // ramps 已并入 segments 绘制；这里补坡道端点光点
    for (const s of run.table.segments) {
      if (s.kind !== 'ramp') continue;
      glow(ctx, s.x2, s.y2, 14, scene.accent, 0.7);
    }
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
