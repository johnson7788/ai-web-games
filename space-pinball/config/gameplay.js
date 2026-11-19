// SPACE PINBALL · 数值配置（全部数值常量在这，逻辑层不写死数字）
import { WORLD } from './game.config.js';

// ---- 弹珠物理 ----
export const BALL = {
  R: 12,            // 球半径
  GRAVITY: 760,     // 重力 px/s²
  RESTITUTION: 0.72,// 墙面弹性（<1 → 能量衰减）
  AIR_DRAG: 0.35,   // 空气阻尼（1/s）
  MAX_SPEED: 1500,  // 速度钳制
  MIN_BOUNCE: 30,   // 低于此速的贴墙反弹静默吸收（防抖）
};

// ---- 挡板 ----
export const FLIPPER = {
  LEN: 150,
  LEFT_PX: 505, RIGHT_PX: 775, PY: 640,
  LEFT_REST: 0.62,   // rad（尖端下内，中央留漏球缝）
  LEFT_FLIP: -0.62,  // rad（尖端上外）
  RIGHT_REST: 2.52,  // rad
  RIGHT_FLIP: 3.76,  // rad
  FLIP_SPEED: 26,    // rad/s
  KICK: 700,         // 击球冲量
  CHARGE_TIME: 0.6,  // 蓄满时长
  CHARGE_BONUS: 0.7, // 满蓄力额外倍率
};

// ---- 推杆（发射弹簧）----
export const LAUNCH = {
  X: 640, Y: 620,
  MIN_SPEED: 620,
  MAX_SPEED: 1150,
  ANGLE: -Math.PI / 2, // 直上
  CHARGE_TIME: 0.7,    // 满蓄力时长（对应原版 maxAccTime 0.7s）
  AUTO_SEC: 3.0,       // 待发超时自动发射（noinput 也能推进并掉球）
};

// ---- 反应堆核心（原版中央圆，碰撞加速 + 点灯）----
export const REACTOR = {
  LIGHTS: 4,           // 集满 4 盏灯触发超载（波次 +1）
  R: 46,
  SPEEDUP: 1.25,       // 每次命中球速 ×
  GRAV_UP: 1.15,       // 每次命中重力 ×
  GRAV_CAP: 1.9,       // 重力上限
  HIT_SCORE: 200,      // 每次命中得分
  OVERDRIVE_BONUS: 2000,// 超载大奖
};

// ---- 等离子球 bumper（原版 CircleTrampoline）----
export const BUMPER = { R: 30, KICK: 560, SCORE: 100 };

// ---- 偏转板（原版 RectTrampoline）----
export const DEFLECTOR = { POWER: 520, SCORE: 80 };

// ---- 发射台（原版 ShootTrampoline：球静置后发射）----
export const LAUNCHPAD = {
  POWER: 820,
  REST_TIME: 1.1,
  RANDOM: 80,
  SCORE: 120,
};

// ---- 黑洞（原版 BlackHole：吸入 → 延迟喷出）----
export const BLACKHOLE = {
  R: 26,
  CAPTURE_TIME: 0.8,   // 吸入后 0.8s 喷出
  EJECT_POWER: 760,
  SCORE: 100,
};

// ---- 虫洞传送门（原版 PotalEntrance）----
export const PORTAL = { R: 20, SCORE: 90 };

// ---- 按钮组（原版 ButtonBonusGroup：全按下 → 大奖）----
export const BUTTON = { R: 20, COUNT: 3, JACKPOT: 7500, SCORE: 120 };

// ---- 通道组（原版 ChannelBonusGroup：全翻转 → 大奖）----
export const GATE = { R: 18, COUNT: 3, JACKPOT: 10000, SCORE: 150 };

// ---- 可升级碎片（原版 UpgradableBonus：命中按 level 给分 + 升级垫）----
export const SHARD = {
  LEVELS: [100, 200, 300, 400, 500, 800, 1200, 1500, 1800],
  UPGRADER_BONUS: 150,
  UPGRADER_COUNT: 3,
};

// ---- 小行星岩石（新机制：可破坏障碍，3 HP）----
export const ASTEROID = {
  R: 26,
  HP: 3,
  COUNT: 3,
  HIT_SCORE: 120,
  DESTROY_SCORE: 600,
  CLEAR_SCORE: 1500,
  HIT_COOLDOWN: 0.25,
};

// ---- 星核收集（新机制：集齐 3 颗 → 超新星 10s 双倍分）----
export const STAR = { R: 16, COUNT: 3, COLLECT_SCORE: 250 };

// ---- 超新星态 ----
export const SUPERNOVA = { DURATION: 10, MULT: 2 };

// ---- 连击 ----
export const SCORE = {
  COMBO_WINDOW: 2.5,       // 连击窗口（s）
  COMBO_MULT_PER: 0.25,    // 乘数 = 1 + combo*0.25
  COMBO_MULT_CAP: 3,       // 连击倍率上限
};

// ---- 星级评级（结算）----
export const RATING = { THREE_STAR: 12000, TWO_STAR: 5000 };

// ---- 每局球数 ----
export const TABLE = { START_BALLS: 3 };

// ---- 事件密度（遥测心跳）----
export const MILESTONE = {
  EVERY_SEC: 0.2,
  SCORE_STEP: 250,
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

export function superMult(superT) {
  return superT > 0 ? SUPERNOVA.MULT : 1;
}

export function starRating(score) {
  if (score >= RATING.THREE_STAR) return 3;
  if (score >= RATING.TWO_STAR) return 2;
  return 1;
}
