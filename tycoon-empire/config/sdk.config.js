// config/sdk.config.js — 唯一 SDK 配置源（appId / 广告位 / 频控 / 存档 / 分享）
// 改这里，不改代码。上线前把 source 改成 'online'。
export const SDC = {
  appId: 'pipy-tycoon-empire',
  appName: 'TYCOON EMPIRE',
  appVersion: '0.1.0',
  source: 'local',                       // 'local'（vendored，验收用）| 'online'
  sdkUrl: 'https://pipygames.com/sdk/pipysdk.min.js',
  localUrl: './src/vendor/pipysdk.js',
  loadTimeoutMs: 3000,

  ads: {
    enabled: false,                      // 未接广告账号：整个广告 UI 不出现
    fillTimeoutMs: 9000,
    placements: {
      doubleCash: { maxPerRun: 1 },
      offlineBoost: { maxPerRun: 1 },
      stockHint: { maxPerRun: 1 },
    },
  },

  tracking: { enabled: true, customEvents: ['load', 'start', 'win', 'fail', 'restart', 'session_end', 'buy', 'upgrade', 'hire', 'stockDay', 'allIn', 'loan', 'bankrupt'] },

  save: { keyPrefix: 'tycoon-empire', version: 1, limits: { best: 1e18 } },

  share: { channels: ['native', 'copy'], hashtags: ['#browsergame'] },
};

export default SDC;
