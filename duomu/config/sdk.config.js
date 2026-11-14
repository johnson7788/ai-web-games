// config/sdk.config.js — 唯一 SDK 配置源（appId / 广告位 / 频控 / 存档 / 分享）
// 改这里，不改代码。上线前把 source 改成 'online'。
export const SDC = {
  appId: 'pipy-duomu',
  appName: 'SEIZE THE LOG',
  appVersion: '0.1.0',
  source: 'local',                       // 'local'（vendored，验收用）| 'online'
  sdkUrl: 'https://pipygames.com/sdk/pipysdk.min.js',
  localUrl: './src/vendor/pipysdk.js',
  loadTimeoutMs: 3000,

  ads: {
    enabled: false,                      // 未接广告账号：整个广告 UI 不出现
    fillTimeoutMs: 9000,
    placements: {
      // 输了给一次「再战」：补满血、比分保留，只在本局失败面板出现一次
      revive: { maxPerRun: 1 },
    },
  },

  tracking: { enabled: true, customEvents: ['load', 'start', 'fail', 'revive', 'share'] },

  save: { keyPrefix: 'duomu', version: 1, limits: { coins: 1e9, best: 1e9 } },

  share: { channels: ['native', 'copy'], hashtags: ['#browsergame', '#duomu'] },
};

export default SDC;
