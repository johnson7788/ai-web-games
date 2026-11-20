// src/ui/hud.js — HUD：单条不透明顶栏（分数/弹药/连击/目标/关卡/蛋壳/蛋黄）
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
    '<div class="hud-bar">' +
      '<div class="hud-group">' +
        '<span class="hud-item"><i data-i18n="hud.score"></i><b id="hud-score">0</b></span>' +
        '<span class="hud-item"><i data-i18n="hud.ammo"></i><b id="hud-ammo">0</b></span>' +
        '<span class="hud-item"><i data-i18n="hud.combo"></i><b id="hud-combo">0</b></span>' +
        '<span class="hud-item hud-target"><i data-i18n="hud.targets"></i><b id="hud-targets">0</b></span>' +
      '</div>' +
      '<div class="hud-level" id="hud-level"></div>' +
      '<div class="hud-group hud-right">' +
        '<span class="hud-item"><i data-i18n="hud.shell"></i><b id="hud-shell">1</b></span>' +
        '<span class="hud-yolk hidden" id="hud-yolk" title=""></span>' +
      '</div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const ammoEl = el.querySelector('#hud-ammo');
  const comboEl = el.querySelector('#hud-combo');
  const targetsEl = el.querySelector('#hud-targets');
  const levelEl = el.querySelector('#hud-level');
  const shellEl = el.querySelector('#hud-shell');
  const yolkEl = el.querySelector('#hud-yolk');

  function levelLabel(level, levelName) {
    const text = t(levelName);
    return text !== levelName ? text : String(level);
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      ammoEl.textContent = String(Math.max(0, Math.floor(h.ammo ?? 0)));
      comboEl.textContent = String(Math.max(0, Math.floor(h.combo ?? 0)));
      targetsEl.textContent = String(Math.max(0, Math.floor(h.targets ?? 0)));
      levelEl.textContent = levelLabel(Number(h.level) || 1, h.levelName);

      if (h.shell > 0) {
        shellEl.textContent = '1';
        shellEl.classList.remove('broken');
      } else {
        shellEl.textContent = '0';
        shellEl.classList.add('broken');
      }
      yolkEl.classList.toggle('hidden', !h.yolkReady);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
