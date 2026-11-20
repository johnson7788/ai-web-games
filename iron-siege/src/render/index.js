// src/render/index.js — createRender 装配：纯消费 sim 状态，不持有游戏逻辑。
// 导出 createRender(canvas) → { draw(run, interp), resize() }。
import {
  MAP, CELL, DIR, DIR_VEC, PLAYER, BULLET, ENEMY_TYPES, FURNACE, PROP,
} from '../../config/gameplay.js';
import { SCALE, ORIGIN, BATTLE, worldToScreen, paletteFor } from './theme.js';

const CELL_PX = MAP.BLOCK * SCALE; // 24px

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glowCircle(ctx, x, y, r, color, blur = 12) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = 1280;
  canvas.height = 720;
  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let shake = 0;

  function drawCell(cell, sx, sy, pal, t) {
    const s = CELL_PX;
    if (cell === CELL.BRICK) {
      ctx.fillStyle = pal.brick;
      ctx.fillRect(sx, sy, s, s);
      ctx.strokeStyle = pal.brickLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, s - 1, s - 1);
      ctx.beginPath();
      ctx.moveTo(sx, sy + s / 2); ctx.lineTo(sx + s, sy + s / 2);
      ctx.moveTo(sx + s / 2, sy); ctx.lineTo(sx + s / 2, sy + s / 2);
      ctx.moveTo(sx, sy + s / 2); ctx.lineTo(sx + s / 2, sy + s / 2);
      ctx.stroke();
      ctx.fillStyle = pal.brickRivet;
      ctx.fillRect(sx + s / 2 - 1, sy + s / 2 + 2, 2, 2);
      ctx.fillRect(sx + 2, sy + s - 4, 2, 2);
      ctx.fillRect(sx + s - 4, sy + s - 4, 2, 2);
    } else if (cell === CELL.STEEL) {
      ctx.fillStyle = pal.steel;
      ctx.fillRect(sx, sy, s, s);
      ctx.strokeStyle = pal.steelLine;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx + 1, sy + 1, s - 2, s - 2);
      ctx.fillStyle = pal.steelRivet;
      for (const [dx, dy] of [[3, 3], [s - 4, 3], [3, s - 4], [s - 4, s - 4]]) {
        ctx.beginPath(); ctx.arc(sx + dx, sy + dy, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (cell === CELL.WATER) {
      ctx.fillStyle = pal.water;
      ctx.fillRect(sx, sy, s, s);
      ctx.fillStyle = pal.waterFoam;
      const w = Math.sin(t * 2 + sx * 0.05 + sy * 0.05) * 3;
      ctx.fillRect(sx + 3, sy + s / 2 - 1 + w, s - 6, 2);
    } else if (cell === CELL.GRASS) {
      // 草丛：前半透明（前层再画一次叠加）
      ctx.fillStyle = pal.grass;
      ctx.fillRect(sx, sy, s, s);
    }
  }

  function drawCellTerrain(run, pal, t) {
    for (let r = 0; r < MAP.ROWS; r += 1) {
      for (let c = 0; c < MAP.COLS; c += 1) {
        const cell = run.grid[r][c];
        if (cell === CELL.EMPTY || cell === CELL.FURNACE) continue;
        const p = worldToScreen(c * MAP.BLOCK, r * MAP.BLOCK);
        // p 是左下角；格子左上角 = (p.x, p.y - CELL_PX)
        drawCell(cell, p.x, p.y - CELL_PX, pal, t);
      }
    }
  }

  function drawGrassFront(run, pal) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let r = 0; r < MAP.ROWS; r += 1) {
      for (let c = 0; c < MAP.COLS; c += 1) {
        if (run.grid[r][c] !== CELL.GRASS) continue;
        const p = worldToScreen(c * MAP.BLOCK, r * MAP.BLOCK);
        const x = p.x;
        const y = p.y - CELL_PX;
        ctx.fillStyle = pal.grassDark;
        for (let i = 0; i < 3; i += 1) {
          const gx = x + 5 + ((c * 7 + i * 11 + r * 3) % 14);
          const gy = y + 4 + ((r * 5 + i * 7) % 12);
          ctx.fillRect(gx, gy, 2, 5 + (i % 2) * 3);
        }
      }
    }
    ctx.restore();
  }

  function drawTank(sx, sy, dir, pal, isPlayer, type, spawning, invuln) {
    const size = PLAYER.SIZE * SCALE;
    ctx.save();
    if (spawning) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 80);
    }
    if (invuln && !spawning) {
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.shadowColor = pal.accent;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(sx, sy, size * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 履带（两条，垂直于前进方向）
    const trackW = 7;
    const body = isPlayer ? pal.player : pal.enemy;
    const dark = isPlayer ? pal.playerDark : '#2a1210';
    if (dir === DIR.UP || dir === DIR.DOWN) {
      ctx.fillStyle = dark;
      ctx.fillRect(sx - size / 2, sy - size / 2, trackW, size);
      ctx.fillRect(sx + size / 2 - trackW, sy - size / 2, trackW, size);
    } else {
      ctx.fillStyle = dark;
      ctx.fillRect(sx - size / 2, sy - size / 2, size, trackW);
      ctx.fillRect(sx - size / 2, sy + size / 2 - trackW, size, trackW);
    }

    // 车体
    ctx.fillStyle = body;
    rr(ctx, sx - size * 0.32, sy - size * 0.32, size * 0.64, size * 0.64, 6);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 炮塔
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(sx, sy, size * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 炮管
    ctx.fillStyle = dark;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    const v = DIR_VEC[dir];
    ctx.lineTo(sx + v.x * size * 0.42, sy + v.y * size * 0.42);
    ctx.stroke();

    // 玩家高亮描边（剪影）
    if (isPlayer) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.shadowColor = pal.player;
      ctx.shadowBlur = 12;
      rr(ctx, sx - size * 0.34, sy - size * 0.34, size * 0.68, size * 0.68, 7);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (type === 'armored') {
      ctx.strokeStyle = 'rgba(255,200,160,0.5)';
      ctx.lineWidth = 2;
      rr(ctx, sx - size * 0.34, sy - size * 0.34, size * 0.68, size * 0.68, 7);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBullet(b, pal) {
    const p = worldToScreen(b.x, b.y);
    const heavy = b.heavy;
    const r = heavy ? 6 : 3;
    const color = b.owner === 'player' ? (heavy ? '#ffb34a' : '#dffcff') : '#ff5a4a';
    glowCircle(ctx, p.x, p.y, r, color, heavy ? 14 : 8);
  }

  function drawFurnace(run, pal, t) {
    const cx = FURNACE.X + FURNACE.W / 2;
    const cy = FURNACE.Y + FURNACE.H / 2;
    const p = worldToScreen(cx, cy);
    const size = FURNACE.W * SCALE; // 48px
    // 金属外壳
    ctx.fillStyle = pal.steelLine;
    rr(ctx, p.x - size / 2, p.y - size / 2, size, size, 8);
    ctx.fill();
    ctx.strokeStyle = pal.steelRivet;
    ctx.lineWidth = 2;
    ctx.stroke();
    // 熔炉核心（辉光）
    const pulse = 0.7 + 0.3 * Math.sin(t * 3);
    const hpRatio = run.furnaceHp / run.furnaceMaxHp;
    const coreColor = hpRatio > 0.5 ? '#ff9a2a' : '#ff4a2a';
    glowCircle(ctx, p.x, p.y, size * 0.24 * pulse, coreColor, 18);
    // 四角铆钉
    ctx.fillStyle = pal.steelRivet;
    for (const [dx, dy] of [[-size / 2 + 6, -size / 2 + 6], [size / 2 - 6, -size / 2 + 6], [-size / 2 + 6, size / 2 - 6], [size / 2 - 6, size / 2 - 6]]) {
      ctx.beginPath(); ctx.arc(p.x + dx, p.y + dy, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawProp(pr, pal, t) {
    const p = worldToScreen(pr.x, pr.y);
    const blink = Math.sin(t * 6) > 0;
    if (!blink) return;
    const colors = { star: '#ffe14a', bomb: '#ff5a4a', fence: '#7fd4ff', clock: '#b8ff9a' };
    const color = colors[pr.kind] || '#fff';
    glowCircle(ctx, p.x, p.y, 10, color, 12);
    ctx.fillStyle = '#1a1408';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pr.kind[0].toUpperCase(), p.x, p.y);
  }

  function drawEffects(run, pal, t) {
    // 红色报警脉冲（熔炉受击 signature）
    if (run.time < run.fx.alarmUntil) {
      const a = Math.max(0, (run.fx.alarmUntil - run.time) / 1.2);
      ctx.save();
      ctx.globalAlpha = 0.25 * a;
      ctx.fillStyle = '#ff2020';
      ctx.fillRect(ORIGIN.x, ORIGIN.y, BATTLE.w, BATTLE.h);
      ctx.globalAlpha = 0.5 * a;
      const scanY = ORIGIN.y + ((t * 600) % BATTLE.h);
      ctx.fillStyle = 'rgba(255,40,40,0.5)';
      ctx.fillRect(ORIGIN.x, scanY, BATTLE.w, 8);
      ctx.restore();
    }
    // 重炮破钢：全屏铆钉震颤（signature）
    if (run.time - run.fx.rivetAt < 0.4) {
      const a = Math.max(0, 1 - (run.time - run.fx.rivetAt) / 0.4);
      ctx.save();
      ctx.strokeStyle = `rgba(220,230,240,${0.7 * a})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 18; i += 1) {
        const x = ORIGIN.x + ((i * 73 + 11) % BATTLE.w);
        const y = ORIGIN.y + ((i * 41 + 7) % BATTLE.h);
        ctx.beginPath();
        ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    // 雷达心跳（milestone）：熔炉发出一圈环
    if (run.time - run.fx.radarAt < 0.6) {
      const a = Math.max(0, 1 - (run.time - run.fx.radarAt) / 0.6);
      const cx = FURNACE.X + FURNACE.W / 2;
      const cy = FURNACE.Y + FURNACE.H / 2;
      const p = worldToScreen(cx, cy);
      ctx.save();
      ctx.globalAlpha = 0.4 * a;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20 + (1 - a) * 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBackdrop(pal, t) {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, 1280, 720);
    // 标题屏装饰：右侧齿轮 + 左侧一台机甲剪影（提升 silhouette）
    ctx.save();
    ctx.strokeStyle = pal.accent;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 3; i += 1) {
      const gx = 950 + i * 110;
      const gy = 120 + i * 60;
      ctx.beginPath();
      ctx.arc(gx, gy, 40 - i * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(gx, gy, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    drawTank(230, 360, DIR.UP, pal, true, null, false, false);
  }

  function draw(run, interp) {
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const pal = paletteFor(run ? run.scene : 1);

    if (!run) {
      drawBackdrop(pal, t);
      return;
    }

    // 教程进行中：战场整体压暗 + 中央聚光，保证教程卡与单位零视觉冲突
    const tutActive = typeof window !== 'undefined'
      && window.__ll && window.__ll.tutorial && window.__ll.tutorial.active;

    shake = Math.max(shake, run.fx.shake || 0);
    const shx = shake ? (Math.random() - 0.5) * 2 * shake : 0;
    const shy = shake ? (Math.random() - 0.5) * 2 * shake : 0;
    if (reduceMotion) { shake = 0; }

    ctx.save();
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.translate(shx, shy);

    // 战场底板 + 网格
    ctx.fillStyle = pal.ground;
    ctx.fillRect(ORIGIN.x, ORIGIN.y, BATTLE.w, BATTLE.h);
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= MAP.ROWS; i += 1) {
      const y = ORIGIN.y + i * CELL_PX;
      ctx.beginPath(); ctx.moveTo(ORIGIN.x, y); ctx.lineTo(ORIGIN.x + BATTLE.w, y); ctx.stroke();
    }
    for (let i = 0; i <= MAP.COLS; i += 1) {
      const x = ORIGIN.x + i * CELL_PX;
      ctx.beginPath(); ctx.moveTo(x, ORIGIN.y); ctx.lineTo(x, ORIGIN.y + BATTLE.h); ctx.stroke();
    }

    drawCellTerrain(run, pal, t);
    drawFurnace(run, pal, t);

    for (const pr of run.props) drawProp(pr, pal, t);

    for (const b of run.playerBullets) drawBullet(b, pal);
    for (const b of run.enemyBullets) drawBullet(b, pal);

    // 玩家机甲
    if (run.player.alive) {
      const p = worldToScreen(run.player.x, run.player.y);
      drawTank(p.x, p.y, run.player.dir, pal, true, null, false, run.time < run.player.invulnUntil);
    }
    // 敌人机甲
    for (const e of run.enemies) {
      if (!e.alive) continue;
      const p = worldToScreen(e.x, e.y);
      drawTank(p.x, p.y, e.dir, pal, false, e.type, e.spawning, false);
    }

    drawGrassFront(run, pal);
    drawEffects(run, pal, t);

    // 教程暗场：战场压暗（HUD/教程卡不受影响，叠在最上层）
    if (tutActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(4, 6, 10, 0.45)';
      ctx.fillRect(0, 0, 1280, 720);
      // 机甲聚光圈（保持目标可见）
      const p = worldToScreen(run.player.x, run.player.y);
      const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 130);
      g.addColorStop(0, 'rgba(255, 220, 150, 0.28)');
      g.addColorStop(1, 'rgba(255, 220, 150, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 140, p.y - 140, 280, 280);
      ctx.restore();
    }

    ctx.restore();
    shake *= 0.86;
    if (shake < 0.15) shake = 0;
  }

  return { draw, resize: () => {} };
}
