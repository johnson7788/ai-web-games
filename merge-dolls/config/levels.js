// 玩偶数值表（闭式生成，无外链无素材）。level 从 1 到 MAX_LEVEL。
// cost: 购买该等级的花费；prod: 每 2s 产金；sell: 回收价；mergeBonus: 合成出该等级时的奖励。
import { GAME } from './game.config.js';

export const MAX_LEVEL = GAME.MAX_LEVEL;

const round = (n) => Math.round(n);

export const DOLLS = [];
for (let L = 1; L <= MAX_LEVEL; L += 1) {
  const cost = round(8 * Math.pow(2.2, L - 1));
  const prod = 3 * Math.pow(2, L - 1);
  DOLLS.push({
    level: L,
    cost,
    prod,
    sell: round(cost * 0.45),
    mergeBonus: round(cost * 0.35),
    hue: ((L * 47) % 360), // 每级渐变色相（金角度错开）
  });
}

// 阶段目标：达到该最高等级即通关对应阶段；reward 为该阶段奖励。
export const STAGE_GOALS = [3, 5, 7, 9, 11, 13, 15, 18, 21, 24];

export function stageGoal(stage) {
  return STAGE_GOALS[Math.min(stage, STAGE_GOALS.length - 1)];
}

export function stageReward(stage) {
  // 奖励与目标等级成本挂钩（≈2 倍目标成本），随阶段温和增长，不破坏经济。
  return round(dollByLevel(stageGoal(stage)).cost * 2);
}

export function dollByLevel(level) {
  return DOLLS[Math.max(0, Math.min(MAX_LEVEL, level) - 1)];
}
