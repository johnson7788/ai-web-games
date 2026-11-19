// CAT TACTICS · 全局数值配置（数值改动只改这里，sim 不写死像素）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'cat-tactics-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'cat-tactics-save',
};

// 玩法规则数值（P0 骨架 1:1：招募 → 合并升级 → 巡逻赚金币；新机制：连击/加速/星级）
export const GAME = {
  SLOT_COUNT: 12,          // 车位（猫窝）数量
  MAX_RUNNING: 10,         // 同时巡逻上限
  LEVEL_MAX: 29,           // 猫咪最高等级
  START_COINS: 300,        // 初始金币
  START_GEMS: 0,           // 初始钻石
  RECRUIT_BASE: 10,        // 招募基础价
  RECRUIT_GROWTH: 1.12,    // 每次招募后涨价倍率
  RECYCLE_BASE: 5,         // 回收基础值（×2^等级）
  BOOST_COST: 60,          // 战术加速价格
  BOOST_DURATION: 10,      // 加速持续秒数
  BOOST_MULT: 2,           // 加速收益倍率
  COMBO_WINDOW: 3,         // 连击窗口（秒）
  COMBO_BONUS_PER: 5,      // 连击奖励基数
  // 三关目标：累计赚取金币（收入+回收+连击，不含初始/花费）
  MISSIONS: [
    { target: 400, timeLimit: 90, gems: 3 },
    { target: 3000, timeLimit: 150, gems: 5 },
    { target: 15000, timeLimit: 240, gems: 8 },
  ],
  TUTORIAL_STEPS: 4,
};

// 每秒收益（与参考源码 gg.coin 一致：4 起步逐级翻倍；这里 5 起步便于首关节奏）
export function coinPerSec(level) {
  return 5 * Math.pow(2, Math.max(0, level | 0));
}

// 每圈用时（视觉节奏）
export function lapSeconds(level) {
  return Math.max(4, 12 - (level | 0) * 0.25);
}

// 回收价值
export function recycleValue(level) {
  return GAME.RECYCLE_BASE * Math.pow(2, Math.max(0, level | 0));
}
