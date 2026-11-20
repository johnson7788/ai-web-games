// src/ui/tutorial.js — 首次交互引导：3 步状态机（纯逻辑）+ 覆盖层 DOM。
// 不是说明书：每一步都必须玩家真实完成一个动作才前进；可跳过、可重看、同存档只自动弹一次。
// 完成/跳过经 Sdk.save 持久化（构造时注入 save/load，默认 key 见 TUTORIAL_KEY）。
import { t } from '../core/i18n.js';

export const TUT_STEP_IDS = ['tap', 'correct', 'clear'];
export const TUTORIAL_KEY = 'tutorial-done'; // Sdk.save 已带 app keyPrefix，这里不用再前缀

/**
 * 纯逻辑教程状态机（无 DOM，可在 node 直接测试）。
 * 事件：ev.type ∈ bubblePop / bubbleMiss / roundClear
 * 步骤：0 tap（点任意泡泡）→ 1 correct（点对目标）→ 2 clear（完成一轮）
 */
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
      if (type === 'bubblePop' || type === 'bubbleMiss') this.step = 1;
    } else if (this.step === 1) {
      if (type === 'bubblePop') this.step = 2;
    } else if (this.step === 2) {
      if (type === 'roundClear') this._finish(false);
    }
    return this.snapshot();
  }

  tick() {
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

/**
 * 覆盖层 DOM：高亮真实 UI（第 1 步画布、第 2/3 步目标卡）、右上 Skip、步骤文案。
 * 返回 { show, hide, render, root, visible }。
 */
export function createTutorialOverlay(root, machine, opts = {}) {
  const haloTargets = opts.haloTargets || [null, null, null];
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
    const target = haloTargets[s.step];
    if (target) positionHalo(target);
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
