/**
 * UI 层：HUD、主菜单、说明、暂停、结算。
 * 所有可点区域由 this.hits 记录，main.js 只负责把点击喂进来。
 */
import { WORLD, MATCH, PALETTE, ACTS, AI_LEVELS, LAYOUT } from '../../config/game.config.js';
import { t, titleLines, getLang } from '../core/i18n.js';
import { IMG } from '../render/assets.js';
import { font, roundRect } from '../render/scene.js';

const W = WORLD.W;
const H = WORLD.H;

function nineSlice(ctx, img, x, y, w, h, inset = 72) {
  const iw = img.width;
  const ih = img.height;
  const s = inset;
  ctx.drawImage(img, 0, 0, s, s, x, y, s, s);
  ctx.drawImage(img, iw - s, 0, s, s, x + w - s, y, s, s);
  ctx.drawImage(img, 0, ih - s, s, s, x, y + h - s, s, s);
  ctx.drawImage(img, iw - s, ih - s, s, s, x + w - s, y + h - s, s, s);
  ctx.drawImage(img, s, 0, iw - s * 2, s, x + s, y, w - s * 2, s);
  ctx.drawImage(img, s, ih - s, iw - s * 2, s, x + s, y + h - s, w - s * 2, s);
  ctx.drawImage(img, 0, s, s, ih - s * 2, x, y + s, s, h - s * 2);
  ctx.drawImage(img, iw - s, s, s, ih - s * 2, x + w - s, y + s, s, h - s * 2);
  ctx.drawImage(img, s, s, iw - s * 2, ih - s * 2, x + s, y + s, w - s * 2, h - s * 2);
}

export class UI {
  constructor(ctx) {
    this.ctx = ctx;
    this.hits = [];
    this.hover = -1;
  }

  resetHits() { this.hits = []; }

  /* ───────── 基础零件 ───────── */

  panel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.save();
    // 先铺一层玉底：去背时玉芯被判成背景抠掉了，这里补回来
    roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 12);
    const bg = ctx.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, 'rgba(18,42,34,0.97)');
    bg.addColorStop(0.5, 'rgba(11,28,23,0.97)');
    bg.addColorStop(1, 'rgba(7,18,15,0.98)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (IMG.panel) {
      nineSlice(ctx, IMG.panel, x, y, w, h, 76);
    } else {
      roundRect(ctx, x, y, w, h, 18);
      ctx.fillStyle = 'rgba(16,34,28,0.94)';
      ctx.fill();
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  text(str, x, y, size, color = PALETTE.paper, opts = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = font(size, opts.weight || 'bold');
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = opts.baseline || 'alphabetic';
    const sw = opts.strokeWidth ?? Math.max(4, size * 0.14);
    if (opts.stroke !== false && sw > 0) {
      ctx.lineWidth = sw;
      ctx.strokeStyle = opts.strokeColor || 'rgba(6,4,9,0.9)';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    if (opts.gradient) {
      const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.2);
      g.addColorStop(0, opts.gradient[0]);
      g.addColorStop(1, opts.gradient[1]);
      ctx.fillStyle = g;
    }
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  button({ x, y, w, h, label, sub, accent = PALETTE.gold, action, id, small = false }) {
    const ctx = this.ctx;
    const hovered = this.hover === id;
    ctx.save();
    // 底
    roundRect(ctx, x, y + 5, w, h, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();

    roundRect(ctx, x, y, w, h, 14);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, hovered ? 'rgba(46,40,54,0.98)' : 'rgba(28,24,34,0.96)');
    g.addColorStop(1, 'rgba(12,10,16,0.98)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = hovered ? 4 : 2.5;
    ctx.strokeStyle = accent;
    ctx.stroke();

    // 两侧金角
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x + 10, y + h / 2 - 1.5, 18, 3);
    ctx.fillRect(x + w - 28, y + h / 2 - 1.5, 18, 3);
    ctx.globalAlpha = 1;
    ctx.restore();

    this.text(label, x + w / 2, y + (sub ? h * 0.44 : h * 0.62), small ? 26 : 34, PALETTE.paper, { strokeWidth: 5 });
    if (sub) this.text(sub, x + w / 2, y + h * 0.8, 19, 'rgba(230,214,186,0.72)', { strokeWidth: 4 });

    this.hits.push({ id, x, y, w, h, action });
  }

  chip({ x, y, w, h, label, active, action, id }) {
    const ctx = this.ctx;
    ctx.save();
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = active ? 'rgba(232,180,74,0.92)' : 'rgba(14,12,18,0.82)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? '#fff3d0' : 'rgba(232,180,74,0.5)';
    ctx.stroke();
    ctx.restore();
    this.text(label, x + w / 2, y + h * 0.68, 22, active ? '#2a1d0c' : 'rgba(236,224,200,0.85)', { strokeWidth: active ? 0 : 4 });
    this.hits.push({ id, x, y, w, h, action });
  }

  /* ───────── HUD ───────── */

  drawHud(run, mode, now) {
    const ctx = this.ctx;
    const p1 = run.players[0];
    const p2 = run.players[1];

    // 顶栏底衬：让文字从云海里拔出来
    const scrim = ctx.createLinearGradient(0, 0, 0, 214);
    scrim.addColorStop(0, 'rgba(5,4,9,0.94)');
    scrim.addColorStop(0.72, 'rgba(5,4,9,0.82)');
    scrim.addColorStop(1, 'rgba(5,4,9,0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, 214);

    // 劫名
    const act = run.sudden ? t('act.sudden') : t(ACTS[Math.min(run.actIndex, ACTS.length - 1)].nameKey);
    this.text(act, W / 2, 42, 25, PALETTE.gold, { strokeWidth: 5 });

    this.drawPlayerBlock(0, p1, mode === 'duo' ? t('hud.p1') : t('hud.yours'), PALETTE.red, 24);
    this.drawPlayerBlock(1, p2, mode === 'duo' ? t('hud.p2') : t('hud.cpu'), PALETTE.cyan, W - 24 - 226);

    // 中央目标进度
    this.drawTargetBar(run, now);

    // 连击贴在各自头顶，不挤占顶栏
    for (let i = 0; i < 2; i++) {
      const p = run.players[i];
      if (p.combo < 2) continue;
      this.text(`×${p.combo}`, i === 0 ? 118 : W - 118, 900, 34, PALETTE.gold, { strokeWidth: 7 });
    }
  }

  drawPlayerBlock(index, player, label, color, x) {
    const ctx = this.ctx;
    const y = 58;
    const w = 226;
    const h = 96;

    ctx.save();
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = 'rgba(8,6,11,0.66)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = player.alive ? color : 'rgba(120,110,120,0.6)';
    ctx.stroke();
    // 顶部色条
    ctx.fillStyle = color;
    ctx.globalAlpha = player.alive ? 0.95 : 0.3;
    ctx.fillRect(x + 12, y + 3, w - 24, 4);
    ctx.restore();

    // 名字靠外侧，数字靠内侧 —— 两边镜像，眼睛一扫就知道谁领先
    const outer = index === 0 ? 'left' : 'right';
    const inner = index === 0 ? 'right' : 'left';
    const ox = index === 0 ? x + 16 : x + w - 16;
    const ix = index === 0 ? x + w - 16 : x + 16;
    this.text(label, ox, y + 28, 18, 'rgba(232,220,196,0.78)', { align: outer, strokeWidth: 4 });
    this.text(String(player.logs), ix, y + 80, 48, PALETTE.paper, { align: inner, strokeWidth: 6 });

    // 血格：从外向内排，两边对称
    for (let i = 0; i < MATCH.hp; i++) {
      const px = index === 0 ? x + 24 + i * 28 : x + w - 24 - i * 28;
      const py = y + h - 20;
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = i < player.hp ? color : 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.stroke();
      ctx.restore();
    }


  }

  drawTargetBar(run, now) {
    const ctx = this.ctx;
    const w = 320;
    const x = W / 2 - w / 2;
    const y = 168;
    const h = 9;
    ctx.save();
    roundRect(ctx, x, y, w, h, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();
    ctx.save();
    roundRect(ctx, x, y, w, h, 5);
    ctx.clip();
    const k1 = Math.min(1, run.players[0].logs / MATCH.targetLogs);
    const k2 = Math.min(1, run.players[1].logs / MATCH.targetLogs);
    ctx.fillStyle = PALETTE.red;
    ctx.fillRect(x + w / 2 - (w / 2) * k1, y, (w / 2) * k1, h);
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillRect(x + w / 2, y, (w / 2) * k2, h);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x + w / 2 - 1, y - 3, 2, h + 6);
    ctx.restore();
    this.text(`${t('hud.target')} ${MATCH.targetLogs}`, W / 2, y + 32, 17, 'rgba(232,220,196,0.6)', { strokeWidth: 3 });
  }

  /* ───────── 底部操作区 ───────── */

  drawControls(mode, run, now) {
    const ctx = this.ctx;
    const y = 1152;
    const h = 96;

    if (mode === 'duo') {
      this.chopPad(0, 16, y, 336, h, PALETTE.red, run);
      this.chopPad(1, 368, y, 336, h, PALETTE.cyan, run);
    } else {
      // 单人：提示 + 两侧大热区
      const pulse = 0.35 + Math.sin(now / 260) * 0.15;
      for (let i = 0; i < 2; i++) {
        const x = i === 0 ? 16 : 368;
        ctx.save();
        ctx.globalAlpha = 0.16 + pulse * 0.16;
        roundRect(ctx, x, y, 336, h, 16);
        ctx.fillStyle = i === 0 ? PALETTE.red : PALETTE.cyan;
        ctx.fill();
        ctx.restore();
        const label = i === 0 ? `◀ ${t('hud.left')}` : `${t('hud.right')} ▶`;
        this.text(label, x + 168, y + 62, 30, 'rgba(240,230,210,0.8)', { strokeWidth: 6 });
      }
    }
  }

  chopPad(player, x, y, w, h, color, run) {
    const ctx = this.ctx;
    const p = run.players[player];
    const dead = !p.alive;
    const half = (w - 12) / 2;
    ['◀', '▶'].forEach((arrow, i) => {
      const bx = x + i * (half + 12);
      ctx.save();
      ctx.globalAlpha = dead ? 0.25 : 1;
      roundRect(ctx, bx, y, half, h, 14);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(24,20,28,0.9)');
      g.addColorStop(1, 'rgba(10,8,12,0.94)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
      this.text(arrow, bx + half / 2, y + 66, 42, color, { strokeWidth: 6 });
      this.hits.push({
        id: `chop-${player}-${i}`,
        x: bx, y, w: half, h,
        action: () => {},
        chop: { player, side: i === 0 ? 'L' : 'R' },
      });
    });
  }

  /* ───────── 主菜单 ───────── */

  drawMenu(state) {
    const ctx = this.ctx;
    // 压暗背景
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(6,4,10,0.72)');
    g.addColorStop(0.45, 'rgba(6,4,10,0.52)');
    g.addColorStop(1, 'rgba(6,4,10,0.86)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 标题：中文一行、英文两行，字号跟着行数走
    const lines = titleLines();
    const size = lines.length > 1 ? 104 : 128;
    lines.forEach((line, i) => {
      this.text(line, W / 2, 250 + i * (size * 0.94), size, PALETTE.gold, {
        strokeWidth: 16, strokeColor: 'rgba(6,4,9,0.95)',
        gradient: ['#ffe9a8', '#c8812a'],
      });
    });
    this.text(t('game.sub'), W / 2, 250 + (lines.length - 1) * size * 0.94 + 62, 24,
      'rgba(240,228,204,0.82)', { strokeWidth: 5 });

    // 双仙剪影：站在标题下方两侧，不压字
    if (IMG.red_idle && IMG.blue_idle) {
      const sc = 0.34;
      const baseY = 452;
      const hero = (img, cx, flip) => {
        const w = img.width * sc;
        const h = img.height * sc;
        ctx.save();
        ctx.globalAlpha = 0.9;
        if (flip) {
          ctx.translate(cx, 0);
          ctx.scale(-1, 1);
          ctx.translate(-cx, 0);
        }
        ctx.drawImage(img, cx - w / 2, baseY - h, w, h);
        ctx.restore();
      };
      hero(IMG.red_idle, 92, false);
      hero(IMG.blue_idle, W - 92, true);
    }

    this.button({ x: 120, y: 470, w: 480, h: 96, label: t('menu.solo'), accent: PALETTE.red, action: () => this.onAction('solo'), id: 'solo' });
    this.button({ x: 120, y: 586, w: 480, h: 96, label: t('menu.duo'), accent: PALETTE.cyan, action: () => this.onAction('duo'), id: 'duo' });
    this.button({ x: 120, y: 702, w: 480, h: 80, label: t('menu.howto'), accent: PALETTE.gold, action: () => this.onAction('howto'), id: 'howto' });

    // 难度
    this.text(t('menu.diff'), W / 2, 838, 20, 'rgba(232,220,196,0.7)', { strokeWidth: 4 });
    const cw = 150;
    AI_LEVELS.forEach((lv, i) => {
      this.chip({
        x: W / 2 - (cw * 3 + 24) / 2 + i * (cw + 12), y: 856, w: cw, h: 52,
        label: t(lv.nameKey), active: state.aiLevel === lv.id,
        action: () => this.onAction('difficulty', lv.id), id: 'diff-' + lv.id,
      });
    });

    // 记录
    this.text(`${t('menu.best')} · ${state.bestLogs}`, W / 2, 972, 24, 'rgba(240,228,204,0.8)', { strokeWidth: 5 });
    this.text(t('menu.hint'), W / 2, 1030, 20, 'rgba(220,208,186,0.55)', { strokeWidth: 4 });

    // 语言 + 音效
    this.chip({ x: W - 132, y: 1054, w: 108, h: 44, label: state.lang === 'zh' ? 'EN' : '中文', active: false, action: () => this.onAction('lang'), id: 'lang' });
    this.chip({ x: 24, y: 1054, w: 124, h: 44, label: state.sound ? t('menu.soundOn') : t('menu.soundOff'), active: state.sound, action: () => this.onAction('sound'), id: 'sound' });
  }

  /* ───────── 玩法说明 ───────── */

  drawHowto() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(6,4,10,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    this.panel(48, 150, W - 96, 900);
    this.text(t('howto.title'), W / 2, 250, 46, PALETTE.gold, { strokeWidth: 8 });

    const lines = [
      ['howto.p1', PALETTE.paper],
      ['howto.p2', PALETTE.paper],
      ['howto.p3', PALETTE.gold],
      ['howto.p4', PALETTE.paper],
      ['howto.p5', '#c9a8ff'],
      ['howto.p6', PALETTE.gold],
    ];
    let y = 312;
    for (const [key, color] of lines) {
      y = this.wrapped(t(key), 108, y, 502, 25, color, 39);
      y += 16;
    }

    // 时间窗示意条：跟在正文后面，绝不压字
    const legendY = Math.min(y + 10, 838);
    this.drawLegend(108, legendY, 502);

    this.text(t('howto.keyboard'), W / 2, legendY + 118, 18, 'rgba(220,208,186,0.6)', { strokeWidth: 4 });
    this.button({ x: W / 2 - 140, y: legendY + 140, w: 280, h: 72, label: t('howto.close'), accent: PALETTE.gold, action: () => this.onAction('close-howto'), id: 'close-howto' });
  }

  drawLegend(x, y, w) {
    const ctx = this.ctx;
    const parts = [
      { k: 0.29, color: '#e8b44a', label: '×3', name: t('hud.blind') },
      { k: 0.29, color: '#e0783c', label: '×2', name: t('hud.hint') },
      { k: 0.42, color: '#9fb4c8', label: '×1', name: t('hud.sure') },
    ];
    let cx = x;
    ctx.save();
    parts.forEach((p) => {
      const pw = w * p.k;
      ctx.fillStyle = p.color;
      ctx.fillRect(cx, y, pw - 4, 18);
      this.text(p.label, cx + (pw - 4) / 2, y + 48, 20, p.color, { strokeWidth: 4 });
      this.text(p.name, cx + (pw - 4) / 2, y + 72, 16, 'rgba(230,218,196,0.7)', { strokeWidth: 3 });
      cx += pw;
    });
    ctx.restore();
  }

  wrapped(str, x, y, maxW, size, color, lineH) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = font(size, 'bold');
    const chars = [...str];
    let line = '';
    let cy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        this.text(line, x, cy, size, color, { align: 'left', strokeWidth: 5 });
        cy += lineH;
        line = ch;
      } else line = test;
    }
    if (line) { this.text(line, x, cy, size, color, { align: 'left', strokeWidth: 5 }); cy += lineH; }
    ctx.restore();
    return cy;
  }

  /* ───────── 暂停 ───────── */

  drawPause(state) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(6,4,10,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    this.panel(88, 320, W - 176, 620);
    this.text(t('pause.title'), W / 2, 430, 64, PALETTE.gold, { strokeWidth: 10 });
    this.button({ x: 152, y: 480, w: 416, h: 92, label: t('pause.resume'), accent: PALETTE.gold, action: () => this.onAction('resume'), id: 'resume' });
    this.button({ x: 152, y: 596, w: 416, h: 84, label: t('pause.restart'), accent: PALETTE.fire, action: () => this.onAction('restart'), id: 'restart' });
    this.button({ x: 152, y: 700, w: 416, h: 84, label: t('pause.menu'), accent: PALETTE.cyan, action: () => this.onAction('menu'), id: 'toMenu' });
    this.chip({ x: 152, y: 812, w: 200, h: 56, label: state.sound ? t('menu.soundOn') : t('menu.soundOff'), active: state.sound, action: () => this.onAction('sound'), id: 'pause-sound' });
    this.chip({ x: 368, y: 812, w: 200, h: 56, label: state.lang === 'zh' ? 'EN' : '中文', active: false, action: () => this.onAction('lang'), id: 'pause-lang' });
  }

  /* ───────── 结算 ───────── */

  drawResult(run, stats, state) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(6,4,10,0.66)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const me = run.players[0];
    const foe = run.players[1];
    const win = run.winner === 0;
    const draw = run.winner === -1;
    const title = state.mode === 'duo'
      ? (draw ? t('result.draw') : run.winner === 0 ? t('result.p1win') : t('result.p2win'))
      : (draw ? t('result.draw') : win ? t('result.win') : t('result.lose'));

    this.text(title, W / 2, 268, 62, win ? PALETTE.gold : draw ? '#c9a8ff' : '#d98080', {
      strokeWidth: 12, gradient: win ? ['#ffeeb0', '#d08a2c'] : null,
    });
    this.text(stats.rank || '', W / 2, 320, 26, 'rgba(240,228,204,0.8)', { strokeWidth: 5 });

    this.panel(80, 360, W - 160, 460);
    const rows = [
      [t('result.logs'), String(me.logs), String(foe.logs)],
      [t('result.blind'), String(me.blind), String(foe.blind)],
      [t('result.first'), String(me.first), String(foe.first)],
      [t('result.best'), String(me.bestCombo), String(foe.bestCombo)],
    ];
    this.text(state.mode === 'duo' ? t('hud.p1') : t('hud.yours'), 250, 424, 22, PALETTE.red, { strokeWidth: 4 });
    this.text(state.mode === 'duo' ? t('hud.p2') : t('hud.cpu'), 470, 424, 22, PALETTE.cyan, { strokeWidth: 4 });

    rows.forEach(([label, a, b], i) => {
      const y = 486 + i * 68;
      this.text(label, W / 2, y, 24, 'rgba(236,224,200,0.8)', { strokeWidth: 5 });
      this.text(a, 250, y + 2, 36, PALETTE.paper, { strokeWidth: 6 });
      this.text(b, 470, y + 2, 36, PALETTE.paper, { strokeWidth: 6 });
    });

    if (stats.newBest) {
      this.text(t('result.newbest'), W / 2, 744, 24, PALETTE.gold, { strokeWidth: 5 });
    }

    if (stats.canRevive) {
      // 复活独占失败面板最高位：先给「续命」，再给「重开」
      this.button({
        x: 96, y: 846, w: 528, h: 92, label: t('result.revive'), sub: t('result.reviveSub'),
        accent: PALETTE.gold, action: () => this.onAction('revive'), id: 'revive',
      });
      this.button({ x: 96, y: 954, w: 252, h: 78, label: t('result.again'), accent: PALETTE.fire, action: () => this.onAction('restart'), id: 'again' });
      this.button({ x: 372, y: 954, w: 252, h: 78, label: t('result.menu'), accent: PALETTE.cyan, action: () => this.onAction('menu'), id: 'result-menu' });
    } else {
      this.button({ x: 120, y: 860, w: 480, h: 96, label: t('result.again'), accent: PALETTE.gold, action: () => this.onAction('restart'), id: 'again' });
      this.button({ x: 120, y: 976, w: 480, h: 80, label: t('result.menu'), accent: PALETTE.cyan, action: () => this.onAction('menu'), id: 'result-menu' });
    }
  }

  /* ───────── 交互 ───────── */

  hitTest(x, y) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  }

  setHover(x, y) {
    const h = this.hitTest(x, y);
    this.hover = h ? h.id : -1;
  }
}
