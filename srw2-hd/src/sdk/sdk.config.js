/**
 * 游戏级 SDK 配置（window.SDK_CONFIG）
 *
 * - 域名授权：只允许本地与 pipygames 官方域（防止被搬运到别的站）
 * - 埋点：开启，本地 console + localStorage 缓冲（endpoint 留空，不上报）
 * - 广告：默认关闭；上线接广告时把 ads.enabled 改 true 并填 placement id
 * - 反调试：本作是免费同人重制，关闭 devtools 陷阱以免影响玩家
 */
(function (root) {
  const SDK_CONFIG = {
    appId: "srw2-hd",
    appName: "第2次超级机器人大战 HD",
    version: "2.0.0",

    domain: {
      // 本作是非官方同人重制，允许任何人自行架设；要防搬运时再改 true 并填白名单
      enabled: false,
      allowedHosts: ["localhost", "127.0.0.1", "::1", "pipygames.com", "www.pipygames.com"],
      redirectUrl: "https://pipygames.com",
      redirectDelayMs: 3000,
      allowFileProtocol: true,
      allowIframe: true,
      debug: false
    },

    ads: {
      enabled: false,
      provider: "mock",
      testMode: true,
      global: {
        pauseGameDuringAd: true,
        muteAudioDuringAd: true,
        fillTimeoutMs: 9000,
        simulateMs: 1200
      },
      placements: {
        stageClear: { format: "interstitial", id: "", enabled: true, everyNLevels: 4, cooldownMs: 60000, sdk: "" },
        gameOver: { format: "interstitial", id: "", enabled: false, everyNPlays: 3, cooldownMs: 60000, sdk: "" }
      },
      providerConfig: { custom: { scriptUrl: "", adapterGlobal: "GameAdAdapter" } },
      mockText: "广告播放中…"
    },

    protect: {
      enabled: false,
      devtoolsAction: "off",
      devtoolsTrap: false,
      disableContextMenu: false,
      disableDevtoolsShortcuts: false,
      integrity: false,
      integrityToken: "",
      heartbeatMs: 0,
      reportUrl: ""
    },

    tracking: {
      enabled: true,
      bufferSize: 200,
      endpoint: "",
      debug: false,
      autoEnv: true,
      storageKey: "srw2hd.sdk.events"
    },

    save: { enabled: false, key: "srw2hd.save.v1", guard: {} }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = SDK_CONFIG;
  else root.SDK_CONFIG = SDK_CONFIG;
})(typeof window !== "undefined" ? window : globalThis);
