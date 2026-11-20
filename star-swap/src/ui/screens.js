// src/ui/screens.js — 标题 / 暂停 / 结算 / 设置 四屏 DOM + 语言下拉
import { t } from '../core/i18n.js';

function langSelect(id) {
  return `<select id="${id}" class="lang-select" aria-label="${t('set.language')}"></select>`;
}

export function createScreens(root) {
  const wrap = document.createElement('div');
  wrap.id = 'ui-screens';
  wrap.innerHTML =
    // 标题屏
    '<div id="screen-title" class="screen is-active">' +
    langSelect('lang-select') +
    '<div class="title-inner">' +
    '<div class="title-logo" data-i18n="title.logo">STAR SWAP</div>' +
    '<div class="title-tagline" data-i18n="title.tagline"></div>' +
    '<div class="title-best" id="title-best"></div>' +
    '<div class="title-actions">' +
    '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start"></button>' +
    '<button id="btn-how" class="btn btn-ghost" type="button" data-i18n="btn.how" data-tutorial-replay></button>' +
    '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings"></button>' +
    '</div></div></div>' +

    // 暂停屏
    '<div id="screen-pause" class="screen hidden">' +
    '<div class="pause-inner">' +
    '<div class="pause-title" data-i18n="pause.title"></div>' +
    '<div class="pause-hint" data-i18n="pause.hint"></div>' +
    '<div class="pause-actions">' +
    '<button id="btn-resume" class="btn btn-primary" type="button" data-i18n="btn.resume"></button>' +
    '<button id="btn-how-pause" class="btn btn-ghost" type="button" data-i18n="btn.how" data-tutorial-replay></button>' +
    '<button id="btn-restart" class="btn btn-ghost" type="button" data-i18n="btn.restart"></button>' +
    '</div></div></div>' +

    // 结算屏
    '<div id="screen-result" class="screen hidden">' +
    '<div class="result-inner">' +
    '<div class="result-title" id="result-title"></div>' +
    '<div class="result-badge hidden" id="result-badge" data-i18n="result.newRecord"></div>' +
    '<ul class="result-rows">' +
    '<li><span data-i18n="result.score"></span><b id="result-score">0</b></li>' +
    '<li><span data-i18n="result.level"></span><b id="result-level">1</b></li>' +
    '<li><span data-i18n="result.stars"></span><b id="result-stars">★★★</b></li>' +
    '<li><span data-i18n="result.best"></span><b id="result-best">0</b></li>' +
    '</ul>' +
    '<div class="result-hint" id="result-hint"></div>' +
    '<div class="pause-actions">' +
    '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.again"></button>' +
    '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
    '</div></div></div>' +

    // 设置屏
    '<div id="screen-settings" class="screen hidden">' +
    '<div class="settings-inner">' +
    '<div class="settings-title" data-i18n="set.title"></div>' +
    '<div class="settings-row"><span data-i18n="set.language"></span>' + langSelect('lang-select-settings') + '</div>' +
    '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div></div>';
  root.appendChild(wrap);

  const q = (sel) => wrap.querySelector(sel);
  const els = {
    title: q('#screen-title'),
    pause: q('#screen-pause'),
    result: q('#screen-result'),
    settings: q('#screen-settings'),
    btnStart: q('#btn-start'),
    btnHow: q('#btn-how'),
    btnHowPause: q('#btn-how-pause'),
    btnSettings: q('#btn-settings'),
    btnSettingsBack: q('#btn-settings-back'),
    btnResume: q('#btn-resume'),
    btnRestart: q('#btn-restart'),
    btnAgain: q('#btn-again'),
    btnShare: q('#btn-share'),
    titleBest: q('#title-best'),
    resultTitle: q('#result-title'),
    resultBadge: q('#result-badge'),
    resultScore: q('#result-score'),
    resultLevel: q('#result-level'),
    resultStars: q('#result-stars'),
    resultBest: q('#result-best'),
    resultHint: q('#result-hint'),
    langSelects: [q('#lang-select'), q('#lang-select-settings')],
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { score: Math.floor(best || 0) });
  }

  function renderResult(data) {
    if (!data) return;
    const win = !!data.win;
    els.resultTitle.textContent = t(win ? 'result.win.title' : 'result.fail.title');
    els.resultScore.textContent = String(data.score ?? 0);
    els.resultLevel.textContent = String(data.level ?? 1);
    const stars = Math.max(0, Math.min(3, data.stars || 0));
    els.resultStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    els.resultBest.textContent = String(data.best ?? 0);
    els.resultHint.textContent = t(win ? 'result.hint.win' : 'result.hint.fail');
    els.resultBadge.classList.toggle('hidden', !data.newRecord);
  }

  return { els, setBest, renderResult };
}
