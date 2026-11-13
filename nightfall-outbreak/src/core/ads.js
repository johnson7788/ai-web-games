// src/core/ads.js — pipysdk 广告封装（唯一允许的广告入口）
// 文档：references/pipysdk-developer-guide.md（禁止凭猜测编造 API）
// 原则：SDK 未就绪/加载失败时全部降级为「不发奖励」，绝不在没有广告的情况下白送奖励。
const SDK_URL = "https://pipygames.com/sdk/pipysdk.min.js";

function bridge() {
  return typeof window !== "undefined" ? window.PipyGames : null;
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, ms);
    Promise.resolve(promise).then(
      (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
      () => { if (!done) { done = true; clearTimeout(timer); resolve(null); } }
    );
  });
}

export class Ads {
  constructor(cfg = {}) {
    this.cfg = cfg;
    this.sdk = null;
    this.ready = false;
    this.paused = false;
    this._startHandlers = [];
    this._endHandlers = [];
  }

  /** 等 SDK 就绪（最多 3s）；失败返回 false，游戏照常可玩，但广告按钮全部隐藏。 */
  async init() {
    const s = bridge();
    if (!s) return false;
    this.sdk = s;
    await withTimeout(s.ready, 3000);
    this.ready = true;
    try {
      s.onAdStart?.(() => { this.paused = true; this._startHandlers.forEach((f) => f()); });
      s.onAdEnd?.(() => { this.paused = false; this._endHandlers.forEach((f) => f()); });
    } catch (_) { /* 老版本 SDK 没有回调 API，忽略 */ }
    return true;
  }

  /** 广告开始/结束回调（暂停游戏、静音） */
  onStart(fn) { this._startHandlers.push(fn); }
  onEnd(fn) { this._endHandlers.push(fn); }

  /** 当前能否展示（频控/冷却），用于隐藏广告按钮 */
  canShow(placement) {
    if (!this.ready || !this.sdk?.canShowAd) return false;
    try { return !!this.sdk.canShowAd(placement); } catch (_) { return false; }
  }

  /** 激励视频：true 才发奖励 */
  async rewarded(placement) {
    if (!this.ready || !this.sdk?.showRewarded) return false;
    try {
      const ok = await withTimeout(this.sdk.showRewarded(placement), 30000);
      return ok === true;
    } catch (_) {
      return false;
    }
  }

  /** 插屏：频控不满足时 SDK 内部自动跳过，不返回失败 */
  async interstitial(placement) {
    if (!this.ready || !this.sdk?.showInterstitial) return false;
    try {
      await withTimeout(this.sdk.showInterstitial(placement), 20000);
      return true;
    } catch (_) {
      return false;
    }
  }

  /** 开局：重置按局频控 + 上报 start（revive / doubleCoins 每局 1 次，必须先调它） */
  newRun() {
    try { this.sdk?.newRun?.(); } catch (_) { /* 降级忽略 */ }
  }

  levelCleared(payload) {
    try { this.sdk?.levelCleared?.(payload); } catch (_) { /* 降级忽略 */ }
  }

  gameOver(payload) {
    try { this.sdk?.gameOver?.(payload); } catch (_) { /* 降级忽略 */ }
  }

  track(name, payload) {
    try { this.sdk?.track?.(name, payload); } catch (_) { /* 降级忽略 */ }
  }

  /** 诊断：脚本是否真的加载成功（开屏可提示「广告不可用」而不报错） */
  isLoaded() {
    return !!bridge();
  }

  get scriptUrl() { return SDK_URL; }
}
