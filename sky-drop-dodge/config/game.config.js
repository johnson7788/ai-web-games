// config/game.config.js — 全局常量（世界尺寸 / 步长 / 语言 / 存档键）
// 玩法数值在 config/gameplay.js + config/levels.js；渲染色板在 src/render/theme.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 640, // 玩家站立的地面 y（身体底部）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'sky-drop-dodge-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'sky-drop-dodge-save',
};
