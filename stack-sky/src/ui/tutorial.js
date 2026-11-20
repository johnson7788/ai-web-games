// src/ui/tutorial.js — 首次交互引导：3 步状态机（纯逻辑）+ 覆盖层 DOM。
// 不是说明书：每一步都必须玩家真实完成一个动作才前进；可跳过、可重看、同存档只自动弹一次。
import { t } from '../core/i18n.js';

export const TUT_STEP_IDS = ['drop', 'perfect', 'climb'];
export const DEFAULT_TARGET_HEIGHT = 5;
export const TUTORIAL_KEY = 'tutorial-done'; // Sdk.save 已带 app keyPrefix

/**
 * 纯逻辑教程状态机（无 DOM，可在 node 直接测试）。
 * 步骤：0 drop（截停第一块）→ 1 perfect（拿一次完美对齐）→ 2 climb（叠到 5 层高）
 */
export class TutorialMachine {
  constructor(opts = {}) {
    this.save = opts.save || null;
    this.load = opts.load || null;
    this.key = opts.key || TUTORIAL_KEY;
    this.targetHeight = opts.targetHeight ?? DEFAULT_TARGET_HEIGHT;
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

  onGameEvent(ev, now = 0) {
    if (!this.active || this.done) return this.snapshot();
    const type = ev && ev.type;
    if (this.step === 0) {
      if (type === 'drop') this.step = 1;
    } else if (this.step === 1) {
      if (type === 'perfect') this.step = 2;
    } else if (this.step === 2) {
      if (type === 'drop' && Number(ev.layer) >= this.targetHeight) this._finish(false);
    }
    return this.snapshot();
  }

  tick(now = 0) {
    return this.snapshot();
  }

  snapshot() {
    return {
      active: this.active,
      done: this.done,
      step: this.step,
      total: this.total,
      id: this.currentId,
      targetHeight: this.targetHeight,
    };
  }
}

/**
 * 覆盖层 DOM：右上 Skip、步骤文案。容器 pointer-events:none，卡片/Skip 才可点，
 * 因此玩家仍能直接点击画布完成真实截停动作。
 */
export function createTutorialOverlay(root, machine, opts = {}) {
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
