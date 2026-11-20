// src/ui/screens.js — 标题 / 暂停 / 设置 / 结算 四屏 DOM 构建。
// 契约：createScreens(root) → { els, setBest(best), renderResult(data) }。
import { t, i18n } from '../core/i18n.js';

export function createScreens(root) {
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  // ---------- 标题（初始可见：boot 期即可点击 Start，配合 main 的 boot 竞态守卫） ----------
  const title = el('div', 'screen title-screen');
  title.innerHTML = `
    <select id="lang-select" class="lang-select" aria-label="${t('set.language')}"></select>
    <div class="title-inner">
      <h1 class="title-logo" data-i18n="title.logo">${t('title.logo')}</h1>
      <p class="title-tagline" data-i18n="title.tagline">${t('title.tagline')}</p>
      <p class="title-best" id="title-best"></p>
      <div class="title-actions">
        <button id="btn-start" class="btn btn-primary" data-i18n="btn.start">${t('btn.start')}</button>
        <button id="btn-how" class="btn btn-ghost" data-tutorial-replay="1" data-i18n="btn.how">${t('btn.how')}</button>
        <button id="btn-settings" class="btn btn-ghost" data-i18n="btn.settings">${t('btn.settings')}</button>
      </div>
    </div>`;

  // ---------- 暂停 ----------
  const pause = el('div', 'screen pause-screen hidden');
  pause.innerHTML = `
    <div class="pause-inner">
      <h2 class="pause-title" data-i18n="pause.title">${t('pause.title')}</h2>
      <p class="pause-hint" data-i18n="pause.hint">${t('pause.hint')}</p>
      <div class="pause-actions">
        <button id="btn-resume" class="btn btn-primary" data-i18n="btn.resume">${t('btn.resume')}</button>
        <button id="btn-restart" class="btn btn-ghost" data-i18n="btn.restart">${t('btn.restart')}</button>
        <button id="btn-how-pause" class="btn btn-ghost" data-tutorial-replay="1" data-i18n="btn.how">${t('btn.how')}</button>
      </div>
      <select id="lang-select-pause" class="lang-select" aria-label="${t('set.language')}"></select>
    </div>`;

  // ---------- 设置 ----------
  const settings = el('div', 'screen settings-screen hidden');
  settings.innerHTML = `
    <div class="settings-inner">
      <h2 class="settings-title" data-i18n="set.title">${t('set.title')}</h2>
      <div class="settings-row">
        <span data-i18n="set.language">${t('set.language')}</span>
        <select id="lang-select-settings" class="lang-select" aria-label="${t('set.language')}"></select>
      </div>
      <button id="btn-settings-back" class="btn btn-ghost" data-i18n="btn.back">${t('btn.back')}</button>
    </div>`;

  // ---------- 结算 ----------
  const result = el('div', 'screen result-screen hidden');
  result.innerHTML = `
    <div class="result-inner">
      <div class="result-badge hidden" id="result-badge" data-i18n="result.newRecord">${t('result.newRecord')}</div>
      <h2 class="result-title" id="result-title"></h2>
      <p class="result-hint" data-i18n="result.hint">${t('result.hint')}</p>
      <ul class="result-rows">
        <li><span data-i18n="result.score">${t('result.score')}</span><b id="result-score">0</b></li>
        <li><span data-i18n="result.level">${t('result.level')}</span><b id="result-level">1</b></li>
        <li><span data-i18n="result.best">${t('result.best')}</span><b id="result-best">1</b></li>
      </ul>
      <div class="result-actions">
        <button id="btn-again" class="btn btn-primary" data-i18n="btn.restart">${t('btn.restart')}</button>
        <button id="btn-share" class="btn btn-ghost" data-i18n="btn.share">${t('btn.share')}</button>
      </div>
    </div>`;

  for (const s of [title, pause, settings, result]) root.appendChild(s);

  const els = {
    title,
    pause,
    settings,
    result,
    langSelects: [title.querySelector('#lang-select'), pause.querySelector('#lang-select-pause'), settings.querySelector('#lang-select-settings')],
    btnStart: title.querySelector('#btn-start'),
    btnHow: title.querySelector('#btn-how'),
    btnHowPause: pause.querySelector('#btn-how-pause'),
    btnSettings: title.querySelector('#btn-settings'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    btnResume: pause.querySelector('#btn-resume'),
    btnRestart: pause.querySelector('#btn-restart'),
    btnAgain: result.querySelector('#btn-again'),
    btnShare: result.querySelector('#btn-share'),
    titleBest: title.querySelector('#title-best'),
    resultTitle: result.querySelector('#result-title'),
    resultScore: result.querySelector('#result-score'),
    resultLevel: result.querySelector('#result-level'),
    resultBest: result.querySelector('#result-best'),
    resultBadge: result.querySelector('#result-badge'),
  };

  let bestLevel = 1;
  let bestScore = 0;

  function setBest(level, score = 0) {
    bestLevel = Math.max(1, Math.floor(level || 1));
    bestScore = Math.max(0, Math.floor(score || 0));
    els.titleBest.textContent = t('title.best', { level: bestLevel, score: bestScore });
  }

  function renderResult(data) {
    data = data || {};
    const win = !!data.won;
    els.resultTitle.textContent = t(win ? 'result.win' : 'result.fail');
    els.resultScore.textContent = String(Math.floor(data.score || 0));
    els.resultLevel.textContent = String(Math.max(1, Math.floor(data.level || 1)));
    els.resultBest.textContent = String(bestLevel);
    els.resultBadge.classList.toggle('hidden', !data.newRecord);
  }

  return { els, setBest, renderResult };
}
