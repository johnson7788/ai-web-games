// 全局数值配置（Lead 拥有；数值改动只改这里）
// 玩法：霓虹街机 · 竞技场逃生（躲避追击无人机，收集能量晶体，能量爆发清场，冲高波次）

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  HUD_H: 52,        // 顶部 HUD 不透明条高（玩家活动区在 HUD 下方）
  MARGIN: 24,       // 活动区安全边
};

export const STEP = 1 / 60;

export const PLAYER = {
  R: 16,
  SPEED: 340,        // 玩家速度 px/s（必须快于敌人，才能「逃」）
  STUN_SPEED: 0.18,  // 被岩石命中后的减速系数
  STUN_TIME: 0.6,
};

export const ENEMY = {
  R: 14,
  BASE_SPEED: 110,
  SPEED_PER_WAVE: 16,   // 每波 +16 px/s
  MAX_SPEED: 280,
  BASE_COUNT: 4,        // 第 1 波敌人数
  COUNT_PER_WAVE: 2,    // 每波 +2
  MAX_COUNT: 16,
  RESPAWN_EVERY: 2.0,   // 低于目标数时补兵间隔
};

export const WAVE = {
  DURATION: 15,         // 每波秒数
};

export const GEM = {
  R: 9,
  VALUE: 50,            // 单颗基础分（乘 combo）
  ENERGY: 25,           // 单颗充能
  SPAWN_EVERY: 2.2,     // 生成间隔
  MAX: 6,               // 场上晶体上限
  COMBO_TIME: 5,        // combo 窗口（秒）
};

export const ROCK = {
  R: 22,
  SPAWN_EVERY: 8,       // 岩石生成间隔
  MAX: 5,
  DRIFT: 40,            // 漂移速度 px/s
  STUN: 0.6,
};

export const SKILL = {
  RADIUS: 210,          // 能量爆发半径
  ENERGY_COST: 100,     // 满能量才能放
  COOLDOWN: 4,          // 秒
  KILL_SCORE: 100,      // 每清一架
};

export const SCORE = {
  TIME_RATE: 10,        // 每秒生存分
};

// 语言：默认英文；zh 必做
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'escape-battle-run-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'escape-battle-run-save',
};
