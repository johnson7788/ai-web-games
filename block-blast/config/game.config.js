// 全局数值配置：逻辑层不写死数字。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 棋盘与布局（1280×720 逻辑坐标）
export const BOARD = {
  SIZE: 8,          // 8×8 网格
  CELL: 62,         // 单元格像素
  X: 84,            // 棋盘左上角
  Y: 132,
};

export const TRAY = {
  X: 700,           // 托盘区左上角
  Y: 132,
  W: 500,
  H: 496,
  SLOTS: 3,
  CELL: 34,         // 托盘内方块缩放
  DRAG_LIFT: 78,    // 触屏拖拽时上移量，避免手指遮挡
};

// 配色：霓虹爆破风
export const COLORS = {
  bg: '#0b0e1a',
  bgGlow: '#141a33',
  boardFrame: '#1c2440',
  cellEmpty: '#151b30',
  cellEdge: '#232c4d',
  gridLine: 'rgba(255,255,255,0.04)',
  ink: '#eaf0ff',
  accent: '#5eead4',
  danger: '#fb7185',
  ghostOk: 'rgba(94,234,212,0.35)',
  ghostBad: 'rgba(251,113,133,0.30)',
  // 方块色板（索引 1..7）
  blocks: [
    null,
    '#f97316', // 橙
    '#38bdf8', // 蓝
    '#a78bfa', // 紫
    '#34d399', // 绿
    '#fbbf24', // 黄
    '#fb7185', // 红
    '#f472b6', // 粉
  ],
};

export const RULES = {
  traySize: 3,
  placeScorePerCell: 1,   // 每放置一格 +1
  lineBaseScore: 10,      // 消 n 行/列 = lineBaseScore * n * n
  comboBonus: 5,          // 连击额外奖励 comboBonus * (combo-1)
  clearAnimMs: 320,       // 消除动画时长
  placeAnimMs: 140,       // 放置落定动画
  // 形状权重见 config/shapes.js
};

// 语言：默认英文；zh 必做（只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'block-blast-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'block-blast-save',
};