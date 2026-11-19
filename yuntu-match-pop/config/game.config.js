// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘/落点几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 64,            // 顶部不透明 HUD 条高
  BOARD_COLS: 5,
  BOARD_ROWS: 7,
  CELL: 80,             // 单格边长
  GAP: 6,               // 格间隙
  MARGIN_X: 24,
};

// 语言：默认英文；zh 必做（一线语言）。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'yuntu-match-pop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'yuntu-match-pop-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  MAX_VALUE: 8192,
  DROP_TIME: 0.12,        // 落块动画秒
  MERGE_TIME: 0.10,       // 每波合并动画秒
  BOMB_COST: 50,          // 炸弹钻石消耗
  ROCK_SCORE: 50,         // 清岩石加分
  COMBO_STEP: 25,         // 每多一波连击的加分
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 4,
};
