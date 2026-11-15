// config/game.config.js — KEEP GUARD 3D 全部数值/关卡/颜色集中于此；逻辑层只读不写死。
export const STEP = 1 / 60;
export const VIEW = { W: 1280, H: 720 };

export const CONFIG = {
  appId: 'keep-guard-3d',
  title: 'KEEP GUARD 3D',
  defaultLang: 'en',
  languages: ['en', 'zh'],
  langNames: { en: 'English', zh: '中文' },
  rtlLangs: ['ar'],
  langStorageKey: 'keep-guard-3d:lang',
  saveKey: 'keep-guard-3d:save',
  logicFps: 60,
};

// ---------------------------------------------------------------- 地图（16×12，tile=1 世界单位）
// 世界：x ∈ [-8, 8]，z ∈ [-6, 6]；cell (c,r) 中心 = (c - 7.5, r - 5.5)
// 固定岩石把默认 BFS 路径压成三段蛇形（签名：红线改道），连接口在 c=3 与 c=12。
export const MAP = {
  cols: 16,
  rows: 12,
  tile: 1,
  spawn: { c: 0, r: 1 },
  core: { c: 15, r: 10 },
  rocks: (() => {
    const out = [];
    for (let c = 0; c < 16; c++) {
      if (c !== 3) { out.push([c, 3], [c, 4]); }
      if (c !== 12) { out.push([c, 7], [c, 8]); }
    }
    return out;
  })(),
};
export const cellWorld = (c, r) => ({ x: c - (MAP.cols - 1) / 2, z: r - (MAP.rows - 1) / 2 });
export const worldCell = (x, z) => ({ c: Math.round(x + (MAP.cols - 1) / 2), r: Math.round(z + (MAP.rows - 1) / 2) });

// ---------------------------------------------------------------- 塔（3 塔 × 3 级）
export const TOWERS = {
  arrow: {
    cost: 30, color: 0xf59e0b,
    levels: [
      { dmg: 12, range: 3.3, rate: 1.3, projSpeed: 18 },
      { dmg: 22, range: 3.7, rate: 1.5, projSpeed: 20 },
      { dmg: 38, range: 4.1, rate: 1.7, projSpeed: 22, crit: 0.25 },
    ],
    upgradeCost: [40, 55],
  },
  cannon: {
    cost: 45, color: 0x334155,
    levels: [
      { dmg: 26, range: 2.9, rate: 0.55, aoe: 1.3, projSpeed: 11 },
      { dmg: 46, range: 3.2, rate: 0.6, aoe: 1.5, projSpeed: 12 },
      { dmg: 80, range: 3.6, rate: 0.65, aoe: 1.9, projSpeed: 13 },
    ],
    upgradeCost: [60, 80],
  },
  ice: {
    cost: 35, color: 0x38bdf8,
    levels: [
      { dmg: 3, range: 2.7, rate: 1.1, slow: 0.40, slowDur: 1.2, aoe: 0 },
      { dmg: 6, range: 2.9, rate: 1.2, slow: 0.50, slowDur: 1.5, aoe: 0 },
      { dmg: 10, range: 3.3, rate: 1.3, slow: 0.60, slowDur: 2.0, aoe: 1.2 },
    ],
    upgradeCost: [50, 70],
  },
};
export const WALL = { cost: 15, hp: 220, color: 0x78716c };

// ---------------------------------------------------------------- 敌人
export const ENEMIES = {
  infantry: { hp: 40, speed: 1.5, gold: 12, dmg: 1, armor: 0, flying: false, breaker: false, color: 0xdc2626, scale: 0.34, radius: 0.28 },
  runner:   { hp: 26, speed: 2.9, gold: 14, dmg: 1, armor: 0, flying: false, breaker: false, color: 0xf97316, scale: 0.26, radius: 0.24 },
  breaker:  { hp: 85, speed: 1.1, gold: 22, dmg: 1, armor: 0, flying: false, breaker: true,  color: 0x92400e, scale: 0.42, radius: 0.34 },
  flyer:    { hp: 30, speed: 2.1, gold: 18, dmg: 1, armor: 0, flying: true,  breaker: false, color: 0x7c3aed, scale: 0.26, radius: 0.24 },
  boss:     { hp: 550, speed: 1.1, gold: 260, dmg: 6, armor: 6, slowResist: 0.6, flying: false, breaker: false, color: 0xb91c1c, scale: 0.72, radius: 0.6 },
};

// ---------------------------------------------------------------- 波次（10 波）
export const WAVES = [
  { enemies: [{ type: 'infantry', count: 8, interval: 0.9 }] },
  { enemies: [{ type: 'infantry', count: 10, interval: 0.8 }, { type: 'runner', count: 2, interval: 1.0 }] },
  { enemies: [{ type: 'infantry', count: 8, interval: 0.8 }, { type: 'runner', count: 4, interval: 0.8 }] },
  { enemies: [{ type: 'breaker', count: 4, interval: 1.4 }, { type: 'infantry', count: 8, interval: 0.7 }] },
  { enemies: [{ type: 'boss', count: 1, interval: 3 }, { type: 'infantry', count: 30, interval: 0.8 }] },
  { enemies: [{ type: 'flyer', count: 6, interval: 0.8 }, { type: 'runner', count: 6, interval: 0.7 }] },
  { enemies: [{ type: 'infantry', count: 12, interval: 0.55 }, { type: 'breaker', count: 5, interval: 1.2 }] },
  { enemies: [{ type: 'flyer', count: 8, interval: 0.7 }, { type: 'runner', count: 8, interval: 0.6 }] },
  { enemies: [{ type: 'breaker', count: 8, interval: 0.9 }, { type: 'infantry', count: 14, interval: 0.5 }] },
  { enemies: [{ type: 'boss', count: 3, interval: 2.5 }, { type: 'flyer', count: 12, interval: 0.6 }, { type: 'runner', count: 20, interval: 0.4 }] },
];

// ---------------------------------------------------------------- 经济
export const ECON = {
  startGold: 120,
  coreHp: 20,
  buildPhase: 15,
  waveBonus: (n) => 25 + n * 15,
  interestRate: 0.12,
  interestCap: 60,
  earlyStartPerSec: 2,
  sellPct: 0.5,
};

export const RATINGS = [
  { rank: 'S', minHp: 20 },
  { rank: 'A', minHp: 15 },
  { rank: 'B', minHp: 8 },
  { rank: 'C', minHp: 0 },
];

// ---------------------------------------------------------------- 相机
export const CAM = {
  dist: 13, minDist: 8, maxDist: 22,
  pitch: 0.95, minPitch: 0.45, maxPitch: 1.35,
  yaw: Math.PI * 0.28,
  rotateSpeed: 0.006,
  zoomSpeed: 1.1,
};

// ---------------------------------------------------------------- 配色（黄昏要塞）
export const PAL = {
  sky: 0x334155,
  fog: 0x334155,
  grass: 0x65a30d,
  path: 0x8b5a2b,
  rock: 0x334155,
  enemy: 0xdc2626,
  core: 0xf59e0b,
  spawn: 0xdc2626,
  grid: 0x4d7c0f,
};
