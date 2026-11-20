// config/game.config.js — 全局常量：世界尺寸 / 步长 / 语言 / 存档键（Lead 所有）
// 玩法数值在 config/gameplay.js，关卡在 config/levels.js，主题在 src/render/theme.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  BOARD_X: 0,       // 渲染层在 theme.js 里按版面计算，这里只声明逻辑世界尺寸
  BOARD_Y: 0,
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'star-swap-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'star-swap-save',
};
