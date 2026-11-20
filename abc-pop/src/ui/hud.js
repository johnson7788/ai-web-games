// src/ui/hud.js — 顶部不透明 HUD：字母进度 / 目标字母卡 / 得分连击。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';
import { LETTER_COUNT } from '../../config/levels.js';

export function createHud(root) {
  let el = root.querySelector('#hud');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hud';
    root.appendChild(el);
  }
  el.className = 'hud hidden';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="hud-left">' +
      '<div class="hud-progress" id="hud-progress"></div>' +
      '<div class="hud-round" id="hud-round"></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div id="target-card" class="target-card">' +
        '<div class="target-letter" id="target-letter"></div>' +
        '<div class="target-prompt" id="target-prompt"></div>' +
      '</div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span data-i18n="hud.streak"></span><b id="hud-streak">0</b></div>' +
      '<div class="hud-stat"><span data-i18n="hud.best"></span><b id="hud-best">0</b></div>' +
    '</div>';

  const progressEl = el.querySelector('#hud-progress');
  const roundEl = el.querySelector('#hud-round');
  const targetCardEl = el.querySelector('#target-card');
  const letterEl = el.querySelector('#target-letter');
  const promptEl = el.querySelector('#target-prompt');
  const scoreEl = el.querySelector('#hud-score');
  const streakEl = el.querySelector('#hud-streak');
  const bestEl = el.querySelector('#hud-best');

  let lastScore = -1;
  let lastLetter = -1;

  function wordLabel(word) {
    if (!word) return '';
    return t.lang === 'zh' ? `${word.zh} ${word.emoji}` : `${word.en} ${word.emoji}`;
  }

  return {
    el,
    targetCardEl,
    setHud(h) {
      h = h || {};
      progressEl.textContent = t('hud.letter') + ' ' + (h.letter || '') + ' · ' + (h.lettersCleared ?? 0) + '/' + LETTER_COUNT;
      roundEl.textContent = t('round.' + (h.round ?? 0));

      const tg = h.target || {};
      if (h.round === 1) {
        letterEl.innerHTML = '<b class="t-up">' + (tg.upper || '') + '</b><span class="t-gap"> </span><b class="t-low">' + (tg.lower || '') + '</b>';
        promptEl.textContent = t('prompt.1', { upper: tg.upper, lower: tg.lower });
      } else {
        letterEl.textContent = tg.letter || '';
        if (h.round === 2 && tg.word) promptEl.textContent = t('prompt.2', { word: wordLabel(tg.word) });
        else promptEl.textContent = t('prompt.0', { letter: tg.letter });
      }

      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      streakEl.textContent = String(Math.max(0, Math.floor(h.streak ?? 0)));
      bestEl.textContent = String(Math.max(0, Math.floor(h.maxStreak ?? 0)));

      // 得分 / 换字母的脉冲（可感知反馈）
      if (h.score !== lastScore) {
        lastScore = h.score;
        scoreEl.parentElement.classList.remove('milestone-flash');
        void scoreEl.parentElement.offsetWidth;
        scoreEl.parentElement.classList.add('milestone-flash');
      }
      if (h.letterIndex !== lastLetter) {
        lastLetter = h.letterIndex;
        targetCardEl.classList.remove('target-flash');
        void targetCardEl.offsetWidth;
        targetCardEl.classList.add('target-flash');
      }
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
