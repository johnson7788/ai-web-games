// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const BOARD = { X: 96, Y: 72, CELL: 72, N: 8 };
export const PANEL = { X: 720, Y: 96, W: 480, H: 560 };

export const COLORS = {
  bg: '#1a1410',
  bgGlow: '#2a2018',
  light: '#ecd6b0',
  dark: '#b58863',
  sel: 'rgba(251,191,36,0.55)',
  move: 'rgba(74,222,128,0.5)',
  capture: 'rgba(251,113,133,0.55)',
  check: 'rgba(239,68,68,0.6)',
  last: 'rgba(96,165,250,0.35)',
  ink: '#f3ece2',
  accent: '#fbbf24',
  panel: '#241c14',
  panelEdge: '#4a3a28',
  white: '#f8f4ec',
  black: '#2b2118',
};

// 子力价值（AI 评估用）
export const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

export const RULES = {
  aiDepth: 3,
  aiDelayMs: 350,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'chess-master-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'chess-master-save',
};