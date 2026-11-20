// src/ui/tutorial.js — 首次交互引导：3 步状态机（纯逻辑）+ 覆盖层 DOM。
// 步骤：0 点爆一簇（pop）→ 1 连消到 3（streak≥3）→ 2 按「淘洗」（wash）。
// 可跳过、可重看、同存档只自动弹一次（Sdk.save 持久化）。
import { t } from '../core/i18n.js';

export const TUT_STEP_IDS = ['pop', 'streak3', 'wash'];
export const TUTORIAL_KEY = 'tutorial-done'; // Sdk.save 已带 app keyPrefix

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
      try { this.onDone({ done: true, skipped }); } catch { /* 回调异常不影响游戏 */ }
    }
    return this;
  }

  onGameEvent(ev) {
    if (!this.active || this.done) return this.snapshot();
    const type = ev && ev.type;
    if (this.step === 0) {
      if (type === 'pop') this.step = 1;
    } else if (this.step === 1) {
      if (type === 'pop' && (ev.streak || 0) >= 3) this.step = 2;
    } else if (this.step === 2) {
      if (type === 'wash') this._finish(false);
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      active: this.active,
      done: this.done,
      step: this.step,
      total: this.total,
      id: this.currentId,
    };
  }
}

export function createTutorialOverlay(root, machine, opts = {}) {
  const canvas = opts.canvas || root.querySelector('canvas');
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
    halo.style.left = (a.left - b.left - 8) + 'px';
    halo.style.top = (a.top - b.top - 8) + 'px';
    halo.style.width = (a.width + 16) + 'px';
    halo.style.height = (a.height + 16) + 'px';
    halo.classList.add('on');
  }

  function render() {
    const s = machine.snapshot();
    stepEl.textContent = t('tut.step', { n: s.step + 1, total: s.total });
    textEl.textContent = t('tut.' + (s.step + 1));
    skipBtn.textContent = t('btn.skip');
    skipBtn.setAttribute('aria-label', t('btn.skip'));
    if (s.step === 0) positionHalo(canvas);
    else if (s.step === 2) positionHalo(opts.washEl || null);
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
