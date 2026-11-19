// 关卡表：羊数量 / 时限 / 冷却 / 速度 / 金色羊数 / 岩石数 / 本关新元素。
// 数值沿用参考源码 game03.json 的节奏（3→10 只、11→36s、cd 0.5s、开局倒计时 1.5s），
// 另加入原创机制：金色羊（喂食奖励时间）、岩石（反弹羊）、连击、星级。
export const LEVELS = [
  { index: 1, sheep: 3,  time: 11, cd: 0.50, countdown: 1.5, speed: 135, golden: 0, rocks: 0, newElement: 'feed the wandering herd' },
  { index: 2, sheep: 4,  time: 13, cd: 0.50, countdown: 1.5, speed: 142, golden: 0, rocks: 0, newElement: 'faster sheep' },
  { index: 3, sheep: 5,  time: 16, cd: 0.50, countdown: 1.5, speed: 148, golden: 1, rocks: 0, newElement: 'golden sheep bonus' },
  { index: 4, sheep: 6,  time: 20, cd: 0.48, countdown: 1.5, speed: 152, golden: 1, rocks: 1, newElement: 'rocks bounce the herd' },
  { index: 5, sheep: 7,  time: 24, cd: 0.46, countdown: 1.5, speed: 156, golden: 1, rocks: 2, newElement: 'tighter cooldown' },
  { index: 6, sheep: 8,  time: 28, cd: 0.44, countdown: 1.5, speed: 160, golden: 2, rocks: 2, newElement: 'two golden sheep' },
  { index: 7, sheep: 9,  time: 32, cd: 0.42, countdown: 1.5, speed: 165, golden: 2, rocks: 3, newElement: 'triple rocks' },
  { index: 8, sheep: 10, time: 36, cd: 0.40, countdown: 1.5, speed: 170, golden: 2, rocks: 3, newElement: 'ten-sheep rush' },
];

export const LEVEL_COUNT = LEVELS.length;
