// Canvas 2D 渲染：2D 方块世界 + 昼夜 + 玩家 + 挖掘裂纹 + 快捷栏。
import { WORLD, TILE, COLS, ROWS, BLOCKS, HOTBAR, PLAYER, COLORS } from '../../config/game.config.js';
import { t } from '../core/i18n.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const BLOCK_KEY = { 2: 'dirt', 3: 'stone', 4: 'wood', 5: 'leaves', 6: 'coal', 7: 'sand' };

function lerp(a, b, k) { return a + (b - a) * k; }
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  return `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function clearEffects() {}
  function update() {}

  function drawSky(run) {
    const tod = run.timeOfDay !== undefined ? run.timeOfDay : ((run.time % 60) / 60);
    // 0=晨 0.25=午 0.5=昏 0.75=夜
    const night = Math.max(0, Math.sin((tod - 0.25) * Math.PI * 2)) ; // 简化
    const darkness = tod > 0.5 ? Math.min(1, (tod - 0.5) * 4) : (tod < 0.05 ? (0.05 - tod) * 8 : 0);
    const top = mix(COLORS.skyDay, COLORS.skyNight, Math.min(1, darkness));
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 太阳 / 月亮
    const ang = tod * Math.PI * 2 - Math.PI / 2;
    const sx = WORLD.WIDTH / 2 + Math.cos(ang) * 500;
    const sy = 360 + Math.sin(ang) * 300;
    ctx.fillStyle = darkness > 0.5 ? COLORS.moon : COLORS.sun;
    ctx.beginPath(); ctx.arc(sx, sy, 30, 0, Math.PI * 2); ctx.fill();
  }

  function drawBlocks(run) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = run.grid[r][c];
        if (id === 0) continue;
        const b = BLOCKS[id];
        const x = c * TILE, y = r * TILE;
        ctx.fillStyle = b.color;
        ctx.fillRect(x, y, TILE, TILE);
        if (id === 1) { ctx.fillStyle = b.top; ctx.fillRect(x, y, TILE, 7); }
        if (id === 6) { ctx.fillStyle = '#1f242b'; ctx.fillRect(x + 6, y + 6, 7, 7); ctx.fillRect(x + 18, y + 16, 8, 8); ctx.fillRect(x + 8, y + 20, 6, 6); }
        if (id === 4) { ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 10, y + TILE); ctx.moveTo(x + 22, y); ctx.lineTo(x + 22, y + TILE); ctx.stroke(); }
        if (id === 5) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + 4, y + 4, 6, 6); ctx.fillRect(x + 20, y + 14, 6, 6); }
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  function drawPlayer(run) {
    const p = run.player;
    const x = p.x, y = p.y;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, PLAYER.W * 0.6, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.playerDark;
    ctx.fillRect(x - 9, y - 14, 8, 14);
    ctx.fillRect(x + 1, y - 14, 8, 14);
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(x - PLAYER.W / 2, y - PLAYER.H + 12, PLAYER.W, PLAYER.H - 26);
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(x, y - PLAYER.H + 6, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(x + p.facing * 4, y - PLAYER.H + 5, 2, 0, Math.PI * 2); ctx.fill();
  }

  function drawTarget(run, mouse) {
    if (!mouse) return;
    const c = Math.floor(mouse.x / TILE), r = Math.floor(mouse.y / TILE);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    const x = c * TILE, y = r * TILE;
    const id = run.grid[r][c];
    ctx.strokeStyle = id === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(251,191,36,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    if (run.mining && run.mining.c === c && run.mining.r === r && id !== 0) {
      const frac = Math.min(1, run.mining.t / BLOCKS[id].hard);
      ctx.strokeStyle = `rgba(0,0,0,${0.3 + frac * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + TILE * frac, y + TILE * frac);
      ctx.moveTo(x + TILE - 6, y + 8); ctx.lineTo(x + TILE - TILE * frac, y + TILE - 6);
      ctx.moveTo(x + 8, y + TILE - 6); ctx.lineTo(x + TILE * frac, y + 8);
      ctx.stroke();
    }
  }

  function drawHud(run) {
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(12, 12, 250, 40);
    ctx.textAlign = 'left';
    ctx.font = `bold 14px ${FONT}`; ctx.fillStyle = '#fff';
    ctx.fillText(`${t('day')} ${Math.floor(run.time / 60) + 1}`, 24, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText(`${t('mined')}: ${run.mined}`, 100, 32);
    ctx.fillText(`${t('placed')}: ${run.placed}`, 180, 32);
    // 快捷栏
    const n = HOTBAR.length, sw = 64, gap = 8, total = n * sw + (n - 1) * gap;
    let x = (WORLD.WIDTH - total) / 2;
    const y = WORLD.HEIGHT - sw - 14;
    for (let i = 0; i < n; i++) {
      const id = HOTBAR[i];
      const sel = i === run.selected;
      ctx.fillStyle = sel ? 'rgba(251,191,36,0.25)' : 'rgba(8,12,26,0.72)';
      ctx.fillRect(x, y, sw, sw);
      ctx.strokeStyle = sel ? COLORS.select : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = sel ? 3 : 1.5;
      ctx.strokeRect(x, y, sw, sw);
      ctx.fillStyle = BLOCKS[id].color;
      ctx.fillRect(x + 16, y + 12, 32, 32);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(x + 16, y + 12, 32, 32);
      ctx.fillStyle = '#fff'; ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'right';
      ctx.fillText(String(run.inventory[id] || 0), x + sw - 6, y + sw - 10);
      ctx.textAlign = 'center'; ctx.font = `bold 10px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(String(i + 1), x + 8, y + 10);
      x += sw + gap;
    }
  }

  function render({ run, mouse }) {
    if (!run) return;
    drawSky(run);
    drawBlocks(run);
    drawPlayer(run);
    drawTarget(run, mouse);
    drawHud(run);
  }

  return { render, update, clearEffects };
}