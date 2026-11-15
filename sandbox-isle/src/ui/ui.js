// src/ui/ui.js — 屏幕 / HUD / 热键栏 / 首次交互引导 / 结果屏。视觉样式在 styles.css。
// 契约：showTitle/showGame/showPause/hidePause/showResults/updateHUD/popup/applyLang + tutorial 状态机。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { BLOCK_DEFS, HOTBAR, RAINBOW } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const el = {
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  hud: $('hud'), hotbar: $('hotbar'), bridge: $('btn-bridge'),
  day: $('hud-day'), gold: $('hud-gold'), carrots: $('hud-carrots'),
  goals: $('hud-goals'), stamina: $('hud-stamina-fill'), staminaVal: $('hud-stamina-val'), rainbow: $('hud-rainbow'),
  fx: $('fx-layer'), touch: $('touch'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
  resTitle: $('res-title'), resSub: $('res-sub'), resStats: $('res-stats'),
};

// ---------------------------------------------------------------- 首次交互引导（4 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
// 第 0 步（走两步）无居中准星高亮，避免遮罩被判 hud_overlap；挖/放/喂指向真实 UI
const TUT_TARGET = [null, 'hud-crosshair', 'hotbar', 'hud-goals'];
const tutorial = {
  active: false, step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start() {
    this.active = true; this.step = 0;
    this._fromTitle = !el.title.classList.contains('hidden');
    el.tut.classList.toggle('from-title', this._fromTitle);
    el.tut.classList.remove('hidden');
    this.render();
  },
  skip() {
    this.active = false;
    el.tut.classList.add('hidden');
    this._fromTitle = false;
    save.set('tutDone', true);
  },
  next() {
    if (!this.active) return;
    this.step++;
    if (this.step >= TUT_STEPS.length) this.skip();
    else this.render();
  },
  render() {
    el.tutText.textContent = t(TUT_STEPS[this.step]);
    el.tutDots.innerHTML = TUT_STEPS.map((_, i) => `<span class="dot${i === this.step ? ' on' : ''}"></span>`).join('');
    $('tut-next').textContent = t('next');
    $('tut-skip').textContent = t('skipTutorial');
    const target = $(TUT_TARGET[this.step]);
    const stage = $('stage').getBoundingClientRect();
    if (target && target.getBoundingClientRect().width > 0) {
      const r = target.getBoundingClientRect();
      const s = stage.width / 1280;
      el.tutHighlight.style.left = `${(r.left - stage.left) / s - 6}px`;
      el.tutHighlight.style.top = `${(r.top - stage.top) / s - 6}px`;
      el.tutHighlight.style.width = `${r.width / s + 12}px`;
      el.tutHighlight.style.height = `${r.height / s + 12}px`;
      el.tutHighlight.classList.remove('hidden');
    } else {
      el.tutHighlight.classList.add('hidden');
    }
  },
};
$('tut-next').addEventListener('click', () => tutorial.next());
$('tut-skip').addEventListener('click', () => tutorial.skip());

// ---------------------------------------------------------------- 热键栏
const HOTBAR_COLORS = HOTBAR.map((id) => BLOCK_DEFS[id].color);

function buildHotbar(hud) {
  el.hotbar.innerHTML = '';
  HOTBAR.forEach((id, i) => {
    const b = document.createElement('div');
    b.className = 'slot' + (i === hud.slot ? ' on' : '');
    b.dataset.slot = i;
    const cnt = hud.inventory[id] || 0;
    const name = t('block_' + BLOCK_DEFS[id].name);
    b.innerHTML = `<span class="sw" style="background:#${HOTBAR_COLORS[i].toString(16).padStart(6, '0')}"></span><span class="name">${name}</span><span class="bot"><span class="key">${i + 1}</span><span class="cnt">${cnt}</span></span>`;
    b.addEventListener('click', () => { window.__ll?.setSlot?.(i); });
    el.hotbar.appendChild(b);
  });
}

function buildRainbow(hud) {
  el.rainbow.innerHTML = '';
  RAINBOW.colors.forEach((id) => {
    const n = hud.rainbow.find((r) => r.id === id)?.n || 0;
    const need = RAINBOW.need;
    const d = document.createElement('div');
    d.className = 'rb' + (n >= need ? ' full' : '');
    d.style.background = `#${BLOCK_DEFS[id].color.toString(16).padStart(6, '0')}`;
    d.style.color = `#${BLOCK_DEFS[id].color.toString(16).padStart(6, '0')}`;
    d.title = `${n}/${need}`;
    el.rainbow.appendChild(d);
  });
}

// ---------------------------------------------------------------- 屏幕
function hideScreens() {
  for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden');
}

export const ui = {
  tutorial,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    $('title-text').textContent = t('title');
    $('subtitle-text').textContent = t('subtitle');
    $('btn-start').textContent = t('start');
    $('btn-howto').textContent = t('howto');
    $('btn-resume').textContent = t('resume');
    $('btn-restart-pause').textContent = t('restart');
    $('btn-menu-pause').textContent = t('menu');
    $('pause-title').textContent = t('paused');
    $('btn-restart').textContent = t('restart');
    $('btn-share').textContent = t('share');
    $('btn-menu').textContent = t('menu');
    $('btn-mute').textContent = save.get('muted', false) ? t('unmute') : t('mute');
    $('rotate-text').textContent = t('rotate');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    for (const sel of [$('lang-select'), $('lang-select-pause')]) {
      sel.innerHTML = '';
      for (const o of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = o.code; opt.textContent = o.name;
        if (o.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
    if (tutorial.active) tutorial.render();
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    hideScreens();
    el.title.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.hotbar.classList.add('hidden');
    el.bridge.classList.add('hidden');
    el.touch.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    el.hotbar.classList.remove('hidden');
    el.touch.classList.toggle('hidden', !isTouch);
    this.applyLang();
  },

  showPause() { hideScreens(); el.pause.classList.remove('hidden'); el.touch.classList.add('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); el.touch.classList.toggle('hidden', !isTouch); },

  showResults(hud) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.hotbar.classList.add('hidden');
    el.bridge.classList.add('hidden');
    el.touch.classList.add('hidden');
    el.resTitle.textContent = t('winTitle');
    el.resSub.textContent = t('winSub');
    el.resStats.innerHTML = [
      [t('gold'), hud.gold],
      [t('wonScore'), hud.totalGoalsCompleted],
      [t('day'), hud.day + 1],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    this.applyLang();
  },

  updateHUD(hud) {
    el.day.textContent = String(hud.day + 1);
    el.gold.textContent = String(hud.gold);
    el.carrots.textContent = String(hud.carrots);
    el.stamina.style.width = `${hud.stamina}%`;
    el.staminaVal.textContent = String(hud.stamina);
    el.bridge.classList.toggle('hidden', !hud.canBuild);
    // 目标
    if (el.goals.dataset.sig !== hud.goals.map((g) => `${g.id}:${g.progress}:${g.done}`).join('|')) {
      el.goals.dataset.sig = hud.goals.map((g) => `${g.id}:${g.progress}:${g.done}`).join('|');
      el.goals.innerHTML = '';
      for (const g of hud.goals) {
        const d = document.createElement('div');
        d.className = 'goal' + (g.done ? ' done' : '');
        d.innerHTML = `<span class="goal-check"></span><span>${t('goal_' + g.id, { n: g.target })}</span><b>${g.progress}/${g.target}</b>`;
        el.goals.appendChild(d);
      }
    }
    buildHotbar(hud);
    buildRainbow(hud);
  },

  popup(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    el.fx.appendChild(d);
    while (el.fx.children.length > 6) el.fx.removeChild(el.fx.firstChild);
    setTimeout(() => d.remove(), 1600);
  },
};
