// SKY STRIKE 1942 · 全局数值配置
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做（en/zh 完整才暴露，避免豆腐块）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'sky-strike-1942-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'sky-strike-1942-save',
};
