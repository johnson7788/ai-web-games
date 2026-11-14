// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const COLORS = {
  bg: '#101420',
  bgGlow: '#1a2036',
  ink: '#eef2ff',
  p1: '#60a5fa',
  p2: '#fb7185',
  good: '#34d399',
  gold: '#fbbf24',
  panel: '#161c2e',
  panelEdge: '#2c3e5f',
};

export const RULES = {
  rounds: 10,
  roundTime: 12,
  baseScore: 100,
  speedBonusMax: 50,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'duo-quiz-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'duo-quiz-save',
};