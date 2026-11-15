// config/game.config.js — BLOCK BATTLE ROYALE 全部数值集中。逻辑层只读不写死。
export const STEP = 1 / 60;
export const VIEW = { W: 1280, H: 720 };

export const CONFIG = {
  appId: 'block-battle-royale',
  title: 'BLOCK BATTLE ROYALE',
  defaultLang: 'en',
  languages: ['en', 'zh'],
  langNames: { en: 'English', zh: '中文' },
  rtlLangs: ['ar'],
  langStorageKey: 'block-battle-royale:lang',
  saveKey: 'block-battle-royale:save',
  logicFps: 60,
};

// ---------- 世界 / 地图 ----------
export const MAP = {
  size: 64,          // 64×64 体素格
  cell: 1,           // 每格 1 世界单位
  islandRadius: 29,  // 岛半径（体素岛，水在岛外）
  center: 32,
  waterLevel: 1,     // 岛内地面基准高度
};

// ---------- 玩家 / 实体 ----------
export const PLAYER = {
  hp: 100,
  armorMax: 100,
  speed: 7.2,
  radius: 0.4,
  eye: 1.7,
  headY: 1.55,       // 高于此高度算爆头（相对脚底）
  bodyHeight: 1.8,
  medHeal: 40,
};

export const BOTS = {
  count: 29,
  hp: 100,
  speed: 5.4,
  // 早期误差大、决赛圈准：accuracy = clamp(base + t*ramp, 0, cap)
  aimBase: 0.26,
  aimRamp: 0.013,
  aimCap: 0.92,
  reactDist: 34,
  buildProb: 0.5,    // 决赛圈/被攻击时每帧建墙概率
};

// ---------- 武器（3 种：手枪 / 步枪 / 狙） ----------
export const WEAPONS = {
  pistol: { name: 'pistol', dmg: 12, headMul: 1.8, fireRate: 2.4, range: 34, mag: 12, spread: 0.020, reload: 1.1 },
  rifle:  { name: 'rifle',  dmg: 16, headMul: 2.0, fireRate: 7.0, range: 46, mag: 30, spread: 0.012, reload: 1.6 },
  sniper: { name: 'sniper', dmg: 55, headMul: 2.6, fireRate: 1.0, range: 90, mag: 5,  spread: 0.004, reload: 2.2 },
};

// ---------- 建造 ----------
export const BUILD = {
  blockHp: 3,          // 每块 3 hit
  wallCost: 1,         // 建墙消耗方块
  maxBlocks: 40,
  placeDist: 3.2,      // 放置距离
  wallHeight: 2,       // 满掩体（挡子弹/视线）
  rampHeight: 1,       // 半掩体（可探头射击）
  losBlock: 1.4,       // 高于此高度的柱体阻挡视线
};

// ---------- 缩圈（5 阶段） ----------
export const ZONE = {
  dps: 3,              // 圈外每秒掉血
  heartbeatSec: 0.5,   // 事件心跳（防死时间/空转）
  // t=开始时刻, r=目标半径；中心随阶段漂移
  stages: [
    { t: 8,   r: 30 },
    { t: 30,  r: 22 },
    { t: 52,  r: 15 },
    { t: 80,  r: 9 },
    { t: 115, r: 4 },
  ],
  shrinkSec: 8,        // 半径过渡时长
  // 空投出现阶段（段 4）
  airdropAt: 110,
};

// ---------- 战利品 ----------
export const LOOT = {
  piles: 60,           // 地面拾取堆
  radius: 2.2,         // 拾取距离
  types: ['pistol', 'rifle', 'sniper', 'ammo', 'armor', 'blocks', 'med'],
  ammoPerPile: [18, 24, 40],
};

// ---------- 跳伞 ----------
export const DROP = {
  planeY: 40,
  fallSpeed: 14,       // 下落速度（单位/秒）
  minLandT: 3,
};

// ---------- 结算评级 ----------
export const RATINGS = [
  ['S', 8], ['A', 5], ['B', 3], ['C', 1], ['D', 0],
];

// ---------- 色板（渲染用） ----------
export const COLORS = {
  grass: 0x65a30d,
  brick: 0xca8a04,
  zone: 0x3b82f6,
  danger: 0xef4444,
  water: 0x1e40af,
  player: 0x3b82f6,
  bot: 0xef4444,
  wall: 0x94a3b8,
  ramp: 0xcbd5e1,
  loot: 0xfacc15,
  airdrop: 0xf59e0b,
  deathBox: 0x4b5563,
  sky: 0x7dd3fc,
};
