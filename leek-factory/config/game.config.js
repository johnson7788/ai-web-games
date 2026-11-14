// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const BELT = { X: 70, Y: 236, W: 660, H: 92 };
export const HARVEST = { CX: 250, CY: 510, R: 108 };
export const PANEL = { X: 770, Y: 120, W: 450, H: 540 };

export const COLORS = {
  bg: '#0e1512',
  bgGlow: '#16241d',
  panel: '#14201a',
  panelEdge: '#2c4034',
  belt: '#22302a',
  beltEdge: '#3a4d42',
  ink: '#eef6ee',
  accent: '#4ade80',
  gold: '#fbbf24',
  danger: '#fb7185',
  leek: '#86efac',
};

// 三个生产站： throughput = 各站速率的最小值（瓶颈）。
export const STATIONS = [
  { id: 'grow',    name: { en: 'Grow',    zh: '种植' }, base: 1.0, color: '#34d399' },
  { id: 'process', name: { en: 'Process', zh: '加工' }, base: 0.8, color: '#60a5fa' },
  { id: 'pack',    name: { en: 'Pack',    zh: '打包' }, base: 0.6, color: '#fbbf24' },
];

// 升级：三站速率 + 品牌（每颗大葱售价）。成本 base×growth^level。
export const UPGRADES = [
  { id: 'grow',    base: 10, growth: 1.5, name: { en: 'Grow Speed',    zh: '种植速度' }, desc: { en: '+1.0 leeks/s', zh: '+1.0 棵/秒' } },
  { id: 'process', base: 15, growth: 1.5, name: { en: 'Process Speed', zh: '加工速度' }, desc: { en: '+0.8 leeks/s', zh: '+0.8 棵/秒' } },
  { id: 'pack',    base: 20, growth: 1.5, name: { en: 'Pack Speed',    zh: '打包速度' }, desc: { en: '+0.6 leeks/s', zh: '+0.6 棵/秒' } },
  { id: 'value',   base: 50, growth: 1.7, name: { en: 'Brand',         zh: '品牌' },     desc: { en: '+1 coin / leek', zh: '每棵 +1 金币' } },
];

export const RULES = {
  valueBase: 1,        // 每级品牌 +1 金币/棵
  clickBase: 5,        // 每次手动收割 5 棵
  startLevels: { grow: 1, process: 1, pack: 1, value: 1 },
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'leek-factory-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'leek-factory-save',
};