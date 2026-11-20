// config/gameplay.js — IDIOM FORGE · M1 数值配置（所有数值常量都在这，逻辑不写死数字）
// 契约：docs/README.md（事件名/字段一字不差）

export const STEP = 1 / 60;

// ---- 计时 ----
export const TIMER = {
  ADD_ON_WIN: 3,       // 答对加时（秒）
  WRONG_PENALTY: 2,    // 答错扣时（秒）
  FLOOR: 0,            // 计时下限
};

// ---- 计分 ----
export const SCORE = {
  CORRECT: 100,        // 答对基础分
  COMBO_BONUS: 50,     // 连击每层额外分（第 2 连起）
  RIDDLE_MULT: 2,      // 字谜模式分倍率
};

// ---- 熔炉 / 炉渣 ----
export const FORGE = {
  EVERY: 5,            // 每答对 5 条成语铸一件神兵
  SLAG_TO_HINT: 3,     // 3 炉渣熔炼成 1 提示
};

// ---- 道具 ----
export const PROPS = {
  START_HINTS: 2,      // 开局提示数
  START_RESETS: 1,     // 开局重置数
};

// ---- 字谜 ----
export const RIDDLE = {
  CHANCE: 0.3,         // 每关单题出字谜的概率
};

// ---- 连击 ----
export const COMBO = {
  // 连击不随时间衰减；只被答错 / 重置 / 提示打断（见 sim 逻辑）
  WINDOW_SEC: 0,
};

// ---- 关卡推进 ----
export const LEVEL = {
  COUNT: 12,
};

// ============================================================
// 纯函数（无副作用，供 sim 复用；数字全部来自上面的常量）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// 答对得分：基础分 × 字谜倍率 + 连击额外分（第 2 连起每层 +50）
export function scoreFor({ riddle = false, combo = 0 } = {}) {
  const mult = riddle ? SCORE.RIDDLE_MULT : 1;
  const comboExtra = Math.max(0, combo - 1) * SCORE.COMBO_BONUS;
  return SCORE.CORRECT * mult + comboExtra;
}
