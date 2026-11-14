// 主入口：ESCAPE CHOICE。状态机 title → playing ⇄ paused；fail/win 以结局遮罩呈现。
import { WORLD, COLORS, CONFIG } from '../config/game.config.js';
import { STORY } from '../config/story.js';
import { createRun, currentNode, choose, retry, getHud, drainEvents, serializeEndings, ENDING_COUNT } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { preload } from './render/art.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ endingsFound: Sdk.load('endings', []) });
let state = 'title';
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function syncUi() {
  ui.updateHUD(getHud(run));
}
function refreshStory() {
  const node = currentNode(run);
  ui.setStory(node.text[i18n.lang] || node.text.en, node.choices, i18n.lang);
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'choice') {
      audio.choice();
      Sdk.track('choice', { to: ev.to });
    } else if (ev.type === 'fail') {
      audio.fail();
      Sdk.track('fail', { node: ev.node });
    } else if (ev.type === 'win') {
      audio.win();
      Sdk.save('endings', serializeEndings(run));
      Sdk.track('win', { node: ev.node, total: ev.total });
    }
  }
}

function doChoose(index) {
  if (state !== 'playing' || run.phase !== 'playing') return;
  const r = choose(run, index);
  if (!r.ok) return;
  processEvents();
  if (r.ending) {
    ui.showEnding(r.ending, r.node.text[i18n.lang] || r.node.text.en);
  } else {
    refreshStory();
  }
  syncUi();
}

function doRetry() {
  retry(run);
  ui.hideEnding();
  refreshStory();
  syncUi();
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun({ endingsFound: Sdk.load('endings', []) });
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'story' });
  ui.showGame();
  ui.hideEnding();
  refreshStory();
  syncUi();
  lastTime = performance.now();
}
function backToTitle() {
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(run.endingsFound.size);
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
function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 输入 ----------------------------------------------------------------
ui.choices.addEventListener('click', (e) => {
  const btn = e.target.closest('.choice-btn');
  if (!btn) return;
  audio.unlock();
  doChoose(Number(btn.dataset.index));
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (state === 'playing' && run.phase === 'playing') {
    const n = Number(e.key);
    if (n >= 1 && n <= 3) doChoose(n - 1);
  }
  if (state === 'playing' && run.phase !== 'playing' && (e.code === 'Enter' || e.code === 'Space')) {
    doRetry();
    e.preventDefault();
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnRetry.addEventListener('click', doRetry);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnTitle2.addEventListener('click', backToTitle);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => {
    ui.setLang(e.target.value);
    syncLl();
    if (state === 'playing') {
      if (run.phase === 'playing') refreshStory();
      else {
        const node = currentNode(run);
        ui.showEnding(run.phase, node.text[i18n.lang] || node.text.en);
      }
    }
  });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  lastTime = now;
  renderer.render({ scene: currentNode(run).scene });
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(run.endingsFound.size);
ui.updateMute(audio.muted);
syncLl();
syncUi();
requestAnimationFrame(loop);

// 预载 AI 场景素材：加载中画进度，完成平滑替换；单张失败回退程序化绘制。
preload((done, total) => renderer.setProgress(done, total))
  .then((textures) => renderer.setTextures(textures));

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
    state: () => ({ ...getHud(run), text: currentNode(run).text.en }),
    choose: (i) => { doChoose(i); return getHud(run); },
    retry: () => { doRetry(); return getHud(run); },
    goto: (nodeId) => {
      run.nodeId = nodeId;
      run.phase = STORY[nodeId].ending || 'playing';
      if (state === 'playing') {
        if (run.phase === 'playing') refreshStory();
        else ui.showEnding(run.phase, STORY[nodeId].text[i18n.lang] || STORY[nodeId].text.en);
      }
      return getHud(run);
    },
    endings: () => serializeEndings(run),
  },
};