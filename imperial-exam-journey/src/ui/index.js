// src/ui/index.js — createUI 装配：标题 / HUD / 作答栏 / 提示卡 / 暂停 / 结算 / 首次引导 / i18n。
// 契约：createUI(root, hooks) → { show, setHud, setBest, setDifficulty, getDifficulty, setResult, applyLang, els, tutorial, lang, dir, inputEl }
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { DIFFICULTIES } from '../../config/idioms.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';

function $(sel, root) { return root.querySelector(sel); }

export function createUI(root, hooks = {}) {
  const els = {
    hud: $('#hud', root),
    hudTimer: $('#hud-timer', root),
    hudScore: $('#hud-score', root),
    hudCombo: $('#hud-combo', root),
    hudHints: $('#hud-hints', root),
    hudDiff: $('#hud-diff', root),
    hudStars: $('#hud-stars', root),
    btnMute: $('#btn-mute', root),
    btnHow: $('#btn-howto', root),
    btnHowHud: $('#btn-howto-hud', root),
    btnPause: $('#btn-pause', root),
    screenTitle: $('#screen-title', root),
    screenPause: $('#screen-pause', root),
    screenResult: $('#screen-result', root),
    langSelect: $('#lang-select', root),
    langSelectPause: $('#lang-select-pause', root),
    titleText: $('#title-text', root),
    subtitleText: $('#subtitle-text', root),
    btnStart: $('#btn-start', root),
    btnHowPause: $('#btn-howto-pause', root),
    bestScore: $('#best-score', root),
    difficultyRow: $('#difficulty-row', root),
    diffBtns: [1, 2, 3].map((d) => $(`#btn-diff-${d}`, root)),
    pauseTitle: $('#pause-title', root),
    btnResume: $('#btn-resume', root),
    btnRestart2: $('#btn-restart2', root),
    resultTitle: $('#result-title', root),
    resultRank: $('#result-rank', root),
    resultStars: $('#result-stars', root),
    resultScore: $('#result-score', root),
    resultMeta: $('#result-meta', root),
    btnRetry: $('#btn-retry', root),
    btnHome: $('#btn-home', root),
    answerBar: $('#answer-bar', root),
    answerInput: $('#answer-input', root),
    btnHint: $('#btn-hint', root),
    btnSubmit: $('#btn-submit', root),
    hintCard: $('#hint-card', root),
    loading: $('#loading', root),
    loadingText: $('#loading-text', root),
    rotateText: $('#rotate-text', root),
    btnRotateSkip: $('#btn-rotate-skip', root),
  };

  const machine = new TutorialMachine({
    save: (k, v) => hooks.save ? hooks.save(k, v) : null,
    load: (k, d) => hooks.load ? hooks.load(k, d) : null,
    key: TUTORIAL_KEY,
  });
  const overlay = createTutorialOverlay(root, machine);
  machine.onDone = () => overlay.hide();

  let difficulty = 2;
  let lastHud = null;
  let lastResult = null;
  let best = 0;

  function fillLang() {
    for (const sel of [els.langSelect, els.langSelectPause]) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const opt of i18n.options()) {
        const o = document.createElement('option');
        o.value = opt.code;
        o.textContent = opt.name;
        if (opt.code === i18n.lang) o.selected = true;
        sel.appendChild(o);
      }
      sel.setAttribute('aria-label', t('language'));
    }
  }

  function renderDifficulty() {
    for (const d of [1, 2, 3]) {
      const btn = els.diffBtns[d - 1];
      if (!btn) continue;
      const cfg = DIFFICULTIES[d];
      const label = i18n.lang === 'zh' ? cfg.label.zh : cfg.label.en;
      const score = i18n.lang === 'zh' ? t(`diff.${cfg.key}.score`) : t(`diff.${cfg.key}.score`);
      btn.innerHTML = `<span>${label}</span><span class="diff-score">${score}</span>`;
      btn.classList.toggle('is-active', d === difficulty);
    }
  }

  function renderStatic() {
    els.titleText.textContent = t('title');
    els.subtitleText.textContent = t('subtitle');
    els.btnStart.textContent = t('start');
    els.pauseTitle.textContent = t('paused');
    els.btnResume.textContent = t('resume');
    els.btnRestart2.textContent = t('restart');
    els.btnHow.textContent = t('howto');
    els.btnHowPause.textContent = t('howto');
    els.btnHowHud.textContent = '?';
    els.btnRetry.textContent = t('retry');
    els.btnHome.textContent = t('restart');
    els.answerInput.placeholder = t('answer.placeholder');
    els.answerInput.setAttribute('aria-label', t('answer.placeholder'));
    els.btnHint.title = t('answer.hint');
    els.btnSubmit.title = t('answer.submit');
    els.loadingText.textContent = t('loading');
    els.rotateText.textContent = t('rotate.text');
    els.btnRotateSkip.textContent = t('rotate.skip');
    renderDifficulty();
    renderBest();
    if (lastResult) renderResult(lastResult);
    if (lastHud) setHud(lastHud);
    overlay.render();
  }

  function renderBest() {
    els.bestScore.textContent = best > 0 ? `${t('best')}: ${Math.round(best * 10) / 10}` : '';
  }

  function applyLang() {
    syncDocumentLang();
    fillLang();
    renderStatic();
  }

  function setBest(b) {
    best = Math.max(0, Number(b) || 0);
    renderBest();
  }

  function setDifficulty(d) {
    difficulty = Math.min(3, Math.max(1, Math.round(d)));
    renderDifficulty();
    return difficulty;
  }

  function getDifficulty() {
    return difficulty;
  }

  function show(screen, data) {
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isResult = screen === 'finished' || screen === 'result';

    els.screenTitle.classList.toggle('hidden', !isTitle);
    els.screenPause.classList.toggle('hidden', !isPaused);
    els.screenResult.classList.toggle('hidden', !isResult);

    els.hud.classList.toggle('hidden', !isPlaying);
    els.answerBar.classList.toggle('hidden', !isPlaying);
    if (!isPlaying) els.hintCard.classList.add('hidden');

    if (isResult && data) {
      lastResult = data;
      renderResult(data);
    }

    if (isPlaying) {
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
      setTimeout(() => { try { els.answerInput.focus({ preventScroll: true }); } catch { /* noop */ } }, 60);
    } else {
      overlay.hide();
    }

    if (isTitle || isPaused) applyLang();
  }

  function setHud(h) {
    lastHud = h || {};
    const c = h.current;
    els.hudTimer.textContent = c ? `${Math.ceil(c.timer)}s` : '—';
    els.hudScore.textContent = `${Math.round(h.score * 10) / 10}`;
    els.hudCombo.textContent = `×${h.combo >= 1 ? Math.round(Math.min(1 + (h.combo - 1) * 0.2, 2) * 10) / 10 : 1}`;
    els.hudCombo.classList.toggle('combo-on', h.combo >= 2);
    els.hudTimer.classList.toggle('time-low', !!c && c.timer <= 5);
    els.hudHints.textContent = `✎${h.hints}`;
    els.hudStars.textContent = `★${h.totalStars}`;
    const diff = DIFFICULTIES[h.difficulty] || DIFFICULTIES[2];
    els.hudDiff.textContent = i18n.lang === 'zh' ? diff.label.zh : diff.label.en;

    // 提示卡
    if (c && c.hinted) {
      const meaning = i18n.lang === 'zh' ? c.meaningZh : c.meaningEn;
      els.hintCard.textContent = `${t('hint.used')} · ${meaning}`;
      els.hintCard.classList.remove('hidden');
    } else {
      els.hintCard.classList.add('hidden');
    }
  }

  function rankIndex(stars) {
    if (stars >= 35) return 4;
    if (stars >= 20) return 3;
    if (stars >= 10) return 2;
    if (stars >= 5) return 1;
    return 0;
  }

  function renderResult(data) {
    const win = data.win === true;
    els.resultTitle.textContent = win ? t('result.title') : t('result.timeout.title');
    els.resultRank.textContent = t('rank.' + rankIndex(data.totalStars || 0));
    const starCount = Math.max(0, Math.floor(data.totalStars || 0));
    els.resultStars.textContent = starCount > 0 ? '★'.repeat(Math.min(starCount, 20)) : '☆☆☆';
    els.resultScore.textContent = `${t('result.score')}: ${Math.round((data.score || 0) * 10) / 10}`;
    const meta = `${data.riddlesSolved || 0} · ${t('combo')} ${data.maxCombo || 0} · ${t('hints')} ${data.hintsUsed || 0}`;
    els.resultMeta.innerHTML = `${meta}<br>${win ? t('result.win') : t('result.timeout')}`;
  }

  // 事件绑定
  els.btnStart.addEventListener('click', () => (hooks.onStart || (() => {}))());
  els.btnResume.addEventListener('click', () => (hooks.onResume || (() => {}))());
  els.btnRestart2.addEventListener('click', () => (hooks.onHome || (() => {}))());
  els.btnRetry.addEventListener('click', () => (hooks.onStart || (() => {}))());
  els.btnHome.addEventListener('click', () => (hooks.onHome || (() => {}))());
  els.btnPause.addEventListener('click', () => (hooks.onPause || (() => {}))());
  els.btnMute.addEventListener('click', () => (hooks.onMute || (() => {}))());
  els.btnSubmit.addEventListener('click', () => (hooks.onSubmit || (() => {}))());
  els.btnHint.addEventListener('click', () => (hooks.onHint || (() => {}))());

  const replay = () => {
    machine.replay();
    overlay.show();
  };
  els.btnHow.addEventListener('click', replay);
  els.btnHowHud.addEventListener('click', replay);
  els.btnHowPause.addEventListener('click', replay);

  for (const btn of els.diffBtns) {
    if (!btn) continue;
    btn.addEventListener('click', () => setDifficulty(Number(btn.dataset.difficulty)));
  }

  for (const sel of [els.langSelect, els.langSelectPause]) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => {
      if (i18n.setLang(e.target.value)) applyLang();
    });
  }

  applyLang();

  return {
    show,
    setHud,
    setBest,
    setDifficulty,
    getDifficulty,
    setResult: (d) => { lastResult = d; renderResult(d); },
    applyLang,
    els,
    tutorial: {
      machine,
      overlay,
      get active() { return machine.active; },
      get step() { return machine.step; },
      get steps() { return TUT_STEP_IDS; },
      get current() { return machine.currentId; },
      begin: () => machine.begin(),
      replay,
      skip: () => machine.skip(),
      state: () => machine.snapshot(),
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
    inputEl: els.answerInput,
  };
}

export default createUI;
