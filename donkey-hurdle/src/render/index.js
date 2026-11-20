// src/render/index.js — createRender(canvas)：场景 / 障碍 / 小驴 / 粒子装配。
// 契约：createRender(canvas) → { draw(run, alpha), burst(x,y,kind), goldArc(x,y) }。
import { WORLD, DONKEY, JARS, OBSTACLE } from '../../config/gameplay.js';
import { themeFor, sceneDeco } from './theme.js';
import { drawDonkey } from './donkey.js';
import { createParticles } from './particles.js';

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  const GY = WORLD.GROUND_Y;
  const particles = createParticles();

  // ---------- 天空 / 地面 / 远景（parallax 用 distPx 平移） ----------
  function drawSky(theme) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, theme.skyTop);
    g.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 2);
  }

  function drawCelestial(theme, scene, t) {
    ctx.save();
    ctx.fillStyle = theme.sun;
    if (scene === 'night') {
      ctx.beginPath();
      ctx.arc(W * 0.82, H * 0.2, 30, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(W * 0.82, H * 0.24, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(W * 0.82, H * 0.24, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawFar(theme, distPx) {
    // 远山（两档视差）
    ctx.fillStyle = theme.far;
    const off1 = (distPx * 0.12) % 640;
    ctx.beginPath();
    ctx.moveTo(0, GY);
    for (let x = -off1; x <= W + 80; x += 160) {
      const h = 120 + ((x * 7919) % 97);
      ctx.lineTo(x + 80, GY - h);
    }
    ctx.lineTo(W, GY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = theme.mid;
    const off2 = (distPx * 0.25) % 420;
    ctx.beginPath();
    ctx.moveTo(0, GY);
    for (let x = -off2; x <= W + 60; x += 140) {
      const h = 60 + ((x * 104729) % 67);
      ctx.lineTo(x + 70, GY - h);
    }
    ctx.lineTo(W, GY);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround(theme, distPx) {
    ctx.fillStyle = theme.groundFill;
    ctx.fillRect(0, GY, W, H - GY);
    // 地表线
    ctx.fillStyle = theme.groundTop;
    ctx.fillRect(0, GY, W, 10);
    ctx.fillStyle = theme.groundLine;
    ctx.fillRect(0, GY + 10, W, 3);
    // 滚动石子纹理
    ctx.fillStyle = theme.groundLine;
    const off = distPx % 90;
    for (let x = -off; x < W; x += 90) {
      ctx.fillRect(x, GY + 24, 14, 3);
      ctx.fillRect(x + 40, GY + 40, 8, 3);
    }
  }

  // ---------- 障碍 ----------
  function drawObstacle(o, x) {
    ctx.save();
    ctx.translate(x, GY);
    if (o.type === 'low') {
      drawHurdle();
    } else if (o.type === 'high') {
      drawWall(o.h);
    } else if (o.type === 'pit') {
      drawPit(o.w);
    } else if (o.type === 'rock') {
      drawRock(o.w);
    }
    ctx.restore();
  }

  function drawHurdle() {
    // 落影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-22, -2, 48, 4);
    // 深色立柱 + 高对比红色横栏（危险色，一眼可辨）
    ctx.strokeStyle = '#2a1408';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#5a3418';
    ctx.fillRect(-16, -26, 6, 26);
    ctx.strokeRect(-16, -26, 6, 26);
    ctx.fillRect(10, -26, 6, 26);
    ctx.strokeRect(10, -26, 6, 26);
    ctx.fillStyle = '#e8543a';
    ctx.fillRect(-20, -26, 46, 9);
    ctx.strokeRect(-20, -26, 46, 9);
    ctx.fillStyle = '#fff2e0';
    ctx.fillRect(-16, -24, 9, 5);
    ctx.fillRect(-2, -24, 9, 5);
    ctx.fillRect(12, -24, 9, 5);
  }

  function drawWall(h) {
    // 落影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-20, -2, 40, 4);
    // 深色土墙 + 顶部红色警示条
    ctx.fillStyle = '#6a4420';
    ctx.strokeStyle = '#3a2008';
    ctx.lineWidth = 3;
    ctx.fillRect(-16, -h, 32, h);
    ctx.strokeRect(-16, -h, 32, h);
    ctx.strokeStyle = '#8a5a30';
    ctx.lineWidth = 2;
    for (let ry = -h + 16; ry < 0; ry += 16) {
      ctx.beginPath();
      ctx.moveTo(-16, ry);
      ctx.lineTo(16, ry);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8543a';
    ctx.fillRect(-16, -h, 32, 8);
    ctx.strokeStyle = '#3a2008';
    ctx.strokeRect(-16, -h, 32, 8);
  }

  function drawPit(w) {
    // 边缘红色警示桩 + 虚线提示
    ctx.fillStyle = '#e8543a';
    ctx.fillRect(-w / 2 - 2, -2, 4, 12);
    ctx.fillRect(w / 2 - 2, -2, 4, 12);
    ctx.fillStyle = '#120c06';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(w / 2 - 8, H - GY);
    ctx.lineTo(-w / 2 + 8, H - GY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(-w / 2, -1);
    ctx.lineTo(w / 2, -1);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawRock(w) {
    // 落影
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, -2, w / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 深灰滚石 + 高光 + 红色警示弧
    ctx.fillStyle = '#4a4a4a';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -w / 2, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8a8a8a';
    ctx.beginPath();
    ctx.arc(-w * 0.16, -w * 0.62, w * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8543a';
    ctx.beginPath();
    ctx.arc(0, -w / 2, w / 2, -Math.PI * 0.95, -Math.PI * 0.55);
    ctx.arc(0, -w / 2, w / 2 - 4, -Math.PI * 0.55, -Math.PI * 0.95, true);
    ctx.fill();
  }

  function drawPickup(p, x) {
    // 补给陶罐（醒目收集物：金色光晕 + 大罐 + 火花），是玩家一眼可识别的目标
    ctx.save();
    ctx.translate(x, p.y);
    const bob = Math.sin(performance.now() / 240) * 5;
    ctx.translate(0, bob - 6);
    // 金色光晕
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
    glow.addColorStop(0, 'rgba(255,220,120,0.85)');
    glow.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    // 大陶罐
    ctx.fillStyle = '#d9773a';
    ctx.strokeStyle = '#7a3a1c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-13, -15);
    ctx.lineTo(13, -15);
    ctx.lineTo(9, 15);
    ctx.lineTo(-9, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7a3a1c';
    ctx.fillRect(-14, -18, 28, 5);   // 罐口
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(0, -8, 5, 0, Math.PI * 2);
    ctx.fill();
    // 顶部小火花
    ctx.fillStyle = '#fff3c9';
    ctx.beginPath();
    ctx.arc(0, -20 + Math.sin(performance.now() / 120) * 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- 主绘制 ----------
  function draw(run, alpha) {
    ctx.clearRect(0, 0, W, H);
    const scene = run ? (run.scene || 'dawn') : 'dawn';
    const theme = themeFor(scene);
    const distPx = run ? run.distPx : 0;
    const t = run ? run.time : performance.now() / 1000;

    drawSky(theme);
    drawCelestial(theme, scene, t);
    drawFar(theme, distPx);
    drawGround(theme, distPx);
    sceneDeco(ctx, scene, t, W, H);

    if (run) {
      // 补给
      for (const p of run.pickups) {
        drawPickup(p, p.worldX - distPx);
      }
      // 障碍
      for (const o of run.obstacles) {
        drawObstacle(o, o.worldX - distPx);
      }
      // 主角
      drawDonkey(ctx, {
        x: WORLD.PLAYER_X,
        y: run.player.y,
        jars: run.jars,
        jarMax: JARS.MAX,
        t,
        invuln: run.time < run.player.invulnUntil,
        dropAir: run.player.dropAir,
      });
    } else {
      // 标题背景：一匹站定的小驴 + 远景障碍
      drawHurdleAt(W * 0.7);
      drawDonkey(ctx, { x: WORLD.PLAYER_X, y: GY, jars: JARS.MAX, jarMax: JARS.MAX, t });
    }

    // 粒子
    const dt = 1 / 60;
    particles.update(dt);
    particles.draw(ctx);
  }

  function drawHurdleAt(x) {
    ctx.save();
    ctx.translate(x, GY);
    drawHurdle();
    ctx.restore();
  }

  return {
    draw,
    burst: (x, y, kind, n = 12) => particles.spawn(x, y, kind, n),
    goldArc: (x, y) => particles.goldArc(x, y),
  };
}
