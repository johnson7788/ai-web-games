// SNAKE GLOW CLASSIC · 全局数值配置（唯一数值来源，逻辑层不写死数字）
// 世界：固定逻辑 1280×720，蛇在 24×13 网格内移动（classic grid snake）。
// 霓虹街机气质：暗底 + 青/品红/青柠三色 glow。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  COLS: 24,
  ROWS: 13,
  CELL: 48,
  BOARD_X: 64, // (1280 - 24*48) / 2
  BOARD_Y: 72, // 顶部留 72px 给 HUD，避免 HUD 遮住第 0 行
  BOARD_W: 1152,
  BOARD_H: 624,
};

export const SNAKE = {
  INITIAL_LENGTH: 4,
  BASE_INTERVAL_MS: 150, // 阶段 1 每步间隔
  STAGE2_INTERVAL_MS: 130,
  STAGE3_INTERVAL_MS: 112,
  BOOST_FACTOR: 0.55, // 冲刺时步间隔 ×0.55（约 1.8 倍速）
  ENERGY_MAX: 100,
  ENERGY_DRAIN_PER_S: 30,
  ENERGY_REGEN_PER_S: 20,
};

export const FOOD = {
  SCORE: 10, // 基础分（再乘连击）
  COMBO_WINDOW_MS: 2500,
  GOLD_SCORE: 50,
  GOLD_GROW: 1, // 金色球额外多长 1 节（总长 2 节）
  GOLD_INTERVAL_MS: 12000,
  GOLD_LIFETIME_MS: 5000,
};

export const STAGES = [
  { index: 1, atSec: 0, rocks: 0, newElement: 'food orbs + steering' },
  { index: 2, atSec: 40, rocks: 5, newElement: 'neon rocks (obstacles)' },
  { index: 3, atSec: 80, rocks: 8, newElement: 'golden orbs + faster pace' },
];

export const RUN = {
  TIME_LIMIT_SEC: 120, // classic 计时局
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'snake-glow-classic-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'snake-glow-classic-save',
};
