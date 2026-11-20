// src/ui/hud.js — HUD：街区 / 灯油 / 步数 / 目标 / 钥匙 / 线索。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
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
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.block"></span><b id="hud-block">1</b><span class="hud-unit" id="hud-scene"></span></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.goal"></span><b id="hud-goal"></b></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat oil"><span class="hud-label" data-i18n="hud.oil"></span><b id="hud-oil">0</b><i class="hud-bar" id="hud-oil-bar"><i id="hud-oil-fill"></i></i></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.steps"></span><b id="hud-steps">0</b><span class="hud-unit" id="hud-steps-max"></span></div>' +
      '<div class="hud-stat" id="hud-key-stat"><span class="hud-label" data-i18n="hud.keys"></span><b id="hud-keys">0</b></div>' +
      '<div class="hud-stat" id="hud-clue-stat"><span class="hud-label" data-i18n="hud.clues"></span><b id="hud-clues">0</b></div>' +
      '<div class="hud-echo" id="hud-echo"><span data-i18n="hud.echo"></span><kbd>Space</kbd></div>' +
    '</div>';

  const blockEl = el.querySelector('#hud-block');
  const sceneEl = el.querySelector('#hud-scene');
  const goalEl = el.querySelector('#hud-goal');
  const oilEl = el.querySelector('#hud-oil');
  const oilFill = el.querySelector('#hud-oil-fill');
  const stepsEl = el.querySelector('#hud-steps');
  const stepsMaxEl = el.querySelector('#hud-steps-max');
  const keyStat = el.querySelector('#hud-key-stat');
  const keysEl = el.querySelector('#hud-keys');
  const clueStat = el.querySelector('#hud-clue-stat');
  const cluesEl = el.querySelector('#hud-clues');

  return {
    el,
    setHud(h) {
      h = h || {};
      blockEl.textContent = String(Math.max(1, Math.floor(h.block ?? 1)));
      sceneEl.textContent = t('scene.' + (Number(h.scene) || 0));
      goalEl.textContent = t(h.goalKey || 'hud.goal.exit');

      const oil = Math.max(0, Math.floor(h.oil ?? 0));
      const oilStart = Math.max(1, h.oilStart || 1);
      oilEl.textContent = String(oil);
      oilFill.style.width = Math.min(100, (oil / oilStart) * 100).toFixed(1) + '%';

      stepsEl.textContent = String(Math.max(0, Math.floor(h.steps ?? 0)));
      stepsMaxEl.textContent = '/ ' + (h.maxSteps ?? 0);

      const showKey = Number(h.keys) >= 0;
      keyStat.classList.toggle('hidden', !showKey);
      keysEl.textContent = String(h.keys ?? 0);

      const clueTarget = Number(h.clueTarget) || 0;
      clueStat.classList.toggle('hidden', clueTarget <= 0);
      cluesEl.textContent = `${h.clues ?? 0}/${clueTarget}`;
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
