// FISH FRENZY · M1 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/analysis.md（事件名/字段一字不差）

import { WORLD, STEP } from './game.config.js';

// 透传世界常量，供 sim/spawner 统一从 gameplay 引入
export { WORLD, STEP };

// ---- 金币经济（金币余额 = 血量） ----
export const ECONOMY = {
  START_COINS: 400,       // 开局金币
  MIN_CAPTURE: 0.05,      // 捕获率下限（防永远打不死）
  MAX_CAPTURE: 0.95,      // 捕获率上限（防必中）
  COIN_MILESTONE: 100,    // 每 +100 金币发一次 coinMilestone（反馈密度）
};

// ---- 炮台 ----
export const CANNON = {
  TIER_MIN: 1,
  TIER_MAX: 7,
  AIM_LERP: 12,           // 瞄准角缓动（1/s）
  AIM_EMIT_PX: 24,        // 瞄准点移动 >24px 才发 aim 事件（节流）
  AIM_EMIT_SEC: 0.25,     // aim 事件节流（s）
};

// ---- 网弹 ----
export const BULLET = {
  SPEED: 760,             // px/s
  HIT_RADIUS: 26,         // 飞行中撞鱼判定半径
  FIRE_COOLDOWN: 0.32,    // 发射冷却（s）
};

export const NET = {
  RADIUS: 54,             // 网爆捕获半径（含鱼半径）
  NEAR_PAD: 40,           // 差一点：网外再扩 40px 算 nearMiss
  NEAR_THROTTLE: 1.0,     // nearMiss 节流（s）
};

// ---- 电击网（原创 twist：60s 充能群捕） ----
export const ELECTRIC = {
  CHARGE_SEC: 60,         // 充能周期
  RADIUS: 170,            // 范围网半径
  CAPTURE: 0.95,          // 范围内捕获率（几乎必中）
};

// ---- 鱼汛预报（原创 twist：提前 5s 预告路线） ----
export const FORECAST = {
  LEAD_SEC: 5,            // 提前 5s 显示预报
  INTERVAL_MIN: 4,        // 预报间隔（s）
  INTERVAL_MAX: 6,
};

// ---- 鱼游动 ----
export const FISH_MOVE = {
  SWAY_AMP: 26,           // 正弦摆动幅度（px）
  SWAY_FREQ: 1.6,         // 摆动频率（rad/s）
};

// ---- 生成 ----
export const SPAWN = {
  EDGE_MARGIN: 60,        // 出屏/入屏余量
  GROUP_DELAY: 0.35,      // 编队内鱼之间的延迟（s）
};

// ---- Boss ----
export const BOSS = {
  FIRST_AT: 6,            // Boss 场：首个 Boss 出现的秒数
  INTERVAL: 13,           // Boss 场：之后每隔多少秒再出一条 Boss
};

// ============================================================
// 纯函数（无副作用，供 sim 复用；数字全部来自上面的常量）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// 捕获率：档位 / 血量，clamp 到 [MIN_CAPTURE, MAX_CAPTURE]
export function captureRate(tier, hp) {
  const t = clamp(Math.floor(tier) || 1, 1, CANNON.TIER_MAX);
  const h = Math.max(1, hp);
  return clamp(t / h, ECONOMY.MIN_CAPTURE, ECONOMY.MAX_CAPTURE);
}

// 捕获期望值（每发）：倍率（鱼 value） × 捕获率（bot 按此选目标）
export function expectedValue(fishValue, tier, hp) {
  return fishValue * captureRate(tier, hp);
}
