// Canvas 2D 渲染：国旗色带（竖/横）+ 未涂编号 + 错误标记 + 正确/错误闪光。
// 背景/旗杆/相框走 AI 素材（src/render/art.js），色带与判定保持程序化。
import { WORLD, FLAG, PALETTE, COLORS } from '../../config/game.config.js';
import { ART, getArt } from './art.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

// 相框内开口（透明区）实测 516×296；等比缩放到包住旗帜，上下各留 8px。
const FRAME_OPEN_W = 516;
const FRAME_OPEN_H = 296;
const FRAME_SCALE = (FLAG.H + 16) / FRAME_OPEN_H;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let flash = null;

  function flashCorrect() { flash = { color: COLORS.good, t: 0, life: 0.5 }; }
  function flashWrong() { flash = { color: COLORS.danger, t: 0, life: 0.4 }; }
  function update(dt) {
    if (flash) { flash.t += dt; if (flash.t >= flash.life) flash = null; }
  }

  function drawBackground() {
    const bg = getArt().bg;
    if (bg) {
      // 整幅铺底 1280×720（宽 1280 满铺，高 722 上下各裁 1px）。
      ctx.drawImage(bg, 0, (WORLD.HEIGHT - ART.bg.h) / 2, ART.bg.w, ART.bg.h);
      return;
    }
    // 占位：原程序化夜色渐变，绝不白屏。
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(360, 360, 60, 360, 360, 800);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawFlagPole() {
    const pole = getArt().flagpole;
    if (!pole) return;
    const meta = ART.flagpole;
    // 装饰旗杆：立在旗帜左侧的框内留白里，底对齐旗底（pivot=bottom）。
    const x = FLAG.X - 35;
    const yBase = FLAG.Y + FLAG.H;
    ctx.drawImage(pole, x - meta.w / 2, yBase - meta.h, meta.w, meta.h);
  }

  function drawFlag(run, view) {
    const n = run.painted.length;
    const orient = view.orient;
    const frame = getArt().frame;
    if (frame) {
      const meta = ART.frame;
      const w = meta.w * FRAME_SCALE;
      const h = meta.h * FRAME_SCALE;
      const cx = FLAG.X + FLAG.W / 2;
      const cy = FLAG.Y + FLAG.H / 2;
      ctx.drawImage(frame, cx - w / 2, cy - h / 2, w, h);
    } else {
      // 占位：原白框 + 描边。
      ctx.fillStyle = '#fff';
      ctx.fillRect(FLAG.X - 6, FLAG.Y - 6, FLAG.W + 12, FLAG.H + 12);
      ctx.strokeStyle = COLORS.panelEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(FLAG.X - 6, FLAG.Y - 6, FLAG.W + 12, FLAG.H + 12);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i += 1) {
      const w = orient === 'v' ? FLAG.W / n : FLAG.W;
      const h = orient === 'v' ? FLAG.H : FLAG.H / n;
      const x = orient === 'v' ? FLAG.X + i * w : FLAG.X;
      const y = orient === 'v' ? FLAG.Y : FLAG.Y + i * h;
      const color = run.painted[i];
      if (color) {
        ctx.fillStyle = PALETTE[color];
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.fillStyle = COLORS.empty;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(238,242,255,0.5)';
        ctx.font = `800 30px ${FONT}`;
        ctx.fillText(String(i + 1), x + w / 2, y + h / 2);
      }
      // 错误标记
      if (run.wrongBands.has(i)) {
        ctx.strokeStyle = COLORS.danger;
        ctx.lineWidth = 5;
        ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
        ctx.fillStyle = COLORS.danger;
        ctx.font = `800 24px ${FONT}`;
        ctx.fillText('✕', x + w - 20, y + 20);
      }
      // 分隔线
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }
    if (flash) {
      ctx.globalAlpha = 0.3 * (1 - flash.t / flash.life);
      ctx.fillStyle = flash.color;
      ctx.fillRect(FLAG.X - 6, FLAG.Y - 6, FLAG.W + 12, FLAG.H + 12);
      ctx.globalAlpha = 1;
    }
  }

  function render(view) {
    drawBackground();
    drawFlagPole();
    if (view.run) drawFlag(view.run, view);
  }

  function hitBand(x, y, run, orient) {
    const n = run.painted.length;
    if (x < FLAG.X || x > FLAG.X + FLAG.W || y < FLAG.Y || y > FLAG.Y + FLAG.H) return -1;
    if (orient === 'v') return Math.floor((x - FLAG.X) / (FLAG.W / n));
    return Math.floor((y - FLAG.Y) / (FLAG.H / n));
  }

  function clearEffects() { flash = null; }

  return { render, update, hitBand, flashCorrect, flashWrong, clearEffects };
}
