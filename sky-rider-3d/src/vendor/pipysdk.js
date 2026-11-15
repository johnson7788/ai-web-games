// src/vendor/pipysdk.js — 平台 SDK 本地降级实现（source:'local' 验收用）。
// 零外链、零网络请求：提供 window.PipyGames 的稳定接口，广告关闭、埋点落 localStorage。
// 上线时把 config/sdk.config.js 的 source 改为 'online' 即加载 https://pipygames.com/sdk/pipysdk.min.js。
(function (root) {
  'use strict';
  const ads = { enabled: false, provider: 'none', placements: {} };
  root.PipyGames = {
    ready: Promise.resolve(),
    showRewarded: () => Promise.resolve(false),
    showInterstitial: () => Promise.resolve(false),
    canShowAd: () => false,
    newRun: () => {},
    levelCleared: () => {},
    gameOver: () => {},
    track: () => {},
    share: () => Promise.resolve('none'),
    sdk: { ads, tracking: { enabled: true } },
  };
})(typeof window !== 'undefined' ? window : globalThis);
