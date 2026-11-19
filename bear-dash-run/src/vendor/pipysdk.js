/* BEAR DASH RUN · 本地 SDK 桩（source: 'local'）
 * 提供与门户 pipysdk 一致的 window.PipyGames / window.GameSDK 表面：
 *   广告（enabled=false）、埋点、存档、分享，全部本地/降级，零外链零联网。
 * 上线接门户时，把 config/sdk.config.js 的 source 改成 'online' 即可切换到真 SDK。
 */
(function (root) {
  'use strict';

  function safeGet(key) {
    try { return root.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { root.localStorage.setItem(key, val); return true; } catch (e) { return false; }
  }

  var SAVE_PREFIX = 'bear-dash-run:';

  function save(key, value) {
    try { safeSet(SAVE_PREFIX + key, JSON.stringify(value)); } catch (e) { /* noop */ }
    return true;
  }
  function load(key, fallback) {
    var raw = safeGet(SAVE_PREFIX + key);
    if (raw == null) return fallback === undefined ? null : fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback === undefined ? null : fallback; }
  }
  function share(payload) {
    return Promise.resolve('copy');
  }

  var ads = {
    enabled: false,
    ready: false,
    placements: {
      revive: { format: 'rewarded', enabled: true, maxPerRun: 1, cooldownMs: 0 },
      doubleCoins: { format: 'rewarded', enabled: true, maxPerRun: 1, cooldownMs: 0 },
      stageClear: { format: 'interstitial', enabled: true, everyNLevels: 3, cooldownMs: 45000 },
      gameOver: { format: 'interstitial', enabled: false, everyNPlays: 2, cooldownMs: 60000 },
    },
  };

  var tracking = { enabled: true, bufferSize: 200, endpoint: '', debug: false };

  var GameSDK = {
    config: { ads: ads, tracking: tracking, save: { guard: {} } },
    ads: ads,
    tracking: tracking,
    save: save,
    load: load,
    share: share,
    showRewarded: function () { return Promise.resolve(false); },
    showInterstitial: function () { return Promise.resolve(false); },
    canShowAd: function () { return false; },
    newRun: function () {},
    levelCleared: function () {},
    gameOver: function () {},
    track: function (name, payload) { if (tracking.debug) console.log('[SDK·track]', name, payload || {}); return { name: name, ts: Date.now() }; },
    trackCustom: function (name, payload) { return this.track(name, payload); },
  };

  root.GameSDK = GameSDK;

  var readyPromise = Promise.resolve(GameSDK);

  root.PipyGames = {
    ready: readyPromise,
    sdk: GameSDK,
    ad: { show: function () { return Promise.resolve(false); }, rewarded: function () { return Promise.resolve(false); }, interstitial: function () { return Promise.resolve(false); } },
    showRewarded: function () { return Promise.resolve(false); },
    showInterstitial: function () { return Promise.resolve(false); },
    canShowAd: function () { return false; },
    newRun: function () {},
    levelCleared: function () {},
    gameOver: function () {},
    track: function (name, payload) { return GameSDK.track(name, payload); },
    save: save,
    load: load,
    share: share,
  };

  root.GameSDKReady = readyPromise;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
