// Canvas 2D 渲染：横版跑酷战场 + 平台 + 角色 + 子弹 + HUD + 准星。
import { WORLD, GROUND_Y, PLATFORMS, PLAYER, BULLET, RULES, COLORS } from '../../config/game.config.js';
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

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let shake = 0;
  const sparks = [];

  function clearEffects() { sparks.length = 0; shake = 0; }
  function addSpark(x, y, color) { for (let i = 0; i < 6; i++) sparks.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, life: 0.3, color }); }
  function flash() { shake = 0.2; }
  function update(dt) {
    shake = Math.max(0, shake - dt);
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.life <= 0) sparks.splice(i, 1); }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, COLORS.skyTop); g.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.fillStyle = 'rgba(10,14,30,0.5)';
    const bs = [[30, 380, 90], [160, 320, 70], [280, 400, 100], [430, 340, 80], [560, 390, 90], [700, 330, 75], [830, 400, 95], [980, 350, 85], [1110, 390, 90]];
    for (const [x, top, w] of bs) ctx.fillRect(x, top, w, GROUND_Y - top);
    ctx.fillStyle = 'rgba(255,220,130,0.15)';
    for (const [x, top, w] of bs)
      for (let wy = top + 16; wy < GROUND_Y - 20; wy += 28)
        for (let wx = x + 10; wx < x + w - 12; wx += 22)
          if ((wx * 7 + wy * 13) % 5 < 2) ctx.fillRect(wx, wy, 7, 9);
  }

  function drawPlatforms() {
    for (const pl of PLATFORMS) {
      const isGround = pl.h > 40;
      ctx.fillStyle = isGround ? COLORS.ground : COLORS.platform;
      roundRect(ctx, pl.x, pl.y, pl.w, pl.h, isGround ? 0 : 5); ctx.fill();
      ctx.fillStyle = COLORS.platformTop;
      ctx.fillRect(pl.x, pl.y, pl.w, isGround ? 6 : 4);
    }
  }

  function drawPlayer(p) {
    if (!p.alive) return;
    const col = p.team === 0 ? COLORS.blue : COLORS.red;
    const dark = p.team === 0 ? COLORS.blueDark : COLORS.redDark;
    const x = p.x, y = p.y;
    const blink = false;
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y + 3, PLAYER.W * 0.6, 5, 0, 0, Math.PI * 2); ctx.fill();
    // 腿
    ctx.fillStyle = dark;
    ctx.fillRect(x - 11, y - 16, 9, 16);
    ctx.fillRect(x + 2, y - 16, 9, 16);
    // 身体
    ctx.fillStyle = col;
    roundRect(ctx, x - PLAYER.W / 2, y - PLAYER.H + 12, PLAYER.W, PLAYER.H - 26, 7); ctx.fill();
    // 头
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(x, y - PLAYER.H + 4, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.fillRect(x - 11, y - PLAYER.H - 4, 22, 6);
    // 枪
    const cy = y - PLAYER.H * 0.55;
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, cy);
    ctx.lineTo(x + Math.cos(p.aim) * 24, cy + Math.sin(p.aim) * 24); ctx.stroke();
    // 玩家标记
    if (p.id === 0) {
      ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.fillText('YOU', x, y - PLAYER.H - 16);
    }
    // 血条
    const bw = 34, frac = Math.max(0, p.hp / PLAYER.HP);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - bw / 2, y - PLAYER.H - 10, bw, 5);
    ctx.fillStyle = frac > 0.4 ? '#4ade80' : '#f87171';
    ctx.fillRect(x - bw / 2, y - PLAYER.H - 10, bw * frac, 5);
  }

  function drawBullets(run) {
    for (const b of run.bullets) {
      ctx.strokeStyle = b.team === 0 ? 'rgba(125,211,252,0.5)' : 'rgba(253,164,175,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.015, b.y - b.vy * 0.015); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = COLORS.bullet;
      ctx.beginPath(); ctx.arc(b.x, b.y, BULLET.R, 0, Math.PI * 2); ctx.fill();
    }
    for (const s of sparks) {
      ctx.globalAlpha = s.life * 3; ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4); ctx.globalAlpha = 1;
    }
  }

  function drawHud(run) {
    const cx = WORLD.WIDTH / 2;
    ctx.fillStyle = COLORS.hud;
    roundRect(ctx, cx - 160, 12, 320, 56, 12); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = COLORS.blue; ctx.fillText(t('you'), cx - 100, 30);
    ctx.fillStyle = COLORS.red; ctx.fillText(t('bots'), cx + 100, 30);
    ctx.font = `900 30px ${FONT}`;
    ctx.fillStyle = COLORS.blue; ctx.fillText(String(run.scores[0]), cx - 100, 50);
    ctx.fillStyle = '#fff'; ctx.fillText(':', cx, 48);
    ctx.fillStyle = COLORS.red; ctx.fillText(String(run.scores[1]), cx + 100, 50);
    ctx.font = `bold 10px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`FIRST TO ${RULES.killTarget}`, cx, 62);
    const me = run.players[0];
    ctx.fillStyle = COLORS.hud;
    roundRect(ctx, 16, WORLD.HEIGHT - 52, 220, 38, 10); ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = `bold 12px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(t('hp'), 28, WORLD.HEIGHT - 33);
    const frac = Math.max(0, me.hp / PLAYER.HP);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, 60, WORLD.HEIGHT - 40, 160, 14, 7); ctx.fill();
    ctx.fillStyle = me.alive ? (frac > 0.4 ? '#4ade80' : '#f87171') : '#475569';
    roundRect(ctx, 60, WORLD.HEIGHT - 40, 160 * frac, 14, 7); ctx.fill();
    if (!me.alive) {
      ctx.fillStyle = 'rgba(8,12,26,0.6)'; ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.textAlign = 'center';
      ctx.font = `900 40px ${FONT}`; ctx.fillStyle = '#f87171';
      ctx.fillText(t('respawn'), cx, WORLD.HEIGHT / 2 - 10);
      ctx.font = `bold 22px ${FONT}`; ctx.fillStyle = '#fff';
      ctx.fillText(Math.ceil(me.respawnT) + 's', cx, WORLD.HEIGHT / 2 + 28);
    }
  }

  function drawCrosshair(mouse) {
    if (!mouse) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouse.x - 15, mouse.y); ctx.lineTo(mouse.x - 5, mouse.y);
    ctx.moveTo(mouse.x + 5, mouse.y); ctx.lineTo(mouse.x + 15, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 15); ctx.lineTo(mouse.x, mouse.y - 5);
    ctx.moveTo(mouse.x, mouse.y + 5); ctx.lineTo(mouse.x, mouse.y + 15);
    ctx.stroke();
  }

  function render({ run, mouse }) {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 10, (Math.random() - 0.5) * shake * 10);
    drawBackground();
    drawPlatforms();
    if (run) {
      drawBullets(run);
      for (const p of run.players) drawPlayer(p);
      drawHud(run);
    }
    ctx.restore();
    if (run && run.phase === 'play') drawCrosshair(mouse);
  }

  return { render, update, clearEffects, addSpark, flash };
}