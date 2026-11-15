// config/sdk.config.js — 唯一 SDK 配置源（appId / 广告位 / 频控 / 存档 / 分享）
export const SDC = {
  appId: 'sky-rider-3d',
  appName: 'SKY RIDER 3D',
  appVersion: '0.1.0',
  source: 'local',                       // 'local'（vendored 验收用）| 'online'
  sdkUrl: 'https://pipygames.com/sdk/pipysdk.min.js',
  localUrl: './src/vendor/pipysdk.js',
  loadTimeoutMs: 3000,

  ads: {
    enabled: false,                      // 未接广告账号：广告 UI 不出现，showRewarded 安全返回 false
    fillTimeoutMs: 9000,
    placements: {
      revive:      { maxPerRun: 1 },
      doubleScore: { maxPerRun: 1 },
      gameOver:    { enabled: false },
    },
  },

  tracking: { enabled: true, customEvents: ['load', 'start', 'win', 'restart', 'session_end', 'ringPass', 'crash', 'share'] },

  save: { keyPrefix: 'sky-rider-3d', version: 1, limits: { best: 1e9 } },

  share: { channels: ['native', 'copy'], hashtags: ['#skyrider3d', '#browsergame'] },
};

export default SDC;
