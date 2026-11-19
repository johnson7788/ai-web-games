// 全局数值配置（MEMORY FRIENDS MATCH · 霓虹街机记忆配对）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'memory-friends-match-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'memory-friends-match-save',
};
