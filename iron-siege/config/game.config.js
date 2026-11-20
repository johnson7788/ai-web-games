// config/game.config.js — 全局常量配置（Lead 所有）：画布 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，波次/场景在 config/levels.js，渲染主题在 src/render/theme.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'iron-siege-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'iron-siege-save',
};
