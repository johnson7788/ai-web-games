// 关卡数据（sim 只读这些几何/约束；世界常量在 game.config.js）
// beams: 垂直火花束 {x, yTop, yBot}，卡车进入该竖条危险区即烧毁
// cores: 能量核心 {x, y}，卡车靠近即收集
export const LEVELS = [
  {
    name: { en: 'First Haul', zh: '首趟运送' },
    ink: 3,
    timeLimit: 25,
    beams: [],
    cores: [],
  },
  {
    name: { en: 'Spark Alley', zh: '火花小巷' },
    ink: 4,
    timeLimit: 30,
    beams: [{ x: 640, yTop: 340, yBot: 470 }],
    cores: [],
  },
  {
    name: { en: 'Core Run', zh: '核心冲刺' },
    ink: 5,
    timeLimit: 35,
    beams: [
      { x: 430, yTop: 360, yBot: 470 },
      { x: 850, yTop: 360, yBot: 470 },
    ],
    cores: [
      { x: 560, y: 260 },
      { x: 700, y: 540 },
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
