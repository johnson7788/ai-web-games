// src/ui/hud.js — HUD（波次/基地耐久/金币/技能冷却）+ 触屏控制（摇杆 + 按钮）
import { t } from '../core/i18n.js';

function clamp01(v) {
  const n = Number(v) || 0;
  return Math.min(1, Math.max(0, n));
}

export function createHud(root) {
  let el = root.querySelector('#hud');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hud';
    root.appendChild(el);
  }
  el.className = 'hud hidden';
  el.innerHTML =
    '<div class="hud-top">' +
      '<div class="hud-left">' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.wave"></span><b id="hud-wave">1</b><span class="hud-unit" id="hud-scene"></span></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.gold"></span><b id="hud-gold">0</b></div>' +
      '</div>' +
      '<div class="hud-center">' +
        '<div class="hud-basebar"><span class="hud-label" data-i18n="hud.base"></span>' +
          '<div class="hud-base-track"><i class="hud-base-fill" id="hud-base-fill"></i><i class="hud-shield-fill" id="hud-shield-fill"></i></div>' +
          '<b id="hud-base-num">100</b>' +
        '</div>' +
      '</div>' +
      '<div class="hud-right">' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.best"></span><b id="hud-best">0</b></div>' +
      '</div>' +
    '</div>';

  const waveEl = el.querySelector('#hud-wave');
  const sceneEl = el.querySelector('#hud-scene');
  const goldEl = el.querySelector('#hud-gold');
  const baseFillEl = el.querySelector('#hud-base-fill');
  const shieldFillEl = el.querySelector('#hud-shield-fill');
  const baseNumEl = el.querySelector('#hud-base-num');
  const bestEl = el.querySelector('#hud-best');

  let bestWave = 0;

  function sceneLabel(key) {
    const text = t('scene.' + key);
    return text !== ('scene.' + key) ? text : key;
  }

  return {
    el,
    setBest(w) { bestWave = Math.max(0, Math.floor(w ?? 0)); },
    setHud(h) {
      h = h || {};
      waveEl.textContent = String(Math.max(1, Math.floor(h.wave ?? 1)));
      sceneEl.textContent = sceneLabel(h.sceneKey || 'orbit');
      goldEl.textContent = String(Math.max(0, Math.floor(h.gold ?? 0)));
      const maxHp = Math.max(1, h.baseMaxHp || 100);
      const hp = Math.max(0, h.baseHp || 0);
      const shield = Math.max(0, h.baseShield || 0);
      baseFillEl.style.width = clamp01(hp / maxHp) * 100 + '%';
      shieldFillEl.style.width = clamp01(shield / (maxHp * 0.6)) * 100 + '%';
      baseNumEl.textContent = String(Math.round(hp + shield));
      bestEl.textContent = String(bestWave);
    },
    show() { el.classList.remove('hidden'); },
    hide() { el.classList.add('hidden'); },
  };
}

// 触屏控制：左摇杆 + 右侧技能/换位按钮（按钮 ≥44px，pointer-events 只在触屏设备开启）
export function createTouchControls(root) {
  let wrap = root.querySelector('#touch-controls');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'touch-controls';
    wrap.className = 'touch-only';
    root.appendChild(wrap);
  }
  wrap.innerHTML =
    '<div id="joy" class="joy"><div id="joy-knob" class="joy-knob"></div></div>' +
    '<div class="touch-buttons">' +
      '<button id="btn-swap" class="tbtn tbtn-swap" type="button" data-i18n="hud.swap"></button>' +
      '<button id="btn-k" class="tbtn tbtn-k" type="button" data-i18n="hud.shieldSkill"></button>' +
      '<button id="btn-j" class="tbtn tbtn-j" type="button" data-i18n="hud.resonance"></button>' +
    '</div>';

  const joy = wrap.querySelector('#joy');
  const knob = wrap.querySelector('#joy-knob');
  const state = { x: 0, y: 0, active: false };

  function setKnob() {
    knob.style.transform = `translate(${state.x * 24}px, ${state.y * 24}px)`;
  }

  function onMove(clientX, clientY) {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (clientX - cx) / (r.width / 2);
    let dy = (clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    state.x = dx;
    state.y = dy;
    state.active = true;
    setKnob();
  }

  function onUp() {
    state.x = 0;
    state.y = 0;
    state.active = false;
    setKnob();
  }

  joy.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joy.setPointerCapture(e.pointerId);
    onMove(e.clientX, e.clientY);
  });
  joy.addEventListener('pointermove', (e) => {
    if (state.active) onMove(e.clientX, e.clientY);
  });
  joy.addEventListener('pointerup', onUp);
  joy.addEventListener('pointercancel', onUp);

  return {
    el: wrap,
    get vector() { return state.active ? { x: state.x, y: state.y } : { x: 0, y: 0 }; },
    buttons: {
      swap: wrap.querySelector('#btn-swap'),
      j: wrap.querySelector('#btn-j'),
      k: wrap.querySelector('#btn-k'),
    },
  };
}
