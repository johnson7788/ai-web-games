// FOOD CHAIN · M1 数值配置（全部数值常量都在这，逻辑不写死数字）
// 12 阶段 / 生态见 config/stages.js

// ---- 世界 / 坐标 ----
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  MARGIN: 40, // 实体生成/移动的边界内缩（px）
};

export const STEP = 1 / 60;

// ---- 玩家 ----
export const PLAYER = {
  BASE_SPEED: 430,   // 阶段 0 移动速度（px/s）
  SPEED_DECAY: 0.024, // 每阶段速度衰减：speed = BASE_SPEED * (1 - stage*DECAY)
  MIN_SPEED: 250,
  LERP: 6,           // 位置缓动追踪系数（1/s）：vx = (tx-x)*LERP，封顶 maxSpeed
  MASS_START: 0,
};

// ---- 浮游食物 ----
export const FOOD = {
  COUNT: 72,          // 场上目标食物数（持续补充）
  R: 4,               // 食物粒子半径
  MASS: 1,            // 每颗食物质量
  DRIFT: 14,          // 漂移速度（px/s）
};

// ---- 鱼（猎物 / 同级 / 捕食者 / 毒刺鱼）----
export const FISH = {
  COUNT: 16,          // 场上目标鱼数（持续补充）
  EAT_RATIO: 1.0,     // 可吞判定：fish.r <= player.r * EAT_RATIO（= 同级或更小）
  EAT_DIST_MUL: 0.3,  // 吞鱼判定：dist < player.r + fish.r * EAT_DIST_MUL
  DEATH_DIST_MUL: 0.72, // 大鱼致死：dist < (player.r + fish.r) * DEATH_DIST_MUL
  BASE_SPEED: 170,    // 鱼基础速度
  FLEE_RANGE: 260,    // 更小的鱼逃逸触发距离
  CHASE_RANGE: 320,   // 更大的鱼追猎触发距离
  WANDER_CHANGE: 2.2, // 漫游换向间隔（s）
};

// ---- 毒刺鱼（能吃≠该吃）----
export const TOXIC = {
  MASS_LOSS: 22,      // 吞掉毒刺鱼损失的质量
  PULSE: 0.9,         // 毒刺鱼高亮脉冲周期（s）
};

// ---- 共生 / 水母 / 护体毒刺 ----
export const SYMBIOSE = {
  RADIUS: 96,         // 贴近水母判定半径
  SEC: 3.0,           // 需要持续贴近的秒数
  STING_SEC: 8.0,     // 护体毒刺持续时间
  STING_RATIO: 1.42,  // 有毒刺时可吃大一级：fish.r <= player.r * STING_RATIO
  PROGRESS_PULSE: 0.2, // 蓄能期间每 0.2s 发一次进度事件（遥测密度）
};

// ---- nearMiss（差一点）----
export const NEAR_MISS = {
  GAP: 28,            // 与大鱼水平擦肩 <GAP 且未死
  BONUS_MASS: 2,      // 擦肩奖励质量
  THROTTLE: 1.6,      // 节流（s）
};

// ---- 暗流区（热泉带）----
export const CURRENT = {
  Y1: 300,            // 暗流带上边界
  Y2: 430,            // 暗流带下边界
  VX: 170,            // 暗流横推速度（px/s）
};

// ---- 得分 ----
export const SCORE = {
  FOOD: 1,            // 每颗食物
  PREY_PER_MASS: 2,   // 每点鱼质量转化分
  EVOLVE: 25,         // 每次进化奖励分
  LIGHT_CHAIN: 40,    // 吞噬同级奖励分
  STING_USE: 30,      // 毒刺吞大一级奖励分
};

// ============================================================
// 纯函数（无副作用，供 sim/spawner 复用；数字全部来自上面的常量）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 玩家移动速度：阶段越高越慢（体型越大越笨重），但不低于 MIN_SPEED
export function playerSpeedAt(stage) {
  return Math.max(PLAYER.MIN_SPEED, PLAYER.BASE_SPEED * (1 - stage * PLAYER.SPEED_DECAY));
}
