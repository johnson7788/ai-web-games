// config/gameplay.js — 玩法数值（计时 / 计分 / 流星 / 反馈），逻辑层不写死数字。
// 计时：每关 timeLimitSec（config/levels.js），超时 = 失败（死亡）。
// 计分：基础分 - 步数惩罚 - 失误惩罚 - 用时惩罚，星级 1~3。

export const SCORING = {
  BASE: 1000,
  STEP_PENALTY: 8,        // 每多走一条边（超过理论最少步）扣分
  MISTAKE_PENALTY: 60,    // 每次走错（重置当前段）扣分
  TIME_PENALTY_PER_SEC: 3,
  STAR3_TIME: 0.5,        // ≤ 50% 时限 → 3 星
  STAR2_TIME: 0.85,       // ≤ 85% 时限 → 2 星
  STAR2_MISTAKE_MAX: 2,   // 失误 ≤2 也可 2 星
  STAR1_MIN: 300,         // 至少 1 星的分
};

// 输入宽容：手指点到的星与目标星距离（逻辑坐标）小于此值算命中。
export const INPUT = {
  HIT_RADIUS: 34,
};

// 流星（流星干扰 twist）：blockedSec 内该边不可走，需绕行或等待。
export const METEOR = {
  defaultPeriodSec: 7,
  defaultBlockedSec: 2,
};

// 事件密度：每走 N 条边发一个 progress 里程碑。
export const FEEDBACK = {
  PROGRESS_EVERY: 4,
};
