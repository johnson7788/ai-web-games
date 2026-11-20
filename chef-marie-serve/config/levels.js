// 关卡数据：3 关横版平台（主题 / 平台 / 食材 / 敌人 / 香料 / 危害 / 上菜台 / 出生点）
// 世界坐标：y 向下；主地面顶边 y=560，玩家脚底贴地。食材贴地（y=500）走路即收集；
// 悬空食材（y=430~470）需要跳跃时机，属奖励分。
export const LEVELS = [
  {
    index: 1,
    name: { en: 'Breakfast Rush', zh: '早餐冲刺' },
    width: 3200,
    sky: { top: '#ffd9a0', bottom: '#ffe9c9', accent: '#ff6b5e' },
    spawn: { x: 120, y: 500 },
    platforms: [
      { x: 0, y: 560, w: 1040, h: 160 },
      { x: 1180, y: 560, w: 900, h: 160 },
      { x: 2220, y: 560, w: 980, h: 160 },
    ],
    ingredients: [
      { x: 320, y: 500 }, { x: 560, y: 500 }, { x: 800, y: 500 },
      { x: 1110, y: 430 }, // 悬在第一个缺口上
      { x: 1300, y: 500 }, { x: 1580, y: 500 }, { x: 1900, y: 500 },
      { x: 2150, y: 430 }, { x: 2450, y: 500 }, { x: 2900, y: 500 },
    ],
    enemies: [
      { x: 1450, y: 520, minX: 1450, maxX: 1850, speed: 45, kind: 'rat' },
    ],
    spices: [{ x: 2500, y: 500 }],
    hazards: [],
    cards: [],
    end: { x: 3060, y: 400, w: 110, h: 160 },
  },
  {
    index: 2,
    name: { en: 'Lunch Crush', zh: '午餐大战' },
    width: 3600,
    sky: { top: '#ffd27f', bottom: '#fff0c9', accent: '#ff9f43' },
    spawn: { x: 120, y: 500 },
    platforms: [
      { x: 0, y: 560, w: 900, h: 160 },
      { x: 1040, y: 560, w: 760, h: 160 },
      { x: 1940, y: 560, w: 660, h: 160 },
      { x: 2760, y: 560, w: 840, h: 160 },
    ],
    ingredients: [
      { x: 300, y: 500 }, { x: 600, y: 500 },
      { x: 970, y: 440 }, // 缺口上悬空奖励
      { x: 1200, y: 500 }, { x: 1500, y: 500 },
      { x: 1870, y: 440 }, // 缺口上悬空奖励
      { x: 2200, y: 500 }, { x: 2450, y: 500 },
      { x: 3000, y: 500 }, { x: 3300, y: 500 },
    ],
    enemies: [
      { x: 1200, y: 520, minX: 1200, maxX: 1720, speed: 45, kind: 'rat' },
      { x: 2250, y: 460, minX: 2250, maxX: 2250, minY: 430, maxY: 540, speed: 110, kind: 'fly' },
    ],
    spices: [{ x: 2350, y: 500 }],
    hazards: [],
    cards: [
      { x: 700, y: 470, title: 'cardTitle1', text: 'cardText1' },
    ],
    end: { x: 3490, y: 400, w: 110, h: 160 },
  },
  {
    index: 3,
    name: { en: 'Dinner Dash', zh: '晚餐疾走' },
    width: 4000,
    sky: { top: '#ffb27f', bottom: '#ffe2c9', accent: '#e5533d' },
    spawn: { x: 120, y: 500 },
    platforms: [
      { x: 0, y: 560, w: 860, h: 160 },
      { x: 1000, y: 560, w: 900, h: 160 },
      { x: 2060, y: 560, w: 640, h: 160 },
      { x: 2760, y: 560, w: 1240, h: 160 },
    ],
    ingredients: [
      { x: 280, y: 500 }, { x: 560, y: 500 },
      { x: 1100, y: 500 }, { x: 1400, y: 500 },
      { x: 1650, y: 470 }, // 热锅上方，跳跃奖励
      { x: 1995, y: 440 }, // 缺口上悬空奖励
      { x: 2200, y: 500 }, { x: 2450, y: 500 },
      { x: 3000, y: 500 }, { x: 3500, y: 500 }, { x: 3800, y: 500 },
    ],
    enemies: [
      { x: 1100, y: 520, minX: 1100, maxX: 1400, speed: 45, kind: 'rat' },
      { x: 2350, y: 460, minX: 2350, maxX: 2350, minY: 430, maxY: 540, speed: 120, kind: 'fly' },
      { x: 3100, y: 520, minX: 3100, maxX: 3600, speed: 45, kind: 'rat' },
    ],
    spices: [{ x: 2150, y: 500 }],
    hazards: [
      { x: 1500, y: 532, w: 60, h: 28 },
      { x: 3750, y: 532, w: 60, h: 28 },
    ],
    cards: [
      { x: 2100, y: 470, title: 'cardTitle2', text: 'cardText2' },
    ],
    end: { x: 3910, y: 400, w: 110, h: 160 },
  },
];

export const LEVEL_COUNT = LEVELS.length;
