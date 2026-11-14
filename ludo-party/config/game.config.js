// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const BOARD = { X: 60, Y: 60, SIZE: 600 };
export const PANEL = { X: 700, Y: 90, W: 520, H: 560 };

export const COLORS = {
  bg: '#14101c',
  bgGlow: '#221a30',
  board: '#f4ecd8',
  boardEdge: '#cdbb94',
  track: '#ffffff',
  trackEdge: '#cdbb94',
  ink: '#2b2b2b',
  panel: '#1c1428',
  panelEdge: '#3a2c4d',
  accent: '#c084fc',
  gold: '#fbbf24',
  red: '#ef4444',
  blue: '#3b82f6',
  safe: '#fde68a',
};

// 2 玩家（红=人类，蓝=AI），各 4 子。
export const PLAYERS = [
  { id: 0, name: { en: 'You', zh: '你' }, color: '#ef4444', start: 0, human: true },
  { id: 1, name: { en: 'Bot', zh: '电脑' }, color: '#3b82f6', start: 26, human: false },
];

export const RULES = {
  tokensPerPlayer: 4,
  trackLen: 52,
  homeLen: 6,        // home 列 6 格
  finish: 57,        // progress 达 57 完成（51 track + 6 home）
  enterRoll: 6,      // 掷 6 才能出库
  extraRoll: 6,      // 掷 6 再掷一次
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'ludo-party-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'ludo-party-save',
};