// STAR SLAYER · 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/star-slayer/README.md（事件名/字段一字不差）

import { WORLD } from './game.config.js';

export const STEP = 1 / 60;

// ---- 玩家「铁卫」----
export const PLAYER = {
  R: 16,            // 碰撞半径
  SPEED: 232,       // 移动速度 px/s
  HP: 100,
  MAX_ARMOR: 30,    // 护甲上限（护甲先于血量吸收伤害）
  ARMOR_REGEN: 3,   // 护甲回复速率 /s
  ARMOR_REGEN_DELAY: 4, // 受击后多久开始回复
  FIRE_INTERVAL: 0.16, // 主武器射速
  FIRE_SLOW: 0.82,  // 开火期间移动速度倍率（代价：站桩暴露）
  BULLET_SPEED: 660,
  BULLET_DMG: 10,
  BULLET_R: 5,
};

// ---- 伙伴「光核」----
export const CORE = {
  R: 12,
  FOLLOW_LERP: 5.5, // 跟随缓动（1/s）
  TRAIL_DIST: 78,   // 滞后的目标距离
  COPY_DELAY: 0.5,  // 复制攻击延迟（打提前量窗口）
  COPY_DMG: 9,      // 复制子弹伤害
};

// ---- 相位同步（L）----
export const SYNC = {
  COOLDOWN: 4.0,
  INVULN: 0.5,
  SHOCK_DMG: 30,
  SHOCK_R: 140,
};

// ---- 超载协议（K）----
export const OVERLOAD = {
  HP_THRESHOLD: 0.3, // 血量低于 30% 可触发
  OFFLINE_SEC: 20,   // 光核离线时长
  CLEAR_DMG: 9999,
};

// ---- 敌人基础（具体类型在 levels.js 的 ENEMY_TYPES）----
export const ENEMY = {
  BULLET_R: 6,
  BULLET_SPEED: 340,
  SPAWN_MARGIN: 60, // 出生点离活动区边缘的距离
};

// ---- 裂刃（冲刺型）----
export const STRIKER = {
  DASH_COOLDOWN: 2.0,
  DASH_TIME: 0.26,
  DASH_MULT: 5,
  DASH_RANGE: 460,
};

// ---- Boss ----
export const BOSS = {
  R: 46,
  HP_STEP: 0.5,    // Boss 血量每波 +50%（相对 1400 基础值）
  DRIFT: 40,       // Boss 缓慢逼近速度
  LASER_COUNT: 6,
  LASER_ARC: 60,    // 扇形夹角（度）
  LASER_SPEED: 360,
  LASER_DMG: 16,
  BOMB_DMG: 18,
  ATTACK_GAP: 2.8,
  SPLIT_COUNT: 4,   // 死亡分裂成 4 只突袭者
};

// ---- 护甲/伤害 ----
export const DAMAGE = {
  ARMOR_ABSORB: 1.0, // 护甲 1 点吸收 1 点伤害（溢出到血量）
};

// ---- 无敌/受伤 ----
export const HURT = {
  INVULN: 0.35,     // 受击后无敌窗口
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 移动方向归一化
export function normMove(mx, my) {
  if (mx == null || my == null) return { x: 0, y: 0 };
  let x = clamp(Number(mx) || 0, -1, 1);
  let y = clamp(Number(my) || 0, -1, 1);
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  return { x, y };
}
