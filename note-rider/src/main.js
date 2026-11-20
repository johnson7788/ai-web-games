// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + 技能三选一 + SDK 统一出口
// 契约见 docs/README.md。装配：sim / render / ui / audio / Lead 集成。
import { STEP, GAME, LAYOUT } from '../config/game.config.js';
import { SKILLS } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活
let skillSelectOpen = false;

const view = {
  shake: 0,             // 震屏幅度
  fxQueue: [],          // {type:'slashArc', x, y, ttl}
  chordFlash: 0,        // 和弦斩整行高亮
  slashPose: 0,         // 斩击姿态计时
  cursor: { x: 0, y: 0 },
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let bestByLevel = Sdk.load('best', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let chosenSkills = Sdk.load('chosenSkills', {}) || {};

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('best', bestByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('chosenSkills', chosenSkills);
}

function totalStars() {
  return Object.values(bestByLevel).filter((v) => (v | 0) > 0).length;
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function applySkillChoice(id) {
  // 三选一升级点的即时收益（护盾=护体、爆发=能量、吸血=回血）
  if (id === 'shield') { chosenSkills.shield = (chosenSkills.shield | 0) + 1; }
  else if (id === 'burst') { chosenSkills.burst = (chosenSkills.burst | 0) + 1; }
  else if (id === 'lifesteal') { chosenSkills.lifesteal = (chosenSkills.lifesteal | 0) + 1; }
  persist();
}

function startLevel(idx, opts = {}) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  armDigLikeReset();
  run = createRun(idx, { seed: opts.seed != null ? opts.seed : ((Date.now() % 2147483647) || 1) });
  view.shake = 0;
  view.fxQueue = [];
  view.chordFlash = 0;
  view.slashPose = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  hideSkillSelect();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0 && !opts.skipTutorial) startTutorial();
  else if (opts.showSkillSelect !== false && LEVELS[idx].skillSelect) openSkillSelect();
}

function armDigLikeReset() { /* 无铲除模式，保持与参考结构一致 */ }

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : 0);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  hideSkillSelect();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[h.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${h.level} · ${(lv.name && (lv.name[i18n.lang] || lv.name.en)) || ''}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-combo').textContent = `${h.combo} ${t('combo')}`;
  $('hud-combo').classList.toggle('combo-hot', h.combo >= 8);
  const hpPct = Math.round((h.hp / h.maxHp) * 100);
  $('hud-hp-fill').style.width = `${hpPct}%`;
  $('hud-hp-fill').classList.toggle('low', hpPct <= 30);
  $('hud-hp-text').textContent = `${t('hp')} ${h.hp}`;
  $('hud-energy').textContent = `⚡ ${h.energy}/${h.energyMax}`;
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const cleared = (bestByLevel[i + 1] | 0) > 0;
    cell.innerHTML = `<span class="lv-num">${i + 1}</span><span class="lv-star">${cleared ? '★' : '☆'}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT}`;
}

function showResult(res) {
  const { won, score, comboMax, notesHit, notesMissed, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">★</span><em>${t('perfect')}</em>`
    : '';
  $('result-meta').textContent = `${t('score')} ${score} · ${t('combo')} ${comboMax} · ${notesHit}/${notesMissed + notesHit}`;
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const score = st.score;
  if (won) {
    const idx = st.level;
    bestByLevel[idx] = Math.max(bestByLevel[idx] | 0, score);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, score, comboMax: st.comboMax, durationMs: Math.round(st.beatClock * 1000),
  });
  showResult({
    won, score, comboMax: st.comboMax, notesHit: st.notesHit, notesMissed: st.notesMissed,
    hasNext: st.level < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 技能三选一升级点 ----------
function openSkillSelect() {
  if (!run) return;
  skillSelectOpen = true;
  setPhase('paused'); // 用暂停态冻结推进，但显示技能卡
  ui.hidePause();
  $('skill-select-title').textContent = t('skillChoose');
  $('skill-select-sub').textContent = t('level') + ' ' + run.state.level;
  $('skill-select').classList.remove('hidden');
}

function hideSkillSelect() {
  skillSelectOpen = false;
  $('skill-select').classList.add('hidden');
}

function chooseSkill(id) {
  applySkillChoice(id);
  hideSkillSelect();
  setPhase('playing');
  audio.startBgm();
  audio.event('skill', { id });
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'hitline' },
  { text: t('tutStep2'), spot: 'lanes' },
  { text: t('tutStep3'), spot: 'hud' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    return lay && lay[which] ? lay[which] : null;
  } catch { return null; }
}

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const rect = s && s.spot && layoutRect(s.spot);
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
  } else {
    spot.style.display = 'none';
  }
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// 教学步骤推进（真实动作驱动）：0=slash 命中 1=换轨 2=技能
const TUT_TRIGGER = ['hit', 'switch', 'skill'];

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'slash':
        view.slashPose = 0.12;
        view.fxQueue.push({ type: 'slashArc', x: LAYOUT.PLAYER_X + 40, y: LAYOUT.LANE_Y[ev.lane] + 6, ttl: 0.3 });
        break;
      case 'perfect':
        view.shake = 2;
        break;
      case 'chordSlash':
        view.chordFlash = 1.0;
        view.shake = 8;
        break;
      case 'miss':
      case 'redHit':
        view.shake = 5;
        break;
      case 'kill':
        view.shake = 3;
        break;
      case 'bossDefeated':
        view.shake = 9;
        view.chordFlash = 1.0;
        break;
      case 'win':
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

function doSlash() {
  if (!run || phase !== 'playing' || skillSelectOpen) return;
  run.slash();
  view.slashPose = 0.12;
}

function doRelease() {
  if (!run || phase !== 'playing' || skillSelectOpen) return;
  run.release();
}

function doSwitch(dir) {
  if (!run || phase !== 'playing' || skillSelectOpen) return;
  run.switchLane(dir);
}

function doSkill(id) {
  if (!run || phase !== 'playing' || skillSelectOpen) return;
  run.useSkill(id);
}

let pointerDownY = null;
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointerDownY = canvasPos(e).y;
  doSlash();
});
canvas.addEventListener('pointerup', (e) => {
  doRelease();
  if (pointerDownY != null) {
    const dy = canvasPos(e).y - pointerDownY;
    if (dy < -40) doSwitch('up');
    else if (dy > 40) doSwitch('down');
  }
  pointerDownY = null;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Space') { e.preventDefault(); doSlash(); }
  if (e.code === 'ArrowUp') { e.preventDefault(); doSwitch('up'); }
  if (e.code === 'ArrowDown') { e.preventDefault(); doSwitch('down'); }
  if (e.code === 'Digit1') doSkill('shield');
  if (e.code === 'Digit2') doSkill('burst');
  if (e.code === 'Digit3') doSkill('lifesteal');
  if (e.code === 'Digit4') doSkill('heal');
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') doRelease();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel(0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level - 1 : 0) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('skill-shield', () => doSkill('shield'));
  on('skill-burst', () => doSkill('burst'));
  on('skill-lifesteal', () => doSkill('lifesteal'));
  on('skill-heal', () => doSkill('heal'));
  on('choice-shield', () => chooseSkill('shield'));
  on('choice-burst', () => chooseSkill('burst'));
  on('choice-lifesteal', () => chooseSkill('lifesteal'));

  $('level-grid')?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > unlocked) return;
    startLevel(i);
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      buildLevelGrid();
      refreshSkillTexts();
      if (run) updateHud();
    });
  }
}

function refreshSkillTexts() {
  $('skill-select-title').textContent = t('skillChoose');
  const map = {
    shield: [t('skillShield'), t('skillShieldDesc')],
    burst: [t('skillBurst'), t('skillBurstDesc')],
    lifesteal: [t('skillLifesteal'), t('skillLifestealDesc')],
  };
  for (const id of Object.keys(map)) {
    const name = document.querySelector(`[data-sk="${id}"]`);
    const desc = document.querySelector(`[data-sk-desc="${id}"]`);
    if (name) name.textContent = map[id][0];
    if (desc) desc.textContent = map[id][1];
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run && !skillSelectOpen) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  if (view.chordFlash > 0) view.chordFlash = Math.max(0, view.chordFlash - dt * 2.2);
  if (view.slashPose > 0) view.slashPose = Math.max(0, view.slashPose - dt);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;

  try {
    renderer.draw(run ? run.state : null, dt, { ...view, sceneKey: run ? run.state.scene : 'dawn' });
  } catch (err) {
    console.warn('render error', err);
  }
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  ui,
  save: (key, value) => Sdk.save(key, value),
  load: (key, fallback) => Sdk.load(key, fallback),
  share: (payload) => Sdk.share(payload),
  start: (i) => startLevel(i == null ? 0 : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['slash', 'switch', 'skill']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return { ...st, noteCount: st.notes.length, activeNotes: st.notes.filter((n) => !n.resolved).length };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i, { skipTutorial: true, showSkillSelect: false }),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.shake = 0;
      view.fxQueue = [];
      view.chordFlash = 0;
      view.slashPose = 0;
      setPhase('playing');
      ui.showGame();
      hideResult();
      hideSkillSelect();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 自动完美演奏整首（供验收快进到结算）
    autoPlayTick: () => {
      if (!run || run.state.phase !== 'playing') return false;
      const s = run.state;
      for (const n of s.notes) {
        if (n.resolved || n.type === 'red') continue;
        const dt = s.beatClock - n.start;
        if (Math.abs(dt) <= 0.05) {
          if (n.lane !== s.lane) run.switchLane(n.lane);
          run.slash();
          return true;
        }
      }
      return false;
    },
    autoPlaceSolution: () => {
      // 节奏游戏无「摆放解」，等价于自动完美演奏到终局
      return window.__ll.debug.fastForward();
    },
    fastForward: () => {
      if (!run) return false;
      try {
        let guard = 6000;
        while (guard-- > 0 && run.state.phase === 'playing') {
          window.__ll.debug.autoPlayTick();
          run.step(1 / 60);
          handleEvents(run.drainEvents());
        }
        return true;
      } catch { return false; }
    },
    giveUp: () => window.__ll.debug.fastForward(),
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
refreshSkillTexts();
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
