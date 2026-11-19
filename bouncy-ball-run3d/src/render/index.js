// BOUNCY BALL RUN3D · Canvas 2D 伪 3D 渲染（透视投影 + 深度排序的段块盒）
// 零依赖零素材：塔/球/宝石/粒子全部程序化绘制。霓虹街机统一配色。
import { WORLD, TOWER } from '../../config/game.config.js';

const T = TOWER;
const DEG = Math.PI / 180;

// ---------- 向量 / 矩阵（列主序 4x4，OpenGL 约定） ----------

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

function multiply(out, a, b) {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let row = 0; row < 4; row += 1) {
      let s = 0;
      for (let k = 0; k < 4; k += 1) s += a[k * 4 + row] * b[c * 4 + k];
      r[c * 4 + row] = s;
    }
  }
  out.set(r);
  return out;
}

function lookAt(out, eye, target, up) {
  const z = norm(sub(eye, target));
  const x = norm(cross(up, z));
  const y = cross(z, x);
  out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
  out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
  out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
  out[12] = -dot(x, eye); out[13] = -dot(y, eye); out[14] = -dot(z, eye); out[15] = 1;
  return out;
}

function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

// ---------- 配色（霓虹街机） ----------

const BG = ['#0b0b1e', '#1a1035'];
const COL = {
  safe:  { top: '#9b5cff', side: '#5a2fa0', edge: '#c9a6ff' },
  danger:{ top: '#ff2e63', side: '#a01238', edge: '#ff7a9c' },
  rock:  { top: '#ffa726', side: '#a86a14', edge: '#ffd08a' },
  gem:   { top: '#ffd23f', edge: '#fff0b0' },
  ball:  { a: '#ffffff', b: '#37e6ff' },
  column:{ top: '#241a45', side: '#1a1234' },
};

const SEG_COLORS = { safe: COL.safe, danger: COL.danger, rock: COL.rock };

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

// ---------- 渲染器 ----------

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  canvas.width = W;
  canvas.height = H;

  const particles = [];
  const trail = [];
  const vp = new Float32Array(16);
  const view = new Float32Array(16);
  const proj = new Float32Array(16);
  let eye = [0, 0, 0];

  function project(v, x, y, z) {
    const w = v[3] * x + v[7] * y + v[11] * z + v[15];
    const cx = v[0] * x + v[4] * y + v[8] * z + v[12];
    const cy = v[1] * x + v[5] * y + v[9] * z + v[13];
    return { x: cx, y: cy, w };
  }

  function toScreen(p) {
    if (p.w <= 0.02) return null;
    return { x: (p.x / p.w + 1) / 2 * W, y: (1 - p.y / p.w) / 2 * H, w: p.w };
  }

  function worldToScreen(x, y, z) {
    return toScreen(project(vp, x, y, z));
  }

  function dist2(x, y, z) {
    const dx = x - eye[0];
    const dy = y - eye[1];
    const dz = z - eye[2];
    return dx * dx + dy * dy + dz * dz;
  }

  function computeCamera(ballY) {
    eye = [0, ballY + 8, 14];
    const target = [0, ballY + 0.2, 0];
    lookAt(view, eye, target, [0, 1, 0]);
    perspective(proj, 50 * DEG, W / H, 0.1, 220);
    multiply(vp, proj, view);
  }

  // 绕 Y 轴旋转
  function rotY(x, z, rad) {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return [x * c + z * s, -x * s + z * c];
  }

  // 段块盒的 8 个世界角点（局部：切向半宽 tw、半高 th、径向 [z0,z1]）
  function boxCorners(discY, angleDeg, tw, th, z0, z1) {
    const rad = angleDeg * DEG;
    const ys = [discY - th, discY + th];
    const corners = [];
    for (let iy = 0; iy < 2; iy += 1) {
      for (const [lx, lz] of [[-tw, z0], [tw, z0], [tw, z1], [-tw, z1]]) {
        const [x, z] = rotY(lx, lz, rad);
        corners.push([x, ys[iy], z]);
      }
    }
    return corners; // 顺序：0..3 bottom, 4..7 top
  }

  function faceNormal(a, b, c) {
    const u = sub(b, a);
    const v = sub(c, a);
    return cross(u, v);
  }

  function drawBox(corners, col) {
    const p = corners.map((c) => project(vp, c[0], c[1], c[2]));
    const s = [];
    for (const q of p) {
      if (q.w <= 0.02) return;
      s.push([(q.x / q.w + 1) / 2 * W, (1 - q.y / q.w) / 2 * H]);
    }
    const faces = [
      { idx: [0, 1, 2, 3], color: shade(col.side, 0.55) },
      { idx: [4, 5, 6, 7], color: col.top },
      { idx: [0, 3, 7, 4], color: col.side },
      { idx: [1, 2, 6, 5], color: col.side },
      { idx: [0, 1, 5, 4], color: col.side },
      { idx: [2, 3, 7, 6], color: col.side },
    ];
    for (const f of faces) {
      const a = corners[f.idx[0]];
      const b = corners[f.idx[1]];
      const c = corners[f.idx[2]];
      const n = faceNormal(a, b, c);
      const centroid = [
        (a[0] + b[0] + c[0]) / 3,
        (a[1] + b[1] + c[1]) / 3,
        (a[2] + b[2] + c[2]) / 3,
      ];
      const viewDir = [eye[0] - centroid[0], eye[1] - centroid[1], eye[2] - centroid[2]];
      if (dot(n, viewDir) <= 0) continue;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.moveTo(s[f.idx[0]][0], s[f.idx[0]][1]);
      ctx.lineTo(s[f.idx[1]][0], s[f.idx[1]][1]);
      ctx.lineTo(s[f.idx[2]][0], s[f.idx[2]][1]);
      ctx.lineTo(s[f.idx[3]][0], s[f.idx[3]][1]);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, BG[0]);
    g.addColorStop(1, BG[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 星点
    ctx.fillStyle = 'rgba(180,200,255,0.5)';
    for (let i = 0; i < 60; i += 1) {
      const sx = (i * 137.5 + 41) % W;
      const sy = (i * 97.3 + 13) % Math.floor(H * 0.5);
      const tw = 0.4 + 0.7 * Math.abs(Math.sin(time * 0.6 + i));
      ctx.globalAlpha = tw;
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;

    // 远处地平线光晕（合成器太阳）
    const sun = ctx.createRadialGradient(W / 2, H * 0.36, 10, W / 2, H * 0.36, H * 0.5);
    sun.addColorStop(0, 'rgba(255,46,99,0.22)');
    sun.addColorStop(0.5, 'rgba(122,43,214,0.10)');
    sun.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
  }

  function spawn(type, x, y) {
    const defs = {
      bounce: { color: '#19e3ff', n: 8, spread: 70, up: -120, life: 0.45 },
      pass:   { color: '#37e6ff', n: 5, spread: 40, up: -60, life: 0.35 },
      gem:    { color: '#ffd23f', n: 12, spread: 100, up: -140, life: 0.6 },
      crumble:{ color: '#ffa726', n: 10, spread: 90, up: -100, life: 0.55 },
      die:    { color: '#ff2e63', n: 24, spread: 160, up: -200, life: 0.8 },
      combo:  { color: '#ffd23f', n: 6, spread: 60, up: -90, life: 0.4 },
    };
    const d = defs[type];
    if (!d) return;
    for (let i = 0; i < d.n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * d.spread;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp + d.up,
        life: d.life,
        max: d.life,
        color: d.color,
        r: 1.5 + Math.random() * 2.5,
      });
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }

  function render(sim, effects = []) {
    computeCamera(sim.state.ball.y);
    drawBackground(sim.state.time);

    const drawables = [];

    // 中心柱（从球下方贯穿到塔底；球上方的已过层段裁剪掉，避免顶到 HUD）
    let maxY = -Infinity;
    let minY = Infinity;
    for (const d of sim.discs) {
      if (d.y > maxY) maxY = d.y;
      if (d.y < minY) minY = d.y;
    }
    const colTop = sim.state.ball.y + 2;
    const colBottom = minY - T.THICK;
    const colMid = (colTop + colBottom) / 2;
    const colHalf = (colTop - colBottom) / 2;
    const colCorners = boxCorners(colMid, 0, 0.72, colHalf, -0.72, 0.72);
    drawables.push({ d: dist2(0, colMid, 0), kind: 'box', corners: colCorners, col: COL.column });

    const cullY = sim.state.ball.y + 4;

    // 段块盒（跳过缺口；裁剪球上方层段）
    for (const disc of sim.discs) {
      if (disc.y > cullY) continue;
      const tw = T.SEG_W / 2;
      const th = T.THICK / 2;
      const z0 = T.RADIUS - T.SEG_D / 2;
      const z1 = T.RADIUS + T.SEG_D / 2;
      for (let k = 0; k < T.N_SLOTS; k += 1) {
        const type = disc.slots[k];
        const col = SEG_COLORS[type];
        if (!col) continue;
        const angle = disc.rotOffset + sim.state.towerRot + k * T.SEG_ARC + T.SEG_ARC / 2;
        const corners = boxCorners(disc.y, angle, tw, th, z0, z1);
        const cx = (corners[0][0] + corners[6][0]) / 2;
        const cy = disc.y;
        const cz = (corners[0][2] + corners[6][2]) / 2;
        drawables.push({ d: dist2(cx, cy, cz), kind: 'box', corners, col });
      }
    }

    // 宝石（在 gem 槽位置悬浮；裁剪球上方层段）
    for (const disc of sim.discs) {
      if (disc.y > cullY) continue;
      for (let k = 0; k < T.N_SLOTS; k += 1) {
        if (disc.slots[k] !== 'gem') continue;
        const angle = (disc.rotOffset + sim.state.towerRot + k * T.SEG_ARC + T.SEG_ARC / 2) * DEG;
        const gx = Math.sin(angle) * T.RADIUS;
        const gz = Math.cos(angle) * T.RADIUS;
        const gy = disc.y + T.THICK + 1.1;
        drawables.push({ d: dist2(gx, gy, gz), kind: 'gem', x: gx, y: gy, z: gz });
      }
    }

    // 球
    const bx = 0;
    const bz = T.RADIUS;
    const by = sim.state.ball.y;
    drawables.push({ d: dist2(bx, by, bz), kind: 'ball', x: bx, y: by, z: bz });

    // 深度排序（远→近）
    drawables.sort((a, b) => b.d - a.d);

    for (const item of drawables) {
      if (item.kind === 'box') drawBox(item.corners, item.col);
    }
    // 宝石 / 球单独在盒子上层绘制（保证可见）
    for (const item of drawables) {
      if (item.kind === 'gem') drawGem(item.x, item.y, item.z, sim.state.time);
    }
    for (const item of drawables) {
      if (item.kind === 'ball') drawBall(item.x, item.y, item.z);
    }
    drawCombo(sim);

    // 粒子（先更新再画，屏幕空间）
    updateParticles(1 / 60);
    drawGoalIndicator(sim.state.time);

    // 效果触发粒子（球屏幕位置）
    const bs = worldToScreen(bx, by, bz);
    if (bs && effects.length) {
      for (const e of effects) {
        if (['bounce', 'pass', 'gem', 'crumble', 'die', 'combo'].includes(e.type)) {
          spawn(e.type, bs.x, bs.y);
        }
      }
    }
  }

  function drawCombo(sim) {
    if (sim.state.combo < 2) return;
    const s = worldToScreen(0, sim.state.ball.y, T.RADIUS);
    if (!s) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 18px "Courier New", monospace';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(`COMBO x${sim.state.combo}`, s.x, s.y - 46);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(`COMBO x${sim.state.combo}`, s.x, s.y - 46);
    ctx.restore();
  }

  function drawGem(x, y, z, time) {
    const s = worldToScreen(x, y, z);
    if (!s) return;
    const bob = Math.sin(time * 4 + x * 3) * 3;
    const r = 11;
    const pulse = 1 + 0.18 * Math.sin(time * 5 + x * 2);
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    // 光晕
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.6 * pulse);
    halo.addColorStop(0, 'rgba(255,230,120,0.9)');
    halo.addColorStop(0.4, 'rgba(255,190,40,0.45)');
    halo.addColorStop(1, 'rgba(255,160,20,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.6 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // 菱形主体
    const g = ctx.createRadialGradient(0, -r * 0.3, 1, 0, 0, r);
    g.addColorStop(0, '#fff8dc');
    g.addColorStop(0.5, COL.gem.top);
    g.addColorStop(1, '#ff8f1f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.62, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.62, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COL.gem.edge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawBall(x, y, z) {
    const s = worldToScreen(x, y, z);
    if (!s) return;
    // 参考点求像素半径
    const rp = worldToScreen(x + T.BALL_R, y, z);
    const r = rp ? Math.hypot(rp.x - s.x, rp.y - s.y) : 14;

    // 轨迹
    trail.push({ x: s.x, y: s.y, r });
    if (trail.length > 14) trail.shift();
    for (let i = 0; i < trail.length; i += 1) {
      const t = trail[i];
      const a = (i / trail.length) * 0.35;
      ctx.fillStyle = `rgba(55,230,255,${a})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * (0.4 + 0.6 * i / trail.length), 0, Math.PI * 2);
      ctx.fill();
    }

    // 外圈光晕（让玩家球从背景里跳出来）
    const glow = ctx.createRadialGradient(s.x, s.y, r * 0.3, s.x, s.y, r * 2.4);
    glow.addColorStop(0, 'rgba(255,255,255,0.85)');
    glow.addColorStop(0.4, 'rgba(55,230,255,0.35)');
    glow.addColorStop(1, 'rgba(55,230,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createRadialGradient(s.x - r * 0.3, s.y - r * 0.3, r * 0.1, s.x, s.y, r * 1.15);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, COL.ball.b);
    g.addColorStop(1, '#0a5f9e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#eafcff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 目标指示：屏幕底部中央的脉冲下行箭头（「目标是继续向下」）
  function drawGoalIndicator(time) {
    const cx = W / 2;
    const cy = H - 44;
    const pulse = 1 + 0.12 * Math.sin(time * 5);
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 48 * pulse);
    glow.addColorStop(0, 'rgba(255,210,63,0.55)');
    glow.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 48 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i += 1) {
      const yy = cy - 18 + i * 13;
      const half = 20 - i * 5;
      ctx.globalAlpha = 0.5 + i * 0.25;
      ctx.beginPath();
      ctx.moveTo(cx - half, yy);
      ctx.lineTo(cx, yy + 12);
      ctx.lineTo(cx + half, yy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd23f';
    ctx.font = '700 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GOAL', cx, cy + 18);
    ctx.restore();
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += 320 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { render };
}
