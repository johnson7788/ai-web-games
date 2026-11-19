// LINK LINE PAIR · 全局数值配置
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  // 网格（11 列 × 9 行，沿用参考源的点阵坐标约定）
  COLS: 11,
  ROWS: 9,
};

export const STEP = 1 / 60;

// 玩法数值（纯逻辑，sim 使用）
export const PLAY = {
  MAX_LIVES: 3,          // 点错（错误连线 / 踩岩石）次数上限
  UNDO_PER_LEVEL: 3,     // 每关撤销次数
  HINT_PER_LEVEL: 3,     // 每关提示次数
  COMBO_WINDOW: 2.5,     // 连击窗口（秒）
  HINT_DURATION: 2.0,    // 提示手指轨迹停留（秒）
  SCORE_PER_SEG: 10,     // 每段基础分
};

export function parAndLimit(segCount) {
  const par = Math.max(20, segCount * 5);
  return { par, limit: par + 30 };
}

// 语言：默认英文；zh 必做；只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'link-line-pair-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'link-line-pair-save',
};
