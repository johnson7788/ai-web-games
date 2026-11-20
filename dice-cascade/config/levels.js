// config/levels.js — DICE CASCADE 12 段推进结构（目标分递增 + 机关轮换）
// scene：1=石殿(沙金) 2=翡翠殿(青绿) 3=熔岩殿(红黑)；每 4 段换一章。
// cursed=true 时骰面 1 变为负点（cursedValue）；lucky=true 时每回合概率触发幸运轮奖励。
export const STAGES = [
  { index: 1,  scene: 1, diceCount: 1, target: 30,  rollsMax: 6, betCost: 0, cursed: false, lucky: false, cursedValue: -2 },
  { index: 2,  scene: 1, diceCount: 2, target: 60,  rollsMax: 6, betCost: 3, cursed: false, lucky: false, cursedValue: -2 },
  { index: 3,  scene: 1, diceCount: 3, target: 90,  rollsMax: 7, betCost: 4, cursed: false, lucky: false, cursedValue: -2 },
  { index: 4,  scene: 1, diceCount: 2, target: 120, rollsMax: 6, betCost: 4, cursed: true,  lucky: false, cursedValue: -2 },
  { index: 5,  scene: 2, diceCount: 2, target: 140, rollsMax: 7, betCost: 4, cursed: false, lucky: true,  cursedValue: -2 },
  { index: 6,  scene: 2, diceCount: 3, target: 170, rollsMax: 7, betCost: 5, cursed: true,  lucky: false, cursedValue: -2 },
  { index: 7,  scene: 2, diceCount: 3, target: 200, rollsMax: 7, betCost: 5, cursed: false, lucky: true,  cursedValue: -2 },
  { index: 8,  scene: 2, diceCount: 3, target: 230, rollsMax: 7, betCost: 6, cursed: false, lucky: false, cursedValue: -2 },
  { index: 9,  scene: 3, diceCount: 3, target: 260, rollsMax: 6, betCost: 6, cursed: true,  lucky: false, cursedValue: -3 },
  { index: 10, scene: 3, diceCount: 3, target: 300, rollsMax: 7, betCost: 6, cursed: true,  lucky: true,  cursedValue: -3 },
  { index: 11, scene: 3, diceCount: 3, target: 340, rollsMax: 6, betCost: 7, cursed: true,  lucky: false, cursedValue: -3 },
  { index: 12, scene: 3, diceCount: 3, target: 380, rollsMax: 8, betCost: 7, cursed: true,  lucky: true,  cursedValue: -3 },
];

export const STAGE_COUNT = STAGES.length;

export function stageAt(index) {
  return STAGES[Math.max(0, Math.min(STAGE_COUNT - 1, index))];
}
