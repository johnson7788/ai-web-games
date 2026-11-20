// FOOD CHAIN · M2 渲染：程序化 Canvas 2D（零外部素材）
// 三场景包：光合带（亮青+太阳光束+珊瑚剪影）/ 中层带（深蓝+荧光点+泥沙雾）/ 热泉带（暗红+热泉羽流+岩刺）
// 所有生物用径向渐变 + 加法混合的发光体；玩家最亮、毒刺鱼带刺、水母半透明。
// 颜色统一用 rgb 三元组字符串（"r,g,b"），alpha 由 rgba(rgb,a) 拼接。
import { WORLD } from '../../config/gameplay.js';
import { colorAtStage, zoneAtStage } from '../../config/stages.js';
import { zoneTheme } from './theme.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

function rgba(rgb, a) {
  return `rgba(${rgb},${a})`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function makeGlow(ctx, x, y, r, rgb, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(rgb, alpha));
  g.addColorStop(1, rgba(rgb, 0));
  return g;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  const state = {
    ambient: [],
    bursts: [],
    lastNow: performance.now(),
    reducedMotion: false,
    lastZone: -1,
  };

  function seedAmbient(zone) {
    state.ambient = [];
    const n = 46;
    for (let i = 0; i < n; i += 1) {
      state.ambient.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1 + Math.random() * 2.4,
        vy: 8 + Math.random() * 26,
        vx: (Math.random() - 0.5) * 8,
        phase: Math.random() * Math.PI * 2,
        kind: zoneTheme(zone).particle,
      });
    }
  }

  function burst(x, y, kind) {
    if (state.reducedMotion) return;
    let rgb = '160,240,255';
    let n = 14;
    if (kind === 'eatPrey' || kind === 'evolve' || kind === 'stingUse') {
      rgb = '255,230,140';
      n = 18;
    } else if (kind === 'eatToxic') {
      rgb = '255,90,70';
      n = 16;
    } else if (kind === 'lightChain') {
      rgb = '255,255,255';
      n = 26;
    } else if (kind === 'death') {
      rgb = '255,70,70';
      n = 30;
    } else if (kind === 'stingGain') {
      rgb = '160,255,220';
      n = 20;
    }
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 180;
      state.bursts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        r: 2 + Math.random() * 4,
        rgb,
      });
    }
    if (kind === 'lightChain') {
      for (let k = 0; k < 8; k += 1) {
        state.bursts.push({
          x: x + (Math.random() - 0.5) * 40,
          y: y + (Math.random() - 0.5) * 40,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          life: 0.5 + k * 0.03,
          maxLife: 0.9,
          r: 3 + Math.random() * 3,
          rgb,
        });
      }
    }
  }

  function updateParticles(dt) {
    for (const a of state.ambient) {
      a.y -= a.vy * dt;
      a.x += a.vx * dt + Math.sin(a.phase) * 0.4;
      if (a.y < -6) { a.y = H + 6; a.x = Math.random() * W; }
      if (a.x < -6) a.x = W + 6;
      if (a.x > W + 6) a.x = -6;
    }
    const keep = [];
    for (const b of state.bursts) {
      b.life -= dt;
      if (b.life > 0) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vx *= 0.94;
        b.vy *= 0.94;
        keep.push(b);
      }
    }
    state.bursts = keep;
  }

  function drawBackground(theme) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.bgTop);
    g.addColorStop(0.5, theme.bgMid);
    g.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (theme.sunRays) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.10;
      for (let i = 0; i < 5; i += 1) {
        const x = 160 + i * 220;
        ctx.beginPath();
        ctx.moveTo(x - 30, 0);
        ctx.lineTo(x + 30, 0);
        ctx.lineTo(x + 120, H);
        ctx.lineTo(x - 120, H);
        ctx.closePath();
        const rg = ctx.createLinearGradient(0, 0, 0, H);
        rg.addColorStop(0, 'rgba(140,240,255,1)');
        rg.addColorStop(1, 'rgba(140,240,255,0)');
        ctx.fillStyle = rg;
        ctx.fill();
      }
      ctx.restore();
    } else if (theme.decor === 'silt') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i += 1) {
        const y = 120 + i * 150;
        const rg = ctx.createLinearGradient(0, y - 40, 0, y + 40);
        rg.addColorStop(0, 'rgba(120,150,255,0)');
        rg.addColorStop(0.5, 'rgba(120,150,255,0.06)');
        rg.addColorStop(1, 'rgba(120,150,255,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, y - 40, W, 80);
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 6; i += 1) {
        const x = 90 + i * 220;
        const rg = ctx.createLinearGradient(0, H, 0, H - 320);
        rg.addColorStop(0, 'rgba(255,120,70,0.8)');
        rg.addColorStop(1, 'rgba(255,120,70,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(x - 34, H - 320, 68, 320);
      }
      ctx.restore();
    }
  }

  function drawDecor(theme) {
    ctx.save();
    if (theme.decor === 'coral') {
      ctx.fillStyle = 'rgba(3,18,20,0.9)';
      for (let i = 0; i < 7; i += 1) {
        const x = 40 + i * 200 + Math.sin(i * 3.7) * 40;
        const h = 50 + ((i * 37) % 90);
        ctx.beginPath();
        ctx.moveTo(x - 16, H);
        ctx.lineTo(x - 8, H - h);
        ctx.lineTo(x - 22, H - h - 22);
        ctx.lineTo(x - 4, H - h - 8);
        ctx.lineTo(x, H - h - 40);
        ctx.lineTo(x + 6, H - h - 6);
        ctx.lineTo(x + 24, H - h - 18);
        ctx.lineTo(x + 12, H - h);
        ctx.lineTo(x + 18, H);
        ctx.closePath();
        ctx.fill();
      }
    } else if (theme.decor === 'silt') {
      ctx.fillStyle = 'rgba(2,4,10,0.85)';
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, H - 40);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H - 40 - Math.sin(x * 0.02) * 14);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(10,3,3,0.95)';
      for (let i = 0; i < 9; i += 1) {
        const x = 30 + i * 150;
        const h = 60 + ((i * 53) % 120);
        ctx.beginPath();
        ctx.moveTo(x - 20, H);
        ctx.lineTo(x, H - h);
        ctx.lineTo(x + 20, H);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawCurrent() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.06;
    const g = ctx.createLinearGradient(0, 300, 0, 430);
    g.addColorStop(0, 'rgba(255,120,80,0)');
    g.addColorStop(0.5, 'rgba(255,160,120,1)');
    g.addColorStop(1, 'rgba(255,120,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 300, W, 130);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = 'rgba(255,180,140,0.5)';
    for (let i = 0; i < 12; i += 1) {
      const y = 310 + ((i * 29 + Math.floor(performance.now() / 60) * 2) % 120);
      ctx.fillRect((i * 113 + Math.floor(performance.now() / 40)) % W, y, 46, 2);
    }
    ctx.restore();
  }

  function drawFish(f) {
    ctx.save();
    const dir = Math.atan2(f.vy, f.vx);
    const rgb = f.toxic ? '255,120,60' : `${Math.floor(f.hue % 360)},${Math.floor((f.hue * 0.7) % 255)},255`;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = makeGlow(ctx, f.x, f.y, f.r * 2.2, rgb, 0.35);
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(f.x, f.y);
    ctx.rotate(dir);
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, f.r);
    bg.addColorStop(0, rgba(rgb, 0.95));
    bg.addColorStop(1, rgba(rgb, 0.5));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, f.r, f.r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(rgb, 0.8);
    ctx.beginPath();
    ctx.moveTo(-f.r * 0.8, 0);
    ctx.lineTo(-f.r * 1.6, -f.r * 0.5);
    ctx.lineTo(-f.r * 1.6, f.r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(f.r * 0.45, -f.r * 0.12, f.r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#04121a';
    ctx.beginPath();
    ctx.arc(f.r * 0.5, -f.r * 0.12, f.r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (f.toxic) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,90,50,0.9)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 7; k += 1) {
        const a = (k / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(f.x + Math.cos(a) * f.r * 0.9, f.y + Math.sin(a) * f.r * 0.9);
        ctx.lineTo(f.x + Math.cos(a) * f.r * 1.7, f.y + Math.sin(a) * f.r * 1.7);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawJelly(j) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.5 + 0.5 * Math.sin(j.phase * 2);
    const bell = ctx.createRadialGradient(j.x, j.y - j.r * 0.4, 0, j.x, j.y - j.r * 0.4, j.r);
    bell.addColorStop(0, 'rgba(180,255,240,0.55)');
    bell.addColorStop(1, 'rgba(120,200,255,0.08)');
    ctx.fillStyle = bell;
    ctx.beginPath();
    ctx.arc(j.x, j.y - j.r * 0.4, j.r * (1 + pulse * 0.1), Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,230,255,0.4)';
    ctx.lineWidth = 2;
    for (let k = -3; k <= 3; k += 1) {
      ctx.beginPath();
      ctx.moveTo(j.x + k * j.r * 0.2, j.y - j.r * 0.2);
      ctx.quadraticCurveTo(
        j.x + k * j.r * 0.3 + Math.sin(j.phase + k) * 6,
        j.y + j.r * 0.8,
        j.x + k * j.r * 0.24,
        j.y + j.r * 1.6 + pulse * 10,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(run) {
    const p = run.player;
    const rgb = hexToRgb(colorAtStage(p.stage));
    const dir = Math.atan2(p.vy, p.vx);
    ctx.save();

    // 常驻「我是玩家」标识环：细白描边，不靠颜色区分敌我
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2);
    ctx.stroke();

    if (p.stingUntil > run.time) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(160,255,220,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = makeGlow(ctx, p.x, p.y, p.r * 3.2, rgb, 0.5);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(p.x, p.y);
    ctx.rotate(dir);
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.3, rgba(rgb, 0.98));
    bg.addColorStop(1, rgba(rgb, 0.55));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(rgb, 0.85);
    ctx.beginPath();
    ctx.moveTo(-p.r * 0.8, 0);
    ctx.lineTo(-p.r * 1.7, -p.r * 0.55);
    ctx.lineTo(-p.r * 1.7, p.r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.beginPath();
    ctx.arc(p.r * 0.45, -p.r * 0.1, p.r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#02101a';
    ctx.beginPath();
    ctx.arc(p.r * 0.52, -p.r * 0.1, p.r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 1; k <= 3; k += 1) {
      const tx = p.x - p.vx * k * 0.05;
      const ty = p.y - p.vy * k * 0.05;
      ctx.fillStyle = makeGlow(ctx, tx, ty, p.r * (0.8 - k * 0.2), rgb, 0.16);
      ctx.beginPath();
      ctx.arc(tx, ty, p.r * (0.8 - k * 0.2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFood(fd) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rgb = `${Math.floor(fd.hue)},240,255`;
    ctx.fillStyle = makeGlow(ctx, fd.x, fd.y, fd.r * 2.6, rgb, 0.5);
    ctx.beginPath();
    ctx.arc(fd.x, fd.y, fd.r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(rgb, 0.9);
    ctx.beginPath();
    ctx.arc(fd.x, fd.y, fd.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAmbient() {
    const theme = zoneTheme(state.lastZone);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const a of state.ambient) {
      ctx.fillStyle = rgba(theme.particleColor, 0.5);
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBursts() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of state.bursts) {
      const a = Math.max(0, b.life / b.maxLife);
      ctx.fillStyle = rgba(b.rgb, a);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw(run) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - state.lastNow) / 1000 || 1 / 60);
    state.lastNow = now;

    const zone = run ? zoneAtStage(run.player.stage) : 0;
    if (zone !== state.lastZone) {
      state.lastZone = zone;
      seedAmbient(zone);
    }
    const theme = zoneTheme(state.lastZone);

    updateParticles(dt);
    drawBackground(theme);
    drawDecor(theme);

    if (run && run.phase !== 'dead') {
      if (zoneAtStage(run.player.stage) === 2) drawCurrent();
      drawAmbient();
      for (const j of run.jellies) drawJelly(j);
      for (const fd of run.foods) drawFood(fd);
      for (const f of run.fish) drawFish(f);
      drawPlayer(run);
    } else if (!run) {
      drawAmbient();
    }

    drawBursts();
  }

  return {
    draw,
    burst,
    setReducedMotion(b) { state.reducedMotion = !!b; },
  };
}

export default createRender;
