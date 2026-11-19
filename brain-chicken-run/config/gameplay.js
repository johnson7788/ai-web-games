// config/gameplay.js — 玩法数值（可调）
// 本作：3 关「脑力吃鸡」生存 gauntlet，每关 4 题；答对站到 TRUE 车道，答错被清出局。
export const PLAYER = {
  COUNT: 20,            // 每局总人数（含玩家）
  START_CAMP: 0.5,      // 玩家初始车道（0.5 = 未选择）
};

export const MATCH_SEC = 3;          // 开局匹配倒计时
export const QUESTION_GAP_SEC = 3.5; // 一题清场后到下一题的间隔
export const TOTAL_QUESTIONS = 12;   // 总题数
export const ROUNDS_PER_STAGE = 4;   // 每关题数

export const COMBO = {
  SHIELD_AT: 3,         // 连击到 3 获得护盾
  MAX_SHIELD: 2,        // 护盾上限
  GOLDEN_BONUS: 2,      // 金题得分倍率
};

export const GOLDEN_EVERY = 3;       // 第 2 关起每 3 题一题金题
export const GOLDEN_FROM_STAGE = 2;  // 第 2 关开始出现金题

export const SCORE = {
  ROUND: 10,            // 每题答对基础分
  GOLDEN: 20,           // 金题基础分
  COMBO_BONUS: 5,       // 连击每层附加分
  SHIELD_SAVE: 5,       // 护盾救场得分
};

// 三关配置：answerTime 秒作答；botAccuracy 机器人答对概率；hazard 清场道具外观
export const STAGES = [
  { index: 1, answerTime: 7.0, botAccuracy: 0.70, hazard: 'gate' },
  { index: 2, answerTime: 5.5, botAccuracy: 0.76, hazard: 'rock' },
  { index: 3, answerTime: 4.5, botAccuracy: 0.80, hazard: 'rock' },
];

export function stageOf(qIndex) {
  return STAGES[Math.min(STAGES.length - 1, Math.floor(qIndex / ROUNDS_PER_STAGE))];
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
