// config/gameplay.js — 玩法数值（M1）：速度 / 车道 / 生成 / 碰撞 / 气球 / 闸机 / 里程 / 判定
// 所有可调数字集中在这里；逻辑层不写死数字。
import { WORLD } from './game.config.js';

export const PX_PER_METER = 40;          // 1 米 = 40px 屏幕滚动，速度感与布局的换算
export const SPEED = {
  BASE: 8,            // m/s 起始
  MAX: 16,            // m/s 上限
  RAMP: 0.06,         // 每米提速（m/s）
  STOP_DECAY: 0.0,    // 停止时速度立即归 0（闸机节奏打破器）
};

export const PLAYER = {
  W: 74,              // 大鹅碰撞半宽（视觉更宽，判定略收窄更宽容）
  H: 60,
  LANE_CHANGE_CD: 0.12, // 换道冷却（秒），连续换道需节奏
  STOP_HOLD_MS: 0.5,    // 按住停步多久发 stopHold 事件（教学步）
};

export const BALLOON = {
  MAX: 2,             // 气球可叠 2 层
};

export const GATE = {
  ZONE_M: 11,         // 红闸机：进入此米数内开始累计「等待」进度
  WAIT_SEC: 1.0,      // 停满 1s 红转绿
  CLEAR_M: 16,        // 闸机前后清空障碍的米数（保证能安全停）
};

export const SPAWN = {
  LOOKAHEAD_M: 42,    // 向前预生成的米数（保证画面内始终有内容）
  GAP_START: 20,      // 初始障碍行间距（米）
  GAP_MIN: 13,        // 最小行间距（后期更密）
  GAP_DECAY: 0.7,     // 每站减少的间距
  GEM_CHANCE: 0.5,    // 每行在安全车道撒宝石的概率
  BALLOON_CHANCE: 0.22, // 每行撒气球概率
};

export const STATION = {
  DISTANCE_M: 60,     // 每站 60 米，12 站 = 720m
  COUNT: 12,
};

export const COMBO = {
  SMOOTH_GAP: 0.5,    // 两次换道间隔 < 0.5s 记为「连续换道」
  SMOOTH_NEED: 3,     // 连续 3 次 → 丝滑换乘（白鸽）
  SMOOTH_BONUS_M: 5,  // 丝滑换乘里程奖励
};

export const MILESTONE = {
  EVERY_M: 10,        // 每 10m 发一次里程里程碑（保证反馈密度）
};

export const SCORE = {
  GEM: 10,            // 每颗宝石的分数
};

export function clamp(v, lo, hi) {
  const n = Number(v);
  if (Number.isNaN(n)) return lo;
  return n < lo ? lo : (n > hi ? hi : n);
}

export function speedAt(distance) {
  return Math.min(SPEED.MAX, SPEED.BASE + distance * SPEED.RAMP);
}
