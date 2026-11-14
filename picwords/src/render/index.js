// Canvas 2D 渲染：AI 图 clue + 答案槽 + 字母块 + 正确/错误反馈。
// 玩法层（槽位/字母/高亮/命中几何）保持程序化，AI 只替换背景与 clue 贴图。
import { WORLD, COLORS } from '../../config/game.config.js';
import { art, CLUE_H } from './art.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const TILE = 56;
const GAP = 10;

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

function rowLayout(n, y) {
  const total = n * TILE + (n - 1) * GAP;
  const startX = WORLD.WIDTH / 2 - total / 2;
  return Array.from({ length: n }, (_, i) => ({ x: startX + i * (TILE + GAP), y }));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let wrongFlash = 0;
  let correctFlash = 0;

  function flashWrong() { wrongFlash = 0.4; }
  function flashCorrect() { correctFlash = 0.6; }
  function update(dt) {
    wrongFlash = Math.max(0, wrongFlash - dt);
    correctFlash = Math.max(0, correctFlash - dt);
  }

  function drawBackground() {
    if (art.bg) {
      // 整幅铺底（1280×720），玩法层叠在其上。
      ctx.drawImage(art.bg, 0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      return;
    }
    // 素材未到位：程序化渐变占位，不白屏。
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(640, 220, 60, 640, 360, 800);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawClue(picture) {
    const image = art.clue(picture.word);
    if (image) {
      // pivot=center：按 manifest 高度 260 等比绘制，中心对齐原 emoji 位。
      const h = CLUE_H;
      const w = (image.naturalWidth / image.naturalHeight) * h;
      ctx.drawImage(image, WORLD.WIDTH / 2 - w / 2, 185 - h / 2, w, h);
      return;
    }
    // 素材未到位：emoji 占位。
    ctx.font = '130px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(picture.emoji, WORLD.WIDTH / 2, 190);
  }

  function render(view) {
    const { run } = view;
    drawBackground();
    if (!run) return;
    drawClue(run.picture);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 答案槽
    const slots = rowLayout(run.word.length, 330);
    slots.forEach((pos, i) => {
      const tileIdx = run.slots[i];
      ctx.fillStyle = COLORS.slot;
      roundRect(ctx, pos.x, pos.y, TILE, TILE, 10);
      ctx.fill();
      ctx.strokeStyle = correctFlash > 0 ? COLORS.good : COLORS.tileEdge;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (tileIdx !== null) {
        ctx.fillStyle = COLORS.ink;
        ctx.font = `800 30px ${FONT}`;
        ctx.fillText(run.tiles[tileIdx].letter, pos.x + TILE / 2, pos.y + TILE / 2 + 1);
      }
    });
    // 字母块
    const tiles = rowLayout(run.tiles.length, 450);
    tiles.forEach((pos, i) => {
      const t = run.tiles[i];
      ctx.globalAlpha = t.used ? 0.25 : 1;
      ctx.fillStyle = COLORS.tile;
      roundRect(ctx, pos.x, pos.y, TILE, TILE, 10);
      ctx.fill();
      ctx.strokeStyle = COLORS.tileEdge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COLORS.ink;
      ctx.font = `800 30px ${FONT}`;
      ctx.fillText(t.letter, pos.x + TILE / 2, pos.y + TILE / 2 + 1);
      ctx.globalAlpha = 1;
    });
    if (wrongFlash > 0) {
      ctx.globalAlpha = wrongFlash;
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 5;
      const first = slots[0];
      const last = slots[slots.length - 1];
      roundRect(ctx, first.x - 6, first.y - 6, last.x + TILE - first.x + 12, TILE + 12, 12);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function hitTile(x, y, run) {
    const tiles = rowLayout(run.tiles.length, 450);
    for (let i = 0; i < tiles.length; i += 1) {
      const p = tiles[i];
      if (x >= p.x && x <= p.x + TILE && y >= p.y && y <= p.y + TILE) return i;
    }
    return -1;
  }
  function hitSlot(x, y, run) {
    const slots = rowLayout(run.word.length, 330);
    for (let i = 0; i < slots.length; i += 1) {
      const p = slots[i];
      if (x >= p.x && x <= p.x + TILE && y >= p.y && y <= p.y + TILE) return i;
    }
    return -1;
  }

  function clearEffects() { wrongFlash = 0; correctFlash = 0; }

  return { render, update, hitTile, hitSlot, flashWrong, flashCorrect, clearEffects };
}