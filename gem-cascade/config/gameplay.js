// 玩法数值（纯逻辑，可被 node 直接 import，无 DOM 依赖）
export const GRID = {
  COLS: 10,
  ROWS: 10,
  COLORS: 5,          // 基础色数（6 色关覆盖）
};

export const SCORE = {
  PER_GEM_SQ: 5,      // 得分 = n² × 5
  DOUBLE_MULT: 2,     // 双倍矿脉颜色 ×2
  CLEAR_BONUS: 2000,  // 无剩奖励（remaining=0 时的满额）
  CLEAR_PENALTY_PER: 20, // 剩块惩罚：2000 - 20 × remaining²（下限 0）
};

export const PICKAXE = {
  MAX_CHARGE: 5,      // 满 5 次蓄力可劈单块
  CHARGE_RATE: 1,     // 每次消除蓄力（蓄力加速关覆盖为 2）
};

export const WASH = {
  PER_LEVEL: 1,       // 每关 1 次淘洗
};

export const AVALANCHE_MIN = 6; // ≥6 连消触发矿脉塌方（signature）

export const MOVE_LIMIT_WARN_AT = 5; // 剩余步数低于此值发警告事件

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 每关目标分数：递增曲线（最优解能过、乱按会卡在第 1 关）。 */
export function targetScore(level) {
  const lv = clamp(Math.floor(level) || 1, 1, 99);
  return 1400 + (lv - 1) * 700 + (lv - 1) * (lv - 1) * 120;
}

/** 消除得分：n² × 5，双倍矿脉颜色再 ×2。 */
export function popScore(n, color, doubleColor) {
  const base = n * n * SCORE.PER_GEM_SQ;
  return color === doubleColor ? base * SCORE.DOUBLE_MULT : base;
}

/** 结尾剩余奖励/惩罚：0 剩 = 2000 满额；越多越少，≥10 剩归零。 */
export function clearBonus(remaining) {
  if (remaining === 0) return SCORE.CLEAR_BONUS;
  return Math.max(0, SCORE.CLEAR_BONUS - SCORE.CLEAR_PENALTY_PER * remaining * remaining);
}
