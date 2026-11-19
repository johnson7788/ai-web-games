// config/sdk.config.js — 唯一 SDK 配置源（appId / 广告位 / 频控 / 存档 / 分享）
// 上线前把 source 改成 'online'。广告未接入账号，恒为关闭。
export const SDC = {
  appId: 'pipy-fighter-ko-arena',
  appName: 'FIGHTER KO ARENA',
  appVersion: '0.1.0',
  source: 'local',
  sdkUrl: 'https://pipygames.com/sdk/pipysdk.min.js',
  localUrl: './src/vendor/pipysdk.js',
  loadTimeoutMs: 3000,

  ads: {
    enabled: false,
    fillTimeoutMs: 9000,
    placements: {
      revive:      { maxPerRun: 1 },
      doubleCoins: { maxPerRun: 1 },
      stageClear:  { everyNLevels: 3, cooldownMs: 45000, enabled: true },
      gameOver:    { enabled: false },
    },
  },

  tracking: { enabled: true, customEvents: ['load', 'start', 'win', 'fail', 'revive', 'share'] },

  save: { keyPrefix: 'fighter-ko-arena', version: 1, limits: { best: 1e9 } },

  share: { channels: ['native', 'copy'], hashtags: ['#neonfight'] },
};

export default SDC;
