// config/game.config.js — 全局数值配置（唯一数值真相；src/game 纯逻辑只读这里）
// 世界单位：米；重力向下；玩家在 -x，对手在 +x；z 为左右横移轴。

export const STEP = 1 / 60;

export const WORLD = {
  WIDTH: 1280,          // 逻辑视口宽（letterbox）
  HEIGHT: 720,          // 逻辑视口高
  GRAVITY: -9.82,       // m/s^2 向下
  PLAYER_X: -6,
  ENEMY_X: 6,
  ARENA_Z: 4,           // 横移半宽
  CAMERA: { pos: [-1, 3.6, 10.5], look: [-1, 1.05, 0] },
};

export const PLAYER = {
  hearts: 3,
  zSpeed: 2.4,          // 横移速度 m/s
  zRange: 3.2,
  bowX: 0.35,           // 弓口相对玩家 x 偏移
  bowY: 1.25,           // 弓口高度
  hitHeadR: 0.28,       // 玩家头部命中半径
  hitTorsoHalf: 0.36,   // 玩家躯干命中半宽/半高
  hitTorsoY: 1.05,
  invulnSec: 1.2,       // 被击倒后无敌时间
};

export const RAG = {
  // 布偶部件尺寸 / 质量（对手 ragdoll）
  torso: { w: 0.56, h: 0.66, d: 0.3, mass: 2.4, y: 1.06 },
  head: { r: 0.22, mass: 1.1, y: 1.74 },
  arm: { w: 0.15, h: 0.5, d: 0.15, mass: 0.6, offZ: 0.34, y: 1.3 },
  leg: { w: 0.17, h: 0.55, d: 0.17, mass: 0.8, offZ: 0.15, y: 0.5 },
  damping: 0.35,
  angularDamping: 0.55,
  collapseSpeed: 5.5,   // 击杀时向后飞出的速度
  collapseUp: 3.2,      // 击杀时向上速度
};

export const ARROW = {
  length: 0.7,
  radius: 0.035,
  mass: 0.12,
  maxSpeed: 26,         // 满弓初速 m/s
  minPower: 0.18,
  maxPower: 1,
  maxAngle: 1.35,       // 最大仰角 rad（~77°）
  minAngle: 0.04,
  windScale: 1.6,       // 风强 -> 水平加速度 (m/s^2)
  gravity: -9.82,
};

export const QUIVER = { max: 5, regenSec: 4 };

export const WIND = { gustIntervalSec: 2.4, max: 4.5 };

export const SLOWMO = { killSec: 0.8, timeScale: 0.25 };

// 5 关：每关一个新元素（平地 → 风 → 木箱掩体 → 高台对手 → 双对手）
// accuracy：对手 AI 命中率（准确瞄准的比例），随关卡递增；误射会打偏（短/侧/高）。
export const LEVELS = [
  { index: 1, enemies: 1, wind: 0, crates: 0, platform: 0, accuracy: 0.14, enemyFireSec: 2.6 },
  { index: 2, enemies: 1, wind: 3.0, crates: 0, platform: 0, accuracy: 0.22, enemyFireSec: 2.3 },
  { index: 3, enemies: 1, wind: 0, crates: 1, platform: 0, accuracy: 0.30, enemyFireSec: 2.0 },
  { index: 4, enemies: 1, wind: 2.0, crates: 0, platform: 1, accuracy: 0.40, enemyFireSec: 1.8 },
  { index: 5, enemies: 2, wind: 2.0, crates: 0, platform: 0, accuracy: 0.50, enemyFireSec: 1.6 },
];

export const ENEMY = {
  torsoHitsToKill: 2,   // 躯干命中致死数
  disarmSec: 2.2,       // 四肢命中使对手掉弓时长
  aimWindFactor: 0.5,   // 对手 AI 对风的补偿系数
};

// 升级（≥8 个；kind: rule | stat）
export const UPGRADES = [
  { id: 'piercing-arrow', kind: 'rule' },
  { id: 'split-shot', kind: 'rule' },
  { id: 'slowmo-aim', kind: 'rule' },
  { id: 'wind-reader', kind: 'rule' },
  { id: 'quiver-cycle', kind: 'rule' },
  { id: 'draw-speed', kind: 'stat' },
  { id: 'arrow-dmg', kind: 'stat' },
  { id: 'move-speed', kind: 'stat' },
];

export const COLORS = {
  arenaSand: 0xd9b26f,
  burlap: 0xc9a27e,
  playerBlue: 0x3b82f6,
  enemyRed: 0xef4444,
  skyTop: 0x6f9cd9,
  skyBottom: 0xd9b26f,
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 未翻译整块不暴露
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'ragdoll-archers-3d-lang',
  langNames: { en: 'English', zh: '中文' },
  title: 'RAGDOLL ARCHERS 3D',
};
