// src/ui/tutorial.js — 首次交互引导：3 步状态机 + 覆盖层 DOM。
// 每一步都要求玩家真实完成动作（作答 / 答对 / 得护盾）才前进；可跳过、可重看、同存档只自动弹一次。
import { t } from '../core/i18n.js';

export const TUT_STEP_IDS = ['answer', 'correct', 'shield'];
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
      try { this.save(this.key, true); } catch { /* 降级 */ }
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
      if (type === 'answer') this.step = 1;
    } else if (this.step === 1) {
      if (type === 'answerCorrect') this.step = 2;
    } else if (this.step === 2) {
      if (type === 'shieldGain') {
        this.step = 3;
        this._finish(false);
      }
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

export function createTutorialOverlay(root, machine) {
  const overlay = document.createElement('div');
  overlay.id = 'tutorial';
  overlay.className = 'tutorial hidden';
  overlay.setAttribute('data-tutorial', '');
  overlay.innerHTML =
    '<div class="tutorial-halo"></div>' +
    '<div class="tutorial-card" id="tut-card">' +
    '<div class="tutorial-title" data-i18n="tut.title"></div>' +
    '<div class="tutorial-step"></div>' +
    '<div class="tutorial-text"></div>' +
    '<div class="tut-btns">' +
    '<button class="btn-ghost" data-tutorial-skip type="button"></button>' +
    '</div>' +
    '</div>';
  (document.body || root).appendChild(overlay);

  const skipBtn = overlay.querySelector('[data-tutorial-skip]');
  const stepEl = overlay.querySelector('.tutorial-step');
  const textEl = overlay.querySelector('.tutorial-text');
  const halo = overlay.querySelector('.tutorial-halo');

  function render() {
    const s = machine.snapshot();
    stepEl.textContent = t('tut.step', { n: Math.min(s.step + 1, s.total), total: s.total });
    textEl.textContent = t('tut.' + (s.step + 1));
    skipBtn.textContent = t('btn.skip');
    const target = root.querySelector('#answer-bar');
    if (target) {
      const a = target.getBoundingClientRect();
      halo.style.left = (a.left - 8) + 'px';
      halo.style.top = (a.top - 8) + 'px';
      halo.style.width = (a.width + 16) + 'px';
      halo.style.height = (a.height + 16) + 'px';
      halo.classList.add('on');
    } else {
      halo.classList.remove('on');
    }
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
