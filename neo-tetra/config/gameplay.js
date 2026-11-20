// NEO TETRA · 玩法数值（全部数值常量都在这，逻辑不写死数字）。
// 纯函数（无副作用）供 sim/selfplay/tests 复用。

// ---- 井 ----
export const WELL = {
  COLS: 10,
  ROWS: 20,
  SPAWN_X: 3, // 3×3 块占 3-5 列居中；I 块占 3-6
  SPAWN_Y: 0, // 顶部可见行
};

// ---- 下落 / 输入 ----
export const GRAVITY = {
  BASE: 0.8, // 1 级每行秒数
  MIN: 0.04,
  PER_LEVEL: 0.85, // 每级 ×0.85
  SOFT_DROP: 0.03, // 软降每行秒数
  WHITE_HOT_MULT: 1.5, // 白热态下落速度倍率
};

export const DAS = {
  DELAY: 0.16, // 首次移动延迟
  REPEAT: 0.035, // 自动重复间隔
};

export const LOCK = {
  DELAY: 0.5, // 落地锁定延迟（允许滑动/旋转）
  MAX_RESETS: 15, // 锁定延迟重置次数上限（防无限滑动）
};

// ---- 分数 ----
export const SCORE = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};
export const SCORE_SOFT = 1;
export const SCORE_HARD = 2;

// ---- 等级 ----
export const LEVEL = {
  LINES_PER_LEVEL: 10,
  MAX: 20,
};

// ---- 热力条 / 白热态 ----
export const HEAT = {
  MAX: 10,
  PER_CLEAR: [0, 1, 2, 3, 4], // 消 1/2/3/4 行蓄热
  WHITE_HOT_SEC: 10,
  SCORE_MULT: 2,
};

// ---- 矿层特性数值 ----
export const GIFT = {
  CHANCE: 0.22, // gift 层每块成为 gift 块的概率
  SLOW_SEC: 8, // slow 礼物：减速 8s
  SLOW_LEVELS: 2,
  HEAT: 3, // heat 礼物：+3 热
  SCORE: 500, // score 礼物：+500 分
};

export const STONE = {
  CHANCE: 0.12, // 重块层每块成为石头块的概率
};

export const MILESTONE = {
  SCORE_STEP: 500, // 每 500 分一个 milestone 事件（细粒度反馈）
};

// ---- 纯函数 ----
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// 每行下落秒数：等级越高越快；白热态更快；slow 礼物减速。
export function gravitySeconds(level, { whiteHot = false, slow = false } = {}) {
  const eff = Math.max(0, level - (slow ? GIFT.SLOW_LEVELS : 0));
  let g = GRAVITY.BASE * Math.pow(GRAVITY.PER_LEVEL, eff - 1);
  if (whiteHot) g /= GRAVITY.WHITE_HOT_MULT;
  return clamp(g, GRAVITY.MIN, GRAVITY.BASE);
}

// 消行得分：行分表 × 等级 × (白热态 ×2)。
export function lineScore(n, level, whiteHot) {
  const base = SCORE[n] || 0;
  const mult = Math.max(1, level) * (whiteHot ? HEAT.SCORE_MULT : 1);
  return base * mult;
}

// 等级：每 LEVEL.LINES_PER_LEVEL 行 +1。
export function levelForLines(lines) {
  return Math.min(LEVEL.MAX, 1 + Math.floor(Math.max(0, lines) / LEVEL.LINES_PER_LEVEL));
}
