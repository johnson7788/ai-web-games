// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，波次/碟型在 config/levels.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  CANNON_X: 640,   // 炮口固定屏幕 x
  CANNON_Y: 660,   // 炮口固定屏幕 y
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'saucer-strike-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'saucer-strike-save',
};
