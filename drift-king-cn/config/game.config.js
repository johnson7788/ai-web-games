// DRIFT KING CN · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做（一线语言）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'drift-king-cn-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'drift-king-cn-save',
};

// 敌方车 4 个等级（速度/转向/体型/分值/颜色）
export const CAR_LV = [
  { lv: 1, speed: 0.95, rotate: 0.8, r: 16, score: 40, color: '#ff5d8f' },
  { lv: 2, speed: 1.1, rotate: 1.0, r: 17, score: 60, color: '#ffa23d' },
  { lv: 3, speed: 1.4, rotate: 1.2, r: 18, score: 80, color: '#ff4fd8' },
  { lv: 4, speed: 1.75, rotate: 1.5, r: 19, score: 100, color: '#ff3b3b' },
];

// 阶段（stage 1..12）里四个等级敌车的出现概率
export const STAGE_MIX = [
  [1.0, 0, 0, 0],
  [0.8, 0.2, 0, 0],
  [0.5, 0.5, 0, 0],
  [0.4, 0.5, 0.1, 0],
  [0.3, 0.5, 0.2, 0],
  [0.15, 0.55, 0.2, 0.1],
  [0.1, 0.5, 0.3, 0.1],
  [0.05, 0.45, 0.35, 0.15],
  [0.0, 0.4, 0.4, 0.2],
  [0.0, 0.35, 0.4, 0.25],
  [0.0, 0.25, 0.4, 0.35],
  [0.0, 0.15, 0.4, 0.45],
];

export const GAME = {
  PLAYER_SPEED: 250,        // 基础前进速度 px/s
  PLAYER_ROTATE: 120,       // 转向角速度 deg/s
  MAX_DRIFT_LAG: 60,        // 车头与速度方向最大漂移角（deg）
  PLAYER_R: 20,             // 玩家碰撞半径
  PLAYER_MAX_HP: 3,
  EAT_RANGE: 100,           // 拾取半径
  RANGE_MULT: 3,            // 磁吸道具拾取倍率
  BOOST_MAX: 3,             // 氮气充能上限
  HIT_TIME: 8,              // 狂暴时长 s
  HOT_TIME: 6,              // 超狂暴时长 s
  HIT_KILLS_TO_HOT: 6,      // 狂暴期击杀数 → 超狂暴
  SHIELD_TIME: 2,           // 结束狂暴后的护盾
  COMBO_WINDOW: 3,          // 连击窗口 s
  COMBO_MAX: 9,
  DRIFT_FILL: 0.45,         // 漂移充能速率（格/s）
  SPAWN_DIST: 900,          // 前方刷怪距离
  SPAWN_ANGLE_JITTER: 26,   // 刷怪角度抖动 deg
  PYLON_R: 16,
  STAR_MIN: 50,
  STAR_MAX: 500,
  SCORE_TICK: 2,            // 被动每秒得分
  STAGE_SECONDS: 45,        // 每阶段时长
  STAGE_MAX: 12,
  ENEMY_COOLDOWN: 0.8,      // 敌车碰撞后冷却
  PLAYER_INVULN: 2,         // 受伤后无敌
};
