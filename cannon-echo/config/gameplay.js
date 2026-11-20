// CANNON ECHO · M1 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/analysis.md（事件名/字段一字不差）

import { WORLD } from './game.config.js';

// ---- 炮台等级表（12 级，威力 / 射速，对应原作 cannonJson 的节奏） ----
export const CANNON = {
  START_LEVEL: 1,
  MAX_LEVEL: 12,
  // 每级：attack 基础伤害、fireInterval 射击间隔（秒）
  levels: [
    { level: 1, attack: 22, fireInterval: 0.60 },
    { level: 2, attack: 34, fireInterval: 0.56 },
    { level: 3, attack: 48, fireInterval: 0.52 },
    { level: 4, attack: 66, fireInterval: 0.48 },
    { level: 5, attack: 88, fireInterval: 0.44 },
    { level: 6, attack: 116, fireInterval: 0.40 },
    { level: 7, attack: 150, fireInterval: 0.36 },
    { level: 8, attack: 190, fireInterval: 0.33 },
    { level: 9, attack: 240, fireInterval: 0.30 },
    { level: 10, attack: 300, fireInterval: 0.28 },
    { level: 11, attack: 372, fireInterval: 0.26 },
    { level: 12, attack: 460, fireInterval: 0.24 },
  ],
};

// ---- 炮弹 ----
export const BULLET = {
  SPEED: 1050, // 弹速 px/s（有飞行时间）
  R: 9, // 碰撞半径
  MAX_ANGLE: 78 * (Math.PI / 180), // 最大仰角（相对竖直向上）
  LIFE: 4.5, // 最长飞行时间（秒）
};

// ---- 回声 ----
export const ECHO = {
  BASE_BOUNCES: 1, // 基础弹射次数（ricochet 升级 +1）
  DECAY: 0.55, // 每次弹射伤害衰减到 55%
  DECAY_RICOCHET: 0.70, // ricochet 升级后的衰减
};

// ---- 过热 ----
export const HEAT = {
  MAX: 100,
  PER_SHOT: 9, // 每发 +9
  COOL: 22, // 不射击时每秒冷却
  LOCK_SEC: 1.5, // 过热锁管时长
};

// ---- 要塞 ----
export const FORTRESS = {
  HP: 100,
  MAX_HP: 100,
};

// ---- 目标类型 ----
export const TARGET = {
  W: 96, // 目标盒宽
  H: 84, // 目标盒高
  TYPES: ['crate', 'diver', 'shielded', 'armored'],
  // 各类型：hp 基数（随波次放大）、下坠速度（px/s）、得分、撞击伤害、护盾、装甲
  crate: { hp: 40, vy: 46, score: 100, crash: 18, shield: false, armor: false },
  diver: { hp: 26, vy: 90, score: 130, crash: 14, shield: false, armor: false },
  shielded: { hp: 55, vy: 20, score: 260, crash: 22, shield: true, armor: false },
  armored: { hp: 150, vy: 18, score: 420, crash: 30, shield: false, armor: true },
  boss: { hp: 2600, vy: 12, score: 5000, crash: 60, shield: false, armor: true },
};

// ---- 盾 / 甲 ----
export const DEFENSE = {
  SHIELD_DIRECT_MULT: 0, // 直射（bounces===0）对护盾目标伤害 0
  ARMOR_DIRECT_MULT: 0.25, // 直射对装甲目标伤害 25%
  ECHO_FULL_MULT: 1.0, // 回声（bounces>=1）全额伤害
};

// ---- 目标下坠 / 波次 ----
export const WAVE = {
  LANES: [220, 360, 500, 640, 780, 920, 1060], // 7 列
  SPAWN_Y: 30, // 生成 y（屏顶之下，开局即有可见目标）
  SCORE_MULT_STEP: 1.12, // 每波得分/血量倍率
  INTERMISSION: 0.8, // 波间过场（秒）
};

// ---- 得分里程碑 ----
export const SCORE = {
  MILESTONE: 1000, // 每 1000 分一个里程碑事件
};

// ---- nearMiss ----
export const NEAR_MISS = {
  GAP: 18, // 炮弹与目标擦肩 <18px
  THROTTLE: 1.5,
};

// ---- 特效 ----
export const FX = {
  LAYERS_PER_EVENT: 3, // 命中同时：音效 + 粒子 + 顿帧（验收断言）
  HITSTOP_SEC: 0.03,
};

// ============================================================
// 纯函数（无副作用，供 sim 复用）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 波次 → 目标 hp/得分放大系数（1 + (wave-1)*step）
export function waveMult(wave) {
  return 1 + (wave - 1) * WAVE.SCORE_MULT_STEP;
}

// 目标类型 hp（含波次放大）
export function targetHp(type, wave) {
  const base = TARGET[type] ? TARGET[type].hp : TARGET.crate.hp;
  return Math.round(base * waveMult(wave));
}

// 炮台等级表查询（越界 clamp）
export function cannonLevel(n) {
  const idx = clamp(Math.round(n) - 1, 0, CANNON.levels.length - 1);
  return CANNON.levels[idx];
}
