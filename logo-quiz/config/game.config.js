// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const COLORS = {
  bg: '#101420',
  bgGlow: '#1a2036',
  panel: '#161c2e',
  panelEdge: '#2c3e5f',
  ink: '#eef2ff',
  accent: '#60a5fa',
  gold: '#fbbf24',
  good: '#34d399',
  danger: '#fb7185',
};

export const RULES = {
  rounds: 12,
  options: 4,
  scorePerCorrect: 100,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'logo-quiz-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'logo-quiz-save',
};