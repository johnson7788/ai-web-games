// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

// 证件 / X 光面板布局
export const PASSPORT = { X: 70, Y: 176, W: 350, H: 296 };
export const BOARDING = { X: 440, Y: 176, W: 350, H: 296 };
export const XRAY = { X: 810, Y: 176, W: 400, H: 296 };

export const COLORS = {
  bg: '#0d1420',
  bgGlow: '#16233a',
  panel: '#13203a',
  panelEdge: '#2c4066',
  paper: '#f4ecd8',
  paperEdge: '#cdbb94',
  ink: '#2b2b2b',
  accent: '#60a5fa',
  good: '#34d399',
  danger: '#fb7185',
  gold: '#fbbf24',
  xrayBg: '#0a1a2e',
  xrayItem: '#3b82f6',
  xrayContraband: '#ef4444',
};

// 游戏内固定“今天”，用于护照过期判定（确定性）。
export const TODAY = '2026-11-13';

export const RULES = {
  maxStrikes: 3,
  scorePerCorrect: 100,
  comboBonus: 10,
  shiftSize: 8,            // 每班次旅客数
  baseViolationChance: 0.22,
  chancePerShift: 0.05,    // 每班难度增量
  maxViolationChance: 0.55,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'airport-check-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'airport-check-save',
};