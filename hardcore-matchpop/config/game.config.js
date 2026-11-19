// HARDCORE MATCHPOP · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 据此计算棋盘几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,          // 顶部 HUD 条高
  BOARD: 560,         // 棋盘正方形边长（10 格 × 56px）
  CELL: 56,
  MARGIN_X: 24,
};

// 语言：默认英文；zh 必做（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'hardcore-matchpop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'hardcore-matchpop-save',
};

// 玩法规则数值（sim 从 levels/game.config 读取；此处放跨关公共项）
export const GAME = {
  N: 10,                    // 10×10 棋盘
  COLORS: 5,                // 5 色晶石
  TIME: 60,                 // 闯关倒计时（秒）
  RUSH_TIME: 30,            // 冲刺对战倒计时（秒）
  TARGET_BASE: 500,         // 目标分 = 500 + 关卡×100（保留原味公式）
  TARGET_PER_LEVEL: 100,
  SCORE_PER_GEM: 10,        // 一组 n 块得分 = n×10 − 5（P0 原味公式）
  SCORE_OFFSET: 5,
  COMBO_WINDOW: 3.0,        // 连击窗口（秒）
  COMBO_BONUS_RATE: 0.5,    // 连击加成 = 基础分 × (连击−1) × 0.5（向下取整）
  BOMB_PER_LEVEL: 1,        // 每关炸弹（3×3 范围消除）
  SHUFFLE_PER_LEVEL: 1,     // 每关洗牌
  ROCK_MAX: 8,              // 岩石上限
  STAR_TIME_RATIO: 0.3,     // 剩余 ≥30% 初始时间 → +1 星
  STAR_SCORE_RATIO: 1.3,    // 得分 ≥130% 目标 → +1 星
  AUTO_SHUFFLE_MAX: 24,     // 无路可走自动重排上限
  RIVAL_STEP_MIN: 10,       // 冲刺对手每秒 +10..100
  RIVAL_STEP_MAX: 100,
};
