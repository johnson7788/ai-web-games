// config/gameplay.js — SLOT LEGENDS 数值配置（逻辑层不写死数字）
// 契约：docs/report.md 与 src/game/sim.js 的事件名/字段一字不差。

// ---- 老虎机几何 ----
export const REELS = 5; // 5 列
export const ROWS = 3; // 3 行

// ---- 余额 / 下注（虚拟筹码，纯娱乐）----
export const BALANCE = {
  START: 1000, // 开局筹码
  MIN_BET: 1, // 最小注（= 破产判定线：balance < MIN_BET 且无免费旋转 → dead）
};

export const BET_OPTIONS = [1, 2, 5, 10, 25, 50, 100];
export const BET_DEFAULT = 1;

// ---- 押镖（策略下注）----
export const ESCORT = {
  UNLOCK_LEVEL: 3, // 第 3 级解锁
  COST_MULT: 0.5, // 额外筹码 = bet × 0.5（总成本 bet × 1.5）
  MULT: 0.8, // 基础倍率 -20%
  SCATTER_MULT: 2, // 免费旋转触发所需散布数 ×2（2 枚即触发）
};

// ---- 符号（原创好汉）----
export const SYMBOLS = {
  OFFICIAL: 'official', // 官府（低）
  ESCORT: 'escort', // 镖师（低-中）
  WINE: 'wine', // 酒仙（中）
  THIEF: 'thief', // 神偷（中-高）
  BLADE: 'blade', // 刀客（高）
  INGOT: 'ingot', // 元宝（顶级 / jackpot）
  TOKEN: 'token', // 聚义令（scatter，触发免费旋转 + 攒好汉令）
  WILD: 'wild', // 好汉（wild，万能替代）
};

export const SYMBOL_ORDER = ['official', 'escort', 'wine', 'thief', 'blade', 'ingot', 'token', 'wild'];

// ---- 倍率表：3/4/5 连（×bet，单位）----
export const PAYTABLE = {
  official: [1, 2, 5],
  escort: [1, 3, 8],
  wine: [2, 4, 12],
  thief: [3, 6, 20],
  blade: [4, 10, 35],
  ingot: [10, 30, 100],
};

// ---- 赔付线（每个元素是 5 列的行索引，从最左列起算连续匹配）----
export const PAYLINES = [
  [1, 1, 1, 1, 1], // 中横线
  [0, 0, 0, 0, 0], // 上横线
  [2, 2, 2, 2, 2], // 下横线
  [0, 1, 2, 1, 0], // V 形
  [2, 1, 0, 1, 2], // 倒 V 形
];

// 第 6 级追加 2 条赔付线
export const PAYLINES_EXTRA = [
  [0, 1, 1, 1, 0], // 上角进中线
  [2, 1, 1, 1, 2], // 下角进中线
];

// ---- 滚动时序 ----
export const REEL_STOP_TIMES = [0.28, 0.42, 0.56, 0.7, 0.8]; // 每列停下的时间（s）
export const SPIN_DURATION = 0.8; // 一轮滚动总时长（s）
export const SETTLE_DURATION = 0.12; // 结算停留（s）

// ---- 免费旋转（聚义厅模式）----
export const FREE_SPINS = {
  BY_SCATTER: { 3: 10, 4: 15, 5: 20 }, // 散布数 → 免费次数
  BASE_MULT: 1.5, // 免费旋转期间倍率 +50%
};

// ---- 好汉令（保底）----
export const TOKEN = {
  PITY_TARGET: 5, // 集满 5 枚 → 下一转必中大保底（jackpot 连线）
};

// ---- 12 级推进结构 ----
export const LEVELS = [
  { level: 1, spinsNeeded: 0 },
  { level: 2, spinsNeeded: 5 },
  { level: 3, spinsNeeded: 12 },
  { level: 4, spinsNeeded: 22 },
  { level: 5, spinsNeeded: 35 },
  { level: 6, spinsNeeded: 50 },
  { level: 7, spinsNeeded: 70 },
  { level: 8, spinsNeeded: 95 },
  { level: 9, spinsNeeded: 125 },
  { level: 10, spinsNeeded: 160 },
  { level: 11, spinsNeeded: 200 },
  { level: 12, spinsNeeded: 250 },
];

// 倍率表升级：等级 → 全局倍率
export const PAYTABLE_MULT = { 4: 1.1, 7: 1.2, 10: 1.3 };

// 免费旋转触发率上调（scatter 权重增加）的等级
export const SCATTER_UP_LEVEL = 8;
export const JACKPOT_UP_LEVEL = 12;

// ---- 场景包（换章必换色板/构图/装饰）----
export const SCENE = {
  TAVERN: 'tavern', // 酒馆（暖木）· 等级 1-4
  STRONGHOLD: 'stronghold', // 山寨（青绿）· 等级 5-8
  NIGHTMARKET: 'nightmarket', // 夜市（红灯）· 等级 9-12
};

// ============================================================
// 纯函数（无副作用；数字全部来自上面的常量）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 由累计 spins 反查当前等级。 */
export function levelFor(totalSpins) {
  let lvl = 1;
  for (const l of LEVELS) {
    if (totalSpins >= l.spinsNeeded) lvl = l.level;
    else break;
  }
  return lvl;
}

/** 等级 → 场景包。 */
export function sceneFor(level) {
  if (level >= 9) return SCENE.NIGHTMARKET;
  if (level >= 5) return SCENE.STRONGHOLD;
  return SCENE.TAVERN;
}

/** 等级 → 全局倍率表倍率。 */
export function paytableMult(level) {
  let m = 1;
  for (const [lvl, mult] of Object.entries(PAYTABLE_MULT)) {
    if (level >= Number(lvl)) m = mult;
  }
  return m;
}

/** 等级 → 活跃赔付线数。 */
export function paylineCount(level) {
  return level >= 6 ? PAYLINES.length + PAYLINES_EXTRA.length : PAYLINES.length;
}

/** 等级 → 免费旋转倍率（固定 +50%）。 */
export function freeSpinMult(_level) {
  return FREE_SPINS.BASE_MULT;
}

/** 押镖总成本（默认 bet × 1.5；第 11 级起 bet × 1.25）。 */
export function escortCost(bet, level = 1) {
  const mult = level >= 11 ? 0.25 : ESCORT.COST_MULT;
  return Math.max(1, Math.round(bet * (1 + mult)));
}

/** 押镖可用性（第 3 级起）。 */
export function escortUnlocked(level) {
  return level >= ESCORT.UNLOCK_LEVEL;
}

/** 当前等级可用的符号权重池（wild 万能，scatter 随等级上调）。 */
export function poolAt(level) {
  const w = {
    official: 24,
    escort: 22,
    wine: 18,
    thief: 14,
    token: level >= SCATTER_UP_LEVEL ? 3 : 2,
  };
  if (level >= 3) w.blade = 8;
  if (level >= 5) w.ingot = level >= JACKPOT_UP_LEVEL ? 7 : 5;
  return w;
}

/** 3/4/5 散布 → 免费次数。 */
export function freeSpinsFor(scatterCount) {
  const c = clamp(scatterCount, 3, 5);
  return FREE_SPINS.BY_SCATTER[String(c)] ?? 10;
}
