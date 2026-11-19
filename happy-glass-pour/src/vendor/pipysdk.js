/* pipysdk 本地轻量替身（验收用，source:'local'）。
 * 提供与线上 pipysdk 一致的 window.PipyGames 快捷 API 与 window.GameSDK 门面，
 * 但零外链、零网络请求、零广告（ads.enabled=false），本地直开即可跑满门禁。 */
;(function (root) {
  'use strict';
  function noop() {}

  function safeGet(key) {
    try { return root.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { root.localStorage.setItem(key, val); return true; } catch (e) { return false; }
  }

  var sdk = {
    config: {
      appId: 'pipy-happy-glass-pour',
      appName: 'HAPPY GLASS POUR',
      version: '0.1.0',
      ads: { enabled: false, provider: 'none', placements: {} },
      tracking: { enabled: true, endpoint: '' },
      save: { keyPrefix: 'happy-glass-pour' },
    },
    ads: { enabled: false, provider: 'none', placements: {} },
    tracking: { enabled: true },
    track: function () { return null; },
    save: function (key, value) { return safeSet('happy-glass-pour:' + key, JSON.stringify(value)); },
    load: function (key) {
      var raw = safeGet('happy-glass-pour:' + key);
      if (raw == null) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    },
  };

  var ready = Promise.resolve(sdk);

  root.PipyGames = {
    ready: ready,
    showRewarded: function () { return Promise.resolve(false); },
    showInterstitial: function () { return Promise.resolve(false); },
    canShowAd: function () { return false; },
    onAdStart: noop,
    onAdEnd: noop,
    newRun: noop,
    levelCleared: noop,
    gameOver: noop,
    track: noop,
    save: sdk.save,
    load: sdk.load,
    share: function () { return Promise.resolve('none'); },
    sdk: sdk,
  };

  root.GameSDK = sdk;
  root.GameSDKReady = ready;
})(typeof window !== 'undefined' ? window : globalThis);
