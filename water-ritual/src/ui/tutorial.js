// src/ui/tutorial.js — 首次交互引导：3 步状态机（纯逻辑）+ 覆盖层 DOM。
// 不是说明书：每一步都必须玩家真实完成一个动作才前进；可跳过、可重看、同存档只自动弹一次。
// 完成/跳过经 Sdk.save 持久化（构造时注入 save/load，默认 key 见 TUTORIAL_KEY）。
import { t } from '../core/i18n.js';

export const TUT_STEP_IDS = ['pour', 'score', 'perfect'];
export const TUTORIAL_KEY = 'tutorial-done'; // Sdk.save 已带 app keyPrefix，这里不用再前缀

/**
 * 纯逻辑教程状态机（无 DOM，可在 node 直接测试）。
 * 事件：ev.type ∈ pourStart / orderScored / perfect
 * 步骤：0 pour（真实按住倒水）→ 1 score（完成一单）→ 2 perfect（一口回甘金圈涟漪）
 */
export class TutorialMachine {
  constructor(opts = {}) {
    this.save = opts.save || null;
    this.load = opts.load || null;
    this.key = opts.key || TUTORIAL_KEY;
    this.onDone = null; // ({ done, skipped }) => void
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

  /** 首次进入自动弹：已持久化或已在跑则不重复。 */
  begin() {
    if (this.done || this.active) return false;
    this.reset();
    this.active = true;
    return true;
  }

  /** 标题/暂停「How to play」强制重看。 */
  replay() {
    this.reset();
    this.active = true;
    return true;
  }

  /** 右上 Skip：直接完成并持久化。 */
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

  /** main 每帧把游戏事件转发进来；now 为毫秒时间戳（测试可注入）。 */
  onGameEvent(ev, now = 0) {
    if (!this.active || this.done) return this.snapshot();
    const type = ev && ev.type;
    if (this.step === 0) {
      if (type === 'pourStart') this.step = 1;
    } else if (this.step === 1) {
      if (type === 'orderScored') this.step = 2;
    } else if (this.step === 2) {
      if (type === 'perfect') this._finish(false);
    }
    return this.snapshot();
  }

  /** 每帧推进时间（本作无「按住 N 秒」步骤，保留接口）。 */
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
    };
  }
}

/**
 * 覆盖层 DOM：高亮真实画布（第 1 步）、右上 Skip、步骤文案。
 * 返回 { show, hide, render, root, visible }。
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
