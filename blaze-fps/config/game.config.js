// BLAZE FPS · 全局数值/文案配置（config-first：逻辑层不写死数字）
// 玩法：3 图 × 5 波，3 枪 12 升级，后坐力 + 爆头慢镜。
export const STEP = 1 / 60;

// ---- 语言 / 存档 ----
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'], // ja/ko/ar/ru 不做就整块不暴露
  rtlLangs: [],
  langStorageKey: 'blaze-fps-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'blaze-fps-save',
  title: 'BLAZE FPS',
};

// ---- 世界 ----
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  gravity: 0, // 地面 FPS，无跳跃；保留字段供扩展
};

// ---- 玩家 ----
export const PLAYER = {
  eyeY: 1.7,
  radius: 0.45,
  walkSpeed: 5.6,
  sprintSpeed: 8.7,
  maxHp: 100,
  regenDelay: 5, // 脱战 N 秒后开始回血
  regenPerSec: 7,
  maxEnergy: 100,
  sprintDrain: 40, // 冲刺每秒耗能
  sprintRegen: 26, // 非冲刺每秒回能
  hipFov: 70,
  aimFov: 45,
  sensitivity: 0.0024,
  pitchMin: -1.45,
  pitchMax: 1.45,
};

// ---- 枪械（3 把）----
export const WEAPONS = {
  rifle: { id: 'rifle', auto: true, mag: 30, reserve: 120, dmg: 18, rate: 10, reload: 1.6, spread: 0.011, aimSpread: 0.004, recoil: 0.016, pellets: 1, bulletSpeed: 90 },
  shotgun: { id: 'shotgun', auto: false, mag: 6, reserve: 36, dmg: 11, rate: 1.4, reload: 2.1, spread: 0.11, aimSpread: 0.07, recoil: 0.06, pellets: 8, bulletSpeed: 70 },
  pistol: { id: 'pistol', auto: false, mag: 12, reserve: Infinity, dmg: 15, rate: 6, reload: 1.2, spread: 0.02, aimSpread: 0.008, recoil: 0.017, pellets: 1, bulletSpeed: 85 },
};
export const WEAPON_ORDER = ['rifle', 'shotgun', 'pistol'];

// ---- 命中 ----
export const HEADSHOT_MULT = 2.5;
export const SLOWMO = { duration: 0.4, timeScale: 0.22 };
export const HEAD_H = 0.34; // 头顶向下 34cm 算爆头区

// ---- 敌人（4 种）----
export const ENEMIES = {
  rusher: { hp: 60, speed: 3.4, meleeDmg: 12, meleeRange: 1.7, meleeCd: 0.8, radius: 0.5, height: 1.8, color: 0xff6b35, score: 10 },
  shooter: { hp: 45, speed: 2.3, bulletDmg: 8, fireCd: 1.8, bulletSpeed: 22, preferredDist: 13, shootRange: 34, radius: 0.5, height: 1.8, color: 0xef4444, score: 15 },
  exploder: { hp: 40, speed: 4.1, fuse: 1.5, blastRadius: 4.4, blastDmg: 40, radius: 0.46, height: 1.5, color: 0xffd23f, score: 20 },
  boss: { hp: 640, speed: 2.0, meleeDmg: 26, meleeRange: 2.4, meleeCd: 1.0, chargeDmg: 34, summonCd: 6, radius: 1.05, height: 2.8, color: 0x9b2c2c, score: 100 },
};

// ---- 波次（每图 5 波，第 5 波出 Boss）----
export const WAVES = [
  { rusher: 3 },
  { rusher: 3, shooter: 2 },
  { rusher: 2, shooter: 2, exploder: 1 },
  { rusher: 3, shooter: 2, exploder: 2 },
  { rusher: 2, shooter: 2, exploder: 1, boss: 1 },
];
export const MAPS_PER_RUN = 3;
export const WAVES_PER_MAP = 5;
export const HP_SCALE = [1.0, 1.35, 1.75]; // 每图血量倍率
export const COUNT_SCALE = [1.0, 1.15, 1.3]; // 每图数量倍率

// ---- 地图（程序化低多边形几何 + 布局）----
// size = 半边长（竞技场从 -size..size），obstacles = 掩体 AABB {x,z,w,d,h}
export const MAPS = [
  {
    id: 'warehouse', size: 17, wallH: 3.2, fog: 0x1c232d, fogFar: 90,
    floor: 0x525e6c, wall: 0x4d5968, accent: 0xff6b35,
    obstacles: [
      { x: -4, z: -5, w: 2.4, d: 2.4, h: 2.4 },
      { x: 5, z: -6, w: 2.4, d: 2.4, h: 2.4 },
      { x: 0, z: 3, w: 3.0, d: 1.6, h: 1.8 },
      { x: -7, z: 2, w: 1.8, d: 1.8, h: 2.2 },
      { x: 7, z: 1, w: 1.8, d: 1.8, h: 2.2 },
      { x: -2, z: -8, w: 4.0, d: 1.2, h: 1.5 },
    ],
  },
  {
    id: 'subway', size: 15, wallH: 3.8, fog: 0x1c232d, fogFar: 80,
    floor: 0x55606c, wall: 0x414d5c, accent: 0x4a5d43,
    obstacles: [
      { x: 0, z: 0, w: 1.2, d: 1.2, h: 3.4 }, // 中央立柱
      { x: -5, z: -4, w: 1.2, d: 1.2, h: 3.4 },
      { x: 5, z: -4, w: 1.2, d: 1.2, h: 3.4 },
      { x: -3, z: 4, w: 2.6, d: 1.0, h: 1.1 },
      { x: 3, z: 4, w: 2.6, d: 1.0, h: 1.1 },
      { x: 0, z: -7, w: 4.0, d: 1.0, h: 1.2 },
    ],
  },
  {
    id: 'rooftop', size: 20, wallH: 1.1, fog: 0x1c232d, fogFar: 120,
    floor: 0x4a5664, wall: 0x4a5668, accent: 0xef4444,
    obstacles: [
      { x: -6, z: -5, w: 2.2, d: 2.2, h: 2.0 },
      { x: 6, z: -5, w: 2.2, d: 2.2, h: 2.0 },
      { x: 0, z: -8, w: 3.0, d: 1.4, h: 1.6 },
      { x: -9, z: 3, w: 1.6, d: 1.6, h: 2.6 },
      { x: 9, z: 3, w: 1.6, d: 1.6, h: 2.6 },
      { x: 0, z: 6, w: 5.0, d: 1.2, h: 0.9 },
    ],
  },
];

// ---- 升级（12：6 规则 + 6 数值）----
// kind: rule | stat；effect: mul 倍率 / add 加值
export const UPGRADES = [
  { id: 'pierce', kind: 'rule' },
  { id: 'explosive-rounds', kind: 'rule' },
  { id: 'vampire', kind: 'rule' },
  { id: 'headshot-slowmo', kind: 'rule' },
  { id: 'dash-blast', kind: 'rule' },
  { id: 'ricochet', kind: 'rule' },
  { id: 'dmg10', kind: 'stat', mul: { dmg: 1.12 } },
  { id: 'ammo-cap', kind: 'stat', mul: { reserve: 1.45 } },
  { id: 'reload-speed', kind: 'stat', mul: { reload: 0.68 } },
  { id: 'hp10', kind: 'stat', add: { maxHp: 12 } },
  { id: 'move-speed', kind: 'stat', mul: { speed: 1.12 } },
  { id: 'energy-regen', kind: 'stat', mul: { sprintRegen: 1.6 } },
];

// ---- 颜色 / 观感 ----
export const COLORS = {
  bg: 0x14181f,
  orange: 0xff6b35,
  green: 0x4a5d43,
  red: 0xef4444,
  playerWeapon: 0x7a8a99,
};

// ---- 评级（结算）----
export function ratingOf(stats, time, deaths) {
  const acc = stats.shots ? stats.hits / stats.shots : 0;
  const hs = stats.shots ? stats.headshots / stats.shots : 0;
  let score = 0;
  if (acc >= 0.4) score += 1;
  if (hs >= 0.12) score += 1;
  if (deaths === 0) score += 1;
  if (time < 300) score += 1;
  return score >= 4 ? 'S' : score === 3 ? 'A' : score === 2 ? 'B' : 'C';
}
