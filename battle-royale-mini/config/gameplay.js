// 玩法数值（M1）：武器 / 缩圈 / AI / 物资 / 背包。
// 逻辑层一律读这里，不写死数字。

export const ARENA = {
  // 可玩区 = 全屏 1280×720 减边框
  minX: 28,
  maxX: 1252,
  minY: 28,
  maxY: 692,
};

// 武器（数值取自原作 weapon.json，速度/射程按 1280 屏幕缩放）
export const WEAPONS = [
  { id: 'shotgun', name: 'Shotgun', clip: 8,  speed: 760, range: 300, shootDelay: 1.5, reloadDelay: 1.5, power: 15, pellets: 3 },
  { id: 'machine', name: 'Machine Gun', clip: 30, speed: 1100, range: 300, shootDelay: 0.22, reloadDelay: 1.5, power: 5, pellets: 1 },
  { id: 'rocket',  name: 'Rocket',  clip: 5,  speed: 1180, range: 290, shootDelay: 2.0, reloadDelay: 1.5, power: 25, pellets: 1, explosive: 90 },
  { id: 'pistol',  name: 'Pistol',  clip: 15, speed: 760, range: 380, shootDelay: 1.0, reloadDelay: 1.5, power: 8,  pellets: 1 },
  { id: 'ak',      name: 'AK-47',   clip: 35, speed: 1100, range: 300, shootDelay: 0.3, reloadDelay: 1.5, power: 5,  pellets: 1 },
  { id: 'kar',     name: 'Kar98K',  clip: 15, speed: 1180, range: 290, shootDelay: 1.5, reloadDelay: 1.5, power: 20, pellets: 1 },
];
export const weaponById = (id) => WEAPONS.find((w) => w.id === id) || null;

export const PLAYER = {
  radius: 13,
  hp: 130,
  damageMul: 1.25,     // 玩家对 AI 的伤害加成（AI 更笨，玩家拿数值优势）
  speed: 170,          // px/s
  stealthSpeedMul: 1.30, // 静步（不射击）移速 +30%
  gunLoudRadius: 220,    // 枪声吸引 AI 的半径
  regen: 4,              // 脱战 4s 后每秒回血（原作 recovery 机制）
  regenDelaySec: 4,
};

export const ENEMY = {
  radius: 13,
  hp: 70,               // AI 略脆，加快单局节奏
  speed: 150,
  aimInterval: 0.18,    // AI 索敌频率
  aggroRangeMul: 1.4,   // 索敌 = range * 1.4
  gunLoudRadius: 200,
  // 每场 AI 强度递增（0-based match index）
  strengthByMatch: [1.0, 1.0, 1.05, 1.05, 1.1, 1.1, 1.15, 1.15, 1.2, 1.2, 1.25, 1.25],
};

export const GAS = {
  startRadius: 640,
  phases: [620, 500, 400, 310, 230, 160, 100, 52],  // 每轮目标半径（最终 52 = 决胜圈）
  warnSec: 12,          // 画圈预警时长
  shrinkSpeed: 55,      // 缩圈 px/s
  dps: 9,               // 圈外掉血（原 10/s，稍缓）
  tickInterval: 0.5,    // 掉血 tick
};

export const LOOT = {
  weapons: ['shotgun', 'machine', 'rocket', 'pistol', 'ak', 'kar'],
  weaponCount: 14,        // 地面武器数量
  medCount: 8,
  armorCount: 8,
  medHeal: 40,
  armorReduce: 0.20,      // 减伤 20%
  pickupRadius: 18,
  bagSlots: 2,            // 背包 2 格（医疗/护甲，不含枪）
};

export const BULLET = {
  radius: 3,
  // 命中判定：子弹头矩形 + 半径近似
};

export const MATCHES = 12;

export const BOT = {
  inputLatencyMs: 90,
};

export function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
