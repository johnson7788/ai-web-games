// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

// 词面板（左侧）：每词一行字母砖
export const PANEL = {
  X: 60, Y: 138, W: 560, H: 520,
  TILE: 40, GAP: 6, ROW_GAP: 12,
};

// 字母环（右侧）
export const RING = {
  CX: 955, CY: 478, R: 142, NODE: 42,
  WORD_Y: 258,           // 当前拼词显示中心
};

export const COLORS = {
  bg: '#0d1117',
  bgGlow: '#16202e',
  panel: '#131c28',
  panelEdge: '#243447',
  tileHidden: '#1b2735',
  tileHiddenEdge: '#2c3e52',
  tileFound: '#2dd4bf',
  tileFoundEdge: '#0f766e',
  tileRevealed: '#fbbf24',
  ink: '#eaf2ff',
  accent: '#5eead4',
  gold: '#fbbf24',
  danger: '#fb7185',
  node: '#1f2c3d',
  nodeEdge: '#3a4d63',
  nodeSel: '#2dd4bf',
  trail: 'rgba(94,234,212,0.85)',
};

export const RULES = {
  minWordLen: 2,
  scorePerLetter: 10,
  streakBonus: 5,        // 连续拼对额外 5*(streak-1)
  hintLimit: 3,          // 每关提示次数
  // 星级：0 提示=3 星，1 提示=2 星，≥2 提示=1 星
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'word-trails-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'word-trails-save',
};