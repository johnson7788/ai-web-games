// 全局数值配置 —— Paper World（2D 挖掘建造沙盒）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const TILE = 32;
export const COLS = 40;
export const ROWS = 22;

export const GRAVITY = 2000;

// 方块：id → 名称 / 颜色 / 硬度（秒）/ 掉落
export const BLOCKS = {
  0: { name: 'air', color: null, hard: 0, drop: 0 },
  1: { name: 'grass', color: '#5aa84e', top: '#7cc862', hard: 0.4, drop: 2 },
  2: { name: 'dirt', color: '#8a5a34', hard: 0.4, drop: 2 },
  3: { name: 'stone', color: '#8b93a3', hard: 0.9, drop: 3 },
  4: { name: 'wood', color: '#9a6b3f', hard: 0.6, drop: 4 },
  5: { name: 'leaves', color: '#3f8a48', hard: 0.2, drop: 5 },
  6: { name: 'coal', color: '#3a3f47', hard: 1.0, drop: 6 },
  7: { name: 'sand', color: '#d9c27a', hard: 0.3, drop: 7 },
};

// 快捷栏（可放置的方块 id）
export const HOTBAR = [2, 3, 4, 5, 6];

export const PLAYER = {
  W: 24, H: 40,
  SPEED: 220,
  JUMP_V: -640,
  REACH: 4.5,           // 挖掘/放置距离（格）
};

export const RULES = {
  dayLength: 60,        // 一昼夜秒数
};

export const COLORS = {
  skyDay: '#7ec8e3',
  skyNight: '#1a2340',
  sun: '#fde68a',
  moon: '#e8edf5',
  hud: 'rgba(8,12,26,0.72)',
  select: '#fbbf24',
  player: '#38bdf8',
  playerDark: '#0c4a6e',
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'paper-world-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'paper-world-save',
};