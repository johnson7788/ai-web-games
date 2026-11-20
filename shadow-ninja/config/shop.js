// Shadow Ninja Cat · 商店定价表 + 成就条件（1:1 抽数值还原自 MiniNinjiaCat 的 allInfos）
// 货币统一为「风铃」(chime)；持久化走 src/core/sdk.js。

export const PROP_TYPE = { FLY: 1, MAGNET: 2, DOUBLE: 3, REVIVE: 4 };

// 商店 8 件：3 件永久能力 + 4 件消耗道具 + 1 件外观（月影披风）。
// kind: 'ability'（永久，owned=true）| 'prop'（消耗，count++）
export const SHOP_ITEMS = [
  {
    id: 'cloak', kind: 'ability', type: 0, price: 50,
    name: { en: 'Shadow Cloak', zh: '夜行斗篷' },
    desc: { en: 'Double jump in mid-air.', zh: '空中可再跳一次（二段跳）。' },
  },
  {
    id: 'hook', kind: 'ability', type: 0, price: 80,
    name: { en: 'Grappling Claw', zh: '飞爪钩' },
    desc: { en: 'Jump much higher, sailing over wide gaps.', zh: '跳跃更高，飞跃宽沟。' },
  },
  {
    id: 'bell', kind: 'ability', type: 0, price: 40,
    name: { en: 'Guard Bell', zh: '护身铃' },
    desc: { en: 'Start each run with a shield that absorbs one hit.', zh: '每局开场带一层护盾，挡一次伤害。' },
  },
  {
    id: 'fly', kind: 'prop', type: PROP_TYPE.FLY, price: 20,
    name: { en: 'Bamboo Copter', zh: '竹蜻蜓' },
    desc: { en: 'Fly forward invincible for a few seconds.', zh: '向前飞行数秒，期间无敌。' },
  },
  {
    id: 'magnet', kind: 'prop', type: PROP_TYPE.MAGNET, price: 10,
    name: { en: 'Bell Magnet', zh: '吸金铃' },
    desc: { en: 'Magnetize nearby wind chimes to you.', zh: '自动吸附身边的风铃。' },
  },
  {
    id: 'double', kind: 'prop', type: PROP_TYPE.DOUBLE, price: 15,
    name: { en: 'Echo Bell', zh: '双倍铃' },
    desc: { en: 'Double every wind chime for a few seconds.', zh: '数秒内风铃翻倍。' },
  },
  {
    id: 'revive', kind: 'prop', type: PROP_TYPE.REVIVE, price: 25,
    name: { en: 'Soul Bell', zh: '还魂铃' },
    desc: { en: 'Revive once where you fell.', zh: '原地复活一次。' },
  },
  {
    id: 'moonshadow', kind: 'ability', type: 0, price: 70,
    name: { en: 'Moon Shadow', zh: '月影披风' },
    desc: { en: 'A deeper silhouette and a longer golden trail.', zh: '剪影更深，金色风铃尾迹更长。' },
  },
];

// 成就（7 类，各 4 档，条件 1:1 取自源码 achievements）
export const ACHIEVEMENTS = [
  { id: 1, key: 'totalChimes', en: 'Wind Chimes Earned', zh: '累计获得风铃', thresholds: [100, 300, 1000, 2000] },
  { id: 2, key: 'maxDistance', en: 'Farthest Single Run', zh: '单局最远距离', thresholds: [300, 700, 1000, 1250] },
  { id: 3, key: 'totalDistance', en: 'Lifetime Distance', zh: '累计最长距离', thresholds: [2000, 5000, 9000, 14000] },
  { id: 4, key: 'playCount', en: 'Runs Played', zh: '累计游戏局数', thresholds: [10, 30, 100, 300] },
  { id: 5, key: 'surpassCount', en: 'Personal Bests', zh: '自我超越次数', thresholds: [5, 10, 50, 100] },
  { id: 6, key: 'flyCount', en: 'Bamboo Copter Uses', zh: '竹蜻蜓达人', thresholds: [10, 30, 100, 300] },
  { id: 7, key: 'usePropCount', en: 'Total Prop Uses', zh: '道具达人', thresholds: [100, 500, 1000, 5000] },
];

export function shopItemById(id) {
  return SHOP_ITEMS.find((s) => s.id === id) || null;
}
