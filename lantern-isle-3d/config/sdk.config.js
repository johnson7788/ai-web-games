// config/sdk.config.js — 唯一 SDK 配置源（appId / 广告位 / 频控 / 存档 / 分享）
export const SDC = {
  appId: 'pipy-lantern-isle-3d',
  appName: 'LANTERN ISLE',
  appVersion: '0.1.0',
  source: 'local',                       // 'local'（vendored，验收用）| 'online'
  sdkUrl: 'https://pipygames.com/sdk/pipysdk.min.js',
  sdkVersion: '1.0.0',
  localUrl: './src/vendor/pipysdk.js',
  loadTimeoutMs: 3000,

  ads: {
    enabled: false,                      // 未接广告账号：整个广告 UI 不出现
    fillTimeoutMs: 9000,
    placements: {
      revive:      { maxPerRun: 1 },
      doubleCoins: { maxPerRun: 1 },
      gameOver:    { enabled: false },
    },
  },

  tracking: { enabled: true, customEvents: ['load', 'start', 'win', 'fail', 'restart', 'session_end', 'first_input', 'first_success', 'lantern_lit', 'lantern_lost', 'quest_done', 'night_win', 'night_fail', 'upgrade'] },

  save: { keyPrefix: 'lantern-isle-3d', version: 1, limits: { best: 1e9 } },

  share: { channels: ['native', 'copy'], hashtags: ['#lanternisle', '#browsergame'] },
};

export default SDC;
