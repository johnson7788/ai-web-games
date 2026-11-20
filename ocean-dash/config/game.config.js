// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，赛段/场景在 config/levels.js
export const WORLD = {
  WIDTH: 1280,        // 逻辑世界宽（px）
  HEIGHT: 720,        // 逻辑世界高（px）
  SURFACE_Y: 130,     // 水面屏幕 y（上方是天空/跃出区）
  PLAYER_X: 300,      // 玩家固定屏幕 x（世界向右滚动）
  BOTTOM_Y: 720,      // 水底屏幕 y
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'ocean-dash-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'ocean-dash-save',
};
