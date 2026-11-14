// Canvas 2D 渲染：陷阱屋竞技场 + 尖刺/炸弹 + 玩家 + HUD + 回合覆盖层。
import { WORLD, ARENA, GRID, PLAYER, RULES, PCOLORS, PNAMES, COLORS } from '../../config/game.config.js';
import { t } from '../core/i18n.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

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
function tileRect(idx) {
  const c = idx % GRID.cols, r = Math.floor(idx / GRID.cols);
  return { x: GRID.ox + c * GRID.tw, y: GRID.oy + r * GRID.th, w: GRID.tw, h: GRID.th };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let time = 0;
  const bursts = [];

  function clearEffects() { bursts.length = 0; }
  function addBurst(x, y) { bursts.push({ x, y, life: 0.4 }); }
  function update(dt) {
    time += dt;
    for (let i = bursts.length - 1; i >= 0; i--) { bursts[i].life -= dt; if (bursts[i].life <= 0) bursts.splice(i, 1); }
  }

  function drawArena() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 地板棋盘
    for (let r = 0; r < GRID.rows; r++) {
      for (let c = 0; c < GRID.cols; c++) {
        ctx.fillStyle = (r + c) % 2 ? COLORS.floor : COLORS.floorAlt;
        ctx.fillRect(GRID.ox + c * GRID.tw, GRID.oy + r * GRID.th, GRID.tw, GRID.th);
      }
    }
    // 墙
    ctx.strokeStyle = COLORS.wall; ctx.lineWidth = 10;
    roundRect(ctx, ARENA.x0 - 12, ARENA.y0 - 12, ARENA.x1 - ARENA.x0 + 24, ARENA.y1 - ARENA.y0 + 24, 16);
    ctx.stroke();
  }

  function drawTraps(run) {
    for (const tr of run.traps) {
      if (tr.type === 'spike') {
        for (const idx of tr.tiles) {
          const rc = tileRect(idx);
          if (tr.phase === 'warn') {
            const a = 0.2 + 0.25 * Math.abs(Math.sin(time * 12));
            ctx.fillStyle = `rgba(251,113,133,${a})`;
            ctx.fillRect(rc.x + 3, rc.y + 3, rc.w - 6, rc.h - 6);
            ctx.strokeStyle = 'rgba(251,113,133,0.7)'; ctx.lineWidth = 2;
            ctx.strokeRect(rc.x + 3, rc.y + 3, rc.w - 6, rc.h - 6);
          } else {
            ctx.fillStyle = COLORS.spikeBase;
            ctx.fillRect(rc.x + 3, rc.y + 3, rc.w - 6, rc.h - 6);
            ctx.fillStyle = COLORS.spike;
            for (let sy = rc.y + 14; sy < rc.y + rc.h - 8; sy += 26) {
              for (let sx = rc.x + 14; sx < rc.x + rc.w - 8; sx += 26) {
                ctx.beginPath();
                ctx.moveTo(sx, sy + 16); ctx.lineTo(sx + 9, sy); ctx.lineTo(sx + 18, sy + 16);
                ctx.closePath(); ctx.fill();
              }
            }
          }
        }
      } else {
        if (tr.phase === 'warn') {
          const frac = tr.t / RULES.bombWarn;
          ctx.fillStyle = COLORS.bombWarn;
          ctx.beginPath(); ctx.arc(tr.x, tr.y, RULES.bombRadius, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(tr.x, tr.y, RULES.bombRadius * frac, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#1f2937';
          ctx.beginPath(); ctx.arc(tr.x, tr.y, 12, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(tr.x, tr.y - 12); ctx.lineTo(tr.x + 6, tr.y - 20); ctx.stroke();
        } else {
          const a = 1 - tr.t / 0.25;
          ctx.fillStyle = `rgba(249,115,22,${a * 0.8})`;
          ctx.beginPath(); ctx.arc(tr.x, tr.y, RULES.bombRadius * (1 + tr.t * 2), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(255,237,213,${a})`;
          ctx.beginPath(); ctx.arc(tr.x, tr.y, RULES.bombRadius * 0.5 * a, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    for (const b of bursts) {
      ctx.strokeStyle = `rgba(255,255,255,${b.life * 2})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, (0.4 - b.life) * 200, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawPlayers(run) {
    for (const p of run.players) {
      const col = PCOLORS[p.id];
      if (!p.alive) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER.R * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.x - 8, p.y - 8); ctx.lineTo(p.x + 8, p.y + 8);
        ctx.moveTo(p.x + 8, p.y - 8); ctx.lineTo(p.x - 8, p.y + 8); ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      const blink = p.invuln > 0 && Math.floor(time * 12) % 2 === 0;
      ctx.globalAlpha = blink ? 0.4 : 1;
      // 影子
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + PLAYER.R * 0.8, PLAYER.R * 0.9, PLAYER.R * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      // 身体
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER.R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; ctx.stroke();
      // 眼睛
      ctx.fillStyle = '#1f2937';
      ctx.beginPath(); ctx.arc(p.x - 6, p.y - 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + 6, p.y - 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // 名牌 + 血条
      ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = col;
      ctx.fillText(PNAMES[p.id] + (p.isBot ? ' ·bot' : ''), p.x, p.y - PLAYER.R - 22);
      for (let h = 0; h < PLAYER.HP; h++) {
        ctx.fillStyle = h < p.hp ? '#f87171' : 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(p.x - 12 + h * 12, p.y - PLAYER.R - 8, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawHud(run) {
    ctx.textBaseline = 'middle';
    // 顶部回合
    ctx.fillStyle = COLORS.hud;
    roundRect(ctx, WORLD.WIDTH / 2 - 90, 14, 180, 40, 10); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = `bold 16px ${FONT}`; ctx.fillStyle = '#fff';
    ctx.fillText(`${t('round')} ${run.round} · ${t('firstTo')}`, WORLD.WIDTH / 2, 34);
    // 四个记分牌
    const pw = 150, gap = 12, total = pw * 4 + gap * 3;
    let x = (WORLD.WIDTH - total) / 2;
    for (let i = 0; i < 4; i++) {
      const p = run.players[i];
      ctx.fillStyle = COLORS.hud;
      roundRect(ctx, x, 64, pw, 46, 10); ctx.fill();
      ctx.strokeStyle = PCOLORS[i]; ctx.lineWidth = 2;
      roundRect(ctx, x, 64, pw, 46, 10); ctx.stroke();
      ctx.textAlign = 'left';
      ctx.font = `bold 14px ${FONT}`; ctx.fillStyle = PCOLORS[i];
      ctx.fillText(PNAMES[i] + (p.isBot ? ' ·bot' : ''), x + 12, 80);
      ctx.font = `900 20px ${FONT}`; ctx.fillStyle = '#fff';
      ctx.fillText(String(run.scores[i]), x + 12, 99);
      // 心
      for (let h = 0; h < PLAYER.HP; h++) {
        ctx.fillStyle = p.alive && h < p.hp ? '#f87171' : 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.arc(x + pw - 40 + h * 13, 99, 4.5, 0, Math.PI * 2); ctx.fill();
      }
      x += pw + gap;
    }
  }

  function drawOverlay(run) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (run.phase === 'countdown') {
      ctx.fillStyle = 'rgba(8,12,26,0.4)';
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.font = `900 80px ${FONT}`; ctx.fillStyle = '#fbbf24';
      const n = Math.ceil(run.phaseT);
      ctx.fillText(n > 0 ? String(n) : t('go'), WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
      ctx.font = `bold 22px ${FONT}`; ctx.fillStyle = '#fff';
      ctx.fillText(t('ready'), WORLD.WIDTH / 2, WORLD.HEIGHT / 2 + 64);
    } else if (run.phase === 'roundend') {
      ctx.fillStyle = 'rgba(8,12,26,0.55)';
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      const last = run.lastRoundWinner;
      ctx.font = `900 54px ${FONT}`;
      if (last === undefined || last < 0) { ctx.fillStyle = '#fff'; ctx.fillText(t('draw'), WORLD.WIDTH / 2, WORLD.HEIGHT / 2); }
      else { ctx.fillStyle = PCOLORS[last]; ctx.fillText(`${PNAMES[last]} ${t('roundWin')}`, WORLD.WIDTH / 2, WORLD.HEIGHT / 2); }
    }
  }

  function render({ run }) {
    drawArena();
    if (run) {
      drawTraps(run);
      drawPlayers(run);
      drawHud(run);
      drawOverlay(run);
    }
  }

  return { render, update, clearEffects, addBurst };
}