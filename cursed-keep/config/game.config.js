// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const COLORS = {
  bg: '#160f1e',
  bgGlow: '#241634',
  path: '#3a2c4d',
  pathEdge: '#5a4a73',
  spot: '#2a2036',
  spotEdge: '#4a3a63',
  ink: '#f3eefc',
  accent: '#c084fc',
  gold: '#fbbf24',
  danger: '#fb7185',
  good: '#34d399',
};

// 塔：range 像素、damage 每发、fireRate 发/秒、splash 溅射半径、slow 减速比例。
export const TOWERS = [
  { id: 'arrow',  name: { en: 'Arrow',  zh: '箭塔' },   cost: 50, range: 135, damage: 12, fireRate: 2.0, projSpeed: 420, splash: 0,  slow: 0,   color: '#86efac' },
  { id: 'cannon', name: { en: 'Cannon', zh: '炮塔' },   cost: 90, range: 115, damage: 30, fireRate: 0.8, projSpeed: 300, splash: 62, slow: 0,   color: '#fbbf24' },
  { id: 'frost',  name: { en: 'Frost',  zh: '冰塔' },   cost: 70, range: 125, damage: 6,  fireRate: 1.2, projSpeed: 360, splash: 0,  slow: 0.5, color: '#60a5fa' },
];

// 敌人：hp / speed(px/s) / reward 金币 / damage 扣血。
export const ENEMIES = [
  { id: 'grunt',  name: { en: 'Grunt',  zh: '步兵' }, hp: 40,  speed: 60,  reward: 8,  damage: 1, color: '#fb7185', r: 13 },
  { id: 'runner', name: { en: 'Runner', zh: '疾行' }, hp: 25,  speed: 110, reward: 10, damage: 1, color: '#f472b6', r: 11 },
  { id: 'brute',  name: { en: 'Brute',  zh: '重甲' }, hp: 160, speed: 40,  reward: 20, damage: 3, color: '#a78bfa', r: 17 },
];

// 10 波：groups 依次生成，hpMult 缩放血量。
export const WAVES = [
  { hpMult: 1.0, groups: [{ type: 'grunt', count: 6, interval: 1.0 }] },
  { hpMult: 1.1, groups: [{ type: 'grunt', count: 8, interval: 0.9 }] },
  { hpMult: 1.2, groups: [{ type: 'grunt', count: 6, interval: 0.8 }, { type: 'runner', count: 3, interval: 0.7 }] },
  { hpMult: 1.3, groups: [{ type: 'grunt', count: 8, interval: 0.7 }, { type: 'brute', count: 2, interval: 1.5 }] },
  { hpMult: 1.45, groups: [{ type: 'runner', count: 8, interval: 0.5 }, { type: 'grunt', count: 6, interval: 0.7 }] },
  { hpMult: 1.6, groups: [{ type: 'grunt', count: 10, interval: 0.6 }, { type: 'brute', count: 3, interval: 1.3 }] },
  { hpMult: 1.8, groups: [{ type: 'runner', count: 10, interval: 0.45 }, { type: 'brute', count: 3, interval: 1.2 }] },
  { hpMult: 2.0, groups: [{ type: 'grunt', count: 12, interval: 0.5 }, { type: 'runner', count: 6, interval: 0.5 }, { type: 'brute', count: 3, interval: 1.1 }] },
  { hpMult: 2.3, groups: [{ type: 'brute', count: 6, interval: 1.0 }, { type: 'runner', count: 10, interval: 0.4 }] },
  { hpMult: 2.6, groups: [{ type: 'grunt', count: 14, interval: 0.4 }, { type: 'brute', count: 6, interval: 0.9 }, { type: 'runner', count: 10, interval: 0.35 }] },
];

export const RULES = {
  startGold: 120,
  startLives: 20,
  waveDelay: 3,          // 波次间隔（秒）
  maxTowerLevel: 3,
  upgradeDamageMult: 1.5,
  upgradeRangeMult: 1.1,
  upgradeCostFactor: 0.8, // 升级费 = cost × factor × 当前等级
  sellRefund: 0.7,
  slowDuration: 1.5,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'cursed-keep-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'cursed-keep-save',
};