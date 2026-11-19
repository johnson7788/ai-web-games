// PARK SLIDE IN · 关卡数据（世界 1280×720，y 向下）
// 所有坐标均为世界坐标；矩形 {x,y,w,h} 为中心 + 尺寸。
// 车头朝向 heading（0=+X 右，正值顺时针）。entry.heading = 入位时车头朝向；entry.reverse = 是否倒车入位。

export const LEVELS = [
  // L1 · 霓虹车库（正向驶入，教学：转向 + 油门 + 滑行入位）
  {
    name: { en: 'Neon Bay', zh: '霓虹车库' },
    scene: 'city-1',
    car: { x: 240, y: 470, heading: 0 },
    bay: { x: 1010, y: 360, w: 150, h: 96 },
    entry: { heading: 0, reverse: false },
    par: 24, // 3 星限时（秒）
    obstacles: [
      { x: 1010, y: 200, w: 150, h: 96 },  // 上侧停靠车
      { x: 1010, y: 520, w: 150, h: 96 },  // 下侧停靠车
      { x: 620, y: 120, w: 180, h: 90 },   // 上方远处停靠车（装饰 + 边界）
      { x: 620, y: 600, w: 180, h: 90 },   // 下方远处停靠车
    ],
    orbs: [
      { x: 300, y: 470 },
      { x: 760, y: 360 },
      { x: 850, y: 360 },
      { x: 940, y: 360 },
    ],
    shields: [{ x: 700, y: 250 }],
    moving: [],
  },

  // L2 · 后巷倒库（倒车直线入位，窄车库：学习倒车油门与保持直线）
  {
    name: { en: 'Garage Reverse', zh: '后巷倒库' },
    scene: 'city-2',
    car: { x: 1130, y: 360, heading: 0 },
    bay: { x: 880, y: 360, w: 150, h: 96 },
    entry: { heading: 0, reverse: true },
    par: 22,
    obstacles: [
      { x: 789, y: 360, w: 14, h: 96 },   // 车库后墙（封住左侧正向入口）
      { x: 880, y: 258, w: 150, h: 16 },  // 车库上沿
      { x: 880, y: 462, w: 150, h: 16 },  // 车库下沿
      { x: 620, y: 120, w: 180, h: 90 },  // 装饰停靠车
      { x: 620, y: 600, w: 180, h: 90 },
    ],
    orbs: [
      { x: 1060, y: 360 },
      { x: 990, y: 360 },
      { x: 910, y: 360 },
    ],
    shields: [{ x: 1130, y: 250 }],
    moving: [],
  },

  // L3 · 巡逻无人机（正向入位 + 移动障碍，学习观察时机/护盾）
  {
    name: { en: 'Drone Patrol', zh: '巡逻无人机' },
    scene: 'city-3',
    car: { x: 240, y: 470, heading: 0 },
    bay: { x: 1010, y: 360, w: 150, h: 96 },
    entry: { heading: 0, reverse: false },
    par: 30,
    obstacles: [
      { x: 1010, y: 200, w: 150, h: 96 },
      { x: 1010, y: 520, w: 150, h: 96 },
    ],
    orbs: [
      { x: 300, y: 470 },
      { x: 760, y: 360 },
      { x: 850, y: 360 },
      { x: 940, y: 360 },
    ],
    shields: [{ x: 780, y: 195 }],
    moving: [
      // 无人机：在 x=780 上方纵向往返巡逻，守护护盾（安全泊车线在 y=360，二者不重叠）
      { x: 780, y: 200, w: 92, h: 70, axis: 'y', min: 140, max: 250, speed: 140, phase: 0 },
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
