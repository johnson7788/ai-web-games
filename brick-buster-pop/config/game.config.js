// 全局数值与布局配置（纯逻辑 + 渲染共用）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 砖墙布局：8 列 × 7 行，顶部对齐，整墙逐回合下坠。
export const GRID = {
  COLS: 8,
  ROWS: 7,
  X0: 96,
  Y0: 60,
  CELL_W: 136,
  CELL_H: 40,
  GAP: 4,
};

// 下坠危险线：可下坠砖块底部越过此线即失败。
export const DANGER_Y = 600;

// 发射台（炮口）
export const CANNON = {
  X: 640,
  Y: 636,
};

export const BALL = {
  R: 9,
  SPEED: 860,
  LAUNCH_INTERVAL: 0.08, // 连发间隔（秒）
  SPREAD: 8,             // 整束球的喷散角（度）：让一束球覆盖一片楔形区域
  MAX_LIFE: 6,           // 单颗球最长存活秒数（防止在岩石间无限反弹）
  MAX_IN_FLIGHT: 60,
};

export const AIM = {
  MIN: -88, // 度，负=左
  MAX: 88,
};

export const COMBO_MAX = 8;

// 挂机兜底：瞄准阶段超过该秒数未发射则自动朝正上方发射（防死时间 / noinput 死亡存在性）
export const AUTO_FIRE_SEC = 6;

export const SCORING = {
  HIT: 10,      // 每打掉 1 点耐久
  BREAK: 40,    // 每摧毁 1 块
  ROCK: 2,      // 撞到岩石/固定砖
  LINE: 120,    // 激光清一排/一列
  BOMB: 160,    // 炸弹 3×3
};

// 语言：默认英文；zh 必做。未翻译的语言不要放进来。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'brick-buster-pop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
};
