// LIL HERO SAGA · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 物理 / 玩家（px·s）
export const GAME = {
  GRAVITY: 1600,
  FALL_MULT: 1.6,
  RISE_MULT: 1.0,
  JUMP_CUT: 2.0,       // 松开跳跃键后上升期额外重力倍率

  PLAYER_W: 30,
  PLAYER_H: 46,
  MOVE_SPEED: 280,
  JUMP_V: -820,
  DOUBLE_JUMP_V: -760,
  DASH_SPEED: 900,
  DASH_TIME: 0.18,
  INVINCIBLE_AFTER_HIT: 1.1,
  MAX_HP: 3,

  MP_MAX: 10,
  MP_COST: 4,          // 每种参与颜色消耗
  MP_REFILL: 1 / 0.12, // 每秒回 1/0.12 点

  COMBO_WINDOW: 2.6,   // 连击续接窗口（秒）
  ORANGE_RANGE_X: 800,
  ORANGE_RANGE_Y: 270,
  PURPLE_RADIUS: 230,

  FIREBALL_SPEED: 620,
  FIREBALL_DMG: 1,
  FROST_SPEED: 430,
  FROST_DMG: 1,
  FROST_SLOW: 1.6,     // 减速持续秒

  STAR_PAR_TIME: 60,   // 用时 ≤ 此值 +1 星
};

// 语言：默认英文；zh 必做。只暴露 en/zh。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'lil-hero-saga-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'lil-hero-saga-save',
};
