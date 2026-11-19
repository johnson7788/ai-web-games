// BARBARIAN BASH · 全局数值配置
// 画布坐标系：y 向下，原点左上。地面 GROUND_Y，重力 GRAVITY 指向 +y（下）。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 620,
  GRAVITY: 1500,        // px/s^2，向下
};

export const STEP = 1 / 60;

// 投掷手感（拖拽瞄准：方向 = 手 → 指针；力度随拖拽距离在 MIN/MAX 间）
export const THROW = {
  SPEED: 1150,          // 满力度初速 px/s
  POWER_MIN: 0.55,
  POWER_MAX: 1.12,
  DEAD_ZONE: 26,        // 小于此距离不投掷
  FULL_DRAG: 240,       // 达到满力度所需拖拽距离
  BOULDER_R: 13,
  LIFE: 4.0,            // 岩石最长存活秒
  WALL_BOUNCE: 0.62,    // 左右墙反弹系数
  FLOOR_BOUNCE: 0.5,    // 地面反弹系数
};

export const PLAYER = {
  HX: 150,              // 手（岩石生成点）
  HY: 500,
  BODY_X: 150,
  FEET_Y: 620,
};

export const COMBO = {
  BASE: 100,            // 每杀基础分
  PER_STREAK: 25,       // 每连击加成
  CRIT_BONUS: 150,      // 弱点暴击额外分
};

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'barbarian-bash-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'barbarian-bash-save',
};
