// config/gameplay.js — 玩法数值（全部集中于此，逻辑层不写死数字）。
// 事件契约与 sim 内部实现见 src/game/sim.js；渲染主题见 src/render/theme.js。

// 矿脉方块类型（0-5 = 可交换矿石/燃料/金块；ROCK/BOSS 为障碍）
export const TILE = {
  RUBY: 0,
  SAPPHIRE: 1,
  AMETHYST: 2,
  EMERALD: 3,
  FUEL: 4,
  GOLD: 5,
  EMPTY: -1,
  ROCK: 100,
  BOSS: 101,
};

export const ORE_IDS = [TILE.RUBY, TILE.SAPPHIRE, TILE.AMETHYST, TILE.EMERALD, TILE.FUEL, TILE.GOLD];
export const ORE_KEYS = ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel', 'gold'];

// 资源上限（coin 无上限）
export const CAPS = { ruby: 20, sapphire: 20, amethyst: 20, emerald: 20, fuel: 50 };

// 步数（行动力）：每局步数耗尽即失败
export const MOVES = { start: 15, matchCost: 1, digGain: 3, bossKillGain: 3 };

// 矿洞安全度：塌方事件降低安全度，归零即塌方死亡
export const STABILITY = {
  max: 100,
  collapseDamage: 25,
  reinforceDamage: 5,
  reinforceCost: 8,   // 金币
  firstSec: 25,
  intervalSec: 18,
  warningSec: 5,
  rocksPerCollapse: 3,
};

// 挖掘：清空当前矿层的岩壁后可向下挖
export const DIG = { cost: 5, depthPerDig: 6 };   // cost 为燃料

// 头目矿兽：每 2 次下挖（12m）出现一次
export const BOSS = {
  depthEvery: 12,
  hpBase: 5,
  hpPerShaft: 2,
  size: 3,             // 3×3 岩块
  actionIntervalSec: 8,
};

// 矿工（地精灯笼）：照亮列，该列匹配产出加成；升级扩大加成
export const GOBLIN = {
  maxCount: 5,
  hireCostBase: 20,
  hireCostStep: 12,
  upgradeCostBase: 15,
  upgradeCostStep: 10,
  lightBonusPerLevel: 0.5,   // 1 级 +50%，2 级 +100%…
  oilDrainPerColPerSec: 0.4,
};

// 技能（消耗资源 → 改规则）
export const SKILLS = [
  { id: 'fuelSurge', cost: { fuel: 3 }, kind: 'tap' },
  { id: 'tnt', cost: { ruby: 6, sapphire: 6, fuel: 1 }, kind: 'choose' },
  { id: 'fuelCollect', cost: { amethyst: 6, emerald: 6, fuel: 1 }, kind: 'tap' },
  { id: 'precisePick', cost: { ruby: 3, sapphire: 3, amethyst: 3, emerald: 3 }, kind: 'choose' },
];

export const TUTORIAL = {
  holdMs: 0,           // 本作教程为「交换→挖→矿工」三步，无按住步
  matchTarget: 1,      // 第 2 步需要完成 1 次消除
};
