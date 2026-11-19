// src/ui/tutorial.js — 首次交互引导：3 步状态机（纯逻辑）+ 覆盖层 DOM。
// 不是说明书：每一步都必须玩家真实完成一个动作才前进；可跳过、可重看、同存档只自动弹一次。
// 完成/跳过经 Sdk.save 持久化（构造时注入 save/load）。
import { t } from '../core/i18n.js';

export const TUT_STEP_IDS = ['aim', 'shoot', 'hit'];
export const TUTORIAL_KEY = 'tutorial-done'; // Sdk.save 已带 app keyPrefix

/**
 * 纯逻辑教程状态机（无 DOM，可在 node 直接测试）。
 * 事件：ev.type ∈ aim / shot / hit / kill / tankHit / goldenHit / ghostHit
 * 步骤：0 aim（瞄准）→ 1 shoot（发射）→ 2 hit（命中一只乌鸦）
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

  /** main 每帧把游戏事件转发进来。 */
  onGameEvent(ev, now = 0) {
    if (!this.active || this.done) return this.snapshot();
    const type = ev && ev.type;
    if (this.step === 0) {
      if (type === 'aim') this.step = 1;
    } else if (this.step === 1) {
      if (type === 'shot') this.step = 2;
    } else if (this.step === 2) {
      if (type === 'hit' || type === 'kill' || type === 'tankHit' || type === 'goldenHit' || type === 'ghostHit') this._finish(false);
    }
    return this.snapshot();
  }

  /** 每帧推进（本作无「按住 N 秒」步骤，保留接口一致性）。 */
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
 * 覆盖层 DOM：高亮真实画布（第 1 步）、右上 Skip、底部居中卡片。
 * 卡片必须固定底部居中：#tut-card { left:50%; transform:translateX(-50%); bottom:36px; }
 */
export function createTutorialOverlay(root, machine, opts = {}) {
  const canvas = opts.canvas || root.querySelector('canvas') || document.getElementById('canvas');
  const overlay = document.createElement('div');
  overlay.id = 'tutorial';
  overlay.className = 'tutorial hidden';
  overlay.setAttribute('data-tutorial', '');
  overlay.innerHTML =
    '<div class="tutorial-dim"></div>' +
    '<div class="tutorial-halo"></div>' +
    '<div id="tut-card" class="tutorial-card">' +
    '<span class="tutorial-step"></span>' +
    '<h3 class="tutorial-title"></h3>' +
    '<p class="tutorial-text"></p>' +
    '<button class="tutorial-skip" data-tutorial-skip type="button"></button>' +
    '</div>';
  root.appendChild(overlay);

  const skipBtn = overlay.querySelector('[data-tutorial-skip]');
  const stepEl = overlay.querySelector('.tutorial-step');
  const titleEl = overlay.querySelector('.tutorial-title');
  const textEl = overlay.querySelector('.tutorial-text');
  const halo = overlay.querySelector('.tutorial-halo');

  // 每步高亮的世界坐标矩形（步骤 0/1 高亮弹弓，步骤 2 高亮天空目标带）
  const FOCUS = [
    { x: 520, y: 540, w: 240, h: 170 },
    { x: 520, y: 540, w: 240, h: 170 },
    { x: 320, y: 90, w: 640, h: 180 },
  ];

  function mapWorldRect(fx, fy, fw, fh) {
    if (!canvas) return { left: 0, top: 0, width: 0, height: 0 };
    const a = canvas.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    const scale = Math.min(a.width / 1280, a.height / 720);
    const ox = a.left - b.left + (a.width - 1280 * scale) / 2;
    const oy = a.top - b.top + (a.height - 720 * scale) / 2;
    return {
      left: ox + fx * scale,
      top: oy + fy * scale,
      width: fw * scale,
      height: fh * scale,
    };
  }

  function positionHalo(focus) {
    if (!focus) { halo.classList.remove('on'); return; }
    const r = mapWorldRect(focus.x, focus.y, focus.w, focus.h);
    halo.style.left = (r.left - 6) + 'px';
    halo.style.top = (r.top - 6) + 'px';
    halo.style.width = (r.width + 12) + 'px';
    halo.style.height = (r.height + 12) + 'px';
    halo.classList.add('on');
  }

  function render() {
    const s = machine.snapshot();
    stepEl.textContent = t('tut.step', { n: s.step + 1, total: s.total });
    titleEl.textContent = t('tut.title');
    textEl.textContent = t('tut.' + (s.step + 1));
    skipBtn.textContent = t('btn.skip');
    skipBtn.setAttribute('aria-label', t('btn.skip'));
    positionHalo(FOCUS[s.step] || null);
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
