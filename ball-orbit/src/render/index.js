// src/render/index.js — Canvas 2D 渲染：星空背景 / 行星 / 陨石带 / 流星 / 弹弓 / 瞄准预览
// 零外部素材，全程序化。场景包色板来自 config/scenes.js（换章必换色板 + 构图 + 装饰）。
import {
  WORLD, CANNON, BALL, ASTEROID, PLANET, BOUNCE_BAND,
} from '../../config/gameplay.js';
import { sceneById } from '../../config/scenes.js';
import { waveAt } from '../../config/waves.js';
import { t } from '../core/i18n.js';

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

// 稳定星空（基于整数 hash，不随 run 变）
function star(i) {
  const a = (i * 2654435761) >>> 0;
  const x = (a % 1280);
  const y = ((a >>> 7) % 720);
  const s = ((a >>> 14) % 3);
  return { x, y, s: 0.6 + s * 0.5, tw: ((a >>> 18) % 100) / 100 };
}

function drawBackground(ctx, scene, time) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, scene.bgTop);
  g.addColorStop(1, scene.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 星云
  const ng = ctx.createRadialGradient(WORLD.WIDTH * 0.5, WORLD.HEIGHT * 0.32, 40, WORLD.WIDTH * 0.5, WORLD.HEIGHT * 0.32, 420);
  ng.addColorStop(0, scene.nebula);
  ng.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ng;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 星空（随时间微微闪烁）
  ctx.fillStyle = scene.star;
  for (let i = 0; i < 120; i += 1) {
    const s = star(i);
    const tw = 0.6 + 0.4 * Math.sin(time * 2 + s.tw * 6.28);
    ctx.globalAlpha = 0.25 + 0.55 * tw;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawDangerLine(ctx, scene) {
  ctx.save();
  ctx.strokeStyle = scene.danger;
  ctx.globalAlpha = 0.6;
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, ASTEROID.DANGER_Y);
  ctx.lineTo(WORLD.WIDTH, ASTEROID.DANGER_Y);
  ctx.stroke();
  ctx.restore();

  // 判负线警示标（语言中立，不写死英文）：右端一个小三角 + 双杠，提示「别让陨石带压到这条线」
  ctx.save();
  ctx.fillStyle = scene.danger;
  ctx.globalAlpha = 0.9;
  const dx = WORLD.WIDTH - 16;
  const dy = ASTEROID.DANGER_Y - 5;
  ctx.beginPath();
  ctx.moveTo(dx - 9, dy - 5);
  ctx.lineTo(dx + 9, dy - 5);
  ctx.lineTo(dx, dy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBounceBand(ctx, scene, time) {
  ctx.save();
  ctx.globalAlpha = 0.12 + 0.05 * Math.sin(time * 3);
  ctx.fillStyle = scene.accent;
  ctx.fillRect(0, BOUNCE_BAND.Y1, WORLD.WIDTH, BOUNCE_BAND.Y2 - BOUNCE_BAND.Y1);
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([4, 8]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = scene.accent;
  ctx.beginPath();
  ctx.moveTo(0, BOUNCE_BAND.Y1);
  ctx.lineTo(WORLD.WIDTH, BOUNCE_BAND.Y1);
  ctx.moveTo(0, BOUNCE_BAND.Y2);
  ctx.lineTo(WORLD.WIDTH, BOUNCE_BAND.Y2);
  ctx.stroke();
  ctx.restore();
}

function drawPlanet(ctx, p, scene, time) {
  const g = ctx.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r * 2.6);
  g.addColorStop(0, scene.planetGlow);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = scene.planet;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();

  // 光环
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(time * 0.4);
  ctx.strokeStyle = scene.accent;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.r * 1.7, p.r * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function tierColor(scene, value) {
  if (value <= 2) return scene.asteroid[0];
  if (value <= 6) return scene.asteroid[1];
  return scene.asteroid[2];
}

function drawAsteroid(ctx, a, scene) {
  const x = a.x + a.ox;
  const y = a.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a.tilt);

  const w = ASTEROID.W - 6;
  const h = ASTEROID.H - 6;
  ctx.fillStyle = tierColor(scene, a.initial);
  ctx.strokeStyle = scene.asteroidEdge;
  ctx.lineWidth = 1.5;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.stroke();

  // 数字带深色描边，保证浅色（尘带）与深色（气态/深空）底上都能清晰辨识硬度
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.lineJoin = 'round';

  if (a.kind === 'addBall') {
    ctx.strokeText('+1', 0, 1);
    ctx.fillStyle = scene.addBall;
    ctx.fillText('+1', 0, 1);
  } else if (a.kind === 'shield') {
    ctx.strokeStyle = scene.shield;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.lineWidth = 3;
    ctx.strokeText(String(a.hardness), 0, 1);
    ctx.fillStyle = scene.asteroidText;
    ctx.fillText(String(a.hardness), 0, 1);
  } else {
    ctx.strokeText(String(a.hardness), 0, 1);
    ctx.fillStyle = scene.asteroidText;
    ctx.fillText(String(a.hardness), 0, 1);
  }
  ctx.restore();
}

function drawBall(ctx, ball, scene) {
  const isComet = !!ball.isComet;
  const color = isComet ? scene.comet : scene.trail;
  // 拖尾
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(ball.px, ball.py, ball.x, ball.y);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color);
  ctx.strokeStyle = g;
  ctx.lineWidth = isComet ? 6 : 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ball.px, ball.py);
  ctx.lineTo(ball.x, ball.y);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rg = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, isComet ? 16 : 9);
  rg.addColorStop(0, color);
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, isComet ? 16 : 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = isComet ? '#ffffff' : scene.star;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL.R, 0, Math.PI * 2);
  ctx.fill();
}

function drawCannon(ctx, run, scene, alpha) {
  const angle = run?.aimAngle ?? 0;
  ctx.save();
  ctx.translate(CANNON.X, CANNON.Y);
  // 底座
  ctx.fillStyle = scene.cannon;
  ctx.beginPath();
  ctx.arc(0, 0, CANNON.R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = scene.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  // 瞄准方向
  ctx.rotate(angle);
  ctx.strokeStyle = scene.cannon;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(CANNON.R + 10, 0);
  ctx.stroke();
  ctx.restore();

  // 待发流星排布
  const n = run ? Math.min(run.ballsPerShot, 9) : 1;
  ctx.fillStyle = scene.star;
  for (let i = 0; i < n; i += 1) {
    ctx.beginPath();
    ctx.arc(CANNON.X - (n - 1) * 8 + i * 16, CANNON.BALL_Y + 8, BALL.R, 0, Math.PI * 2);
    ctx.fill();
  }
  void alpha;
}

// 瞄准预览：沿引力弹道模拟一颗幽灵流星，画一条亮线 + 顶点箭头（可读性：玩家一眼看懂「从弹弓打向陨石带」）
function drawAimPreview(ctx, run, scene) {
  if (!run || !run.canFire) return;
  const angle = run.aimAngle ?? 0;
  let x = CANNON.X;
  let y = CANNON.BALL_Y;
  let vx = Math.sin(angle) * BALL.SPEED;
  let vy = -Math.cos(angle) * BALL.SPEED;
  const pts = [];
  for (let i = 0; i < 42; i += 1) {
    const dt = 0.028;
    vy += BALL.GRAVITY * dt;
    for (const p of run.planets) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > PLANET.INFLUENCE * PLANET.INFLUENCE) continue;
      const d = Math.sqrt(d2) || 1;
      const acc = Math.min(PLANET.MAX_ACC, p.gm / Math.max(d2, p.r * p.r));
      vx += (dx / d) * acc * dt;
      vy += (dy / d) * acc * dt;
    }
    x += vx * dt;
    y += vy * dt;
    if (x < BALL.R || x > WORLD.WIDTH - BALL.R) break;
    if (y < BALL.R || y > ASTEROID.DANGER_Y) break;
    pts.push({ x, y });
  }

  ctx.save();
  // 亮虚线（主轨迹）
  ctx.strokeStyle = scene.trail;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(CANNON.X, CANNON.BALL_Y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // 顶点箭头：指向流星将飞往的方向
  const tip = pts[pts.length - 1];
  const prev = pts[Math.max(0, pts.length - 2)];
  if (tip && prev) {
    const dx = tip.x - prev.x;
    const dy = tip.y - prev.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const px = -uy;
    const py = ux;
    ctx.fillStyle = scene.trail;
    ctx.beginPath();
    ctx.moveTo(tip.x + ux * 12, tip.y + uy * 12);
    ctx.lineTo(tip.x + px * 7, tip.y + py * 7);
    ctx.lineTo(tip.x - px * 7, tip.y - py * 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// 首次（未发射过）待命提示：直接说明目标与操作，弥补「跳过教程后静态开局」的目标可读性
function drawIdleHint(ctx, run, scene) {
  if (!run || !run.canFire || (run.stats.shots ?? 0) > 0) return;
  const cx = CANNON.X;
  const y1 = CANNON.Y - 62;
  const y2 = CANNON.Y - 38;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(7, 8, 15, 0.72)';
  const w = 620;
  ctx.fillRect(cx - w / 2, y1 - 24, w, 66);

  ctx.fillStyle = scene.star;
  ctx.font = 'bold 22px monospace';
  ctx.fillText(t('hint.aim'), cx, y1);
  ctx.fillStyle = scene.accent;
  ctx.font = 'bold 16px monospace';
  ctx.fillText(t('hint.goal'), cx, y2);
  ctx.restore();
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let t = 0;
  function draw(run, alpha = 1) {
    t += 1 / 60;
    const scene = run ? sceneById(run.scene) : sceneById('dust');
    drawBackground(ctx, scene, t);

    if (run) {
      drawDangerLine(ctx, scene);
      if (waveAt(run.wave).bounceBand) drawBounceBand(ctx, scene, t);
      for (const p of run.planets) drawPlanet(ctx, p, scene, t);
      for (const a of run.asteroids) drawAsteroid(ctx, a, scene);
      for (const b of run.balls) drawBall(ctx, b, scene);
      drawAimPreview(ctx, run, scene);
      drawCannon(ctx, run, scene, alpha);
      drawIdleHint(ctx, run, scene);
    } else {
      // 标题背景：只画星空 + 一个装饰行星
      drawPlanet(ctx, { x: 640, y: 300, r: 54, gm: 0 }, scene, t);
      drawCannon(ctx, null, scene, alpha);
    }
  }

  function burst(x, y, kind) {
    // 轻量粒子回调（main 用它做命中反馈闪烁）
    const scene = sceneById('dust');
    const colors = { break: scene.accent, comet: scene.comet, addBall: scene.addBall };
    const color = colors[kind] || scene.star;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = color;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 14, y + Math.sin(a) * 14, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return { draw, burst };
}

export default createRender;
