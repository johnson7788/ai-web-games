// ANT FIRE SQUAD · 关卡定义（P0 数值源）
// 每关：目标热量、限时、火蚁数量、黄蜂节奏、是否出现炸弹、黄蜂撞击伤害。

export const LEVELS = [
  { target: 60,  time: 50, ants: 3, waspFirstAt: 7, waspEvery: 11, waspSpeed: 60,  waspHp: 1, waspDamage: 14, bombs: false },
  { target: 85,  time: 50, ants: 4, waspFirstAt: 6, waspEvery: 9,  waspSpeed: 78,  waspHp: 1, waspDamage: 16, bombs: false },
  { target: 115, time: 55, ants: 5, waspFirstAt: 5, waspEvery: 8,  waspSpeed: 92,  waspHp: 2, waspDamage: 18, bombs: true },
  { target: 145, time: 55, ants: 6, waspFirstAt: 5, waspEvery: 7,  waspSpeed: 105, waspHp: 2, waspDamage: 20, bombs: true },
  { target: 180, time: 60, ants: 7, waspFirstAt: 4, waspEvery: 6,  waspSpeed: 120, waspHp: 3, waspDamage: 22, bombs: true },
];

export const LEVEL_COUNT = LEVELS.length;
