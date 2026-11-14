// Canvas 2D 渲染：俯视角城市 + 建筑 + 车辆 + 工具栏 + HUD。
import { WORLD, TILE, COLS, ROWS, OX, OY, BUILDINGS, TOOLS, COLORS } from '../../config/game.config.js';
import { t } from '../core/i18n.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const TOOL_KEY = { 1: 'road', 2: 'house', 3: 'shop', 4: 'park', 5: 'tree', 6: 'water', '-1': 'bulldoze' };

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

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function clearEffects() {}
  function update() {}

  function drawBuilding(id, x, y) {
    const s = TILE;
    if (id === 1) {
      ctx.fillStyle = BUILDINGS[1].color; ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(x + 4, y + s / 2); ctx.lineTo(x + s - 4, y + s / 2); ctx.stroke();
      ctx.setLineDash([]);
    } else if (id === 2) {
      ctx.fillStyle = '#c89058'; ctx.fillRect(x + 5, y + 16, s - 10, s - 20);
      ctx.fillStyle = '#b85c4a';
      ctx.beginPath(); ctx.moveTo(x + 3, y + 18); ctx.lineTo(x + s / 2, y + 5); ctx.lineTo(x + s - 3, y + 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b4a2f'; ctx.fillRect(x + s / 2 - 5, y + s - 16, 10, 12);
      ctx.fillStyle = '#bfe3f2'; ctx.fillRect(x + 9, y + 22, 8, 8); ctx.fillRect(x + s - 17, y + 22, 8, 8);
    } else if (id === 3) {
      ctx.fillStyle = '#5a90c8'; ctx.fillRect(x + 4, y + 12, s - 8, s - 16);
      ctx.fillStyle = '#e8edf5'; ctx.fillRect(x + 4, y + 12, s - 8, 8);
      ctx.fillStyle = '#f4b400';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + 6 + k * 9, y + 12, 5, 8);
      ctx.fillStyle = '#bfe3f2'; ctx.fillRect(x + 10, y + 26, s - 20, 12);
    } else if (id === 4) {
      ctx.fillStyle = BUILDINGS[4].color; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#3f7a34'; ctx.beginPath(); ctx.arc(x + 14, y + 16, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c89058'; ctx.fillRect(x + 22, y + 28, 16, 5);
    } else if (id === 5) {
      ctx.fillStyle = COLORS.grass; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#6b4a2f'; ctx.fillRect(x + s / 2 - 3, y + 24, 6, 14);
      ctx.fillStyle = BUILDINGS[5].color; ctx.beginPath(); ctx.arc(x + s / 2, y + 18, 13, 0, Math.PI * 2); ctx.fill();
    } else if (id === 6) {
      ctx.fillStyle = BUILDINGS[6].color; ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 6, y + 16); ctx.quadraticCurveTo(x + 14, y + 12, x + 22, y + 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 14, y + 28); ctx.quadraticCurveTo(x + 22, y + 24, x + 30, y + 28); ctx.stroke();
    }
  }

  function drawGrid(run) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = OX + c * TILE, y = OY + r * TILE;
        ctx.fillStyle = (r + c) % 2 ? COLORS.grass : COLORS.grassAlt;
        ctx.fillRect(x, y, TILE, TILE);
        const id = run.grid[r][c];
        if (id !== 0) drawBuilding(id, x, y);
        ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  function drawCars(run) {
    for (const car of run.cars) {
      const x = OX + (car.c + (car.nc - car.c) * car.t) * TILE + TILE / 2;
      const y = OY + (car.r + (car.nr - car.r) * car.t) * TILE + TILE / 2;
      const horiz = car.nc !== car.c;
      ctx.fillStyle = COLORS.car;
      if (horiz) roundRect(ctx, x - 11, y - 6, 22, 12, 3);
      else roundRect(ctx, x - 6, y - 11, 12, 22, 3);
      ctx.fill();
      ctx.fillStyle = '#1f2937';
      if (horiz) ctx.fillRect(x - 4, y - 4, 8, 8);
      else ctx.fillRect(x - 4, y - 4, 8, 8);
    }
  }

  function drawHover(run, mouse) {
    if (!mouse) return;
    const c = Math.floor((mouse.x - OX) / TILE), r = Math.floor((mouse.y - OY) / TILE);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    const x = OX + c * TILE, y = OY + r * TILE;
    const tool = TOOLS[run.selected];
    const occupied = run.grid[r][c] !== 0;
    const ok = tool === -1 ? occupied : (!occupied && run.money >= BUILDINGS[tool].cost);
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.9)' : 'rgba(248,113,113,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
  }

  function drawHud(run) {
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.hud;
    roundRect(ctx, 16, 10, 620, 40, 10); ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = '#4ade80'; ctx.fillText(`${t('money')}: $${Math.floor(run.money)}`, 30, 30);
    ctx.fillStyle = '#7dd3fc'; ctx.fillText(`${t('pop')}: ${run.pop}`, 200, 30);
    ctx.fillStyle = '#fbbf24'; ctx.fillText(`${t('income')}: $${run.income.toFixed(1)}${t('perSec')}`, 330, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(`${t('built')}: ${run.built}`, 540, 30);
  }

  function drawToolbar(run) {
    const n = TOOLS.length, sw = 92, gap = 8, total = n * sw + (n - 1) * gap;
    let x = (WORLD.WIDTH - total) / 2;
    const y = WORLD.HEIGHT - 78;
    for (let i = 0; i < n; i++) {
      const id = TOOLS[i];
      const sel = i === run.selected;
      ctx.fillStyle = sel ? 'rgba(251,191,36,0.22)' : COLORS.hud;
      roundRect(ctx, x, y, sw, 66, 8); ctx.fill();
      ctx.strokeStyle = sel ? COLORS.select : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = sel ? 3 : 1.5;
      roundRect(ctx, x, y, sw, 66, 8); ctx.stroke();
      // 图标
      if (id === -1) {
        ctx.strokeStyle = '#f87171'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x + 36, y + 12); ctx.lineTo(x + 56, y + 32); ctx.moveTo(x + 56, y + 12); ctx.lineTo(x + 36, y + 32); ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(x + sw / 2 - TILE / 2, y + 6);
        ctx.scale(0.8, 0.8);
        drawBuilding(id, 0, 0);
        ctx.restore();
      }
      ctx.textAlign = 'center';
      ctx.font = `bold 11px ${FONT}`; ctx.fillStyle = '#fff';
      ctx.fillText(t(TOOL_KEY[id]), x + sw / 2, y + 48);
      ctx.font = `bold 10px ${FONT}`; ctx.fillStyle = id === -1 ? 'rgba(255,255,255,0.5)' : '#4ade80';
      ctx.fillText(id === -1 ? '—' : `$${BUILDINGS[id].cost}`, x + sw / 2, y + 60);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `bold 9px ${FONT}`;
      ctx.textAlign = 'left'; ctx.fillText(String(i + 1), x + 5, y + 10);
      x += sw + gap;
    }
  }

  function render({ run, mouse }) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    if (!run) return;
    drawGrid(run);
    drawCars(run);
    drawHover(run, mouse);
    drawHud(run);
    drawToolbar(run);
  }

  return { render, update, clearEffects };
}