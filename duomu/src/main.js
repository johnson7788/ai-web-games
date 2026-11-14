/**
 * 装配层：画布缩放、固定步长主循环、输入、屏幕状态机。
 *
 * 逻辑以 60Hz 固定步长推进（掉帧不改判定），渲染按真实帧率跑。
 * 所有玩家可见状态都通过 window.__ll 暴露一小块只读接口，供自动化验收用。
 */
import { WORLD, MATCH, PALETTE, ACTS, AI_LEVELS } from '../config/game.config.js';
import {
  createRun, startRun, step as stepRun, strike as strikeRun,
  pauseRun, resumeRun, reviveRun, drainEvents, getSnapshot, PHASE, SIDE,
} from './game/rules.js';
import { stepAi } from './game/ai.js';
import { loadAll } from './render/assets.js';
import { Scene, font, roundRect } from './render/scene.js';
import { UI } from './ui/screens.js';
import * as Save from './core/save.js';
import * as Audio from './core/audio.js';
import Sdk from './core/sdk.js';
import { initLang, setLang, getLang, t } from './core/i18n.js';

const STEP = 1000 / 60;
const W = WORLD.W;
const H = WORLD.H;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.scene = new Scene(this.ctx, 2);
    this.ui = new UI(this.ctx);
    this.ui.onAction = (name, arg) => this.action(name, arg);

    this.screen = 'loading';
    this.run = createRun({ mode: 'solo', aiLevel: 'veteran', seed: 1 });
    this.now = 0;
    this.lastTs = 0;
    this.acc = 0;
    this.mode = 'solo';
    this.aiLevel = 'veteran';
    this.sound = true;
    this.lang = 'zh';
    this.loadProgress = 0;
    this.resultStats = null;
    this.toasts = [];
    this.dpr = 1;

    this.bindEvents();
    this.resize();
    this.boot();
  }

  async boot() {
    // 语言：?lang= > 本地记忆 > 默认英文
    this.lang = initLang();

    // 门户 SDK：失败/超时都只是降级，绝不阻塞开局
    Sdk.ready().catch(() => null);
    Sdk.track('load', { game: 'duomu' });

    const saved = Save.load();
    this.sound = saved.sound;
    this.aiLevel = saved.aiLevel;
    Audio.setEnabled(this.sound);

    await loadAll((p) => { this.loadProgress = p; });
    this.screen = 'menu';
    this.render();
    // 主循环
    requestAnimationFrame((ts) => this.frame(ts));
  }

  /* ───────── 缩放 ───────── */

  resize() {
    const vw = window.innerWidth;
    const prevDpr = this.dpr;
    const vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / H);
    const cssW = Math.floor(W * scale);
    const cssH = Math.floor(H * scale);
    this.dpr = Math.min(1.75, Math.max(1, window.devicePixelRatio || 1));
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    if (prevDpr !== undefined && prevDpr !== this.dpr && this.scene) {
      this.scene.dpr = this.dpr;
      this.scene.cache = Object.create(null);
    }
  }

  toWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * W,
      y: ((clientY - r.top) / r.height) * H,
    };
  }

  /* ───────── 输入 ───────── */

  bindEvents() {
    window.addEventListener('resize', () => { this.resize(); this.render(); });
    window.addEventListener('orientationchange', () => setTimeout(() => { this.resize(); this.render(); }, 120));

    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Audio.unlock();
      Audio.init();
      const { x, y } = this.toWorld(e.clientX, e.clientY);
      this.tap(x, y);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.screen !== 'menu' && this.screen !== 'howto' && this.screen !== 'pause' && this.screen !== 'result') return;
      const { x, y } = this.toWorld(e.clientX, e.clientY);
      const before = this.ui.hover;
      this.ui.setHover(x, y);
      if (before !== this.ui.hover) this.render();
    });

    window.addEventListener('keydown', (e) => {
      Audio.unlock();
      Audio.init();
      if (e.repeat) return;
      this.key(e);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.screen === 'playing') this.doPause();
    });
  }

  tap(x, y) {
    if (this.screen === 'playing') {
      if (this.mode === 'duo') {
        // 只认底部的操作盘
        const hit = this.ui.hitTest(x, y);
        if (hit?.chop) this.chop(hit.chop.player, hit.chop.side);
        return;
      }
      // 单人：左右半屏都能砍
      this.chop(0, x < W / 2 ? SIDE.L : SIDE.R);
      return;
    }
    const hit = this.ui.hitTest(x, y);
    if (hit) {
      Audio.play('ui');
      hit.action();
    }
  }

  key(e) {
    const k = e.key.toLowerCase();
    if (this.screen === 'menu') {
      if (e.key === 'Enter' || e.key === ' ') this.action('solo');
      return;
    }
    if (this.screen === 'howto') {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') this.action('close-howto');
      return;
    }
    if (this.screen === 'result') {
      if (e.key === 'Enter' || e.key === ' ') this.action('restart');
      if (e.key === 'Escape') this.action('menu');
      return;
    }
    if (this.screen === 'pause') {
      if (k === 'p' || e.key === 'Escape') this.doResume();
      return;
    }
    if (this.screen === 'playing') {
      if (k === 'p' || e.key === 'Escape') { this.doPause(); return; }
      if (this.mode === 'solo') {
        if (e.key === 'ArrowLeft') this.chop(0, SIDE.L);
        else if (e.key === 'ArrowRight') this.chop(0, SIDE.R);
        else if (k === 'a') this.chop(0, SIDE.L);
        else if (k === 'd') this.chop(0, SIDE.R);
      } else {
        if (k === 'a') this.chop(0, SIDE.L);
        else if (k === 'd') this.chop(0, SIDE.R);
        else if (e.key === 'ArrowLeft') this.chop(1, SIDE.L);
        else if (e.key === 'ArrowRight') this.chop(1, SIDE.R);
      }
    }
  }

  chop(player, side) {
    if (this.screen !== 'playing' || this.run.phase !== PHASE.PLAYING) return;
    const res = strikeRun(this.run, player, side, this.now);
    if (res === 'ignored') return;
    this.drain();
    if (this.run.phase === PHASE.RESULT) { this.finishMatch(); return; }
    this.render();
  }

  /* ───────── 屏幕切换 ───────── */

  action(name, arg) {
    switch (name) {
      case 'solo':
        this.mode = 'solo';
        this.startMatch();
        break;
      case 'duo':
        this.mode = 'duo';
        this.startMatch();
        break;
      case 'difficulty':
        this.aiLevel = arg;
        Save.save({ aiLevel: arg });
        this.render();
        break;
      case 'howto':
        this.backTo = 'menu';
        this.screen = 'howto';
        this.render();
        break;
      case 'close-howto':
        this.screen = this.backTo || 'menu';
        this.render();
        break;
      case 'resume':
        this.doResume();
        break;
      case 'restart':
        this.startMatch();
        break;
      case 'revive':
        this.tryRevive();
        break;
      case 'menu':
        this.screen = 'menu';
        this.scene = new Scene(this.ctx);
        this.render();
        break;
      case 'sound':
        this.sound = !this.sound;
        Audio.setEnabled(this.sound);
        Save.save({ sound: this.sound });
        this.render();
        break;
      case 'lang':
        this.lang = this.lang === 'zh' ? 'en' : 'zh';
        setLang(this.lang);
        Save.save({ lang: this.lang });
        this.render();
        break;
      default:
        break;
    }
  }

  startMatch() {
    this.run = createRun({ mode: this.mode, aiLevel: this.aiLevel, seed: (Math.random() * 1e9) | 0 });
    startRun(this.run, this.now);
    this.revived = false;
    if (this.mode === 'solo') Sdk.newRun({ mode: this.mode, ai: this.aiLevel });
    drainEvents(this.run);
    this.scene = new Scene(this.ctx, this.dpr);
    this.screen = 'playing';
    this.resultStats = null;
    this.hudTimer = 0;
    this.render();
  }

  /** 激励视频复活：只有广告回调 === true 才发奖 */
  async tryRevive() {
    if (this.screen !== 'result' || !this.resultStats?.canRevive) return;
    const ok = await Sdk.showRewarded('revive', { logs: this.run.players[0].logs });
    if (!ok) {
      Sdk.track('revive_declined', {});
      this.resultStats = { ...this.resultStats, canRevive: false };
      this.render();
      return;
    }
    if (!reviveRun(this.run, this.now, 2)) {
      this.render();
      return;
    }
    this.revived = true;
    Save.save({ revives: (Save.load().revives || 0) + 1 });
    Sdk.track('revive_used', { logs: this.run.players[0].logs });
    this.scene = new Scene(this.ctx, this.dpr);
    this.screen = 'playing';
    Audio.unlock();
    this.render();
  }

  doPause() {
    if (this.screen !== 'playing') return;
    pauseRun(this.run);
    this.screen = 'pause';
    this.render();
  }

  doResume() {
    if (this.screen !== 'pause') return;
    resumeRun(this.run, this.now);
    this.screen = 'playing';
    this.render();
  }

  /* ───────── 主循环 ───────── */

  frame(ts) {
    if (!this.lastTs) this.lastTs = ts;
    let dt = ts - this.lastTs;
    this.lastTs = ts;
    if (dt > 100) dt = 100;

    this.acc += dt;
    let guard = 0;
    while (this.acc >= STEP && guard++ < 5) {
      this.acc -= STEP;
      this.update(STEP);
    }
    this.render();
    requestAnimationFrame((t2) => this.frame(t2));
  }

  update(dt) {
    this.now += dt;
    if (this.screen === 'playing') {
      if (this.run.phase === PHASE.PLAYING) {
        stepRun(this.run, this.now);
        if (this.mode === 'solo') stepAi(this.run, this.now);
        this.drain();
      }
      // 判定可能在 step / 玩家出手 / AI 出手里任何一处结束，统一在这里收口
      if (this.run.phase === PHASE.RESULT) this.finishMatch();
    }
    this.scene.update(dt, this.run);
  }

  drain() {
    const events = drainEvents(this.run);
    if (!events.length) return;
    for (const e of events) {
      if (e.type === 'chop') Audio.play('chop', e.tier, e.first);
      else if (e.type === 'zap') Audio.play('zap');
      else if (e.type === 'smite') Audio.play('smite');
      else if (e.type === 'hint') Audio.play('hint');
      else if (e.type === 'reveal') Audio.play('reveal');
      else if (e.type === 'escape') Audio.play('escape');
      else if (e.type === 'pass') Audio.play('pass');
      else if (e.type === 'act' || e.type === 'sudden') Audio.play('act');
    }
    this.scene.onEvents(events, this.run);
  }

  finishMatch() {
    const me = this.run.players[0];
    const foe = this.run.players[1];
    const won = this.run.winner === 0;
    const before = Save.load().bestLogs;
    Save.recordMatch({ logs: me.logs, combo: me.bestCombo, won });
    const logs = me.logs;
    const rankKey = logs >= 24 ? 'rank.legend' : logs >= 16 ? 'rank.strong' : logs >= 8 ? 'rank.ok' : 'rank.weak';
    this.resultStats = {
      rank: t(rankKey),
      newBest: logs > before,
      // 只有「血被劈光」才给复活；对手已经到目标木数就没意义
      canRevive: !won && Sdk.canShowAd('revive') && this.run.players[1].logs < MATCH.targetLogs,
    };
    if (won) Sdk.levelCleared({ logs, combo: me.bestCombo });
    else Sdk.gameOver({ logs, combo: me.bestCombo, revived: this.revived });
    this.screen = 'result';
    // 结算页别留着上一刀的飘字和粒子
    this.scene.floaters.length = 0;
    this.scene.particles.length = 0;
    this.scene.bolts.length = 0;
    Audio.play(won ? 'win' : 'lose');
  }

  /* ───────── 渲染 ───────── */

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.ui.resetHits();

    if (this.screen === 'loading') {
      ctx.fillStyle = '#0b0910';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.font = font(28);
      ctx.fillStyle = 'rgba(240,228,204,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(t('common.loading'), W / 2, H / 2);
      roundRect(ctx, W / 2 - 150, H / 2 + 30, 300, 10, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
      roundRect(ctx, W / 2 - 150, H / 2 + 30, 300 * this.loadProgress, 10, 5);
      ctx.fillStyle = PALETTE.gold;
      ctx.fill();
      ctx.restore();
      return;
    }

    const inGame = this.screen === 'playing' || this.screen === 'pause' || this.screen === 'result';
    if (inGame) {
      this.scene.drawFrame(this.run, this.run.actIndex, this.now, true);
    } else {
      // 菜单 / 说明页只留背景，别让树干跟按钮抢戏
      this.scene.drawBackdropOnly(0);
    }

    if (this.screen === 'playing' || this.screen === 'pause' || this.screen === 'result') {
      this.ui.drawHud(this.run, this.mode, this.now);
      this.ui.drawControls(this.mode, this.run, this.now);
    }

    if (this.screen === 'menu') {
      this.ui.drawMenu({
        aiLevel: this.aiLevel, bestLogs: Save.load().bestLogs,
        sound: this.sound, lang: this.lang,
      });
    } else if (this.screen === 'howto') {
      this.ui.drawHowto();
    } else if (this.screen === 'pause') {
      this.ui.drawPause({ sound: this.sound, lang: this.lang });
    } else if (this.screen === 'result') {
      this.ui.drawResult(this.run, this.resultStats || {}, { mode: this.mode });
    }
  }
}

/* ───────── 自动化验收用的只读调试口 ───────── */
window.__ll = {
  get state() {
    return {
      screen: window.__game.screen,
      mode: window.__game.mode,
      aiLevel: window.__game.aiLevel,
      now: Math.round(window.__game.now),
      phase: window.__game.run.phase,
      snap: getSnapshot(window.__game.run),
    };
  },
  start(mode = 'solo', aiLevel = 'novice') {
    const g = window.__game;
    g.mode = mode;
    g.aiLevel = aiLevel;
    g.startMatch();
    return this.state;
  },
  strike(player, side) { window.__game.chop(player, side); return this.state; },
  pause() { window.__game.doPause(); return this.state; },
  resume() { window.__game.doResume(); return this.state; },
  menu() { window.__game.action('menu'); return this.state; },
  howto() { window.__game.action('howto'); return this.state; },
  lang(l) { setLang(l); window.__game.lang = l; window.__game.render(); return { lang: getLang() }; },
  forceSeg(brand) {
    const g = window.__game;
    const seg = g.run.segs[0];
    if (!seg) return this.state;
    seg.brand = brand;
    seg.state = brand === 'HIDDEN' ? 'hint' : 'revealed';
    if (brand === 'HIDDEN') seg.hint = 'L';
    seg.revealedAt = g.now;
    g.scene.flash = 0;
    g.scene.shake = 0;
    g.scene.bolts.length = 0;
    g.scene.floaters.length = 0;
    g.render();
    return this.state;
  },
  advance(ms) {
    // 快进：按固定步长推进 N 毫秒，跳过渲染
    const g = window.__game;
    const steps = Math.floor(ms / STEP);
    for (let i = 0; i < steps; i++) g.update(STEP);
    g.render();
    return this.state;
  },
};

window.__game = new Game();
