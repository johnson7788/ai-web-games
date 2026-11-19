// MONSTER MELTER · 全局数值配置（零依赖，程序化美术/音频）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 六边形棋盘几何（世界坐标，与渲染/输入共用同一套换算）
export const BOARD = {
  SPACING: 110,
  SIN60: Math.sqrt(3) / 2,
  SNAP: 55,            // 子格吸附半径（世界单位）
  COUNTS: [5, 6, 7, 8, 9, 8, 7, 6, 5], // 9 行，共 61 格
  SCALE: 0.52,         // 世界 → 画布缩放
  CX: 640,             // 棋盘中心（画布 1280x720 逻辑坐标）
  CY: 388,
  BOMB_RADIUS: 1.75,   // 炸弹半径（× SPACING），覆盖中心 + 两圈邻居
};

// 宝石颜色（下标 0..3 → 色号 1..4），伤害 = 2 × 色号
export const GEM_COLORS = ['#22d3ee', '#f472b6', '#facc15', '#4ade80'];
export const GEM_DAMAGE = [2, 4, 6, 8];

export const COMBO_MAX = 8;

export const MONSTER_TYPES = [
  { hue: 190, glow: '#22d3ee', core: '#0ea5e9' },
  { hue: 330, glow: '#f472b6', core: '#ec4899' },
  { hue: 50,  glow: '#facc15', core: '#eab308' },
  { hue: 260, glow: '#a78bfa', core: '#8b5cf6' },
];

// 语言：默认英文；zh 必做。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'monster-melter-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'monster-melter-save',
};
