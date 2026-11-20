// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 音频。
import { WORLD, STEP } from '../config/game.config.js';
import { createRun, TILE } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const B = WORLD.BOARD;

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

let state = 'boot';           // boot | title | playing | paused | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestShaft = 1;
let bank = 0;
let chooseMode = null;        // null | { type:'skill', id } | { type:'hire' }
let dragStart = null;

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
  onDig: () => { if (run && state === 'playing') run.step({ dig: true }); },
  onReinforce: () => { if (run && state === 'playing') run.step({ reinforce: true }); },
  onGamble: () => { if (run && state === 'playing') run.nextCollapseAt = run.time; },
  onHire: () => { chooseMode = { type: 'hire' }; },
  onUpgradeGoblin: (id) => { if (run && state === 'playing') run.step({ upgrade: id }); },
  onSkill: (id) => {
    if (state !== 'playing' || !run) return;
    const skill = { id };
    const def = [{ id: 'fuelSurge' }, { id: 'tnt' }, { id: 'fuelCollect' }, { id: 'precisePick' }];
    const isChoose = id === 'tnt' || id === 'precisePick';
    if (isChoose) chooseMode = { type: 'skill', id };
    else run.step({ skill });
  },
});
ui.onTutorial((result) => { Sdk.track('tutorial_done', { skipped: !!result?.skipped }); });
ui.setBest(bestShaft);

// ---------- 坐标换算 ----------
function eventToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (WORLD.WIDTH / Math.max(1, rect.width));
  const y = (e.clientY - rect.top) * (WORLD.HEIGHT / Math.max(1, rect.height));
  return { x, y };
}
function eventToTile(e) {
  const { x, y } = eventToWorld(e);
  const c = Math.floor((x - B.x0) / B.tile);
  const r = Math.floor((y - B.y0) / B.tile);
  if (c < 0 || c >= B.cols || r < 0 || r >= B.rows) return null;
  return { c, r };
}

function isOre(cell) { return cell.t >= 0 && cell.t <= 5; }

function resolveChoose(tile) {
  if (!tile || !run) return;
  if (chooseMode?.type === 'skill') {
    run.step({ skill: { id: chooseMode.id, pos: tile } });
  } else if (chooseMode?.type === 'hire') {
    run.step({ hire: tile.c });
  }
  chooseMode = null;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const tile = eventToTile(e);
  if (chooseMode) { resolveChoose(tile); return; }
  dragStart = tile;
});
canvas.addEventListener('pointerup', (e) => {
  if (state !== 'playing' || !dragStart || chooseMode) return;
  const end = eventToTile(e);
  if (!end) { dragStart = null; return; }
  const dc = end.c - dragStart.c;
  const dr = end.r - dragStart.r;
  let target = null;
  if (Math.abs(dc) >= Math.abs(dr)) target = { c: dragStart.c + (dc > 0 ? 1 : dc < 0 ? -1 : 0), r: dragStart.r };
  else target = { c: dragStart.c, r: dragStart.r + (dr > 0 ? 1 : dr < 0 ? -1 : 0) };
  if (target && target.c >= 0 && target.c < B.cols && target.r >= 0 && target.r < B.rows) {
    run.step({ swap: [[dragStart.c, dragStart.r], [target.c, target.r]] });
  }
  dragStart = null;
});
canvas.addEventListener('pointercancel', () => { dragStart = null; });

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', () => {});

// ---------- 音频设置 ----------
function applyAudioSettings() {
  audio.setMuted(!!Sdk.load('muted', false));
  audio.setVolume(Sdk.load('volume', 0.8));
}

// ---------- 流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  dragStart = null;
  chooseMode = null;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  ui.setHud(run.getHud());
  Sdk.newRun({ zone: 1 });
  audio.playBgm();
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') resumeGame();
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); }
}

function toTitle() {
  state = 'title';
  run = null;
  ui.show('title');
  ui.setBest(bestShaft);
  renderer.draw(null, 1);
  audio.stopBgm();
}

function onFinish(win) {
  const stats = run.stats || {};
  const shaftReached = Math.max(1, stats.shaftReached || run.shaft || 1);
  const depth = run.depth;
  const coins = run.coins;
  const isRecord = shaftReached > bestShaft;
  if (isRecord) { bestShaft = shaftReached; Sdk.save('bestShaft', bestShaft); }
  bank += coins;
  Sdk.save('bank', bank);
  ui.setBest(bestShaft);
  state = win ? 'won' : 'dead';
  ui.show('dead', { shaft: shaftReached, depth, coins, best: bestShaft, newRecord: isRecord, win });
  if (win) Sdk.levelCleared({ shaft: shaftReached, depth, coins });
  else Sdk.gameOver({ shaft: shaftReached, depth, coins });
  audio.stopBgm();
}

async function shareResult() {
  const shaft = run?.stats?.shaftReached || 1;
  await Sdk.share({
    title: 'GOBLIN MINES',
    text: `${i18n.lang === 'zh' ? `我挖到了第 ${shaft} 条矿道！` : `I dug to shaft ${shaft} in the mines!`} GOBLIN MINES`,
  });
  Sdk.track('share', { shaft });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'match' || ev.type === 'matchBig') renderer.burst(WORLD.WIDTH / 2, B.y0 + B.rows * B.tile / 2, 'match', '#ffd24d');
    else if (ev.type === 'rockBreak' || ev.type === 'frozenBreak') renderer.burst(B.x0 + (ev.c + 0.5) * B.tile, B.y0 + (ev.r + 0.5) * B.tile, 'rock', '#b06bff');
    else if (ev.type === 'dig') { renderer.burst(WORLD.WIDTH / 2, B.y0 + B.rows * B.tile / 2, 'dig', '#ff9a3d'); renderer.shake(6); renderer.departCart(); }
    else if (ev.type === 'collapse') { renderer.shake(9); }
    else if (ev.type === 'shaftClear') { renderer.burst(WORLD.WIDTH / 2, B.y0, 'shaftClear', '#ffd24d'); renderer.departCart(); }
    else if (ev.type === 'bossBreak') renderer.burst(WORLD.WIDTH / 2, B.y0 + 80, 'shaftClear', '#ff5d5d');

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'dig') Sdk.track('dig', { depth: run.depth });
    else if (ev.type === 'collapse') Sdk.track('collapse', {});
    else if (ev.type === 'bossBreak') Sdk.track('boss_kill', {});
    else if (ev.type === 'match') Sdk.track('match', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' || state === 'won' ? run : null, 1);
    return;
  }
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({});
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onFinish(false); return; }
    if (run.phase === 'won') { onFinish(true); return; }
  }
  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
  ui.tutorial.tick(performance.now());
}

// ---------- 失焦暂停 + 存档 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
  if (document.hidden) Sdk.save('lastSeen', Date.now());
});
window.addEventListener('beforeunload', () => { Sdk.save('lastSeen', Date.now()); });

// ---------- 离线收益结算 ----------
function settleOffline() {
  const lastSeen = Sdk.load('lastSeen', 0);
  if (lastSeen) {
    const elapsed = Math.max(0, (Date.now() - lastSeen) / 1000);
    const gain = Math.floor(bestShaft * elapsed * 0.2);
    if (gain > 0) {
      bank += gain;
      Sdk.save('bank', bank);
    }
  }
  Sdk.save('lastSeen', Date.now());
}

Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestShaft = Math.floor(Sdk.load('bestShaft', 1)) || 1;
  bank = Math.floor(Sdk.load('bank', 0)) || 0;
  settleOffline();
  ui.setBest(bestShaft);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1);
  loadingEl.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

// ---------- 标准调试契约 ----------
window.G = {
  get run() { return run; },
  ui, renderer, audio, Sdk,
  get state() { return state; },
};

window.__ll = {
  get state() { return { phase: state, lang: i18n.lang, dir: i18n.dir }; },
  lang: () => i18n.lang,
  setLang: (l) => { i18n.setLang(l); ui.applyLang(); },
  get run() { return run; },
  start: startGame,
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  save: () => Sdk.save,
  ui: () => ui,
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], board: [B.x0, B.y0, B.tile] }) },
};
