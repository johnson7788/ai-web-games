/* 本地降级 SDK（source: 'local'）——零网络、零外链。
 * 提供 portal SDK 的完整 API 形状：广告（恒关闭）、生命周期埋点、存档、分享。
 * 供 src/core/sdk.js 与 sdk-check.mjs 使用；线上接入时把 source 改成 'online' 即可。
 */
;(function (root) {
  'use strict';

  var PREFIX = 'virus-buster-Cells:';

  function rawGet(key) {
    try { return root.localStorage.getItem(PREFIX + key); } catch (e) { return null; }
  }
  function rawSet(key, val) {
    try { root.localStorage.setItem(PREFIX + key, val); } catch (e) { /* 隐私模式 */ }
  }

  function save(key, value) {
    rawSet(key, JSON.stringify(value));
    return true;
  }
  function load(key) {
    var t = rawGet(key);
    if (t == null) return undefined;
    try { return JSON.parse(t); } catch (e) { return undefined; }
  }

  var sdk = {
    appId: 'pipy-virus-buster-Cells',
    ads: {
      enabled: false,
      placements: { revive: {}, doubleCoins: {}, stageClear: {}, gameOver: {} },
    },
    tracking: { enabled: true },
    save: save,
    load: load,
    sheet: { save: save, load: load },
    share: function (payload) { return Promise.resolve('copy'); },
  };

  var pg = {
    sdk: sdk,
    ready: Promise.resolve(sdk),
    // 广告：本地降级恒为关闭，安全返回 false
    canShowAd: function () { return false; },
    showRewarded: function () { return Promise.resolve(false); },
    showInterstitial: function () { return Promise.resolve(false); },
    // 生命周期 / 埋点
    newRun: function (p) { track('start', p || {}); },
    levelCleared: function (p) { track('win', p || {}); },
    gameOver: function (p) { track('fail', p || {}); },
    track: track,
    // 存档 / 分享
    save: save,
    load: load,
    share: function (payload) {
      var url = (payload && payload.url) || (root.location && root.location.href) || '';
      var text = (payload && payload.text) || '';
      var nav = root.navigator;
      if (nav && nav.clipboard && nav.clipboard.writeText) {
        return nav.clipboard.writeText((text + ' ' + url).trim()).then(function () { return 'copy'; }).catch(function () { return 'copy'; });
      }
      return Promise.resolve('copy');
    },
  };

  function track(name, payload) {
    /* 本地降级：埋点 noop（可在此接入自定义上报） */
  }

  root.PipyGames = pg;
  root.GameSDK = sdk;
})(typeof window !== 'undefined' ? window : globalThis);
