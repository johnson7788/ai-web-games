// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const SCENE = { X: 40, Y: 90, W: 860, H: 590 };
export const PANEL = { X: 920, Y: 90, W: 320, H: 590 };

export const COLORS = {
  bg: '#101820',
  scene: '#1a2632',
  sceneEdge: '#2c3e50',
  panel: '#141e2a',
  panelEdge: '#2c3e50',
  ink: '#eef2f6',
  accent: '#fbbf24',
  good: '#34d399',
  danger: '#fb7185',
};

export const RULES = {
  targetsPerLevel: 5,
  decoysBase: 12,
  decoysPerLevel: 2,
  maxDecoys: 26,
  hintLimit: 3,
  objectRadius: 24,
  scorePerFind: 50,
  wrongPenalty: 10,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'hidden-quest-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'hidden-quest-save',
};