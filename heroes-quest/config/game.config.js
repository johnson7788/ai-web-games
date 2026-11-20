// config/game.config.js — 全局常量（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js；地图在 config/levels.js；渲染主题在 src/render/theme 内联。
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
  langStorageKey: 'heroes-quest-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'heroes-quest-save',
};
