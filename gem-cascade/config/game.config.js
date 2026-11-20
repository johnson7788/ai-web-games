// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js；关卡/特性在 config/levels.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  BOARD_X: 330,      // 棋盘左上角 x（10×10 网格区域）
  BOARD_Y: 70,
  BOARD_SIZE: 560,   // 棋盘整体宽高（正方形）
  CELL: 56,          // 每格像素
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'gem-cascade-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'gem-cascade-save',
};
