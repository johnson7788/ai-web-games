// src/render/index.js — Canvas2D 渲染：三场景包道路 + 大鹅 + 车辆/坑/闸机 + 宝石/气球 + 粒子。
// 只读 run；不写 DOM、不读存档。所有数值从 config 来。
import { WORLD } from '../../config/game.config.js';
import { PX_PER_METER } from '../../config/gameplay.js';
import { sceneFor } from './theme.js';
import { createParticles } from './particles.js';

const PLAYER_Y = WORLD.PLAYER_Y;

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function rr(ctx, x, y, w, h, r) {
  const rr2 = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr2, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr2);
  ctx.arcTo(x + w, y + h, x, y + h, rr2);
  ctx.arcTo(x, y + h, x, y, rr2);
  ctx.arcTo(x, y, x + w, y, rr2);
  ctx.closePath();
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = createParticles();

  function screenY(z) {
    return PLAYER_Y - z * PX_PER_METER;
  }

  function laneX(lane) {
    return WORLD.LANE_X[lane] ?? 640;
  }

  // ---------- 场景 ----------
  function drawSky(scene) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, scene.skyTop);
    g.addColorStop(1, scene.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawDecor(scene) {
    const t = performance.now() / 1000;
    if (scene.decorations.includes('sun')) {
      ctx.fillStyle = scene.accent;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(150, 90, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (scene.decorations.includes('moon')) {
      ctx.fillStyle = '#e8e4ff';
      ctx.beginPath();
      ctx.arc(1100, 92, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = scene.skyTop;
      ctx.beginPath();
      ctx.arc(1082, 82, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    if (scene.decorations.includes('tower')) drawBuildings('#e7d7b8', '#cbb78f');
    else if (scene.decorations.includes('metro')) drawBuildings('#9ec9c6', '#7db4b1');
    else if (scene.decorations.includes('neon')) {
      drawBuildings('#2a2344', '#241e3d');
      ctx.fillStyle = '#ff7bd5';
      for (let i = 0; i < 4; i += 1) {
        const x = 190 + i * 245;
        ctx.fillRect(x, 90 + Math.sin(t * 3 + i) * 4, 60, 8);
      }
    }
  }

  function drawBuildings(a, b) {
    // 远景楼群：压低对比 + 淡出，避免被误读成可交互物
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = a;
    ctx.fillRect(20, 60, 120, 120);
    ctx.fillRect(1140, 80, 120, 100);
    ctx.fillStyle = b;
    ctx.fillRect(150, 130, 90, 50);
    ctx.fillRect(1020, 120, 90, 60);
    ctx.globalAlpha = 1;
  }

  // ---------- 道路 ----------
  function drawRoad(scene, distance) {
    ctx.fillStyle = scene.sidewalk;
    ctx.fillRect(0, 0, WORLD.ROAD_LEFT, WORLD.HEIGHT);
    ctx.fillRect(WORLD.ROAD_RIGHT, 0, WORLD.WIDTH - WORLD.ROAD_RIGHT, WORLD.HEIGHT);

    ctx.fillStyle = scene.road;
    ctx.fillRect(WORLD.ROAD_LEFT, 0, WORLD.ROAD_RIGHT - WORLD.ROAD_LEFT, WORLD.HEIGHT);

    const dashH = 42;
    const gap = 34;
    const off = ((distance * PX_PER_METER) % (dashH + gap));
    ctx.strokeStyle = scene.roadLine;
    ctx.lineWidth = 5;
    ctx.setLineDash([dashH, gap]);
    ctx.lineDashOffset = -off;
    for (const x of [WORLD.LANE_X[0] + WORLD.LANE_W / 2, WORLD.LANE_X[1] + WORLD.LANE_W / 2]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.HEIGHT);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.strokeStyle = scene.roadLine;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(WORLD.ROAD_LEFT, 0); ctx.lineTo(WORLD.ROAD_LEFT, WORLD.HEIGHT); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(WORLD.ROAD_RIGHT, 0); ctx.lineTo(WORLD.ROAD_RIGHT, WORLD.HEIGHT); ctx.stroke();
    ctx.globalAlpha = 1;

    if (scene.key === 'night') {
      ctx.strokeStyle = scene.glow;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(WORLD.ROAD_LEFT + 8, 0); ctx.lineTo(WORLD.ROAD_LEFT + 8, WORLD.HEIGHT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(WORLD.ROAD_RIGHT - 8, 0); ctx.lineTo(WORLD.ROAD_RIGHT - 8, WORLD.HEIGHT); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ---------- 拾取物 ----------
  function drawPickups(run) {
    for (const p of run.pickups) {
      if (p.dead) continue;
      const y = screenY(p.z);
      if (y < -80 || y > WORLD.HEIGHT + 80) continue;
      const x = laneX(p.lane);
      if (p.kind === 'gem') drawGem(x, y, run.time);
      else drawBalloon(x, y, run.time);
    }
  }

  function drawGem(x, y, time) {
    const s = 1.25 + Math.sin(time * 6 + x) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#35d0c9';
    ctx.strokeStyle = '#16161c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 17);
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#eaffff';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(6, -3);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBalloon(x, y, time) {
    const cy = y + Math.sin(time * 4 + x) * 4;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, cy + 22);
    ctx.quadraticCurveTo(x + 8, cy + 30, x + 4, cy + 40);
    ctx.stroke();
    const g = ctx.createRadialGradient(x - 6, cy - 6, 3, x, cy, 24);
    g.addColorStop(0, '#ffd7e8');
    g.addColorStop(1, '#ff6b9d');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, cy, 18, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(x - 6, cy - 8, 5, 7, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- 障碍 ----------
  function drawObstacles(run) {
    for (const o of run.obstacles) {
      if (o.dead) continue;
      const y = screenY(o.z);
      if (y < -140 || y > WORLD.HEIGHT + 140) continue;
      if (o.kind === 'gate') drawGate(o, y, run.time);
      else if (o.kind === 'pit') drawPit(laneX(o.lane), y);
      else if (o.kind === 'reverse') drawReverse(laneX(o.lane), y, run.time);
      else drawCar(laneX(o.lane), y, o.kind);
    }
  }

  function drawCar(x, y, kind) {
    ctx.save();
    ctx.translate(x, y);
    const body = kind === 'car' ? '#e8503a' : '#55678c';
    const roof = kind === 'car' ? '#b93a2a' : '#3f4c66';
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, -56, -70, 112, 140, 20);
    ctx.fill();
    // 车轮（露出四角，强化「车」的剪影）
    ctx.fillStyle = '#15151b';
    for (const [wx, wy] of [[-46, -40], [46, -40], [-46, 40], [46, 40]]) {
      ctx.beginPath();
      ctx.arc(wx, wy, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = body;
    rr(ctx, -52, -72, 104, 136, 18);
    ctx.fill();
    ctx.strokeStyle = '#16161c';
    ctx.lineWidth = 4;
    rr(ctx, -52, -72, 104, 136, 18);
    ctx.stroke();
    ctx.fillStyle = roof;
    rr(ctx, -36, -60, 72, 72, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#eafcff';
    rr(ctx, -28, -54, 24, 40, 6); ctx.fill();
    rr(ctx, 4, -54, 24, 40, 6); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(-44, -66, 16, 9);
    ctx.fillRect(28, -66, 16, 9);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(-44, 57, 16, 9);
    ctx.fillRect(28, 57, 16, 9);
    ctx.restore();
  }

  function drawReverse(x, y, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 14) * 0.06);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, -40, -54, 80, 108, 14); ctx.fill();
    ctx.fillStyle = '#15151b';
    for (const [wx, wy] of [[-36, -34], [36, -34], [-36, 34], [36, 34]]) {
      ctx.beginPath(); ctx.arc(wx, wy, 11, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd23f';
    rr(ctx, -38, -56, 76, 108, 14); ctx.fill();
    ctx.strokeStyle = '#16161c';
    ctx.lineWidth = 4;
    rr(ctx, -38, -56, 76, 108, 14); ctx.stroke();
    ctx.fillStyle = '#e0b030';
    rr(ctx, -30, -46, 60, 60, 8); ctx.fill();
    ctx.fillStyle = '#7a2f2f';
    ctx.fillRect(-20, -30, 12, 28);
    // 外卖箱封条（不用文字，避免裁切）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-30, -8, 60, 5);
    ctx.fillRect(-30, 2, 60, 5);
    ctx.restore();
  }

  function drawPit(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 52, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 46, 29, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawGate(o, y, time) {
    const x1 = WORLD.ROAD_LEFT;
    const w = WORLD.ROAD_RIGHT - WORLD.ROAD_LEFT;
    const red = o.state === 'red';
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x1 - 4, y - 14, w + 8, 28);
    ctx.fillStyle = red ? '#e23b3b' : '#37c96a';
    ctx.fillRect(x1, y - 12, w, 24);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x1, y - 12, w, 24);
    const glow = 1 + Math.sin(time * 8) * 0.25;
    ctx.fillStyle = red ? '#ff8a8a' : '#9dffc0';
    ctx.globalAlpha = 0.4 * glow;
    ctx.beginPath();
    ctx.arc(WORLD.WIDTH / 2, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = red ? '#ff3b3b' : '#37c96a';
    ctx.beginPath();
    ctx.arc(WORLD.WIDTH / 2, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(red ? '●' : '→', WORLD.WIDTH / 2, y + 4);
    ctx.restore();
  }

  // ---------- 玩家大鹅 ----------
  function drawPlayer(run) {
    const x = run.laneX;
    const y = PLAYER_Y;
    const bob = run.stopped ? Math.sin(run.time * 2) * 2 : Math.sin(run.time * 9) * 3;
    const tilt = clamp((run.laneX - 640) * 0.06, -0.16, 0.16);

    for (let i = 0; i < run.balloons; i += 1) {
      const bx = x + 34 + i * 26;
      const by = y - 84 - i * 10 + Math.sin(run.time * 3 + i) * 3;
      ctx.fillStyle = i === 0 ? '#ff6b9d' : '#ffd23f';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(bx, by, 13, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(tilt);
    ctx.scale(1.45, 1.45);
    // 白色光晕：让大鹅成为画面最亮主体
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 32, 32, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#16161c';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#eef1f5';
    ctx.beginPath();
    ctx.ellipse(-14, 6, 15, 9, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(6, -28, 12, 17, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff9d3f';
    ctx.strokeStyle = '#b85f14';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(15, -32);
    ctx.lineTo(30, -26);
    ctx.lineTo(15, -21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(11, -31, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(-6, -10);
    ctx.lineTo(12, -8);
    ctx.lineTo(12, -2);
    ctx.lineTo(-6, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a5a3a';
    rr(ctx, 24, 4, 18, 15, 3);
    ctx.fill();
    ctx.strokeStyle = '#4a3824';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawNightDim() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, 'rgba(10,8,30,0.25)');
    g.addColorStop(0.5, 'rgba(10,8,30,0)');
    g.addColorStop(1, 'rgba(10,8,30,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  // ---------- 总绘 ----------
  function draw(run, alpha = 1) {
    const scene = sceneFor(run ? (run.sceneReached || 1) : 1);
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.globalAlpha = 1;
    drawSky(scene);
    drawDecor(scene);
    drawRoad(scene, run ? run.distance : 0);
    if (!run) {
      drawPlayer({ laneX: 640, lane: 1, balloons: 0, stopped: false, time: 1.5 });
      drawCar(400, 260, 'car');
      return;
    }
    drawPickups(run);
    drawObstacles(run);
    drawPlayer(run);
    particles.update(1 / 60);
    particles.draw(ctx);
    if (scene.key === 'night') drawNightDim();
  }

  return {
    draw,
    burst: (x, y, color, n, speed) => particles.burst(x, y, color, n, speed),
    dove: (x, y) => particles.dove(x, y),
    get particles() { return particles; },
  };
}
