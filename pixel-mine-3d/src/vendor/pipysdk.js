/*
 * src/vendor/pipysdk.js — 本地验收用 PipyGames SDK 桩（source:'local'）。
 * 职责：提供与线上 pipysdk.min.js 一致的 window.PipyGames API 表面
 *      （showRewarded/showInterstitial/canShowAd/newRun/levelCleared/gameOver/track/save/load/share/sdk），
 *      零网络请求、零外部依赖，广告关闭时全部安全返回 false，断网/缺失时由 src/core/sdk.js 再兜底。
 * 上线时把 config/sdk.config.js 的 source 切 'online'，本文件不再加载。
 */
(function (root) {
  'use strict';
  if (root.PipyGames) return;

  var KEY = 'pixel-mine-3d:sdk:';
  function rawGet(k) { try { return root.localStorage.getItem(KEY + k); } catch (e) { return null; } }
  function rawSet(k, v) { try { root.localStorage.setItem(KEY + k, v); return true; } catch (e) { return false; } }
  function rawDel(k) { try { root.localStorage.removeItem(KEY + k); } catch (e) { /* noop */ } }

  var ads = {
    enabled: false,
    provider: 'mock',
    placements: {},
    showRewarded: function () { return Promise.resolve(false); },
    showInterstitial: function () { return Promise.resolve(false); },
  };
  var tracking = { enabled: true };

  var sdk = {
    ads: ads,
    tracking: tracking,
    config: { tracking: tracking },
    save: function (key, value) { rawSet(key, JSON.stringify(value)); return true; },
    load: function (key) { var s = rawGet(key); if (s == null) return null; try { return JSON.parse(s); } catch (e) { return null; } },
    trackCustom: function (name, payload) { /* 本地桩：仅静默丢弃 */ },
  };

  root.GameSDK = sdk;
  root.PipyGames = {
    ready: Promise.resolve(),
    showRewarded: function (placement, cb) {
      var done = Promise.resolve(false);
      if (placement && typeof placement === 'object') {
        if (typeof placement.onError === 'function') placement.onError(new Error('ads-disabled'));
        if (typeof placement.onClose === 'function') placement.onClose(false);
      }
      if (typeof cb === 'function') cb(false);
      return done;
    },
    showInterstitial: function () { return Promise.resolve(false); },
    canShowAd: function () { return false; },
    newRun: function () {},
    levelCleared: function (payload) { if (typeof sdk.trackCustom === 'function') sdk.trackCustom('win', payload); },
    gameOver: function (payload) { if (typeof sdk.trackCustom === 'function') sdk.trackCustom('fail', payload); },
    track: function (name, payload) { if (typeof sdk.trackCustom === 'function') sdk.trackCustom(name, payload); },
    share: function () { return Promise.resolve(false); },
    sdk: sdk,
  };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
