// 全局数值配置（Lead 拥有；数值改动只改这里）
// 玩法：双「神手」各控一名前锋，在 4 车道霓虹球场向上狂奔，躲开防守屏障 / 滚动岩石，
// 收集能量晶片叠连击，吃道具（护盾/减速/磁吸）冲更远。无尽 = 距离榜，关卡 = 到终点结算星级。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  LANES: 4,             // 4 车道：左外/左内/右内/右外
  LANE_W: 320,          // 每车道宽
  STRIKER_Y: 560,       // 前锋固定 y（场底上方）
  STRIKER_R: 26,        // 前锋碰撞半径
};

export const STEP = 1 / 60;

// 车道像素中心（绝对车道 0..3：左外 / 左内 / 右内 / 右外）
export const LANE_X = [160, 480, 800, 1120];

// 每半场 2 条车道：左半 {0,1}，右半 {2,3}
export const HALF_LANES = { L: [0, 1], R: [2, 3] };

// 前锋默认车道（左半在外 0，右半在外 3）
export const DEFAULT_LANES = { L: 0, R: 3 };

export const GAME = {
  BASE_SPEED: 5.5,      // 无尽基础滚动速度（px/step，60Hz）
  METER_PER_PX: 0.01,   // 100px = 1 米
  WALL_GAP: [380, 700], // 两排障碍之间的 px 间隔（随机）
  WALL_H: 72,           // 防守屏障高度
  ROCK_H: 46,           // 岩石（较矮，滚过车道）
  ROCK_DRIFT: 0.9,      // 岩石横向漂移 px/step
  ORB_R: 15,
  POWERUP_R: 20,
  SHIELD_SEC: 3.0,
  SLOW_SEC: 3.0,
  MAGNET_SEC: 3.0,
  COMBO_WINDOW: 4.0,    // 连击保持窗口（秒）
  STAR_ORBS: 4,         // 关卡里收集 N 个晶片 → +1 星
  STAR_PERFECT: 8,      // 关卡里收集 N 个晶片 → +1 星（满星）
  TUTORIAL_STEPS: 3,
};

// 语言：默认英文；zh 必做；只暴露 en/zh（完整翻译才暴露，避免豆腐块）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'god-hand-soccer-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'god-hand-soccer-save',
};
