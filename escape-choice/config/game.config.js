// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const SCENE = { X: 0, Y: 0, W: 1280, H: 340 };

export const COLORS = {
  bg: '#101418',
  bgGlow: '#1c242c',
  ink: '#eef2f6',
  accent: '#fbbf24',
  good: '#34d399',
  danger: '#fb7185',
  stick: '#eef2f6',
  sky: '#1a2230',
  ground: '#2a3440',
};

export const RULES = {
  // 失败后回到起点；记录已发现结局。
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'escape-choice-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'escape-choice-save',
};