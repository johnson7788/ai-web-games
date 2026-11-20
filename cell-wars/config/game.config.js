// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js（M1），关卡在 config/levels.js，渲染主题在 src/render/theme.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 整块删除）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'cell-wars-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'cell-wars-save',
};
