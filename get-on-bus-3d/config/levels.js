// GET ON BUS 3D · 关卡定义 + 确定性关卡构建器
// 每关：沿垂直车道的接客/送客点 + 横穿车流 + 道具。
// 构建器会按「怠速公交车」的到达时刻反推第一辆横穿车，保证 noinput 策略必然撞车，
// 让 greedy 用油门抢时间通过（这也是玩法核心：油门抢 gap / 刹车等 gap）。

import { WORLD, PHYS, HOST, REWARD } from './game.config.js';

// 横穿车方向：+1 从左往右（x: -MARGIN → +MARGIN），-1 从右往左
// truck：更慢、更宽（碰撞半径更大），会挡住更久（L3+ 的新敌人行为）
export const LEVELS = [
  {
    index: 1,
    key: 'downtown',
    length: 2600,
    passengers: 2,
    crossings: [
      { d: 400, speed: 95, interval: 2.0, dir: 1, r: 22 },
      { d: 900, speed: 100, interval: 1.9, dir: -1, r: 22 },
      { d: 1500, speed: 105, interval: 1.8, dir: 1, r: 22 },
      { d: 2000, speed: 110, interval: 1.8, dir: -1, r: 22 },
      { d: 2400, speed: 115, interval: 1.7, dir: 1, r: 22 },
    ],
    pickups: [
      { d: 700, type: 'shield' },
      { d: 1900, type: 'coin' },
    ],
  },
  {
    index: 2,
    key: 'harbor',
    length: 3000,
    passengers: 3,
    crossings: [
      { d: 350, speed: 130, interval: 3.0, dir: -1 },
      { d: 1000, speed: 150, interval: 2.7, dir: 1 },
      { d: 1500, speed: 150, interval: 2.6, dir: -1 },
      { d: 2100, speed: 160, interval: 2.5, dir: 1 },
      { d: 2600, speed: 170, interval: 2.4, dir: -1 },
    ],
    pickups: [
      { d: 620, type: 'shield' },
      { d: 1750, type: 'coin' },
      { d: 2350, type: 'turbo' },
    ],
  },
  {
    index: 3,
    key: 'gridlock',
    length: 3300,
    passengers: 3,
    crossings: [
      { d: 320, speed: 140, interval: 2.8, dir: 1 },
      { d: 820, speed: 90, interval: 4.5, dir: -1, r: 36 },  // 慢速大货车
      { d: 1250, speed: 160, interval: 2.5, dir: 1 },
      { d: 1700, speed: 160, interval: 2.4, dir: -1 },
      { d: 2150, speed: 170, interval: 2.3, dir: 1 },
      { d: 2600, speed: 170, interval: 2.2, dir: -1 },
      { d: 3000, speed: 180, interval: 2.2, dir: 1 },
    ],
    pickups: [
      { d: 560, type: 'shield' },
      { d: 1500, type: 'coin' },
      { d: 2450, type: 'turbo' },
    ],
  },
  {
    index: 4,
    key: 'midnight',
    length: 3600,
    passengers: 4,
    crossings: [
      { d: 300, speed: 150, interval: 2.6, dir: -1 },
      { d: 700, speed: 90, interval: 4.2, dir: 1, r: 36 },
      { d: 1100, speed: 170, interval: 2.3, dir: -1 },
      { d: 1500, speed: 170, interval: 2.2, dir: 1 },
      { d: 1900, speed: 90, interval: 4.0, dir: -1, r: 36 },
      { d: 2300, speed: 180, interval: 2.1, dir: 1 },
      { d: 2700, speed: 180, interval: 2.1, dir: -1 },
      { d: 3200, speed: 190, interval: 2.0, dir: 1 },
    ],
    pickups: [
      { d: 520, type: 'shield' },
      { d: 1350, type: 'coin' },
      { d: 2050, type: 'turbo' },
      { d: 2900, type: 'coin' },
    ],
  },
  {
    index: 5,
    key: 'rushhour',
    length: 4000,
    passengers: 4,
    crossings: [
      { d: 280, speed: 160, interval: 2.4, dir: 1 },
      { d: 640, speed: 100, interval: 4.0, dir: -1, r: 36 },
      { d: 1000, speed: 180, interval: 2.1, dir: 1 },
      { d: 1340, speed: 100, interval: 3.8, dir: -1, r: 36 },
      { d: 1680, speed: 180, interval: 2.0, dir: 1 },
      { d: 2020, speed: 190, interval: 1.9, dir: -1 },
      { d: 2360, speed: 100, interval: 3.6, dir: 1, r: 36 },
      { d: 2700, speed: 190, interval: 1.9, dir: -1 },
      { d: 3050, speed: 200, interval: 1.8, dir: 1 },
      { d: 3400, speed: 200, interval: 1.8, dir: -1 },
    ],
    pickups: [
      { d: 480, type: 'shield' },
      { d: 1150, type: 'coin' },
      { d: 1800, type: 'turbo' },
      { d: 2900, type: 'shield' },
    ],
  },
];

// 路线点类型
export const PT = {
  START: 'start',
  PICKUP: 'pickup',
  DROPOFF: 'dropoff',
  END: 'end',
  NORMAL: 'normal',
};

// 生成关卡：route 点 + 横穿车流 + 道具，全部确定（给定 seed）。
export function buildLevel(levelIndex) {
  const lv = LEVELS[levelIndex];
  if (!lv) throw new Error(`level ${levelIndex} not found`);

  const passengers = lv.passengers;
  const points = [];

  // START
  points.push({ x: WORLD.LANE_X, y: 0, type: PT.START, dist: 0 });

  // 接客/送客点均匀铺开：每乘客一段，先接后送
  for (let p = 0; p < passengers; p += 1) {
    const pickD = (lv.length * (p + 0.28)) / passengers;
    const dropD = (lv.length * (p + 0.78)) / passengers;
    points.push({ x: WORLD.LANE_X, y: pickD, type: PT.PICKUP, dist: pickD });
    points.push({ x: WORLD.LANE_X, y: dropD, type: PT.DROPOFF, dist: dropD });
  }

  // END + 收尾 normal 点
  points.push({ x: WORLD.LANE_X, y: lv.length, type: PT.END, dist: lv.length });
  points.push({ x: WORLD.LANE_X, y: lv.length + 200, type: PT.NORMAL, dist: lv.length + 200 });

  // 横穿车：从 running 一开始就持续按 interval 造车（首车 t=0 出生），
  // 形成「总有车在过马路」的连续车流；油门抢 gap / 刹车等 gap 才有意义。
  const crossings = lv.crossings.map((c) => ({
    d: c.d,
    y: c.d,
    dir: c.dir,
    speed: c.speed,
    interval: c.interval,
    r: c.r || WORLD.CAR_R,
    spawnAt: 0,
    nextSpawn: 0,
  }));

  const pickups = lv.pickups.map((pk) => ({
    d: pk.d,
    x: WORLD.LANE_X,
    y: pk.d,
    type: pk.type,
  }));

  return {
    index: lv.index,
    key: lv.key,
    length: lv.length,
    passengers,
    points,
    crossings,
    pickups,
  };
}

export const LEVEL_COUNT = LEVELS.length;

// 星级：1 星（通关）、2 星（金币 ≥ 0.6×上限）、3 星（金币 ≥ 0.9×上限 且 ≥1 次擦肩）
export function calcStars(levelIndex, coins, nearMisses) {
  const lv = LEVELS[levelIndex];
  const maxReward = passengersMaxCoins(levelIndex);
  let stars = 1;
  if (coins >= maxReward * 0.6) stars = 2;
  if (coins >= maxReward * 0.9 && nearMisses >= 1) stars = 3;
  return stars;
}

// 理论满额金币（全部乘客 + 满连击），用于星级/成长钩子
export function passengersMaxCoins(levelIndex) {
  const lv = LEVELS[levelIndex];
  const perDrop = REWARD.BASE + lv.index / REWARD.LEVEL_DIV + REWARD.RAND_MAX;
  return Math.floor(perDrop * (1 + REWARD.COMBO_CAP)) * lv.passengers;
}
