// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘/网格几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,            // 顶部 HUD 条高
  PAD_X: 20,
  PAD_Y: 16,
  BOARD_BOTTOM_PAD: 180, // 底部留白给 D-pad / 教程卡（保证不遮挡棋盘）
  CELL_MAX: 68,         // 单格上限
  CELL_MIN: 34,         // 单格下限
};

// 语言：默认英文；zh 必做；只暴露 en/zh（完整翻译）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'soko-warehouse-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'soko-warehouse-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  UNDO_DEFAULT: 3,       // 每关回退次数
  COMBO_MIN: 2,          // 触发连击提示的连续推箱次数
  STAR_PAR_FACTOR: 1.5,  // 2 星阈值 = par * 1.5
  MOVE_COST_WALK: 1,     // 走路消耗 1 步
  MOVE_COST_PUSH: 1,     // 推箱消耗 1 步
};
