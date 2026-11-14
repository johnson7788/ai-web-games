// Canvas 2D 渲染：AI 背景/画框铺底，数字填色网格（玩法层）保留程序化。
import { WORLD, GRID, PALETTE, COLORS } from '../../config/game.config.js';
import { art, FRAME } from './art.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const FRAME_PAD = 6; // 画框内边距（格与框之间留白）

export function cellRect(r, c) {
  return { x: GRID.X + c * GRID.CELL, y: GRID.Y + r * GRID.CELL, w: GRID.CELL, h: GRID.CELL };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let wrongFlash = null;
  let loading = 1; // 预载进度 0..1；1 = 完成（初始不显示进度条）

  function flashWrong(r, c) { wrongFlash = { r, c, t: 0, life: 0.4 }; }
  function update(dt) {
    if (wrongFlash) {
      wrongFlash.t += dt;
      if (wrongFlash.t >= wrongFlash.life) wrongFlash = null;
    }
  }
  function setLoading(p) { loading = Math.max(0, Math.min(1, p)); }

  // 整幅铺底：等比 cover 居中裁剪（素材 1280×722，几乎正好铺满 1280×720）
  function drawCover(img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const s = Math.max(WORLD.WIDTH / iw, WORLD.HEIGHT / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(img, (WORLD.WIDTH - dw) / 2, (WORLD.HEIGHT - dh) / 2, dw, dh);
  }

  function drawBackground(phase) {
    let img = null;
    if (phase === 'title') img = art.keyart;
    else if (phase === 'complete') img = art.celebration;
    else img = art.bg;
    if (img) { drawCover(img); return; }
    // 占位：程序化渐变（原背景），素材未到位不白屏
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(360, 360, 60, 360, 360, 800);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawGrid(run) {
    const n = run.size;
    const gw = n * GRID.CELL;
    const gh = n * GRID.CELL;
    const cx = GRID.X + gw / 2;
    const cy = GRID.Y + gh / 2;
    const pad = art.frame ? FRAME_PAD : 10;
    const pw = gw + pad * 2;
    const ph = gh + pad * 2;
    const px = cx - pw / 2;
    const py = cy - ph / 2;

    // 画布底板（框内）
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(px, py, pw, ph);

    // 画框 sprite：按镂空开口贴到格 + 边距，pivot center
    if (art.frame) {
      const sx = pw / FRAME.openW;
      const sy = ph / FRAME.openH;
      const dw = FRAME.w * sx;
      const dh = FRAME.h * sy;
      ctx.drawImage(art.frame, cx - dw / 2, cy - dh / 2, dw, dh);
    } else {
      ctx.strokeStyle = COLORS.panelEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, pw, ph);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const v = run.grid[r][c];
        const { x, y } = cellRect(r, c);
        if (v === 0) continue; // 背景留空
        if (run.filled[r][c]) {
          ctx.fillStyle = PALETTE[v];
          ctx.fillRect(x + 1, y + 1, GRID.CELL - 2, GRID.CELL - 2);
        } else {
          const isSel = v === run.selectedColor;
          ctx.fillStyle = isSel ? 'rgba(192,132,252,0.18)' : COLORS.cellEmpty;
          ctx.fillRect(x + 1, y + 1, GRID.CELL - 2, GRID.CELL - 2);
          ctx.strokeStyle = isSel ? COLORS.accent : COLORS.cellEdge;
          ctx.lineWidth = isSel ? 2 : 1;
          ctx.strokeRect(x + 1.5, y + 1.5, GRID.CELL - 3, GRID.CELL - 3);
          ctx.fillStyle = isSel ? COLORS.accent : 'rgba(243,238,252,0.5)';
          ctx.font = `700 ${GRID.CELL * 0.42}px ${FONT}`;
          ctx.fillText(String(v), x + GRID.CELL / 2, y + GRID.CELL / 2 + 1);
        }
      }
    }
    if (wrongFlash) {
      const { x, y } = cellRect(wrongFlash.r, wrongFlash.c);
      ctx.globalAlpha = 1 - wrongFlash.t / wrongFlash.life;
      ctx.fillStyle = COLORS.danger;
      ctx.fillRect(x + 1, y + 1, GRID.CELL - 2, GRID.CELL - 2);
      ctx.globalAlpha = 1;
    }
  }

  function drawLoading() {
    const w = 320;
    const h = 10;
    const x = (WORLD.WIDTH - w) / 2;
    const y = WORLD.HEIGHT - 40;
    ctx.fillStyle = 'rgba(28,20,40,0.85)';
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = COLORS.panelEdge;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x, y, w * loading, h);
  }

  function render(view) {
    const phase = view.phase || 'playing';
    drawBackground(phase);
    const inGame = phase === 'playing' || phase === 'paused' || phase === 'complete';
    if (view.run && inGame) drawGrid(view.run);
    if (loading < 1) drawLoading();
  }

  function hitCell(x, y, run) {
    const c = Math.floor((x - GRID.X) / GRID.CELL);
    const r = Math.floor((y - GRID.Y) / GRID.CELL);
    if (r < 0 || r >= run.size || c < 0 || c >= run.size) return null;
    return { r, c };
  }

  function clearEffects() { wrongFlash = null; }

  return { render, update, hitCell, cellRect, flashWrong, clearEffects, setLoading };
}
