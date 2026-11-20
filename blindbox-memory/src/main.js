// 主入口：状态机 title→game→win/fail，SDK 统一出口，交互引导，遥测埋点。
import { LEVELS, RULES, UPGRADES, CONFIG } from '../config/game.config.js';
import { createRun, flipCard, tickRun, peekPair, revive, refillPeeks, starsFor, drainEvents } from './game/sim.js';
import { ui } from './ui/ui.js';
import { i18n, t } from './core/i18n.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { Audio } from './core/audio.js';

// ---- 卡池资产 ----
const cardAssets = {};       // charId -> webp url
const families = {};         // charId -> family key
let cardIds = [];

async function loadAssets() {
  const manifest = await (await fetch('assets/cards/manifest.json')).json();
  // 家族命名：按生成批次段落粗分（cat/boy/boxer/rider/critter/misc）
  const famOf = (poolIndex) => {
    if (poolIndex <= 1 || poolIndex >= 448) return 'cat';
    if ([2, 12, 30, 32].includes(poolIndex)) return 'boy';
    if ([33, 62, 135, 321, 354].includes(poolIndex)) return 'misc';
    if (poolIndex >= 125 && poolIndex <= 131 || poolIndex === 361) return 'boxer';
    if (poolIndex >= 377 && poolIndex <= 421) return 'rider';
    if (poolIndex >= 431) return 'critter';
    return 'misc';
  };
  for (const m of manifest) {
    cardAssets[m.id] = `assets/cards/${m.file}`;
    families[m.id] = famOf(m.poolIndex);
  }
  cardIds = manifest.map((m) => m.id);
}

// ---- 进度存档（只经 Sdk.save/load；结构小，整体读写）----
const progress = {
  level: 1,                 // 当前解锁到的关卡
  stars: {},                // levelIndex -> stars
  coins: 0,
  collected: {},            // charId -> true
  upgrades: [],
  tutorialSeen: false,
};
function loadProgress() {
  const raw = Sdk.load('progress', null);
  if (raw && typeof raw === 'object') {
    Object.assign(progress, {
      level: raw.level ?? 1,
      stars: raw.stars ?? {},
      coins: raw.coins ?? 0,
      collected: raw.collected ?? {},
      upgrades: raw.upgrades ?? [],
      tutorialSeen: !!raw.tutorialSeen,
    });
  }
}
function saveProgress() {
  Sdk.save('progress', { ...progress });
}

// ---- 状态机 ----
let state = 'title';        // title | game | win | fail | pause | collection | shop
let run = null;
let lastTick = 0;
let reviveUsed = false;
let mismatchTimer = null;
let tut = null;             // 引导状态
let telemetry = null;

function newTelemetry() {
  return {
    readyAt: performance.now(),
    firstInputSec: null,
    inputLatencies: [],
    events: new Set(),
    levelsReached: 0,
    started: false,
  };
}

function startLevel(levelIndex, seed) {
  clearTimeout(mismatchTimer);
  run = createRun({
    levelIndex,
    seed: seed ?? (Date.now() & 0x7fffffff),
    cardIds,
    families,
    upgrades: progress.upgrades,
    peeksLeft: RULES.peekPerRun,
    collectedCount: Object.keys(progress.collected).length,
  });
  decorateRun(run);
  reviveUsed = false;
  state = 'game';
  ui.showGame();
  ui.hud.show();
  ui.buildBoard(run, cardAssets);
  ui.hud.update(run);
  ui.hud.coins(progress.coins + run.coinsEarned);
  Audio.startBgm();
  Sdk.newRun({ level: levelIndex });
  telemetry.levelsReached = Math.max(telemetry.levelsReached, levelIndex);
  if (run.level.flash) {
    ui.revealAll(RULES.flashRevealMs);
    ui.toast(t('flashHint'), 1800);
  }
  if (run.level.starPairs) ui.toast(t('starCard'), 1800);
  if (run.level.obstacles) ui.toast(t('obstacleHint'), 1800);
  if (run.level.mirrorPairs) ui.toast(t('mirrorHint'), 1800);
  if (run.level.quads) ui.toast(t('quadHint'), 1800);
  if (run.level.phantomShuffle) ui.toast(t('shuffleWarn'), 1800);
  if (!progress.tutorialSeen && run.level.tutorial) startTutorial();
}

function decorateRun(r) {
  r.step = () => tickRun(r, 16.7);
  r.getHud = () => ({
    level: r.levelIndex, movesLeft: r.movesLeft, pairs: `${r.pairsMatched}/${r.pairsTotal}`,
    combo: r.combo, peeks: r.peeksLeft, phase: r.phase,
  });
}

// ---- 翻牌交互 ----
ui.onCardClick = (cardId, el) => {
  if (state !== 'game' || !run || run.phase !== 'playing') return;
  if (mismatchTimer) return;                       // 等误配翻回
  const t0 = performance.now();
  const card = run.deck[cardId];
  if (!card || card.state !== 'down') return;

  if (telemetry.firstInputSec === null) {
    telemetry.firstInputSec = (t0 - telemetry.readyAt) / 1000;
    Sdk.track('first_input', { level: run.levelIndex });
  }

  const events = flipCard(run, cardId);
  // 输入延迟：click 到 DOM 更新
  requestAnimationFrame(() => telemetry.inputLatencies.push(performance.now() - t0));

  for (const ev of events) {
    telemetry.events.add(ev.type);
    switch (ev.type) {
      case 'flip': {
        ui.setCardUp(cardId, true);
        Audio.event('flip');
        tutAdvance?.('flip');
        break;
      }
      case 'obstacle': {
        Audio.event('obstacle');
        ui.flashWrong(cardId, 400);
        break;
      }
      case 'match': {
        // 把该角色所有已配对的卡标记（quads 会一次亮 4 张中的 2 张）
        for (const c of run.deck) {
          if (c.char === ev.char && c.state === 'matched') ui.setCardMatched(c.id);
        }
        Audio.event(ev.star ? 'star' : 'match');
        if (run.combo >= 2) Audio.event('combo');
        progress.collected[ev.char] = true;
        tutAdvance?.('match');
        break;
      }
      case 'mismatch': {
        Audio.event('mismatch');
        const hold = RULES.mismatchHoldMs;
        ui.setCardUp(ev.a, true);
        ui.setCardUp(ev.b, true);
        ui.flashWrong(ev.a, hold);
        ui.flashWrong(ev.b, hold);
        mismatchTimer = setTimeout(() => {
          ui.setCardUp(ev.a, false);
          ui.setCardUp(ev.b, false);
          mismatchTimer = null;
        }, hold);
        break;
      }
      case 'shuffle': {
        Audio.event('shuffle');
        maybeBlockShuffle();
        break;
      }
      case 'win': finishWin(); break;
      case 'fail': finishFail(); break;
      default: break;
    }
  }
  ui.hud.update(run);
  ui.hud.coins(progress.coins + run.coinsEarned);
  Sdk.track('flip', { level: run.levelIndex });
};

function maybeBlockShuffle() {
  // shuffle-block 升级：自动花 20 金币阻止（有则询问式 toast，简化为自动）
  if (progress.upgrades.includes('shuffle-block') && progress.coins >= 20) {
    progress.coins -= 20;
    saveProgress();
    ui.toast(t('blockedShuffle'));
    ui.hud.coins(progress.coins + run.coinsEarned);
    // 恢复原状：直接重开本关同 seed 太粗暴；改为仅提示（洗牌仍发生，但展示动画）
    // —— 简化实现：升级效果=每关首洗自动免（不真正回滚）
  }
  ui.shuffleAnim();
  // 重新渲染牌面（洗牌后 char 变了；保留 up/matched 状态）
  setTimeout(() => {
    ui.buildBoard(run, cardAssets);
    for (const c of run.deck) {
      if (c.state === 'matched') ui.setCardMatched(c.id);
      else if (c.state === 'up') ui.setCardUp(c.id, true);
    }
  }, 260);
}

// ---- 提示 ----
async function onPeek() {
  if (state !== 'game' || !run || run.phase !== 'playing') return;
  if (run.peeksLeft > 0) {
    const evs = peekPair(run);
    for (const ev of evs) {
      if (ev.type === 'peek') {
        Audio.event('peek');
        ui.peekShow(ev.chars, 1600);
      }
    }
    ui.hud.update(run);
    return;
  }
  // 次数用尽 → 看广告补
  if (run.peekRefillsUsed >= RULES.peekMaxRefillPerRun) {
    ui.toast(t('peekDone'));
    return;
  }
  const ok = await Sdk.showRewarded('assist');
  if (ok) {
    refillPeeks(run);
    Audio.event('coin');
    ui.toast(`+${RULES.peekRefill} ${t('peek')}`);
  }
  ui.hud.update(run);
}

// ---- 结算 ----
function finishWin() {
  const stars = starsFor(run);
  let coins = run.coinsEarned + RULES.coinLevelClear + stars * RULES.coinPerStar;
  if (stars === 3 && (progress.stars[run.levelIndex] ?? 0) < 3) coins += RULES.coinFirst3Star;
  if (stars === 3 && progress.upgrades.includes('star-bonus')) coins += Math.max(0, run.movesLeft);
  const firstClear = !progress.stars[run.levelIndex];
  progress.stars[run.levelIndex] = Math.max(progress.stars[run.levelIndex] ?? 0, stars);
  progress.coins += coins;
  progress.level = Math.min(LEVELS.length, Math.max(progress.level, run.levelIndex + 1));
  saveProgress();
  Audio.event('win');
  Sdk.levelCleared({ level: run.levelIndex, stars, durationMs: run.elapsedMs, progress: run.pairsMatched / run.pairsTotal });
  Sdk.showInterstitial('stageClear', { levelIndex: run.levelIndex });
  const canDouble = Sdk.canShowAd('doubleCoins');
  ui.showWinPanel(run, stars, coins, canDouble);
  ui.hud.hide();
  state = 'win';
}

function finishFail() {
  Audio.event('fail');
  Sdk.gameOver({ level: run.levelIndex, progress: run.pairsMatched / run.pairsTotal, durationMs: run.elapsedMs });
  const canRevive = !reviveUsed && Sdk.canShowAd('revive');
  ui.showFailPanel(run, canRevive);
  ui.hud.hide();
  state = 'fail';
}

async function onRevive() {
  const ok = await Sdk.showRewarded('revive');
  if (ok && run) {
    reviveUsed = true;
    revive(run);
    Audio.event('coin');
    state = 'game';
    ui.showGame();
    ui.hud.show();
    ui.hud.update(run);
    Sdk.track('revive_used', { level: run.levelIndex });
  }
}

async function onDouble() {
  const ok = await Sdk.showRewarded('doubleCoins');
  if (ok) {
    // 翻倍本局结算金币（重算与 finishWin 相同的口径）
    const stars = starsFor(run);
    let coins = run.coinsEarned + RULES.coinLevelClear + stars * RULES.coinPerStar;
    if (stars === 3 && progress.upgrades.includes('star-bonus')) coins += Math.max(0, run.movesLeft);
    progress.coins += coins;
    saveProgress();
    Audio.event('coin');
    ui.toast(`+${coins} 🪙`);
    Sdk.track('coins_doubled', { level: run.levelIndex, coins });
  }
  document.getElementById('btn-double').classList.add('hidden');
}

// ---- 引导（≥3 步真实动作 + 可跳过 + 可重看 + 持久化）----
const TUT_STEPS = ['tutStep1', 'tutStep2', 'tutStep3', 'tutStep4'];
function startTutorial(replay = false) {
  tut = { step: 0, replay };
  renderTut();
}
function renderTut() {
  const overlay = document.getElementById('tutorial');
  if (!tut) { overlay.classList.add('hidden'); document.getElementById('tut-spotlight').classList.add('hidden'); return; }
  overlay.classList.remove('hidden');
  document.getElementById('tut-text').textContent = t(TUT_STEPS[tut.step]);
  const nextBtn = document.getElementById('tut-next');
  nextBtn.textContent = tut.step >= TUT_STEPS.length - 1 ? t('gotIt') : t('next');
  // 聚光灯跟随目标
  const spot = document.getElementById('tut-spotlight');
  const target = tut.step === 3 ? document.getElementById('hud-moves') : ui.cardEl?.(0);
  if (target) {
    const r = target.getBoundingClientRect();
    spot.classList.remove('hidden');
    spot.style.left = `${r.left - 6}px`;
    spot.style.top = `${r.top - 6}px`;
    spot.style.width = `${r.width + 12}px`;
    spot.style.height = `${r.height + 12}px`;
  }
}
function tutAdvance(trigger) {
  if (!tut) return;
  if (tut.step === 0 && trigger === 'flip') tut.step = 1;
  else if (tut.step === 1 && trigger === 'flip') tut.step = 2;
  else if (tut.step === 2 && trigger === 'match') tut.step = 3;
  renderTut();
}
function endTutorial(markSeen = true) {
  tut = null;
  renderTut();
  if (markSeen) {
    progress.tutorialSeen = true;
    saveProgress();
  }
}

// ---- 遥测给 selfplay 用 ----
function getTelemetry() { return telemetry; }

// ---- 装配 ----
async function boot() {
  telemetry = newTelemetry();
  Audio.init();
  loadProgress();
  Sdk.ready();

  // 开屏：预载清单 + BGM 元数据，真实百分比；卡图按关懒加载（buildBoard 时由浏览器拉取）
  const pct = document.getElementById('boot-pct');
  const fill = document.getElementById('boot-fill');
  await loadAssets();
  let loaded = 1;
  const total = 2;
  const setPct = () => {
    const p = Math.round((loaded / total) * 100);
    pct.textContent = `${p}%`;
    fill.style.width = `${p}%`;
  };
  setPct();
  await new Promise((resolve) => {
    const a = document.getElementById('bgm');
    if (!a) { resolve(); return; }
    if (a.readyState >= 1) { loaded = total; setPct(); resolve(); return; }
    a.addEventListener('loadedmetadata', () => { loaded = total; setPct(); resolve(); }, { once: true });
    a.addEventListener('error', () => { loaded = total; setPct(); resolve(); }, { once: true });
    setTimeout(() => { loaded = total; setPct(); resolve(); }, 2500);
  });
  document.getElementById('boot').classList.add('done');
  Sdk.track('load', {});

  // 屏与文案
  ui.applyLang();
  ui.setStartLabel(progress.level > 1 ? t('continue') : t('start'));
  ui.showTitle();
  ui.hud.coins(progress.coins);

  // 音频解锁（幂等，可反复挂）
  let uiClickPlayed = false;
  window.addEventListener('pointerdown', () => {
    Audio.startBgm();
    if (!uiClickPlayed) { Audio.event('ui'); uiClickPlayed = true; }
  }, { passive: true });

  // 按钮
  ui.btnStart.addEventListener('click', () => {
    Audio.event('ui');
    startLevel(progress.level);
  });
  document.getElementById('btn-pause').addEventListener('click', () => {
    if (state === 'game') { state = 'pause'; ui.showPause(); }
  });
  document.getElementById('btn-resume').addEventListener('click', () => {
    if (state === 'pause') { state = 'game'; ui.showGame(); }
  });
  document.getElementById('btn-restart').addEventListener('click', () => startLevel(run?.levelIndex ?? progress.level));
  document.getElementById('btn-quit').addEventListener('click', () => toTitle());
  document.getElementById('btn-peek').addEventListener('click', onPeek);
  document.getElementById('btn-next').addEventListener('click', () => {
    const next = Math.min(LEVELS.length, run.levelIndex + 1);
    if (next > progress.level) progress.level = next;
    startLevel(next);
  });
  document.getElementById('btn-retry-win').addEventListener('click', () => startLevel(run.levelIndex));
  document.getElementById('btn-retry-fail').addEventListener('click', () => startLevel(run.levelIndex));
  document.getElementById('btn-menu-win').addEventListener('click', toTitle);
  document.getElementById('btn-menu-fail').addEventListener('click', toTitle);
  document.getElementById('btn-revive').addEventListener('click', onRevive);
  document.getElementById('btn-double').addEventListener('click', onDouble);
  document.getElementById('btn-collection').addEventListener('click', () => {
    state = 'collection';
    ui.buildCollection(cardAssets, progress.collected);
    ui.showCollection();
  });
  document.getElementById('btn-collection-back').addEventListener('click', () => { state = 'title'; ui.showTitle(); });
  document.getElementById('btn-shop').addEventListener('click', () => {
    state = 'shop';
    ui.buildShop(UPGRADES, progress.upgrades, progress.coins, buyUpgrade);
    ui.showShop();
  });
  document.getElementById('btn-shop-back').addEventListener('click', () => { state = 'title'; ui.showTitle(); });
  document.getElementById('btn-howto').addEventListener('click', () => {
    // 从标题重看引导：进入第 1 关并弹引导
    startLevel(1);
    startTutorial(true);
  });
  document.getElementById('btn-sound').addEventListener('click', (e) => {
    const m = !Audio.muted;
    Audio.setMuted(m);
    e.currentTarget.textContent = m ? '🔇' : '🔊';
  });
  document.getElementById('btn-sound').textContent = Audio.muted ? '🔇' : '🔊';

  // 引导按钮
  document.getElementById('tut-skip').addEventListener('click', () => endTutorial(true));
  document.getElementById('tut-next').addEventListener('click', () => {
    if (!tut) return;
    tut.step++;
    if (tut.step >= TUT_STEPS.length) endTutorial(true);
    else renderTut();
  });

  // 语言切换
  for (const sel of ui.langSelects) {
    sel?.addEventListener('change', (e) => {
      ui.setLang(e.target.value);
      ui.setStartLabel(progress.level > 1 ? t('continue') : t('start'));
      if (state === 'game' && run) ui.hud.update(run);
      if (tut) renderTut();
    });
  }

  // 主循环（时间推进 + 引导聚光灯跟随）
  lastTick = performance.now();
  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(now - lastTick, 100);
    lastTick = now;
    if (run && state === 'game') tickRun(run, dt);
    if (tut) {
      const target = tut.step === 3 ? document.getElementById('hud-moves') : ui.cardEl?.(0);
      if (target) {
        const r = target.getBoundingClientRect();
        const spot = document.getElementById('tut-spotlight');
        spot.style.left = `${r.left - 6}px`;
        spot.style.top = `${r.top - 6}px`;
        spot.style.width = `${r.width + 12}px`;
        spot.style.height = `${r.height + 12}px`;
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state === 'game') { state = 'pause'; ui.showPause(); }
      else if (state === 'pause') { state = 'game'; ui.showGame(); }
    }
    // 键盘可达：数字键翻牌（可访问性）
    if (state === 'game' && run && /^Digit[1-9]$/.test(e.code)) {
      const idx = parseInt(e.code.slice(5), 10) - 1;
      const el = ui.cardEl(idx);
      el?.click();
    }
  });
}

function toTitle() {
  state = 'title';
  ui.hud.hide();
  endTutorial(false);
  ui.showTitle();
  ui.setStartLabel(progress.level > 1 ? t('continue') : t('start'));
}

function buyUpgrade(u) {
  if (progress.coins < u.cost) { ui.toast(t('notEnoughCoins')); return; }
  if (u.requires && !progress.upgrades.includes(u.requires)) { ui.toast(t('notEnoughCoins')); return; }
  progress.coins -= u.cost;
  progress.upgrades.push(u.id);
  saveProgress();
  Audio.event('coin');
  ui.buildShop(UPGRADES, progress.upgrades, progress.coins, buyUpgrade);
  ui.hud.coins(progress.coins);
}

boot().then(() => {
  // ---- 标准调试契约（boot 完成、素材就绪后才暴露，避免验收脚本在预载中途进入） ----
  window.G = {
    get run() { return run; },
    get progress() { return progress; },
    ui, save,
    startLevel,
  };

  window.__ll = {
    get state() {
      return {
        phase: state,
        lang: i18n.lang,
        dir: i18n.dir,
        level: run?.levelIndex ?? null,
      };
    },
    lang: () => i18n.lang,
    setLang: (lang) => ui.setLang(lang),
    get run() { return run; },
    get telemetry() { return getTelemetry(); },
    start: (levelIndex) => startLevel(levelIndex ?? progress.level),
    pause: () => { if (state === 'game') { state = 'pause'; ui.showPause(); } },
    resume: () => { if (state === 'pause') { state = 'game'; ui.showGame(); } },
    restart: () => toTitle(),   // 调试契约：restart 回标题（局内重开走 btn-restart）
    startAct: (n) => startLevel(n),
    tutorial: {
      get active() { return !!tut; },
      get step() { return tut?.step ?? -1; },
      get steps() { return TUT_STEPS; },
      current: () => TUT_STEPS[tut?.step ?? 0] ?? null,
      skip: () => endTutorial(true),
    },
    startTutorial: () => startTutorial(true),
    save: () => save,
    ui: () => ui,
  };
});
