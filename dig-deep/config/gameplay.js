// config/gameplay.js — 玩法数值（纯逻辑层引用；不写死数字在代码里）
export const TOOLS = [
  { id: 'shovel', power: 1, cost: 3, unlockLayer: 1, laser: false },
  { id: 'drill',  power: 2, cost: 2, unlockLayer: 2, laser: false },
  { id: 'laser',  power: 5, cost: 1, unlockLayer: 3, laser: true },
];

export const RIG = {
  startStamina: 40,
  maxStamina: 120,
  moveCost: 0,          // 横移免费：绕路的代价是「多挖的体力 + 上涨洪水的时间」
  digInterval: 0.30,    // 两次挖掘最短间隔（秒）
  moveInterval: 0.12,   // 两次横移最短间隔（秒）
};

export const CELL = {
  dirtHardMin: 1,
  dirtHardMax: 2,
  faultHard: 1,
  diamondHard: 2,
  fossilHard: 2,
};

export const REWARDS = {
  diamondScore: 50,
  diamondStamina: 6,
  fossilScore: 80,
  fossilStamina: 8,
  fossilLaserCharge: 1,
};

export const COLLAPSE = {
  staminaDamage: 4,     // 铲子挖断层 → 塌方砸伤
  rubbleAdd: 2,         // 下方相邻软格变为瓦砾，硬度 +2
};

export const LAVA = {
  staminaPenalty: 10,   // 挖到熔岩 → 本层重开 + 体力惩罚
};

export const FLOOD = {
  start: -8,            // 洪水起始行（表面上方）
};

export const SCORING = {
  depthPerRow: 10,      // 每下挖一行 +10 分
  milestoneEvery: 5,    // 每 5 行发一次 milestone 事件
};

export const clamp = (v, lo, hi) => (Number.isNaN(v) ? lo : v < lo ? lo : v > hi ? hi : v);
