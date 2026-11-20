// NEON PINBALL · M1 数值配置（全部数值常量在这，逻辑层不写死数字）
import { WORLD } from './game.config.js';

// ---- 弹珠物理 ----
export const BALL = {
  R: 12,            // 球半径
  GRAVITY: 760,     // 重力 px/s²
  RESTITUTION: 0.72,// 墙面弹性（<1 → 能量衰减）
  AIR_DRAG: 0.35,   // 空气阻尼（1/s，速度比例衰减）
  MAX_SPEED: 1500,  // 速度钳制
  MIN_BOUNCE: 30,   // 低于此速的贴墙反弹直接静默吸收（防抖）
};

// ---- 挡板 ----
export const FLIPPER = {
  LEN: 160,
  LEFT_PX: 500, RIGHT_PX: 780, PY: 640,
  LEFT_REST: 0.70,   // rad（+40°，尖端下内，中央留 ~34px 漏球缝）
  LEFT_FLIP: -0.70,  // rad（-40°，尖端上外）
  RIGHT_REST: 2.44,  // rad（+140°，尖端下内）
  RIGHT_FLIP: 3.84,  // rad（+220°，尖端上外）
  FLIP_SPEED: 26,    // rad/s 翻转角速度
  KICK: 720,         // 基础击球冲量（px/s，沿挡板法向 + 表面速度）
  CHARGE_TIME: 0.6,  // 蓄满时长（s）
  CHARGE_BONUS: 0.7, // 满蓄力额外速度倍率
};

// ---- 推杆（发射） ----
export const LAUNCH = {
  X: 640, Y: 620,          // 待发球位（底中，挡板上方）
  MIN_SPEED: 620,          // 最小发射速度
  MAX_SPEED: 1150,         // 满蓄力发射速度
  ANGLE: -1.5708,          // 发射角（rad，-90° 直上，落回中央由挡板接住）
  CHARGE_TIME: 1.1,        // 蓄满时长
  AUTO_SEC: 3.0,           // 待发超时自动发射（noinput 基线也能推进并掉球）
};

// ---- 计分 ----
export const SCORE = {
  BUMPER: 100,
  TARGET: 150,
  SUPERCONDUCT_LIGHT: 250,
  TOP_RING: 500,
  BLACKHOLE_EJECT: 100,
  RAMP: 80,
  COMBO_WINDOW: 2.5,       // 连击窗口（s）
  COMBO_MULT_PER: 0.1,     // 乘数 = 1 + combo*0.1
  COMBO_MULT_CAP: 3,
  TARGET_MULT_CAP: 5,      // 目标灯全亮倍率上限
  SUPER_MULT: 3,           // 超导态 bumper 分 ×3
};

// ---- 超导态（signature） ----
export const SUPER = {
  LIGHTS: 3,               // 集齐 3 个超导灯
  DURATION: 20,            // 20s 超导态
};

// ---- 黑洞孔（signature） ----
export const BLACKHOLE = {
  OPEN_EVERY: 12,          // 每 12s 开一次
  OPEN_FOR: 3,             // 开 3s
  EJECT_AFTER: 5,          // 吸入 5s 后射回
  EJECT_SPEED: 720,
};

// ---- 目标灯 / 机关 ----
export const TARGET = {
  LIT_FLASH: 0.6,          // 点灯闪光时长（s，渲染用）
};

export const MAGNET = {
  R: 46,                   // 磁力区半径
  PULL: 1300,              // 磁力加速度
};

export const BUMPER = {
  R: 30,                   // bumper 半径
  KICK: 560,               // bumper 弹射冲量
};

export const RAMP = {
  RESTITUTION: 0.85,       // 坡道弹性
  KICK: 260,               // 坡道助推
};

// ---- 台面推进 ----
export const TABLE = {
  START_BALLS: 3,          // 每台起始球数
  CLEAR_BONUS_BALL: 1,     // 过关奖励球
};

// ---- 事件密度（遥测） ----
export const MILESTONE = {
  EVERY_SEC: 0.2,          // 有球在玩时每 0.2s 发一个 milestone（心跳，保证事件密度/压空转）
  SCORE_STEP: 100,         // 每 +100 分发一次 milestone
};

// ============================================================
// 纯函数（无副作用）
// ============================================================
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function comboMult(combo) {
  return Math.min(SCORE.COMBO_MULT_CAP, 1 + combo * SCORE.COMBO_MULT_PER);
}

// 超导态是否生效
export function superMult(superT) {
  return superT > 0 ? SCORE.SUPER_MULT : 1;
}
