// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const FLAG = { X: 120, Y: 220, W: 480, H: 320 };
export const PANEL = { X: 680, Y: 180, W: 500, H: 400 };

export const PALETTE = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#fbbf24',
  white: '#f8fafc', black: '#1f2937', orange: '#f97316',
};
export const COLOR_KEYS = ['red', 'orange', 'yellow', 'green', 'blue', 'black', 'white'];

export const COLORS = {
  bg: '#0e1420',
  bgGlow: '#1a2436',
  panel: '#141e2e',
  panelEdge: '#2c3e5f',
  ink: '#eef2ff',
  accent: '#60a5fa',
  gold: '#fbbf24',
  good: '#34d399',
  danger: '#fb7185',
  empty: '#22304a',
};

export const RULES = {
  scorePerFlag: 100,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'flag-painter-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'flag-painter-save',
};