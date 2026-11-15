/* src/vendor/pipysdk.js — pipysdk 本地 mock（source:'local' 时加载）。
 * 职责：在 window 上提供 PipyGames / GameSDK 两个对象，接口与站点 SDK 一致，
 *       广告关闭、埋点本地缓存、存档/分享走 localStorage，全部**零外链**。
 * 上线时 source 切 'online' 走真实 https://pipygames.com/sdk/pipysdk.min.js，本文件不参与。
 */
(function (root) {
  'use strict';

  function storageGet(key) {
    try { return root.localStorage.getItem(key); } catch { return null; }
  }
  function storageSet(key, val) {
    try { root.localStorage.setItem(key, val); return true; } catch { return false; }
  }

  function track(name, payload) {
    // 埋点仅本地缓存（零外链）；线上 SDK 会真正上报。失败不影响玩法。
    try {
      const key = 'pipysdk_events';
      const arr = JSON.parse(storageGet(key) || '[]');
      arr.push({ app: 'pipy-mega-golf-3d', event: name, ts: Date.now(), data: payload || {} });
      if (arr.length > 200) arr.splice(0, arr.length - 200);
      storageSet(key, JSON.stringify(arr));
    } catch { /* noop */ }
    return null;
  }

  function save(key, value) {
    storageSet('mega-golf-3d:' + key, JSON.stringify(value));
    return true;
  }
  function load(key) {
    const raw = storageGet('mega-golf-3d:' + key);
    if (raw == null) return undefined;
    try { return JSON.parse(raw); } catch { return undefined; }
  }

  var GameSDK = {
    config: { ads: { enabled: false }, tracking: { enabled: true } },
    ads: {
      enabled: false,
      placements: {},
      canShow: function () { return false; },
      showRewarded: function () { return Promise.resolve(false); },
      showInterstitial: function () { return Promise.resolve(false); },
    },
    tracking: { enabled: true },
    track: track,
    trackCustom: function (name, p) { return track(name, p); },
    save: save,
    load: load,
    shield: { save: function () {}, verify: function () { return { tampered: false }; } },
    sheet: { save: save, load: load },
  };

  var ready = Promise.resolve(GameSDK);

  root.PipyGames = {
    ready: ready,
    showRewarded: function () { return Promise.resolve(false); },
    showInterstitial: function () { return Promise.resolve(false); },
    canShowAd: function () { return false; },
    newRun: function () { track('start', {}); },
    levelCleared: function (p) { track('win', p); },
    gameOver: function (p) { track('fail', p); },
    track: function (name, p) { return track(name, p); },
    onAdStart: function () {},
    onAdEnd: function () {},
    share: function () { return Promise.resolve(true); },
    ad: {},
    sdk: GameSDK,
  };

  root.GameSDK = GameSDK;
  root.GameSDKReady = ready;
})(typeof window !== 'undefined' ? window : globalThis);
