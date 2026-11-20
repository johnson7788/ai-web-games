// SNAKE ARENA · M1 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/analysis.md 与 tests/sim.test.mjs 引用本文件常量，字段一字不差。

import { WORLD } from './game.config.js';

// ---- 蛇 ----
export const SNAKE = {
  START_SEGMENTS: 8,   // 开局总节数（含头）
  MAX_SEGMENTS: 120,   // 长度上限（节）
  SEGMENT_SPACING: 22, // 相邻节中心间距（px）
  BODY_R: 11,          // 身体节半径（px）
  HEAD_R: 13,          // 头半径（px）
  BASE_SPEED: 150,     // 基础移速（px/s）
  BOOST_MULT: 1.8,     // 超频速度倍率
  TURN_RATE: 3.4,      // 转向速率（rad/s）
};

// ---- 生长 ----
export const GROWTH = {
  FOOD_WEIGHT: 2,      // 数据点每颗重量
  SHARD_WEIGHT: 1,     // 超频光屑重量
  WEIGHT_PER_SEGMENT: 4, // 每 4 重量 +1 节
  KILL_BONUS_SEGMENTS: 1, // 击杀默认 +1 节
  CORE_STEAL_SEGMENTS: 2, // coreSteal 升级击杀 +2 节
};

// ---- 超频（加速消耗长度，留下光屑可被对手吃） ----
// 超频是 P0 核心动词（摇杆转向 / 吃食变长 / 加速掉长度），第 1 场即可用，与首次引导第 3 步对齐。
export const BOOST = {
  DRAIN_SEC: 0.6,      // 每 0.6s 掉 1 节 + 掉 1 颗光屑
  MIN_SEGMENTS: 6,     // 低于此长度不可超频
  UNLOCK_ROUND: 1,     // 第 1 场起解锁（核心动词，教给新玩家）
};

// ---- 电磁脉冲（长度 >30 可放 1 次，震晕附近敌蛇） ----
export const PULSE = {
  MIN_SEGMENTS: 30,    // 长度 >30 才可用
  RADIUS: 190,         // 范围（px）
  STUN_SEC: 1.5,       // 震晕时长（s）
  COOLDOWN: 20,        // 冷却（s）
  UNLOCK_ROUND: 3,     // 第 3 场起解锁
};

// ---- 食物 / 拾取 ----
export const FOOD = {
  EAT_RADIUS: 18,      // 头到食物拾取半径（px）
  ORB_R: 8,            // 数据点渲染半径（加大，目标可读性）
  SHARD_R: 6,          // 光屑渲染半径
  MAGNET_BASE: 0,      // 磁吸半径基础（升级 +）
  MAGNET_PULL: 130,    // 磁吸拉力（px/s）
};

// ---- 碰撞 ----
export const COLLIDE = {
  HEAD_HEAD_R: 22,     // 头对头判定半径
  HEAD_BODY_R: 20,     // 头对身判定半径
  NEAR_MISS_R: 42,     // 擦肩判定半径（>HEAD_BODY_R 且未命中）
  NEAR_MISS_THROTTLE: 2.0, // 擦肩节流（s）
  WALL_MARGIN: 26,     // 头触墙即死（离墙距离 < 此值）
};

// ---- AI ----
export const AI = {
  RESPAWN_DELAY: 2.5,  // AI 死后重生延时（s）
  INVULN: 3.0,         // 重生/开局无敌（s）
  WALL_STEER_MARGIN: 130, // 离墙多近开始转向中心
  DECIDE_EVERY: 1.6,   // AI 决策间隔（s）
  HUNTER_TURN: 4.2,    // 猎手 AI 转向速率
};

// ---- 场次 ----
export const ROUND = {
  DURATION: 90,        // 每场 90s
  TOTAL: 12,           // 共 12 场
  START_FOOD: 36,      // 开局数据点数量
  PLAYER_INVULN: 3.0,  // 玩家开局无敌
};

// ---- 里程碑（遥测细粒度事件） ----
export const MILESTONE = {
  EVERY: 5,            // 每 +5 节发一次 milestone
};

// ---- 升级 ----
// 三选一中的三个数值升级（每场都出现），规则型升级进入后期卡池
export const UPGRADE_POOL = [
  { id: 'turnSpeed',   kind: 'stat', descKey: 'up.turnSpeed' },
  { id: 'magnetRadius', kind: 'stat', descKey: 'up.magnetRadius' },
  { id: 'pulseCooldown', kind: 'stat', descKey: 'up.pulseCooldown' },
  { id: 'shardRefund', kind: 'rule', descKey: 'up.shardRefund' },
  { id: 'tailArmor',   kind: 'rule', descKey: 'up.tailArmor' },
  { id: 'pulseShield', kind: 'rule', descKey: 'up.pulseShield' },
  { id: 'overclock',   kind: 'rule', descKey: 'up.overclock' },
  { id: 'coreSteal',   kind: 'rule', descKey: 'up.coreSteal' },
  { id: 'shockAbsorb', kind: 'rule', descKey: 'up.shockAbsorb' },
];

// ---- 纯函数（无副作用，供 sim 复用；数字全部来自上面的常量） ----

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// 把角度归一化到 [-PI, PI]
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// 目标角度相对当前角度的最小转向差
export function angleDiff(target, current) {
  return wrapAngle(target - current);
}

// 蛇长度（节）= 分数；比分数 = 长度
export function lengthOf(snake) {
  return snake.segments.length;
}

// 当前长度是否允许超频
export function canBoost(snake, round) {
  return round >= BOOST.UNLOCK_ROUND
    && snake.segments.length > BOOST.MIN_SEGMENTS;
}

// 当前长度是否允许放脉冲
export function canPulse(snake, round, cooldown) {
  return round >= PULSE.UNLOCK_ROUND
    && snake.segments.length > PULSE.MIN_SEGMENTS
    && cooldown <= 0;
}
