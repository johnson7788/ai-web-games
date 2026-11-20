// src/render/index.js — OCEAN DASH · Canvas 2D 渲染（零外部素材，全程序化）
// 三场景包（色板+构图+装饰）来自 config/levels.js SCENES：珊瑚浅滩 / 深沟 / 红树林。
import { WORLD, PLAYER, SCHOOL, OBSTACLE, BUBBLE, CURRENT, GLIDE } from '../../config/gameplay.js';
import { segmentAt, sceneById } from '../../config/levels.js';
import { createParticles } from './particles.js';

const PLAYER_X = WORLD.PLAYER_X;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function fishShape(ctx, x, y, size, color, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // 尾鳍
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.9, 0);
  ctx.lineTo(-size * 1.5, -size * 0.55);
  ctx.lineTo(-size * 1.5, size * 0.55);
  ctx.closePath();
  ctx.fill();
  // 身体
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  // 腹侧高光
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(size * 0.15, -size * 0.18, size * 0.55, size * 0.3, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // 眼睛
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(size * 0.42, -size * 0.1, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a1420';
  ctx.beginPath();
  ctx.arc(size * 0.47, -size * 0.1, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function schoolOffsets(count, gathered, boosting) {
  const offs = [];
  for (let i = 0; i < count; i += 1) {
    const dir = i % 2 === 0 ? 1 : -1;
    const k = Math.ceil((i + 1) / 2);
    let dx;
    let dy;
    if (gathered) {
      dx = -30 - i * 13;
      dy = dir * k * 10;
    } else if (boosting) {
      dx = -42 - i * 17;
      dy = dir * (8 + k * 5); // 箭形（V 字）
    } else {
      dx = -34 - i * 10;
      dy = dir * (20 + k * 7);
    }
    offs.push([dx, dy]);
  }
  return offs;
}

function drawBackground(ctx, scene, t) {
  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.SURFACE_Y);
  sky.addColorStop(0, scene.skyTop);
  sky.addColorStop(1, scene.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.SURFACE_Y);

  // 水面线（微浪）
  ctx.fillStyle = scene.surface;
  ctx.beginPath();
  ctx.moveTo(0, WORLD.SURFACE_Y);
  for (let x = 0; x <= WORLD.WIDTH; x += 40) {
    ctx.lineTo(x, WORLD.SURFACE_Y + Math.sin((x * 0.03) + t * 2) * 3);
  }
  ctx.lineTo(WORLD.WIDTH, WORLD.SURFACE_Y + 4);
  ctx.lineTo(0, WORLD.SURFACE_Y + 4);
  ctx.closePath();
  ctx.fill();

  // 水
  const water = ctx.createLinearGradient(0, WORLD.SURFACE_Y, 0, WORLD.HEIGHT);
  water.addColorStop(0, scene.waterTop);
  water.addColorStop(1, scene.waterBottom);
  ctx.fillStyle = water;
  ctx.fillRect(0, WORLD.SURFACE_Y + 4, WORLD.WIDTH, WORLD.HEIGHT - WORLD.SURFACE_Y - 4);
}

function drawDecor(ctx, scene, dist, t) {
  const id = scene.decor;
  ctx.save();
  if (id === 'coral') {
    // 底部珊瑚剪影（视差：随 dist 缓慢移动）
    const off = -(dist * 0.4) % 320;
    for (let x = off - 320; x < WORLD.WIDTH + 320; x += 160) {
      ctx.fillStyle = 'rgba(46,230,200,0.10)';
      ctx.beginPath();
      ctx.moveTo(x, WORLD.BOTTOM_Y);
      ctx.quadraticCurveTo(x + 10, 620, x + 20, 600);
      ctx.quadraticCurveTo(x + 30, 630, x + 40, WORLD.BOTTOM_Y);
      ctx.fill();
    }
    // 光束
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 3; i += 1) {
      const bx = 200 + i * 360;
      ctx.beginPath();
      ctx.moveTo(bx, WORLD.SURFACE_Y);
      ctx.lineTo(bx + 40, WORLD.SURFACE_Y);
      ctx.lineTo(bx + 180, WORLD.BOTTOM_Y);
      ctx.lineTo(bx + 120, WORLD.BOTTOM_Y);
      ctx.fill();
    }
  } else if (id === 'trench') {
    // 深沟岩石 + 热泉气泡
    const off = -(dist * 0.3) % 400;
    for (let x = off - 400; x < WORLD.WIDTH + 400; x += 200) {
      ctx.fillStyle = 'rgba(58,167,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(x, WORLD.BOTTOM_Y);
      ctx.lineTo(x + 60, 560);
      ctx.lineTo(x + 120, WORLD.BOTTOM_Y);
      ctx.fill();
    }
    for (let i = 0; i < 8; i += 1) {
      const bx = ((i * 173 + t * 40) % WORLD.WIDTH);
      ctx.fillStyle = 'rgba(111,208,255,0.12)';
      ctx.beginPath();
      ctx.arc(bx, WORLD.BOTTOM_Y - (i * 37 % 240), 3 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 红树林：水面垂根 + 金绿浮叶
    const off = -(dist * 0.35) % 280;
    for (let x = off - 280; x < WORLD.WIDTH + 280; x += 140) {
      ctx.strokeStyle = 'rgba(217,195,74,0.14)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, WORLD.SURFACE_Y);
      ctx.quadraticCurveTo(x + 8, 300, x + 20, 420);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i += 1) {
      const lx = ((i * 211 + t * 24) % WORLD.WIDTH);
      ctx.fillStyle = 'rgba(242,226,122,0.12)';
      ctx.beginPath();
      ctx.ellipse(lx, WORLD.SURFACE_Y + 6 + (i % 3) * 4, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawObstacle(ctx, scene, o, sx) {
  if (o.kind === 'reef') {
    const g = ctx.createLinearGradient(0, o.y, 0, WORLD.BOTTOM_Y);
    g.addColorStop(0, scene.accent);
    g.addColorStop(1, scene.waterBottom);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx, WORLD.BOTTOM_Y);
    ctx.lineTo(sx, o.y + 10);
    ctx.quadraticCurveTo(sx + o.w * 0.5, o.y - 12, sx + o.w, o.y + 6);
    ctx.lineTo(sx + o.w, WORLD.BOTTOM_Y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + 4, o.y + 14);
    ctx.quadraticCurveTo(sx + o.w * 0.5, o.y - 6, sx + o.w - 4, o.y + 10);
    ctx.stroke();
  } else if (o.kind === 'jelly') {
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.beginPath();
    ctx.arc(sx + o.w / 2, o.y + o.h / 2, o.w / 2, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(191,244,255,0.5)';
    ctx.beginPath();
    ctx.arc(sx + o.w / 2, o.y + o.h / 2, o.w / 2, Math.PI, 0);
    ctx.fill();
    // 触手
    ctx.strokeStyle = 'rgba(191,244,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(sx + o.w * (0.3 + i * 0.2), o.y + o.h);
      ctx.quadraticCurveTo(sx + o.w * (0.4 + i * 0.2), o.y + o.h + 20, sx + o.w * (0.25 + i * 0.2), o.y + o.h + 34);
      ctx.stroke();
    }
  } else if (o.kind === 'root') {
    ctx.strokeStyle = scene.accent;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(sx + o.w / 2, o.y);
    ctx.quadraticCurveTo(sx + o.w * 0.3, o.y + o.h * 0.5, sx + o.w / 2, o.y + o.h);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(sx + o.w / 2, o.y);
    ctx.lineTo(sx + o.w / 2, o.y + o.h * 0.8);
    ctx.stroke();
  }
}

function drawCurrent(ctx, scene, c, sx) {
  const g = ctx.createLinearGradient(sx, 0, sx + c.w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, scene.glow);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(sx, c.y, c.w, c.h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let yy = c.y + 30; yy < c.y + c.h; yy += 70) {
    ctx.beginPath();
    ctx.moveTo(sx + c.w * 0.5 - 10, yy - 12);
    ctx.lineTo(sx + c.w * 0.5 + 10, yy);
    ctx.lineTo(sx + c.w * 0.5 - 10, yy + 12);
    ctx.fill();
  }
}

function drawFlag(ctx, scene, x, scale) {
  const top = WORLD.SURFACE_Y - 34 * scale;
  const bottom = WORLD.BOTTOM_Y;
  // 旗杆
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();

  const fw = 52 * scale;
  const fh = 30 * scale;
  const fx = x - fw;
  const fy = top;
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      ctx.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : scene.glow;
      ctx.fillRect(fx + (fw / 2) * i, fy + (fh / 2) * j, fw / 2, fh / 2);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(fx, fy, fw, fh);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(15 * scale)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('FINISH', x, top - 6 * scale);
}

// 终点旗：目标始终可见——真正终点接近时画整面旗，尚在远处时在右缘画方向旗。
function drawFinish(ctx, scene, run) {
  const seg = segmentAt(run.segment);
  const sx = PLAYER_X + (seg.length - run.dist);
  if (sx < -80) return;
  if (sx <= WORLD.WIDTH + 80) {
    drawFlag(ctx, scene, sx, 1);
  } else {
    drawFlag(ctx, scene, WORLD.WIDTH - 42, 0.9);
  }
}

function drawCounter(ctx, z, sx) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(sx, WORLD.SURFACE_Y, z.w, WORLD.BOTTOM_Y - WORLD.SURFACE_Y);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let yy = WORLD.SURFACE_Y + 30; yy < WORLD.BOTTOM_Y; yy += 70) {
    ctx.beginPath();
    ctx.moveTo(sx + 10, yy - 12);
    ctx.lineTo(sx - 10, yy);
    ctx.lineTo(sx + 10, yy + 12);
    ctx.fill();
  }
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = createParticles();
  let t = 0;

  function screenX(worldX, dist) {
    return PLAYER_X + (worldX - dist);
  }

  function draw(run, alpha = 1) {
    t += 1 / 60;
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    const scene = run ? sceneById(segmentAt(run.segment).scene) : sceneById('coral');
    drawBackground(ctx, scene, t);

    if (!run) {
      drawDecor(ctx, scene, 0, t);
      // 标题屏游动装饰鱼
      for (let i = 0; i < 5; i += 1) {
        const fx = ((i * 260 + t * 90) % (WORLD.WIDTH + 200)) - 100;
        const fy = 220 + (i * 97 % 360);
        fishShape(ctx, fx, fy, 16, scene.accent, Math.sin(t + i) * 0.3);
      }
      return;
    }

    drawDecor(ctx, scene, run.dist, t);

    // 逆流区
    for (const z of run.counterZones) {
      if (run.dist - z.x < 800) drawCounter(ctx, z, screenX(z.x, run.dist));
    }

    // 终点旗（目标可见：让玩家一眼看到「冲线」）
    drawFinish(ctx, scene, run);

    // 洋流带
    for (const c of run.currents) {
      const sx = screenX(c.x, run.dist);
      if (sx > -200 && sx < WORLD.WIDTH + 200) drawCurrent(ctx, scene, c, sx);
    }

    // 障碍
    for (const o of run.obstacles) {
      const sx = screenX(o.x, run.dist);
      if (sx > -260 && sx < WORLD.WIDTH + 260) drawObstacle(ctx, scene, o, sx);
    }

    // 气泡
    for (const b of run.bubbles) {
      const sx = screenX(b.x, run.dist);
      if (sx < -40 || sx > WORLD.WIDTH + 40) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.arc(sx, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
      ctx.stroke();
    }

    // AI 对手
    const aiColors = ['#ff8a5c', '#c79bff', '#9bff8a'];
    for (const ai of run.ai) {
      if (ai.finished) continue;
      const sx = screenX(ai.dist, run.dist);
      if (sx < -120 || sx > WORLD.WIDTH + 120) continue;
      fishShape(ctx, sx, ai.y, 17, aiColors[ai.id % aiColors.length], Math.sin(t * 3 + ai.id) * 0.18);
    }

    // 玩家鱼群
    drawSchool(ctx, run, scene, alpha);

    // 粒子
    particles.tick(1 / 60);
    particles.draw(ctx);

    // 深沟暗区（赛段 6）
    if (run.segment === 6) drawDark(ctx, run);

    // 顶部天空上方轻微辉光（不影响）
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, WORLD.WIDTH, 2);
  }

  function drawSchool(ctx, run, scene, alpha) {
    const boosting = run.boostT > 0 && run.boostMult >= CURRENT.BOOST_MULT;
    const tilt = clamp(run.player.vy * 0.0016, -0.6, 0.6);
    const leaderX = PLAYER_X;
    const leaderY = run.player.y;

    // 洋流加速时：箭形光带
    if (boosting) {
      const g = ctx.createLinearGradient(leaderX, 0, leaderX + 260, 0);
      g.addColorStop(0, scene.glow);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.moveTo(leaderX, leaderY);
      ctx.lineTo(leaderX + 240, leaderY - 60);
      ctx.lineTo(leaderX + 240, leaderY + 60);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const followers = run.fish - 1;
    const offs = schoolOffsets(followers, run.gathered, boosting);
    // 先画追随者（更小更暗），再画领头鱼（最大最亮，一眼可辨）
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < offs.length; i += 1) {
      const [dx, dy] = offs[i];
      fishShape(ctx, leaderX + dx, leaderY + dy, 11, scene.accent, tilt * 0.6);
    }
    ctx.globalAlpha = 1;
    // 领头鱼（最亮）
    fishShape(ctx, leaderX, leaderY, 26, '#ffffff', tilt);
    // 领头鱼发光描边
    ctx.strokeStyle = scene.glow;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(leaderX, leaderY, 29, 19, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 滑翔喷溅
    if (run.mode === 'glide') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.arc(leaderX - 10 - i * 8, WORLD.SURFACE_Y + 4 + Math.sin(t * 10 + i) * 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawDark(ctx, run) {
    const g = ctx.createRadialGradient(PLAYER_X, run.player.y, 60, PLAYER_X, run.player.y, 420);
    g.addColorStop(0, 'rgba(1,6,13,0)');
    g.addColorStop(1, 'rgba(1,6,13,0.88)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function burst(x, y, kind) {
    particles.spawn(kind, x, y);
  }

  return { draw, burst, particles, get t() { return t; } };
}

export default createRender;
