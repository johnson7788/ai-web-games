// CROW BLASTER · 数值配置（全部数值常量都在这，逻辑不写死数字）。
// 契约：docs/batch3/crow-blaster.md；事件名与 src/game/sim.js、tools/selfplay.mjs、src/core/audio.js 一字不差。
import { WORLD } from './game.config.js';

// ---- 弹射器（霓虹乌鸦炮）----
export const LAUNCHER = {
  MIN_ANGLE: -60,     // 从竖直方向向左最大角度（度）
  MAX_ANGLE: 60,      // 从竖直方向向右最大角度（度）
  COOLDOWN: 0.55,     // 两次发射间隔（秒）
  X: WORLD.LAUNCHER_X,
  Y: WORLD.LAUNCHER_Y,
};

// ---- 能量弹（重力抛体）----
export const BOLT = {
  SPEED: 1300,        // 出膛速度 px/s
  GRAVITY: 1300,      // 重力加速度 px/s²（向下为正，y 轴向下）
  R: 6,               // 命中半径
  MAX_LIFE: 3.2,      // 最大存活秒（防止无限飞）
};

// ---- 连击（新机制 1）----
export const COMBO = {
  WINDOW_SEC: 3.0,    // 3s 内再命中连击 +1
  MULT_PER: 0.1,      // 乘数 = 1 + combo*0.1
  MULT_CAP: 3.0,      // 封顶 ×3
};

// ---- 星级（新机制 2：每关按命中率 1–3 星）----
export const STARS = {
  THREE: 0.6,         // 命中率 ≥60% → 3 星
  TWO: 0.35,          // ≥35% → 2 星，否则 1 星
};

// ---- 特殊乌鸦----
export const GHOST_PENALTY = 150;   // 误打鬼鸦扣分
export const GOLDEN_AMMO_BONUS = 5; // 金鸦命中奖励弹药（新机制 3）

// ---- 乌鸦类型表（kind → 基础行为参数）----
// hp：命中需次数；score：基础分；speed：横飞速度 px/s；r：命中半径。
export const CROWS = {
  scout:  { hp: 1, score: 100,  speed: 120, r: 38 },
  tank:   { hp: 3, score: 300,  speed: 85,  r: 46 },
  golden: { hp: 1, score: 500,  speed: 230, r: 34 },
  ghost:  { hp: 1, score: -GHOST_PENALTY, speed: 150, r: 38 },
};

export const CROW_KINDS = Object.keys(CROWS);

// ---- 同屏乌鸦上限 ----
export const MAX_ON_SCREEN = 2;

// ---- 关卡默认 ----
export const LEVEL_DEFAULTS = {
  time: 45,
  ammo: 18,
  crowCount: 5,
  spawnInterval: 1.0,
  speedMul: 1.0,
};

// ============================================================
// 纯函数（无副作用，供 sim / spawner / 渲染复用）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clampAim(deg) {
  return clamp(deg, LAUNCHER.MIN_ANGLE, LAUNCHER.MAX_ANGLE);
}

// 连击乘数 = 1 + combo*0.1（封顶 ×3）
export function comboMult(combo) {
  return Math.min(COMBO.MULT_CAP, 1 + Math.max(0, combo) * COMBO.MULT_PER);
}

// 乌鸦分值（含连击乘数；鬼鸦恒定惩罚不受连击放大）
export function scoreFor(kind, combo) {
  const c = CROWS[kind] || CROWS.scout;
  if (kind === 'ghost') return c.score;
  return Math.round(c.score * comboMult(combo));
}

// 命中率 → 星级（1–3）
export function starsFor(accuracy) {
  if (accuracy >= STARS.THREE) return 3;
  if (accuracy >= STARS.TWO) return 2;
  return 1;
}
