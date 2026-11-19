// Canvas 2D 渲染：霓虹街机背景 + 5×5 物品网格（程序化矢量图标，零素材）。
// 性能：背景与辉光精灵离屏预渲染，避免逐帧 shadowBlur（帧率稳定 ≥50）。
import { WORLD, GRID, CATEGORIES } from '../../config/game.config.js';

const CAT_COLOR = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.color]));
const ODD_COLOR = '#ff5cff';

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function line(ctx, x1, y1, x2, y2, w) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = w;
  ctx.stroke();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

// 单个图标：以 (cx,cy) 为中心、s 为半尺度，用类别色画一个独特剪影
function drawGlyph(ctx, cat, draw, cx, cy, s, color) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const fill = 'rgba(10,12,26,0.85)';
  ctx.fillStyle = fill;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.09);

  const body = (fn) => { fn(); ctx.fill(); ctx.stroke(); };

  if (cat === 'critter') {
    if (draw === 0) {
      body(() => { ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.95, s * 0.8, 0, 0, Math.PI * 2); });
      ctx.fillStyle = '#fff'; circle(ctx, cx - s * 0.32, cy - s * 0.1, s * 0.12); ctx.fill();
      circle(ctx, cx + s * 0.32, cy - s * 0.1, s * 0.12); ctx.fill();
    } else if (draw === 1) {
      body(() => { ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx - s, cy + s * 0.8); ctx.lineTo(cx + s, cy + s * 0.8); ctx.closePath(); });
      ctx.fillStyle = '#fff'; circle(ctx, cx, cy - s * 0.15, s * 0.12); ctx.fill();
    } else if (draw === 2) {
      body(() => { ctx.beginPath(); ctx.ellipse(cx - s * 0.4, cy - s * 1.0, s * 0.22, s * 0.5, -0.2, 0, Math.PI * 2); ctx.ellipse(cx + s * 0.4, cy - s * 1.0, s * 0.22, s * 0.5, 0.2, 0, Math.PI * 2); ctx.ellipse(cx, cy, s * 0.7, s * 0.7, 0, 0, Math.PI * 2); });
      ctx.fillStyle = '#fff'; circle(ctx, cx - s * 0.24, cy - s * 0.1, s * 0.1); ctx.fill(); circle(ctx, cx + s * 0.24, cy - s * 0.1, s * 0.1); ctx.fill();
    } else if (draw === 3) {
      body(() => { ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.9, s * 0.55, 0, 0, Math.PI * 2); ctx.moveTo(cx + s * 0.8, cy); ctx.lineTo(cx + s * 1.3, cy - s * 0.45); ctx.lineTo(cx + s * 1.3, cy + s * 0.45); ctx.closePath(); });
      ctx.fillStyle = '#fff'; circle(ctx, cx - s * 0.35, cy - s * 0.12, s * 0.1); ctx.fill();
    } else {
      body(() => { circle(ctx, cx, cy, s * 0.6); });
      for (let i = 0; i < 3; i += 1) { line(ctx, cx - s * 0.5, cy - s * 0.4 + i * s * 0.4, cx - s * 0.95, cy - s * 0.7 + i * s * 0.5, s * 0.07); line(ctx, cx + s * 0.5, cy - s * 0.4 + i * s * 0.4, cx + s * 0.95, cy - s * 0.7 + i * s * 0.5, s * 0.07); }
      ctx.fillStyle = '#fff'; circle(ctx, cx - s * 0.2, cy - s * 0.12, s * 0.09); ctx.fill(); circle(ctx, cx + s * 0.2, cy - s * 0.12, s * 0.09); ctx.fill();
    }
  } else if (cat === 'rover') {
    if (draw === 0) {
      body(() => { rounded(ctx, cx - s, cy - s * 0.35, s * 2, s * 0.7, s * 0.25); });
      ctx.fillStyle = '#0a0c1a'; circle(ctx, cx - s * 0.55, cy + s * 0.45, s * 0.28); ctx.fill(); ctx.stroke();
      circle(ctx, cx + s * 0.55, cy + s * 0.45, s * 0.28); ctx.fill(); ctx.stroke();
    } else if (draw === 1) {
      body(() => { ctx.beginPath(); ctx.moveTo(cx, cy - s * 1.1); ctx.lineTo(cx + s * 0.7, cy + s * 0.6); ctx.lineTo(cx, cy + s * 0.3); ctx.lineTo(cx - s * 0.7, cy + s * 0.6); ctx.closePath(); });
      body(() => { ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy + s * 0.6); ctx.lineTo(cx - s * 1.05, cy + s * 1.0); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.moveTo(cx + s * 0.7, cy + s * 0.6); ctx.lineTo(cx + s * 1.05, cy + s * 1.0); ctx.lineTo(cx + s * 0.4, cy + s * 0.6); ctx.closePath(); });
      ctx.fillStyle = '#0a0c1a'; circle(ctx, cx, cy - s * 0.25, s * 0.22); ctx.fill(); ctx.stroke();
    } else if (draw === 2) {
      body(() => { ctx.beginPath(); ctx.moveTo(cx - s * 1.1, cy + s * 0.4); ctx.lineTo(cx + s * 1.1, cy + s * 0.4); ctx.lineTo(cx + s * 0.7, cy + s * 0.9); ctx.lineTo(cx - s * 0.7, cy + s * 0.9); ctx.closePath(); });
      body(() => { ctx.beginPath(); ctx.moveTo(cx, cy - s * 1.1); ctx.lineTo(cx + s * 0.9, cy + s * 0.4); ctx.lineTo(cx, cy + s * 0.4); ctx.closePath(); });
    } else if (draw === 3) {
      body(() => { ctx.beginPath(); ctx.ellipse(cx, cy, s * 1.1, s * 0.3, 0, 0, Math.PI * 2); });
      body(() => { ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy - s * 0.1); ctx.lineTo(cx - s * 0.6, cy - s * 0.85); ctx.lineTo(cx + s * 0.1, cy - s * 0.85); ctx.lineTo(cx + s * 0.2, cy - s * 0.1); ctx.closePath(); ctx.moveTo(cx - s * 0.2, cy + s * 0.1); ctx.lineTo(cx - s * 0.6, cy + s * 0.85); ctx.lineTo(cx + s * 0.1, cy + s * 0.85); ctx.lineTo(cx + s * 0.2, cy + s * 0.1); ctx.closePath(); });
    } else {
      body(() => { rounded(ctx, cx - s * 1.0, cy - s * 0.55, s * 2, s * 0.8, s * 0.2); });
      body(() => { rounded(ctx, cx + s * 0.3, cy - s * 0.95, s * 0.4, s * 0.45, s * 0.08); });
      ctx.fillStyle = '#0a0c1a';
      [-0.7, 0, 0.7].forEach((dx) => { circle(ctx, cx + dx * s, cy + s * 0.4, s * 0.2); ctx.fill(); ctx.stroke(); });
    }
  } else if (cat === 'chrono') {
    if (draw === 0) {
      body(() => { circle(ctx, cx, cy, s * 0.9); });
      line(ctx, cx, cy, cx, cy - s * 0.5, s * 0.12); line(ctx, cx, cy, cx + s * 0.35, cy, s * 0.12);
    } else if (draw === 1) {
      body(() => { ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy - s * 1.0); ctx.lineTo(cx + s * 0.6, cy - s * 1.0); ctx.lineTo(cx, cy); ctx.lineTo(cx - s * 0.6, cy + s * 1.0); ctx.lineTo(cx + s * 0.6, cy + s * 1.0); ctx.lineTo(cx, cy); ctx.closePath(); });
      line(ctx, cx - s * 0.7, cy - s * 1.0, cx + s * 0.7, cy - s * 1.0, s * 0.1); line(ctx, cx - s * 0.7, cy + s * 1.0, cx + s * 0.7, cy + s * 1.0, s * 0.1);
    } else if (draw === 2) {
      body(() => { rounded(ctx, cx - s * 0.8, cy - s * 0.9, s * 1.6, s * 1.8, s * 0.15); });
      ctx.fillStyle = color;
      for (let rr = 0; rr < 2; rr += 1) for (let cc = 0; cc < 3; cc += 1) { const v = rr * 3 + cc; if (v !== 2) ctx.fillRect(cx - s * 0.5 + cc * s * 0.45, cy - s * 0.5 + rr * s * 0.9, s * 0.28, s * 0.5); }
    } else if (draw === 3) {
      body(() => { circle(ctx, cx, cy, s * 0.8); });
      ctx.beginPath(); ctx.arc(cx - s * 0.5, cy - s * 0.7, s * 0.3, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + s * 0.5, cy - s * 0.7, s * 0.3, Math.PI, 0); ctx.stroke();
      line(ctx, cx, cy, cx + s * 0.35, cy - s * 0.3, s * 0.1);
    } else {
      body(() => { circle(ctx, cx, cy, s * 0.8); });
      body(() => { circle(ctx, cx, cy - s * 1.1, s * 0.22); });
      line(ctx, cx, cy - s * 0.9, cx, cy - s * 0.8, s * 0.1);
    }
  } else if (cat === 'tool') {
    if (draw === 0) {
      body(() => { ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy + s * 1.0); ctx.lineTo(cx - s * 0.15, cy - s * 1.0); ctx.lineTo(cx + s * 0.15, cy - s * 1.0); ctx.lineTo(cx + s * 0.5, cy + s * 1.0); ctx.closePath(); });
      body(() => { ctx.beginPath(); ctx.moveTo(cx - s * 0.15, cy - s * 1.0); ctx.lineTo(cx, cy - s * 1.5); ctx.lineTo(cx + s * 0.15, cy - s * 1.0); ctx.closePath(); });
    } else if (draw === 1) {
      ctx.strokeStyle = ctx.strokeStyle; ctx.lineWidth = s * 0.12;
      line(ctx, cx - s * 0.6, cy - s * 0.9, cx + s * 0.6, cy + s * 0.9, s * 0.12);
      line(ctx, cx + s * 0.6, cy - s * 0.9, cx - s * 0.6, cy + s * 0.9, s * 0.12);
      ctx.fillStyle = '#0a0c1a';
      circle(ctx, cx - s * 0.6, cy - s * 0.9, s * 0.26); ctx.fill(); ctx.stroke();
      circle(ctx, cx + s * 0.6, cy - s * 0.9, s * 0.26); ctx.fill(); ctx.stroke();
    } else if (draw === 2) {
      body(() => { circle(ctx, cx - s * 0.2, cy - s * 0.3, s * 0.6); });
      line(ctx, cx + s * 0.25, cy + s * 0.15, cx + s * 0.9, cy + s * 0.8, s * 0.16);
    } else if (draw === 3) {
      body(() => { rounded(ctx, cx - s, cy - s * 0.5, s * 2, s * 1.0, s * 0.12); });
      ctx.strokeStyle = color; ctx.lineWidth = s * 0.08;
      for (let i = -3; i <= 3; i += 1) line(ctx, cx + i * s * 0.24, cy - s * 0.5, cx + i * s * 0.24, cy - s * 0.5 + (i % 2 ? s * 0.3 : s * 0.16), s * 0.08);
    } else {
      body(() => { rounded(ctx, cx - s * 0.75, cy - s, s * 1.5, s * 2, s * 0.15); });
      ctx.fillStyle = color;
      for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) { ctx.fillRect(cx - s * 0.45 + c * s * 0.45, cy - s * 0.55 + r * s * 0.55, s * 0.26, s * 0.3); }
    }
  } else { // flora
    if (draw === 0) {
      body(() => { rounded(ctx, cx - s * 0.35, cy - s * 1.0, s * 0.7, s * 2.0, s * 0.3); });
      body(() => { rounded(ctx, cx - s * 0.85, cy - s * 0.3, s * 0.5, s * 0.5, s * 0.2); rounded(ctx, cx + s * 0.35, cy - s * 0.3, s * 0.5, s * 0.5, s * 0.2); });
      line(ctx, cx - s * 0.5, cy - s * 0.1, cx - s * 0.35, cy - s * 0.1, s * 0.08); line(ctx, cx + s * 0.35, cy - s * 0.1, cx + s * 0.5, cy - s * 0.1, s * 0.08);
    } else if (draw === 1) {
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(a) * s * 0.55;
        const py = cy + Math.sin(a) * s * 0.55;
        circle(ctx, px, py, s * 0.3); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#0a0c1a'; circle(ctx, cx, cy, s * 0.32); ctx.fill(); ctx.stroke();
    } else if (draw === 2) {
      body(() => { ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy + s * 0.9); ctx.quadraticCurveTo(cx - s * 0.4, cy - s * 0.9, cx + s * 0.7, cy + s * 0.9); ctx.closePath(); });
      line(ctx, cx - s * 0.6, cy + s * 0.75, cx + s * 0.55, cy + s * 0.75, s * 0.07);
    } else if (draw === 3) {
      body(() => { rounded(ctx, cx - s * 0.16, cy - s * 0.2, s * 0.32, s * 1.1, s * 0.08); });
      body(() => { circle(ctx, cx, cy - s * 0.8, s * 0.7); });
    } else {
      ctx.strokeStyle = ctx.strokeStyle; ctx.lineWidth = s * 0.1;
      ctx.beginPath(); ctx.moveTo(cx - s * 0.8, cy + s); ctx.quadraticCurveTo(cx, cy - s * 0.6, cx + s * 0.8, cy + s * 0.6); ctx.stroke();
      circle(ctx, cx - s * 0.3, cy - s * 0.1, s * 0.22); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
      circle(ctx, cx + s * 0.4, cy + s * 0.1, s * 0.22); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}

function makeGlowSprite(color) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  rg.addColorStop(0, color);
  rg.addColorStop(0.4, color);
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.55;
  g.fillStyle = rg;
  g.fillRect(0, 0, size, size);
  return c;
}

function makeBackground() {
  const c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  gr.addColorStop(0, '#0b0d1c');
  gr.addColorStop(0.6, '#131530');
  gr.addColorStop(1, '#0b0d1c');
  g.fillStyle = gr;
  g.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  g.strokeStyle = 'rgba(90,100,180,0.10)';
  g.lineWidth = 1;
  for (let x = 0; x < WORLD.WIDTH; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WORLD.HEIGHT); g.stroke(); }
  for (let y = 0; y < WORLD.HEIGHT; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(WORLD.WIDTH, y); g.stroke(); }
  return c;
}

export function createRenderer(canvas) {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const bg = makeBackground();
  const glow = {
    critter: makeGlowSprite('#ff2d78'),
    rover: makeGlowSprite('#00e5ff'),
    chrono: makeGlowSprite('#ffd400'),
    tool: makeGlowSprite('#7cff5e'),
    flora: makeGlowSprite('#c06bff'),
    odd: makeGlowSprite(ODD_COLOR),
    hint: makeGlowSprite('#ffffff'),
  };

  return {
    render(run, view) {
      const now = view.now || 0;
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.drawImage(bg, 0, 0, WORLD.WIDTH, WORLD.HEIGHT);

      if (!run) return;

      run.items.forEach((item, i) => {
        const c = i % GRID.cols;
        const r = Math.floor(i / GRID.cols);
        const cx = GRID.left + c * GRID.cellW + GRID.cellW / 2;
        const cy = GRID.top + r * GRID.cellH + GRID.cellH / 2;
        const s = Math.min(GRID.cellW, GRID.cellH) * 0.34;
        const color = CAT_COLOR[item.cat] || '#ffffff';

        ctx.fillStyle = item.collected ? 'rgba(40,44,70,0.35)' : 'rgba(20,24,48,0.55)';
        rounded(ctx, cx - GRID.cellW / 2 + GRID.gap, cy - GRID.cellH / 2 + GRID.gap, GRID.cellW - GRID.gap * 2, GRID.cellH - GRID.gap * 2, 10);
        ctx.fill();
        ctx.strokeStyle = item.collected ? 'rgba(120,130,180,0.25)' : (item.cat === run.task?.cat ? 'rgba(140,150,220,0.5)' : 'rgba(80,90,140,0.35)');
        ctx.lineWidth = 1;
        ctx.stroke();

        const oddActive = item.odd && !item.oddResolved;

        // 辉光（预渲染精灵，替代 shadowBlur）
        const glowSprite = oddActive ? glow.odd : glow[item.cat];
        if (glowSprite && !item.collected) {
          ctx.globalAlpha = 0.6;
          ctx.drawImage(glowSprite, cx - s * 1.5, cy - s * 1.5, s * 3, s * 3);
          ctx.globalAlpha = 1;
        }

        if (oddActive) {
          const pulse = 0.5 + 0.5 * Math.sin(now * 0.01);
          ctx.strokeStyle = ODD_COLOR;
          ctx.lineWidth = 2 + pulse * 1.5;
          rounded(ctx, cx - GRID.cellW / 2 + GRID.gap + 2, cy - GRID.cellH / 2 + GRID.gap + 2, GRID.cellW - GRID.gap * 2 - 4, GRID.cellH - GRID.gap * 2 - 4, 8);
          ctx.stroke();
        }

        ctx.save();
        if (oddActive && Math.sin(now * 0.02) > 0.2) {
          ctx.translate(1, 0);
        }
        if (item.collected) {
          ctx.globalAlpha = 0.35;
          drawGlyph(ctx, item.cat, item.draw, cx, cy, s, color);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#7cff5e';
          ctx.lineWidth = 3;
          line(ctx, cx - s * 0.3, cy + s * 0.1, cx - s * 0.05, cy + s * 0.35, 3);
          line(ctx, cx - s * 0.05, cy + s * 0.35, cx + s * 0.35, cy - s * 0.25, 3);
        } else {
          drawGlyph(ctx, item.cat, item.draw, cx, cy, s, color);
        }
        ctx.restore();

        if (view.hintIndex === i) {
          const pulse = 0.5 + 0.5 * Math.sin(now * 0.012);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          rounded(ctx, cx - GRID.cellW / 2 + GRID.gap - 2, cy - GRID.cellH / 2 + GRID.gap - 2, GRID.cellW - GRID.gap * 2 + 4, GRID.cellH - GRID.gap * 2 + 4, 12);
          ctx.stroke();
          if (glow.hint) { ctx.globalAlpha = 0.5 + 0.4 * pulse; ctx.drawImage(glow.hint, cx - s * 1.6, cy - s * 1.6, s * 3.2, s * 3.2); ctx.globalAlpha = 1; }
        }
      });

      // 扩散环反馈
      for (const fx of view.fx) {
        const age = (now - fx.born) / 1000;
        if (age > fx.ttl) continue;
        const k = age / fx.ttl;
        ctx.strokeStyle = fx.color;
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 3 * (1 - k) + 1;
        circle(ctx, fx.x, fx.y, 10 + k * 46);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
  };
}
