// src/ui/ui.js — 屏幕/HUD/教学/触屏 UI。视觉样式在 styles.css。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const el = {
  hud: $('hud'), touch: $('touch'),
  speed: $('hud-speed'), gear: $('hud-gear'), stage: $('hud-stage'), time: $('hud-time'),
  score: $('hud-score'), dmg: $('hud-damage-fill'), paceBox: $('hud-pace-box'), paceText: $('hud-pace-text'),
  chips: { throttle: $('chip-throttle'), steer: $('chip-steer'), drift: $('chip-drift'), camera: $('chip-camera') },
  stagecard: $('stagecard'), stagecardName: $('stagecard-name'), stagecardGoal: $('stagecard-goal'),
  popups: $('popups'),
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  titleBest: $('title-best'), hints: $('title-hints'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'),
  resScore: $('res-score'), resBest: $('res-best'), resRecord: $('res-record'), resStats: $('res-stats'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
  rotate: $('rotate'),
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- 教学（4 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['chip-throttle', 'chip-steer', 'chip-drift', 'hud-pace-box'];
const TUT_TARGET_TOUCH = ['btn-throttle', 'steer-slider', 'btn-handbrake', 'hud-pace-box'];

const tutorial = {
  active: false, step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start() {
    this.active = true; this.step = 0;
    // 从标题重看：不透明模态底 + 居中卡片（CSS .from-title），隐藏高亮遮罩
    this._fromTitle = !el.title.classList.contains('hidden');
    el.tut.classList.toggle('from-title', this._fromTitle);
    el.tut.classList.remove('hidden');
    this.render();
  },
  skip() {
    this.active = false;
    el.tut.classList.add('hidden');
    el.tut.classList.remove('from-title');
    this._fromTitle = false;
    save.set('tutDone', true);
  },
  next() {
    if (!this.active) return;
    this.step++;
    if (this.step >= TUT_STEPS.length) this.skip();
    else this.render();
  },
  // 每帧由 main 调用：真实动作推进当前步
  update(run) {
    if (!this.active) return;
    const p = run.player;
    if (this.step === 0 && run.hud.kmh > 10) this.next();
    else if (this.step === 1 && Math.abs(p.steerSmooth) > 0.3) this.next();
    else if (this.step === 2 && p.drifting) this.next();
    else if (this.step === 3 && run.lastNote) this.next();
  },
  render() {
    el.tutText.textContent = t(TUT_STEPS[this.step]);
    el.tutDots.innerHTML = TUT_STEPS.map((_, i) => `<span class="dot${i === this.step ? ' on' : ''}"></span>`).join('');
    $('tut-next').textContent = t('tutNext');
    $('tut-skip').textContent = t('tutSkip');
    const targetId = (isTouch ? TUT_TARGET_TOUCH : TUT_TARGET)[this.step];
    const target = $(targetId);
    if (target && target.getBoundingClientRect().width > 0 && !this._fromTitle) {
      const stage = $('stage').getBoundingClientRect();
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

function hideScreens() {
  for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden');
}

export const ui = {
  tutorial,
  i18n,
  t,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },
  get isTouch() { return isTouch; },

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
    $('btn-brake').textContent = t('brakeLabel');
    $('btn-throttle').textContent = t('throttleLabel');
    $('btn-handbrake').textContent = t('handbrakeLabel');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    $('rotate-text').textContent = t('rotate');
    $('btn-mute').textContent = save.get('muted', false) ? t('unmute') : t('mute');
    el.stagecardGoal.textContent = t('stageGoal');
    for (const sel of [$('lang-select'), $('lang-select-pause')]) {
      sel.innerHTML = '';
      for (const o of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = o.code; opt.textContent = o.name;
        if (o.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
    el.hints.innerHTML = ['hint1', 'hint2', 'hint3', 'hint4'].map((k) => `<span class="hint">${t(k)}</span>`).join('');
    if (tutorial.active) tutorial.render();
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    hideScreens();
    el.title.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    el.titleBest.textContent = String(save.get('bestRating', '—'));
    this.applyLang();
  },

  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    el.touch.classList.toggle('hidden', !isTouch);
  },

  showPause() { hideScreens(); el.pause.classList.remove('hidden'); el.touch.classList.add('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); el.touch.classList.toggle('hidden', !isTouch); },

  showStagecard(name) {
    el.stagecardName.textContent = name;
    el.stagecard.classList.remove('hidden');
    clearTimeout(this._stagecardT);
    this._stagecardT = setTimeout(() => el.stagecard.classList.add('hidden'), 2000);
  },

  setChips(state) {
    el.chips.throttle.classList.toggle('on', !!state.throttle);
    el.chips.steer.classList.toggle('on', !!state.steer);
    el.chips.drift.classList.toggle('on', !!state.drift);
    el.chips.camera.classList.toggle('on', !!state.camera);
  },

  flashPace() {
    el.paceBox.classList.add('flash');
    clearTimeout(this._paceT);
    this._paceT = setTimeout(() => el.paceBox.classList.remove('flash'), 1500);
  },

  showResults(run, info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    const win = run.phase === 'finished';
    el.resTitle.textContent = win ? t('resultsTitle') : t('resultsFail');
    el.resSub.textContent = win ? t('resultsSub') : t('resultsSubFail');
    el.resRating.textContent = info.rating;
    el.resScore.textContent = String(info.score);
    el.resBest.textContent = String(info.best);
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    const stages = run.stageTimes.map((s, i) => `S${i + 1} ${fmtTime(s)}`).join('  ');
    el.resStats.innerHTML = [
      [t('rating'), info.rating],
      [t('statTime'), fmtTime(run.totalTime)],
      [t('statDrift'), run.stats.driftSec.toFixed(1) + t('seconds')],
      [t('statPace'), run.stats.pacePerfect],
      [t('statHit'), run.stats.hits],
      [t('statStages'), `${run.stageTimes.length}/${run.stageTotal}`],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    if (stages) el.resStats.innerHTML += `<div class="stat" style="grid-column:1/-1"><span>${t('time')}</span><b>${stages}</b></div>`;
    this.applyLang();
  },

  updateHUD(run) {
    const h = run.hud;
    el.speed.textContent = String(h.kmh);
    el.gear.textContent = String(h.gear);
    el.stage.textContent = `${h.stage}/${h.stageTotal}`;
    el.time.textContent = fmtTime(h.time);
    el.score.textContent = String(h.score);
    el.dmg.style.width = `${Math.round(h.damage)}%`;
    el.dmg.classList.toggle('warn', h.damage >= 50);
    const note = h.note;
    if (note) {
      const dir = note.dir === 'L' ? t('paceLeft') : t('paceRight');
      el.paceText.textContent = `${dir} ${note.gear}${note.next ? ` ${t('paceInto')} ${note.next.dir === 'L' ? t('paceLeft') : t('paceRight')} ${note.next.gear}` : ''}`;
    } else {
      el.paceText.textContent = '—';
    }
  },

  popup(ev) {
    let text = null, cls = '';
    if (ev.type === 'paceNote') { text = el.paceText.textContent; cls = 'warn'; }
    else if (ev.type === 'pacePerfect') { text = t('perfect'); cls = 'good'; }
    else if (ev.type === 'hit') { text = t('statHit') + '!'; cls = 'bad'; }
    else if (ev.type === 'stageClear') { text = `${t('stageClear')} (S${ev.stage})`; cls = 'good'; }
    else if (ev.type === 'driftStart') { text = t('drift'); cls = 'good'; }
    else if (ev.type === 'damageWarn') { text = t('damage') + ' 50%'; cls = 'bad'; }
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    el.popups.appendChild(d);
    while (el.popups.children.length > 5) el.popups.removeChild(el.popups.firstChild);
    setTimeout(() => d.remove(), 1400);
  },
};
