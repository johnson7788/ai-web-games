// src/render/index.js — createRender 装配：Mode7 地板 + 卡丁车精灵 + 糖霜拖尾 + 蛋糕糊屏。
// 渲染纯消费 sim 状态，不写游戏逻辑。契约：createRender(canvas) → { draw(run, interp), resize() }。
import {
  WORLD, DPR_CAP, CAMERA, FLOOR, KART_SPRITE, scene, clamp, rgbCss, PLAYER_COLOR, PLAYER_ACCENT, AI_COLORS,
} from './theme.js';
import { renderTrackMap } from './trackmap.js';
import { renderFloor } from './mode7.js';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function makeTrackPreview(track, sceneIdx) {
  // 标题屏：俯视赛道预览（直接画贴图即可，带暗角）
  return renderTrackMap(track, sceneIdx);
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let trackMap = null;
  let trackMapScene = -1;
  let floorCanvas = document.createElement('canvas');
  let particles = [];   // { x, y, vx, vy, r, life, maxLife, color, kind }
  let lastNow = 0;

  function resize() {
    const dpr = clamp(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1, DPR_CAP);
    const cssW = canvas.clientWidth || WORLD.WIDTH;
    const cssH = canvas.clientHeight || WORLD.HEIGHT;
    const scale = Math.min(cssW / WORLD.WIDTH, cssH / WORLD.HEIGHT);
    const ox = (cssW - WORLD.WIDTH * scale) / 2;
    const oy = (cssH - WORLD.HEIGHT * scale) / 2;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  }

  function ensureTrackMap(track, sceneIdx) {
    if (trackMapScene !== sceneIdx || !trackMap) {
      trackMap = makeTrackPreview(track, sceneIdx);
      trackMapScene = sceneIdx;
    }
  }

  function project(wx, wy, camX, camY, angle) {
    const dx = wx - camX;
    const dy = wy - camY;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const dz = dx * cosA + dy * sinA;
    const l = -dx * sinA + dy * cosA;
    return { dz, l };
  }

  function toScreen(dz, l) {
    if (dz < 1) return null;
    return {
      x: WORLD.WIDTH / 2 + (l / dz) * CAMERA.FOCAL,
      y: CAMERA.HORIZON + (CAMERA.HEIGHT * CAMERA.FOCAL) / dz,
      s: CAMERA.FOCAL / dz, // 像素/世界单位
    };
  }

  // 车尾视角卡丁车精灵（billboard，始终面向镜头）
  function drawKart(px, py, size, color, accent, tilt) {
    const w = Math.max(14, size);
    const h = w * 0.92;
    ctx.save();
    ctx.translate(px, py);
    if (tilt) ctx.rotate(tilt);
    // 轮胎
    ctx.fillStyle = '#1b1b1f';
    ctx.beginPath();
    ctx.ellipse(-w * 0.42, -h * 0.42, w * 0.14, h * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.42, -h * 0.42, w * 0.14, h * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(-w * 0.42, h * 0.42, w * 0.14, h * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.42, h * 0.42, w * 0.14, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // 车身
    ctx.fillStyle = color;
    roundRect(ctx, -w * 0.34, -h * 0.46, w * 0.68, h * 0.92, w * 0.12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 8, 16, 0.85)';
    ctx.lineWidth = Math.max(1.5, w * 0.06);
    ctx.stroke();
    ctx.fillStyle = accent;
    roundRect(ctx, -w * 0.34, -h * 0.14, w * 0.68, h * 0.24, w * 0.08);
    ctx.fill();
    // 驾驶员头盔
    ctx.fillStyle = '#fff7e6';
    ctx.beginPath();
    ctx.arc(0, -h * 0.02, w * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, -h * 0.02, w * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function spawnTrail(px, py, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x: px + (Math.random() - 0.5) * 10,
        y: py + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() * 0.5 + 0.3) * speed,
        r: 3 + Math.random() * 5,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.5,
        color,
        kind: 'cream',
      });
    }
  }

  function updateParticles(dt) {
    const next = [];
    for (const p of particles) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'cream') { p.r *= 1 + dt * 1.4; p.vx *= 0.9; }
      next.push(p);
    }
    if (next.length > 320) next.splice(0, next.length - 320);
    particles = next;
  }

  function drawParticles() {
    for (const p of particles) {
      const a = 1 - p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTitle() {
    // 天空渐变 + 俯视赛道预览
    const sc = scene(1);
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, sc.skyTop);
    g.addColorStop(1, sc.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    if (trackMap) {
      const s = Math.min(WORLD.WIDTH / trackMap.width, WORLD.HEIGHT / trackMap.height);
      const w = trackMap.width * s;
      const h = trackMap.height * s;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(trackMap, (WORLD.WIDTH - w) / 2, (WORLD.HEIGHT - h) / 2, w, h);
      ctx.globalAlpha = 1;
    }
  }

  function drawCakeBlind(charge) {
    // 蛋糕糊屏：奶油层 + 糖粒 + 边缘糊块
    const a = 0.5 + 0.2 * charge;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff2f7';
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.fillStyle = '#ff9ecb';
    for (let i = 0; i < 26; i += 1) {
      const x = (i * 197.3) % WORLD.WIDTH;
      const y = (i * 89.7) % WORLD.HEIGHT;
      ctx.beginPath();
      ctx.arc(x, y, 18 + (i % 5) * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i += 1) {
      ctx.beginPath();
      ctx.arc((i * 53.1) % WORLD.WIDTH, (i * 131.9) % WORLD.HEIGHT, 3 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFinishGate(track, camX, camY, angle) {
    // 终点格纹拱门：明确「目标」所在（进度 0）
    const s = track.sampleAt(0);
    const nx = -Math.sin(s.angle);
    const ny = Math.cos(s.angle);
    const cx = s.x;
    const cy = s.y;
    const proj = project(cx, cy, camX, camY, angle);
    const scr = toScreen(proj.dz, proj.l);
    if (!scr) return;
    const w = s.halfWidth * 2 * scr.s;
    const h = 64 * scr.s;
    if (w < 4) return;
    const left = scr.x - w / 2;
    const top = scr.y - h;
    const cols = 8;
    const rows = 2;
    const cw = w / cols;
    const ch = h / rows;
    ctx.save();
    // 立柱
    ctx.fillStyle = '#ffffff';
    const poleW = Math.max(3, w * 0.03);
    ctx.fillRect(left - poleW, top, poleW, h);
    ctx.fillRect(left + w, top, poleW, h);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#1b1b1f';
        ctx.fillRect(left + c * cw, top + r * ch, cw + 0.5, ch + 0.5);
      }
    }
    if (scr.s > 1.2) {
      ctx.fillStyle = '#ff2e7e';
      ctx.font = `700 ${Math.round(18 * scr.s)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FINISH', scr.x, top + h * 0.25);
    }
    ctx.restore();
  }

  function drawMinimap(run) {
    // 顶部中央小地图：赛道环 + 终点旗 + 车手点（目标始终可见）
    const cx = WORLD.WIDTH / 2;
    const cy = 88;
    const R = 58;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = 'rgba(30, 9, 20, 0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 95, 158, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 赛道环（缩放世界坐标 → 小地图）
    const maxR = 720;
    const k = R / maxR;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= run.track.samples.length; i += 1) {
      const p = run.track.samples[i % run.track.samples.length];
      const mx = cx + p.x * k;
      const my = cy + p.y * k;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.stroke();

    // 终点旗（进度 0）
    const fin = run.track.sampleAt(0);
    ctx.fillStyle = '#ff2e7e';
    ctx.beginPath();
    ctx.arc(cx + fin.x * k, cy + fin.y * k, 4, 0, Math.PI * 2);
    ctx.fill();

    // 车手点
    for (const kk of run.karts) {
      if (kk.finished) continue;
      const p = run.track.sampleAt(kk.progress);
      ctx.fillStyle = kk.isPlayer ? '#ff2e7e' : '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + p.x * k, cy + p.y * k, kk.isPlayer ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (kk.isPlayer) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;

    // 清屏（letterbox 黑边）
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0810';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    resize();

    updateParticles(dt);

    if (!run) {
      drawTitle();
      return;
    }

    const sceneIdx = run.scene || 1;
    const sc = scene(sceneIdx);
    ensureTrackMap(run.track, sceneIdx);

    const player = run.player;
    const sample = run.track.sampleAt(player.progress);
    const cosA = Math.cos(sample.angle);
    const sinA = Math.sin(sample.angle);
    // 玩家世界位置（中心线 + 横向偏移）
    const px = sample.x + Math.sin(sample.angle) * player.lane;
    const py = sample.y - Math.cos(sample.angle) * player.lane;

    // Mode7 地板
    floorCanvas = renderFloor(trackMap, px, py, sample.angle, sceneIdx);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(floorCanvas, 0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // AI 卡丁车（按深度远→近）
    const ais = run.karts.slice(1)
      .filter((k) => !k.finished)
      .map((k) => {
        const s = run.track.sampleAt(k.progress);
        const wx = s.x + Math.sin(s.angle) * k.lane;
        const wy = s.y - Math.cos(s.angle) * k.lane;
        const proj = project(wx, wy, px, py, sample.angle);
        const scr = toScreen(proj.dz, proj.l);
        return { k, scr, dz: proj.dz };
      })
      .filter((a) => a.scr)
      .sort((a, b) => b.dz - a.dz);

    for (const a of ais) {
      const size = KART_SPRITE.W * a.scr.s * 1.15;
      drawKart(a.scr.x, a.scr.y, size, AI_COLORS[(Number(a.k.id.slice(2)) - 1) % AI_COLORS.length], '#ffffff', 0);
    }

    // 终点格纹拱门
    drawFinishGate(run.track, px, py, sample.angle);

    // 玩家卡丁车（固定屏幕位置，含转向倾斜）
    const hud = run.getHud();
    const playerSize = 72;
    const tilt = clamp(player.laneV * 0.002, -0.25, 0.25);
    drawKart(WORLD.WIDTH / 2, WORLD.HEIGHT * 0.72, playerSize, PLAYER_COLOR, PLAYER_ACCENT, tilt);

    // 糖霜拖尾（signature：满蓄时车尾拉出奶油拖尾）
    if (player.driftCharge > 0.02 && !reduceMotion) {
      const rearY = WORLD.HEIGHT * 0.72 + 20;
      const charge = player.driftCharge;
      spawnTrail(WORLD.WIDTH / 2, rearY, charge > 0.66 ? '#ffd6ec' : '#fff2f7', Math.round(1 + charge * 3), 40 + charge * 40);
    }
    // 加速火焰
    if (hud.speed > 140) {
      spawnTrail(WORLD.WIDTH / 2, WORLD.HEIGHT * 0.72 + 26, '#ffe08a', 2, 90);
    }

    drawParticles();

    // 小地图（目标始终可见）
    drawMinimap(run);

    // 蛋糕糊屏（AI 用蛋糕糊玩家）
    if (hud.blind) drawCakeBlind(clamp((player.blindUntil - run.time) / 2, 0, 1));
  }

  resize();

  return { draw, resize };
}

export default createRender;
