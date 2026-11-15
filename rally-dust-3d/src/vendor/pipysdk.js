/* src/vendor/pipysdk.js — pipysdk 本地 vendored 兼容门面（source:'local' 验收用）。
 * 与线上 https://pipygames.com/sdk/pipysdk.min.js 同形（window.PipyGames / window.GameSDK），
 * 但零外部请求、广告关闭、无防破解/devtools 陷阱，专供本地验收与离线降级。
 * 生产环境把 config/sdk.config.js 的 source 切到 'online' 即走真实 SDK。
 */
(function (root) {
  'use strict';
  var KEY = 'rally-dust-3d:';
  var ads = {
    enabled: false,
    placements: { revive: { enabled: false }, stageClear: { enabled: false }, gameOver: { enabled: false } },
    canShow: function () { return false; },
    showRewarded: function () { return Promise.resolve(false); },
    showInterstitial: function () { return Promise.resolve(false); },
  };
  var tracking = { enabled: true };
  var config = { appId: 'pipy-rally-dust-3d', appName: 'RALLY DUST 3D', version: '1.0.0', ads: ads, tracking: tracking, save: { key: 'save' } };

  function save(key, value) {
    try { root.localStorage.setItem(KEY + key, JSON.stringify(value)); } catch (e) { /* 隐私模式 */ }
    return true;
  }
  function load(key) {
    try { var r = root.localStorage.getItem(KEY + key); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }
  function track(name, payload) { return { name: name, payload: payload }; }

  var sdk = {
    config: config, ads: ads, tracking: tracking,
    save: save, load: load, track: track, trackCustom: track,
    trackLoad: function (p) { return track('load', p); }, trackStart: function (p) { return track('start', p); },
    trackWin: function (p) { return track('win', p); }, trackFail: function (p) { return track('fail', p); },
  };

  var api = {
    ready: Promise.resolve(sdk),
    showRewarded: function () { return Promise.resolve(false); },
    showInterstitial: function () { return Promise.resolve(false); },
    canShowAd: function () { return false; },
    newRun: function () {}, levelCleared: function () {}, gameOver: function () {},
    track: track, save: save, load: load,
    share: function () { return Promise.resolve('none'); },
    onAdStart: function () {}, onAdEnd: function () {},
    ad: { rewarded: function () { return Promise.resolve(false); }, interstitial: function () { return Promise.resolve(false); } },
    sdk: sdk,
  };

  root.PipyGames = api;
  root.GameSDK = sdk;
  root.GameSDKReady = Promise.resolve(sdk);
})(typeof window !== 'undefined' ? window : globalThis);
