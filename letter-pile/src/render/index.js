// Canvas 2D 渲染：字母堆 + 当前拼词缓冲 + 反馈。
import { WORLD, PILE, COLORS } from '../../config/game.config.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const TILE = 64;
const GAP = 16;

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function pilePositions(n) {
  const cols = Math.min(n, 5);
  const rows = Math.ceil(n / cols);
  const totalW = cols * TILE + (cols - 1) * GAP;
  const totalH = rows * TILE + (rows - 1) * GAP;
  const startX = PILE.X + (PILE.W - totalW) / 2;
  const startY = PILE.Y + (PILE.H - totalH) / 2;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.push({ x: startX + col * (TILE + GAP), y: startY + row * (TILE + GAP) });
  }
  return out;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let wrongFlash = 0;

  function flashWrong() { wrongFlash = 0.4; }
  function update(dt) { wrongFlash = Math.max(0, wrongFlash - dt); }

  function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(370, 380, 60, 370, 380, 700);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawTile(x, y, letter, selected, dim) {
    ctx.globalAlpha = dim ? 0.3 : 1;
    ctx.fillStyle = selected ? COLORS.tileSel : COLORS.tile;
    roundRect(ctx, x, y, TILE, TILE, 12);
    ctx.fill();
    ctx.strokeStyle = selected ? '#fff' : COLORS.tileEdge;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = selected ? '#1a0b2e' : COLORS.ink;
    ctx.font = `800 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, x + TILE / 2, y + TILE / 2 + 1);
    ctx.globalAlpha = 1;
  }

  function render(view) {
    const { run } = view;
    drawBackground();
    if (!run) return;
    // 拼词缓冲
    const sel = run.selected;
    const bufW = Math.max(200, sel.length * (TILE + 8) + 40);
    const bufX = PILE.X + PILE.W / 2 - bufW / 2;
    ctx.fillStyle = COLORS.panel;
    roundRect(ctx, bufX, 150, bufW, TILE + 24, 14);
    ctx.fill();
    ctx.strokeStyle = wrongFlash > 0 ? COLORS.danger : COLORS.panelEdge;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (sel.length === 0) {
      ctx.fillStyle = 'rgba(243,238,252,0.3)';
      ctx.font = `600 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('tap letters…', PILE.X + PILE.W / 2, 150 + (TILE + 24) / 2);
    } else {
      const startX = PILE.X + PILE.W / 2 - (sel.length * (TILE + 8) - 8) / 2;
      sel.forEach((letterIdx, i) => {
        drawTile(startX + i * (TILE + 8), 162, run.letters[letterIdx], true, false);
      });
    }
    // 字母堆
    const positions = pilePositions(run.letters.length);
    run.pileOrder.forEach((letterIdx, i) => {
      const pos = positions[i];
      const isSelected = run.selected.includes(letterIdx);
      drawTile(pos.x, pos.y, run.letters[letterIdx], false, isSelected);
    });
  }

  function hitLetter(x, y, run) {
    const positions = pilePositions(run.letters.length);
    for (let i = 0; i < positions.length; i += 1) {
      const p = positions[i];
      if (x >= p.x && x <= p.x + TILE && y >= p.y && y <= p.y + TILE) return run.pileOrder[i];
    }
    return -1;
  }

  function clearEffects() { wrongFlash = 0; }

  return { render, update, hitLetter, flashWrong, clearEffects };
}