// src/render/index.js — WATER RITUAL 渲染（Canvas 2D，程序化美术，纯消费 sim 状态）。
// 三套场景包：晨茶（暖白）/ 午市（青）/ 夜谈（靛蓝）——换章必换色板 + 装饰。
import { WORLD } from '../../config/game.config.js';
import { TEA, SCENES } from '../../config/tea.js';

const GUEST_COLORS = {
  regular: '#d98a4b',
  noble: '#b48ae0',
  oldFriend: '#8fb0c9',
  hurried: '#e06a6a',
  picky: '#d4a017',
};

// ---------- 几何常量（渲染专用，不影响逻辑坐标） ----------
const CUP = { cx: 560, mouthY: 250, bottomY: 540, topW: 196, bottomW: 132 };
const GAUGE = { x: 792, topY: 190, bottomY: 520, w: 34 };
const TEAPOT = { x: 380, y: 210 };

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function makeGlow(radius, core, edge) {
  const size = Math.max(2, Math.ceil(radius * 2));
  const s = document.createElement('canvas');
  s.width = size; s.height = size;
  const c = s.getContext('2d');
  const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, core);
  g.addColorStop(1, edge);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return s;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const glowGold = makeGlow(26, 'rgba(255,220,120,0.95)', 'rgba(255,200,80,0)');
  const glowSteam = makeGlow(18, 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)');

  const particles = [];
  let lastNow = 0;
  let rippleAt = -1e9;
  let rippleX = 0;
  let rippleY = 0;

  function resize() {
    const dpr = clamp(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1, 2);
    const cssW = canvas.clientWidth || WORLD.WIDTH;
    const cssH = canvas.clientHeight || WORLD.HEIGHT;
    const scale = Math.min(cssW / WORLD.WIDTH, cssH / WORLD.HEIGHT);
    const ox = (cssW - WORLD.WIDTH * scale) / 2;
    const oy = (cssH - WORLD.HEIGHT * scale) / 2;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  }

  function palette(hud) {
    const s = SCENES[(hud && hud.scene) || 1] || SCENES[1];
    return s.palette;
  }

  function burst(x, y, kind) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (kind === 'ripple') {
      rippleAt = now; rippleX = x; rippleY = y;
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2;
        particles.push({ x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 - 30, life: 0.7, max: 0.7, kind: 'gold', r: 3 });
      }
      return;
    }
    if (kind === 'coin') {
      for (let i = 0; i < 6; i += 1) {
        particles.push({ x: x + (Math.random() - 0.5) * 60, y, vx: (Math.random() - 0.5) * 40, vy: -90 - Math.random() * 60, life: 0.8, max: 0.8, kind: 'coin', r: 4 });
      }
      return;
    }
    if (kind === 'steam') {
      particles.push({ x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 8, vy: -22 - Math.random() * 18, life: 1.4, max: 1.4, kind: 'steam', r: 9 });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'gold') { p.vy += 120 * dt; }
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawScene(hud, now) {
    const pal = palette(hud);
    const scene = (hud && hud.scene) || 1;
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, pal.bg);
    g.addColorStop(1, shade(pal.bg, -22));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 场景装饰（三套一眼可分）
    ctx.save();
    if (scene === 1) {
      // 晨茶：暖白 + 朝阳 + 远山雾气
      drawSun(90, 90, pal.accent);
      drawHills(pal.ink, 0.18);
      drawSteamCurtain(0.25);
    } else if (scene === 2) {
      // 午市：青 + 竹影
      drawBamboo(pal.accent, pal.ink);
      drawCounterBanners(pal.accent);
    } else {
      // 夜谈：靛蓝 + 灯笼 + 星点
      drawStars(pal.ink);
      drawLanterns(pal.accent);
    }
    ctx.restore();

    // 吧台
    ctx.fillStyle = shade(pal.bg, -46);
    ctx.fillRect(0, 560, WORLD.WIDTH, WORLD.HEIGHT - 560);
    ctx.fillStyle = shade(pal.bg, -60);
    ctx.fillRect(0, 560, WORLD.WIDTH, 10);

    // 台面木纹
    ctx.strokeStyle = shade(pal.bg, -34);
    ctx.lineWidth = 2;
    for (let x = 0; x < WORLD.WIDTH; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 600);
      ctx.lineTo(x + 40, 720);
      ctx.stroke();
    }
  }

  function drawSun(x, y, color) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(x, y, 80, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawHills(ink, alpha) {
    ctx.fillStyle = ink; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(0, 560);
    ctx.quadraticCurveTo(300, 420, 640, 560);
    ctx.quadraticCurveTo(980, 470, 1280, 560);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawSteamCurtain(alpha) {
    ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    for (let x = 60; x < WORLD.WIDTH; x += 160) {
      ctx.beginPath(); ctx.moveTo(x, 300); ctx.bezierCurveTo(x + 30, 180, x - 30, 80, x, 40); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawBamboo(accent, ink) {
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.5; ctx.lineWidth = 3;
    for (const bx of [180, 1080]) {
      ctx.beginPath(); ctx.moveTo(bx, 720); ctx.lineTo(bx, 200); ctx.stroke();
      for (let y = 260; y < 700; y += 80) {
        ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(bx - 16, y); ctx.lineTo(bx + 16, y); ctx.stroke();
      }
    }
    ctx.fillStyle = accent; ctx.globalAlpha = 0.7;
    for (const [lx, ly] of [[180, 260], [1080, 300], [150, 340], [1110, 380]]) {
      ctx.beginPath(); ctx.ellipse(lx, ly, 12, 34, lx < 500 ? 0.5 : -0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawCounterBanners(accent) {
    ctx.fillStyle = accent; ctx.globalAlpha = 0.8;
    for (let x = 240; x < 1120; x += 220) {
      ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x + 110, 120); ctx.lineTo(x + 96, 168); ctx.lineTo(x + 14, 168); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawStars(ink) {
    ctx.fillStyle = ink; ctx.globalAlpha = 0.7;
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 97) % WORLD.WIDTH; const y = (i * 53) % 300;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawLanterns(accent) {
    ctx.fillStyle = accent; ctx.globalAlpha = 0.9;
    for (const x of [220, 640, 1060]) {
      ctx.beginPath(); ctx.arc(x, 130, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3c8'; ctx.beginPath(); ctx.arc(x, 130, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(x - 1, 156, 2, 40);
    }
    ctx.globalAlpha = 1;
  }

  function drawCustomer(hud, now) {
    if (!hud || !hud.currentOrder) return;
    const pal = palette(hud);
    const gk = hud.currentOrder.guestNameKey ? String(hud.currentOrder.guestNameKey).split('.').pop() : 'regular';
    const body = GUEST_COLORS[gk] || GUEST_COLORS.regular;
    const x = 1040, y = 380;

    // 身体 / 头
    ctx.fillStyle = pal.ink; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.ellipse(x, y + 90, 52, 90, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(x, y + 110, 40, 66, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(body, -30);
    ctx.beginPath(); ctx.arc(x, y - 30, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - 11, y - 36, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 11, y - 36, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath(); ctx.arc(x - 11, y - 36, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 11, y - 36, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawTeapot(hud, pouring, now) {
    const pal = palette(hud);
    const tx = TEAPOT.x, ty = TEAPOT.y;
    ctx.save();
    ctx.translate(tx, ty);
    if (pouring) ctx.rotate(-0.5); else ctx.rotate(-0.15);
    ctx.fillStyle = pal.ink;
    // 壶身
    ctx.beginPath(); ctx.ellipse(0, 0, 60, 46, 0, 0, Math.PI * 2); ctx.fill();
    // 壶盖
    ctx.beginPath(); ctx.arc(0, -44, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(pal.bg, -30);
    ctx.beginPath(); ctx.ellipse(0, 0, 48, 34, 0, 0, Math.PI * 2); ctx.fill();
    // 壶嘴
    ctx.fillStyle = pal.ink;
    ctx.beginPath(); ctx.moveTo(52, -14); ctx.lineTo(96, -40); ctx.lineTo(66, -20); ctx.closePath(); ctx.fill();
    // 壶柄
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-56, 0, 26, -1.4, 1.4); ctx.stroke();
    ctx.restore();

    // 水流
    if (pouring) {
      const sx = tx + 96, sy = ty - 40;
      ctx.strokeStyle = hud && hud.currentOrder ? hud.currentOrder.teaColor : '#9adf9a';
      ctx.globalAlpha = 0.85; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy);
      const wob = Math.sin(now / 90) * 4;
      ctx.bezierCurveTo(sx + 8, sy + 90, sx - 8 + wob, sy + 170, CUP.cx - 20, CUP.mouthY + 40);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawCup(hud, now) {
    const pal = palette(hud);
    const pour = hud.pour || { level: 0 };
    const level = clamp(pour.level, 0, 1);
    const waterColor = hud.currentOrder ? hud.currentOrder.teaColor : '#9adf9a';
    const surfaceY = CUP.bottomY - level * (CUP.bottomY - CUP.mouthY);

    // 内壁（给一点深度）
    ctx.fillStyle = shade(pal.bg, -8);
    cupPath(ctx);
    ctx.fill();

    // 水（从底到水面，随杯形收窄）
    if (level > 0.003) {
      const wTop = CUP.bottomW + (CUP.topW - CUP.bottomW) * ((CUP.bottomY - surfaceY) / (CUP.bottomY - CUP.mouthY));
      ctx.fillStyle = waterColor;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(CUP.cx - wTop / 2, surfaceY);
      ctx.lineTo(CUP.cx + wTop / 2, surfaceY);
      ctx.lineTo(CUP.cx + CUP.bottomW / 2, CUP.bottomY);
      ctx.lineTo(CUP.cx - CUP.bottomW / 2, CUP.bottomY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      // 水面高光
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.ellipse(CUP.cx, surfaceY, wTop * 0.42, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 玻璃前壁 + 杯口
    ctx.strokeStyle = pal.ink;
    ctx.globalAlpha = 0.55; ctx.lineWidth = 3;
    cupPath(ctx); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(CUP.cx, CUP.mouthY, CUP.topW / 2, 14, 0, 0, Math.PI * 2); ctx.stroke();

    // 目标水位线（金线 + 三角标）
    if (hud.currentOrder) {
      const lineY = CUP.bottomY - hud.currentOrder.line * (CUP.bottomY - CUP.mouthY);
      ctx.strokeStyle = '#e0a812'; ctx.lineWidth = 2.5; ctx.setLineDash([9, 7]);
      ctx.beginPath(); ctx.moveTo(CUP.cx - CUP.topW / 2 - 10, lineY); ctx.lineTo(CUP.cx + CUP.topW / 2 + 10, lineY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e0a812';
      ctx.beginPath(); ctx.moveTo(CUP.cx - CUP.topW / 2 - 22, lineY); ctx.lineTo(CUP.cx - CUP.topW / 2 - 8, lineY - 6); ctx.lineTo(CUP.cx - CUP.topW / 2 - 8, lineY + 6); ctx.closePath(); ctx.fill();
    }
  }

  function cupPath(c) {
    c.beginPath();
    c.moveTo(CUP.cx - CUP.topW / 2, CUP.mouthY);
    c.lineTo(CUP.cx - CUP.bottomW / 2, CUP.bottomY);
    c.lineTo(CUP.cx + CUP.bottomW / 2, CUP.bottomY);
    c.lineTo(CUP.cx + CUP.topW / 2, CUP.mouthY);
    c.closePath();
  }

  function drawGauge(hud, now) {
    const pal = palette(hud);
    const pour = hud.pour || { temp: TEA.startTemp };
    const temp = clamp(pour.temp, TEA.minTemp, TEA.startTemp);
    const x = GAUGE.x, w = GAUGE.w;

    // 外管
    ctx.fillStyle = shade(pal.bg, -10);
    ctx.globalAlpha = 0.6;
    roundRect(ctx, x - w / 2, GAUGE.topY - 16, w, GAUGE.bottomY - GAUGE.topY + 46, 17); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 2.5;
    roundRect(ctx, x - w / 2, GAUGE.topY - 16, w, GAUGE.bottomY - GAUGE.topY + 46, 17); ctx.stroke();

    // 窗口带（客人水温区间）
    if (hud.currentOrder) {
      const [lo, hi] = hud.currentOrder.tempWindow;
      const yLo = tempToY(lo), yHi = tempToY(hi);
      ctx.fillStyle = hud.showWindow ? 'rgba(224,168,18,0.5)' : 'rgba(120,120,120,0.28)';
      roundRect(ctx, x - w / 2 + 3, Math.min(yLo, yHi) - 6, w - 6, Math.abs(yHi - yLo) + 12, 6); ctx.fill();
    }

    // 水银柱（从底部到当前温度）
    const y = tempToY(temp);
    const hot = temp > 60 ? '#e06a4a' : temp > 40 ? '#e0a812' : '#4a9de0';
    ctx.fillStyle = hot;
    roundRect(ctx, x - w / 2 + 7, y, w - 14, GAUGE.bottomY - y + 6, 6); ctx.fill();
    // 顶部液珠
    ctx.beginPath(); ctx.arc(x, y, (w - 14) / 2, 0, Math.PI * 2); ctx.fill();
  }

  function tempToY(temp) {
    const t = (TEA.startTemp - temp) / (TEA.startTemp - TEA.minTemp);
    return GAUGE.topY + t * (GAUGE.bottomY - GAUGE.topY);
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function drawRipple(now) {
    const age = (now - rippleAt) / 1000;
    if (age < 0 || age > 0.9) return;
    const r = 30 + age * 130;
    const a = (1 - age / 0.9);
    ctx.strokeStyle = 'rgba(255,214,90,' + (a * 0.9).toFixed(3) + ')';
    ctx.lineWidth = 3 + a * 5;
    ctx.beginPath(); ctx.ellipse(rippleX, rippleY, r * 0.6, r * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.drawImage(glowGold, rippleX - r, rippleY - r * 0.4, r * 2, r * 0.8);
  }

  function drawParticles(now) {
    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'gold') { ctx.fillStyle = 'rgba(255,214,90,' + a + ')'; }
      else if (p.kind === 'coin') { ctx.fillStyle = 'rgba(240,190,60,' + a + ')'; }
      else { ctx.globalAlpha = a * 0.5; ctx.drawImage(glowSteam, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); ctx.globalAlpha = 1; continue; }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp((n >> 16) + amt, 0, 255);
    const g = clamp(((n >> 8) & 0xff) + amt, 0, 255);
    const b = clamp((n & 0xff) + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;

    updateParticles(dt);

    const hud = run && typeof run.getHud === 'function' ? run.getHud() : null;
    drawScene(hud, now);

    if (hud) {
      drawCustomer(hud, now);
      drawTeapot(hud, hud.pour.state === 'pouring', now);
      drawCup(hud, now);
      drawGauge(hud, now);
      drawRipple(now);
      drawParticles(now);

      // 蒸汽：杯中水面始终有蒸汽
      const surfaceY = CUP.bottomY - clamp(hud.pour.level, 0, 1) * (CUP.bottomY - CUP.mouthY);
      if (Math.floor(now / 260) % 3 === 0) burst(CUP.cx, surfaceY, 'steam');
    } else {
      // 标题屏：也画一套茶壶 + 空杯 + 满温度计的「产品静物」，让剪影有主体
      const still = { scene: 1, pour: { state: 'idle', level: 0.2, temp: TEA.startTemp }, currentOrder: null };
      drawTeapot(still, false, now);
      drawCup(still, now);
      drawGauge(still, now);
      drawParticles(now);
      if (Math.floor(now / 260) % 3 === 0) burst(CUP.cx, CUP.mouthY - 20, 'steam');
    }
  }

  resize();
  return { draw, resize, burst };
}
