// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js；波次在 config/levels.js；渲染主题在 src/render/theme.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  FOV: 0.62,          // 视锥半角（弧度，约 35°）
  CELL: 1.0,          // 1 格 = 1 世界单位
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'alien-siege-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'alien-siege-save',
};
