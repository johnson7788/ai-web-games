// 关卡定义：距离（px，累计爬升到该值过关）、元素密度。
export const LEVEL_COUNT = 3;

export const LEVELS = [
  {
    index: 1,
    name: { en: 'Orbit Approach', zh: '近地轨道' },
    distance: 3000,
    bossHp: 3,
    hazardRate: 0.10,
    springGap: 1300,
    alienRate: 0.55,
    crystalRate: 0.10,
    trainRate: 0.04,
  },
  {
    index: 2,
    name: { en: 'Asteroid Belt', zh: '小行星带' },
    distance: 3200,
    bossHp: 4,
    hazardRate: 0.13,
    springGap: 1500,
    alienRate: 0.60,
    crystalRate: 0.10,
    trainRate: 0.06,
  },
  {
    index: 3,
    name: { en: 'Mothership Core', zh: '母舰核心' },
    distance: 3400,
    bossHp: 5,
    hazardRate: 0.15,
    springGap: 1700,
    alienRate: 0.65,
    crystalRate: 0.12,
    trainRate: 0.08,
  },
];
