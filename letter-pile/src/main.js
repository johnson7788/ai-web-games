// 主入口：LETTER PILE。状态机 title → playing ⇄ paused → clear。
import { WORLD, COLORS, RULES, CONFIG } from '../config/game.config.js';
import {
  createRun, tapLetter, backspace, clearSelected, submit, shufflePile, useHint, nextLevel, getHud, drainEvents,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ level: 0, seed: 1 });
let state = 'title';
let best = Sdk.load('best', 0);
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function syncUi() {
  const hud = getHud(run);
  ui.updateHUD(hud);
  ui.renderWords(run.words, run.found, run.revealed);
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'found') {
      audio.found();
      ui.setFeedback(`+${RULES.scorePerWord}  ${ev.word}`, 'good');
      Sdk.track('word', { word: ev.word });
    } else if (ev.type === 'wrong') {
      audio.wrong();
      renderer.flashWrong();
      ui.setFeedback(t('notWord'), 'bad');
    } else if (ev.type === 'already') {
      ui.setFeedback(t('already'), 'bad');
    } else if (ev.type === 'hint') {
      audio.hint();
    } else if (ev.type === 'clear') {
      onClear();
    }
  }
}

function doTap(letterIdx) {
  tapLetter(run, letterIdx);
  audio.tap();
  syncUi();
}
function doSubmit() {
  submit(run);
  processEvents();
  syncUi();
}
function doShuffle() {
  shufflePile(run);
  audio.shuffle();
  syncUi();
}
function doHint() {
  const h = useHint(run);
  if (!h) audio.wrong();
  processEvents();
  syncUi();
}
function doClear() {
  clearSelected(run);
  audio.click();
  syncUi();
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun({ level: 0, seed: Math.floor(Math.random() * 0x7fffffff) });
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'anagram' });
  ui.showGame();
  ui.setFeedback('', '');
  syncUi();
  lastTime = performance.now();
}
function doNext() {
  nextLevel(run);
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  ui.hideClear();
  ui.setFeedback('', '');
  syncUi();
  lastTime = performance.now();
}
function backToTitle() {
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(best);
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  syncLl();
  ui.showPause();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  syncLl();
  ui.hidePause();
  lastTime = performance.now();
}
function onClear() {
  state = 'clear';
  syncLl();
  if (run.score > best) { best = run.score; Sdk.save('best', best); }
  Sdk.levelCleared({ level: run.level, score: run.score });
  ui.showClear();
  audio.clear();
}
function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 输入 ----------------------------------------------------------------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const p = canvasPos(e);
  const letterIdx = renderer.hitLetter(p.x, p.y, run);
  if (letterIdx >= 0) doTap(letterIdx);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'Enter') { doSubmit(); return; }
  if (e.code === 'Backspace') { backspace(run); syncUi(); e.preventDefault(); return; }
  if (/^Key[A-Z]$/.test(e.code)) {
    const ch = e.code.slice(3);
    const idx = run.letters.findIndex((l, i) => l === ch && !run.selected.includes(i));
    if (idx >= 0) doTap(idx);
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnNext.addEventListener('click', doNext);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnSubmit.addEventListener('click', doSubmit);
ui.btnShuffle.addEventListener('click', doShuffle);
ui.btnHint.addEventListener('click', doHint);
ui.btnClear.addEventListener('click', doClear);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  renderer.update(dt);
  renderer.render({ run });
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(best);
ui.updateMute(audio.muted);
syncLl();
syncUi();
requestAnimationFrame(loop);

// ---- 调试契约 ------------------------------------------------------------
window.G = { run: () => run, state: () => state, ui };

window.__ll = {
  state: llState,
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  startAct: startGame,
  sim: run,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  debug: {
    state: () => getHud(run),
    tap: (i) => { doTap(i); return getHud(run); },
    submit: () => { doSubmit(); return getHud(run); },
    shuffle: () => { doShuffle(); return getHud(run); },
    hint: () => { const h = useHint(run); processEvents(); syncUi(); return h; },
    solveWord: (word) => {
      clearSelected(run);
      const used = new Set();
      for (const ch of word) {
        const idx = run.letters.findIndex((l, i) => l === ch && !used.has(i));
        used.add(idx);
        tapLetter(run, idx);
      }
      submit(run);
      processEvents();
      syncUi();
      return getHud(run);
    },
    solveAll: () => {
      for (const w of run.words) {
        if (!run.found.has(w)) {
          clearSelected(run);
          const used = new Set();
          for (const ch of w) {
            const idx = run.letters.findIndex((l, i) => l === ch && !used.has(i));
            used.add(idx);
            tapLetter(run, idx);
          }
          submit(run);
        }
      }
      processEvents();
      syncUi();
      return getHud(run);
    },
    next: () => { doNext(); return getHud(run); },
  },
};