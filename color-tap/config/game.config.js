// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const GRID = { X: 120, Y: 120, CELL: 30 };
export const PANEL = { X: 660, Y: 120, W: 520, H: 520 };

// 数字 → 颜色
export const PALETTE = {
  1: '#ef4444', 2: '#f97316', 3: '#fbbf24', 4: '#22c55e',
  5: '#3b82f6', 6: '#a78bfa', 7: '#f472b6', 8: '#f8fafc', 9: '#92400e',
};

export const COLORS = {
  bg: '#14101c',
  bgGlow: '#221a30',
  cellEmpty: '#241c30',
  cellEdge: '#3a2c4d',
  ink: '#f3eefc',
  accent: '#c084fc',
  gold: '#fbbf24',
  good: '#34d399',
  panel: '#1c1428',
  panelEdge: '#3a2c4d',
  danger: '#ef4444',
};

export const RULES = {
  hintLimit: 5,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'color-tap-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'color-tap-save',
};