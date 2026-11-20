// src/ui/hud.js — HUD：顶部不透明条（名次/倒计时/体型/目标）+ 底部不透明条（街区/连锁/陨石）。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
// 上下两条不透明底条把可交互画布让在中间，避免 HUD 压住玩法主体。
import { t } from '../core/i18n.js';

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
    '<div class="hud-bar hud-top">' +
      '<div class="hud-cell hud-rank"><span class="hud-label" data-i18n="hud.rank"></span><b id="hud-rank">#6</b></div>' +
      '<div class="hud-cell hud-time"><span class="hud-label" data-i18n="hud.time"></span><b id="hud-time">2:00</b></div>' +
      '<div class="hud-cell hud-score"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-goal" id="hud-goal" data-i18n="hud.goal"></div>' +
    '</div>' +
    '<div class="hud-bar hud-bottom">' +
      '<div class="hud-scene" id="hud-scene"></div>' +
      '<div class="hud-chain" id="hud-chain">' +
        '<span class="hud-label" data-i18n="hud.chain"></span>' +
        '<div class="chain-track"><i class="chain-fill" id="chain-fill"></i></div>' +
        '<b id="hud-chain-num">0/10</b>' +
      '</div>' +
      '<div class="hud-meteor hidden" id="hud-meteor" data-i18n="hud.meteor"></div>' +
    '</div>';

  const timeEl = el.querySelector('#hud-time');
  const scoreEl = el.querySelector('#hud-score');
  const rankEl = el.querySelector('#hud-rank');
  const goalEl = el.querySelector('#hud-goal');
  const sceneEl = el.querySelector('#hud-scene');
  const chainEl = el.querySelector('#hud-chain');
  const fillEl = el.querySelector('#chain-fill');
  const chainNumEl = el.querySelector('#hud-chain-num');
  const meteorEl = el.querySelector('#hud-meteor');

  let lastChainActive = false;

  return {
    el,
    setHud(h) {
      h = h || {};
      const s = Math.max(0, Math.ceil(h.timeLeft ?? 0));
      const m = Math.floor(s / 60);
      const sec = s % 60;
      timeEl.textContent = `${m}:${String(sec).padStart(2, '0')}`;
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      rankEl.textContent = '#' + (Number(h.rank) || 6);
      goalEl.textContent = t('hud.goal');
      sceneEl.textContent = t('scene.' + (h.scene || 'old-town'));

      const need = Number(h.chainNeed) || 10;
      const count = Number(h.chainCount) || 0;
      const active = !!h.chainActive;
      const pct = active ? 100 : Math.min(100, (count / need) * 100);
      fillEl.style.width = pct.toFixed(1) + '%';
      chainNumEl.textContent = `${count}/${need}`;
      if (active && !lastChainActive) {
        chainEl.classList.remove('chain-flash');
        void chainEl.offsetWidth;
        chainEl.classList.add('chain-flash');
      }
      lastChainActive = active;

      meteorEl.classList.toggle('hidden', !h.meteorActive);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
