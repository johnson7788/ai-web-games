// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const OBJECT = { CX: 380, CY: 388, R: 150 };
export const PANEL = { X: 720, Y: 120, W: 500, H: 540 };

export const COLORS = {
  bg: '#120d18',
  bgGlow: '#221630',
  panel: '#1a1322',
  panelEdge: '#3a2c4d',
  ink: '#f3eefc',
  accent: '#c084fc',
  gold: '#fbbf24',
  danger: '#fb7185',
  hpBack: '#2a2036',
  hpFill: '#c084fc',
};

// 材料层级：每 10 个粉碎物升一阶；HP/价值随阶内进度递增。
export const TIERS = [
  { id: 'stone',   name: { en: 'Stone',   zh: '岩石' },   hp: 20,    value: 5,    color: '#9ca3af', glow: '#6b7280' },
  { id: 'copper',  name: { en: 'Copper',  zh: '铜矿' },   hp: 60,    value: 15,   color: '#fb923c', glow: '#c2410c' },
  { id: 'iron',    name: { en: 'Iron',    zh: '铁矿' },   hp: 150,   value: 40,   color: '#cbd5e1', glow: '#64748b' },
  { id: 'silver',  name: { en: 'Silver',  zh: '银矿' },   hp: 400,   value: 100,  color: '#e2e8f0', glow: '#94a3b8' },
  { id: 'gold',    name: { en: 'Gold',    zh: '金矿' },   hp: 1000,  value: 250,  color: '#fbbf24', glow: '#b45309' },
  { id: 'emerald', name: { en: 'Emerald', zh: '翡翠' },   hp: 2500,  value: 600,  color: '#34d399', glow: '#047857' },
  { id: 'ruby',    name: { en: 'Ruby',    zh: '红宝石' }, hp: 6000,  value: 1500, color: '#fb7185', glow: '#be123c' },
  { id: 'diamond', name: { en: 'Diamond', zh: '钻石' },   hp: 15000, value: 4000, color: '#67e8f9', glow: '#0e7490' },
];

// 升级：成本按 growth^level 递增。
export const UPGRADES = [
  { id: 'click', name: { en: 'Crush Power', zh: '粉碎力' }, desc: { en: '+1 per click', zh: '每次点击 +1' }, base: 15,  growth: 1.55 },
  { id: 'auto',  name: { en: 'Auto Crusher', zh: '自动粉碎' }, desc: { en: '+2 damage / sec', zh: '每秒 +2 伤害' }, base: 30,  growth: 1.6 },
  { id: 'crit',  name: { en: 'Critical', zh: '暴击' }, desc: { en: '+5% crit (×3)', zh: '+5% 暴击（×3）' }, base: 100, growth: 1.8 },
];

export const RULES = {
  objectsPerTier: 10,
  critMult: 3,
  critPerLevel: 0.05,
  critCap: 0.5,
  autoPerLevel: 2,
  hpPerProgress: 0.15,
  valuePerProgress: 0.12,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'crusher-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'crusher-save',
};