// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const GRID = {
  SIZE: 12,        // 12×12 字母格
  CELL: 44,
  X: 70,
  Y: 132,
};

export const LIST = {
  X: 660, Y: 132, W: 550, H: 528,
};

export const COLORS = {
  bg: '#0f1410',
  bgGlow: '#1a2418',
  panel: '#15201a',
  panelEdge: '#2c3e33',
  cell: '#1c2a22',
  cellEdge: '#2f4237',
  ink: '#eef6ee',
  accent: '#86efac',
  gold: '#fbbf24',
  danger: '#fb7185',
  sel: 'rgba(134,239,172,0.30)',
  selEdge: '#86efac',
  found: 'rgba(251,191,36,0.28)',
  foundEdge: '#fbbf24',
  hint: 'rgba(251,113,133,0.5)',
};

export const RULES = {
  wordsPerPuzzle: 8,
  hintLimit: 3,
  placeAttempts: 240,    // 每个词随机放置尝试次数
  gridRetries: 12,       // 整盘重试次数
  scorePerWord: 100,
  timeBonusMax: 500,     // 通关时间奖励上限
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'daily-word-hunt-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'daily-word-hunt-save',
};