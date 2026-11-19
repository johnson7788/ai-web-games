// 全局常量（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/idioms.js，设计源在 config/design.json
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
  langStorageKey: 'imperial-exam-journey-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'imperial-exam-journey-save',
};
