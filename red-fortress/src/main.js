// 赤色要塞 · 主入口 / 集成层（Lead 独占）
// 职责：60Hz 固定步长、屏幕状态机、输入、事件分发、存档、标准调试口。
import { WORLD, STEP, PLAYER } from '../config/game.config.js';
import { STAGES, STAGE_COUNT, stageAt } from '../config/levels.js';
import { UPGRADE_BY_ID } from '../config/upgrades.js';
import { createRun, emptyMods } from './game/sim.js';
import { initRenderer } from './render/index.js';
import { initUI } from './ui/index.js';
import { audio } from './core/audio.js';
import { i18n, t } from './core/i18n.js';
import { save } from './core/save.js';

const canvas = document.getElementById('canvas');
const frame = document.getElementById('frame');

const reduceMotion = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
})();

const R = initRenderer(canvas);

const app = {
  phase: 'title', // title|intro|playing|paused|upgrade|clear|dead|gameover|ending
  run: null,
  stageIndex: 0,
  lives: PLAYER.LIVES,
  baseScore: 0,
  mods: emptyMods(),
  difficulty: 'normal',
  stats: { rescued: 0, kills: 0, shots: 0 },
  pendingLast: false,
  clock: 0,
  lastClear: null,
  lastLowHp: -10,
};

let UI = null;
let acc = 0;
let last = 0;
let seqTimer = null;
let reducedMotion = reduceMotion;

const input = {
  keys: new Set(),
  mouse: { x: 640, y: 360, down: false, rdown: false, active: false },
  touch: null,
};

// ---------- 工具 ----------

function schedule(ms, fn) {
  cancelSeq();
  seqTimer = window.setTimeout(() => {
    seqTimer = null;
    fn();
  }, ms);
}

function cancelSeq() {
  if (seqTimer) {
    window.clearTimeout(seqTimer);
    seqTimer = null;
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function stageSeed(index) {
  return STAGES[clamp(index, 0, STAGE_COUNT - 1)].seed;
}

function makeRun(index) {
  return createRun({
    stageIndex: index,
    seed: stageSeed(index),
    difficulty: app.difficulty,
    lives: app.lives,
    mods: { ...app.mods },
  });
}

function mergedHud() {
  if (!app.run) return null;
  const hud = app.run.getHud();
  hud.score = app.baseScore + (typeof hud.score === 'number' ? hud.score : 0);
  hud.lives = app.lives;
  hud.stage = app.stageIndex;
  const st = stageAt(app.stageIndex);
  hud.stageNameKey = st.nameKey;
  return hud;
}

function aimPoint() {
  const run = app.run;
  if (input.touch && input.touch.active && run) {
    const p = run.player;
    const dx = input.touch.aimDX || 0;
    const dy = input.touch.aimDY || 0;
    if (dx === 0 && dy === 0) return { x: p.x, y: p.y - 400 };
    return { x: p.x + dx * 420, y: p.y + dy * 420 };
  }
  const rect = canvas.getBoundingClientRect();
  const sx = ((input.mouse.x - rect.left) / Math.max(1, rect.width)) * WORLD.W;
  const sy = ((input.mouse.y - rect.top) / Math.max(1, rect.height)) * WORLD.H;
  const camY = run ? run.cameraY : 0;
  if (!input.mouse.active && run) return { x: run.player.x, y: run.player.y - 400 };
  return { x: sx, y: sy + camY };
}

function buildInput() {
  const k = input.keys;
  let mx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
  let my = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
  let fire = input.mouse.down || k.has('KeyJ');
  let grenade = input.mouse.rdown || k.has('KeyK') || k.has('Space');
  const tstate = input.touch;
  if (tstate && tstate.active) {
    mx = tstate.mx || 0;
    my = tstate.my || 0;
    fire = fire || !!tstate.fire;
    grenade = grenade || !!tstate.grenade;
  }
  const aim = aimPoint();
  return { mx, my, aimX: aim.x, aimY: aim.y, fire, grenade };
}

// ---------- 流程 ----------

function showTitle() {
  cancelSeq();
  app.phase = 'title';
  app.run = null;
  app.baseScore = 0;
  app.stageIndex = 0;
  app.lives = PLAYER.LIVES;
  app.mods = emptyMods();
  app.stats = { rescued: 0, kills: 0, shots: 0 };
  UI.showScreen('title');
  audio.setScene('title');
}

function startRun(difficulty = app.difficulty) {
  cancelSeq();
  app.difficulty = difficulty === 'hard' && !save.get('cleared', false) ? 'normal' : difficulty;
  app.stageIndex = 0;
  app.lives = PLAYER.LIVES;
  app.baseScore = 0;
  app.mods = emptyMods();
  app.stats = { rescued: 0, kills: 0, shots: 0 };
  app.pendingLast = false;
  app.run = makeRun(0);
  save.set('runs', (save.get('runs', 0) || 0) + 1);
  showIntro();
}

function showIntro() {
  cancelSeq();
  const st = stageAt(app.stageIndex);
  app.phase = 'intro';
  acc = 0;
  audio.setScene(st.theme);
  audio.event({ type: 'stageStart' });
  UI.showScreen('intro', {
    stage: app.stageIndex + 1,
    total: STAGE_COUNT,
    nameKey: st.nameKey,
    descKey: st.descKey,
    radioKey: st.radioKey,
  });
  UI.setHud(mergedHud());
  schedule(2900, beginPlay);
}

function beginPlay() {
  cancelSeq();
  if (!app.run) return;
  app.phase = 'playing';
  acc = 0;
  last = performance.now();
  UI.showScreen('hud');
  UI.setHud(mergedHud());
}

function pause() {
  if (app.phase !== 'playing') return;
  app.phase = 'paused';
  UI.showScreen('paused');
  UI.setHud(mergedHud());
}

function resume() {
  if (app.phase !== 'paused') return;
  app.phase = 'playing';
  UI.showScreen('hud');
  last = performance.now();
  acc = 0;
}

function restartRun() {
  cancelSeq();
  startRun(app.difficulty);
}

function retryStage() {
  cancelSeq();
  app.run = makeRun(app.stageIndex);
  app.phase = 'playing';
  acc = 0;
  last = performance.now();
  audio.setScene(stageAt(app.stageIndex).theme);
  UI.showScreen('hud');
  UI.setHud(mergedHud());
}

function onPlayerDead() {
  if (app.phase !== 'playing') return;
  cancelSeq();
  app.phase = 'dead';
  app.lives = Math.max(0, app.lives - 1);
  R.shake(1);
  if (app.lives <= 0) {
    UI.showScreen('dead', { lives: 0, final: true });
    schedule(2400, showGameOver);
  } else {
    UI.showScreen('dead', { lives: app.lives });
  }
}

function showGameOver() {
  cancelSeq();
  app.phase = 'gameover';
  persistFinal(false);
  audio.setScene('gameover');
  UI.showScreen('gameover', {
    score: app.baseScore,
    best: save.get('bestScore', 0),
    rescued: app.stats.rescued,
  });
}

function onStageClear() {
  if (app.phase !== 'playing') return;
  cancelSeq();
  app.phase = 'clear';

  const hud = mergedHud();
  const stageTime = hud.time || 0;
  const timeBonus = Math.max(0, Math.round((150 - stageTime) * 10));
  const clearBonus = 1000;
  app.baseScore = (hud.score || 0) + clearBonus + timeBonus;
  app.lastClear = { timeBonus, clearBonus, time: stageTime };

  const delivered = (app.run && app.run.stats.delivered) || 0;
  app.stats.rescued += delivered;
  app.stats.kills += (app.run && app.run.stats.kills) || 0;
  app.stats.shots += (app.run && app.run.stats.shots) || 0;
  save.patch({
    bestScore: Math.max(save.get('bestScore', 0), app.baseScore),
    bestStage: Math.max(save.get('bestStage', 0), app.stageIndex + 1),
    totalRescued: (save.get('totalRescued', 0) || 0) + delivered,
  });

  const last = app.stageIndex >= STAGE_COUNT - 1;
  app.pendingLast = last;
  audio.setScene('clear');
  UI.showScreen('clear', {
    stage: app.stageIndex + 1,
    last,
    time: stageTime,
    timeBonus,
    clearBonus,
    score: app.baseScore,
    delivered,
  });
  schedule(last ? 3200 : 2500, continueAfterClear);
}

function continueAfterClear() {
  if (app.phase !== 'clear') return;
  cancelSeq();
  if (app.pendingLast) {
    showEnding();
    return;
  }
  showUpgrade();
}

function showUpgrade() {
  if (!app.run) return;
  app.phase = 'upgrade';
  const ids = app.run.getUpgradeChoices(3);
  UI.showScreen('upgrade', {
    choices: ids.map((id) => UPGRADE_BY_ID[id]).filter(Boolean),
  });
}

function pickUpgrade(id) {
  if (app.phase !== 'upgrade' || !app.run) return;
  app.run.applyUpgrade(id);
  app.mods = { ...app.run.mods };
  app.stageIndex += 1;
  if (app.stageIndex >= STAGE_COUNT) {
    showEnding();
    return;
  }
  app.run = makeRun(app.stageIndex);
  showIntro();
}

function showEnding() {
  cancelSeq();
  app.phase = 'ending';
  persistFinal(true);
  audio.setScene('ending');
  UI.showScreen('ending', {
    score: app.baseScore,
    best: save.get('bestScore', 0),
    rescued: app.stats.rescued,
    kills: app.stats.kills,
    time: app.lastClear ? app.lastClear.time : 0,
  });
}

function persistFinal(cleared) {
  const bestScore = Math.max(save.get('bestScore', 0), app.baseScore);
  const patch = {
    bestScore,
    bestStage: Math.max(save.get('bestStage', 0), app.stageIndex + (cleared ? 1 : 0)),
    totalRescued: save.get('totalRescued', 0) || 0,
  };
  if (cleared) patch.cleared = true;
  save.patch(patch);
}

// ---------- 事件 ----------

function handleEvent(ev) {
  R.fx(ev);
  audio.event(ev);
  switch (ev.type) {
    case 'powPickup':
      UI.toast(t('toastPow'), 'good');
      break;
    case 'deliver':
      UI.toast(t('toastDeliver', { n: ev.count || 1 }), 'good');
      break;
    case 'deliverMilestone':
      if (ev.kind === 'rate') UI.toast(t('toastRate'), 'good');
      else UI.toast(t('toastAirstrike'), 'good');
      break;
    case 'airstrike':
      UI.toast(t('toastAirstrikeIncoming'), 'warn');
      break;
    case 'resupply':
      UI.toast(t('toastResupply'), 'good');
      break;
    case 'bossAwake':
      UI.toast(t('toastBoss'), 'bad');
      break;
    case 'bossNodeDown':
      UI.toast(t('toastBossNode', { n: ev.left }), 'bad');
      break;
    case 'bossDead':
      UI.toast(t('toastBossDead'), 'good');
      break;
    case 'powDown':
      UI.toast(t('toastPowDown'), 'warn');
      break;
    case 'playerHit':
      if (ev.hp <= 2 && app.clock - app.lastLowHp > 3) {
        app.lastLowHp = app.clock;
        UI.toast(t('toastLowHp'), 'bad');
      }
      break;
    case 'shock':
      R.shake(ev.power || 0.4);
      break;
    case 'stageClear':
      onStageClear();
      break;
    case 'playerDead':
      onPlayerDead();
      break;
    default:
      break;
  }
}

function stepOnce() {
  if (!app.run) return;
  app.run.step(buildInput());
  const events = app.run.drainEvents();
  for (const ev of events) handleEvent(ev);
  if (app.phase === 'playing') {
    UI.setHud(mergedHud());
    if (app.run.state === 'dead') onPlayerDead();
    else if (app.run.state === 'clear' || app.run.state === 'won') onStageClear();
  }
}

// ---------- 输入 ----------

const MOVE_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS',
]);

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (MOVE_KEYS.has(e.code) || e.code === 'Space') e.preventDefault();

  if (!e.repeat) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (app.phase === 'playing') pause();
      else if (app.phase === 'paused') resume();
      return;
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (app.phase === 'title') startRun();
      else if (app.phase === 'intro') beginPlay();
      else if (app.phase === 'clear') continueAfterClear();
      else if (app.phase === 'dead') {
        if (app.lives > 0) retryStage();
      } else if (app.phase === 'gameover' || app.phase === 'ending') showTitle();
      return;
    }
    if (app.phase === 'upgrade') {
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
      if (n != null) {
        const ids = app.run.getUpgradeChoices(3);
        if (ids[n]) pickUpgrade(ids[n]);
        return;
      }
    }
  }
  input.keys.add(e.code);
});

window.addEventListener('keyup', (e) => {
  input.keys.delete(e.code);
});

canvas.addEventListener('mousemove', (e) => {
  input.mouse.x = e.clientX;
  input.mouse.y = e.clientY;
  input.mouse.active = true;
});

canvas.addEventListener('mousedown', (e) => {
  audio.unlock();
  input.mouse.active = true;
  if (e.button === 0) input.mouse.down = true;
  if (e.button === 2) input.mouse.rdown = true;
  if (app.phase === 'playing') e.preventDefault();
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.mouse.down = false;
  if (e.button === 2) input.mouse.rdown = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('pointerdown', () => audio.unlock(), { passive: true });

window.addEventListener('blur', () => {
  input.keys.clear();
  input.mouse.down = false;
  input.mouse.rdown = false;
  pause();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    input.keys.clear();
    pause();
  } else {
    last = performance.now();
    acc = 0;
  }
});

// ---------- 设置 ----------

function applySettings() {
  const s = save.settings();
  audio.setVolumes({ music: Number(s.music), sfx: Number(s.sfx) });
  audio.setMuted(!!s.muted);
  R.setQuality(s.quality === 'low' ? 'low' : 'high');
  reducedMotion = reduceMotion || !s.shake;
  R.setReducedMotion(reducedMotion);
}

function onSettingChange(key, value) {
  save.setSetting(key, value);
  applySettings();
}

function onLangChange(lang) {
  i18n.setLang(lang);
  document.documentElement.lang = i18n.lang === 'zh' ? 'zh' : 'en';
  if (UI) UI.setLang(i18n.lang);
}

// ---------- 帧循环 ----------

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  app.clock += dt;

  if (app.phase === 'playing' && app.run) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      stepOnce();
      acc -= STEP;
      steps += 1;
      if (app.phase !== 'playing') break;
    }
    if (steps >= 5) acc = 0;
  } else {
    acc = 0;
  }

  R.draw({
    run: app.run,
    phase: app.phase,
    t: app.clock,
    dt,
    quality: save.settings().quality,
    reducedMotion,
  });
}

// ---------- 启动 ----------

function fit() {
  const w = frame.clientWidth || 1280;
  frame.style.setProperty('--u', String(w / WORLD.W));
}

function isTouchDevice() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

function boot() {
  UI = initUI({
    onStart: (difficulty) => startRun(difficulty),
    onResume: resume,
    onRestart: restartRun,
    onQuit: showTitle,
    onRetry: retryStage,
    onNextStage: continueAfterClear,
    onUpgradePick: pickUpgrade,
    onSettingChange,
    onLangChange,
    onPause: pause,
    onTouch: (state) => {
      input.touch = state;
    },
    isTouch: isTouchDevice(),
  });

  UI.setLang(i18n.lang);
  document.documentElement.lang = i18n.lang === 'zh' ? 'zh' : 'en';
  UI.setTouchMode(isTouchDevice());
  applySettings();

  fit();
  window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(frame);

  document.documentElement.classList.toggle('is-touch', isTouchDevice());
  showTitle();
  last = performance.now();
  requestAnimationFrame(tick);

  // 标准调试口
  window.G = { Game: app, UI, Render: R, Audio: audio, Save: save, input };

  window.__ll = {
    get state() {
      const hud = app.run ? app.run.getHud() : null;
      return {
        phase: app.phase,
        stage: app.stageIndex,
        lives: app.lives,
        score: app.baseScore + (hud ? hud.score : 0),
        hp: app.run ? app.run.player.hp : 0,
        pow: app.run ? app.run.player.pow : 0,
        delivered: app.run ? app.run.stats.delivered : 0,
        kills: app.run ? app.run.stats.kills : 0,
        boss: app.run && app.run.boss ? { hp: app.run.boss.hp, maxHp: app.run.boss.maxHp, active: app.run.boss.active } : null,
        difficulty: app.difficulty,
      };
    },
    get run() {
      return app.run;
    },
    start() {
      startRun();
    },
    pause,
    resume,
    restart() {
      showTitle();
    },
    startStage(i) {
      cancelSeq();
      app.stageIndex = clamp(i | 0, 0, STAGE_COUNT - 1);
      app.lives = Math.max(1, app.lives);
      app.run = makeRun(app.stageIndex);
      app.phase = 'playing';
      acc = 0;
      last = performance.now();
      audio.setScene(stageAt(app.stageIndex).theme);
      UI.showScreen('hud');
      UI.setHud(mergedHud());
    },
    demo: {
      upgrade() {
        if (!app.run) {
          app.run = makeRun(0);
          app.stageIndex = 0;
        }
        app.phase = 'upgrade';
        const ids = app.run.getUpgradeChoices(3);
        UI.showScreen('upgrade', { choices: ids.map((id) => UPGRADE_BY_ID[id]).filter(Boolean) });
      },
      dead() {
        if (!app.run) {
          app.run = makeRun(0);
          app.stageIndex = 0;
        }
        app.lives = Math.max(1, app.lives - 1);
        app.phase = 'dead';
        UI.showScreen('dead', { lives: app.lives });
      },
      gameover() {
        app.phase = 'gameover';
        UI.showScreen('gameover', { score: 12340, best: Math.max(12340, save.get('bestScore', 0)), rescued: 27 });
      },
      ending() {
        app.baseScore = 24680;
        app.stats.rescued = 41;
        app.stats.kills = 213;
        app.phase = 'ending';
        UI.showScreen('ending', {
          score: 24680,
          best: Math.max(24680, save.get('bestScore', 0)),
          rescued: 41,
          kills: 213,
          time: 118,
        });
      },
      boss() {
        this.bossAt(3);
      },
      bossAt(i) {
        cancelSeq();
        app.stageIndex = clamp(i | 0, 0, STAGE_COUNT - 1);
        app.run = makeRun(app.stageIndex);
        app.phase = 'playing';
        if (app.run.debug && app.run.debug.teleport) app.run.debug.teleport(520);
        app.run.cameraY = 0;
        UI.showScreen('hud');
        acc = 0;
        last = performance.now();
      },
      airstrike() {
        if (!app.run) return;
        if (app.run.debug && app.run.debug.airstrike) app.run.debug.airstrike();
        else handleEvent({ type: 'airstrike', x: 640, y: 500 });
      },
      pow(n = 3) {
        if (app.run && app.run.debug) app.run.debug.spawnPow(n);
      },
      clear() {
        if (!app.run) return;
        app.run.state = 'clear';
        onStageClear();
      },
      damage(n = 20) {
        if (app.run && app.run.debug) app.run.debug.damageBoss(n);
      },
      hud() {
        return mergedHud();
      },
    },
    save: () => save,
    ui: () => UI,
    audio: () => audio,
    render: () => R,
  };
}

boot();
