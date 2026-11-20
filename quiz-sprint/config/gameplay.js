// 玩法数值（M1 所有）：竞速节奏 / 连击 / 体力 / 赌注题 / AI。
// 全部数值集中在这里，逻辑层不写死数字。

export const PLAYER = {
  BASE_PACE: 3.0,          // 基础配速 m/s（答对冲刺/连击会乘系数）
  COMBO_PACE_BONUS: 0.06,  // 每 1 连击的配速加成（×）
  SCHOLAR_COMBO: 5,        // 5 连对触发「学霸冲刺」
  SCHOLAR_PACE_MULT: 1.4,  // 学霸冲刺配速 ×1.4
  SURGE_DIST: 3.0,         // 答对瞬间前进距离（m）
  SURGE_PACE_MULT: 1.5,    // 答对后短暂加速
  SURGE_DURATION: 1.5,     // 加速持续秒
  STUMBLE_DIST: 1.5,       // 答错瞬间后退距离（m）
  STUMBLE_PACE_MULT: 0.5,  // 答错后短暂减速
  STUMBLE_DURATION: 1.5,
};

export const STAMINA = {
  MAX: 100,
  GAIN_CORRECT: 8,
  LOSS_WRONG: 14,
  GAIN_WAGER: 16,          // 赌注题答对双倍回体力
  LOSS_WAGER: 28,          // 赌注题答错双倍扣体力
  SKIP: 4,                 // 赌注题跳过回一点体力
  EXHAUST_PACE: 0.6,       // 体力空时配速 ×0.6
  REGEN_PER_SEC: 2,        // 被动回体力（慢）
  EXHAUST_RECOVER_AT: 25,  // 回到此值解除体力空状态
  LOW_WARN_AT: 30,
};

export const QUESTION = {
  DEFAULT_TIME: 8,         // 每题默认计时（关卡可覆盖）
  WAGER_EVERY: 5,          // 默认每 5 题一次赌注题
  WAGER_EVERY_HARD: 4,     // 后期每 4 题一次
};

export const AI = {
  COUNT: 3,
  JITTER: 0.06,            // 每名 AI 的 seeded 配速抖动
  NAME_KEYS: ['ai.1', 'ai.2', 'ai.3'],
};

export function clamp(v, lo, hi) {
  const n = Number(v);
  if (Number.isNaN(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

export function paceMultiplier(run) {
  let mult = 1;
  if (run.combo > 0) mult *= 1 + Math.min(run.combo, PLAYER.SCHOLAR_COMBO) * PLAYER.COMBO_PACE_BONUS;
  if (run.scholarActive) mult *= PLAYER.SCHOLAR_PACE_MULT;
  if (run.exhausted) mult *= STAMINA.EXHAUST_PACE;
  if (run.time < run.surgeUntil) mult *= PLAYER.SURGE_PACE_MULT;
  if (run.time < run.stumbleUntil) mult *= PLAYER.STUMBLE_PACE_MULT;
  return mult;
}
