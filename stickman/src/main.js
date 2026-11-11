// LAST LINE —— 装配层：主循环、流程状态机、输入、事件分发。
// 只做「接线」，不写玩法数值、不写绘制细节。
import { CONFIG, STEP, WORLD } from '../config/game.config.js';
import { MAPS, MAP_ORDER } from '../config/maps.js';
import { WEAPONS, WEAPON_ORDER } from '../config/weapons.js';
import { t, getLang, setLang, applyI18n } from './core/i18n.js';
import * as Save from './core/save.js';
import Audio from './core/audio.js';
import Render from './render/index.js';
import UI from './ui/ui.js';
import { createRun } from './game/sim.js';

const canvas = document.getElementById('game');
const fadeEl = document.getElementById('fade');

const state = {
  phase: 'boot',          // boot|title|story|act|playing|upgrade|actclear|dead|ending|gallery|settings
  paused: false,
  run: null,
  acc: 0,
  last: 0,
  time: 0,
  overlayReturn: 'title',
  tutorialShown: {},
  hintTimer: 0,
  lastHudAt: 0,
  runStartTime: 0,
  endingChoice: null,
};

const input = {
  mx: 0, aim: { x: 0, y: 0 },
  jump: false, jumpPressed: false,
  fire: false,
  dashPressed: false, meleePressed: false, reloadPressed: false,
  weapon: null,
};

const keys = new Set();
const pointer = { x: 0, y: 0, inside: false, down: false };
let touchAim = { x: 0, y: 0 };
let joystick = null;

// ───────────────────────────────────────────── 工具
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function fade(on, ms = 320) {
  if (!fadeEl) return Promise.resolve();
  fadeEl.style.transitionDuration = `${ms}ms`;
  fadeEl.classList.toggle('on', on);
  return sleep(ms);
}
function isTouch() {
  return (navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer: coarse)').matches;
}
function worldAimFromPointer() {
  if (isTouch()) return touchAim;
  const p = Render.screenToWorld ? Render.screenToWorld(pointer.x, pointer.y) : { x: pointer.x, y: pointer.y };
  return p;
}
function autoAim() {
  const run = state.run;
  if (!run) return { x: WORLD.w / 2, y: WORLD.groundY - 200 };
  let best = null;
  let bestD = Infinity;
  for (const e of run.sim.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - run.sim.player.x, e.y - run.sim.player.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  if (!best) return { x: run.sim.player.x + (run.sim.player.facing || 1) * 300, y: run.sim.player.y - 40 };
  const head = best.body?.pts?.[0];
  return { x: head ? head.x : best.x, y: head ? head.y : best.y - 40 };
}

// ───────────────────────────────────────────── 音频 / 渲染 初始化
let audioReady = false;
function ensureAudio() {
  if (audioReady) return;
  audioReady = true;
  try {
    Audio.init();
    audioReady = true;
  } catch (error) {
    console.warn('[audio] init failed', error);
  }
}

function applySettings(settings) {
  Audio.setVolumes?.({ music: settings.music / 100, sfx: settings.sfx / 100 });
  Render.setQuality?.(settings.quality);
  Render.setShakeScale?.(settings.shake ? 1 : 0);
}

// ───────────────────────────────────────────── 局流程
function newRun(fromAct = 0) {
  const save = Save.load();
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e6)) >>> 0;
  state.run = createRun({ actIndex: fromAct, seed, difficulty: 'normal' });
  state.runStartTime = performance.now();
  state.endingChoice = null;
  state.phase = 'act';
  enterAct();
}

function enterAct() {
  const run = state.run;
  if (!run) return;
  const map = MAPS[run.actId];
  state.phase = 'act';
  document.body.dataset.act = run.actId;
  Render.setMap?.(run.actId);
  Audio.setScene?.(run.actId);
  UI.show('act', {
    no: t('act.label', { n: run.actIndex + 1 }),
    name: t(`act.${run.actId}.name`),
    sub: t(`act.${run.actId}.sub`),
    quote: t(`act.${run.actId}.quote`),
    actId: run.actId,
  });
  UI.hud?.(null);
}

function beginWave() {
  const run = state.run;
  if (!run) return;
  run.startWave();
  state.phase = 'playing';
  state.paused = false;
  UI.show('playing');
  UI.hud?.(run.getHud());
  Audio.setScene?.(run.actId);
  Audio.setIntensity?.(0.55);
  showTutorialHints();
}

function showTutorialHints() {
  const run = state.run;
  if (!run) return;
  const waveNo = run.getHud().wave - 1;
  const key = `${run.actIndex}:${waveNo}`;
  if (state.tutorialShown[key]) return;
  state.tutorialShown[key] = true;
  if (run.actIndex !== 0) return;
  const hints = isTouch()
    ? (waveNo === 0 ? ['hint.touch.move', 'hint.touch.aim'] : waveNo === 1 ? ['hint.touch.buttons', 'hint.ink'] : ['hint.ink'])
    : (waveNo === 0 ? ['hint.move', 'hint.fire', 'hint.recoil'] : waveNo === 1 ? ['hint.dash', 'hint.melee'] : ['hint.ink']);
  hints.forEach((h, i) => setTimeout(() => UI.toast?.(t(h)), 900 + i * 2600));
}

function handleWaveClear() {
  const run = state.run;
  if (!run) return;
  if (state.paused) return;
  state.paused = true;
  const hud = run.getHud();
  Audio.event?.([{ type: 'waveClear', index: hud.wave - 1, act: run.actIndex }]);
  Audio.setIntensity?.(0.2);
  UI.toast?.(t('wave.clear'));
  const lastWave = hud.wave >= hud.waveTotal;
  if (lastWave) {
    finishAct();
    return;
  }
  setTimeout(() => {
    if (!state.run || state.phase === 'dead') return;
    const choices = run.getUpgradeChoices(3);
    if (!choices || !choices.length) { nextWave(); return; }
    state.phase = 'upgrade';
    UI.upgrade(choices, (id) => {
      run.applyUpgrade(id);
      Audio.play?.('ui.pick');
      UI.hud?.(run.getHud());
      nextWave();
    }, { ink: run.getHud().ink, inkMax: run.getHud().inkMax });
  }, 500);
}

function nextWave() {
  const run = state.run;
  if (!run) return;
  // 波的推进由 sim.startWave()（内部 startNextWave）负责，这里不要重复 +1
  beginWave();
}

function finishAct() {
  const run = state.run;
  if (!run) return;
  state.phase = 'actclear';
  Audio.setIntensity?.(0.1);
  if (run.actIndex >= CONFIG.acts.length - 1) {
    finishRun();
    return;
  }
  UI.show('actclear', {
    sub: t('act.clearSub'),
    bonus: t('wave.bonus', { n: CONFIG.wave.clearBonusInk }),
    quote: t(`act.${run.actId}.quote`),
  });
  Audio.play?.('ui.pick');
}

function finishActContinue() {
  const run = state.run;
  if (!run) return;
  if (run.nextAct()) {
    Render.setMap?.(run.actId);
    enterAct();
  } else {
    finishRun();
  }
}

function finishRun() {
  const run = state.run;
  if (!run) return;
  if (state.phase === 'ending') return;
  state.phase = 'ending';
  Audio.setScene?.('ending');
  const save = Save.addRun({ score: run.getHud().score, cleared: true, act: CONFIG.acts.length });
  UI.ending?.({
    ...runSummary(run),
    best: save.best,
    newBest: run.getHud().score >= save.best && run.getHud().score > 0,
    onChoice: (choice) => {
      state.endingChoice = choice;
      Audio.event?.([{ type: 'kill', x: 0, y: 0, type: 'blank', boss: true }]);
    },
  });
}

function runSummary(run) {
  const hud = run.getHud();
  const sec = Math.max(0, Math.round((performance.now() - state.runStartTime) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return {
    score: Math.round(hud.score),
    kills: run.sim.stats.kills,
    time: `${mm}:${ss}`,
    wave: `${hud.wave}/${hud.waveTotal}`,
    act: hud.act + 1,
    actTotal: hud.actTotal,
    lore: Save.load().lore.slice(),
  };
}

function die() {
  const run = state.run;
  if (!run) return;
  state.phase = 'dead';
  state.paused = false;
  Audio.event?.([{ type: 'dead' }]);
  Audio.setIntensity?.(0);
  const save = Save.addRun({ score: run.getHud().score, cleared: false, act: run.actIndex });
  const tip = t(`dead.tip.${1 + Math.floor(Math.random() * 5)}`);
  UI.show('dead', { ...runSummary(run), best: save.best, tip, newBest: run.getHud().score >= save.best });
  UI.hud?.(null);
}

function backToTitle() {
  state.phase = 'title';
  state.run = null;
  state.paused = false;
  Render.setMap?.('draft');
  Audio.setScene?.('title');
  UI.hud?.(null);
  UI.show('title', { best: Save.load().best, continueAct: Save.load().bestAct });
}

function pauseGame() {
  if (state.phase !== 'playing' || state.paused) return;
  state.paused = true;
  Audio.setIntensity?.(0.1);
  UI.show('pause');
}
function resumeGame() {
  if (state.phase !== 'playing') return;
  state.paused = false;
  Audio.setIntensity?.(0.55);
  UI.show('playing');
}

// ───────────────────────────────────────────── 事件
function handleEvents(events) {
  const run = state.run;
  if (!events.length) return;
  Render.fx?.(events);
  Audio.event?.(events);
  for (const ev of events) {
    switch (ev.type) {
      case 'pickup':
        if (ev.kind === 'weapon' && ev.weapon) UI.toast?.(t('weapon.pickup', { name: t(`weapon.${ev.weapon}`) }));
        break;
      case 'lore':
        if (Save.unlockLore(ev.index)) {
          UI.toast?.(`${t('gallery.title')} · ${t(`lore.${ev.index}`)}`, 'lore');
          Audio.play?.('ink.pickup');
        }
        break;
      case 'waveClear':
        handleWaveClear();
        break;
      case 'bossDown':
        setTimeout(() => { if (state.phase === 'playing') finishRun(); }, 2200);
        break;
      case 'bossPhase':
        if (ev.nameKey) UI.toast?.(t(ev.nameKey), 'lore');
        break;
      case 'dead':
        die();
        break;
      default:
        break;
    }
  }
}

// ───────────────────────────────────────────── 主循环
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - (state.last || now)) / 1000);
  state.last = now;
  state.time += dt;

  if (state.phase === 'playing' && !state.paused && state.run) {
    state.acc += dt;
    let steps = 0;
    while (state.acc >= STEP && steps < 5) {
      updateInputFrame();
      state.run.step(input);
      clearPressed();
      state.acc -= STEP;
      steps += 1;
      const events = state.run.drainEvents();
      if (events.length) handleEvents(events);
      if (state.phase !== 'playing') break;
    }
    const run = state.run;
    if (run) {
      const hud = run.getHud();
      UI.hud?.(hud);
      if (hud.bossMax > 0) Audio.setIntensity?.(0.7 + 0.3 * (1 - hud.bossHp / hud.bossMax));
      else if (hud.combo > 3) Audio.setIntensity?.(0.85);
      if (run.state === 'dead' && state.phase === 'playing') die();
      if (run.state === 'won' && state.phase === 'playing') finishRun();
    }
  }

  if (Render.draw) {
    const alpha = state.phase === 'playing' ? Math.min(1, state.acc / STEP) : 1;
    Render.draw(state.run, alpha, dt, { paused: state.paused || state.phase !== 'playing' });
  }
}

function updateInputFrame() {
  if (isTouch()) {
    let ax = autoAim();
    if (joystick && Math.hypot(joystick.dx, joystick.dy) > 0.25) {
      const p = state.run?.sim.player;
      if (p) ax = { x: p.x + joystick.dx * 420, y: p.y - 40 + joystick.dy * 300 };
    }
    input.aim = ax;
    input.mx = joystick ? joystick.dx : 0;
    input.fire = touchFire;
  } else {
    input.mx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    input.aim = worldAimFromPointer();
    input.fire = pointer.down && pointer.inside;
  }
}
function clearPressed() {
  input.jumpPressed = false;
  input.dashPressed = false;
  input.meleePressed = false;
  input.reloadPressed = false;
  input.weapon = null;
}

// ───────────────────────────────────────────── 输入
function keyName(event) {
  switch (event.code) {
    case 'ArrowLeft': case 'KeyA': return 'left';
    case 'ArrowRight': case 'KeyD': return 'right';
    case 'ArrowUp': case 'KeyW': case 'Space': return 'jump';
    case 'ShiftLeft': case 'ShiftRight': return 'dash';
    case 'Escape': case 'KeyP': return 'pause';
    case 'KeyR': return 'reload';
    case 'Digit1': return 'w1';
    case 'Digit2': return 'w2';
    case 'Digit3': return 'w3';
    default: return null;
  }
}

window.addEventListener('keydown', (event) => {
  const name = keyName(event);
  if (!name) return;
  event.preventDefault();
  if (name === 'pause' && !event.repeat) {
    if (state.phase === 'playing') { state.paused ? resumeGame() : pauseGame(); }
    return;
  }
  if (keys.has(name)) return;
  keys.add(name);
  if (state.phase !== 'playing') return;
  if (name === 'jump') { input.jump = true; input.jumpPressed = true; }
  if (name === 'dash') input.dashPressed = true;
  if (name === 'reload') input.reloadPressed = true;
  if (name === 'w1') input.weapon = 0;
  if (name === 'w2') input.weapon = 1;
  if (name === 'w3') input.weapon = 2;
});
window.addEventListener('keyup', (event) => {
  const name = keyName(event);
  if (!name) return;
  keys.delete(name);
  if (name === 'jump') input.jump = false;
});

canvas.addEventListener('pointermove', (event) => {
  pointer.x = event.clientX; pointer.y = event.clientY; pointer.inside = true;
  if (event.pointerType === 'touch') { pointer.x = event.clientX; pointer.y = event.clientY; }
});
canvas.addEventListener('pointerdown', (event) => {
  ensureAudio();
  pointer.x = event.clientX; pointer.y = event.clientY; pointer.inside = true; pointer.down = true;
  if (event.button === 2 && state.phase === 'playing') input.meleePressed = true;
});
window.addEventListener('pointerup', () => { pointer.down = false; });
window.addEventListener('blur', () => { keys.clear(); pointer.down = false; if (state.phase === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.phase === 'playing') pauseGame();
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('resize', () => Render.resize?.());

// 触屏
let touchFire = false;
function setupTouch() {
  if (!isTouch()) return;
  document.body.classList.add('is-touch');
  document.getElementById('touch')?.classList.remove('is-hidden');
  const stick = document.getElementById('stick');
  const knob = document.getElementById('stick-knob');
  if (stick) {
    const center = { x: 0, y: 0 };
    const start = (event) => {
      ensureAudio();
      const r = stick.getBoundingClientRect();
      center.x = r.left + r.width / 2; center.y = r.top + r.height / 2;
      joystick = { dx: 0, dy: 0 };
      move(event);
      stick.setPointerCapture?.(event.pointerId);
    };
    const move = (event) => {
      if (!joystick) return;
      const dx = event.clientX - center.x;
      const dy = event.clientY - center.y;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, len / 52);
      joystick.dx = (dx / len) * k;
      joystick.dy = (dy / len) * k;
      const px = joystick.dx * 40, py = joystick.dy * 40;
      if (knob) knob.style.transform = `translate(${px}px, ${py}px)`;
    };
    const end = () => {
      joystick = null;
      if (knob) knob.style.transform = '';
    };
    stick.addEventListener('pointerdown', start);
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }
  const bind = (id, down, up) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (event) => { event.preventDefault(); ensureAudio(); down(); });
    el.addEventListener('pointerup', (event) => { event.preventDefault(); up?.(); });
    el.addEventListener('pointercancel', () => up?.());
    el.addEventListener('pointerleave', () => up?.());
  };
  bind('t-fire', () => { touchFire = true; }, () => { touchFire = false; });
  bind('t-jump', () => { input.jump = true; input.jumpPressed = true; }, () => { input.jump = false; });
  bind('t-dash', () => { input.dashPressed = true; });
  bind('t-melee', () => { input.meleePressed = true; });
  bind('t-reload', () => { input.reloadPressed = true; });
}

// ───────────────────────────────────────────── UI 接线
const handlers = {
  onPlay: async () => {
    ensureAudio();
    const save = Save.load();
    const playIntro = !save.seenIntro;
    if (playIntro) Save.patch({ seenIntro: true });
    UI.hideAll?.();
    if (playIntro) {
      state.phase = 'story';
      await fade(false, 10);
      UI.story?.(['story.intro.1', 'story.intro.2', 'story.intro.3', 'story.intro.4'].map((k) => t(k)), () => {
        fade(true, 300).then(() => { newRun(0); fade(false, 480); });
      });
    } else {
      await fade(true, 260);
      newRun(0);
      await fade(false, 420);
    }
  },
  onContinue: async () => {
    ensureAudio();
    const save = Save.load();
    await fade(true, 260);
    newRun(Math.min(save.bestAct || 0, CONFIG.acts.length - 1));
    await fade(false, 420);
  },
  onStoryDone: () => {
    fade(true, 300).then(() => {
      newRun(0);
      fade(false, 500);
    });
  },
  onActEnter: () => { beginWave(); },
  onActContinue: () => { finishActContinue(); },
  onUpgrade: (id) => { /* 由 UI.upgrade 回调处理 */ },
  onResume: () => resumeGame(),
  onRestart: async () => {
    await fade(true, 200);
    newRun(0);
    beginWave();
    await fade(false, 360);
  },
  onQuit: () => backToTitle(),
  onSettings: () => { state.overlayReturn = state.phase === 'playing' && state.paused ? 'pause' : 'title'; showSettings(); },
  onGallery: () => { state.overlayReturn = 'title'; UI.show('gallery', { lore: Save.load().lore }); state.phase = 'gallery'; },
  onBack: () => {
    if (state.overlayReturn === 'pause') { UI.show('pause'); state.phase = 'playing'; state.paused = true; }
    else if (state.phase === 'gallery') backToTitle();
    else backToTitle();
  },
  onRetry: async () => {
    await fade(true, 200);
    newRun(0);
    beginWave();
    await fade(false, 360);
  },
  onDeadQuit: () => backToTitle(),
  onEndingAgain: async () => {
    await fade(true, 240);
    newRun(0);
    await fade(false, 420);
  },
  onEndingChoice: (choice) => {
    Audio.event?.([{ type: 'pickup', kind: 'ink' }]);
    UI.endingChoice?.(choice);
  },
  onSetting: (key, value) => {
    Save.setSetting(key, value);
    applySettings(Save.load().settings);
    if (key === 'lang') {
      setLang(value);
      UI.setLang?.(getLang());
      applyI18n();
      UI.refresh?.();
    }
  },
  onReset: () => {
    Save.reset();
    applySettings(Save.load().settings);
    UI.refresh?.();
    backToTitle();
  },
  onRotateContinue: () => document.getElementById('rotate')?.classList.add('is-hidden'),
};

function showSettings() {
  state.phase = state.overlayReturn === 'pause' ? 'playing' : 'settings';
  if (state.overlayReturn === 'pause') state.paused = true;
  UI.show('settings', Save.load().settings);
}

// ───────────────────────────────────────────── 启动
async function boot() {
  const save = Save.load();
  setLang(save.settings.lang);
  applyI18n();
  applySettings(save.settings);
  Render.init?.(canvas, { quality: save.settings.quality });
  Render.setMap?.('draft');
  UI.init?.(handlers);
  UI.setLang?.(getLang());
  setupTouch();
  document.getElementById('rotate')?.classList.add('is-hidden');
  if (isTouch() && window.innerHeight > window.innerWidth * 1.15) {
    document.getElementById('rotate')?.classList.remove('is-hidden');
  }
  UI.show('loading');
  for (let i = 0; i <= 20; i += 1) {
    UI.setLoading?.(i / 20);
    await sleep(28);
  }
  await sleep(180);
  backToTitle();
  requestAnimationFrame(frame);
}

// 统一命名空间（契约 §6.1）
window.G = {
  CONFIG, MAPS, UI, Render, Audio, Save,
  i18n: { t, setLang, getLang },
  Game: {
    get state() { return state; },
    get run() { return state.run; },
    startAct(index = 0) { newRun(index); beginWave(); },
    newRun,
  },
};

// 调试入口（验收/自动化用）
window.__ll = {
  get state() { return state; },
  get run() { return state.run; },
  startAct(index = 0) { newRun(index); beginWave(); },
  skipWave() {
    const run = state.run;
    if (!run) return;
    if (run.waves) { run.waves.spawnQueue = []; run.waves.allSpawned = true; }
    run.sim.enemies.forEach((e) => { e.hp = 0; e.dead = true; e.dying = true; e.anim.dead = 0; });
    state.phase = 'playing';
    state.paused = false;
  },
  win() { finishRun(); },
  die() { state.run.sim.player.hp = 0; },
  god() { if (state.run) state.run.sim.player.hp = 9999; },
  ui() { return UI; },
  render() { return Render; },
  audio() { return Audio; },
  save() { return Save.load(); },
  demo: {
    title() { backToTitle(); },
    story() { state.phase = 'story'; UI.story?.(['story.intro.1', 'story.intro.3'], () => backToTitle()); },
    act(index = 0) { newRun(index); },
    upgrade() {
      if (!state.run) newRun(0);
      state.paused = true;
      const run = state.run;
      UI.upgrade(run.getUpgradeChoices(3), () => beginWave(), { ink: run.getHud().ink, inkMax: run.getHud().inkMax });
    },
    ending() {
      if (!state.run) state.run = createRun({ actIndex: 0, seed: 7 });
      state.phase = 'ending';
      document.body.dataset.act = 'blank';
      UI.ending({ ...runSummary(state.run), best: Save.load().best });
    },
    endingChoice(choice = 'finish') { UI.endingChoice?.(choice); },
    dead() {
      if (!state.run) state.run = createRun({ actIndex: 0, seed: 7 });
      state.phase = 'dead';
      UI.show('dead', { ...runSummary(state.run), tip: t('dead.tip.2'), best: Save.load().best });
    },
    gallery() { UI.show('gallery', { lore: [1, 2, 4, 7] }); },
    settings() { UI.show('settings', Save.load().settings); },
    hud() { if (state.run) UI.hud(state.run.getHud()); },
  },
};

boot();

export { state };
