// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const MINE = { X: 150, Y: 90, W: 420, H: 560 };
export const PANEL = { X: 660, Y: 120, W: 540, H: 540 };

export const COLORS = {
  bg: '#14100c',
  bgGlow: '#241c12',
  panel: '#1e1812',
  panelEdge: '#4a3a28',
  ink: '#f3ece2',
  accent: '#fbbf24',
  good: '#34d399',
  sky: '#1a2436',
};

// 矿层：depth 上限（米）、每米价值、颜色。
export const LAYERS = [
  { id: 'dirt',    name: { en: 'Dirt',    zh: '泥土' },   max: 50,   value: 1,  color: '#8a6a4a' },
  { id: 'coal',    name: { en: 'Coal',    zh: '煤矿' },   max: 200,  value: 3,  color: '#3a3a3a' },
  { id: 'iron',    name: { en: 'Iron',    zh: '铁矿' },   max: 500,  value: 8,  color: '#b08a6a' },
  { id: 'gold',    name: { en: 'Gold',    zh: '金矿' },   max: 1000, value: 20, color: '#d4a017' },
  { id: 'diamond', name: { en: 'Diamond', zh: '钻石' },   max: Infinity, value: 50, color: '#5eead4' },
];

// 升级：pick 每级 +1 米/点击；drill 每级 +2 米/秒；refinery 每级 +50% 收益。
export const UPGRADES = [
  { id: 'pick',     name: { en: 'Pickaxe',  zh: '镐头' },   desc: { en: '+1 m per click', zh: '每次点击 +1 米' }, base: 20,  growth: 1.5 },
  { id: 'drill',    name: { en: 'Drill',    zh: '钻机' },   desc: { en: '+2 m / sec', zh: '+2 米/秒' },        base: 50,  growth: 1.55 },
  { id: 'refinery', name: { en: 'Refinery', zh: '精炼厂' }, desc: { en: '+50% income', zh: '+50% 收益' },       base: 150, growth: 1.7 },
];

export const RULES = {
  startMoney: 0,
  drillPerLevel: 2,
  refineryPerLevel: 0.5,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'mine-empire-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'mine-empire-save',
};