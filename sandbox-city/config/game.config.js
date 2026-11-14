// 全局数值配置 —— Sandbox City（俯视角城市建造沙盒）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const TILE = 44;
export const COLS = 26;
export const ROWS = 13;
export const OX = 68;
export const OY = 60;

// 建筑 / 工具：id → 名称 / 造价 / 颜色 / 人口 / 每秒收入
export const BUILDINGS = {
  0: { name: 'grass', cost: 0, color: '#4f8a48', pop: 0, income: 0 },
  1: { name: 'road', cost: 10, color: '#3a3f47', pop: 0, income: 0 },
  2: { name: 'house', cost: 50, color: '#e0a868', pop: 2, income: 0 },
  3: { name: 'shop', cost: 80, color: '#6aa8e0', pop: 0, income: 3 },
  4: { name: 'park', cost: 30, color: '#6cc86a', pop: 0, income: 0 },
  5: { name: 'tree', cost: 5, color: '#2f6b38', pop: 0, income: 0 },
  6: { name: 'water', cost: 15, color: '#3f7fc8', pop: 0, income: 0 },
};

// 工具栏顺序（含铲除）
export const TOOLS = [1, 2, 3, 4, 5, 6, -1]; // -1 = bulldoze

export const RULES = {
  startMoney: 500,
  incomeEvery: 1.0,     // 每秒结算
  taxPerPop: 0.25,      // 每人口每秒税收
  carSpeed: 2.2,        // 格/秒
  maxCars: 10,
};

export const COLORS = {
  bg: '#101a12',
  grass: '#4f8a48',
  grassAlt: '#579450',
  grid: 'rgba(0,0,0,0.12)',
  hud: 'rgba(8,12,26,0.78)',
  select: '#fbbf24',
  car: '#f4b400',
  text: '#eef2f6',
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'sandbox-city-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'sandbox-city-save',
};