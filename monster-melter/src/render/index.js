// MONSTER MELTER · Canvas 2D 渲染（霓虹街机风，纯程序化，无素材无外链）
import { WORLD, BOARD, GEM_COLORS, MONSTER_TYPES } from '../../config/game.config.js';
import { CELLS, SHAPES, axialToWorld } from '../game/sim.js';

const { SCALE, CX, CY, SPACING } = BOARD;
const CELL_R = SPACING * SCALE * 0.46;      // 棋盘格六边形半径（留缝）
const CELL_STROKE = '#1e293b';

const reduceMotion = () => {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
};

function w2s(wx, wy) {
  return { x: CX + wx * SCALE, y: CY + wy * SCALE };
}

function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI / 3;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function fillHex(ctx, cx, cy, r, fill, stroke, lineWidth = 2, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  hexPath(ctx, cx, cy, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  ctx.restore();
}

function glowHex(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.globalAlpha = 0.22;
  hexPath(ctx, cx, cy, r + 5);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function shapePixelCells(shapeIndex, spacingPx) {
  const offs = SHAPES[shapeIndex].map(([q, r]) => axialToWorld(q, r));
  const cx = offs.reduce((s, o) => s + o.x, 0) / offs.length;
  const cy = offs.reduce((s, o) => s + o.y, 0) / offs.length;
  return offs.map((o) => ({ x: (o.x - cx) / SPACING * spacingPx, y: (o.y - cy) / SPACING * spacingPx }));
}

function drawGem(ctx, cx, cy, r, color, alpha = 1) {
  glowHex(ctx, cx, cy, r, color);
  fillHex(ctx, cx, cy, r, color, '#0f172a', 2, alpha);
  // 高光
  ctx.save();
  ctx.globalAlpha = 0.35 * alpha;
  hexPath(ctx, cx - r * 0.2, cy - r * 0.2, r * 0.42);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

function drawRock(ctx, cx, cy, r) {
  fillHex(ctx, cx, cy, r, '#334155', '#0f172a', 2, 1);
  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy - r * 0.2);
  ctx.lineTo(cx, cy + r * 0.3);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.3);
  ctx.stroke();
  ctx.restore();
}

function drawBoard(ctx, board) {
  for (const cell of board) {
    const p = w2s(cell.x, cell.y);
    if (cell.kind === 'gem') {
      drawGem(ctx, p.x, p.y, CELL_R, GEM_COLORS[cell.color - 1] || '#22d3ee');
    } else if (cell.kind === 'rock') {
      drawRock(ctx, p.x, p.y, CELL_R);
    } else {
      fillHex(ctx, p.x, p.y, CELL_R, 'rgba(15,23,42,0.55)', CELL_STROKE, 2);
    }
  }
}

function drawShape(ctx, shapeIndex, color, cx, cy, spacingPx, cellR) {
  const cells = shapePixelCells(shapeIndex, spacingPx);
  for (const c of cells) {
    drawGem(ctx, cx + c.x, cy + c.y, cellR, color);
  }
}

// 怪兽 = 顶部「Boss 卡」：怒脸霓虹果冻头像 + 名称 + 清晰血条。
// 明确它是「要打倒的敌人」而非装饰，血条带 HP 标签与数值。
function drawMonster(ctx, state, view, time) {
  const type = MONSTER_TYPES[state.monType] || MONSTER_TYPES[0];
  const wob = reduceMotion() ? 0 : Math.sin(time * 2.2) * 3;
  const flash = view.monsterFlash > 0 ? 1 : 0;

  // Boss 卡面板（暗底 + 霓虹描边，位于 HUD 之下、棋盘之上，不遮棋盘）
  const px = 450;
  const py = 60;
  const pw = 380;
  const ph = 92;
  ctx.save();
  ctx.fillStyle = 'rgba(15,23,42,0.94)';
  ctx.strokeStyle = type.glow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 12);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 名称 + 血条（左侧信息区）
  ctx.save();
  ctx.fillStyle = type.glow;
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(view && view.monsterName ? view.monsterName : 'MONSTER', px + 22, py + 24);

  const bw = 270;
  const bx = px + 20;
  const by = py + 40;
  const hpRatio = Math.max(0, state.monsterHp / state.monsterMaxHp);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(bx, by, bw, 16);
  ctx.fillStyle = '#fb7185';
  ctx.fillRect(bx, by, bw * hpRatio, 16);
  ctx.strokeStyle = '#fb7185';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx - 3, by - 3, bw + 6, 22);
  ctx.fillStyle = '#fecdd3';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.max(0, Math.ceil(state.monsterHp))} / ${state.monsterMaxHp}`, bx, by + 34);
  ctx.restore();

  // 怒脸果冻头像（右侧）
  const cx = 790;
  const cy = 104;
  const bodyR = 24;
  ctx.save();
  ctx.shadowColor = type.glow;
  ctx.shadowBlur = flash ? 40 : 24;
  const grad = ctx.createRadialGradient(cx - 8, cy - 14, 6, cx, cy, bodyR + 12);
  grad.addColorStop(0, flash ? '#ffffff' : type.glow);
  grad.addColorStop(1, type.core);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5, bodyR, bodyR + wob * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - bodyR * 0.5, cy + 9, bodyR * 0.5, bodyR * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + bodyR * 0.5, cy + 9, bodyR * 0.5, bodyR * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  // 角
  ctx.fillStyle = type.core;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy - 20); ctx.lineTo(cx - 8, cy - 34); ctx.lineTo(cx - 2, cy - 20); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 16, cy - 20); ctx.lineTo(cx + 8, cy - 34); ctx.lineTo(cx + 2, cy - 20); ctx.closePath(); ctx.fill();
  // 眼睛（怒）
  const blink = Math.sin(time * 0.7) > 0.98 ? 0.15 : 1;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(cx - 11, cy - 2, 6, 8 * blink, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 11, cy - 2, 6, 8 * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 9, cy - 5, 2.4, 0, Math.PI * 2);
  ctx.arc(cx + 13, cy - 5, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // 怒眉
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 19, cy - 13); ctx.lineTo(cx - 5, cy - 9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 19, cy - 13); ctx.lineTo(cx + 5, cy - 9); ctx.stroke();
  // 嘴（怒：倒弧 / 露齿）
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (flash) ctx.arc(cx, cy + 14, 9, Math.PI, 0);
  else ctx.arc(cx, cy + 12, 7, Math.PI + 0.2, -0.2);
  ctx.stroke();
  ctx.restore();

  // 目标准星（红色，明确「这就是要打的目标」）
  ctx.save();
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  ctx.stroke();
  const t = 6;
  const tick = (a) => {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
    ctx.lineTo(cx + Math.cos(a) * 48, cy + Math.sin(a) * 48);
    ctx.stroke();
  };
  tick(-Math.PI / 2); tick(0); tick(Math.PI / 2); tick(Math.PI);
  ctx.fillStyle = '#f43f5e';
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TARGET', cx, cy - 46);
  ctx.restore();
}

function drawHint(ctx, view) {
  if (!view.hint) return;
  ctx.save();
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.textAlign = 'center';
  const w = ctx.measureText(view.hint).width + 32;
  const x = 640 - w / 2;
  const y = 156;
  ctx.fillStyle = 'rgba(8,10,22,0.85)';
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 28, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#facc15';
  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 10;
  ctx.fillText(view.hint, 640, y + 19);
  ctx.restore();
}

function drawTrays(ctx, state, view) {
  const slots = [400, 640, 880];
  const sy = 650;
  for (let i = 0; i < 3; i += 1) {
    const tray = state.trays[i];
    if (!tray) continue;
    const held = view.held && view.held.trayIndex === i;
    if (held) {
      // 占位：托盘中空
      fillHex(ctx, slots[i], sy, 42, 'rgba(30,41,59,0.6)', '#334155', 2);
      continue;
    }
    fillHex(ctx, slots[i], sy, 42, 'rgba(15,23,42,0.7)', '#334155', 2);
    drawShape(ctx, tray.shape, GEM_COLORS[tray.color - 1], slots[i], sy, 30, 13);
  }
}

function drawHeldGhost(ctx, state, view) {
  if (!view.held) return;
  const tray = state.trays[view.held.trayIndex];
  if (!tray) return;
  const targets = view.heldTargets;
  if (!targets) return;
  const ok = targets.ok;
  for (const t of targets.indices) {
    const cell = CELLS[t];
    const p = w2s(cell.x, cell.y);
    const color = GEM_COLORS[tray.color - 1];
    if (ok) glowHex(ctx, p.x, p.y, CELL_R, '#4ade80');
    fillHex(ctx, p.x, p.y, CELL_R, ok ? color : 'rgba(244,63,94,0.4)', ok ? '#0f172a' : '#f43f5e', 2, 0.8);
  }
}

function drawFx(ctx, view) {
  for (const fx of view.fx) {
    if (fx.type === 'beam') {
      const k = 1 - fx.ttl / fx.max;
      const a = 0.9 * (1 - k);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#a5f3fc';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y);
      ctx.lineTo(fx.tx, fx.ty);
      ctx.stroke();
      ctx.restore();
    } else if (fx.type === 'boom') {
      const k = 1 - fx.ttl / fx.max;
      ctx.save();
      ctx.globalAlpha = 0.8 * (1 - k);
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 10 + k * 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawTalk(ctx, view) {
  if (!view.talk) return;
  const { text, ttl } = view.talk;
  if (ttl <= 0) return;
  const cx = 640;
  const cy = 20;
  ctx.save();
  ctx.font = 'bold 15px "Courier New", monospace';
  const w = Math.min(360, ctx.measureText(text).width + 24);
  const x = cx - w / 2;
  ctx.fillStyle = 'rgba(15,23,42,0.92)';
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, cy, w, 26, 13);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a5f3fc';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, cy + 18);
  ctx.restore();
}

function drawTitleScene(ctx, time) {
  const fake = { monType: 0, monsterHp: 70, monsterMaxHp: 100 };
  drawMonster(ctx, fake, { monsterFlash: 0 }, time);
  const gems = [[210, 300], [1070, 260], [170, 540], [1110, 560]];
  for (let i = 0; i < gems.length; i += 1) {
    const bob = Math.sin(time * 1.5 + i) * 6;
    drawGem(ctx, gems[i][0], gems[i][1] + bob, 26, GEM_COLORS[i % 4]);
  }
}

function drawBackground(ctx, time) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, '#0b0f1e');
  g.addColorStop(1, '#0a0a18');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 霓虹网格
  ctx.save();
  ctx.strokeStyle = 'rgba(34,211,238,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WORLD.WIDTH; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
  }
  for (let y = 0; y < WORLD.HEIGHT; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
  }
  ctx.restore();

  // 中心光晕
  if (!reduceMotion()) {
    const pulse = 0.5 + Math.sin(time * 0.6) * 0.5;
    const rg = ctx.createRadialGradient(CX, CY, 60, CX, CY, 460);
    rg.addColorStop(0, `rgba(34,211,238,${0.06 * pulse + 0.02})`);
    rg.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  return {
    draw(state, dt, view) {
      const time = (view && view.time) || 0;
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      drawBackground(ctx, time);

      if (!state) {
        drawTitleScene(ctx, time);
        return;
      }

      drawBoard(ctx, state.board);
      drawTrays(ctx, state, view);
      drawHeldGhost(ctx, state, view);
      drawFx(ctx, view);
      drawMonster(ctx, state, view, time);
      drawHint(ctx, view);
      drawTalk(ctx, view);

      // 炸弹待瞄准指示
      if (view && view.bombArmed) {
        ctx.save();
        ctx.fillStyle = 'rgba(251,191,36,0.16)';
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        ctx.restore();
      }

      // 震屏
      if (view && view.shake > 0) {
        ctx.save();
        ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
        // 已经画完了，这里只做轻微抖动代价太高——改在下一帧整体偏移由 main 处理
        ctx.restore();
      }
    },

    cellScreen(index) {
      const cell = CELLS[index];
      return w2s(cell.x, cell.y);
    },

    debugLayout() {
      return {
        board: { x: CX - 255, y: CY - 221, w: 510, h: 442 },
        monster: { x: 590, y: 46, w: 100, h: 90 },
        trays: { x: 340, y: 606, w: 600, h: 90 },
      };
    },
  };
}
