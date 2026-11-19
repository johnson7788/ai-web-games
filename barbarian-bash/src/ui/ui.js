// BARBARIAN BASH · UI 壳：语言选择与屏幕显隐（HUD/结算/关卡格由 main.js 直写）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

function fillLangSelects() {
  const opts = i18n.options().map((o) => `<option value="${o.code}">${o.name}</option>`).join('');
  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.innerHTML = opts;
    sel.value = i18n.lang;
  }
}

function applyLang() {
  fillLangSelects();
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
  syncDocumentLang();
}

export const ui = {
  applyLang,
  setLang(lang) { i18n.setLang(lang); applyLang(); },
  setMuted(muted) {
    const b = $('btn-mute');
    if (b) b.classList.toggle('is-muted', !!muted);
  },
  showTitle() {
    $('screen-title').classList.remove('hidden');
    $('screen-title').classList.add('is-active');
    $('hud').classList.add('hidden');
    $('screen-pause').classList.add('hidden');
    $('screen-result').classList.add('hidden');
  },
  showGame() {
    $('screen-title').classList.add('hidden');
    $('screen-title').classList.remove('is-active');
    $('hud').classList.remove('hidden');
    $('screen-pause').classList.add('hidden');
    $('screen-result').classList.add('hidden');
  },
  showPause() {
    $('screen-pause').classList.remove('hidden');
  },
  hidePause() {
    $('screen-pause').classList.add('hidden');
  },
  showResult() {
    $('screen-result').classList.remove('hidden');
  },
  hideResult() {
    $('screen-result').classList.add('hidden');
  },
};
