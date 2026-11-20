// 全局数值配置：CHEF MARIE SERVE（横版平台跳跃，厨师跑厨房收集食材上菜）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 560, // 主地面顶边（世界坐标，y 向下）
  DEATH_Y: 780, // 掉到这条线以下判死亡
};

export const STEP = 1 / 60;

export const PLAYER = {
  WIDTH: 44,
  HEIGHT: 60,
  MAX_SPEED: 360, // 最大水平速度 px/s
  ACCEL: 3000, // 地面加速度
  AIR_ACCEL: 2200, // 空中加速度
  FRICTION: 4200, // 地面摩擦减速
  GRAVITY: 2400,
  MAX_FALL: 1150,
  JUMP_VY: -950, // 起跳竖直速度
  COYOTE: 0.09, // 土狼时间（秒）
  INVINCIBLE_MS: 1300, // 受伤后无敌帧
};

export const ENEMY = {
  SPEED: 92,
  STOMP_VY: -540, // 踩敌人后的弹跳
  STOMP_SCORE: 40,
  SMASH_SCORE: 60,
};

export const SPICE = {
  DURATION: 6, // 香料无敌/加速持续时间
  SPEED_MULT: 1.35,
};

export const SCORE = {
  INGREDIENT: 10, // 每个食材基础分
  COMBO_INGREDIENT: 10, // 连击加成分按 combo 倍率乘
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'chef-marie-serve-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'chef-marie-serve-save',
};
