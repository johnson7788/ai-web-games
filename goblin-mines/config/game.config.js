// config/game.config.js — 全局常量配置：世界尺寸 / 固定步长 / 语言 / 存档键。
// 玩法数值在 config/gameplay.js；关卡推进在 config/levels.js；渲染主题在 src/render/theme.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  BOARD: { cols: 9, rows: 9, tile: 60, x0: 370, y0: 92 },
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露），ja/ko/ar/ru 整块不暴露。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'goblin-mines-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'goblin-mines-save',
};
