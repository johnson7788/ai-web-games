// BEAR DASH RUN · 关卡布局（程序化坐标，单位 = 世界像素，GROUND_Y=600）
// 形状约定（sim 里统一补 y）：
//   rocks    { x, w, h }           —— 实心岩块，可踩踏/需跳过
//   spikes   { x, w }              —— 地面激光栅，踩到即死
//   enemies  { x, w, h, minX, maxX, dir, speed } —— 巡逻机器人，踩头击杀，侧碰即死
//   chompers { x, w, h }           —— 食人花，碰到即死
//   boosters { x, w }              —— 加速垫，穿过获得冲刺 + 短暂无敌
//   stars    { x, y }              —— 奖励星（本关共 2 颗，结算 1 + 收集数 = 1~3 星）
// 相邻障碍间距 ≥ 320px，保证单跳（约 238px 水平距离）可逐级安全通过。
export const LEVELS = [
  {
    name: 'NEON PLAZA',
    width: 3600,
    goalX: 3440,
    rocks: [
      { x: 700, w: 64, h: 70 },
      { x: 1150, w: 64, h: 70 },
      { x: 1600, w: 64, h: 70 },
    ],
    spikes: [
      { x: 2050, w: 110 },
      { x: 2600, w: 110 },
    ],
    enemies: [
      // 出生点附近巡逻，会主动靠向 idle 玩家（noinput/random 由此死亡）
      { x: 240, w: 46, h: 44, minX: 60, maxX: 420, dir: -1, speed: 130 },
    ],
    chompers: [],
    boosters: [],
    stars: [
      { x: 520, y: 515 },
      { x: 2250, y: 515 },
    ],
  },
  {
    name: 'GRID CANYON',
    width: 4000,
    goalX: 3800,
    rocks: [
      { x: 800, w: 64, h: 70 },
      { x: 1250, w: 64, h: 70 },
    ],
    spikes: [
      { x: 2000, w: 110 },
    ],
    enemies: [
      { x: 300, w: 46, h: 44, minX: 200, maxX: 520, dir: -1, speed: 140 },
      { x: 1550, w: 46, h: 44, minX: 1450, maxX: 1750, dir: -1, speed: 140 },
    ],
    chompers: [],
    boosters: [],
    stars: [
      { x: 1050, y: 515 },
      { x: 2350, y: 515 },
    ],
  },
  {
    name: 'DATA FALLS',
    width: 4200,
    goalX: 4000,
    rocks: [
      { x: 700, w: 64, h: 70 },
      { x: 1400, w: 64, h: 70 },
    ],
    spikes: [
      { x: 2100, w: 110 },
      { x: 3500, w: 110 },
    ],
    enemies: [
      { x: 320, w: 46, h: 44, minX: 220, maxX: 560, dir: -1, speed: 140 },
    ],
    chompers: [
      { x: 1050, w: 64, h: 70 },
      { x: 1750, w: 64, h: 70 },
    ],
    boosters: [
      { x: 2450, w: 72 },
      { x: 3150, w: 72 },
    ],
    stars: [
      { x: 900, y: 515 },
      { x: 2300, y: 515 },
    ],
  },
];
