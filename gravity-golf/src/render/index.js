// Canvas 2D 渲染：天空(渐变/星云/星/远景星球) + 视差地形 + 地表纹理 + 标尺旗 + 月球环形坑
// + 球拖尾/冲击环/火焰 + 球手三姿态挥杆/落地扬尘。摄像机跟随球、震屏、调色板交叉淡化。
import { WORLD, GOLF, PLANETS, CAMERA, FX } from '../../config/game.config.js';
import { groundY } from '../game/sim.js';

const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
function rgbCss(c, alpha = 1) {
  return alpha >= 1
    ? `rgb(${c[0]},${c[1]},${c[2]})`
    : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}
function mixCss(hexA, hexB, t) {
  return rgbCss(mixRgb(hexToRgb(hexA), hexToRgb(hexB), t));
}

function hash2(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  const a = hash2(seed, i);
  const b = hash2(seed, i + 1);
  return a + (b - a) * s;
}

// 地表纹理种类：按星球 id 给程序化静态纹理（固定 seed，不随帧变）
const TEX = { moon: 'pebble', mars: 'gravel', ice: 'snow', lava: 'crack', gas: 'pebble', ring: 'sand' };

const PAL_KEYS = ['skyTop', 'skyBottom', 'far', 'mid', 'ground', 'groundDark', 'accent', 'orb', 'orbGlow'];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cam = { x: 0, y: 0 };
  let lastPlanetIndex = -1;
  let palFrom = null;
  let palTo = null;
  let palBlend = 1;
  let shakeMag = 0;
  let lastNow = 0;
  let swingT = 0;
  let lastGolferState = 'idle';
  let burnBurstDone = false;

  const trail = [];
  const parts = [];
  const rings = [];
  const floats = [];
  let fireAcc = 0;

  const stars = [];
  for (let i = 0; i < 130; i += 1) {
    const big = i < 14;
    stars.push({
      x: hash2(11, i) * 2600,
      y: hash2(22, i) * 480,
      r: big ? 1.4 + hash2(33, i) * 1.6 : 0.6 + hash2(33, i) * 1.1,
      tw: 1 + hash2(44, i) * 2.5,
      ph: hash2(55, i) * TAU,
      tint: i % 9 === 0 ? (i % 18 === 0 ? '#9fb8ff' : '#ffd9a0') : '#ffffff',
      glint: big,
    });
  }

  // 星云团（位置/大小固定，颜色随星球调色板）
  const NEBULAS = [
    { x: 250, y: 150, r: 210, key: 'accent', a: 0.10 },
    { x: 720, y: 90, r: 250, key: 'orb', a: 0.09 },
    { x: 1080, y: 220, r: 190, key: 'accent', a: 0.07 },
    { x: 540, y: 280, r: 160, key: 'orb', a: 0.06 },
  ];

  function paletteOf(run) {
    return PLANETS[run.planetIndex].palette;
  }

  function currentPalette(run) {
    if (palBlend >= 1 || !palFrom) return paletteOf(run);
    const t = palBlend * palBlend * (3 - 2 * palBlend);
    const from = palFrom;
    const to = palTo || paletteOf(run);
    const out = {};
    for (const k of PAL_KEYS) {
      out[k] = rgbCss(mixRgb(hexToRgb(from[k]), hexToRgb(to[k]), t));
    }
    return out;
  }

  function startPaletteFade(run) {
    palFrom = currentPalette(run);
    palTo = paletteOf(run);
    palBlend = 0;
  }

  function shake(mag) {
    if (reduceMotion) return;
    shakeMag = Math.min(FX.SHAKE_SCALE, Math.max(shakeMag, mag));
  }

  function burst(x, y, n, colors, spread = 120, up = 90) {
    for (let i = 0; i < n; i += 1) {
      parts.push({
        x, y,
        vx: (Math.random() - 0.5) * spread,
        vy: -Math.random() * up,
        grav: 300,
        life: 0.4 + Math.random() * 0.3,
        ttl: 0.7,
        size: 1.5 + Math.random() * 2.5,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
  }

  function ring(x, y, size, color = '#ffffff') {
    rings.push({ x, y, size, life: 0.5, ttl: 0.5, color });
  }

  function fireBurst(x, y) {
    for (let i = 0; i < 40; i += 1) {
      parts.push({
        x, y,
        vx: (Math.random() - 0.5) * 300,
        vy: -60 - Math.random() * 260,
        grav: 120,
        life: 0.5 + Math.random() * 0.5,
        ttl: 1,
        size: 2.5 + Math.random() * 4,
        color: Math.random() < 0.5 ? '#ffb347' : '#ff5a1f',
        glow: true,
      });
    }
  }

  function floatText(x, y, text, color) {
    floats.push({ x, y, text, color, life: 1.2, ttl: 1.2 });
  }

  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
    }
  }

  // ---------- 天空 ----------

  function drawSky(pal, camX, camY, now) {
    // 三段渐变：深空 → 中间色 → 地平线微光
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(0.55, mixCss(pal.skyTop, pal.skyBottom, 0.6));
    g.addColorStop(1, mixCss(pal.skyBottom, pal.accent, 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星云：低透明度径向色块
    for (const n of NEBULAS) {
      const nx = n.x - camX * 0.02;
      const ny = n.y - camY * 0.02;
      const rgb = hexToRgb(pal[n.key]);
      const rg = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r);
      rg.addColorStop(0, rgbCss(rgb, n.a));
      rg.addColorStop(1, rgbCss(rgb, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(nx - n.r, ny - n.r, n.r * 2, n.r * 2);
    }

    drawPlanets(pal, camX, camY);
    drawOrb(pal, camX, camY);

    // 星：大小/闪烁相位不同，亮星带十字辉光
    for (const s of stars) {
      const sx = ((s.x - camX * 0.15) % 2600 + 2600) % 2600 - 400;
      if (sx < -10 || sx > WORLD.WIDTH + 10) continue;
      const sy = s.y - camY * 0.1;
      const a = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.001 * s.tw + s.ph));
      ctx.globalAlpha = a;
      if (s.glint) {
        ctx.fillStyle = s.tint;
        ctx.fillRect(sx - s.r * 2, sy, s.r * 4, s.r);
        ctx.fillRect(sx, sy - s.r * 2, s.r, s.r * 4);
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = s.tint;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // 远景星球：一颗带环气态星 + 一颗新月（视差极慢，位置随镜头缓动）
  function drawPlanets(pal, camX, camY) {
    const body = hexToRgb(pal.orb);
    const ringCol = hexToRgb(pal.accent);

    // 带环星球（右上）
    const px = 1120 - camX * 0.04;
    const py = 120 - camY * 0.04;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.42);
    ctx.strokeStyle = rgbCss(ringCol, 0.55);
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 15, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = rgbCss(mixRgb(body, ringCol, 0.35));
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,14,30,0.35)';
    ctx.beginPath();
    ctx.arc(-8, -6, 19, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 新月（左上）
    const cx = 150 - camX * 0.06;
    const cy = 96 - camY * 0.06;
    ctx.fillStyle = rgbCss(body, 0.9);
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.skyTop;
    ctx.beginPath();
    ctx.arc(cx + 7, cy - 6, 16, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgbCss(ringCol, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 15.5, Math.PI * 0.75, Math.PI * 1.6);
    ctx.stroke();
  }

  // 主星球（天空中的月球）：外圈光晕 + 环形坑（深浅两层）+ 边缘高光 + 明暗面
  function drawOrb(pal, camX, camY) {
    const ox = 980 - camX * 0.06;
    const oy = 150 - camY * 0.06;
    const R = 58;

    // 外圈光晕（径向渐变）
    const halo = ctx.createRadialGradient(ox, oy, R * 0.55, ox, oy, R * 1.8);
    const orbRgb = hexToRgb(pal.orb);
    halo.addColorStop(0, rgbCss(orbRgb, 0.5));
    halo.addColorStop(1, rgbCss(orbRgb, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(ox, oy, R * 1.8, 0, TAU);
    ctx.fill();

    // 球体本体
    ctx.fillStyle = pal.orb;
    ctx.beginPath();
    ctx.arc(ox, oy, R, 0, TAU);
    ctx.fill();

    // 暗面（右下渐变）
    const sh = ctx.createRadialGradient(ox + R * 0.35, oy + R * 0.35, R * 0.1, ox + R * 0.35, oy + R * 0.35, R * 1.15);
    sh.addColorStop(0, 'rgba(12,16,34,0.4)');
    sh.addColorStop(1, 'rgba(12,16,34,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(ox, oy, R, 0, TAU);
    ctx.fill();

    // 环形坑：深浅两层（位置固定）
    const craters = [
      { ax: -0.38, ay: -0.18, r: 0.26 },
      { ax: 0.28, ay: 0.32, r: 0.19 },
      { ax: 0.02, ay: -0.5, r: 0.14 },
      { ax: -0.12, ay: 0.5, r: 0.12 },
      { ax: -0.55, ay: 0.38, r: 0.1 },
    ];
    for (const c of craters) {
      const cx = ox + c.ax * R;
      const cy = oy + c.ay * R;
      const cr = c.r * R;
      // 深坑底
      ctx.fillStyle = 'rgba(10,14,30,0.28)';
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, TAU);
      ctx.fill();
      // 浅内层 + 亮沿（背光侧亮）
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(cx - cr * 0.18, cy - cr * 0.18, cr * 0.6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, Math.PI, TAU);
      ctx.stroke();
    }

    // 边缘高光（受光侧上左）
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ox, oy, R - 1.5, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();
  }

  function drawMountains(pal, camX, camY) {
    const layer = (par, base, amp, seed, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, WORLD.HEIGHT);
      for (let sx = 0; sx <= WORLD.WIDTH + 32; sx += 32) {
        const wx = camX * par + sx;
        const y = base - camY * par * 0.5 - vnoise(wx / 420, seed) * amp;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT);
      ctx.closePath();
      ctx.fill();
    };
    layer(0.3, 470, 130, 555, pal.far);
    layer(0.5, 530, 90, 777, pal.mid);
  }

  // ---------- 标尺与旗 ----------

  function drawFlag(x, gy, h, color) {
    // 椭圆投影
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, gy + 1, 6, 1.8, 0, 0, TAU);
    ctx.fill();
    // 旗杆
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, gy - h);
    ctx.stroke();
    // 三角旗
    const w = h * 0.62;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, gy - h);
    ctx.lineTo(x + w, gy - h + w * 0.32);
    ctx.lineTo(x, gy - h + w * 0.64);
    ctx.closePath();
    ctx.fill();
  }

  function drawMarkers(run, pal, camX, camY) {
    const stepPx = GOLF.MARKER_M * GOLF.PX_PER_M;
    const from = Math.max(1, Math.floor((camX - GOLF.TEE_X) / stepPx));
    const to = Math.ceil((camX + WORLD.WIDTH - GOLF.TEE_X) / stepPx);
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    for (let k = from; k <= to; k += 1) {
      const wx = GOLF.TEE_X + k * stepPx;
      const gy = groundY(wx, run.seed);
      const dist = k * GOLF.MARKER_M;
      const gold = dist > run.best; // 超过最远距离的刻度用金色
      const color = gold ? 'rgba(255,210,63,0.95)' : 'rgba(255,255,255,0.68)';
      // 刻度 + 小旗
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx, gy);
      ctx.lineTo(wx, gy - 16);
      ctx.stroke();
      drawFlag(wx, gy, 26, color);
      ctx.fillStyle = color;
      ctx.fillText(String(dist), wx, gy - 34);
    }
    // 最远距离记录旗（大，accent）
    const fx = run.bestAbsX;
    if (fx > GOLF.TEE_X + 120) {
      const gy = groundY(fx, run.seed);
      drawFlag(fx, gy, 52, pal.accent);
      ctx.fillStyle = pal.accent;
      ctx.font = 'bold 11px monospace';
      ctx.fillText('BEST', fx, gy - 58);
      ctx.font = '11px monospace';
    }
    // 本杆落点小旗
    if (run.shotIndex > 0 && run.phase === 'ready' && Math.abs(run.ball.x - run.bestAbsX) > 30) {
      const bx = run.ball.x;
      const gy = groundY(bx, run.seed);
      drawFlag(bx, gy, 28, pal.accent);
    }
  }

  // ---------- 地面 ----------

  function drawGroundTexture(kind, x0, x1, seed, pal) {
    const cell = 44;
    const start = Math.floor(x0 / cell) * cell;
    for (let x = start; x <= x1; x += cell) {
      const h = hash2(seed ^ 0x9e3779b9, x / cell);
      const gx = x + h * 30;
      const gy = groundY(gx, seed);
      if (kind === 'pebble' || kind === 'gravel') {
        if (h < 0.5) {
          // 碎石：暗色椭圆
          ctx.fillStyle = pal.groundDark;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.ellipse(gx, gy - 1 - h * 3, 2 + h * 3, 1.2 + h * 1.6, h * 3, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (h < 0.62) {
          // 小坑：暗圆 + 亮沿
          const r = 3 + h * 4;
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath();
          ctx.arc(gx, gy - 1, r, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.16)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(gx, gy - 1, r, Math.PI, TAU);
          ctx.stroke();
        }
      } else if (kind === 'snow') {
        // 雪粒 + 晶体闪点
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(gx, gy - 1 - h * 4, 1 + h * 1.6, 0, TAU);
        ctx.fill();
        if (h > 0.82) {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(gx - 4, gy - 3);
          ctx.lineTo(gx + 4, gy - 9);
          ctx.moveTo(gx + 4, gy - 3);
          ctx.lineTo(gx - 4, gy - 9);
          ctx.stroke();
        }
      } else if (kind === 'crack') {
        // 熔岩裂纹：外层辉光 + 亮核
        if (h < 0.42) {
          ctx.beginPath();
          let cx = gx;
          let cy = gy;
          ctx.moveTo(cx, cy);
          for (let s = 0; s < 3; s += 1) {
            cx += (hash2(seed + s, x / cell) - 0.5) * 14;
            cy += 4 + h * 10;
            ctx.lineTo(cx, cy);
          }
          ctx.strokeStyle = rgbCss(hexToRgb(pal.accent), 0.35);
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.strokeStyle = rgbCss(hexToRgb(pal.accent), 0.9);
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      } else if (kind === 'sand') {
        // 金砂粒
        ctx.fillStyle = h < 0.5 ? pal.groundDark : pal.accent;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(gx, gy - 1 - h * 4, 1 + h * 1.8, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawGround(run, pal, camX, camY) {
    const x0 = camX - 60;
    const x1 = camX + WORLD.WIDTH + 60;
    const kind = TEX[PLANETS[run.planetIndex].id] || 'pebble';

    // 地表色块
    ctx.fillStyle = pal.ground;
    ctx.beginPath();
    ctx.moveTo(x0, camY + WORLD.HEIGHT + 400);
    ctx.lineTo(x0, groundY(x0, run.seed));
    for (let x = x0; x <= x1; x += 16) {
      ctx.lineTo(x, groundY(x, run.seed));
    }
    ctx.lineTo(x1, camY + WORLD.HEIGHT + 400);
    ctx.closePath();
    ctx.fill();

    // 纹理层
    drawGroundTexture(kind, x0, x1, run.seed, pal);

    // 地表 2px 高光边
    ctx.strokeStyle = pal.accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 16) {
      const y = groundY(x, run.seed);
      if (x === x0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 地平线雾：贴地表的一条渐变雾带，柔化地与天的交界
    let surfMin = Infinity;
    for (let x = x0; x <= x1; x += 32) surfMin = Math.min(surfMin, groundY(x, run.seed));
    const fog = ctx.createLinearGradient(0, surfMin - 46, 0, surfMin + 8);
    const fogRgb = hexToRgb(pal.skyBottom);
    fog.addColorStop(0, rgbCss(fogRgb, 0));
    fog.addColorStop(1, rgbCss(fogRgb, 0.4));
    ctx.fillStyle = fog;
    ctx.fillRect(x0, surfMin - 46, x1 - x0, 54);
  }

  // ---------- 球与轨迹 ----------

  function drawTrail(burning) {
    for (let i = 0; i < trail.length; i += 1) {
      const t = i / trail.length;
      ctx.globalAlpha = t * (burning ? 0.55 : 0.4);
      ctx.fillStyle = burning ? '#ffd9a0' : '#ffffff';
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, 1 + t * (burning ? 5 : 4), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBall(run, dt) {
    const b = run.ball;
    const speed = Math.hypot(b.vx, b.vy);
    const burning = run.burning && run.phase === 'flight';
    const bob = b.state === 'rolling' && Math.abs(b.vx) > 40
      ? Math.abs(Math.sin(run.time * 14)) * Math.min(2.5, Math.abs(b.vx) / 150)
      : 0;
    const by = b.y - bob;

    if (run.phase === 'flight' && b.state === 'flying') {
      if (run.flightTime < 0.1) burnBurstDone = false;
      trail.push({ x: b.x, y: b.y });
      if (trail.length > FX.TRAIL_LEN) trail.shift();
    } else if (trail.length) {
      trail.shift();
    }
    drawTrail(burning);

    if (burning || (run.burnedOut && !burnBurstDone)) {
      fireAcc += dt * 60 * FX.FIRE_RATE;
      while (fireAcc > 1) {
        fireAcc -= 1;
        parts.push({
          x: b.x + (Math.random() - 0.5) * 8,
          y: b.y + (Math.random() - 0.5) * 8,
          vx: -b.vx * 0.12 + (Math.random() - 0.5) * 80,
          vy: -b.vy * 0.12 + (Math.random() - 0.5) * 80,
          grav: -40,
          life: 0.25 + Math.random() * 0.3,
          ttl: 0.55,
          size: 2.5 + Math.random() * 4,
          color: Math.random() < 0.5 ? '#ffd23f' : '#ff6a1f',
          glow: true,
        });
      }
    }
    if (run.burnedOut && !burnBurstDone) {
      burnBurstDone = true;
      fireBurst(b.x, b.y);
    }

    // 影子（椭圆，随高度缩小）
    const gy = groundY(b.x, run.seed);
    const h = Math.max(0, gy - b.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(b.x, gy + 2, Math.max(4, 10 - h * 0.01), 2.5, 0, 0, TAU);
    ctx.fill();

    if (burning) {
      ctx.fillStyle = 'rgba(255,140,40,0.4)';
      ctx.beginPath();
      ctx.arc(b.x, by, 15, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, by, GOLF.BALL_R, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(140,160,200,0.5)';
    ctx.beginPath();
    ctx.arc(b.x - 2.4, by - 2.4, 2.2, 0, TAU);
    ctx.fill();
  }

  // ---------- 球手 ----------

  const SUIT = '#eef2f8';
  const SUIT_DARK = '#c3cde0';
  const PANTS = '#2c3346';
  const PANTS_DARK = '#1f2433';
  const SKIN = '#e6b98c';
  const CLUB = '#161c2e';

  function seg(x1, y1, x2, y2, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function dot(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function drawGolfer(run, now, dt, pal) {
    const g = run.golfer;
    // 落地扬尘：ragdoll → walk 表示球手刚触地
    if (lastGolferState === 'ragdoll' && g.state !== 'ragdoll') {
      burst(g.x, g.y - 2, 10, [pal.ground, pal.groundDark, pal.accent], 100, 60);
    }
    if (lastGolferState !== 'ragdoll' && g.state === 'ragdoll') swingT = 0.12;
    lastGolferState = g.state;
    if (swingT > 0) swingT -= dt;

    ctx.save();
    ctx.translate(g.x, g.y);
    if (g.state === 'ragdoll' && swingT <= 0) {
      ctx.translate(0, -20);
      ctx.rotate(g.rot);
      ctx.translate(0, 20);
    }

    // 脚下椭圆投影
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 15, 3.2, 0, 0, TAU);
    ctx.fill();

    if (g.state === 'ragdoll' && swingT <= 0) {
      // 翻滚姿态：四肢甩动
      const en = Math.min(1, Math.abs(g.vrot) / 6);
      const fl = Math.sin(now * 0.02) * en * 8;
      seg(-4, -16, -8 - fl, -4, 5, PANTS_DARK);
      seg(4, -16, 8 + fl, -4, 5, PANTS);
      seg(0, -16, fl, -30, 11, SUIT);
      seg(fl, -30, fl - 11, -24, 3.5, SUIT_DARK);
      seg(fl, -30, fl + 11, -22, 3.5, SUIT);
      seg(fl, -30, fl + 18, -34 - fl, 2.5, CLUB);
      dot(fl, -40, 6.5, SKIN);
    } else {
      const w = run.aim.active ? run.aim.power : 0;
      const strike = swingT > 0;
      const shoulderX = strike ? 6 : (w > 0 ? -w * 5 : 0);
      const hx = shoulderX * 0.7;
      // 腿
      seg(-4, -18, -7, 0, 5, PANTS_DARK);
      seg(4, -18, 7, 0, 5, PANTS);
      // 躯干
      seg(0, -18, shoulderX, -34, 11, SUIT);
      dot(0, -18, 3, pal.accent); // 腰带
      // 头 + 帽
      dot(hx, -43, 6.5, SKIN);
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(hx, -43, 6.5, Math.PI, TAU);
      ctx.fill();
      seg(hx + 2, -45, hx + 9, -44, 2, pal.accent);
      if (strike) {
        // 挥杆伸展（follow-through）
        seg(shoulderX, -32, 8, -26, 3.5, SUIT_DARK);
        seg(shoulderX, -32, 12, -27, 3.5, SUIT);
        seg(12, -27, 26, -3, 2.5, CLUB);
        dot(26, -3, 2.4, pal.accent);
      } else if (w > 0.02) {
        // 蓄力回摆（backswing）
        seg(shoulderX, -32, -8 - w * 6, -40 - w * 8, 3.5, SUIT);
        seg(shoulderX, -32, -4 - w * 4, -37 - w * 6, 3.5, SUIT_DARK);
        seg(-6 - w * 5, -38 - w * 7, -16 - w * 8, -48 - w * 10, 2.5, CLUB);
        dot(-16 - w * 8, -48 - w * 10, 2.4, pal.accent);
      } else {
        // 站姿（address）
        seg(shoulderX, -32, 9, -24, 3.5, SUIT_DARK);
        seg(shoulderX, -32, 12, -25, 3.5, SUIT);
        seg(12, -25, 22, -7, 2.5, CLUB);
        dot(22, -7, 2.4, pal.accent);
      }
    }
    ctx.restore();
  }

  function drawAim(run) {
    if (!run.aim.active || run.phase !== 'ready') return;
    const b = run.ball;
    const rad = (run.aim.angleDeg * Math.PI) / 180;
    const len = 46 + run.aim.power * 150;
    const dx = Math.cos(rad) * len;
    const dy = -Math.sin(rad) * len;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + dx, b.y + dy);
    ctx.stroke();
    ctx.setLineDash([]);
    const a = Math.atan2(dy, dx);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(b.x + dx, b.y + dy);
    ctx.lineTo(b.x + dx - Math.cos(a - 0.45) * 11, b.y + dy - Math.sin(a - 0.45) * 11);
    ctx.lineTo(b.x + dx - Math.cos(a + 0.45) * 11, b.y + dy - Math.sin(a + 0.45) * 11);
    ctx.closePath();
    ctx.fill();
    if (run.aim.power > 0.02) {
      ctx.strokeStyle = run.aim.power > 0.85 ? '#ff5a1f' : '#7dff8a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 15, -Math.PI / 2, -Math.PI / 2 + run.aim.power * Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---------- 粒子 / 冲击环 / 飘字 ----------

  function drawParts() {
    // 火焰粒子用 additive 提亮
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      if (!p.glow) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.ttl);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    for (const p of parts) {
      if (p.glow) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.ttl);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRings(dt) {
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const r = rings[i];
      r.life -= dt;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      const t = 1 - r.life / r.ttl;
      const rad = r.size * (0.3 + 0.7 * t);
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 0.5 + 2.5 * (1 - t);
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats(dt) {
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    for (let i = floats.length - 1; i >= 0; i -= 1) {
      const f = floats[i];
      f.life -= dt;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      const t = 1 - f.life / f.ttl;
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - 26 - t * 44);
    }
    ctx.globalAlpha = 1;
  }

  function render(run, now, opts = {}) {
    const dt = Math.min(0.1, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;

    if (run.planetIndex !== lastPlanetIndex) {
      if (lastPlanetIndex >= 0) startPaletteFade(run);
      lastPlanetIndex = run.planetIndex;
      palTo = paletteOf(run);
    }
    palBlend = Math.min(1, palBlend + dt / FX.PALETTE_FADE);
    const pal = currentPalette(run);

    // 摄像机
    const b = run.ball;
    const focusX = b.x + b.vx * CAMERA.LOOKAHEAD;
    const targetX = Math.max(0, focusX - CAMERA.OFFSET_X);
    const targetY = Math.min(0, b.y - 330);
    const k = Math.min(1, CAMERA.LERP * dt);
    cam.x += (targetX - cam.x) * k;
    cam.y += (targetY - cam.y) * k;
    if (Math.abs(targetX - cam.x) > CAMERA.MAX_VEL * dt) cam.x = targetX - Math.sign(targetX - cam.x) * CAMERA.MAX_VEL * dt;

    shakeMag *= Math.max(0, 1 - FX.SHAKE_DECAY * dt);
    if (shakeMag < 0.2) shakeMag = 0;
    const shx = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;
    const shy = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;

    updateParts(dt);

    drawSky(pal, cam.x, cam.y, now);
    drawMountains(pal, cam.x, cam.y);

    ctx.save();
    ctx.translate(-cam.x + shx, -cam.y + shy);
    drawMarkers(run, pal, cam.x, cam.y);
    drawGround(run, pal, cam.x, cam.y);
    drawAim(run);
    drawBall(run, dt);
    drawGolfer(run, now, dt, pal);
    drawParts();
    drawRings(dt);
    drawFloats(dt);
    ctx.restore();

    if (opts.dim) {
      ctx.fillStyle = 'rgba(8,10,20,0.45)';
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
  }

  return {
    render,
    shake,
    burst,
    ring,
    fireBurst,
    floatText,
    get camX() { return cam.x; },
  };
}
