// src/ui/tutorial.js — 首次交互引导：3 步状态机 + 覆盖层 DOM。
// 3 步分别高亮：作答栏 → 连击 HUD → 提示按钮；可跳过、可重看、同存档只自动弹一次。
import { t } from '../core/i18n.js';

export const TUT_STEP_IDS = ['type', 'combo', 'hint'];
export const TUTORIAL_KEY = 'tutorial-done';

const TARGETS = ['#answer-bar', '#hud-combo', '#btn-hint'];

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

  next() {
    if (!this.active) return false;
    if (this.step + 1 >= this.total) {
      this._finish(false);
    } else {
      this.step += 1;
    }
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

export function createTutorialOverlay(root, machine) {
  const overlay = root.querySelector('[data-tutorial]') || document.createElement('div');
  overlay.setAttribute('data-tutorial', '');
  overlay.classList.add('hidden');

  const skipBtn = overlay.querySelector('[data-tutorial-skip]');
  const nextBtn = overlay.querySelector('#tut-next');
  const titleEl = overlay.querySelector('#tut-title');
  const textEl = overlay.querySelector('#tut-text');
  const stepBadge = overlay.querySelector('#tut-step-badge');
  const spotlight = overlay.querySelector('#tut-spotlight');
  const card = overlay.querySelector('#tut-card');

  function positionSpotlight() {
    const target = root.querySelector(TARGETS[Math.min(machine.step, TARGETS.length - 1)]);
    if (!target || target.classList.contains('hidden') || !target.offsetParent) {
      spotlight.style.display = 'none';
      return;
    }
    const a = target.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    spotlight.style.display = 'block';
    spotlight.style.left = (a.left - b.left - 6) + 'px';
    spotlight.style.top = (a.top - b.top - 6) + 'px';
    spotlight.style.width = (a.width + 12) + 'px';
    spotlight.style.height = (a.height + 12) + 'px';
  }

  function render() {
    const s = machine.snapshot();
    const n = Math.min(s.step + 1, s.total);
    if (titleEl) titleEl.textContent = t('tut.title');
    if (textEl) textEl.textContent = t('tut.' + n);
    if (stepBadge) stepBadge.textContent = t('tut.step', { n, total: s.total });
    if (skipBtn) skipBtn.textContent = t('skip');
    if (nextBtn) nextBtn.textContent = s.step + 1 >= s.total ? t('gotIt') : t('gotIt');
    positionSpotlight();
  }

  if (skipBtn) skipBtn.addEventListener('click', () => machine.skip());
  if (nextBtn) nextBtn.addEventListener('click', () => machine.next());

  return {
    root: overlay,
    get visible() { return !overlay.classList.contains('hidden'); },
    show() { overlay.classList.remove('hidden'); render(); },
    hide() { overlay.classList.add('hidden'); if (spotlight) spotlight.style.display = 'none'; },
    render,
  };
}
