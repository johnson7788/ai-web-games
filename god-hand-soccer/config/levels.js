// 关卡配置：每关引入一个新元素（新机制/新敌人行为/新地形），难度递增。
// distanceM：本关目标距离（米）；speed：滚动速度（px/step）。
// rocks：本关是否出现滚动岩石；orbs：晶片出现概率；powerups：道具出现概率。
export const LEVELS = [
  { index: 1, name: { en: 'Kick Off', zh: '开球' }, distanceM: 60,  speed: 5.2,  rocks: false, orbRate: 0.35, powerRate: 0.0,  wallGap: [420, 720] },
  { index: 2, name: { en: 'Energy Shards', zh: '能量晶片' }, distanceM: 80,  speed: 5.6,  rocks: false, orbRate: 0.55, powerRate: 0.0,  wallGap: [400, 680] },
  { index: 3, name: { en: 'Rolling Rocks', zh: '滚动岩石' }, distanceM: 100, speed: 6.0,  rocks: true,  orbRate: 0.5,  powerRate: 0.0,  wallGap: [380, 640] },
  { index: 4, name: { en: 'Combo Chain', zh: '连击链' }, distanceM: 110, speed: 6.3,  rocks: true,  orbRate: 0.6,  powerRate: 0.0,  wallGap: [360, 600] },
  { index: 5, name: { en: 'Shield Up', zh: '护盾升起' }, distanceM: 120, speed: 6.6,  rocks: true,  orbRate: 0.6,  powerRate: 0.14, wallGap: [340, 580] },
  { index: 6, name: { en: 'Slow Motion', zh: '减速带' }, distanceM: 130, speed: 6.9,  rocks: true,  orbRate: 0.65, powerRate: 0.16, wallGap: [330, 560] },
  { index: 7, name: { en: 'Magnet Pull', zh: '磁吸力场' }, distanceM: 140, speed: 7.2, rocks: true,  orbRate: 0.65, powerRate: 0.18, wallGap: [320, 540] },
  { index: 8, name: { en: 'Twin Barrier', zh: '双重屏障' }, distanceM: 150, speed: 7.5, rocks: true,  orbRate: 0.7,  powerRate: 0.2,  wallGap: [300, 520], doubleWall: true },
  { index: 9, name: { en: 'Night Sprint', zh: '夜奔' }, distanceM: 160, speed: 7.8, rocks: true,  orbRate: 0.7,  powerRate: 0.2,  wallGap: [290, 500], doubleWall: true },
  { index: 10, name: { en: 'Rock Slide', zh: '岩石滑坡' }, distanceM: 170, speed: 8.1, rocks: true, orbRate: 0.72, powerRate: 0.22, wallGap: [280, 480], doubleWall: true, rockRate: 0.5 },
  { index: 11, name: { en: 'Full Press', zh: '全场紧逼' }, distanceM: 180, speed: 8.4, rocks: true, orbRate: 0.72, powerRate: 0.22, wallGap: [270, 460], doubleWall: true, rockRate: 0.6 },
  { index: 12, name: { en: 'God Hand', zh: '神之手' }, distanceM: 190, speed: 8.7, rocks: true, orbRate: 0.75, powerRate: 0.24, wallGap: [260, 440], doubleWall: true, rockRate: 0.7 },
];

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(idx) {
  return LEVELS[Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0))];
}

export function levelDistanceM(idx) {
  return getLevel(idx).distanceM;
}
