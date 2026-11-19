// Canvas 2D 渲染：霓虹街机坦克大战。全部程序化绘制，零素材。
import { WORLD, BOARD, GAME } from '../../config/game.config.js';

const C = {
  bg: '#0a0a14',
  grid: '#17172a',
  brick: '#b96f3a',
  brickDark: '#7c4624',
  rock: '#8a7a68',
  rockDark: '#5a4c3e',
  steel: '#7d8796',
  steelDark: '#3f4652',
  steelLight: '#aeb9c7',
  grass: '#2f9e44',
  water: '#1d6fd0',
  waterLight: '#4aa3ff',
  base: '#ffd166',
  baseGlow: 'rgba(255,209,102,0.5)',
  player: '#22d3ee',
  playerGlow: 'rgba(34,211,238,0.55)',
  shield: '#67e8f9',
  bullet: '#fef08a',
};

const ENEMY_COLOR = {
  grunt: '#f43f5e',
  scout: '#facc15',
  gunner: '#a78bfa',
  tank: '#ef4444',
};

const DIR_ANGLE = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function glowRect(x, y, w, h, color, glow) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function drawTile(c, r, cell, time) {
    const x = BOARD.OX + c * BOARD.TILE;
    const y = BOARD.OY + r * BOARD.TILE;
    const s = BOARD.TILE;
    if (cell.t === 'brick') {
      ctx.fillStyle = C.brick;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = C.brickDark;
      ctx.fillRect(x, y, s, 2);
      ctx.fillRect(x, y, 2, s);
      ctx.fillRect(x, y + s - 2, s, 2);
      ctx.fillRect(x + s - 2, y, 2, s);
      ctx.fillRect(x + s / 2, y, 2, s);
      ctx.fillRect(x, y + s / 2, s, 2);
    } else if (cell.t === 'rock') {
      ctx.fillStyle = C.rock;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = C.rockDark;
      ctx.fillRect(x, y, s, 3);
      ctx.fillRect(x, y, 3, s);
      if (cell.hp <= 1) {
        ctx.strokeStyle = C.rockDark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + s / 2, y + s / 2);
        ctx.lineTo(x + s - 5, y + 5);
        ctx.stroke();
      }
    } else if (cell.t === 'steel') {
      ctx.fillStyle = C.steel;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = C.steelLight;
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
      ctx.fillStyle = C.steelDark;
      ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
    } else if (cell.t === 'water') {
      ctx.fillStyle = C.water;
      ctx.fillRect(x, y, s, s);
      const wave = Math.sin(time * 4 + c + r) * 2;
      ctx.fillStyle = C.waterLight;
      ctx.fillRect(x, y + s / 2 + wave, s, 2);
      ctx.fillRect(x, y + s / 2 + wave - 5, s, 1);
    } else if (cell.t === 'base') {
      const cx = x + s / 2;
      const cy = y + s / 2;
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.fillStyle = C.bg;
      ctx.fillRect(x, y, s, s);
      ctx.save();
      ctx.shadowColor = C.baseGlow;
      ctx.shadowBlur = 14 + pulse * 6;
      ctx.fillStyle = C.base;
      ctx.beginPath();
      for (let i = 0; i < 4; i += 1) {
        const a = -Math.PI / 2 + i * (Math.PI / 2);
        const px = cx + Math.cos(a) * (s / 2 - 3);
        const py = cy + Math.sin(a) * (s / 2 - 3);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawTank(x, y, dir, color, opts = {}) {
    const s = GAME.TANK_SIZE;
    const half = s / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(DIR_ANGLE[dir] || 0);
    // 履带
    ctx.fillStyle = '#1f2430';
    rr(-half, -half, s, 6, 2);
    ctx.fill();
    rr(-half, half - 6, s, 6, 2);
    ctx.fill();
    // 车身
    ctx.save();
    if (opts.glow) {
      ctx.shadowColor = opts.glow;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = color;
    rr(-half + 5, -half + 7, s - 10, s - 14, 4);
    ctx.fill();
    ctx.strokeStyle = '#05050c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    // 炮管（指向 dir = 本地上方）
    ctx.fillStyle = '#e5e7eb';
    rr(-3, -half - 7, 6, 10, 2);
    ctx.fill();
    // 炮塔
    ctx.fillStyle = opts.cap || '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPowerup(pu, time) {
    const s = 18;
    const bob = Math.sin(time * 5 + pu.x) * 2;
    const x = pu.x - s / 2;
    const y = pu.y - s / 2 + bob;
    ctx.save();
    ctx.shadowColor = C.bullet;
    ctx.shadowBlur = 10;
    ctx.fillStyle = C.bullet;
    rr(x, y, s, s, 4);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = { rapid: '>>', shield: 'S', freeze: '*', life: '+' }[pu.type] || '?';
    ctx.fillText(glyph, pu.x, pu.y + bob);
  }

  function draw(state, dt, view) {
    const time = (state && state.time) || 0;
    ctx.save();
    if (view.shake > 0) {
      ctx.translate((Math.random() - 0.5) * view.shake * 2, (Math.random() - 0.5) * view.shake * 2);
    }

    // 背景 + 网格
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let c = 0; c <= BOARD.COLS; c += 1) {
      const x = BOARD.OX + c * BOARD.TILE;
      ctx.beginPath(); ctx.moveTo(x, BOARD.OY); ctx.lineTo(x, BOARD.OY + BOARD.ROWS * BOARD.TILE); ctx.stroke();
    }
    for (let r = 0; r <= BOARD.ROWS; r += 1) {
      const y = BOARD.OY + r * BOARD.TILE;
      ctx.beginPath(); ctx.moveTo(BOARD.OX, y); ctx.lineTo(BOARD.OX + BOARD.COLS * BOARD.TILE, y); ctx.stroke();
    }

    if (!state) {
      // 标题屏：画一个装饰性对战预览（玩家/敌军/核心），避免灰屏，也供 poster 截图。
      const baseX = BOARD.OX + 13 * BOARD.TILE;
      const baseY = BOARD.OY + 25 * BOARD.TILE;
      for (let r = 24; r <= 25; r += 1) {
        for (let c = 12; c <= 13; c += 1) drawTile(c, r, { t: 'base', hp: 1 }, time);
      }
      // 砖墙小景
      drawTile(3, 5, { t: 'brick', hp: 1 }, time);
      drawTile(4, 5, { t: 'brick', hp: 1 }, time);
      drawTile(21, 5, { t: 'brick', hp: 1 }, time);
      drawTile(22, 5, { t: 'brick', hp: 1 }, time);
      drawTile(3, 18, { t: 'brick', hp: 1 }, time);
      drawTile(4, 18, { t: 'brick', hp: 1 }, time);
      drawTile(21, 18, { t: 'brick', hp: 1 }, time);
      drawTile(22, 18, { t: 'brick', hp: 1 }, time);
      drawTank(BOARD.OX + 6.5 * BOARD.TILE, BOARD.OY + 21 * BOARD.TILE, 'up', C.player, { glow: C.playerGlow, cap: '#f0fdff' });
      drawTank(BOARD.OX + 6.5 * BOARD.TILE, BOARD.OY + 2 * BOARD.TILE, 'down', ENEMY_COLOR.grunt, { glow: 'rgba(244,63,94,0.4)' });
      drawTank(BOARD.OX + 12.5 * BOARD.TILE, BOARD.OY + 2 * BOARD.TILE, 'down', ENEMY_COLOR.gunner, { glow: 'rgba(167,139,250,0.4)' });
      drawTank(BOARD.OX + 18.5 * BOARD.TILE, BOARD.OY + 2 * BOARD.TILE, 'down', ENEMY_COLOR.scout, { glow: 'rgba(250,204,21,0.4)' });
      ctx.restore();
      return;
    }

    // 地面（非草丛）
    for (let r = 0; r < BOARD.ROWS; r += 1) {
      for (let c = 0; c < BOARD.COLS; c += 1) {
        const cell = state.grid[r][c];
        if (cell.t !== 'grass' && cell.t !== 'empty') drawTile(c, r, cell, time);
      }
    }

    // 玩家坦克（最亮，保证剪影）
    if (state.player.alive) {
      const blink = state.player.invuln > 0 && Math.floor(time * 12) % 2 === 0;
      if (!blink) drawTank(state.player.x, state.player.y, state.player.dir, C.player, { glow: C.playerGlow, cap: '#f0fdff' });
      if (state.player.shieldT > 0) {
        ctx.save();
        ctx.strokeStyle = C.shield;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(state.player.x, state.player.y, GAME.TANK_SIZE / 2 + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 敌军
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const blink = e.invuln > 0 && Math.floor(time * 12) % 2 === 0;
      if (blink) continue;
      drawTank(e.x, e.y, e.dir, ENEMY_COLOR[e.type] || C.player, { glow: 'rgba(244,63,94,0.4)' });
    }

    // 草丛（盖住坦克 = 藏身）
    for (let r = 0; r < BOARD.ROWS; r += 1) {
      for (let c = 0; c < BOARD.COLS; c += 1) {
        if (state.grid[r][c].t === 'grass') {
          const x = BOARD.OX + c * BOARD.TILE;
          const y = BOARD.OY + r * BOARD.TILE;
          ctx.fillStyle = C.grass;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(x, y, BOARD.TILE, BOARD.TILE);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#1c7a33';
          ctx.fillRect(x + 3, y + 4, 3, 3);
          ctx.fillRect(x + 11, y + 11, 3, 3);
          ctx.fillRect(x + 7, y + 17, 3, 3);
        }
      }
    }

    // 子弹
    for (const b of state.bullets) {
      glowRect(b.x - 3, b.y - 3, 6, 6, C.bullet, 'rgba(254,240,138,0.8)');
    }

    // 道具
    for (const pu of state.powerups) drawPowerup(pu, time);

    // 冻结 tint
    if (state.freeze > 0) {
      ctx.fillStyle = 'rgba(103,232,249,0.12)';
      ctx.fillRect(BOARD.OX, BOARD.OY, BOARD.COLS * BOARD.TILE, BOARD.ROWS * BOARD.TILE);
    }

    // FX（爆炸/闪光）
    if (view.fx) {
      for (const fx of view.fx) {
        const k = 1 - fx.ttl / fx.max;
        if (fx.type === 'explode') {
          ctx.save();
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, 6 + k * 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, 3 + k * 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (fx.type === 'flash') {
          ctx.save();
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = C.bullet;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }

  return {
    draw,
    debugLayout() {
      return {
        board: { x: BOARD.OX, y: BOARD.OY, w: BOARD.COLS * BOARD.TILE, h: BOARD.ROWS * BOARD.TILE },
        base: { x: BOARD.OX + 12 * BOARD.TILE, y: BOARD.OY + 24 * BOARD.TILE, w: BOARD.TILE * 2, h: BOARD.TILE * 2 },
        cell: BOARD.TILE,
      };
    },
  };
}
