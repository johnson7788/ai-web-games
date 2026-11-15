// config/sdk.config.js — 唯一 SDK 配置源（appId / 广告位 / 频控 / 存档 / 分享）
export const SDC = {
  appId: 'pipy-ragdoll-archers-3d',
  appName: 'RAGDOLL ARCHERS 3D',
  appVersion: '0.1.0',
  source: 'local',                       // 'local'（vendored，验收用）| 'online'
  sdkUrl: 'https://pipygames.com/sdk/pipysdk.min.js',
  localUrl: './src/vendor/pipysdk.js',
  loadTimeoutMs: 3000,

  ads: {
    enabled: false,                      // 未接广告账号：整个广告 UI 不出现
    fillTimeoutMs: 9000,
    placements: {
      revive:      { maxPerRun: 1 },
      doubleCoins: { maxPerRun: 1 },
      stageClear:  { everyNLevels: 3, cooldownMs: 45000, minLevelIndex: 2 },
      gameOver:    { enabled: false },
    },
  },

  tracking: { enabled: true, customEvents: ['load', 'first_input', 'start', 'win', 'fail', 'restart', 'session_end', 'headshot', 'share'] },

  save: { keyPrefix: 'ragdoll-archers-3d', version: 1, limits: { best: 1e9, bestHeadshots: 1e6 } },

  share: { channels: ['native', 'copy'], hashtags: ['#ragdollarchers', '#browsergame'] },
};

export default SDC;
