// config/gameplay.js — 玩法数值（全部 config-first，逻辑层不写死数字）。
import { WORLD } from './game.config.js';

// 手电电池（视野半径）：满电最大，随时间线性流失；找对目标回充。半径有下限（不会全黑）。
export const BATTERY = {
  MAX: 100,          // 满电
  DRAIN_PER_SEC: 3.2, // 每秒流失（扫得越久视野越窄）
  MIN_RADIUS: 46,     // 半径下限（px）
  MAX_RADIUS: 225,    // 半径上限（px）
  RECHARGE: 22,       // 每找到一个目标回充电量
  LOW: 25,            // 低电告警阈值（触发 batteryLow 事件 + HUD 变红）
  RECHARGE_ON_FIRST: 14, // 第一关每个目标额外回充（新手保护）
};

// 计时：每关限时；点错扣时；诱饵双倍。
export const TIME = {
  BASE_PER_LEVEL: 40,   // 基础每关秒数（levels.js 再按关微调）
  WRONG_PENALTY: 2.5,   // 点错普通物品扣秒
  DECOY_PENALTY: 5.0,   // 点中诱饵扣秒（双倍）
  LOW_WARN: 10,         // 剩余秒数告警阈值
};

// 得分
export const SCORE = {
  FIND: 100,            // 每找到一个目标
  STREAK_BONUS: 25,     // 连击内每个额外加分
  STREAK_WINDOW: 4,     // 连击窗口（秒）
  LEVEL_CLEAR: 500,     // 过关奖励
  PER_SEC_LEFT: 5,      // 过关时每秒剩余时间折算分
  MILESTONE_EVERY: 500, // 每 500 分一个里程碑事件
};

// 触控命中容差（px）：点击位置与物品中心的距离阈值（物品 s 越大越易点）
export const HIT = {
  PAD: 10,
};

// 手电光圈视觉（渲染侧）
export const LIGHT = {
  CORE_ALPHA: 0.0,     // 光圈中心透明（完全亮）
  EDGE_ALPHA: 0.88,    // 光圈外黑暗度（留一点环境可见，剪影更可辨）
  SOFT: 0.55,          // 软边起始比例（0..1）
  AMBIENT: 'rgb(8,11,16)', // 光圈外环境底色
};

// 场景包（3 个，换章必换色板+构图+装饰）；levels.js 决定第几关用哪个包。
export const SCENE_PACKS = [
  {
    id: 'book',
    nameKey: 'scene.book',
    // 旧书摊：暖褐
    bgTop: '#2a1c12',
    bgBottom: '#4a2f1a',
    floor: '#3a2515',
    accents: ['#c98a4a', '#8a5a32', '#e8c94a', '#a8673c'],
    shelves: true,
    clutter: ['book', 'candle', 'lantern'],
  },
  {
    id: 'toy',
    nameKey: 'scene.toy',
    // 玩具堆：彩
    bgTop: '#231a33',
    bgBottom: '#3c2a52',
    floor: '#2c2340',
    accents: ['#e87fa0', '#4a7bbf', '#e8c94a', '#5aa05a'],
    shelves: false,
    clutter: ['balloon', 'top', 'kite'],
  },
  {
    id: 'ghost',
    nameKey: 'scene.ghost',
    // 鬼市：青灰
    bgTop: '#0e1618',
    bgBottom: '#1d2a2c',
    floor: '#142021',
    accents: ['#5a9a9a', '#7b8ea3', '#9fb4b8', '#4a7b6a'],
    shelves: true,
    clutter: ['lantern', 'hourglass', 'pocketwatch'],
  },
];

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** 电池 → 光圈半径（线性插值到 MIN..MAX）。 */
export function batteryRadius(battery) {
  const b = clamp(battery, 0, BATTERY.MAX);
  const t = b / BATTERY.MAX;
  return BATTERY.MIN_RADIUS + (BATTERY.MAX_RADIUS - BATTERY.MIN_RADIUS) * t;
}
