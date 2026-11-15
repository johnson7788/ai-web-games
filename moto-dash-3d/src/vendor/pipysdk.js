/* src/vendor/pipysdk.js — 本地验收用 SDK 桩（零外链、零网络请求）。
 * 线上由 pipygames.com/sdk/pipysdk.min.js 提供真实域名锁/广告桥/埋点上报；
 * 本桩只提供 window.PipyGames 的同一接口面 + localStorage 存档，供 sdk-check 与离线验收。
 * 业务代码一律走 src/core/sdk.js（统一出口），不直接碰本全局。
 */
(function (root) {
  'use strict';
  if (root.PipyGames) return;

  const PREFIX = 'moto-dash-3d:sdk:';
  const rawGet = (k) => { try { return root.localStorage.getItem(PREFIX + k); } catch { return null; } };
  const rawSet = (k, v) => { try { root.localStorage.setItem(PREFIX + k, v); } catch { /* 隐私模式 */ } };

  const adCbs = { start: [], end: [] };

  const GameSDK = {
    ads: {
      enabled: false,
      provider: 'mock',
      placements: {
        revive: { format: 'rewarded', enabled: true, maxPerRun: 1, cooldownMs: 0 },
        doubleScore: { format: 'rewarded', enabled: true, maxPerRun: 1, cooldownMs: 0 },
        gameOver: { format: 'interstitial', enabled: false, everyNPlays: 2, cooldownMs: 60000 },
      },
      canShow() { return false; },
    },
    tracking: { enabled: true, storageKey: 'moto-dash-3d:sdk_events' },
    track() { /* 本地桩：不落盘不报错 */ },
    save(key, value) { rawSet(key, JSON.stringify(value)); },
    load(key) {
      const t = rawGet(key);
      if (t == null) return undefined;
      try { return JSON.parse(t); } catch { return undefined; }
    },
    sheet: { save(key, value) { rawSet(key, JSON.stringify(value)); } },
  };

  const ready = Promise.resolve(GameSDK);

  root.PipyGames = {
    ready,
    showRewarded: () => Promise.resolve(false),
    showInterstitial: () => Promise.resolve(false),
    canShowAd: () => false,
    onAdStart: (cb) => { if (typeof cb === 'function') adCbs.start.push(cb); },
    onAdEnd: (cb) => { if (typeof cb === 'function') adCbs.end.push(cb); },
    newRun: () => {},
    levelCleared: () => {},
    gameOver: () => {},
    track: () => {},
    ad: { show: () => Promise.resolve(false), rewarded: () => Promise.resolve(false), interstitial: () => Promise.resolve(false) },
    sdk: GameSDK,
  };

  root.GameSDK = GameSDK;
  root.GameSDKReady = ready;
})(typeof window !== 'undefined' ? window : globalThis);
