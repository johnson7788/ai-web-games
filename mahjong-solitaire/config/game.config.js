// 全局数值配置：逻辑层不写死数字
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 牌与半张牌栅格：牌宽 60、高 80，栅格步长 30×40
export const TILE = {
  W: 60,
  H: 80,
  STEP_X: 30,
  STEP_Y: 40,
};

export const COLORS = {
  bg: '#0e2f1f',
  felt: '#16633d',
  feltInner: '#1b6e45',
  wood: '#5a3a1f',
  woodLight: '#7a5230',
  vignette: 'rgba(0,0,0,0.28)',
  tileFace: '#f6efdc',
  tileEdge: '#cdbb94',
  tileSide: '#b7a67f',
  tileShadow: 'rgba(0,0,0,0.35)',
  ink: '#2b2b2b',
  dot: '#c0392b',
  bamboo: '#2e7d32',
  char: '#1a3c6e',
  wind: '#123c63',
  dragonRed: '#b71c1c',
  dragonGreen: '#1b5e20',
  flower: '#8e44ad',
  accent: '#ffcf5c',
};

export const RULES = {
  totalTiles: 144,
  layers: 5,
  hintLimit: 3,
  undoLimit: 5,
  shuffleLimit: 2,
  matchAnimMs: 100,       // 消除动画时长
  starTimesSec: [180, 420], // 3 星 ≤180s，2 星 ≤420s，否则 1 星
};

// 语言：默认英文；zh 必做
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'mahjong-solitaire-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'mahjong-solitaire-save',
};
