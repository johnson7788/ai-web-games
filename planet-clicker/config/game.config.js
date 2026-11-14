// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const PLANET = { CX: 380, CY: 388, R: 150 };
export const PANEL = { X: 720, Y: 120, W: 500, H: 540 };

export const COLORS = {
  bg: '#070b16',
  bgGlow: '#101a30',
  panel: '#101a2e',
  panelEdge: '#2c3e5f',
  ink: '#eef2ff',
  accent: '#60a5fa',
  gold: '#fbbf24',
  good: '#34d399',
};

// 星球：累计能量达 threshold 解锁，mult 为产出倍率。
export const PLANETS = [
  { id: 'earth',   name: { en: 'Earth',   zh: '地球' },   threshold: 0,       mult: 1,   color: '#3b82f6', glow: '#1e40af' },
  { id: 'mars',    name: { en: 'Mars',    zh: '火星' },   threshold: 1000,    mult: 2,   color: '#ef4444', glow: '#991b1b' },
  { id: 'jupiter', name: { en: 'Jupiter', zh: '木星' },   threshold: 10000,   mult: 5,   color: '#f59e0b', glow: '#b45309' },
  { id: 'saturn',  name: { en: 'Saturn',  zh: '土星' },   threshold: 100000,  mult: 12,  color: '#fbbf24', glow: '#92400e' },
  { id: 'neptune', name: { en: 'Neptune', zh: '海王星' }, threshold: 1000000, mult: 30,  color: '#6366f1', glow: '#3730a3' },
  { id: 'sun',     name: { en: 'Sun',     zh: '太阳' },   threshold: 10000000, mult: 100, color: '#fde047', glow: '#ca8a04' },
];

// 升级：click 每级 +1 点击；solar/drone/fusion 每级 +N 能量/秒。
export const UPGRADES = [
  { id: 'click',  name: { en: 'Click Power',   zh: '点击力' },   desc: { en: '+1 per click', zh: '每次点击 +1' }, base: 15,  growth: 1.5,  eps: 0 },
  { id: 'solar',  name: { en: 'Solar Panel',   zh: '太阳能板' }, desc: { en: '+1 energy/s', zh: '+1 能量/秒' },   base: 30,  growth: 1.55, eps: 1 },
  { id: 'drone',  name: { en: 'Mining Drone',  zh: '采矿无人机' }, desc: { en: '+5 energy/s', zh: '+5 能量/秒' }, base: 120, growth: 1.6,  eps: 5 },
  { id: 'fusion', name: { en: 'Fusion Reactor', zh: '聚变反应堆' }, desc: { en: '+25 energy/s', zh: '+25 能量/秒' }, base: 600, growth: 1.7, eps: 25 },
];

export const RULES = {
  startEnergy: 0,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'planet-clicker-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'planet-clicker-save',
};