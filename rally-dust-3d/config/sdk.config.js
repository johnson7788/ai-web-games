// config/sdk.config.js — 唯一 SDK 配置源（appId / 广告位 / 频控 / 存档 / 分享）
export const SDC = {
  appId: 'pipy-rally-dust-3d',
  appName: 'RALLY DUST 3D',
  appVersion: '0.1.0',
  source: 'local',                       // 'local'（vendored，验收用，零外链）| 'online'
  sdkUrl: 'https://pipygames.com/sdk/pipysdk.min.js',
  localUrl: './src/vendor/pipysdk.js',
  loadTimeoutMs: 3000,

  ads: {
    enabled: false,                      // 未接广告账号：整个广告 UI 不出现
    fillTimeoutMs: 9000,
    placements: {
      revive:      { maxPerRun: 1 },
      doubleScore: { maxPerRun: 1 },
      stageClear:  { everyNLevels: 3, cooldownMs: 45000, enabled: false },
      gameOver:    { enabled: false },
    },
  },

  tracking: { enabled: true, customEvents: ['load', 'first_input', 'start', 'win', 'fail', 'restart', 'session_end', 'driftStart', 'hit', 'stageClear', 'share'] },

  save: { keyPrefix: 'rally-dust-3d', version: 1, limits: { best: 1e9 } },

  share: { channels: ['native', 'copy'], hashtags: ['#rallydust3d', '#browsergame'] },
};

export default SDC;
