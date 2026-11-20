// NEON SERPENT · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  CEILING: 0,
  FLOOR: 720,
};

export const STEP = 1 / 60;

// 飞蛇物理 / 体型
export const SERPENT = {
  X: 260,          // 头部固定横坐标（峡谷从右向左滚动）
  R: 22,           // 头部碰撞半径
  GRAVITY: 900,    // 下坠加速度 px/s²
  FLAP_VY: -430,   // 拍翼瞬时上升速度 px/s
  MAX_FALL: 720,   // 最大下坠速度
  LAUNCH_VY: -200, // 起手小上抛，给玩家一个反应窗口
  BODY_START: 2,   // 初始身体节数（= 可吸收的撞击次数）
  BODY_MAX: 6,
  SEG_GAP: 38,     // 身体节间距
};

// 障碍门（霓虹柱）与岩石
export const GATES = {
  SPAWN_X: 960,       // 第一个门出生横坐标（距头部 ~700px）
  GAP_X: 460,         // 门间距
  W: 84,              // 柱子宽
  GAP_H: 235,         // 水晶门缺口高
  GAP_MIN_Y: 150,     // 缺口中心 Y 下限
  GAP_MAX_Y: 570,     // 缺口中心 Y 上限
  ROCK_W: 116,        // 岩石柱更宽
  ROCK_GAP_H: 165,    // 岩石缺口更窄
  ROCK_FROM: 7,       // 第 N 个门之后开始出现岩石
  ROCK_EVERY: 5,      // 每隔 N 个门出一次岩石
  COUNT: 200,
};

// 速度 / 计分 / 星级
export const GAME = {
  SPEED_BASE: 220,
  SPEED_MAX: 430,
  SPEED_PER_SCORE: 6,
  SHIELD_SPEED: 430,
  COMBO_MAX: 5,
  ZONE_EVERY: 5,      // 每 5 分进一个 zone（关卡）
  ZONE_MAX: 6,
  SHIELD_TIME: 3.0,
  FEVER_TIME: 5.0,
  INVINCIBLE_TIME: 0.6,
  STAR_NEED: 3,       // 3 星触发 FEVER
  HEART_BONUS: 5,     // 满身时吃心奖励分
};

// 道具
export const PICKUP = {
  R: 16,
  MAGNET_RANGE: 320,  // FEVER 磁吸半径（横轴）
  MAGNET_SPEED: 260,  // 磁吸拉近速度 px/s
};

// 语言：默认英文；zh 必做（完整）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'snake-fly-wing-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'snake-fly-wing-save',
};
