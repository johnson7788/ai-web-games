// FOG TOWN · Canvas 2D 渲染：雾巷棋盘 + 灯焰光 + 场景装饰 + 出口信标。
// 契约：createRender(canvas) → { draw(run, alpha) }
import { GRID, T, DIRS } from '../../config/gameplay.js';
import { themeAt } from './theme.js';
import { isRevealed } from '../game/sim.js';

const W = 1280;
const H = 720;
const CELL = GRID.CELL;
const GW = GRID.COLS * CELL;
const GH = GRID.ROWS * CELL;
const OX = (W - GW) / 2;
const OY = Math.max(52, (H - GH) / 2);

function px(x) { return OX + x * CELL; }
function py(y) { return OY + y * CELL; }
function cx(x) { return px(x) + CELL / 2; }
function cy(y) { return py(y) + CELL / 2; }

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  // ---------- 场景背景 / 装饰 ----------
  function drawBackground(theme) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.bgTop);
    g.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (theme.key === 'dusk') {
      // 屋顶剪影
      ctx.fillStyle = theme.decor;
      for (let i = 0; i < 7; i += 1) {
        const x = i * 190;
        const w = 130 + (i % 3) * 26;
        const h = 90 + (i % 2) * 40;
        ctx.fillRect(x, 0, w, h);
        ctx.fillStyle = theme.decor;
      }
      ctx.fillStyle = theme.window;
      for (let i = 0; i < 14; i += 1) {
        ctx.globalAlpha = 0.5 + (i % 3) * 0.15;
        ctx.fillRect(30 + i * 90, 24 + (i % 4) * 30, 14, 18);
      }
    } else if (theme.key === 'market') {
      // 集市摊位
      ctx.fillStyle = theme.decor;
      for (let i = 0; i < 6; i += 1) {
        const x = i * 220;
        ctx.fillRect(x, H - 40, 150, 40);
        ctx.fillRect(x + 8, H - 74, 134, 8);
      }
      ctx.fillStyle = theme.window;
      for (let i = 0; i < 6; i += 1) {
        ctx.globalAlpha = 0.6;
        ctx.fillRect(i * 220 + 20, H - 32, 22, 12);
      }
    } else {
      // 湖面波纹
      ctx.strokeStyle = theme.window;
      for (let i = 0; i < 9; i += 1) {
        ctx.globalAlpha = 0.14 + (i % 3) * 0.06;
        ctx.beginPath();
        const y = H - 18 - i * 9;
        ctx.moveTo(0, y);
        for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
        ctx.stroke();
      }
      ctx.fillStyle = theme.decor;
      ctx.globalAlpha = 1;
      ctx.fillRect(0, H - 12, W, 12);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------- 迷雾棋盘 ----------
  function drawBoard(run) {
    const map = run.map;
    const theme = themeAt(map.scene);

    // 雾底
    ctx.fillStyle = theme.fog;
    ctx.fillRect(OX, OY, GW, GH);

    // 已揭示的地板 / 墙 / 物件
    for (let y = 0; y < map.rows; y += 1) {
      for (let x = 0; x < map.cols; x += 1) {
        if (!isRevealed(run, x, y)) continue;
        const t = map.cells[y * map.cols + x];
        const X = px(x);
        const Y = py(y);
        if (t === T.WALL) {
          ctx.fillStyle = theme.wall;
          ctx.fillRect(X + 2, Y + 2, CELL - 4, CELL - 4);
          ctx.strokeStyle = theme.wallEdge;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(X + 3.5, Y + 3.5, CELL - 7, CELL - 7);
        } else {
          ctx.fillStyle = theme.floor;
          ctx.fillRect(X + 1, Y + 1, CELL - 2, CELL - 2);
          ctx.strokeStyle = theme.floorLine;
          ctx.lineWidth = 1;
          ctx.strokeRect(X + 0.5, Y + 0.5, CELL, CELL);
          if (t === T.KEY) drawKey(theme, X, Y);
          else if (t === T.CLUE) drawClue(theme, X, Y);
          else if (t === T.LEVER) drawLever(theme, X, Y);
          else if (t === T.TRAP) drawTrap(theme, X, Y);
        }
      }
    }

    // 守卫（揭示后）
    for (const g of map.guards) {
      const guardCellRevealed = isRevealed(run, g.x, g.y);
      const d = DIRS[g.dir];
      const vx = g.x + d.dx;
      const vy = g.y + d.dy;
      const visRevealed = guardCellRevealed || (vx >= 0 && vy >= 0 && vx < map.cols && vy < map.rows && isRevealed(run, vx, vy));
      if (visRevealed) {
        const X = px(g.x); const Y = py(g.y);
        // 视线锥
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = theme.guard;
        ctx.fillRect(px(vx) + 8, py(vy) + 8, CELL - 16, CELL - 16);
        ctx.restore();
        ctx.globalAlpha = 1;
        drawGuard(theme, X, Y);
      }
    }

    // 出口信标（始终可见：目标一眼可读）
    drawExitBeacon(theme, map.exit.x, map.exit.y);
  }

  function drawKey(theme, X, Y) {
    const cxm = X + CELL / 2;
    const cym = Y + CELL / 2;
    ctx.strokeStyle = theme.key;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cxm - 6, cym - 4, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cxm + 1, cym - 2);
    ctx.lineTo(cxm + 16, cym + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cxm + 14, cym + 8);
    ctx.lineTo(cxm + 18, cym + 14);
    ctx.moveTo(cxm + 19, cym + 12);
    ctx.lineTo(cxm + 23, cym + 16);
    ctx.stroke();
  }

  function drawClue(theme, X, Y) {
    const cxm = X + CELL / 2;
    const cym = Y + CELL / 2;
    ctx.fillStyle = theme.clue;
    ctx.beginPath();
    ctx.arc(cxm - 4, cym - 3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.clue;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cxm + 3, cym + 3);
    ctx.lineTo(cxm + 14, cym + 14);
    ctx.stroke();
  }

  function drawLever(theme, X, Y) {
    const cxm = X + CELL / 2;
    const cym = Y + CELL / 2;
    ctx.fillStyle = theme.lever;
    ctx.fillRect(cxm - 16, cym + 6, 32, 6);
    ctx.beginPath();
    ctx.arc(cxm, cym + 9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.lever;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cxm, cym + 9);
    ctx.lineTo(cxm - 12, cym - 10);
    ctx.stroke();
  }

  function drawTrap(theme, X, Y) {
    const cxm = X + CELL / 2;
    const cym = Y + CELL / 2;
    ctx.fillStyle = theme.trap;
    for (let i = 0; i < 3; i += 1) {
      const sx = cxm - 16 + i * 14;
      ctx.beginPath();
      ctx.moveTo(sx, cym + 12);
      ctx.lineTo(sx + 7, cym - 12);
      ctx.lineTo(sx + 14, cym + 12);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawGuard(theme, X, Y) {
    const cxm = X + CELL / 2;
    const cym = Y + CELL / 2;
    // 身体 + 头
    ctx.fillStyle = theme.guard;
    ctx.beginPath();
    ctx.arc(cxm, cym - 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cxm - 11, cym + 4, 22, 16);
    // 感叹号
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', cxm, cym - 24);
  }

  function drawExitBeacon(theme, x, y) {
    const X = px(x);
    const Y = py(y);
    const cxm = X + CELL / 2;
    const cym = Y + CELL / 2;
    const t = performance.now() / 1000;
    const pulse = 0.6 + 0.4 * Math.sin(t * 3);

    // 发光门
    ctx.save();
    ctx.shadowColor = theme.exitGlow;
    ctx.shadowBlur = 22;
    ctx.fillStyle = theme.exit;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(X + 12, Y + 16, CELL - 24, CELL - 20);
    ctx.fillStyle = theme.bgTop;
    ctx.fillRect(X + 20, Y + 24, CELL - 40, CELL - 36);
    ctx.restore();
    ctx.globalAlpha = 1;

    // 信标菱形（悬于门上）
    ctx.save();
    ctx.translate(cxm, Y - 6);
    ctx.rotate(Math.PI / 4);
    const s = 9 + pulse * 3;
    ctx.shadowColor = theme.exitGlow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = theme.exit;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------- 灯焰 / 玩家 ----------
  function drawPlayer(run) {
    const map = run.map;
    const theme = themeAt(map.scene);
    const X = px(run.player.x);
    const Y = py(run.player.y);
    const cxm = X + CELL / 2;
    const cym = Y + CELL / 2;
    const radius = run.getHud().radius;

    // 灯光（加法混合的暖光圆）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cxm, cym, 4, cxm, cym, (radius + 0.6) * CELL);
    glow.addColorStop(0, theme.lampGlow);
    glow.addColorStop(0.55, theme.lampGlow.replace('0.55', '0.22'));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cxm, cym, (radius + 0.6) * CELL, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 侦探：身体 + 头 + 提灯
    ctx.fillStyle = '#11161f';
    ctx.beginPath();
    ctx.arc(cxm, cym - 6, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cxm - 10, cym + 2, 20, 18);
    // 提灯（最亮）
    ctx.save();
    ctx.shadowColor = theme.lamp;
    ctx.shadowBlur = 18;
    ctx.fillStyle = theme.lampCore;
    ctx.beginPath();
    ctx.arc(cxm + 16, cym + 6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = theme.lamp;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cxm + 6, cym + 2);
    ctx.lineTo(cxm + 16, cym + 6);
    ctx.stroke();
  }

  function drawTruthOverlay(run) {
    const map = run.map;
    const theme = themeAt(map.scene);
    const t = performance.now() / 1000;
    const a = 0.35 + 0.15 * Math.sin(t * 6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = theme.lampGlow;
    ctx.globalAlpha = a;
    ctx.fillRect(OX, OY, GW, GH);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawDemoScene() {
    const theme = themeAt(0);
    drawBackground(theme);
    ctx.fillStyle = theme.fog;
    ctx.fillRect(OX, OY, GW, GH);
    // 几格示范地板
    for (let y = 3; y < 7; y += 1) {
      for (let x = 3; x < 9; x += 1) {
        ctx.fillStyle = theme.floor;
        ctx.fillRect(px(x) + 1, py(y) + 1, CELL - 2, CELL - 2);
        ctx.strokeStyle = theme.floorLine;
        ctx.strokeRect(px(x) + 0.5, py(y) + 0.5, CELL, CELL);
      }
    }
    drawExitBeacon(theme, 8, 3);
    // 中心灯焰
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, 260);
    glow.addColorStop(0, theme.lampGlow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function draw(run, alpha) {
    if (!run) {
      drawDemoScene();
      return;
    }
    const theme = themeAt(run.map.scene);
    drawBackground(theme);
    drawBoard(run);
    if (run.getHud().truthActive) drawTruthOverlay(run);
    drawPlayer(run);
  }

  return { draw };
}
