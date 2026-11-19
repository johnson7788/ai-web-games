// Canvas 2D 渲染：霓虹街机塔。程序化绘制（无素材文件），高对比、英雄最亮。
import { WORLD } from '../../config/game.config.js';
import { MONSTERS, PROPS, DOORS } from '../../config/maps.js';

const COLS = 11;
const ROWS = 11;
const CELL = 56;
const BOARD = CELL * COLS;       // 616
const BOARD_X = (WORLD.WIDTH - BOARD) / 2;
const BOARD_Y = 76;

const COL = {
  bg: '#0a0a14',
  floor: '#14141f',
  grid: '#1d1d2b',
  wall: '#202033',
  wallEdge: '#3b3b58',
  text: '#cfd6ff',
  dim: '#6b7194',
};

const TILE_COLOR = {
  y: '#ffd23e', b: '#4d9fff', r: '#ff5a7a',
  a: '#ff7a3e', d: '#4d9fff',
  q: '#ff6b8a', Q: '#7ad0ff',
  s: '#cfd8ff', S: '#e6ecff', G: '#ffd23e',
  t: '#9fe0b0', T: '#c9f2d7', F: '#ffd23e',
  k: '#ffb84d', C: '#b18cff', '!': '#7affd0',
  x: '#ff3b3b', '$': '#ffd23e', N: '#9fe0b0',
  '^': '#7affd0', v: '#ffb84d',
  Y: '#ffd23e', B: '#4d9fff', R: '#ff5a7a',
};

const MONSTER_COLOR = {
  '1': '#7dff9e', '2': '#c58cff', '3': '#a9b4c9', '4': '#e8ecf4', '5': '#6fd3ff',
  '6': '#ff9f6a', '7': '#8aa7ff', '8': '#4dd7ff', '9': '#ff8f6a', 'V': '#ff6bcf', 'L': '#7dff9e', '@': '#ff4d5e',
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

function glow(ctx, color, blur = 12) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let heroDraw = { x: 1, y: 1 };
  let initialized = false;

  function cellToPx(x, y) {
    return { x: BOARD_X + x * CELL + CELL / 2, y: BOARD_Y + y * CELL + CELL / 2 };
  }

  function drawTileIcon(cx, cy, char) {
    const c = TILE_COLOR[char] || '#fff';
    const half = CELL / 2 - 8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    if (char === 'a' || char === 'd') {
      ctx.beginPath();
      ctx.moveTo(0, -half * 0.8);
      ctx.lineTo(half * 0.8, 0);
      ctx.lineTo(0, half * 0.8);
      ctx.lineTo(-half * 0.8, 0);
      ctx.closePath();
      ctx.fill();
    } else if (char === 'q' || char === 'Q') {
      const s = char === 'Q' ? 1 : 0.7;
      roundRect(ctx, -half * 0.5 * s, -half * s, half * s, half * 1.6 * s, 3);
      ctx.fill();
      roundRect(ctx, -half * 0.15 * s, -half * 1.1 * s, half * 0.3 * s, half * 0.4 * s, 2);
      ctx.fill();
    } else if (char === 's' || char === 'S' || char === 'G') {
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(0, half * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-half * 0.6, -half * 0.2);
      ctx.lineTo(half * 0.6, -half * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, half * 0.5);
      ctx.lineTo(half * 0.4, half * 0.9);
      ctx.stroke();
    } else if (char === 't' || char === 'T' || char === 'F') {
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(half * 0.7, -half * 0.4);
      ctx.lineTo(half * 0.7, half * 0.2);
      ctx.lineTo(0, half);
      ctx.lineTo(-half * 0.7, half * 0.2);
      ctx.lineTo(-half * 0.7, -half * 0.4);
      ctx.closePath();
      ctx.fill();
    } else if (char === 'k') {
      ctx.beginPath();
      ctx.moveTo(-half * 0.5, half);
      ctx.lineTo(half * 0.5, -half);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(half * 0.5, -half, half * 0.5, 0.4, Math.PI + 0.8);
      ctx.stroke();
    } else if (char === 'C') {
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(half, 0);
      ctx.lineTo(0, half);
      ctx.lineTo(-half, 0);
      ctx.closePath();
      ctx.fill();
    } else if (char === '!') {
      ctx.beginPath(); ctx.arc(0, 0, half * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, half * 0.35, 0, Math.PI * 2); ctx.stroke();
    } else if (char === 'x') {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * half * 0.4, half * 0.9);
        ctx.lineTo(i * half * 0.4 + half * 0.4, -half * 0.4);
        ctx.lineTo(i * half * 0.4 + half * 0.8, half * 0.9);
        ctx.closePath();
        ctx.fill();
      }
    } else if (char === '$') {
      ctx.font = `bold ${Math.round(CELL * 0.5)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 2);
    } else if (char === 'N') {
      ctx.beginPath(); ctx.arc(0, -half * 0.4, half * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, half * 0.2, half * 0.55, Math.PI, 0); ctx.fill();
    } else if (char === '^' || char === 'v') {
      ctx.beginPath();
      if (char === '^') { ctx.moveTo(0, -half * 0.7); ctx.lineTo(half * 0.8, half * 0.4); ctx.lineTo(-half * 0.8, half * 0.4); }
      else { ctx.moveTo(0, half * 0.7); ctx.lineTo(half * 0.8, -half * 0.4); ctx.lineTo(-half * 0.8, -half * 0.4); }
      ctx.closePath();
      ctx.fill();
    } else if (char === 'Y' || char === 'B' || char === 'R') {
      // 门：竖条 + 锁孔
      ctx.fillRect(-half * 0.55, -half * 0.9, half * 1.1, half * 1.8);
      ctx.fillStyle = '#0a0a14';
      ctx.beginPath(); ctx.arc(half * 0.25, 0, half * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c;
      ctx.fillRect(half * 0.18, 0, half * 0.14, half * 0.5);
    } else {
      // 钥匙：环 + 杆 + 齿
      ctx.beginPath(); ctx.arc(0, -half * 0.45, half * 0.32, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -half * 0.15); ctx.lineTo(0, half * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, half * 0.4); ctx.lineTo(half * 0.35, half * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, half * 0.6); ctx.lineTo(-half * 0.35, half * 0.7); ctx.stroke();
    }
    ctx.restore();
  }

  function drawMonster(cx, cy, char) {
    const m = MONSTERS[char];
    const c = MONSTER_COLOR[char] || '#fff';
    const big = char === '@';
    const r = (big ? 0.36 : 0.27) * CELL;
    ctx.save();
    ctx.translate(cx, cy);
    // HP 条（顶部）
    ctx.fillStyle = 'rgba(8,8,14,0.9)';
    ctx.fillRect(-r, -r - 7, r * 2, 3);
    ctx.fillStyle = '#7dff9e';
    ctx.fillRect(-r, -r - 7, r * 2, 3);
    // 身体
    glow(ctx, c, big ? 18 : 8);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(0, -1, r, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    // 眼睛
    ctx.fillStyle = '#0a0a14';
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.28, r * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.28, r * 0.15, 0, Math.PI * 2); ctx.fill();
    // 首领王冠
    if (big) {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.8); ctx.lineTo(r * 0.5, -r * 0.8); ctx.lineTo(0, -r * 1.4); ctx.closePath(); ctx.fill();
    }
    // 攻防标签（底部，带深色衬底，避免与图标重叠；首领附 BOSS 字样）
    const label = big ? `BOSS A${m.atk} D${m.def}` : `A${m.atk} D${m.def}`;
    ctx.font = 'bold 10px monospace';
    const w = ctx.measureText(label).width + 8;
    const ly = r + 7;
    ctx.fillStyle = 'rgba(8,8,14,0.92)';
    roundRect(ctx, -w / 2, ly - 7, w, 14, 3);
    ctx.fill();
    ctx.fillStyle = big ? '#ff4d5e' : '#f5f7ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, ly);
    ctx.restore();
  }

  function drawStair(cx, cy, dir) {
    const c = dir === 'up' ? '#7affd0' : '#ffb84d';
    ctx.save();
    ctx.translate(cx, cy);
    const half = CELL / 2 - 6;
    if (dir === 'up') {
      // 目标信标：脉冲环 + 箭头 + GOAL 标签
      glow(ctx, '#7affd0', 16);
      ctx.strokeStyle = 'rgba(122,255,208,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -2, half * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#7affd0';
      ctx.beginPath(); ctx.moveTo(0, -half * 0.55); ctx.lineTo(half * 0.55, half * 0.15); ctx.lineTo(-half * 0.55, half * 0.15); ctx.closePath(); ctx.fill();
      noGlow(ctx);
      ctx.fillStyle = '#7affd0';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('GOAL', 0, half * 0.3);
    } else {
      glow(ctx, '#ffb84d', 10);
      ctx.fillStyle = '#ffb84d';
      ctx.beginPath(); ctx.moveTo(0, half * 0.55); ctx.lineTo(half * 0.55, -half * 0.15); ctx.lineTo(-half * 0.55, -half * 0.15); ctx.closePath(); ctx.fill();
      noGlow(ctx);
    }
    ctx.restore();
  }

  function drawHero(cx, cy) {
    const r = 0.36 * CELL;
    ctx.save();
    ctx.translate(cx, cy);
    glow(ctx, '#4df3ff', 22);
    ctx.fillStyle = '#eaffff';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = '#0a0a14';
    ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.28, -r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw(state) {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 背景
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    grad.addColorStop(0, '#0e0e1c');
    grad.addColorStop(1, '#08080f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    if (!state || !state.floors) return;

    const floor = state.floors[state.floor - 1];
    if (!floor) return;

    // 底板
    ctx.fillStyle = '#10101c';
    ctx.fillRect(BOARD_X - 6, BOARD_Y - 6, BOARD + 12, BOARD + 12);
    ctx.strokeStyle = '#2f2f52';
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X - 6, BOARD_Y - 6, BOARD + 12, BOARD + 12);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = floor.grid[y][x];
        const px = BOARD_X + x * CELL;
        const py = BOARD_Y + y * CELL;
        if (t.kind === 'wall') {
          ctx.fillStyle = COL.wall;
          ctx.fillRect(px, py, CELL, CELL);
          ctx.strokeStyle = COL.wallEdge;
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
        } else {
          ctx.fillStyle = COL.floor;
          ctx.fillRect(px, py, CELL, CELL);
          ctx.strokeStyle = COL.grid;
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
        }
      }
    }

    // 道具 / 门 / 商店 / NPC / 楼梯 / 水晶 / 尖刺
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = floor.grid[y][x];
        if (t.kind === 'prop') {
          const c = TILE_COLOR[t.char] || '#fff';
          const p = cellToPx(x, y);
          glow(ctx, c, 10);
          drawTileIcon(p.x, p.y, t.char);
          noGlow(ctx);
        } else if (t.kind === 'door') {
          const c = TILE_COLOR[t.id === 'yellow' ? 'Y' : t.id === 'blue' ? 'B' : 'R'] || '#fff';
          const p = cellToPx(x, y);
          glow(ctx, c, 8);
          drawTileIcon(p.x, p.y, t.id === 'yellow' ? 'Y' : t.id === 'blue' ? 'B' : 'R');
          noGlow(ctx);
        } else if (t.kind === 'stair') {
          const p = cellToPx(x, y);
          drawStair(p.x, p.y, t.dir);
        } else if (t.kind === 'shop' || t.kind === 'npc' || t.kind === 'crystal') {
          const p = cellToPx(x, y);
          const ch = t.kind === 'shop' ? '$' : t.kind === 'npc' ? 'N' : 'C';
          const c = TILE_COLOR[ch] || '#fff';
          glow(ctx, c, 8);
          drawTileIcon(p.x, p.y, ch);
          noGlow(ctx);
        } else if (t.kind === 'spike' && !t.used) {
          const p = cellToPx(x, y);
          glow(ctx, '#ff3b3b', 8);
          drawTileIcon(p.x, p.y, 'x');
          noGlow(ctx);
        }
      }
    }

    // 怪物
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = floor.grid[y][x];
        if (t.kind === 'monster') {
          const p = cellToPx(x, y);
          drawMonster(p.x, p.y, t.char);
        }
      }
    }

    // 英雄（平滑插值）
    const target = { x: state.pos.x, y: state.pos.y };
    if (!initialized) { heroDraw = { ...target }; initialized = true; }
    const dx = target.x - heroDraw.x;
    const dy = target.y - heroDraw.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1.5) { heroDraw = { ...target }; }
    else {
      const step = Math.min(1, dist * 0.35);
      heroDraw.x += dx * step;
      heroDraw.y += dy * step;
    }
    const hp = cellToPx(heroDraw.x, heroDraw.y);
    drawHero(hp.x, hp.y);
  }

  function debugLayout() {
    return {
      grid: { x: BOARD_X, y: BOARD_Y, w: BOARD, h: BOARD },
      cell: CELL,
      board: { x: BOARD_X, y: BOARD_Y, w: BOARD, h: BOARD },
    };
  }

  return { draw, debugLayout };
}
