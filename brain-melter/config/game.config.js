// BRAIN MELTER · 全局数值配置（纯数据，可被 node --test 直接 import）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  // 游玩区（避开顶部 HUD 与底部教程卡）
  PLAY_TOP: 150,
  PLAY_BOTTOM: 600,
};

export const STEP = 1 / 60;

// 关卡通用：3 次错误即失败；连击窗口 3s；提示消耗一次失误机会
export const RULES = {
  MAX_FAULTS: 3,
  COMBO_WINDOW: 3.0,
  HINTS_PER_LEVEL: 3,
};

// 语言：默认英文；zh 必做；只暴露 locales 里真实存在的语言
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'brain-melter-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'brain-melter-save',
};
