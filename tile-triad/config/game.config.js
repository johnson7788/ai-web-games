// TILE TRIAD · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘/收槽几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 44,            // 顶部 HUD 条高
  BOARD_TOP: 64,        // 棋盘区上沿
  BOARD_BOTTOM: 516,    // 棋盘区下沿（收槽之上）
  BOARD_MARGIN_X: 40,   // 棋盘左右安全边
  SLOT_Y: 604,          // 收槽区中心 Y
  SLOT_W: 92,           // 单槽宽
  SLOT_H: 100,          // 单槽高
  SLOT_GAP: 8,
  CARD_W: 78,           // 单张牌宽
  CARD_H: 96,           // 单张牌高
  STACK_DY: 22,         // 同一堆每层上移像素
  STACK_JITTER: 4,      // 同堆牌水平抖动
  CAT_W: 96,
};

// 语言：默认英文；zh 必做（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'tile-triad-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'tile-triad-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  SLOT_DEFAULT: 7,          // 默认收槽容量
  UNDO_DEFAULT: 1,          // 默认撤回次数
  SHUFFLE_DEFAULT: 0,       // 默认洗牌次数
  TRIPLE_CLEAR: 3,          // 三同消除
  NEAR_FULL_THRESHOLD: 1,   // 距离槽满还差 N 格时发 nearFull 警告
  TIME_STAR_RATIO: 0.25,    // 剩余时间 ≥25% 初始时间 → +1 星
  SHAKE_AMP: 4,             // 消除/拾取震屏幅度（px）
};
