// ELITE GUNSTRIKE · 玩法数值配置（全部数值常量都在这，逻辑层不写死数字）
// 纯函数仅供 sim/spawner/测试复用，数字全部来自下方常量。

// ---- 世界 / 玩家炮塔 ----
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const PLAYER = {
  X: 640,           // 炮塔固定横向
  Y: 648,           // 炮塔固定纵向
  RADIUS: 26,       // 受击半径（px）
  HP: 100,
  MAX_HP: 100,
  HEAL_PER_LEVEL: 40, // 每过一关回血
};

// ---- 瞄准 / 发射 ----
export const AIM = {
  DEADZONE: 24,     // 拖拽小于该距离视为取消发射（px）
};

export const BOLT = {
  RADIUS: 8,
  SPEED: 1150,      // 固定出膛速度（px/s）
  GRAVITY: 520,     // 重力（px/s^2，向下为正 y）
  RESTITUTION: 0.62,// 撞墙反弹系数
  OBST_RESTITUTION: 0.5,
  LIFE: 3.0,        // 弹体最长存活（s）
  MIN_SPEED: 130,   // 低于该速度弹体消失
  HURT_SPEED: 180,  // 低于该撞击速度不造成伤害
  LAUNCH_CD: 0.28,  // 两次发射最小间隔（s）
};

export const ENEMY_BOLT = {
  RADIUS: 7,
  SPEED: 300,       // 敌方弹速（慢，可躲）
  LIFE: 4.0,
};

// ---- 敌人（数值） ----
export const ENEMIES = {
  scout: {
    id: 'scout',
    nameKey: 'enemy.scout',
    hp: 1,
    radius: 24,
    fire: false,
    fireInterval: 0,
    bulletDamage: 0,
    score: 100,
  },
  turret: {
    id: 'turret',
    nameKey: 'enemy.turret',
    hp: 2,
    radius: 28,
    fire: true,
    fireInterval: 1.9,
    bulletDamage: 12,
    score: 150,
  },
  heavy: {
    id: 'heavy',
    nameKey: 'enemy.heavy',
    hp: 3,
    radius: 36,
    fire: true,
    fireInterval: 2.4,
    bulletDamage: 9,
    score: 250,
  },
};

// ---- 障碍物（数值） ----
export const OBSTACLES = {
  box:   { id: 'box',   hp: 2, score: 0 },
  brick: { id: 'brick', hp: 3, score: 0 },
  glass: { id: 'glass', hp: 1, score: 0, fragile: true },
  core:  { id: 'core',  hp: 1, score: 0, explosive: true },
};

export const CORE = {
  RADIUS: 120,       // 能量核心爆炸半径
  CHAIN_RADIUS: 150, // 引爆相邻核心半径
};

export const CAPTIVE = {
  RADIUS: 22,
};

// ---- 连杀计分 ----
export const COMBO = {
  WINDOW: 2.5,       // 两次击杀之间的连击窗口（s）
  MULT_PER: 0.1,
  MULT_CAP: 3.0,
};

// ---- 星级（每关按 shotsUsed 对比 par） ----
export const STAR = {
  BONUS: 500,        // 每颗星结算加分
};

// ---- 熔毁倒计时（时间压力） ----
export const MELTDOWN = {
  WARN_AT: 8,        // 剩余秒数低于该值 HUD 变红
};

// ---- 关卡切换 ----
export const LEVEL = {
  CLEAR_DELAY: 0.7,  // 过关结算停留（s）
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

export function comboMult(combo) {
  return Math.min(COMBO.MULT_CAP, 1 + combo * COMBO.MULT_PER);
}

export function enemyById(id) {
  return ENEMIES[id] || ENEMIES.scout;
}

export function obstacleById(id) {
  return OBSTACLES[id] || OBSTACLES.box;
}
