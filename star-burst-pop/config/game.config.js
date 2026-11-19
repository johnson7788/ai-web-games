// 全局数值配置（star-burst-pop · neon arcade）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 64,            // 顶部 HUD 条高
  CELL: 56,
  BOARD_W: 560,         // 10 格 × CELL
  BOARD_X: (1280 - 560) / 2,   // 360
  BOARD_Y: 92,
};

// 语言：默认英文；zh 必做（只暴露 en/zh，完整）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'star-burst-pop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'star-burst-pop-save',
};

// 游戏规则数值（跨关公共项；P0 与原版 1:1 处注释标明）
export const GAME = {
  GRID: 10,               // 网格 10×10（原版 1:1）
  STAR_TYPES: 5,          // 星体颜色 1..5（原版 1:1）
  ROCK_TYPE: 6,           // 岩石障碍（新机制）
  BASE_SCORE: 5,          // 消除得分 n²×5（原版 1:1）
  ROCK_BONUS: 50,         // 每碎裂 1 块岩石加分（新机制）
  COMBO_WINDOW: 4,        // 连击窗口（秒，新机制）
  COMBO_STEP: 5,          // 每级连击额外加分（新机制）
  END_BONUS_A: 2000,      // 剩余奖励 max(0, A - 剩余²×B)（原版 1:1）
  END_BONUS_B: 20,
  PERFECT_BONUS: 1000,    // 完美清空奖励（新机制）
  MAX_LEVEL: 3,           // 3 关小战役
  ROCKS_PER_LEVEL: 2,     // 每关岩石 = (level-1)*ROCKS_PER_LEVEL，封顶 12
  ROCK_CAP: 12,
  RATING_3: 1.6,          // 三星：得分 ≥ target×1.6
  RATING_2: 1.3,          // 二星：得分 ≥ target×1.3
};

// 关卡目标分（供 sim / HUD 使用；用于三星评级，不设硬失败）
export function targetFor(level) {
  return 4000 + 800 * (level - 1);
}
