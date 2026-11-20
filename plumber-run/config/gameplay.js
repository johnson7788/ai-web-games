// PLUMBER RUN · 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/analysis.md（事件名 / 接口签名）
import { WORLD } from './game.config.js';

export const STEP = 1 / 60;

// ---- 玩家物理（px/s，固定步长 1/60） ----
export const PLAYER = {
  W: 30,             // 碰撞盒宽（small）
  H_SMALL: 34,       // 碰撞盒高（small）
  H_BIG: 56,         // 碰撞盒高（big / fire）
  ACCEL: 900,        // 地面水平加速度
  AIR_ACCEL: 700,    // 空中水平加速度
  FRICTION: 1400,    // 松手减速
  MAX_VX: 320,       // 地面最大速度
  MAX_VX_AIR: 280,   // 空中最大速度
  GRAVITY: 1700,     // 重力加速度（下落）
  GRAVITY_RISE: 2100,// 上升期重力（更重，让起跳更快收）
  JUMP_VX: 620,      // 起跳初速
  JUMP_CUT: 0.42,    // 松手速度倍率（长按高跳的核心：松开就砍垂直速度）
  COYOTE: 0.1,       // 土狼时间（离地后仍可跳）
  JUMP_BUFFER: 0.12, // 跳跃缓冲（落地前按跳仍生效）
  MAX_FALL: 900,     // 最大下落速度
  LITTLE_JUMP: 380,  // 踩怪反弹
  FIRE_HOVER_GRAV: 340, // 火力态悬停：按住跳在空中的下落重力
  FIRE_HOVER_MAX_FALL: 130,
};

// ---- 形态（小 → 大 → 火力 三态） ----
export const FORM = { SMALL: 1, BIG: 2, FIRE: 3 };

// ---- 扳手回旋（J 键） ----
export const WRENCH = {
  SPEED: 520,        // 飞出速度
  RANGE: 340,        // 最大飞行距离（短手：够不到太远的敌人）
  DAMAGE: 1,         // 命中伤害（一格敌人一扳手）
  COOLDOWN: 0.28,    // 扳手回来后到可再扔的冷却
};

// ---- 蒸汽罐 ----
export const STEAM = {
  MAX: 100,          // 满罐
  PICKUP: 25,        // 每个蒸汽罐充能
  BURST_VY: 760,     // 蒸汽喷射高跳初速
  HOVER_SEC: 1.5,    // 悬停时长
  HOVER_GRAV: 150,   // 悬停期重力
  HOVER_MAX_FALL: 90,
};

// ---- 敌人（管道怪兽：walk 类） ----
export const ENEMY = {
  W: 32,
  H: 30,
  SPEED: 80,
  STOMP_BOUNCE: 380, // 踩怪反弹
  SQUASH_MS: 320,    // 被踩后压扁动画时长
};

// ---- 金币 / 得分 ----
export const SCORE = {
  COIN: 100,
  STOMP: 200,
  POWERUP: 400,
  BRICK: 50,
  FLAG: 2000,
  TIME_BONUS_PER_SEC: 10, // 过关剩余时间每 0.1s 计分
};

// ---- 生命 / 过关 ----
export const LIFE = { START: 3, MAX: 9, INVULN_SEC: 1.6, LEVEL_TIME_LIMIT: 90 };

// ---- 3 星门槛 ----
export const STARS = {
  COIN_RATIO: 0.6,  // 收集 ≥60% 金币
  TIME_SEC: 40,     // ≤40s 过关
  NO_HIT: true,     // 无伤
};

// ---- 相机 ----
export const CAM = {
  LOOKAHEAD: 0.42,  // 玩家在屏幕上占的比例
  DEAD_ZONE: 30,
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
