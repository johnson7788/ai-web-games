// 全局常量配置：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，渲染主题在 src/render/theme.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  COLS: 5,            // 竖井列数
  CELL: 96,           // 单格像素尺寸
  SHAFT_X: 320,       // 竖井左缘 x
  SHAFT_W: 480,       // 竖井宽度（COLS*CELL）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'dig-deep-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'dig-deep-save',
};
