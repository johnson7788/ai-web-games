// APACHE TRAIL · 全局数值配置（数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  HUD_H: 56,          // 顶部 HUD 不透明条高度（游戏区从 y=HUD_H 起）
};

export const STEP = 1 / 60;

// 玩家物理（60Hz 固定步长；单位 px/step）
export const PLAYER = {
  W: 40,
  H: 44,
  RUN_SPEED: 5.5,      // 地面水平速度
  AIR_SPEED: 3.2,      // 空中水平速度
  JUMP_FORCE: -13.0,   // 跳跃初速度（向上为负）
  GRAVITY: 0.60,       // 每帧重力
  MAX_FALL: 16,        // 最大下落速度
  CLIMB_SPEED: 1.1,    // 抓墙下滑速度
  COYOTE: 0.10,        // 离地后仍可跳跃的宽容时间（秒）
  JUMP_BUFFER: 0.12,   // 落地前按跳的缓冲时间（秒）
  MAX_JUMPS: 2,        // 最多连跳次数（二段跳）
  WALL_STICK: 3.0,     // 抓墙判定距离
  WIND_FORCE: 3.0,     // 风给玩家的水平速度
};

// 游戏规则数值
export const GAME = {
  COMBO_WINDOW: 3.0,   // 连击窗口（秒）
  COMBO_MAX: 8,        // 连击上限
  TIME_SHARD: 6,       // 时间沙漏 +秒
  SHIELD_INVULN: 1.0,  // 护盾破裂后的无敌时间（秒）
  CRYSTAL_SCORE: 10,   // 每颗水晶基础分
  FALL_OUT: 120,       // 掉出屏幕底部多少 px 判死
};

// 语言：默认英文；zh 必做；只暴露 en/zh（完整翻译）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'apache-trail-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'apache-trail-save',
};
