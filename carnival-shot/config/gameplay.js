// CARNIVAL SHOT · 数值配置（全部数值常量都在这，逻辑不写死数字）。
// 契约：docs/analysis.md；事件名与 sim 事件表一字不差。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  SKY_TOP: 90,      // 目标飞行带上沿
  SKY_BOTTOM: 520,  // 目标飞行带下沿
};

// ---- 弹匣 / 换弹（signature：速装匣）----
export const MAGAZINE = {
  SIZE: 6,             // 弹匣容量
  RELOAD_SEC: 1.2,     // 普通换弹
  QUICK_RELOAD_SEC: 0.6, // 速装匣换弹（主动换弹 R 后下一次减半）
};

// ---- 连击 / 孔明灯雨 ----
export const COMBO = {
  WINDOW_SEC: 3.0,     // 3s 内再命中连击 +1
  MULT_PER: 0.1,       // 乘数 = 1 + combo*0.1
  MULT_CAP: 3.0,       // 封顶 ×3
  RAIN_AT: 8,          // combo 达到 8 触发孔明灯雨（签名时刻）
  RAIN_STEP: 8,        // 之后每 +8 再触发一次
  RAIN_BONUS: 500,     // 每次孔明灯雨奖励分
};

// ---- 奖励鸭轮盘 ----
export const REWARD = {
  DOUBLE_SEC: 10,      // 双倍持续 10s
  DOUBLE_MULT: 2,      // 双倍倍率
  ADD_TIME_SEC: 5,     // 加时 5s
  WEIGHTS: [0.4, 0.33, 0.27], // double / addTime / fullAmmo
};

// ---- 小鬼灯惩罚 ----
export const GHOST_PENALTY = 150;

// ---- 分数里程碑（事件密度兜底：每跨 250 分发一个可感知事件）----
export const MILESTONE_POINTS = 250;

// ---- 目标类型表（kind → 基础行为参数）----
// score：基础分（ghost 为负、red 为 0）；r：点击命中半径；speed：基础速度 px/s。
export const TARGETS = {
  kite:    { score: 100, r: 42, speed: 170, life: 6.0, fly: 'cross' },
  lantern: { score: 150, r: 46, speed: 110, life: 7.0, fly: 'cross' },
  moving:  { score: 200, r: 40, speed: 130, life: 9.0, fly: 'slide' },
  dive:    { score: 130, r: 40, speed: 340, life: 5.0, fly: 'dive' },
  golden:  { score: 300, r: 40, speed: 260, life: 3.4, fly: 'cross' },
  ghost:   { score: -GHOST_PENALTY, r: 40, speed: 150, life: 5.4, fly: 'cross' },
  red:     { score: 0, r: 46, speed: 120, life: 6.4, fly: 'cross' },
};

export const TARGET_KINDS = Object.keys(TARGETS);

// ---- 关卡默认（levels.js 里的每关可覆盖）----
export const LEVEL_DEFAULTS = {
  time: 30,
  targetScore: 800,
  spawnInterval: 0.95,
  speedMul: 1.0,
  redDucks: 3,
};

// ============================================================
// 纯函数（无副作用，供 sim/spawner 复用；数字全部来自上面的常量）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 连击乘数 = 1 + combo*0.1（cap ×3）
export function comboMult(combo) {
  return Math.min(COMBO.MULT_CAP, 1 + Math.max(0, combo) * COMBO.MULT_PER);
}

// 目标分值（含连击乘数 + 双倍；ghost 恒定惩罚、red 为 0）
export function scoreFor(kind, combo, doubled) {
  const t = TARGETS[kind] || TARGETS.kite;
  if (kind === 'ghost') return t.score;           // 负分惩罚，不受连击/双倍放大
  if (kind === 'red') return 0;
  let pts = t.score * comboMult(combo);
  if (doubled) pts *= REWARD.DOUBLE_MULT;
  return Math.round(pts);
}
