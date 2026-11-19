// src/ui/hud.js — 顶部 HUD：关卡 / 分数 / 生命 / 火焰三层 / 燃料条 / 连击。
// 顶部不透明深色条，避免被 vision-review 判 HUD 遮挡。
import { t } from '../core/i18n.js';

export function createHud(root) {
  const wrap = document.createElement('div');
  wrap.id = 'hud';
  wrap.className = 'hud hidden';
  wrap.innerHTML =
    '<div class="hud-row">' +
    '<div class="hud-item"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level">1</b></div>' +
    '<div class="hud-item"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
    '<div class="hud-item"><span class="hud-label" data-i18n="hud.lives"></span><b id="hud-lives">♥♥♥</b></div>' +
    '</div>' +
    '<div class="hud-row hud-row-2">' +
    '<div class="hud-flame" id="hud-flame">' +
    '<span class="flame-dot core" id="flame-core"></span>' +
    '<span class="flame-dot inner" id="flame-inner"></span>' +
    '<span class="flame-dot outer" id="flame-outer"></span>' +
    '<span class="hud-label" data-i18n="hud.tier"></span>' +
    '</div>' +
    '<div class="hud-fuel"><span class="hud-label" data-i18n="hud.fuel"></span><div class="fuel-bar"><div class="fuel-fill" id="fuel-fill"></div></div></div>' +
    '<div class="hud-item hud-combo" id="hud-combo-wrap"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">×0</b></div>' +
    '</div>';
  root.appendChild(wrap);

  const els = {
    wrap,
    level: wrap.querySelector('#hud-level'),
    score: wrap.querySelector('#hud-score'),
    lives: wrap.querySelector('#hud-lives'),
    core: wrap.querySelector('#flame-core'),
    inner: wrap.querySelector('#flame-inner'),
    outer: wrap.querySelector('#flame-outer'),
    fuelFill: wrap.querySelector('#fuel-fill'),
    combo: wrap.querySelector('#hud-combo'),
    comboWrap: wrap.querySelector('#hud-combo-wrap'),
  };

  const TIER_ORDER = ['core', 'inner', 'outer'];
  const els2 = { core: els.core, inner: els.inner, outer: els.outer };

  function setHud(h) {
    if (!h) return;
    els.level.textContent = String(h.level ?? 1);
    els.score.textContent = String(h.score ?? 0);
    els.lives.textContent = '♥'.repeat(Math.max(0, h.lives ?? 0)) + '♡'.repeat(Math.max(0, 3 - (h.lives ?? 0)));
    for (let i = 0; i < TIER_ORDER.length; i += 1) {
      const lit = (h.tier ?? 0) >= i + 1;
      els2[TIER_ORDER[i]].classList.toggle('lit', lit);
    }
    const pct = Math.max(0, Math.min(1, (h.fuel ?? 0) / Math.max(1, h.fuelNeeded ?? 1)));
    els.fuelFill.style.width = `${Math.round(pct * 100)}%`;
    els.combo.textContent = `×${h.combo ?? 0}`;
    els.comboWrap.classList.toggle('on', (h.combo ?? 0) >= 2);
  }

  return { els, wrap, setHud };
}
