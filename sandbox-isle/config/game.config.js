// config/game.config.js — 全局数值配置（config-first：玩法数值全部在此，逻辑层不写死数字）
// 本作：32×24×32 有限体素岛。挖/建/养动物/每日目标/彩虹桥终局。

export const WORLD = {
  W: 32,                 // 岛宽（x 轴，块）
  H: 24,                 // 岛高（y 轴，块）
  D: 32,                 // 岛深（z 轴，块）
  WATER_LEVEL: 4,        // 海平面（<= 此高度的空气变水面）
  DAY_SECONDS: 180,      // 游戏内一天 = 3 分钟
  REACH: 6,              // 挖掘/放置可达距离（块）
  EYE: 1.6,              // 眼睛离脚底高度
  SPAWN: { x: 16, z: 16 },
};

export const STEP = 1 / 60;

// 方块表：id 0 = 空气。1–6 是热键栏 6 格；7–13 是 7 色稀有方块（彩虹桥材料，不可放置）。
export const BLOCKS = {
  AIR: 0,
  // 可放置的 6 格
  GRASS: 1, WOOD: 2, STONE: 3, SAND: 4, WATER: 5, FLOWER: 6,
  // 彩虹 7 色（每日目标奖励，用于彩虹桥）
  RAINBOW_MIN: 7, RAINBOW_MAX: 13,
};

export const BLOCK_DEFS = {
  1: { name: 'grass',  color: 0x35b565, solid: true,  placeable: true, fluid: false, slot: 0 },
  2: { name: 'wood',   color: 0x8b5a2b, solid: true,  placeable: true, fluid: false, slot: 1 },
  3: { name: 'stone',  color: 0x9ca3af, solid: true,  placeable: true, fluid: false, slot: 2 },
  4: { name: 'sand',   color: 0xfde68a, solid: true,  placeable: true, fluid: false, slot: 3 },
  5: { name: 'water',  color: 0x38bdf8, solid: false, placeable: true, fluid: true,  slot: 4 },
  6: { name: 'flower', color: 0xf472b6, solid: true,  placeable: true, fluid: false, slot: 5 },
  7:  { name: 'rainbow', color: 0xef4444, solid: true, placeable: false, rainbow: true },
  8:  { name: 'rainbow', color: 0xf97316, solid: true, placeable: false, rainbow: true },
  9:  { name: 'rainbow', color: 0xfacc15, solid: true, placeable: false, rainbow: true },
  10: { name: 'rainbow', color: 0x22c55e, solid: true, placeable: false, rainbow: true },
  11: { name: 'rainbow', color: 0x06b6d4, solid: true, placeable: false, rainbow: true },
  12: { name: 'rainbow', color: 0x3b82f6, solid: true, placeable: false, rainbow: true },
  13: { name: 'rainbow', color: 0x8b5cf6, solid: true, placeable: false, rainbow: true },
};

export const HOTBAR = [1, 2, 3, 4, 5, 6]; // 草/木/石/沙/水/花

export const RAINBOW = {
  colors: [7, 8, 9, 10, 11, 12, 13],
  need: 20,              // 每色各 20 块才能建彩虹桥
  goalReward: 20,        // 每完成一个每日目标给 20 块（按颜色循环）
};

// 体力：挖/建消耗，耗尽后强行累晕（唯一失败态）
export const STAMINA = {
  max: 100,
  digCost: 4,
  placeCost: 1,
  regen: 5,             // 每秒回复
  collapseGoldLoss: 5,
};

// 动物
export const ANIMALS = {
  speed: 1.4,
  feedRange: 3.0,       // 喂食交互距离
  produce: {
    chicken: { good: 'egg', gold: 2 },
    sheep:   { good: 'wool', gold: 3 },
    peacock: { good: 'goldEgg', gold: 10 },
  },
  spawn: [
    { id: 'c1', type: 'chicken', x: 13, z: 13 },
    { id: 'c2', type: 'chicken', x: 19, z: 14 },
    { id: 'c3', type: 'chicken', x: 15, z: 19 },
    { id: 's1', type: 'sheep',   x: 12, z: 20 },
    { id: 's2', type: 'sheep',   x: 21, z: 18 },
    { id: 'p1', type: 'peacock', x: 17, z: 16 },
  ],
};

// 农田（萝卜）
export const FARM = {
  growSec: 20,          // 萝卜成熟时间
  tiles: [
    { x: 20, z: 12 }, { x: 21, z: 12 }, { x: 22, z: 12 },
    { x: 20, z: 13 }, { x: 21, z: 13 }, { x: 22, z: 13 },
  ],
  harvestRange: 3.0,
};

// 每日目标池（每天取 3 个）
export const GOALS = [
  { id: 'dig_stone',  metric: 'stonesDug',      target: 6,  gold: 15 },
  { id: 'build',      metric: 'blocksPlaced',   target: 3,  gold: 15 },
  { id: 'feed',       metric: 'animalsFed',     target: 2,  gold: 20 },
  { id: 'eggs',       metric: 'eggsCollected',  target: 2,  gold: 20 },
  { id: 'gold',       metric: 'goldEarned',     target: 10, gold: 15 },
  { id: 'harvest',    metric: 'carrotsHarvested', target: 3, gold: 15 },
];

// 语言：默认英文；zh 必做；ja/ko/ar/ru 不做就整块不暴露
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: ['ar'],
  langStorageKey: 'sandbox-isle-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'sandbox-isle-save',
};
