// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 44,            // 顶部 HUD 条高
  MARGIN_X: 24,         // 左右安全边
  MARGIN_Y: 16,
  CELL_MAX: 170,        // 3×3 棋盘单格上限
  BOARD_SIDE: 480,      // 棋盘边长（3 格 × 160）
  SIDE_PANEL_W: 0,      // 无侧栏，棋盘居中
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 完整翻译后才加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'dune-tac-toe-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'dune-tac-toe-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  BOARD: 3,                 // 3×3
  PUZZLE_LEVELS: 12,
  AI_DIFFICULTIES: ['random', 'greedy', 'perfect'],
  TURN_DT: 1.2,             // bot 遥测里每次落子的虚拟耗时（秒）
};
