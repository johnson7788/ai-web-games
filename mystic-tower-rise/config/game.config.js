// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做；其他语言完整翻译后才加入
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'mystic-tower-rise-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'mystic-tower-rise-save',
};
