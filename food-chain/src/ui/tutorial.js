// src/ui/tutorial.js — 首次交互引导：4 步状态机（纯逻辑）+ 覆盖层 DOM。
// 不是说明书：每一步都必须玩家真实完成一个动作才前进；可跳过、可重看、同存档只自动弹一次。
// 完成/跳过经 Sdk.save 持久化（构造时注入 save/load）。
import { t } from '../core/i18n.js';

export const TUT_STEP_IDS = ['move', 'food', 'prey', 'avoid'];
export const DEFAULT_FOOD_TARGET = 3;
export const DEFAULT_AVOID_MS = 2500;
export const TUTORIAL_KEY = 'tutorial-done';

/**
 * 纯逻辑教程状态机（无 DOM，可在 node 直接测试）。
 * 步骤：0 move（真实移动）→ 1 food（吃 3 颗浮游）→ 2 prey（吃一条更小的鱼）→ 3 avoid（被大鱼追但活过 2.5s）
 */
export class TutorialMachine {
  constructor(opts = {}) {
    this.save = opts.save || null;
    this.load = opts.load || null;
    this.key = opts.key || TUTORIAL_KEY;
    this.foodTarget = opts.foodTarget ?? DEFAULT_FOOD_TARGET;
    this.avoidMs = opts.avoidMs ?? DEFAULT_AVOID_MS;
    this.onDone = null;
    this.done = false;
    if (this.load) {
      try { this.done = !!this.load(this.key, false); } catch { this.done = false; }
    }
    this.reset();
  }

  reset() {
    this.step = 0;
    this.foodCount = 0;
    this.dangerAt = null;
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
    this.dangerAt = null;
    if (this.save) {
      try { this.save(this.key, true); } catch { /* 隐私模式降级 */ }
    }
    if (typeof this.onDone === 'function') {
      try { this.onDone({ done: true, skipped }); } catch { /* 回调异常不影响游戏 */ }
    }
    return this;
  }

  onGameEvent(ev, now = 0) {
    if (!this.active || this.done) return this.snapshot();
    const type = ev && ev.type;
    if (this.step === 0) {
      if (type === 'steer') this.step = 1;
    } else if (this.step === 1) {
      if (type === 'eatFood') {
        this.foodCount += 1;
        if (this.foodCount >= this.foodTarget) { this.step = 2; this.foodCount = 0; }
      }
    } else if (this.step === 2) {
      if (type === 'eatPrey') this.step = 3;
    } else if (this.step === 3) {
      if (type === 'danger') { if (this.dangerAt == null) this.dangerAt = now; }
      else if (type === 'death') { this.dangerAt = null; }
    }
    this._tick(now);
    return this.snapshot();
  }

  tick(now = 0) {
    if (this.active && !this.done) this._tick(now);
    return this.snapshot();
  }

  _tick(now) {
    if (this.step === 3 && this.dangerAt != null && now - this.dangerAt >= this.avoidMs) {
      this.step = 4;
      this._finish(false);
    }
  }

  snapshot() {
    return {
      active: this.active,
      done: this.done,
      step: this.step,
      total: this.total,
      id: this.currentId,
      foodCount: this.foodCount,
      foodTarget: this.foodTarget,
    };
  }
}

/**
 * 覆盖层 DOM：高亮真实画布（第 1 步）、右上 Skip、步骤文案。
 */
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
    if (s.step === 0) positionHalo(canvas);
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
