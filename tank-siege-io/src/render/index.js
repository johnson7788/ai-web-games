// tank-siege-io · Canvas 2D 渲染（霓虹街机，全程序化，DPR≤2）
import { WORLD, GAME } from '../../config/game.config.js';
import { TILE, DX, DY } from '../game/sim.js';

const COLS = GAME.COLS;
const ROWS = GAME.ROWS;
const TILE_PX = 44;
const BOARD = TILE_PX * COLS;
const ORIGIN = { x: Math.round((WORLD.WIDTH - BOARD) / 2), y: 96 };

const COLORS = {
  bg: '#08070f',
  grid: 'rgba(120,120,200,0.06)',
  boardBorder: '#22e0ff',
  brick: '#ff8a2a',
  rock: '#b06bff',
  steel: '#cfe0ff',
  grass: '#16341f',
  player: '#3cffd0',
  playerGlow: 'rgba(60,255,208,0.55)',
  enemy: '#ff4d6d',
  enemyGlow: 'rgba(255,77,109,0.5)',
  armor: '#ffb02a',
  bullet: '#fff6c8',
  core: '#3cffd0',
  coreGlow: 'rgba(60,255,208,0.7)',
};

const TILE_COLOR = { [TILE.BRICK]: COLORS.brick, [TILE.ROCK]: COLORS.rock, [TILE.STEEL]: COLORS.steel, [TILE.GRASS]: COLORS.grass };

const TANK_COLOR = { player: COLORS.player, normal: '#ff5470', speed: '#ff8ad4', armor: '#ffc14d' };

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
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  const smooth = new Map(); // tank id -> {x,y} 平滑插值

  function tileToPx(c, r) {
    return { x: ORIGIN.x + c * TILE_PX, y: ORIGIN.y + r * TILE_PX };
  }

  function tankCenter(t) {
    let s = smooth.get(t.id);
    if (!s) { s = { x: t.c + 0.5, y: t.r + 0.5 }; smooth.set(t.id, s); }
    s.x += (t.c + 0.5 - s.x) * 0.4;
    s.y += (t.r + 0.5 - s.y) * 0.4;
    return tileToPx(s.x, s.y);
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 装饰网格
    ctx.fillStyle = COLORS.grid;
    for (let x = 0; x < WORLD.WIDTH; x += 44) {
      for (let y = 0; y < WORLD.HEIGHT; y += 44) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function drawTile(c, r, t) {
    const { x, y } = tileToPx(c, r);
    if (t === TILE.EMPTY) {
      ctx.fillStyle = 'rgba(20,22,40,0.5)';
      ctx.fillRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 2);
      return;
    }
    if (t === TILE.GRASS) {
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 2);
      return;
    }
    const color = TILE_COLOR[t];
    ctx.fillStyle = '#1a1c30';
    ctx.fillRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (t === TILE.BRICK) {
      // 砖纹
      ctx.strokeRect(x + 3, y + 3, TILE_PX - 6, TILE_PX - 6);
      ctx.beginPath();
      ctx.moveTo(x + 3, y + TILE_PX / 2);
      ctx.lineTo(x + TILE_PX - 3, y + TILE_PX / 2);
      ctx.moveTo(x + TILE_PX / 2, y + 3);
      ctx.lineTo(x + TILE_PX / 2, y + TILE_PX / 2);
      ctx.moveTo(x + TILE_PX / 4, y + TILE_PX / 2);
      ctx.lineTo(x + TILE_PX / 4, y + TILE_PX - 3);
      ctx.moveTo(x + (3 * TILE_PX) / 4, y + TILE_PX / 2);
      ctx.lineTo(x + (3 * TILE_PX) / 4, y + TILE_PX - 3);
      ctx.stroke();
    } else if (t === TILE.ROCK) {
      ctx.beginPath();
      ctx.arc(x + TILE_PX / 2, y + TILE_PX / 2, TILE_PX / 2 - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + TILE_PX / 2 - 5, y + TILE_PX / 2 - 3, 3, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(x + 4, y + 4, TILE_PX - 8, TILE_PX - 8);
    }
  }

  function drawBoard(state) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        drawTile(c, r, state.grid[r][c]);
      }
    }
    ctx.strokeStyle = COLORS.boardBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(ORIGIN.x, ORIGIN.y, BOARD, BOARD);
  }

  function drawCore(state) {
    const { x, y } = tileToPx(state.core.c, state.core.r);
    const cx = x + TILE_PX / 2;
    const cy = y + TILE_PX / 2;
    const pulse = state.core.alive ? 1 + Math.sin(state.time * 6) * 0.1 : 0.6;
    ctx.save();
    ctx.shadowColor = COLORS.coreGlow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = COLORS.core;
    ctx.beginPath();
    ctx.arc(cx, cy, (TILE_PX / 2 - 6) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    // 核心血条
    const hp = Math.max(0, state.core.hp / state.core.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x + 4, y + TILE_PX - 7, TILE_PX - 8, 4);
    ctx.fillStyle = hp > 0.4 ? COLORS.core : '#ff4d6d';
    ctx.fillRect(x + 4, y + TILE_PX - 7, (TILE_PX - 8) * hp, 4);
  }

  function drawTank(t) {
    const p = tankCenter(t);
    const size = TILE_PX * 0.8;
    const color = TANK_COLOR[t.type] || COLORS.enemy;
    const glow = t.team === 0 ? COLORS.playerGlow : COLORS.enemyGlow;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = glow;
    ctx.shadowBlur = t.team === 0 ? 14 : 9;
    // 车体
    ctx.fillStyle = color;
    roundRect(ctx, -size / 2, -size / 2, size, size, 4);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#05060d';
    ctx.lineWidth = 2;
    roundRect(ctx, p.x - size / 2, p.y - size / 2, size, size, 4);
    ctx.stroke();
    // 炮管
    const dir = DX[t.dir] * 14;
    const dyr = DY[t.dir] * 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + dir, p.y + dyr);
    ctx.stroke();
    // 炮塔圆点
    ctx.fillStyle = '#0c0e1a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    // 护盾光环
    if (t.shieldUntil > 0) {
      ctx.strokeStyle = 'rgba(120,200,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size / 2 + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 敌人血量条
    if (t.team === 1 && t.maxHp > 1 && t.hp < t.maxHp) {
      const w = size;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(p.x - w / 2, p.y - size / 2 - 6, w, 3);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(p.x - w / 2, p.y - size / 2 - 6, w * (t.hp / t.maxHp), 3);
    }
  }

  function drawBullets(state) {
    for (const b of state.bullets) {
      const p = tileToPx(b.x, b.y);
      ctx.save();
      ctx.shadowColor = COLORS.bullet;
      ctx.shadowBlur = 8;
      ctx.fillStyle = COLORS.bullet;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPowerups(state) {
    const PU = { speed: '#3cffd0', rapid: '#ffd23c', shield: '#7fd0ff', repair: '#6dff8a', triple: '#ff8ad4' };
    for (const p of state.powerups) {
      const { x, y } = tileToPx(p.c, p.r);
      const cx = x + TILE_PX / 2;
      const cy = y + TILE_PX / 2;
      const color = PU[p.kind] || '#fff';
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx + 9, cy);
      ctx.lineTo(cx, cy + 10);
      ctx.lineTo(cx - 9, cy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#05060d';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.kind[0].toUpperCase(), cx, cy);
    }
  }

  function drawFx(view) {
    for (const fx of view.fx) {
      const a = Math.max(0, fx.ttl / fx.maxTtl);
      const { x, y } = tileToPx(fx.c + 0.5, fx.r + 0.5);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = fx.color || '#ffd23c';
      const r = (1 - a) * 18 + 3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function draw(state, dt, view = {}) {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    const shake = view.shake || 0;
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawBackground();
    if (state) {
      drawBoard(state);
      drawCore(state);
      for (const t of state.tanks) if (t.alive && t.team !== 0) drawTank(t);
      if (state.player && state.player.alive) drawTank(state.player);
      drawPowerups(state);
      drawBullets(state);
      drawFx(view);
    }
    ctx.restore();
  }

  return { draw, debugLayout: () => ({ board: { x: ORIGIN.x, y: ORIGIN.y, w: BOARD, h: BOARD }, tile: TILE_PX }) };
}
