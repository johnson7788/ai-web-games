// ALIEN SIEGE · 玩法数值配置（全部数值都在这，逻辑不写死数字）
// 契约：docs/analysis.md（事件名/字段一字不差）

export const STEP = 1 / 60; // 固定步长（秒）

// ---- 玩家 ----
export const PLAYER = {
  HP: 100,
  RADIUS: 0.28,       // 碰撞半径（世界单位）
  MOVE_SPEED: 4.4,    // 前后/左右平移速度（单位/s）
  TURN_SPEED: 3.4,    // 转向速度（弧度/s）
  SHIELD_SLOW: 0.6,   // 护盾开启时移动速度倍率（-40%）
  SHIELD_ENERGY: 100, // 护盾能量上限
  SHIELD_DRAIN: 13,   // 护盾开启持续耗能（/s）
  SHIELD_RECHARGE: 8, // 护盾未开启回能（/s）
  MARK_COOLDOWN: 3.0, // 镭射标记冷却（s）
  MARK_DURATION: 5.0, // 标记持续（s）
  MARK_MULT: 1.5,     // 被标记敌人受伤害倍率
  REGEN_PER_SEC: 1.2, // 波间回血（/s，波内不回）
  REGEN_DELAY: 2.5,   // 上次受击后多久开始回血（s）
};

// ---- 武器（unlockWave = 该波开局解锁并自动装备） ----
export const WEAPONS = {
  pistol:  { name: 'weapon.pistol',  damage: 12, fireRate: 0.42, magSize: 12, reloadSec: 1.1, spread: 0.030, range: 30, pellets: 1, auto: false, unlockWave: 1 },
  rifle:   { name: 'weapon.rifle',   damage: 9,  fireRate: 0.11, magSize: 30, reloadSec: 1.5, spread: 0.020, range: 42, pellets: 1, auto: true,  unlockWave: 3 },
  shotgun: { name: 'weapon.shotgun', damage: 7,  fireRate: 0.75, magSize: 6,  reloadSec: 2.0, spread: 0.160, range: 14, pellets: 5, auto: false, unlockWave: 6 },
  laser:   { name: 'weapon.laser',   damage: 26, fireRate: 0.50, magSize: 14, reloadSec: 1.8, spread: 0.005, range: 60, pellets: 1, auto: false, unlockWave: 9 },
};

export const WEAPON_UNLOCK_ORDER = ['pistol', 'rifle', 'shotgun', 'laser'];

// ---- 敌型 ----
export const ENEMIES = {
  crawler:  { hp: 18,  speed: 2.3, radius: 0.26, damage: 8,  attackRange: 0.95, attackCooldown: 1.0, drift: 0.0,  score: 100 },
  floater:  { hp: 30,  speed: 1.6, radius: 0.34, damage: 10, attackRange: 1.35, attackCooldown: 1.3, drift: 1.7,  score: 150 },
  behemoth: { hp: 95,  speed: 0.9, radius: 0.52, damage: 22, attackRange: 1.30, attackCooldown: 1.6, drift: 0.0,  score: 300 },
  nest:     { hp: 420, speed: 0.0, radius: 0.95, damage: 18, attackRange: 2.30, attackCooldown: 2.0, drift: 0.0,  score: 1500, spawnMinions: true },
};

// ---- 波次节奏 ----
export const WAVE = {
  COUNT: 12,
  SPAWN_RING: 4.0,      // 敌人出生环（距场地中心半径，世界单位）
  SPAWN_JITTER: 1.5,
  CLEAR_DELAY: 1.6,     // 清波后到下一波的间隔（s）
  FIRST_DELAY: 0.8,     // 开局到第一波敌人的间隔（s）
  NEST_SPAWN_INTERVAL: 3.2, // 母巢召唤爬行者间隔（s）
  NEST_SPAWN_MAX: 2,    // 母巢每次召唤数量
};

// ---- 场地 ----
export const ARENA = {
  GRID: 24,             // 24×24 格
  SPAWN_X: 12.5,        // 玩家出生（格坐标）
  SPAWN_Y: 12.5,
  SPAWN_ANGLE: 0,       // 出生朝向（rad）
};

// ---- 命中 / 事件节流 ----
export const HIT = {
  MARK_ANGLE: 0.30,     // 标记判定锥半角（rad）
  MARK_RANGE: 40,       // 标记射程
  NEAR_MISS_DIST: 1.1,  // 敌人逼近到该距离且未攻击 = 擦肩（s）
  NEAR_MISS_THROTTLE: 2.0,
  HEARTBEAT_SEC: 1.0,   // 细粒度里程碑事件间隔（保证反馈密度）
};

// ---- 视觉 / 手感 ----
export const FX = {
  SPLAT_RANGE: 6.0,     // 霰弹枪近距离紫浆判定距离
  MUZZLE_MS: 60,        // 枪口焰时长
  SCREEN_SHAKE_HIT: 2,  // 受击震屏强度（px）
  SCREEN_SHAKE_KILL: 3,
};

// ============================================================
// 纯函数（无副作用，供 sim/render 复用）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 归一化角度到 [-π, π]
export function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// 波次 → 场景包（1..3）
export function sceneOfWave(wave) {
  return wave <= 4 ? 1 : wave <= 8 ? 2 : 3;
}
