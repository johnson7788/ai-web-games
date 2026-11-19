// 全局数值配置（builder 拥有；数值改动只改这里与 config/levels.js）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render/ui 由此计算几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,            // 顶部 HUD 条高
  TABS_H: 40,           // 页签行高
  MARGIN: 18,
  BOARD_LEFT: 300,      // 棋盘左缘（右侧留商店区）
  BOARD_TOP: 116,       // 棋盘顶缘
  SLOT_GAP: 14,
  SHOP_W: 260,          // 右侧商店/回收区宽
};

// 语言：默认英文；zh 必做；只暴露 locales 里真实存在的语言
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'merge-dolls-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'merge-dolls-save',
};

// 游戏规则数值（sim 读取；跨玩法公共项）
export const GAME = {
  SLOTS: 12,
  COLS: 4,
  ROWS: 3,
  MAX_LEVEL: 24,
  PROD_TICK: 2.0,        // 生产周期（秒）
  START_GOLD: 60,
  COMBO_WINDOW: 4.0,     // 连击窗口（秒）
  COMBO_MAX: 9,          // 连击上限
  COMBO_PROD_BONUS: 0.15,// 每层连击生产加成
  COMBO_DURATION: 8.0,   // 连击加成持续时间（秒）
  ROCK_INTERVAL: 18,     // 岩块生成间隔（秒）
  ROCK_MAX: 3,           // 同时岩块上限
  ROCK_REWARD: 24,       // 击碎岩块奖励
  TUTORIAL_STEPS: 3,     // 首次交互引导步数
};
