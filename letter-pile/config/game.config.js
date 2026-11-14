// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const PILE = { X: 90, Y: 250, W: 560, H: 320 };
export const LIST = { X: 700, Y: 130, W: 500, H: 520 };

export const COLORS = {
  bg: '#16101c',
  bgGlow: '#241a30',
  panel: '#1c1428',
  panelEdge: '#3a2c4d',
  ink: '#f3eefc',
  accent: '#c084fc',
  gold: '#fbbf24',
  good: '#34d399',
  danger: '#fb7185',
  tile: '#2a2036',
  tileEdge: '#5a4a73',
  tileSel: '#c084fc',
};

export const RULES = {
  hintLimit: 3,
  scorePerWord: 50,
  minWordLen: 2,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'letter-pile-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'letter-pile-save',
};