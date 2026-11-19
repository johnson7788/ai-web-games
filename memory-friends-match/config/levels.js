// 关卡数值：每关比上一关多一个「新元素」（更多朋友 / 更多选项 / 更多问题 / 时间压力 / 机制开关）。
export const LEVEL_COUNT = 12;

export const LEVELS = [
  { persons: 3, question: 2, options: [2, 2],       memorizeTime: 12, timeLimit: 45, hint: 1 },
  { persons: 3, question: 3, options: [2, 2, 2],    memorizeTime: 11, timeLimit: 45, hint: 1 },
  { persons: 4, question: 3, options: [3, 3, 3],    memorizeTime: 11, timeLimit: 45, hint: 1 },
  { persons: 4, question: 3, options: [3, 3, 3],    memorizeTime: 10, timeLimit: 40, hint: 1 },
  { persons: 5, question: 3, options: [3, 3, 3],    memorizeTime: 10, timeLimit: 40, hint: 1 },
  { persons: 5, question: 4, options: [3, 3, 3, 3], memorizeTime: 10, timeLimit: 40, hint: 1 },
  { persons: 5, question: 4, options: [4, 4, 4, 4], memorizeTime: 9,  timeLimit: 40, hint: 1 },
  { persons: 6, question: 4, options: [4, 4, 4, 4], memorizeTime: 9,  timeLimit: 35, hint: 1 },
  { persons: 6, question: 4, options: [4, 4, 4, 4], memorizeTime: 9,  timeLimit: 35, hint: 0 },
  { persons: 7, question: 5, options: [4, 4, 4, 4, 4], memorizeTime: 8, timeLimit: 35, hint: 1 },
  { persons: 8, question: 5, options: [4, 4, 4, 4, 4], memorizeTime: 8, timeLimit: 35, hint: 1 },
  { persons: 8, question: 5, options: [4, 4, 4, 4, 4], memorizeTime: 7, timeLimit: 30, hint: 1 },
];
