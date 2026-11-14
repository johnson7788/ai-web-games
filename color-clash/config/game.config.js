// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const CARD = { W: 86, H: 124, R: 10 };

export const LAYOUT = {
  discard: { x: 660, y: 300 },
  draw: { x: 500, y: 300 },
  hand: { y: 580, cx: 640 },
  ai: [{ x: 200, y: 130 }, { x: 1080, y: 130 }],
};

// 四色
export const COLORS = {
  bg: '#0f1a14',
  bgGlow: '#1a2c22',
  ink: '#f2f6f2',
  accent: '#fbbf24',
  red: '#ef4444',
  yellow: '#fbbf24',
  green: '#22c55e',
  blue: '#3b82f6',
  wild: '#1f2937',
  cardBack: '#7c3aed',
};

export const COLOR_KEYS = ['red', 'yellow', 'green', 'blue'];

// 牌值：0-9 数字 / skip / reverse / draw2 / wild / wild4
export const RULES = {
  players: 3,
  handSize: 7,
  aiDelayMs: 700,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'color-clash-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'color-clash-save',
};