/* pipysdk.js — 本地验收用最小 SDK 桩（source:'local'）。
 * 线上由平台注入真正的 pipysdk.min.js；本桩只实现快捷 API 形状，
 * 零网络请求、零外链、零广告：showRewarded/showInterstitial 恒返回 false，
 * 埋点/生命周期为 no-op，存档/分享交给游戏侧 Sdk 包装（含 localStorage 降级）。
 */
;(function (root) {
  "use strict";
  if (root.PipyGames) return;

  var readyPromise = Promise.resolve();

  root.PipyGames = {
    ready: readyPromise,
    ads: { enabled: false, placements: {} },
    tracking: { enabled: false },
    config: { appId: "pipy-bubble-tap-pop" },

    showRewarded: function () { return Promise.resolve(false); },
    showInterstitial: function () { return Promise.resolve(false); },
    canShowAd: function () { return false; },
    newRun: function () {},
    levelCleared: function () {},
    gameOver: function () {},
    track: function () {},
    share: function () { return Promise.resolve("copy"); },
  };
})(typeof window !== "undefined" ? window : globalThis);
