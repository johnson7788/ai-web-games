// 全局数值配置（builder 拥有；数值改动只改这里）
// 花园大亨：闲置经营 —— 种花收金币 → 升级/进化 → 解锁地块 → 破岩/连击/水滴三新机制。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'garden-bloom-tycoon-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'garden-bloom-tycoon-save',
};

// 开局资源
export const START = { coins: 40, water: 4, blooms: 0 };

// 金币积累轮数上限（花田最多挂机攒多少轮，摘了就清空）
export const MAX_STAGE = 50;

// 花种（6 阶，原创奇幻花名；hue/petals 供程序化渲染）
// baseTime: 每轮生长秒数；goldOnce: 每轮基础金币；goldUp: 每级加产；
// speedUp: 每级缩短生长；upCost: 升 1 级花费；evolveCost: 满级进化成 nextId 的花费；
// maxLevel: 满级；addBloom: 进化后获得的鲜花；nextId: -1 表示最终花。
export const PLANTS = [
  { id: 1, key: 'sunnySprout', evolveCost: 120, upCost: 30, baseTime: 1.0, maxLevel: 4, goldOnce: 10, goldUp: 4, speedUp: 0.05, addBloom: 1, nextId: 2, hue: 50, petals: 6 },
  { id: 2, key: 'moonBud',     evolveCost: 300, upCost: 80, baseTime: 1.6, maxLevel: 5, goldOnce: 26, goldUp: 9, speedUp: 0.07, addBloom: 1, nextId: 3, hue: 205, petals: 8 },
  { id: 3, key: 'starDew',     evolveCost: 700, upCost: 200, baseTime: 2.3, maxLevel: 6, goldOnce: 60, goldUp: 20, speedUp: 0.09, addBloom: 1, nextId: 4, hue: 262, petals: 5 },
  { id: 4, key: 'emberBloom',  evolveCost: 1500, upCost: 500, baseTime: 3.0, maxLevel: 7, goldOnce: 130, goldUp: 42, speedUp: 0.11, addBloom: 1, nextId: 5, hue: 18, petals: 7 },
  { id: 5, key: 'frostPetal',  evolveCost: 3200, upCost: 1200, baseTime: 3.8, maxLevel: 8, goldOnce: 265, goldUp: 82, speedUp: 0.13, addBloom: 1, nextId: 6, hue: 180, petals: 9 },
  { id: 6, key: 'dreamRose',   evolveCost: -1, upCost: 2500, baseTime: 4.6, maxLevel: 9, goldOnce: 500, goldUp: 150, speedUp: 0.15, addBloom: 2, nextId: -1, hue: 322, petals: 12 },
];

// 地块解锁：needBloom 鲜花门槛（不消耗），cost 金币消耗
export const PLOTS = [
  { index: 0, needBloom: 0, cost: 0 },
  { index: 1, needBloom: 1, cost: 120 },
  { index: 2, needBloom: 3, cost: 300 },
  { index: 3, needBloom: 6, cost: 600 },
  { index: 4, needBloom: 10, cost: 1200 },
  { index: 5, needBloom: 15, cost: 2400 },
  { index: 6, needBloom: 21, cost: 4800 },
  { index: 7, needBloom: 28, cost: 9600 },
  { index: 8, needBloom: 36, cost: 20000 },
];

// 岩石：击碎得金币，周期性刷新；概率掉水滴
export const ROCK = {
  count: 3,
  rewardBase: 20,
  rewardPerLevel: 8,
  respawnSec: 6,
  waterChance: 0.35,
};

// 水滴：恢复与道具
export const WATER = { regenSec: 12, cap: 40, boostCost: 1 };

// 连击：窗口内连续收获触发金币倍数
export const COMBO = { windowSec: 2.5, maxMult: 3 };
