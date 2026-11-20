// config/gameplay.js — 玩法数值（M1 所有）：物理 / 障碍 / 陶罐 / 速度 / 难度
// 逻辑层不写死数字；sim 从这里 import。单位：px / s（速度）、px / s²（重力）。

export const STEP = 1 / 60;

// ---- 世界 / 缩放 ----
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 560,
  PLAYER_X: 240,
  PX_PER_METER: 50,     // 50px = 1m（距离计分用）
};

// ---- 玩家 ----
export const DONKEY = {
  W: 46,                 // 碰撞盒宽
  H: 56,                 // 碰撞盒高（脚掌到头顶）
  JUMP_V: -940,          // 起跳初速（满跳高度 ≈ 940²/(2·2300) ≈ 192px）
  JUMP_CUT: 0.5,         // 上升期松手时 vy 衰减（矮跳 = 短按，高跳 = 长按）
  GRAVITY: 2300,
  DROP_JUMP_V: -1380,    // 卸货跳：丢一罐换超高跳（≈350px）
  DROP_JUMP_COST: 1,
  COYOTE_S: 0.1,         // 土狼时间：离地后 100ms 内仍可起跳
  JUMP_BUFFER_S: 0.14,   // 输入缓冲：落地前 140ms 内的起跳在落地瞬间生效
  INVULN_S: 1.2,         // 受伤无敌窗口
};

// ---- 陶罐（血量） ----
export const JARS = {
  START: 3,
  MAX: 6,
  PICKUP_W: 30,
  PICKUP_H: 30,
};

// ---- 速度 ----
export const SPEED = {
  BASE: 340,             // px/s 起步
  GROWTH_PER_M: 0.00045, // 每米增速（800m 时约 +0.36 → 1.36x）
  MAX_MULT: 1.9,
  SAND_MULT: 0.68,       // 风沙减速区
};

// ---- 障碍 ----
export const OBSTACLE = {
  LOW:    { w: 34, h: 26,  name: 'hurdle' },
  HIGH:   { w: 34, h: 104, name: 'wall' },
  PIT:    { w: 110, h: 0,  name: 'pit' },
  ROCK:   { w: 54, h: 54,  name: 'rock', extraSpeed: 1.35 },
  // 连环栏：两次矮栏，间隔 GAP_DOUBLE
  DOUBLE_GAP: 118,
};

// ---- 生成 ----
export const SPAWN = {
  LOOKAHEAD: 1500,       // 预生成到玩家前方多远（px）
  MIN_GAP: 300,          // 相邻障碍最小间距（px）
  MAX_GAP: 520,
  JAR_EVERY: 7,          // 平均每 N 个障碍后放一个陶罐补给
};

// ---- 距离里程碑 / 事件密度 ----
export const MILESTONE_M = 10;   // 每 10m 一个距离里程碑事件

export function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}
