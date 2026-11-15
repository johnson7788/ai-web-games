/* src/vendor/pipysdk.js — 本地降级版门户 SDK（验收用）
 * 目的：本地直开/断网时提供与线上 pipysdk 一致的接口面（PipyGames + GameSDK），
 *       保证 src/core/sdk.js 的统一出口永不挂起、广告/埋点/存档/分享都安全降级。
 * 特性：零运行期外链（不发任何网络请求）、无广告（enabled:false 时 showRewarded 返回 false）、
 *       埋点本地落盘、存档走 localStorage、分享走 navigator/clipboard。
 * 上线时把 config/sdk.config.js 的 source 切为 'online' 即加载真实 SDK。
 */
(function (root) {
  'use strict';
  var PREFIX = 'blaze-fps:sdk:';
  var P = 'blaze-fps';
  function safeGet(k) { try { return root.localStorage.getItem(PREFIX + k); } catch (e) { return null; } }
  function safeSet(k, v) { try { root.localStorage.setItem(PREFIX + k, v); return true; } catch (e) { return false; } }

  var events = []; // 本地埋点缓冲
  function track(name, payload) {
    try {
      var rec = { app: P, event: name, ts: Date.now() };
      if (payload && typeof payload === 'object') rec.data = payload;
      events.push(rec);
      if (events.length > 200) events.splice(0, events.length - 200);
      safeSet('events', JSON.stringify(events));
    } catch (e) { /* 埋点失败不影响玩法 */ }
  }
  try {
    var raw = safeGet('events');
    if (raw) { var arr = JSON.parse(raw); if (Array.isArray(arr)) events = arr; }
  } catch (e) { /* ignore */ }

  var GameSDK = {
    config: { appId: P, appName: 'BLAZE FPS', version: '1.0.0' },
    ads: {
      enabled: false, provider: 'none',
      placements: { revive: { enabled: true }, doubleScore: { enabled: true }, gameOver: { enabled: false } },
      canShow: function () { return false; },
      showRewarded: function () { return Promise.resolve(false); },
      showInterstitial: function () { return Promise.resolve(false); },
      resetRun: function () {},
      onLevelCleared: function () {},
    },
    tracking: { enabled: true },
    track: track,
    trackCustom: track,
    save: function (key, value) { return safeSet(key, JSON.stringify(value)); },
    load: function (key, fallback) {
      var s = safeGet(key);
      if (s == null) return fallback == null ? null : fallback;
      try { return JSON.parse(s); } catch (e) { return fallback == null ? null : fallback; }
    },
  };

  var PipyGames = {
    ready: Promise.resolve(GameSDK),
    sdk: GameSDK,
    ad: { show: function () { return Promise.resolve(false); }, rewarded: function () { return Promise.resolve(false); }, interstitial: function () { return Promise.resolve(false); } },
    showRewarded: function () { return Promise.resolve(false); },
    showInterstitial: function () { return Promise.resolve(false); },
    canShowAd: function () { return false; },
    onAdStart: function () {},
    onAdEnd: function () {},
    newRun: function () { track('start'); },
    levelCleared: function (p) { track('win', p); },
    gameOver: function (p) { track('fail', p); },
    track: track,
    save: function (key, value) { return safeSet(key, JSON.stringify(value)); },
    load: function (key, fallback) { return GameSDK.load(key, fallback); },
    share: function (payload) {
      payload = payload || {};
      var text = (payload.text || '') + ' ' + (payload.url || (typeof location !== 'undefined' ? location.href : ''));
      return Promise.resolve().then(function () {
        if (root.navigator && root.navigator.share) return root.navigator.share({ title: payload.title, text: payload.text, url: payload.url });
        if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) return root.navigator.clipboard.writeText(text);
        return false;
      }).catch(function () { return false; });
    },
  };

  root.GameSDK = GameSDK;
  root.PipyGames = PipyGames;
  root.GameSDKReady = Promise.resolve(GameSDK);
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
