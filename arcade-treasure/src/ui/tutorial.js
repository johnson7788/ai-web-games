// src/ui/tutorial.js — 首次交互引导：3 步状态机（纯逻辑）+ 覆盖层 DOM。
// 不是说明书：每一步都必须玩家真实完成一个动作才前进；可跳过、可重看、同存档只自动弹一次。
// 步骤：0 pick（点一台街机）→ 1 hit（首次命中）→ 2 score（首次得分里程碑）。
import { t } from '../core/i18n.js';

export const TUT_STEP_IDS = ['pick', 'hit', 'score'];
export const TUTORIAL_KEY = 'tutorial-done';

export class TutorialMachine {
  constructor(opts = {}) {
    this.save = opts.save || null;
    this.load = opts.load || null;
    this.key = opts.key || TUTORIAL_KEY;
    this.onDone = null;
    this.done = false;
    if (this.load) {
      try { this.done = !!this.load(this.key, false); } catch { this.done = false; }
    }
    this.reset();
  }

  reset() {
    this.step = 0;
    this.active = false;
    return this;
  }

  get total() { return TUT_STEP_IDS.length; }
  get currentId() { return TUT_STEP_IDS[this.step] || null; }

  begin() {
    if (this.done || this.active) return false;
    this.reset();
    this.active = true;
    return true;
  }

  replay() { this.reset(); this.active = true; return true; }
  skip() { this._finish(true); }

  _finish(skipped = false) {
    this.done = true;
    this.active = false;
    if (this.save) { try { this.save(this.key, true); } catch { /* 隐私模式降级 */ } }
    if (typeof this.onDone === 'function') { try { this.onDone({ done: true, skipped }); } catch { /* noop */ } }
    return this;
  }

  onGameEvent(ev) {
    if (!this.active || this.done) return this.snapshot();
    const type = ev && ev.type;
    if (this.step === 0 && type === 'machinePick') this.step = 1;
    else if (this.step === 1 && type === 'hit') this.step = 2;
    else if (this.step === 2 && type === 'score') this._finish(false);
    return this.snapshot();
  }

  tick() { return this.snapshot(); }

  snapshot() {
    return { active: this.active, done: this.done, step: this.step, total: this.total, id: this.currentId };
  }
}

export function createTutorialOverlay(root, machine, opts = {}) {
  const firstCab = opts.firstCab || root.querySelector('#cab-0');
  const overlay = document.createElement('div');
  overlay.id = 'tutorial';
  overlay.className = 'tutorial hidden';
  overlay.setAttribute('data-tutorial', '');
  overlay.innerHTML =
    '<button class="tutorial-skip" data-tutorial-skip type="button"></button>' +
    '<div class="tutorial-card">' +
    '<div class="tutorial-title" data-i18n="tut.title"></div>' +
    '<div class="tutorial-step"></div>' +
    '<div class="tutorial-text"></div>' +
    '</div>' +
    '<div class="tutorial-halo"></div>';
  root.appendChild(overlay);

  const skipBtn = overlay.querySelector('[data-tutorial-skip]');
  const stepEl = overlay.querySelector('.tutorial-step');
  const textEl = overlay.querySelector('.tutorial-text');
  const halo = overlay.querySelector('.tutorial-halo');

  function positionHalo(el) {
    if (!el) return;
    const a = el.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    halo.style.left = (a.left - b.left - 6) + 'px';
    halo.style.top = (a.top - b.top - 6) + 'px';
    halo.style.width = (a.width + 12) + 'px';
    halo.style.height = (a.height + 12) + 'px';
    halo.classList.add('on');
  }

  function render() {
    const s = machine.snapshot();
    stepEl.textContent = t('tut.step', { n: s.step + 1, total: s.total });
    textEl.textContent = t('tut.' + (s.step + 1));
    skipBtn.textContent = t('btn.skip');
    skipBtn.setAttribute('aria-label', t('btn.skip'));
    if (s.step === 0) positionHalo(firstCab);
    else halo.classList.remove('on');
  }

  skipBtn.addEventListener('click', () => machine.skip());

  return {
    root: overlay,
    show() { overlay.classList.remove('hidden'); render(); },
    hide() { overlay.classList.add('hidden'); halo.classList.remove('on'); },
    render,
    get visible() { return !overlay.classList.contains('hidden'); },
  };
}
