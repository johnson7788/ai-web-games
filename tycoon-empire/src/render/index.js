// src/render/index.js — Canvas 2D 场景渲染：三套色板（街角暖/市中心金/金融塔蓝紫）+ 主楼 + 粒子。
// 纯程序化，零外部素材。主楼是「点击主资产」的视觉目标；金链落成 = signature 动画。
import { WORLD } from '../../config/game.config.js';
import { INDUSTRIES, chapterOf, tapValue } from '../../config/gameplay.js';

const SCENES = [
  { // 街角（暖）
    skyTop: '#2a160c', skyBottom: '#e2903a',
    skylineFar: '#5a2f1c', skylineNear: '#3a1f12',
    building: '#8a4a22', buildingEdge: '#f0b060', window: '#ffdca0', glass: '#ffb35c',
  },
  { // 市中心（金）
    skyTop: '#221a08', skyBottom: '#f2c14a',
    skylineFar: '#6b5310', skylineNear: '#46360c',
    building: '#b8861f', buildingEdge: '#ffe08a', window: '#fff2c0', glass: '#ffd75e',
  },
  { // 金融塔顶（蓝紫）
    skyTop: '#0a0d2e', skyBottom: '#6a55e0',
    skylineFar: '#2a2f66', skylineNear: '#1a1d44',
    building: '#3a3f9e', buildingEdge: '#9fa8ff', window: '#e0e6ff', glass: '#8fa0ff',
  },
];

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function makeParticle(x, y, vx, vy, life, size, color, kind = 'coin') {
  return { x, y, vx, vy, life, maxLife: life, size, color, kind };
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];
  let t = 0;

  function burst(x, y, kind) {
    const n = kind === 'gold' ? 26 : kind === 'chain' ? 18 : 10;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 320;
      const color = kind === 'chain' ? '#ffd75e' : '#ffcf4a';
      const size = kind === 'coin' ? 3 + Math.random() * 4 : 4 + Math.random() * 6;
      particles.push(makeParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 140, 0.7 + Math.random() * 0.7, size, color, kind));
    }
  }

  function sky(scene) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, scene.skyTop);
    g.addColorStop(1, scene.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  // 背景楼群剪影
  function skyline(scene, rngOffset, yBase, h, color, windowColor, near) {
    ctx.fillStyle = color;
    const step = near ? 70 : 110;
    let x = rngOffset;
    while (x < WORLD.WIDTH + step) {
      const w = step * (0.5 + ((x * 7919 + 13) % 37) / 37 * 0.6);
      const bh = h * (0.35 + ((x * 104729 + 7) % 61) / 61 * 0.65);
      ctx.fillRect(x, yBase - bh, w, bh);
      if (windowColor && near) {
        ctx.fillStyle = windowColor;
        for (let wy = yBase - bh + 8; wy < yBase - 8; wy += 14) {
          for (let wx = x + 6; wx < x + w - 8; wx += 12) {
            if ((wx * 7 + wy * 13) % 5 === 0) ctx.fillRect(wx, wy, 5, 7);
          }
        }
        ctx.fillStyle = color;
      }
      x += w + 4;
    }
  }

  // 主楼（点击主资产）
  function tower(scene, floors, totalLevel, alpha) {
    const cx = 430;
    const baseY = 620;
    const w = 170;
    const floorH = 24;
    const h = 80 + floors * floorH;
    const x = cx - w / 2;
    const y = baseY - h;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 8, w * 0.7, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 楼体
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, scene.buildingEdge);
    g.addColorStop(0.25, scene.building);
    g.addColorStop(0.75, scene.building);
    g.addColorStop(1, scene.buildingEdge);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // 楼层线 + 窗
    for (let f = 0; f < floors; f += 1) {
      const fy = y + (f + 1) * floorH;
      ctx.fillStyle = scene.buildingEdge;
      ctx.fillRect(x, fy, w, 3);
      ctx.fillStyle = scene.window;
      for (let wx = x + 18; wx < x + w - 18; wx += 30) {
        if ((wx * 31 + f * 17) % 3 !== 0) {
          ctx.fillRect(wx, fy - floorH + 7, 14, 10);
        } else {
          ctx.fillStyle = scene.glass;
          ctx.fillRect(wx, fy - floorH + 7, 14, 10);
          ctx.fillStyle = scene.window;
        }
      }
    }

    // 塔尖（银行标志）
    ctx.fillStyle = scene.buildingEdge;
    ctx.beginPath();
    ctx.moveTo(cx - 26, y);
    ctx.lineTo(cx, y - 44);
    ctx.lineTo(cx + 26, y);
    ctx.closePath();
    ctx.fill();

    // 金边 + 招牌
    ctx.fillStyle = '#ffd75e';
    ctx.fillRect(x - 6, y - 8, w + 12, 6);
    ctx.fillRect(x - 6, y - 8, 6, 16);
    ctx.fillRect(x + w, y - 8, 6, 16);

    // 点击脉冲
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.strokeStyle = `rgba(255, 215, 94, ${0.35 + 0.3 * pulse})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(x - 12, y - 16, w + 24, h + 28);
  }

  function signatureFx(sig, now) {
    if (!sig) return;
    const elapsed = now - sig.at;
    if (elapsed < 0 || elapsed > sig.dur) return;
    const p = elapsed / sig.dur;
    const cx = 430;
    const baseY = 620;
    const riseY = baseY - 60 - p * 480;

    // 金链：从楼底窜到楼顶
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 8;
    ctx.shadowColor = '#ffd75e';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    for (let i = 0; i <= 20; i += 1) {
      const yy = riseY + i * 22 * (1 - p * 0.3);
      const xx = cx + Math.sin(i * 0.9 + t * 6) * 14;
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 落成闪光
    const flash = Math.max(0, 1 - p * 3);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 236, 170, ${flash})`;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === 'chain') {
        ctx.fillRect(p.x - p.size, p.y - p.size / 2, p.size * 2, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function draw(run, alpha, dt) {
    t += dt || 0;
    const chapter = run ? chapterOf(run.unlockedCount) : 0;
    const scene = SCENES[chapter];

    sky(scene);

    // 背景剪影（远近两层）
    skyline(scene, -20, 560, 220, scene.skylineFar, null, false);
    skyline(scene, -60, 600, 160, scene.skylineNear, scene.window, true);

    if (run) {
      const totalLevel = run.industries.reduce((s, ind) => s + (ind.owned ? ind.level : 0), 0);
      const floors = clamp(3 + run.unlockedCount + Math.min(6, Math.floor(Math.log2(totalLevel + 1))), 4, 22);
      tower(scene, floors, totalLevel, alpha);
      signatureFx(run.signature, run.time);
    } else {
      tower(scene, 6, 0, 1);
    }

    drawParticles(dt || 0);
  }

  return { draw, burst };
}
