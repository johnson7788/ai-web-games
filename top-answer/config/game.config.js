// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const COLORS = {
  bg: '#0c1220',
  bgGlow: '#16233c',
  accent: '#60a5fa',
  gold: '#fbbf24',
  danger: '#fb7185',
  ink: '#eef2ff',
};

export const RULES = {
  hintLimit: 3,
  missPenalty: 0,        // 猜错不扣分（鼓励尝试）
  revealNoPoints: true,  // 直接揭示不得分
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'top-answer-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'top-answer-save',
};