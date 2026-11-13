// src/core/assist.js — 助攻次数经济（纯状态机：不碰 DOM、不碰广告，便于单测）
// 规则见 references/ads-design.md §2：
//   1. 次数必须可见（UI 显示 ×n）；
//   2. 用光按钮不消失，切成「看广告 +N」仍可点；
//   3. 补充有上限（maxRefillPerRun），防刷也防广告位贬值；
//   4. refill() 只允许在 showRewarded 返回 true 之后调用——绝不因为「没广告」而白送。
const DEFAULTS = { perRun: 3, refill: 3, maxRefillPerRun: 2 };

export class Assist {
  constructor(cfg = {}) {
    this.cfg = { ...DEFAULTS, ...cfg };
    this.reset();
  }

  /** 新一局：回满初始次数（跨关保留，只在 startRun 调用） */
  reset() {
    this.left = this.cfg.perRun;
    this.refills = 0;
  }

  get canUse() { return this.left > 0; }

  /** 用光且还有补充额度 → UI 显示「看广告 +N」按钮 */
  get canRefill() { return this.left === 0 && this.refills < this.cfg.maxRefillPerRun; }

  /** 消耗 1 次；无次数返回 false（调用方此时应走广告补充或提示） */
  use() {
    if (!this.canUse) return false;
    this.left -= 1;
    return true;
  }

  /** 广告奖励到账后补次数；额度用完或无次数需求时返回 false */
  refill() {
    if (!this.canRefill) return false;
    this.left += this.cfg.refill;
    this.refills += 1;
    return true;
  }

  /** 给 UI 的只读快照 */
  snapshot() {
    return {
      left: this.left,
      perRun: this.cfg.perRun,
      refills: this.refills,
      maxRefills: this.cfg.maxRefillPerRun,
      refillSize: this.cfg.refill,
      canUse: this.canUse,
      canRefill: this.canRefill
    };
  }
}
