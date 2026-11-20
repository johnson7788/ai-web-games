// src/ui/hud.js — 右控制台 HUD + 触屏控件。
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
  el.innerHTML =
    '<div class="console">' +
      '<div class="console-head">' +
        '<div class="console-title" data-i18n="title.logo"></div>' +
        '<div class="console-scene" id="hud-scene"></div>' +
      '</div>' +
      '<div class="console-gauges">' +
        '<div class="gauge-row"><span data-i18n="hud.wave"></span><b id="hud-wave">1</b></div>' +
        '<div class="gauge-row"><span data-i18n="hud.lives"></span><b id="hud-lives">3</b></div>' +
        '<div class="gauge-row"><span data-i18n="hud.firepower"></span><b id="hud-firepower">0</b></div>' +
        '<div class="gauge-row"><span data-i18n="hud.heavy"></span><b id="hud-heavy">2</b></div>' +
        '<div class="gauge-row"><span data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
        '<div class="gauge-row"><span data-i18n="hud.enemies"></span><b id="hud-enemies">0</b></div>' +
      '</div>' +
      '<div class="furnace-gauge">' +
        '<div class="furnace-label"><span data-i18n="hud.furnace"></span><b id="hud-furnace-hp">3/3</b></div>' +
        '<div class="furnace-track"><i class="furnace-fill" id="hud-furnace-fill"></i></div>' +
      '</div>' +
      '<button id="btn-weld" class="btn btn-weld" type="button" data-i18n="btn.weld"></button>' +
      '<div class="console-controls">' +
        '<div class="controls-title" data-i18n="hud.controls"></div>' +
        '<div class="controls-line">WASD / ←↑↓→ · <span data-i18n="tut.1"></span></div>' +
        '<div class="controls-line">SPACE / J · <span data-i18n="tut.2"></span></div>' +
        '<div class="controls-line">K · <span data-i18n="tut.3"></span></div>' +
        '<div class="controls-line">E / <span data-i18n="btn.weld"></span> · <span data-i18n="tut.4"></span></div>' +
      '</div>' +
    '</div>';

  const sceneEl = el.querySelector('#hud-scene');
  const waveEl = el.querySelector('#hud-wave');
  const livesEl = el.querySelector('#hud-lives');
  const fireEl = el.querySelector('#hud-firepower');
  const heavyEl = el.querySelector('#hud-heavy');
  const scoreEl = el.querySelector('#hud-score');
  const enemiesEl = el.querySelector('#hud-enemies');
  const furnaceHpEl = el.querySelector('#hud-furnace-hp');
  const furnaceFillEl = el.querySelector('#hud-furnace-fill');
  const weldBtn = el.querySelector('#btn-weld');

  function sceneName(key) {
    const k = 'scene.' + key;
    const text = t(k);
    return text !== k ? text : key;
  }

  return {
    el,
    weldBtn,
    setHud(h) {
      h = h || {};
      sceneEl.textContent = sceneName(h.sceneKey);
      waveEl.textContent = String(Math.max(1, h.wave ?? 1));
      livesEl.textContent = String(Math.max(0, h.lives ?? 0));
      fireEl.textContent = String(h.firepower ?? 0);
      heavyEl.textContent = String(h.heavy ?? 0);
      scoreEl.textContent = String(h.score ?? 0);
      enemiesEl.textContent = String(h.enemiesLeft ?? 0);
      furnaceHpEl.textContent = `${Math.max(0, h.furnaceHp ?? 0)}/${h.furnaceMaxHp ?? 3}`;
      const ratio = h.furnaceMaxHp ? Math.max(0, h.furnaceHp / h.furnaceMaxHp) : 0;
      furnaceFillEl.style.width = (ratio * 100).toFixed(1) + '%';
      weldBtn.disabled = !h.repairAvailable;
      weldBtn.classList.toggle('off', !h.repairAvailable);
    },
    show() { el.classList.remove('hidden'); },
    hide() { el.classList.add('hidden'); },
  };
}
