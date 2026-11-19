// BRAIN CHECKUP · 全局数值配置（数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。未完整翻译的语言不要加进 languages。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'brain-checkup-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'brain-checkup-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  START_WISDOM: 100,       // 初始智慧
  WISDOM_MAX: 200,         // 智慧上限（获胜回补可超过初始值）
  HINT_COST: 25,           // 提示花费
  SKIP_COST: 50,           // 跳关花费
  WIN_BONUS: 5,            // 每关获胜智慧回补
  COMBO_BONUS: 3,          // 连击 ≥3 时每关额外智慧
  COMBO_AT: 3,             // 触发连击奖励的连击数
  LEVEL_TIME: 30,          // 每关时限（秒）
  TIME_STAR_RATIO: 0.3,    // 剩余时间 ≥30% → 时间星
  TUTORIAL_STEPS: 3,
  MAX_PARTICLES: 120,      // 背景粒子上限
  DPR_MAX: 2,              // DPR 上限
};
