// config/sdk.config.js — 唯一 SDK 配置源（appId / 广告 / 埋点 / 存档 / 分享）
// 上线把 source 改成 'online' 即加载站点 pipysdk；本地验收用 vendored mock（零外链）。
export const SDC = {
  appId: 'pipy-mega-golf-3d',
  appName: 'MEGA GOLF 3D',
  appVersion: '0.1.0',
  source: 'local',                       // 'local'（vendored，验收用）| 'online'
  sdkUrl: 'https://pipygames.com/sdk/pipysdk.min.js',
  localUrl: './src/vendor/pipysdk.js',
  loadTimeoutMs: 3000,

  ads: {
    enabled: false,                      // 未接广告账号：整个广告 UI 不出现
    fillTimeoutMs: 9000,
    placements: {
      revive: { maxPerRun: 1 },
      doubleScore: { maxPerRun: 1 },
      gameOver: { enabled: false },
    },
  },

  tracking: { enabled: true, customEvents: ['load', 'start', 'win', 'fail', 'restart', 'session_end', 'shot', 'hole', 'share'] },

  save: { keyPrefix: 'mega-golf-3d', version: 1, limits: { best: 1e9 } },

  share: { channels: ['native', 'copy'], hashtags: ['#megagolf', '#browsergame'] },
};

export default SDC;
