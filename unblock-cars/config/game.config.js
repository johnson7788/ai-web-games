// UNBLOCK CARS · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘/出口/车辆几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 56,          // 顶部 HUD 条高
  BOARD_PAD: 28,      // 棋盘外安全边
  CELL_MAX: 72,       // 单格上限（6×6 网格）
  EXIT_W: 30,         // 出口门宽
};

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'unblock-cars-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'unblock-cars-save',
};

// 游戏规则数值（sim 从 levels 读关卡；这里放跨关公共项）
export const GAME = {
  COLS: 6,
  ROWS: 6,
  HINTS_PER_LEVEL: 3,   // 每局提示次数
  COMBO_CAP: 8,         // 连击倍率上限
  COMBO_EVERY: 2,       // 每 N 步连击 +1（倍率）
  BASE_SCORE_PER_MOVE: 10,
  WIN_BONUS_PER_STAR: 500,
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 3,
};
