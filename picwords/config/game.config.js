// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const COLORS = {
  bg: '#101820',
  bgGlow: '#1a2c3a',
  panel: '#14202e',
  panelEdge: '#2c405a',
  ink: '#eef2f6',
  accent: '#38bdf8',
  gold: '#fbbf24',
  good: '#34d399',
  danger: '#fb7185',
  tile: '#1e3a5f',
  tileEdge: '#3b82f6',
  slot: '#0d1826',
};

export const RULES = {
  extraLetters: 3,
  hintLimit: 3,
  scorePerWord: 100,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'picwords-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'picwords-save',
};