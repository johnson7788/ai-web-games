// GUN LEGEND · M1 数值配置（全部数值常量都在这，逻辑层不写死数字）
// 纯函数仅供 sim/spawner/测试复用，数字全部来自下方常量。

// ---- 世界 / 玩家 ----
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const PLAYER = {
  X: 640,           // 玩家固定横向基准（翻滚会临时偏移）
  Y: 560,           // 玩家固定纵向
  RADIUS: 22,       // 受击半径（px）
  HP: 100,          // 初始血量
  MAX_HP: 100,
  ROLL_DIST: 120,   // 翻滚横向位移（px）
  ROLL_TIME: 0.22,  // 翻滚位移时长（s）
  ROLL_INVULN: 0.5, // 翻滚无敌时长（s）
  ROLL_CD: 3.0,     // 翻滚冷却（s）
  ROLL_MIN_X: 90,   // 翻滚后 x 下限
  ROLL_MAX_X: 1190, // 翻滚后 x 上限
  HEAL_PER_ROUND: 30, // 每过一关回血
};

// ---- 瞄准 ----
export const AIM = {
  DEFAULT_X: 640,
  DEFAULT_Y: 140,
  RANGE: 900, // 子弹最大射程
};

// ---- 玩家子弹 ----
export const BULLET = {
  RADIUS: 4,
};

// ---- 武器（双枪各持一把；magSize 是单枪弹匣） ----
export const WEAPONS = {
  revolver: {
    id: 'revolver',
    nameKey: 'weapon.revolver',
    magSize: 6,          // 单枪 6 发
    fireInterval: 0.28,  // 每发间隔（s）
    pellets: 1,
    spreadRad: 0.02,     // 扩散（弧度）
    damage: 34,
    reloadSec: 1.3,
    bulletSpeed: 1000,
  },
  shotgun: {
    id: 'shotgun',
    nameKey: 'weapon.shotgun',
    magSize: 2,          // 单枪 2 发（双管喷）
    fireInterval: 0.6,
    pellets: 5,
    spreadRad: 0.30,
    damage: 16,          // 每颗弹丸
    reloadSec: 1.6,
    bulletSpeed: 880,
  },
  smg: {
    id: 'smg',
    nameKey: 'weapon.smg',
    magSize: 30,         // 单枪 30 发
    fireInterval: 0.09,
    pellets: 1,
    spreadRad: 0.09,
    damage: 9,
    reloadSec: 1.9,
    bulletSpeed: 1150,
  },
};

// ---- 换弹舞（节奏博弈） ----
export const RELOAD = {
  DANCE_FRACTION: 0.3, // 最后 30% 为 sweet spot
  AUTO_DELAY: 0.35,    // 双枪打空后自动进入换弹的延迟（s）
};

// ---- 白鸽时刻（吴宇森签名） ----
export const DOVE = {
  SLOWMO_SEC: 1.5,     // 慢动作时长
  TIMESCALE: 0.35,     // 慢动作倍率
  COMBO_BONUS: 3,      // 连击 +3
  SCORE_BONUS: 300,
};

// ---- 连杀计分 ----
export const COMBO = {
  WINDOW: 2.5,         // 两次击杀之间的连击窗口（s）
  MULT_PER: 0.1,
  MULT_CAP: 3.0,
};

// ---- 敌人（数值） ----
export const ENEMY = {
  knife: {
    id: 'knife',
    nameKey: 'enemy.knife',
    hp: 40,
    speed: 120,          // 接近速度 px/s
    radius: 16,
    meleeRange: 40,      // 近战判定距离
    meleeDamage: 14,
    meleeInterval: 0.9,  // 近战间隔
    score: 100,
  },
  gunner: {
    id: 'gunner',
    nameKey: 'enemy.gunner',
    hp: 60,
    speed: 70,
    radius: 16,
    holdRange: 320,      // 停在玩家附近该距离
    fireInterval: 1.7,
    bulletSpeed: 340,
    bulletDamage: 11,
    score: 150,
  },
  grenadier: {
    id: 'grenadier',
    nameKey: 'enemy.grenadier',
    hp: 70,
    speed: 55,
    radius: 17,
    holdRange: 260,
    throwInterval: 2.6,
    fuseSec: 1.1,        // 手雷引信
    grenadeSpeed: 260,   // 手雷飞行速度
    explosionRadius: 90,
    explosionDamage: 24,
    score: 200,
  },
  elite: {
    id: 'elite',
    nameKey: 'enemy.elite',
    hp: 130,
    speed: 95,
    radius: 18,
    holdRange: 300,
    fireInterval: 0.85,
    bulletSpeed: 400,
    bulletDamage: 9,
    score: 300,
  },
  boss: {
    id: 'boss',
    nameKey: 'enemy.boss',
    hp: 700,
    speed: 55,
    radius: 34,
    holdRange: 380,
    fireInterval: 1.4,
    bulletSpeed: 360,
    bulletDamage: 13,
    volley: 5,           // 一次齐射弹数
    score: 1000,
  },
};

// ---- 敌人子弹 / 手雷 ----
export const ENEMY_BULLET = {
  RADIUS: 5,
};

export const GRENADE = {
  RADIUS: 7,
};

// ---- 波次 ----
export const WAVE = {
  FIRST_DELAY: 0.5,   // 开局第一波延迟（s）
  CLEAR_DELAY: 1.1,   // 波次清空后下一波延迟（s）
};

// ---- 关卡切换 ----
export const ROUND = {
  CLEAR_DELAY: 2.0,   // 过关后进入下一关的延迟（s）
  INTERMISSION: 1.6,  // 幕卡停留
};

// ---- nearMiss（子弹擦身） ----
export const NEAR_MISS = {
  GAP: 26,            // 子弹与玩家最近距离 < 26px 且未命中
  THROTTLE: 1.5,      // 节流
};

// ============================================================
// 纯函数（无副作用）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 连击乘数 = 1 + combo*0.1（cap ×3）
export function comboMult(combo) {
  return Math.min(COMBO.MULT_CAP, 1 + combo * COMBO.MULT_PER);
}

export function weaponById(id) {
  return WEAPONS[id] || WEAPONS.revolver;
}

export function enemyById(id) {
  return ENEMY[id] || ENEMY.knife;
}
