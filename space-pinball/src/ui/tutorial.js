// src/ui/tutorial.js — 首次交互引导：4 步状态机（纯逻辑）+ 覆盖层 DOM
// 步骤：launch（发射）→ bumper（命中 3 个等离子球）→ flipper（翻挡板）→ reactor（命中反应堆核心）
import { t } from '../core/i18n.js';

export const TUT_STEP_IDS = ['launch', 'bumper', 'flipper', 'reactor'];
export const TUTORIAL_KEY = 'tutorial-done';
export const BUMPER_TARGET = 3;

export class TutorialMachine {
  constructor(opts = {}) {
    this.save = opts.save || null;
    this.load = opts.load || null;
    this.key = opts.key || TUTORIAL_KEY;
    this.bumperTarget = opts.bumperTarget ?? BUMPER_TARGET;
    this.onDone = null;
    this.done = false;
    if (this.load) {
      try { this.done = !!this.load(this.key, false); } catch { this.done = false; }
    }
    this.reset();
  }

  reset() {
    this.step = 0;
    this.bumperCount = 0;
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

  replay() {
    this.reset();
    this.active = true;
    return true;
  }

  skip() { this._finish(true); }

  _finish(skipped = false) {
    this.done = true;
    this.active = false;
    if (this.save) {
      try { this.save(this.key, true); } catch { /* 隐私模式降级 */ }
    }
    if (typeof this.onDone === 'function') {
      try { this.onDone({ done: true, skipped }); } catch { /* noop */ }
    }
    return this;
  }

  onGameEvent(ev) {
    if (!this.active || this.done) return this.snapshot();
    const type = ev && ev.type;
    if (this.step === 0) {
      if (type === 'launch') this.step = 1;
    } else if (this.step === 1) {
      if (type === 'bumperHit') {
        this.bumperCount += 1;
        if (this.bumperCount >= this.bumperTarget) { this.step = 2; this.bumperCount = 0; }
      }
    } else if (this.step === 2) {
      if (type === 'flipper') this.step = 3;
    } else if (this.step === 3) {
      if (type === 'reactorHit') { this.step = 4; this._finish(false); }
    }
    return this.snapshot();
  }

  tick() { return this.snapshot(); }

  snapshot() {
    return {
      active: this.active,
      done: this.done,
      step: this.step,
      total: this.total,
      id: this.currentId,
      bumperCount: this.bumperCount,
      bumperTarget: this.bumperTarget,
    };
  }
}

export function createTutorialOverlay(root, machine) {
  const overlay = document.createElement('div');
  overlay.id = 'tutorial';
  overlay.className = 'tutorial hidden';
  overlay.setAttribute('data-tutorial', '');
  overlay.innerHTML =
    '<button class="tutorial-skip" data-tutorial-skip type="button"></button>' +
    '<div class="tutorial-card" id="tut-card">' +
      '<div class="tutorial-title" data-i18n="tut.title"></div>' +
      '<div class="tutorial-step"></div>' +
      '<div class="tutorial-text"></div>' +
    '</div>';
  root.appendChild(overlay);

  const skipBtn = overlay.querySelector('[data-tutorial-skip]');
  const stepEl = overlay.querySelector('.tutorial-step');
  const textEl = overlay.querySelector('.tutorial-text');

  function render() {
    const s = machine.snapshot();
    stepEl.textContent = t('tut.step', { n: s.step + 1, total: s.total });
    textEl.textContent = t('tut.' + (s.step + 1));
    skipBtn.textContent = t('btn.skip');
    skipBtn.setAttribute('aria-label', t('btn.skip'));
  }

  skipBtn.addEventListener('click', () => machine.skip());

  return {
    root: overlay,
    show() { overlay.classList.remove('hidden'); render(); },
    hide() { overlay.classList.add('hidden'); },
    render,
    get visible() { return !overlay.classList.contains('hidden'); },
  };
}
