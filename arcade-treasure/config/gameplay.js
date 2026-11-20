// config/gameplay.js — 玩法数值（纯逻辑，全部进 config；逻辑层不写死数字）。
// 三台街机：0 机房守夜（打地鼠）/ 1 雨中拾荒（接金币）/ 2 像素蜂群（小蜜蜂）。
import { WORLD } from './game.config.js';

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------- 代币经济学 ----------
export const ECONOMY = {
  START_TOKENS: 5,        // 开局代币
  ENTRY_COST: 1,          // 每台门票
  HEAT_MULT: [1.0, 1.2, 1.5], // 连机热度 ×1.0 / ×1.2 / ×1.5
  HEAT_MAX: 2,            // 最高热度级
  HALL_IDLE_LIMIT: 25,    // 大厅空置超时（秒）→ 打烊 gameover（noinput 基线）
  PITY_TOKEN: 1,          // 打烊/币尽时服务员赠送的兜底币
};

// ---------- 机台定义 ----------
export const MACHINES = {
  COUNT: 3,
  NAMES: ['machine.0', 'machine.1', 'machine.2'],
  // 每台单局时长（秒）
  DURATION: [24, 24, 24],
  // 单局失败条件：0=只用时间、>0=生命数
  LIVES: [0, 3, 3],
};

// ---------- 12 段厅段位（推进结构） ----------
// 每段三台目标分；全台达当前段目标 → 升段。
export const RANKS = {
  COUNT: 12,
  BASE_TARGET: [250, 250, 250], // 第 1 段目标
  GROWTH: 1.5,                 // 每段目标 ×1.5
};

// 第 r 段（1..12）第 m 台目标分
export function rankTarget(rank, machine) {
  const r = clamp(Math.round(rank) || 1, 1, RANKS.COUNT) - 1;
  return Math.round(RANKS.BASE_TARGET[machine] * Math.pow(RANKS.GROWTH, r));
}

// ---------- 机房守夜（打地鼠） ----------
export const MOLE = {
  HOLES_X: 3, HOLES_Y: 3,     // 3×3 通风口
  PAD_X: 120, PAD_Y: 110,     // 网格起点边距
  GRID_W: WORLD.WIDTH - 240, GRID_H: 360,
  UP_MIN: 0.55, UP_MAX: 0.95, // 地鼠冒头停留（秒）
  SPAWN_EVERY: 0.42,          // 平均生成间隔（秒）
  HIT_SCORE: 10,              // 命中一只
  HAZARD_SCORE: -20,          // 打错（火花/短路）
  HAZARD_CHANCE: 0.16,        // 冒头是危险物的概率
  RADIUS: 42,                 // 命中判定半径
  MILESTONE: 100,             // 每 100 分一次里程碑事件
};

// ---------- 雨中拾荒（接金币） ----------
export const RAIN = {
  BASKET_Y: 640,              // 篮筐 y
  BASKET_W: 120,
  BASKET_SPEED: 560,          // 篮筐追指针速度 px/s
  SPAWN_EVERY: 0.55,          // 物品掉落间隔（秒）
  FALL_SPEED_MIN: 150, FALL_SPEED_MAX: 260,
  COIN_CHANCE: 0.72,          // 金币概率（其余是雷击）
  COIN_SCORE: 15,
  HAZARD_SCORE: -25,          // 接到雷击
  HAZARD_LIFE_COST: 1,
  COMBO_WINDOW: 1.6,          // 连击窗口（秒）
  COMBO_MULT: [1, 2, 3, 4],   // 连击加分乘数（封顶 4）
  CATCH_RADIUS: 56,
  MILESTONE: 100,
};

// ---------- 像素蜂群（小蜜蜂） ----------
export const SWARM = {
  SHIP_Y: 636,
  SHIP_SPEED: 480,
  FIRE_COOLDOWN: 0.26,        // 射击冷却（秒）
  BULLET_SPEED: 620,
  BULLET_RADIUS: 6,
  BEE_ROWS: 3, BEE_COLS: 6,
  BEE_W: 44, BEE_H: 32,
  BEE_STEP_X: 14,             // 蜂群每次横向移动量
  BEE_STEP_DOWN: 26,          // 蜂群触边下移量
  BEE_MOVE_EVERY: 0.55,       // 蜂群移动间隔（秒）
  BEE_SHOOT_EVERY: 0.9,       // 蜂群开火间隔（秒）
  BEE_BULLET_SPEED: 200,
  BEE_HIT_SCORE: 15,
  WAVE_CLEAR_BONUS: 120,
  LIFE_COST: 1,
  START_Y: 120,
  MILESTONE: 100,
};

// ---------- 事件密度（遥测：细粒度里程碑，压 maxEventGapSec ≤3s） ----------
export const TELEMETRY = {
  SCORE_STEP_EVENT: 50,       // 每 50 分发一次 score 事件（不含 hit 自带的分）
  SPAWN_EVENT: true,          // 生成物也发事件
};
