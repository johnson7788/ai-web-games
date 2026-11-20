// SAUCER STRIKE · 玩法数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/analysis.md（规则还原）+ 事件表（src/game/sim.js 注释）

import { WORLD } from './game.config.js';

export { WORLD };
export const STEP = 1 / 60;

// ---- 炮台 / 蓄力 ----
export const GUN = {
  MUZZLE_X: WORLD.CANNON_X,
  MUZZLE_Y: WORLD.CANNON_Y,
  MAX_POWER_DIST: 360,      // 拖拽 360px = 满力度（shoot 的 /200 手感放大到 360）
  MIN_SPEED: 460,           // 最低弹速 px/s
  MAX_SPEED: 1500,          // 满蓄弹速 px/s
  BASE_DAMAGE: 1,           // 基础伤害（乘碟型 hp）
  POWER_DAMAGE_BONUS: 1.0,  // 满蓄额外 +1 伤害
  OVERHEAT_THRESHOLD: 0.92, // 力度 ≥ 此值发射 → 过热锁炮
  OVERHEAT_LOCK_SEC: 2.0,   // 过热锁炮时长
  COOLDOWN_SEC: 0.16,       // 发射冷却（防一帧多弹）
  CHARGE_LERP: 24,          // 力度指针追踪速率（1/s）
};

// ---- 生命 / 计分 ----
export const PLAYER = {
  START_LIVES: 3,
  MAX_LIVES: 6,
};

// ---- 连击 ----
export const COMBO = {
  WINDOW: 3.0,             // 命中后 3s 内再命中 +1
  MULT_PER: 0.1,           // 乘数 = 1 + combo*0.1
  MULT_CAP: 3.0,
};

// ---- 曳光弹 ----
export const TRACER = {
  PER_WAVE: 1,             // 每波 1 发
  REVEAL_SEC: 3.0,         // 显形时长
  HOMING_SPEED: 1800,      // 曳光弹自寻的飞行速度
};

// ---- 近失 ----
export const NEAR_MISS = {
  GAP: 26,                 // 弹与碟中心距 < 26px 且未命中 = 近失
  THROTTLE: 1.2,           // 节流 1.2s
  BONUS: 25,               // 近失加分
};

// ---- 炮弹 ----
export const PROJ = {
  RADIUS: 5,
  LIFE: 3.0,
  MAGNET_TURN: 4.0,        // 追踪升级的转向速率（rad/s）
  SPLIT_SPEED: 900,
};

// ---- 流星雨干扰 ----
export const METEOR = {
  SPEED: 260,              // 下落速度 px/s
  RADIUS: 14,
  INTERVAL_SEC: 0.9,       // 干扰波内生成间隔
};

// ---- 碟生成 ----
export const SPAWN = {
  STAGGER_SEC: 0.7,        // 同波内碟错峰入场间隔
  ESCAPE_MARGIN: 80,       // 超出边界多少算逃逸（安全兜底）
};

// ---- 升级 ----
export const UPGRADES = {
  // id -> 规则修改器（sim 读取）
  coolant:    { kind: 'rule', overheatLockSec: 1.0 },
  pierce:     { kind: 'rule', pierce: 1 },
  tracerPlus: { kind: 'rule', tracerPerWave: 2, tracerRevealSec: 6.0 },
  split:      { kind: 'rule', split: 2 },
  overcharge: { kind: 'rule', powerDamageBonus: 1.5, overheatThreshold: 0.8 },
  radar:      { kind: 'rule', invisibleFlickerMult: 2 },
  comboBank:  { kind: 'rule', shieldOnCombo: 5 },
  magnet:     { kind: 'rule', magnet: 1 },
  rapid:      { kind: 'stat', cooldownMult: 0.8 },
  damage:     { kind: 'stat', damageMult: 1.25 },
  lives:      { kind: 'stat', extraLives: 1 },
  coolRate:   { kind: 'stat', coolMult: 1.3 },
};

// 每波清空后 3 选 1；权重随机自 rng，保证每次 run 不同 build
export const UPGRADE_POOL = Object.keys(UPGRADES);

// ---- 事件密度里程碑（每 N 分触发一次，喂 selfplay 的事件密度） ----
export const MILESTONE = {
  SCORE_STEP: 100,
};

// ---- 纯函数 ----
export function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function comboMult(combo) {
  return Math.min(COMBO.MULT_CAP, 1 + combo * COMBO.MULT_PER);
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
