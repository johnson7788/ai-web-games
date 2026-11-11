/**
 * src/core/sdk.js — 公共游戏 SDK 的薄封装
 *
 * index.html 会先加载 src/sdk/sdk.config.js 与 src/sdk/gamesdk.js。
 * 若 SDK 文件缺失（例如离线精简版），这里全部降级为 no-op，游戏照常可玩。
 */

const noop = () => {};

export function initSDK() {
  const G = typeof window !== "undefined" ? window.GameSDK : null;
  if (!G || typeof G.init !== "function") {
    return { ready: false, track: noop, ads: null, sdk: null };
  }
  try {
    G.init();
  } catch (err) {
    console.warn("[SDK] init failed:", err);
  }
  try {
    if (G.protect && typeof G.protect.guardDomain === "function") {
      G.protect.guardDomain({});
    }
  } catch (err) {
    console.warn("[SDK] domain guard failed:", err);
  }
  return {
    ready: true,
    sdk: G,
    ads: G.ads || null,
    track(event, payload) {
      try {
        G.track(event, payload);
      } catch {
        /* 埋点失败不能影响游戏 */
      }
    }
  };
}
