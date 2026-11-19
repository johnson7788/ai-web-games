// Canvas 2D 渲染（霓虹街机主题，程序化，零素材零外链）。
// 世界坐标 1280×720，y 向下。DPR ≤2。prefers-reduced-motion 时关掉动效。
import { WORLD, GAME } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const FLOOR_Y = GAME.FLOOR_Y;

const NEON = {
  cyan: '#38e6ff',
  cyanDeep: '#0aa8d8',
  magenta: '#ff4fd8',
  violet: '#8a5cff',
  yellow: '#ffe24d',
  red: '#ff4a3d',
  orange: '#ff8a2e',
  liquid: '#2fd6ff',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;

  const reduced = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function levelOf(state) {
    return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (state.level - 1)))] || LEVELS[0];
  }

  function drawBg() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0a18');
    g.addColorStop(0.55, '#100e26');
    g.addColorStop(1, '#1a0f2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 远景霓虹网格（透视地平线，纯装饰）
    ctx.save();
    ctx.strokeStyle = 'rgba(138, 92, 255, 0.14)';
    ctx.lineWidth = 1;
    const horizon = 500;
    for (let i = 0; i <= 20; i += 1) {
      const x = (i / 20) * W;
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.lineTo(x + (x - W / 2) * 1.2, H);
      ctx.stroke();
    }
    for (let i = 0; i < 9; i += 1) {
      const y = horizon + Math.pow(i / 8, 1.8) * (H - horizon);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    // 顶部辉光
    const top = ctx.createRadialGradient(W * 0.5, -80, 10, W * 0.5, -80, 420);
    top.addColorStop(0, 'rgba(255, 79, 216, 0.20)');
    top.addColorStop(1, 'rgba(255, 79, 216, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 300);
  }

  function drawTitleBg() {
    drawBg();
    // 标题屏中央一道装饰霓虹斜轨 + 光点
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(56, 230, 255, 0.25)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(200, 470);
    ctx.lineTo(1080, 260);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 79, 216, 0.22)';
    ctx.beginPath();
    ctx.moveTo(260, 520);
    ctx.lineTo(1020, 330);
    ctx.stroke();
    ctx.restore();
  }

  function glow(color, blur = 12) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function noGlow() {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  function drawLava() {
    const g = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
    g.addColorStop(0, '#ff4a3d');
    g.addColorStop(0.4, '#ff8a2e');
    g.addColorStop(1, '#7a1400');
    ctx.fillStyle = g;
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow('#ff6a2e', 18);
    ctx.fillStyle = 'rgba(255, 106, 46, 0.35)';
    ctx.fillRect(0, FLOOR_Y, W, 10);
    noGlow();
    ctx.restore();
  }

  function drawSource(state) {
    const lv = levelOf(state);
    for (const s of lv.sources) {
      ctx.save();
      // 发光水滴喷口（圆 + 下尖，读作「水从这里出」）
      const r = 14;
      glow(NEON.cyan, 18);
      ctx.fillStyle = 'rgba(56, 230, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(s.x, s.y - 8, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s.x - r, s.y - 2);
      ctx.quadraticCurveTo(s.x - r * 0.9, s.y + 12, s.x, s.y + 18);
      ctx.quadraticCurveTo(s.x + r * 0.9, s.y + 12, s.x + r, s.y - 2);
      ctx.closePath();
      ctx.fill();
      noGlow();
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(s.x - 5, s.y - 12, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawGlass(state) {
    const lv = levelOf(state);
    const { mx, my, w } = lv.glass;
    const half = w / 2;
    const hh = FLOOR_Y - my;
    const fillPct = Math.min(1, state.fill / state.winWaterNum);

    ctx.save();

    // 杯体（霓虹烧杯梯形：宽口窄底，读作「杯子」）
    const botW = w - 22;
    ctx.beginPath();
    ctx.moveTo(mx - half, my);
    ctx.lineTo(mx - half, my + hh - 8);
    ctx.lineTo(mx - botW / 2, my + hh);
    ctx.lineTo(mx + botW / 2, my + hh);
    ctx.lineTo(mx + half, my + hh - 8);
    ctx.lineTo(mx + half, my);
    ctx.closePath();

    glow(NEON.cyan, 18);
    ctx.fillStyle = 'rgba(14, 58, 82, 0.78)';
    ctx.fill();
    ctx.strokeStyle = NEON.cyan;
    ctx.lineWidth = 5;
    ctx.stroke();
    noGlow();

    // 杯口厚沿（强调这是「接水口」）
    ctx.fillStyle = 'rgba(56, 230, 255, 0.95)';
    roundRect(ctx, mx - half - 6, my - 5, w + 12, 10, 5);
    ctx.fill();

    // 目标填充线（黄色虚线，杯口下方 = 需装满的线）
    const targetY = my + 12;
    ctx.save();
    ctx.setLineDash([9, 8]);
    glow(NEON.yellow, 10);
    ctx.strokeStyle = 'rgba(255, 226, 77, 0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(mx - half + 14, targetY);
    ctx.lineTo(mx + half - 14, targetY);
    ctx.stroke();
    noGlow();
    ctx.setLineDash([]);
    ctx.restore();

    // 液体（从杯底上升，装满到虚线）
    const liquidH = hh * fillPct;
    if (liquidH > 2) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(mx - half + 4, my + hh - liquidH, w - 8, liquidH);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      glow(NEON.liquid, 12);
      ctx.fillStyle = 'rgba(47, 214, 255, 0.88)';
      ctx.fillRect(mx - half, my + hh - liquidH, w, liquidH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(mx - half, my + hh - liquidH, w, 3);
      noGlow();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawWalls(state) {
    const lv = levelOf(state);
    ctx.save();
    ctx.lineCap = 'round';
    for (const s of lv.walls) {
      if (s.type === 'seg') {
        if (s.lava) {
          glow(NEON.red, 16);
          ctx.strokeStyle = NEON.red;
          ctx.lineWidth = (s.half || 12) * 2;
        } else {
          glow(NEON.violet, 8);
          ctx.strokeStyle = NEON.violet;
          ctx.lineWidth = (s.half || 12) * 2;
        }
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      } else {
        glow(s.lava ? NEON.red : NEON.violet, 8);
        ctx.fillStyle = s.lava ? NEON.red : 'rgba(138,92,255,0.5)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      noGlow();
    }
    ctx.restore();
  }

  function drawLines(state) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const line of state.lines) {
      glow(NEON.magenta, 14);
      ctx.strokeStyle = NEON.magenta;
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(line.pts[0][0], line.pts[0][1]);
      for (let i = 1; i < line.pts.length; i += 1) ctx.lineTo(line.pts[i][0], line.pts[i][1]);
      ctx.stroke();
      noGlow();
      // 芯线高光
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(line.pts[0][0], line.pts[0][1]);
      for (let i = 1; i < line.pts.length; i += 1) ctx.lineTo(line.pts[i][0], line.pts[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHint(view) {
    if (!view || !view.hint || !view.hint.length) return;
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = 'rgba(255, 226, 77, 0.5)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    for (const poly of view.hint) {
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i][0], poly[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCursor(view) {
    if (!view || !view.drawing || !view.cursor) return;
    ctx.save();
    glow(NEON.magenta, 8);
    ctx.strokeStyle = 'rgba(255,79,216,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(view.cursor.x, view.cursor.y, 12, 0, Math.PI * 2);
    ctx.stroke();
    noGlow();
    ctx.restore();
  }

  function drawGems(state) {
    ctx.save();
    for (const g of state.gems) {
      if (g.collected) continue;
      glow(NEON.yellow, 14);
      ctx.fillStyle = NEON.yellow;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - g.r);
      ctx.lineTo(g.x + g.r, g.y);
      ctx.lineTo(g.x, g.y + g.r);
      ctx.lineTo(g.x - g.r, g.y);
      ctx.closePath();
      ctx.fill();
      noGlow();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(g.x - g.r * 0.25, g.y - g.r * 0.25, g.r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBoxes(state) {
    ctx.save();
    for (const b of state.boxes) {
      const color = b.heavy ? NEON.magenta : '#2fe6b0';
      glow(color, 12);
      ctx.fillStyle = b.heavy ? 'rgba(255,79,216,0.35)' : 'rgba(47,230,176,0.35)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      noGlow();
      // 纹理
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x - b.r * 0.6, b.y);
      ctx.lineTo(b.x + b.r * 0.6, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDrops(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of state.drops) {
      if (!d.alive) continue;
      const r = d.r + 3;
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.4, 'rgba(120,235,255,0.9)');
      g.addColorStop(1, 'rgba(47,214,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function render(state, view) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!state) { drawTitleBg(); return; }
    drawBg();
    drawLava();
    drawSource(state);
    drawWalls(state);
    drawGlass(state);
    drawGems(state);
    drawBoxes(state);
    drawLines(state);
    drawHint(view);
    drawDrops(state);
    drawCursor(view);
  }

  function debugLayout() {
    // 供教程聚光灯/验收使用：返回玻璃杯口的屏幕矩形
    const s = levelOf({ level: 1 });
    return { glass: { x: s.glass.mx - s.glass.w / 2, y: s.glass.my - 12, w: s.glass.w, h: 30 } };
  }

  return { render, debugLayout, levelOf };
}
