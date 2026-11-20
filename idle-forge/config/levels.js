// IDLE FORGE · 关卡数据（12 关 = 12 件装备，4 大品类，3 场景包）
// 每关 = 攒出该品类「大师之作」（masterpiece 进度条满）。
// 字段：
//   index / name{en,zh} / scene('village'|'castle'|'volcano')
//   tier(0..3) / tierName{en,zh}
//   target(锻造次数) / yield(基础金币/次) / mechanic / shortage(线)
// mechanic ∈ 'shortage'|'furnace'|'vein'|'strike'|'order'|'all'
//   短缺→某线涨价；炉候→火温窗口；矿脉→爆发收益；罢工→学徒安抚；订单→限时奖励。
// 数值：yield 按 1.35^(level-1) 增长，target 按 30+10*(level-1) 增长，保证前 3 分钟必有推进。

const L = (index, name, tier, tierName, scene, target, mechanic, extra = {}) => ({
  index,
  name,
  tier,
  tierName,
  scene,
  target,
  yield: Math.round(10 * Math.pow(1.35, index - 1)),
  mechanic,
  ...extra,
});

export const LEVELS = [
  L(1, { en: 'Copper Sword', zh: '铜剑' }, 0, { en: 'Copper', zh: '铜制' }, 'village', 30, null),
  L(2, { en: 'Copper Helm', zh: '铜盔' }, 0, { en: 'Copper', zh: '铜制' }, 'village', 40, null),
  L(3, { en: 'Copper Armor', zh: '铜甲' }, 0, { en: 'Copper', zh: '铜制' }, 'village', 50, 'shortage', { shortage: 'power' }),
  L(4, { en: 'Iron Sword', zh: '铁剑' }, 1, { en: 'Iron', zh: '铁制' }, 'castle', 60, null),
  L(5, { en: 'Iron Armor', zh: '铁甲' }, 1, { en: 'Iron', zh: '铁制' }, 'castle', 70, 'furnace'),
  L(6, { en: 'Iron Helm', zh: '铁盔' }, 1, { en: 'Iron', zh: '铁制' }, 'castle', 80, 'vein'),
  L(7, { en: 'Mithril Sword', zh: '秘银剑' }, 2, { en: 'Mithril', zh: '秘银' }, 'volcano', 90, null),
  L(8, { en: 'Mithril Armor', zh: '秘银甲' }, 2, { en: 'Mithril', zh: '秘银' }, 'volcano', 100, 'strike'),
  L(9, { en: 'Mithril Helm', zh: '秘银盔' }, 2, { en: 'Mithril', zh: '秘银' }, 'volcano', 110, 'order'),
  L(10, { en: 'Dragon Scale Sword', zh: '龙鳞剑' }, 3, { en: 'Dragon Scale', zh: '龙鳞' }, 'volcano', 120, null),
  L(11, { en: 'Dragon Scale Armor', zh: '龙鳞甲' }, 3, { en: 'Dragon Scale', zh: '龙鳞' }, 'volcano', 130, 'shortage', { shortage: 'temp' }),
  L(12, { en: 'Dragon Slayer', zh: '屠龙圣剑' }, 3, { en: 'Dragon Slayer', zh: '屠龙' }, 'volcano', 140, 'all'),
];

export const LEVEL_COUNT = LEVELS.length;

export const SCENES = ['village', 'castle', 'volcano'];
