// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const COLORS = {
  bg: '#071d21',
  bgGlow: '#0e3036',
  wall: '#16474b',
  wallLight: '#1d5a5e',
  floor: '#0b2b30',
  floorAlt: '#0e343a',
  counter: '#8a5a3b',
  counterLight: '#b07a52',
  belt: '#202a2e',
  beltEdge: '#39464b',
  panel: 'rgba(9, 34, 38, 0.82)',
  panelEdge: 'rgba(94, 234, 212, 0.22)',
  ink: '#eaf7f5',
  muted: '#93b8b6',
  accent: '#5eead4',
  accentSoft: '#99f6e4',
  gold: '#fbbf24',
  good: '#34d399',
  danger: '#fb7185',
  receipt: '#f7efdc',
  receiptInk: '#2b2b2b',
  receiptMuted: '#7a6a52',
};

export const RULES = {
  minItems: 3,
  maxItems: 5,
  patience: 30,
  scorePerCorrect: 100,
  wrongPenalty: 30,
  leavePenalty: 50,
  comboStep: 0.15,
  comboMax: 5,
  tipCap: 50,
  dayCustomers: 5,
  perfectBonus: 150,
  exactBonus: 40,
  scanBonus: 5,
  dayBonus: 200,
  loyaltyBonus: 100,
};

// 3 天班次：目标分按「当天得分」算，不是累计分。
export const DAYS = [
  { target: 650, exactChance: 0, weights: { regular: 1, hurry: 0, bulk: 0 } },
  { target: 800, exactChance: 0.15, weights: { regular: 0.6, hurry: 0.25, bulk: 0.15 } },
  { target: 950, exactChance: 0.25, weights: { regular: 0.4, hurry: 0.3, bulk: 0.3 } },
];

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'market-cashier-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'market-cashier-save',
};

export const RANKS = [
  { id: 'S', min: 3600 },
  { id: 'A', min: 3000 },
  { id: 'B', min: 2200 },
  { id: 'C', min: 0 },
];
