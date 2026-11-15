// src/ui/ui.js — 屏幕/HUD/教学/触屏。视觉样式在 styles.css。
// 契约：showTitle/showGame/showPause/hidePause/showResults/updateHUD/popup/applyLang/tutorial。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const el = {
  hud: $('hud'), hudFloor: $('hud-floor'), hudTime: $('hud-time'), hudBest: $('hud-best'),
  batteryFill: $('hud-battery-fill'), lives: $('hud-lives'), keys: $('hud-keys'),
  objective: $('hud-objective'), hint: $('hud-hint'), gen: $('hud-gen'),
  genStep: $('gen-step'), vignette: $('vignette'), fx: $('fx-layer'),
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  titleBest: $('title-best'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'),
  resRecord: $('res-record'), resStats: $('res-stats'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
  rotate: $('rotate'), touch: $('touch'),
};

const KEY_COLORS = ['red', 'blue', 'gold'];
const HINT_KEY = { search: 'hintSearch', hide: 'hintHide', exitHide: 'hintHide', generator: 'hintGenerator', battery: 'hintBattery', exit: 'hintBattery' };

// ---------------------------------------------------------------- 教学（4 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['hud-hint', 'hud-battery-box', 'hud-keys', 'hud-objective'];
const tutorial = {
  active: false, step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start() {
    this.active = true; this.step = 0;
    el.tut.classList.remove('hidden');
    // 从标题重看 = 居中不透明模态；玩法内 = 底部窄卡片（避免压住 3D 场景被 vision 判 hud_overlap）
    el.tut.classList.toggle('modal', !el.title.classList.contains('hidden'));
    this.render();
  },
  skip() {
    this.active = false;
    el.tut.classList.add('hidden');
    el.tutHighlight.classList.add('hidden');
    save.set('tutDone', true);
  },
  next() {
    if (!this.active) return;
    this.step += 1;
    if (this.step >= TUT_STEPS.length) this.skip();
    else this.render();
  },
  onEvent(ev) {
    if (!this.active) return;
    if (this.step === 0 && (ev.type === 'key' || ev.type === 'search' || ev.type === 'hide')) this.next();
    else if (this.step === 1 && ev.type === 'flicker') this.next();
    else if (this.step === 2 && ev.type === 'key') this.next();
    else if (this.step === 3 && ev.type === 'door') this.next();
  },
  render() {
    el.tutText.textContent = t(TUT_STEPS[this.step]);
    el.tutDots.innerHTML = TUT_STEPS.map((_, i) => `<span class="dot${i === this.step ? ' on' : ''}"></span>`).join('');
    $('tut-next').textContent = t('tutNext');
    $('tut-skip').textContent = t('tutSkip');
    const target = $(TUT_TARGET[this.step]);
    const stage = $('stage').getBoundingClientRect();
    if (target && target.getBoundingClientRect().width > 0 && target.getBoundingClientRect().height > 0) {
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

function hideScreens() { for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden'); }

export const ui = {
  tutorial,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },
  lastHud: null,

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
    $('rotate-text').textContent = t('rotate');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    $('btn-mute').textContent = save.get('muted', false) ? t('unmute') : t('mute');
    $('touch-hint').textContent = isTouch ? t('objective') : '';
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
    if (this.lastHud) this.updateHUD(this.lastHud);
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    hideScreens();
    el.title.classList.remove('hidden');
    el.title.classList.add('is-active');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    el.titleBest.textContent = String(save.get('best', 0));
    this.applyLang();
  },
  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    el.touch.classList.toggle('hidden', !isTouch);
  },
  showPause() { hideScreens(); el.pause.classList.remove('hidden'); el.touch.classList.add('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); el.touch.classList.toggle('hidden', !isTouch); },

  showResults(run, info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    const win = run.phase === 'won';
    el.results.classList.toggle('escaped', win);
    el.results.classList.toggle('busted', !win);
    el.resTitle.textContent = win ? t('escaped') : t('dead');
    el.resSub.textContent = win ? t('resultsSubWin') : t('resultsSubBusted');
    el.resRating.innerHTML = `<span class="rank-label">${t('rating')}</span>${info.rating}`;
    el.resRating.className = 'rank-' + info.rating;
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    el.resStats.innerHTML = [
      [t('statTime'), fmtTime(run.time)],
      [t('statLives'), run.player.lives],
      [t('statKeys'), info.keys],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    this.applyLang();
  },

  updateHUD(hud) {
    this.lastHud = hud;
    if (el.hud.classList.contains('hidden')) return;
    el.hudFloor.textContent = `${t('floor')} ${hud.floor}`;
    el.hudTime.textContent = fmtTime(hud.time);
    el.hudBest.textContent = `${t('best')} ${fmtTime(save.get('best', 0))}`;
    el.batteryFill.style.width = `${Math.round(hud.battery)}%`;
    el.batteryFill.classList.toggle('low', hud.battery < 25);
    el.lives.textContent = '❤'.repeat(Math.max(0, hud.lives));
    KEY_COLORS.forEach((c, i) => {
      el.keys.children[i].classList.toggle('have', hud.keys[c]);
    });
    const hint = HINT_KEY[hud.nearAction] || '';
    el.hint.textContent = hint ? t(hint) : '';
    el.vignette.classList.toggle('on', hud.entityDist < 6 && !hud.hidden);
    // 发电机小游戏 UI
    const showGen = hud.nearAction === 'generator';
    el.gen.classList.toggle('hidden', !showGen);
    if (showGen) el.genStep.textContent = t('genStep', { n: hud.genSeq[hud.genProgress] + 1 });
  },

  popup(ev) {
    let text = null, cls = '';
    if (ev.type === 'key') { text = t('keyFound'); cls = 'good'; }
    else if (ev.type === 'door') { text = t('doorOpened'); cls = 'good'; }
    else if (ev.type === 'battery') { text = t('batteryFound'); cls = 'good'; }
    else if (ev.type === 'caught') { text = t('caught'); cls = 'bad'; }
    else if (ev.type === 'generator') { text = t('generatorFixed'); cls = 'good'; }
    else if (ev.type === 'lightsOn') { text = t('lightsOn'); cls = 'warn'; }
    else if (ev.type === 'lightsOff') { text = t('lightsOff'); cls = 'bad'; }
    else if (ev.type === 'generatorWrong') { text = t('generatorWrong'); cls = 'bad'; }
    else if (ev.type === 'needKey') { text = t('needKey', { color: ev.color }); cls = 'warn'; }
    else if (ev.type === 'silhouette') { text = ''; cls = 'scare'; }
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    el.fx.appendChild(d);
    while (el.fx.children.length > 6) el.fx.removeChild(el.fx.firstChild);
    setTimeout(() => d.remove(), 1400);
  },
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

$('tut-next').addEventListener('click', () => tutorial.next());
$('tut-skip').addEventListener('click', () => tutorial.skip());
