// config/sdk.config.js — 唯一 SDK 配置源（appId / 广告位 / 频控 / 存档 / 分享）
// classic 脚本版：window.SDK_CONFIG 由 src/core/sdk-boot.js 读取。
window.SDK_CONFIG = {
  appId: 'pipy-beatrix',
  appName: 'Beatrix',
  appVersion: '1.0.0',
  source: 'local',                       // 'local'（vendored，与已上线 38 款一致）| 'online'
  sdkUrl: 'https://pipygames.com/sdk/pipysdk.min.js',
  localUrl: './src/vendor/pipysdk.js',
  loadTimeoutMs: 3000,

  ads: {
    enabled: false,                      // 未接广告账号：整个广告 UI 不出现
    fillTimeoutMs: 9000,
    placements: {
      revive:      { maxPerRun: 1 },
      doubleScore: { maxPerRun: 1 },
      gameOver:    { enabled: false },
    },
  },

  tracking: { enabled: true, customEvents: ['load', 'start', 'win', 'fail', 'restart', 'session_end', 'share'] },

  save: { keyPrefix: 'beatrix', version: 1 },

  share: { channels: ['native', 'copy'], hashtags: ['#browsergame'] },
};
