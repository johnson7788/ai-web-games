// CANDY CRUSH POP · 全局数值配置（Lead 拥有；数值改动只改这里）
// 主题：霓虹街机（neon arcade）——程序化发光糖果 + 深色网格，零素材零外链。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘/侧栏几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 48,            // 顶部 HUD 条高（不透明，避免遮挡判定）
  BOARD_X: 24,          // 棋盘左上角 x
  BOARD_Y: 62,          // 棋盘左上角 y（HUD 下留 14px）
  CELL_MAX: 64,         // 单格上限
  SIDE_X: 556,          // 右侧分数卡起始 x
  SIDE_W: 700,          // 右侧分数卡宽
};

// 语言：默认英文；zh 必做（与 locales 完全对齐）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'candy-crush-pop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'candy-crush-pop-save',
};

// 游戏规则数值（sim 从这里读跨关公共项）
export const GAME = {
  TYPES: 6,             // 糖果种类数（P0 1:1）
  MATCH_MIN: 3,         // 消除最少连数
  SWAP_TIME: 0.12,      // 交换动画秒
  CLEAR_TIME: 0.24,     // 消除闪光秒
  FALL_TIME: 0.22,      // 下落动画秒
  ROCK_MAX_HP: 2,       // 冰封岩石最大层数
  COMBO_BONUS_WAVE: 3,  // 单步连击达到 3 波 → 奖励 1 步
  COMBO_MULT: [1, 1.5, 2], // 第 1/2/3+ 波连击的分数倍率
  STAR_MOVES_HI: 0.6,   // 剩余步数 ≥60% → 3 星
  STAR_MOVES_LO: 0.3,   // 剩余步数 ≥30% → 2 星
};
