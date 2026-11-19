// 主入口：60Hz 固定步长 + 标题→选天赋→分配→人生→结算 + 教程引导 + SDK 统一出口。
// 装配：sim（纯逻辑）/ render（canvas 氛围）/ ui（语言与屏幕显隐）/ audio（WebAudio）。
import { STEP, GAME } from '../config/game.config.js';
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
let phase = 'title'; // title | talent | allocate | life | summary | paused
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;
let autoOn = false;
let autoTimer = null;
let autoSpeed = 1;

// meta 存档（统一走 Sdk）
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestStars = Sdk.load('bestStars', 0) | 0;
let times = Sdk.load('times', 0) | 0;
let records = Sdk.load('records', []) || [];

Sdk.ready();
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('bestStars', bestStars);
  Sdk.save('times', times);
  Sdk.save('records', records);
}

function setPhase(p) { phase = p; }

// ---------------- 阶段状态机 ----------------

function startRun() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1, times, achievements: records.length });
  $('choice-card').classList.add('hidden');
  tutorialStep = -1;
  setPhase('talent');
  ui.show('talent');
  stopAuto();
  buildTalentGrid();
  audio.startBgm();
}

function start() {
  audio.unlock();
  startRun();
  Sdk.track('start', { times });
  if (!tutorialDone) startTutorial();
}

function replay() {
  times += 1;
  persist();
  startRun();
  Sdk.track('restart', { times });
}

function goHome() {
  stopAuto();
  $('choice-card').classList.add('hidden');
  run = null;
  setPhase('title');
  ui.show('title');
  audio.stopBgm();
  renderTitle();
}

function pauseGame() {
  if (phase !== 'life' && phase !== 'talent' && phase !== 'allocate') return;
  setPhase('paused');
  stopAuto();
  audio.stopBgm();
  ui.show('pause');
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase(run ? run.state.phase : 'title');
  ui.show(phase === 'title' ? 'title' : run ? run.state.phase : 'title');
  audio.startBgm();
}

// ---------------- 标题 ----------------

function renderTitle() {
  const el = $('best-stars');
  if (el) el.textContent = bestStars > 0 ? t('bestStars', { n: bestStars }) : '';
  ui.applyLang();
}

// ---------------- 天赋选择 ----------------

function talentCard(t, index) {
  const card = document.createElement('button');
  card.className = 'talent-card grade-' + t.grade + (run.state.selectedIndices.includes(index) ? ' selected' : '');
  card.dataset.index = index;
  const gradeEl = document.createElement('span');
  gradeEl.className = 'talent-grade';
  gradeEl.textContent = '★'.repeat(t.grade + 1);
  const nameEl = document.createElement('span');
  nameEl.className = 'talent-name';
  nameEl.textContent = t.name[i18n.lang] || t.name.en;
  const descEl = document.createElement('span');
  descEl.className = 'talent-desc';
  descEl.textContent = t.desc[i18n.lang] || t.desc.en;
  card.appendChild(gradeEl);
  card.appendChild(nameEl);
  card.appendChild(descEl);
  card.addEventListener('click', () => {
    audio.unlock();
    run.pickTalent(index);
    buildTalentGrid();
    drainAndRender();
  });
  return card;
}

function buildTalentGrid() {
  const grid = $('talent-grid');
  if (!grid || !run) return;
  grid.innerHTML = '';
  run.state.talentPool.forEach((t, i) => grid.appendChild(talentCard(t, i)));
  $('talent-title').textContent = t('pickTalents');
  $('talent-hint').textContent = t('talentHint', { n: GAME.TALENT_PICKS });
  const left = GAME.TALENT_PICKS - run.state.selectedIndices.length;
  const btn = $('btn-confirm-talents');
  btn.textContent = left <= 0 ? t('confirmTalents') : t('moreTalents', { n: left });
  btn.disabled = left > 0;
}

function confirmTalents() {
  if (!run) return;
  const res = run.confirmTalents();
  if (!res.ok) return;
  // 重置分配
  run.state.alloc = { CHR: 0, INT: 0, STR: 0, MNY: 0, SPR: GAME.SPR_BASE };
  setPhase('allocate');
  ui.show('allocate');
  buildAllocList();
}

// ---------------- 分配点数 ----------------

function allocRemaining() {
  if (!run) return 0;
  return run.state.allocPoints - (run.state.alloc.CHR + run.state.alloc.INT + run.state.alloc.STR + run.state.alloc.MNY);
}

function buildAllocList() {
  if (!run) return;
  $('allocate-title').textContent = t('allocateTitle');
  $('allocate-hint').textContent = t('allocateHint', { n: run.state.allocPoints });
  const list = $('alloc-list');
  list.innerHTML = '';
  const keys = ['CHR', 'INT', 'STR', 'MNY'];
  for (const k of keys) {
    const row = document.createElement('div');
    row.className = 'alloc-row';
    const name = document.createElement('span');
    name.className = 'alloc-name stat-' + k;
    name.textContent = t('stat' + k);
    const minus = document.createElement('button');
    minus.className = 'alloc-btn';
    minus.textContent = '−';
    minus.addEventListener('click', () => { audio.unlock(); allocDelta(k, -1); });
    const val = document.createElement('span');
    val.className = 'alloc-val';
    val.textContent = run.state.alloc[k];
    val.dataset.stat = k;
    const plus = document.createElement('button');
    plus.className = 'alloc-btn';
    plus.textContent = '+';
    plus.addEventListener('click', () => { audio.unlock(); allocDelta(k, 1); });
    row.appendChild(name);
    row.appendChild(minus);
    row.appendChild(val);
    row.appendChild(plus);
    list.appendChild(row);
  }
  // SPR 固定
  const row = document.createElement('div');
  row.className = 'alloc-row fixed';
  row.innerHTML = `<span class="alloc-name stat-SPR">${t('statSPR')}</span><span class="alloc-val">${GAME.SPR_BASE}</span><span class="alloc-note">·</span>`;
  list.appendChild(row);
  $('btn-alloc-random').textContent = t('randomAlloc');
  $('btn-start-life').textContent = t('startLife');
  renderAllocLeft();
}

function renderAllocLeft() {
  const el = $('alloc-left');
  if (el) el.textContent = t('pointsLeft', { n: allocRemaining() });
}

function allocDelta(k, d) {
  if (!run) return;
  const cur = run.state.alloc[k];
  if (d > 0 && allocRemaining() <= 0) return;
  if (d < 0 && cur <= 0) return;
  run.state.alloc[k] = cur + d;
  buildAllocList();
}

function randomAlloc() {
  if (!run) return;
  const keys = ['CHR', 'INT', 'STR', 'MNY'];
  let tLeft = allocRemaining() + keys.reduce((s, k) => s + run.state.alloc[k], 0);
  keys.forEach((k) => { run.state.alloc[k] = 0; });
  while (tLeft > 0) {
    const k = keys[Math.floor(Math.random() * 4)];
    const sub = Math.min(tLeft, Math.max(1, Math.round(Math.random() * 3)));
    run.state.alloc[k] += sub;
    tLeft -= sub;
  }
  buildAllocList();
}

function startLife() {
  if (!run) return;
  const res = run.startLife(run.state.alloc);
  if (!res.ok) return;
  setPhase('life');
  ui.show('life');
  renderLife();
  Sdk.track('life_start', { alloc: run.state.alloc });
}

// ---------------- 人生推进 ----------------

function nextYear() {
  if (!run || phase !== 'life') return;
  audio.unlock();
  run.nextYear();
  drainAndRender();
}

function resolveChoice(option) {
  if (!run) return;
  run.resolveChoice(option);
  $('choice-card').classList.add('hidden');
  $('action-bar').classList.remove('hidden');
  drainAndRender();
}

function showChoice(choice) {
  const card = $('choice-card');
  $('choice-title').textContent = t('choiceTitle');
  $('choice-text').textContent = choice[i18n.lang] || choice.en;
  $('btn-choice-a').textContent = choice.a[i18n.lang] || choice.a.en;
  $('btn-choice-b').textContent = choice.b[i18n.lang] || choice.b.en;
  $('action-bar').classList.add('hidden');
  card.classList.remove('hidden');
}

function toggleAuto() {
  autoOn = !autoOn;
  if (autoOn) startAutoTimer();
  else stopAuto();
  renderActionBar();
}

function startAutoTimer() {
  stopAuto();
  autoTimer = setInterval(() => {
    if (phase !== 'life' || !run || run.state.pendingChoice) return;
    run.nextYear();
    drainAndRender();
  }, Math.max(120, GAME.AUTO_INTERVAL * 1000 / autoSpeed));
}

function stopAuto() {
  autoOn = false;
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
}

function cycleSpeed() {
  autoSpeed = [1, 2, 4, 8][([1, 2, 4, 8].indexOf(autoSpeed) + 1) % 4];
  if (autoOn) startAutoTimer();
  renderActionBar();
}

function renderActionBar() {
  $('btn-next-year').textContent = t('nextYear');
  $('btn-auto').textContent = autoOn ? '⏸ ' + t('auto') : '▶ ' + t('auto');
  $('btn-speed').textContent = t('speed', { n: autoSpeed });
  $('btn-speed').classList.toggle('hidden', !autoOn);
}

// ---------------- 人生界面 ----------------

const STAT_COLORS = { CHR: '#ff5da2', INT: '#4dd0ff', STR: '#ffb84d', MNY: '#ffd84e', SPR: '#9dff6a' };

function renderStats() {
  const bar = $('stats-bar');
  if (!bar || !run) return;
  bar.innerHTML = '';
  for (const k of ['CHR', 'INT', 'STR', 'MNY', 'SPR']) {
    const cell = document.createElement('div');
    cell.className = 'stat-cell';
    const label = document.createElement('span');
    label.className = 'stat-label';
    label.textContent = t('stat' + k);
    const val = document.createElement('span');
    val.className = 'stat-val';
    val.textContent = run.state.props[k];
    const track = document.createElement('div');
    track.className = 'stat-track';
    const fill = document.createElement('div');
    fill.className = 'stat-fill';
    fill.style.background = STAT_COLORS[k];
    fill.style.width = Math.min(100, Math.max(0, (run.state.props[k] / 15) * 100)) + '%';
    track.appendChild(fill);
    cell.appendChild(label);
    cell.appendChild(val);
    cell.appendChild(track);
    bar.appendChild(cell);
  }
  // 幸运连击
  const luck = document.createElement('div');
  luck.className = 'stat-cell luck';
  luck.innerHTML = `<span class="stat-label">${t('luck')}</span><span class="stat-val">${run.state.luck}/${GAME.LUCK_TARGET}</span>`;
  const track = document.createElement('div');
  track.className = 'stat-track';
  const fill = document.createElement('div');
  fill.className = 'stat-fill';
  fill.style.background = '#ffd84e';
  fill.style.width = Math.min(100, (run.state.luck / GAME.LUCK_TARGET) * 100) + '%';
  track.appendChild(fill);
  luck.appendChild(track);
  bar.appendChild(luck);

  $('hud-age').textContent = t('age') + ' ' + (run.state.age >= 0 ? run.state.age : '—');
}

function renderLife() {
  renderStats();
  const log = $('life-log');
  if (!log || !run) return;
  log.innerHTML = '';
  for (const it of run.state.track) {
    const row = document.createElement('div');
    row.className = 'track-row track-' + it.kind;
    const age = document.createElement('span');
    age.className = 'track-age';
    if (it.age >= 0) age.textContent = it.age + '';
    const text = document.createElement('span');
    text.className = 'track-text';
    text.textContent = it.text[i18n.lang] || it.text.en;
    row.appendChild(age);
    row.appendChild(text);
    log.appendChild(row);
  }
  log.scrollTop = log.scrollHeight;
  renderActionBar();
}

function finishRun() {
  stopAuto();
  $('choice-card').classList.add('hidden');
  setPhase('summary');
  ui.show('summary');
  const s = run.state.summary;
  if (s.stars > bestStars) bestStars = s.stars;
  for (const id of run.state.records) {
    if (!records.includes(id)) records.push(id);
  }
  persist();
  $('summary-stars').textContent = '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars);
  $('summary-score').textContent = t('score') + ': ' + s.score;
  $('summary-grade').textContent = t('grade') + ': ' + gradeLabel(s.grade);
  $('summary-meta').textContent = t('age') + ': ' + s.age + ' · ' + t('records') + ': ' + records.length;
  $('btn-replay').textContent = t('replay');
  $('btn-home2').textContent = t('home');
}

function gradeLabel(g) {
  return t(['gradeOrdinary', 'gradeExcellent', 'gradeRare', 'gradeLegend'][g] || 'gradeOrdinary');
}

// ---------------- 事件消费 ----------------

const TUT_TRIGGERS = ['talentPick', 'talentPick', 'year'];

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    if (ev.type === 'choice') showChoice(ev.choice);
    else if (ev.type === 'summary') { finishRun(); return; }
  }
  if (!run) return;
  if (phase === 'life') renderLife();
  else if (phase === 'talent') buildTalentGrid();
  else if (phase === 'allocate') buildAllocList();
}

function drainAndRender() {
  if (!run) return;
  handleEvents(run.drainEvents());
}

// ---------------- 教程 ----------------

const TUT_STEPS = () => [
  { id: 'pick', text: t('tutStep1'), spot: '#talent-grid' },
  { id: 'invest', text: t('tutStep2'), spot: '#alloc-list' },
  { id: 'live', text: t('tutStep3'), spot: '#btn-next-year' },
];

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
  const spot = $('tut-spotlight');
  const target = s && s.spot ? document.querySelector(s.spot) : null;
  if (target && target.getBoundingClientRect().width > 0) {
    const cr = $('game-container').getBoundingClientRect();
    const r = target.getBoundingClientRect();
    spot.style.display = 'block';
    spot.style.left = (r.left - cr.left - 8) + 'px';
    spot.style.top = (r.top - cr.top - 8) + 'px';
    spot.style.width = (r.width + 16) + 'px';
    spot.style.height = (r.height + 16) + 'px';
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

function tutorialAdvance(evType) {
  if (tutorialStep < 0) return;
  if (TUT_TRIGGERS[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGERS.length) endTutorial();
  else renderTutorialStep();
}

// ---------------- 输入 ----------------

function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', start);
  on('btn-howto', () => startTutorial());
  on('btn-confirm-talents', confirmTalents);
  on('btn-alloc-random', randomAlloc);
  on('btn-start-life', startLife);
  on('btn-next-year', nextYear);
  on('btn-auto', toggleAuto);
  on('btn-speed', cycleSpeed);
  on('btn-choice-a', () => resolveChoice('a'));
  on('btn-choice-b', () => resolveChoice('b'));
  on('btn-resume', resumeGame);
  on('btn-replay', replay);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-restart', () => startRun());
  on('btn-mute', toggleMute);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTitle();
      if (run && phase === 'life') renderLife();
      else if (run && phase === 'talent') buildTalentGrid();
      else if (run && phase === 'allocate') buildAllocList();
      else if (run && phase === 'summary') finishRun();
      const rt = $('rotate-text');
      const rb = $('btn-rotate-skip');
      if (rt) rt.textContent = t('rotateHint');
      if (rb) rb.textContent = t('rotateSkip');
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'paused') resumeGame();
      else pauseGame();
    }
    if (e.code === 'KeyM') toggleMute();
  });
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------------- 主循环 ----------------

function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  if (phase !== 'paused' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
  }
  renderer.draw(run ? run.state : null, dt);
  requestAnimationFrame(frame);
}

// ---------------- 调试契约 ----------------

window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  },
  get run() { return run; },
  start: () => start(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => goHome(),
  home: () => goHome(),
  replay: () => replay(),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['pick', 'invest', 'live']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    phase: () => phase,
    pickBestTalents: () => {
      if (!run || phase !== 'talent') return false;
      for (const i of [0, 1, 2]) run.pickTalent(i);
      confirmTalents();
      return phase === 'allocate';
    },
    autoAllocate: () => { if (!run) return false; run.autoAllocate(); return true; },
    startLife: () => { startLife(); return true; },
    advanceTo: (n) => {
      if (!run) return false;
      let guard = 300;
      while (guard-- > 0 && run.state.phase === 'life' && run.state.age < n) {
        if (run.state.pendingChoice) break;
        run.nextYear();
        drainAndRender();
      }
      return true;
    },
    resolveChoice: (o) => { if (!run) return false; run.resolveChoice(o || 'a'); $('choice-card').classList.add('hidden'); drainAndRender(); return true; },
    fastLife: () => {
      if (!run) return false;
      let guard = 300;
      while (guard-- > 0 && run.state.phase === 'life') {
        if (run.state.pendingChoice) {
          run.resolveChoice('a');
          $('choice-card').classList.add('hidden');
        } else {
          run.nextYear();
        }
        drainAndRender();
      }
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

window.G = { get run() { return run; }, phase: () => phase };

// ---------------- 启动 ----------------

bind();
syncDocumentLang();
ui.applyLang();
{
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}
renderTitle();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
