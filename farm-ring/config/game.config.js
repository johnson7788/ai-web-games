// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const RING = { CX: 380, CY: 390, R: 215, PLOTS: 12, PLOT_R: 46 };
export const PANEL = { X: 700, Y: 120, W: 520, H: 540 };

export const COLORS = {
  bg: '#0e1a12',
  bgGlow: '#1a2c1e',
  soil: '#5a3a22',
  soilReady: '#7a5230',
  sprout: '#34d399',
  crop: '#fbbf24',
  panel: '#14201a',
  panelEdge: '#2c4034',
  ink: '#eef6ee',
  accent: '#4ade80',
  gold: '#fbbf24',
  locked: '#22302a',
};

export const RULES = {
  startPlots: 4,
  baseGrowTime: 6,     // 秒
  baseValue: 5,
  growthFactor: 0.85,  // 每级生长时间 ×0.85
  valuePerLevel: 0.5,  // 每级价值 +50%
};

export const UPGRADES = [
  { id: 'growth', name: { en: 'Growth', zh: '生长' }, desc: { en: 'Crops grow faster', zh: '作物更快成熟' }, base: 20, growth: 1.6 },
  { id: 'value', name: { en: 'Value', zh: '价值' }, desc: { en: '+50% coins per crop', zh: '每作物 +50% 金币' }, base: 30, growth: 1.7 },
  { id: 'auto', name: { en: 'Auto-Harvest', zh: '自动收割' }, desc: { en: 'Harvest ready crops', zh: '自动收割成熟作物' }, base: 100, growth: 2.2 },
  { id: 'plot', name: { en: 'New Plot', zh: '新地块' }, desc: { en: 'Unlock a plot', zh: '解锁一块地' }, base: 50, growth: 1.8 },
];

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'farm-ring-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'farm-ring-save',
};