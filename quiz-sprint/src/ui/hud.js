// src/ui/hud.js — HUD：名次 / 体力条 / 连击 / 距离 / 赛段 + 题目面板（可点击选项）。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档（语言经 i18n）。
import { i18n, t } from '../core/i18n.js';

export function createHud(root) {
  // 顶部统计条
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.race"></span><b id="hud-race">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.rank"></span><b id="hud-rank">1</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="stamina-wrap">' +
        '<span class="hud-label" data-i18n="hud.stamina"></span>' +
        '<div class="stamina-track"><i class="stamina-fill" id="stamina-fill"></i></div>' +
      '</div>' +
      '<div class="hud-combo" id="hud-combo" hidden><span data-i18n="hud.combo"></span><b id="hud-combo-n">0</b><em id="hud-scholar" class="scholar-badge" hidden data-i18n="hud.scholar"></em></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.distance"></span><b id="hud-distance">0/60</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.wins"></span><b id="hud-wins">0</b></div>' +
    '</div>';

  // 题目面板（可点击）
  let qp = root.querySelector('#question-panel');
  if (!qp) {
    qp = document.createElement('div');
    qp.id = 'question-panel';
    root.appendChild(qp);
  }
  qp.className = 'question-panel hidden';
  qp.setAttribute('aria-hidden', 'true');
  qp.innerHTML =
    '<div class="q-top">' +
      '<span class="q-category" id="q-category"></span>' +
      '<span class="q-wager" id="q-wager" hidden data-i18n="q.wager"></span>' +
      '<span class="q-timer" id="q-timer"></span>' +
    '</div>' +
    '<div class="q-text" id="q-text"></div>' +
    '<div class="q-options">' +
      '<button class="q-opt" id="opt-0" type="button"></button>' +
      '<button class="q-opt" id="opt-1" type="button"></button>' +
      '<button class="q-opt" id="opt-2" type="button"></button>' +
      '<button class="q-opt" id="opt-3" type="button"></button>' +
    '</div>' +
    '<button class="q-skip" id="opt-skip" type="button" hidden data-i18n="btn.skipWager"></button>' +
    '<div class="q-feedback" id="q-feedback" hidden></div>';

  const raceEl = el.querySelector('#hud-race');
  const rankEl = el.querySelector('#hud-rank');
  const staminaFill = el.querySelector('#stamina-fill');
  const comboWrap = el.querySelector('#hud-combo');
  const comboN = el.querySelector('#hud-combo-n');
  const scholarBadge = el.querySelector('#hud-scholar');
  const distanceEl = el.querySelector('#hud-distance');
  const winsEl = el.querySelector('#hud-wins');
  const categoryEl = qp.querySelector('#q-category');
  const wagerEl = qp.querySelector('#q-wager');
  const timerEl = qp.querySelector('#q-timer');
  const textEl = qp.querySelector('#q-text');
  const optButtons = [0, 1, 2, 3].map((i) => qp.querySelector('#opt-' + i));
  const skipBtn = qp.querySelector('#opt-skip');
  const feedbackEl = qp.querySelector('#q-feedback');

  function categoryName(cat) {
    const key = 'cat.' + cat;
    const text = t(key);
    return text !== key ? text : cat;
  }

  function rankSuffix(rank) {
    if (rank === 1) return '1st';
    if (rank === 2) return '2nd';
    if (rank === 3) return '3rd';
    return `${rank}th`;
  }

  let lastResultKey = null;

  return {
    el,
    questionPanel: qp,
    optButtons,
    skipBtn,

    setHud(h) {
      h = h || {};
      raceEl.textContent = String(Math.max(1, Math.floor(h.level ?? 1)));
      rankEl.textContent = rankSuffix(Math.max(1, Math.min(4, Math.floor(h.rank ?? 1))));
      const pct = Math.max(0, Math.min(100, ((h.stamina ?? 0) / Math.max(1, h.staminaMax ?? 100)) * 100));
      staminaFill.style.width = pct.toFixed(1) + '%';
      staminaFill.classList.toggle('low', (h.stamina ?? 0) < 30);
      comboWrap.hidden = !(h.combo > 0);
      comboN.textContent = String(h.combo ?? 0);
      scholarBadge.hidden = !h.scholarActive;
      distanceEl.textContent = `${Math.floor(h.distance ?? 0)}/${Math.floor(h.raceDistance ?? 0)}`;
      winsEl.textContent = `${Math.floor(h.wins ?? 0)}-${Math.floor(h.losses ?? 0)}`;

      // 题目面板
      const q = h.question;
      if (q) {
        qp.classList.remove('hidden');
        qp.setAttribute('aria-hidden', 'false');
        const lang = i18n.lang === 'zh' ? 'zh' : 'en';
        const data = q.q[lang] || q.q.en;
        categoryEl.textContent = categoryName(q.category);
        wagerEl.hidden = !q.wager;
        timerEl.textContent = `${Math.max(0, q.timer)}s`;
        textEl.textContent = data.text;
        data.options.forEach((opt, i) => {
          optButtons[i].textContent = opt;
          optButtons[i].classList.toggle('hovered', i === this._hover);
        });
        skipBtn.hidden = !q.wager;
      } else {
        qp.classList.add('hidden');
        qp.setAttribute('aria-hidden', 'true');
      }

      // 作答反馈
      const r = h.lastResult;
      const rKey = r ? `${r.correct}-${r.skip}-${r.timeout}-${r.category}` : null;
      if (r && rKey !== lastResultKey) {
        lastResultKey = rKey;
        let msg = r.correct ? t('q.correct') : r.skip ? t('q.skipped') : r.timeout ? t('q.timeout') : t('q.wrong');
        feedbackEl.textContent = msg;
        feedbackEl.classList.remove('flash');
        feedbackEl.hidden = false;
        void feedbackEl.offsetWidth;
        feedbackEl.classList.add('flash');
      }
    },

    setHover(i) {
      this._hover = i;
    },

    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() {
      el.classList.add('hidden');
      el.setAttribute('aria-hidden', 'true');
      qp.classList.add('hidden');
      qp.setAttribute('aria-hidden', 'true');
    },
  };
}
