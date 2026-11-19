// MEMORY TRIP MATCH · 全局配置（数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做；只暴露 locales 里真实存在的语言
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'memory-trip-match-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'memory-trip-match-save',
};

// 跨关规则数值（sim 读取）
export const GAME = {
  MISMATCH_DELAY: 1.5,     // 翻错两张牌后停留展示的秒数
  HINT_SECONDS: 0.9,       // 提示（窥牌）持续秒数
  HINT_PER_LEVEL: 2,       // 每关提示次数
  STAR_2_RATIO: 1.7,       // 步数 ≤ par*1.7 得 2 星，否则 1 星
  COMBO_MAX: 9,            // 连击加成封顶倍率
  SCORE_BASE: 10,          // 每对基础分
};
