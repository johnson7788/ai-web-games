// LIL HERO SAGA · 单世界三幕关卡数据（Lead 拥有）
// 坐标约定：世界坐标 px，y 向下。groundY = 地面顶部。
// groundSegments：{x, w} 实心地面段；段间空隙即深渊（掉下去扣血重生）。
// rocks：彩色晶岩（挡路，同色法术一击破 / 异色削 1）。
// enemies：walker/archer/sworder/bat/wizard（boss 由 flag 触发）。

export const LEVEL = {
  index: 1,
  name: { en: 'Neon Hollow', zh: '霓虹空洞' },
  width: 3000,
  groundY: 600,
  spawn: { x: 100, y: 600 },
  flag: { x: 2280 },

  groundSegments: [
    { x: 0, w: 520 },
    { x: 620, w: 520 },
    { x: 1240, w: 420 },
    { x: 1760, w: 340 },
    { x: 2200, w: 800 },
  ],

  platforms: [
    { x: 540, y: 470, w: 120, h: 14 },
    { x: 1300, y: 460, w: 120, h: 14 },
    { x: 1740, y: 470, w: 100, h: 14 },
  ],

  rocks: [
    { x: 890, y: 600, w: 34, h: 92, color: 'red' },
    { x: 1810, y: 600, w: 34, h: 92, color: 'blue' },
  ],

  enemies: [
    { type: 'walker', x: 300, y: 600, patrolL: 180, patrolR: 470 },
    { type: 'archer', x: 800, y: 600 },
    { type: 'bat', x: 1000, y: 500, patrolL: 720, patrolR: 1120 },
    { type: 'walker', x: 1450, y: 600, patrolL: 1270, patrolR: 1640 },
    { type: 'archer', x: 2050, y: 600 },
    { type: 'wizard', x: 1990, y: 470 },
  ],

  pickups: [
    { x: 590, y: 440, kind: 'bottle', color: 'red' },
    { x: 1350, y: 430, kind: 'bottle', color: 'blue' },
    { x: 1790, y: 440, kind: 'bottle', color: 'yellow' },
    { x: 1080, y: 560, kind: 'orb' },
    { x: 2000, y: 560, kind: 'orb' },
  ],

  boss: { x: 2850, y: 470, hp: 8 },
};

export const LEVELS = [LEVEL];
export const LEVEL_COUNT = LEVELS.length;
