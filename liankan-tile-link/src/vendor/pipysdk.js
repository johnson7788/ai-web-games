/* 本地 vendored SDK 占位（零依赖、零外链、零网络请求）。
 * 暴露 window.PipyGames + window.GameSDK，接口与线上 pipysdk 对齐：
 * 广告关闭、埋点本地 noop、存档落 localStorage。上线接入真实 SDK 时无需改业务代码。 */
;(function (root) {
  'use strict';

  function safeGet(key) {
    try { return root.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { root.localStorage.setItem(key, val); return true; } catch (e) { return false; }
  }

  const sdk = {
    ads: { enabled: false, placements: {} },
    tracking: { enabled: true },
    save: function (key, value) { safeSet(key, JSON.stringify(value)); },
    load: function (key) {
      const raw = safeGet(key);
      if (raw == null) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    },
    trackCustom: function () { /* 本地不联网，埋点 noop */ },
  };

  // 注意：window.PipyGames 上不放 save/load —— 业务侧 Sdk.save/load 需要统一的
  // 前缀命名空间（否则 SDK 就绪前后读到的 key 不一致）。存档出口只挂在 pg.sdk 上。
  const api = {
    ready: Promise.resolve(),
    showRewarded: function () { return Promise.resolve(false); },
    showInterstitial: function () { return Promise.resolve(false); },
    canShowAd: function () { return false; },
    newRun: function () {},
    levelCleared: function () {},
    gameOver: function () {},
    track: function () {},
    share: function () { return Promise.resolve('copy'); },
    sdk: sdk,
  };

  root.PipyGames = api;
  root.GameSDK = sdk;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
