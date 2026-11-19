/* 本地验收用 SDK 桩（source: 'local'）。
 * 契约与线上 pipysdk 一致：window.PipyGames 暴露就绪 promise 与 7 个快捷 API，
 * window.GameSDK 暴露 config（ads.enabled / tracking.enabled / placements）。
 * 本桩零外部请求、零广告，供本地验收 / 离线降级。上线时把 config/sdk.config.js 的
 * source 改成 'online' 即切换到正式 pipysdk。 */
;(function (root) {
  'use strict';
  if (root.PipyGames) return;

  const placements = {
    revive: { format: 'rewarded', enabled: false },
    doubleCoins: { format: 'rewarded', enabled: false },
    assist: { format: 'rewarded', enabled: false },
    stageClear: { format: 'interstitial', enabled: false },
    gameOver: { format: 'interstitial', enabled: false },
  };

  const config = {
    appId: (typeof document !== 'undefined'
      && document.querySelector('script[data-pipysdk]')
      && document.querySelector('script[data-pipysdk]').dataset.appId) || 'pipy-happy-pop-crush',
    appName: 'HAPPY POP CRUSH',
    version: '0.1.0',
    ads: { enabled: false, provider: 'none', placements },
    tracking: { enabled: true, endpoint: '' },
    save: { enabled: true, key: 'save', guard: { score: 1e9, best: 1e9 } },
  };

  const GameSDK = {
    config,
    ads: {
      enabled: false,
      placements,
      canShow() { return false; },
      showRewarded() { return Promise.resolve(false); },
      showInterstitial() { return Promise.resolve(false); },
      resetRun() {},
      onLevelCleared() {},
      onAdStart: null,
      onAdEnd: null,
    },
    tracking: { enabled: true, endpoint: '' },
    shield: {
      save() { return true; },
      verify() { return { tampered: false, reason: 'ok' }; },
    },
    track() { return null; },
    trackCustom() { return null; },
    trackStart() { return null; },
    trackWin() { return null; },
    trackFail() { return null; },
    init() { return this; },
  };

  let runUsage = {};

  const PipyGames = {
    ready: Promise.resolve(GameSDK),
    showRewarded() { return Promise.resolve(false); },
    showInterstitial() { return Promise.resolve(false); },
    canShowAd() { return false; },
    newRun() { runUsage = {}; },
    levelCleared() {},
    gameOver() {},
    track() { return null; },
    onAdStart() {},
    onAdEnd() {},
    ad: { rewarded() { return Promise.resolve(false); }, interstitial() { return Promise.resolve(false); } },
    sdk: GameSDK,
  };

  root.GameSDK = GameSDK;
  root.PipyGames = PipyGames;
  root.GameSDKReady = Promise.resolve(GameSDK);
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
