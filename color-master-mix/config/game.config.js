// COLOR MASTER MIX · 全局数值配置（改数值只改这里）
// 世界为固定逻辑分辨率 1280×720，letterbox 缩放见 main.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'color-master-mix-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'color-master-mix-save',
};

// 玩法规则数值（sim 读这里；渲染/UI 读 PALETTE/LAYOUT）
export const GAME = {
  FAMILIES: 8,            // 色系数量
  SHADES: 8,              // 每系色块数量（8×8 = 64 色）
  COMBO_WINDOW: 3,        // 连击窗口（秒）
  COMBO_MAX: 8,           // 连击上限
  FILL_SCORE: 10,         // 每格基础分
  COMBO_SCORE: 5,         // 每级连击附加分
  STAR_TIME_RATIO: 0.33,  // 剩余时间 ≥33% → +1 星
  STAR_COMBO: 4,          // 最大连击 ≥4 → +1 星
  MAGIC_FILLS: 1,         // 每关魔法填充次数
  ROCK_UNLOCK_NEIGHBORS: 1, // 封印格解锁所需已上色邻居数
  TUTORIAL_STEPS: 4,
};

// 布局常量（render/ui 由此算几何；sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 56,              // 顶部 HUD 条高（不透明，避免 HUD 遮挡判定）
  PALETTE_W: 360,         // 右侧色板宽
  BOARD_MARGIN: 34,       // 图形区域边距
};
