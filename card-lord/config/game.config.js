// config/game.config.js — 全局常量（世界尺寸 / 步长 / 语言 / 存档键）
// 玩法数值在 config/gameplay.js（牌局/段位/AI/结算），牌面样式在 src/render/index.js。
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
  langStorageKey: 'card-lord-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'card-lord-save',
};
