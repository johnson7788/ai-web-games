// 玩法数值（M1 所有）：经济 / 升级 / 伙伴 / 融资轮 / 风口轮盘 / 烧钱模式。
// 全部数值集中在此，逻辑层不写死数字。

// 经济底座
export const ECO = {
  startCash: 15,          // 自掏腰包的启动金（不并入估值，估值只算终身营收）
  baseClick: 1,           // 初始每点收入
  baseAuto: 1,            // 初始每秒自动收入（基础运营，保证无操作也能推进）
};

// 技能升级（点击力 / 自动收入）：cost = baseCost * costMult^level；效果 = base * mult^level
// costMult 刻意大于 mult：收益随等级递减，避免收入指数爆炸、压缩 12 轮推进节奏。
export const UPGRADES = [
  { id: 'tap', baseCost: 10, costMult: 1.75, base: 1, mult: 1.5, labelKey: 'up.tap' },
  { id: 'auto', baseCost: 60, costMult: 1.85, base: 1, mult: 1.5, labelKey: 'up.auto' },
];

// 伙伴雇佣（被动产出）：一次性购买，永久 +income/sec
export const PARTNERS = [
  { id: 'intern', cost: 50, income: 3, labelKey: 'partner.intern' },
  { id: 'engineer', cost: 400, income: 20, labelKey: 'partner.engineer' },
  { id: 'pm', cost: 3000, income: 120, labelKey: 'partner.pm' },
  { id: 'vp', cost: 20000, income: 600, labelKey: 'partner.vp' },
  { id: 'cto', cost: 120000, income: 3000, labelKey: 'partner.cto' },
  { id: 'cmo', cost: 800000, income: 15000, labelKey: 'partner.cmo' },
];

// 12 融资轮（种子→天使→A→B→…→IPO），每轮一个估值目标（终身营收阈值）
export const ROUNDS = [
  { index: 1, key: 'seed', target: 1000 },
  { index: 2, key: 'angel', target: 10000 },
  { index: 3, key: 'a', target: 100000 },
  { index: 4, key: 'b', target: 500000 },
  { index: 5, key: 'c', target: 2000000 },
  { index: 6, key: 'd', target: 8000000 },
  { index: 7, key: 'e', target: 15000000 },
  { index: 8, key: 'f', target: 25000000 },
  { index: 9, key: 'g', target: 40000000 },
  { index: 10, key: 'h', target: 60000000 },
  { index: 11, key: 'i', target: 80000000 },
  { index: 12, key: 'ipo', target: 100000000 },
];

// 三场景包：换章必换色板+构图+装饰（车库 / 孵化器 / 摩天办公）
export const SCENE_PACKS = [
  { fromRound: 1, id: 'garage' },
  { fromRound: 5, id: 'incubator' },
  { fromRound: 9, id: 'skyscraper' },
];

// 风口轮盘的 6 个赛道
export const SECTORS = [
  { id: 'live', labelKey: 'sector.live' },
  { id: 'ai', labelKey: 'sector.ai' },
  { id: 'meta', labelKey: 'sector.meta' },
  { id: 'green', labelKey: 'sector.green' },
  { id: 'ecom', labelKey: 'sector.ecom' },
  { id: 'game', labelKey: 'sector.game' },
];

export const WINDFALL = {
  cycleSec: 60,       // 每 60s 出一个风口
  activeSec: 30,      // 押中后 ×3 收益持续 30s
  mult: 3,
  heatDrift: 4,       // 热度速度每秒最大变化（动量，让趋势可读）
  heatSpeed: 6,       // 热度每秒最大漂移
};

export const BURN = {
  activeSec: 30,      // 主动开启 2× 收入 30s
  cooldownSec: 60,    // 结束后冷却 60s
  mult: 2,
};

export function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

export function roundTarget(round) {
  return ROUNDS[clamp(round, 1, ROUNDS.length) - 1].target;
}

export function sceneIdForRound(round) {
  let id = SCENE_PACKS[0].id;
  for (const p of SCENE_PACKS) {
    if (round >= p.fromRound) id = p.id;
  }
  return id;
}
