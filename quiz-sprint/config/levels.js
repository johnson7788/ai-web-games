// 12 赛推进结构：距离递增 + 类别轮换 + AI 速度递进 + 时限/赌注/体力难度曲线。
// index 从 1 开始。场景包按 index 分组：1-4 晨跑 / 5-8 山道 / 9-12 夜城。
export const LEVELS = [
  { index: 1,  distance: 60,  questionsTotal: 3, questionIntervalSec: 5, questionTimeSec: 8, aiPace: [2.5, 2.6, 2.7], wagerEvery: 5, staminaDrain: 1.0, categories: ['general'] },
  { index: 2,  distance: 70,  questionsTotal: 3, questionIntervalSec: 5, questionTimeSec: 8, aiPace: [2.6, 2.7, 2.8], wagerEvery: 5, staminaDrain: 1.0, categories: ['science'] },
  { index: 3,  distance: 80,  questionsTotal: 3, questionIntervalSec: 5, questionTimeSec: 8, aiPace: [2.7, 2.8, 2.9], wagerEvery: 5, staminaDrain: 1.0, categories: ['geography'] },
  { index: 4,  distance: 85,  questionsTotal: 4, questionIntervalSec: 5, questionTimeSec: 8, aiPace: [2.8, 2.9, 3.0], wagerEvery: 5, staminaDrain: 1.0, categories: ['sports'] },
  { index: 5,  distance: 90,  questionsTotal: 4, questionIntervalSec: 5, questionTimeSec: 7, aiPace: [2.9, 3.0, 3.1], wagerEvery: 5, staminaDrain: 1.0, categories: ['general', 'science'] },
  { index: 6,  distance: 95,  questionsTotal: 4, questionIntervalSec: 5, questionTimeSec: 7, aiPace: [3.0, 3.1, 3.2], wagerEvery: 5, staminaDrain: 1.0, categories: ['general', 'science', 'geography'] },
  { index: 7,  distance: 100, questionsTotal: 5, questionIntervalSec: 5, questionTimeSec: 7, aiPace: [3.1, 3.2, 3.3], wagerEvery: 5, staminaDrain: 1.0, categories: ['sports'] },
  { index: 8,  distance: 105, questionsTotal: 5, questionIntervalSec: 5, questionTimeSec: 7, aiPace: [3.2, 3.3, 3.4], wagerEvery: 5, staminaDrain: 1.0, categories: ['general', 'science', 'geography', 'sports'] },
  { index: 9,  distance: 110, questionsTotal: 5, questionIntervalSec: 5, questionTimeSec: 6, aiPace: [3.3, 3.4, 3.5], wagerEvery: 5, staminaDrain: 1.0, categories: ['science', 'geography'] },
  { index: 10, distance: 115, questionsTotal: 5, questionIntervalSec: 5, questionTimeSec: 6, aiPace: [3.4, 3.5, 3.6], wagerEvery: 4, staminaDrain: 1.0, categories: ['general', 'science', 'geography', 'sports'] },
  { index: 11, distance: 120, questionsTotal: 5, questionIntervalSec: 5, questionTimeSec: 6, aiPace: [3.5, 3.6, 3.7], wagerEvery: 4, staminaDrain: 1.4, categories: ['geography', 'sports'] },
  { index: 12, distance: 130, questionsTotal: 6, questionIntervalSec: 5, questionTimeSec: 6, aiPace: [3.6, 3.7, 3.8], wagerEvery: 4, staminaDrain: 1.5, categories: ['general', 'science', 'geography', 'sports'] },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelConfig(index) {
  const i = Math.max(1, Math.min(LEVEL_COUNT, Math.round(index || 1)));
  return LEVELS[i - 1];
}

export function scenePack(level) {
  if (level <= 4) return 'morning';
  if (level <= 8) return 'mountain';
  return 'night';
}
