// 全局数值配置（builder 拥有；数值改动只改这里）
// 玩法骨架 1:1 复刻参考源码《陨石破坏王》的弹跳/砸击/热度/道具规则，主题换成霓虹街机陨石带。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 620,      // 地面所在世界 y（角色高度从 0=地面向上计）
  PLAYER_X: 640,      // 角色固定 x（中央，复刻原版中心落点）
};

export const STEP = 1 / 60;

// 玩家（smash drone）
export const PLAYER = {
  R: 30,              // 砸击判定半径（宽 ≈ 2R）
  VISUAL_R: 26,       // 绘制半径
};

// 物理（复刻原版 value 衰减模型）
export const PHYS = {
  GRAVITY_NORMAL: 0.5,   // 正常弹跳时每步速度衰减
  GRAVITY_SLAM: 3.0,     // 砸击时每步速度衰减（快速下坠）
  SLAM_WINDOW: 0.4,      // 砸击状态持续（秒）
};

// 弹跳高度（速度单位，复刻原版数值）
export const BOUNCE = {
  FLOOR_BASE: 25,    // 地板第一跳
  METEOR: 20,        // 砸碎陨石
  CORE: 25,          // 能量核心
  THRUSTER: 30,      // 推进器（原版炸弹）
  PAD: 15,           // 修复台（原版木板）
  SPIKE: 10,         // 尖刺陨石（惩罚，低弹跳）
};

// 热度（原版 floorNum：地板命中累积，满则坠落）
export const HEAT = {
  PER_FLOOR: 5,      // 每撞一次地板 +5
  MAX: 35,           // 达到即游戏结束（7 次地板命中）
  SPIKE_PENALTY: 10, // 撞上尖刺额外热度
  PAD_HEAL_TO: 8,    // 修复台把热度压回 8
};

// 连击（新机制 1）
export const COMBO = {
  WINDOW: 2.5,       // 两次砸击之间的窗口（秒）
  MAX: 5,            // 连击上限
  BONUS_PER: 5,      // 每层连击的额外得分
};

// 刷怪（sequential 调度，保证地面实体不重叠）
export const SPAWN = {
  FIRST_AT: 0.5,          // 首个实体出现时间（秒）
  FIRST_X: 980,           // 首只陨石初始 x（靠近玩家，首次成功更快）
  BASE_MOVE_SPEED: 300,   // 实体左移速度（px/s）
  BASE_INTERVAL: 1.05,    // 实体刷新间隔（秒，按等级缩放）
  X_EDGE: WORLD.WIDTH + 44,
  // 权重：meteor 最多；spike 从 level 2 起才出现
  WEIGHTS: {
    meteor: 0.58,
    spike: 0.10,
    core: 0.06,
    thruster: 0.06,
    pad: 0.20,
  },
};

// 难度 / 星级 / 得分
export const PROGRESS = {
  SCROLL_SPEED: 90,       // 前进速度（px/s），也驱动距离计分
  LEVEL_DIST: 900,        // 每 900px 升一级
  SPEED_PER_LEVEL: 26,    // 每级额外实体速度
  INTERVAL_SCALE: 0.9,    // 每级刷怪间隔缩放
  INTERVAL_MIN_SCALE: 0.55,
  SCORE_M_PER_PX: 10,     // 距离 → 米数（px/10）
  STAR_THRESHOLDS: [120, 320, 650],  // 1/2/3 星所需总分
};

// 语言：默认英文；zh 必做。只暴露 en/zh。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'meteor-smasher-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'meteor-smasher-save',
};
