// UI 壳：屏幕切换、HUD、选关、设置、结算、提示
import { t } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export function createUI() {
  const screens = {
    loading: $('scr-loading'),
    title: $('scr-title'),
    select: $('scr-select'),
    pause: $('scr-pause'),
    settings: $('scr-settings'),
    clear: $('scr-clear'),
  };
  const hud = $('hud');
  const touch = $('touch');
  const toastEl = $('toast');
  const hint = $('hint');

  let toastTimer = 0;

  const ui = {
    isTouch,
    el: {
      play: $('btnPlay'), settings: $('btnSettings'), back: $('btnBack'),
      resume: $('btnResume'), restart: $('btnRestart'), pauseSettings: $('btnPauseSettings'), quit: $('btnQuit'),
      musicRange: $('rangeMusic'), sfxRange: $('rangeSfx'), shake: $('btnShake'),
      settingsBack: $('btnSettingsBack'),
      next: $('btnNext'), retry: $('btnRetry'), select: $('btnSelect'),
      levelGrid: $('levelGrid'), clearTitle: $('clearTitle'), clearStars: $('clearStars'),
      clearStats: $('clearStats'), loadBar: $('loadBar'),
    },

    show(name) {
      const isPlay = name === 'play';
      for (const [key, el] of Object.entries(screens)) el.classList.toggle('hidden', key !== name);
      hud.classList.toggle('hidden', !isPlay);
      hint.classList.toggle('hidden', !isPlay);
      touch.classList.toggle('hidden', !isPlay || !isTouch);
      ui.current = name;
    },

    setLoading(p) {
      ui.el.loadBar.style.width = `${Math.round(p * 100)}%`;
    },

    setGears(n) { $('gears').textContent = String(n); },
    setDeaths(n) { $('deaths').textContent = String(n); },
    setTime(sec) {
      const s = Math.max(0, Math.ceil(sec));
      $('time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    },
    setLevel(id, name) {
      $('levelName').textContent = `${id} · ${name}`;
      $('gearTotal').textContent = String(name ? 0 : 0);
    },
    setGearTotal(n) { $('gearTotal').textContent = String(n); },

    toast(msg, ms = 1400) {
      toastEl.textContent = msg;
      toastEl.classList.remove('hidden');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.add('hidden'), ms);
    },

    buildLevels(levels, save, onPick) {
      const grid = ui.el.levelGrid;
      grid.innerHTML = '';
      levels.forEach((def, i) => {
        const rec = save.levels[def.id];
        const unlocked = i < save.unlocked;
        const card = document.createElement('div');
        card.className = `card${unlocked ? '' : ' locked'}`;
        card.innerHTML = `
          <div class="unlock">${unlocked ? '' : t('locked')}</div>
          <div class="id">${def.id}</div>
          <div class="nm">${def.name?.en ?? ''}</div>
          <div class="stars">${'★'.repeat(rec?.stars ?? 0)}${'☆'.repeat(3 - (rec?.stars ?? 0))}</div>`;
        if (unlocked) card.addEventListener('click', () => onPick(i));
        grid.appendChild(card);
      });
    },

    showClear({ title, stars, stats, hasNext }) {
      ui.el.clearTitle.textContent = title;
      ui.el.clearStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      ui.el.clearStats.textContent = stats;
      ui.el.next.classList.toggle('hidden', !hasNext);
      ui.show('clear');
    },

    applySettings(settings, handlers) {
      ui.el.musicRange.value = String(Math.round(settings.music * 100));
      ui.el.sfxRange.value = String(Math.round(settings.sfx * 100));
      ui.el.shake.textContent = settings.shake ? t('on') : t('off');
      ui.el.shake.dataset.on = settings.shake ? '1' : '0';
      ui.handlers = handlers;
    },
  };

  return ui;
}
