// config/sdk.config.js — 唯一 SDK 配置源（appId / 广告位 / 频控 / 存档 / 分享）
export const SDC = {
  appId: 'pipy-pixel-mine-3d',
  appName: 'PIXEL MINE 3D',
  appVersion: '0.1.0',
  source: 'local',                       // 验收用 local（vendored 零外链）；上线切 online
  sdkUrl: 'https://pipygames.com/sdk/pipysdk.min.js',
  localUrl: './src/vendor/pipysdk.js',
  loadTimeoutMs: 3000,

  ads: {
    enabled: false,                      // 未接广告账号：广告 UI 不出现，showRewarded 安全返回 false
    fillTimeoutMs: 9000,
    placements: {
      revive:      { maxPerRun: 1 },
      doubleCoins: { maxPerRun: 1 },
      gameOver:    { enabled: false },
    },
  },

  tracking: { enabled: true, customEvents: ['load', 'start', 'win', 'fail', 'restart', 'session_end', 'share'] },

  save: { keyPrefix: 'pixel-mine-3d', version: 1, limits: { coins: 1e9, best: 1e9 } },

  share: { channels: ['native', 'copy'], hashtags: ['#pixelmine3d', '#browsergame'] },
};

export default SDC;
