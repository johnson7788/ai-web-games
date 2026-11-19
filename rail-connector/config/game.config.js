// 全局数值配置（渲染/装配用；纯玩法数值在 config/levels.js）。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  HUD_H: 56,        // 顶部不透明 HUD 条高度
  BOARD_TOP: 70,    // 棋盘上边
  BOARD_BOTTOM: 700,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'rail-connector-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'rail-connector-save',
};

// 霓虹街机配色（红/蓝两线 + 岩石 + 终端/核心），全游戏统一。
export const PALETTE = {
  bg: '#0b0b16',
  panel: '#12121f',
  gridLine: '#1d1d2e',
  rail: '#3a3f5c',
  railGlow: '#5a5f8a',
  switchBadge: '#ffd166',
  red: '#ff3b5c',
  redDim: '#7a2036',
  blue: '#35d6ff',
  blueDim: '#1c5f78',
  rock: '#8f93b8',
  rockCore: '#565a7a',
  hud: '#12121f',
  hudText: '#e7e9ff',
  gold: '#ffd166',
};
