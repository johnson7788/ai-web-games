// MERGE BASKETBALL · 霓虹街机 Canvas 2D 程序化渲染（零素材）
// 逻辑坐标系 375×667，按 stage 尺寸等比缩放居中；DPR ≤2。
import { WORLD, GAME } from '../../config/game.config.js';
import { ballSize } from '../game/sim.js';

const { WIDTH, HEIGHT, GROUND_H } = WORLD;
const GROUND_Y = HEIGHT - GROUND_H;

const HUE_BY_IDX = [0, 28, 52, 88, 138, 188, 226, 268, 300, 22];

function ballHue(value) {
  if (value <= 0) return 0;
  const idx = Math.max(0, Math.min(HUE_BY_IDX.length - 1, Math.log2(value) - 1));
  return HUE_BY_IDX[idx];
}

function ballColor(value) {
  const h = ballHue(value);
  return { main: `hsl(${h} 88% 52%)`, dark: `hsl(${h} 85% 30%)`, light: `hsl(${h} 90% 68%)`, hue: h };
}

export { ballColor };

function drawBall(ctx, x, y, r, value, kind) {
  if (kind === 'rock') {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#9aa7b8');
    g.addColorStop(1, '#3a4353');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.stroke();
    // 岩石裂纹
    ctx.strokeStyle = 'rgba(10,14,20,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.4);
    ctx.lineTo(x + r * 0.1, y + r * 0.1);
    ctx.lineTo(x - r * 0.15, y + r * 0.55);
    ctx.stroke();
    ctx.fillStyle = '#e8eef5';
    ctx.font = `700 ${Math.max(9, r * 0.55)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ROCK', x, y);
    return;
  }

  const c = ballColor(value);
  const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.38, r * 0.08, x, y, r);
  g.addColorStop(0, c.light);
  g.addColorStop(0.55, c.main);
  g.addColorStop(1, c.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // 篮球缝线
  ctx.strokeStyle = 'rgba(20,12,4,0.42)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r, y, r, -Math.PI / 2.6, Math.PI / 2.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + r, y, r, Math.PI - Math.PI / 2.6, Math.PI + Math.PI / 2.6);
  ctx.stroke();

  // 数值
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  const label = value <= GAME.WIN_VALUE ? String(value) : `${Math.log2(value) - 9}x`;
  ctx.font = `800 ${Math.max(9, r * 0.62)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + r * 0.03);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let layout = { scale: 1, offX: 0, offY: 0, play: { x: 0, y: 0, w: 0, h: 0 } };

  function computeLayout(cw, ch) {
    const scale = Math.min(cw / WIDTH, ch / HEIGHT);
    const pw = WIDTH * scale;
    const ph = HEIGHT * scale;
    const offX = (cw - pw) / 2;
    const offY = (ch - ph) / 2;
    layout = { scale, offX, offY, play: { x: offX, y: offY, w: pw, h: ph } };
    return layout;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h, dpr, cssW: rect.width, cssH: rect.height };
  }

  function bg(cssW, cssH) {
    const g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, '#0b0a1f');
    g.addColorStop(0.55, '#141230');
    g.addColorStop(1, '#1c1440');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  function court(scale) {
    const { offX, offY } = layout;
    // 场地内半透明底
    ctx.fillStyle = 'rgba(20,18,48,0.55)';
    ctx.fillRect(offX, offY, WIDTH * scale, HEIGHT * scale);
    // 侧墙霓虹
    const wallGrad = ctx.createLinearGradient(offX, offY, offX + WIDTH * scale, offY);
    wallGrad.addColorStop(0, 'rgba(0,229,255,0.8)');
    wallGrad.addColorStop(0.5, 'rgba(120,90,255,0.25)');
    wallGrad.addColorStop(1, 'rgba(0,229,255,0.8)');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(offX, offY, 3, HEIGHT * scale);
    ctx.fillRect(offX + WIDTH * scale - 3, offY, 3, HEIGHT * scale);
    // 地面
    const gg = ctx.createLinearGradient(0, offY + GROUND_Y * scale, 0, offY + HEIGHT * scale);
    gg.addColorStop(0, 'rgba(0,229,255,0.7)');
    gg.addColorStop(1, 'rgba(120,90,255,0.12)');
    ctx.fillStyle = gg;
    ctx.fillRect(offX, offY + GROUND_Y * scale, WIDTH * scale, GROUND_H * scale);
    ctx.strokeStyle = 'rgba(0,229,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(offX, offY + GROUND_Y * scale);
    ctx.lineTo(offX + WIDTH * scale, offY + GROUND_Y * scale);
    ctx.stroke();
    // 顶部危险线
    ctx.strokeStyle = 'rgba(255,60,90,0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(offX, offY + 2);
    ctx.lineTo(offX + WIDTH * scale, offY + 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function nextPreview(state, dt) {
    const { offX, offY, scale } = layout;
    const r = state.nextKind === 'rock' ? GAME.ROCK_RADIUS : ballSize(state.nextValue) / 2;
    const cx = offX + WIDTH * scale / 2;
    const cy = offY + 26 * scale;
    const pr = Math.max(12, r * scale * 0.8);

    // 自动落球倒计时环
    const frac = Math.min(1, state.autoDropTimer / GAME.AUTO_DROP_SEC);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, pr + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = frac > 0.72 ? '#ff5d7a' : '#3af0ff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, pr + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.lineCap = 'butt';

    drawBall(ctx, cx, cy, pr, state.nextValue, state.nextKind);

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.max(10, 11 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('NEXT', cx, cy + pr + 20 * scale);
  }

  function draw(state, dt, view) {
    const { w, h, dpr, cssW, cssH } = resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bg(cssW, cssH);
    computeLayout(cssW, cssH);
    court(layout.scale);

    if (state) {
      nextPreview(state, dt);
      const { offX, offY, scale } = layout;
      // 瞄准鬼影
      if (view && view.aiming && view.pointerX != null) {
        const gr = state.nextKind === 'rock' ? GAME.ROCK_RADIUS : ballSize(state.nextValue) / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(offX + view.pointerX * scale, offY + GAME.SPAWN_Y * scale, gr * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const b of state.balls) {
        drawBall(ctx, offX + b.x * scale, offY + b.y * scale, b.r * scale, b.value, b.kind);
      }
      // 合成闪光粒子
      if (view && view.fx && view.fx.length) {
        for (const f of view.fx) {
          const a = Math.max(0, f.ttl);
          ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(offX + f.x * scale, offY + f.y * scale, (1.6 - a) * 46 * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // 连击提示
      if (state.combo >= 2 && state.comboFlash > 0) {
        ctx.fillStyle = 'rgba(255,240,120,0.95)';
        ctx.font = `800 ${28 * scale}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`COMBO x${state.combo}`, offX + WIDTH * scale / 2, offY + 96 * scale);
      }
    }
  }

  return {
    draw,
    debugLayout() {
      return layout;
    },
  };
}
