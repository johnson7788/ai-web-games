// GET ON BUS 3D · 全局数值配置（世界 / 物理 / 语言 / 存档）
// 世界坐标：x 向右、y 向下（与 canvas 一致）。车道中线 x=0，公交车沿路线向下开。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  LANE_X: 0,        // 直路中线（车沿 x=0 走）
  BUS_R: 18,        // 公交车碰撞半径
  CAR_R: 20,        // 横穿车默认碰撞半径
  NEAR_R: 70,       // 擦肩而过（near-miss）半径（圆心距）
  PICKUP_R: 40,     // 拾取道具半径
  MARGIN: 660,      // 横穿车生成/回收的横向边缘
};

// 公交车物理（units/s）
export const PHYS = {
  MIN_SPEED: 60,    // 松手后怠速（永远向前，不会停）
  MAX_SPEED: 260,   // 按住油门最高速
  ACCEL: 220,       // 油门加速度
  BRAKE: -260,      // 松手减速
  TURBO_SPEED: 360, // 氮气道具速度
  TURBO_TIME: 2.4,  // 氮气持续秒
};

// 接客/送客时的短暂停顿（秒）
export const HOST = {
  PICKUP: 0.55,
  DROPOFF: 0.70,
};

// 倒计时（开局 3-2-1 → GO）
export const COUNTDOWN = 1.0;

// 收益：与参考源码同型 —— floor(30 + level/2 + rand*10)，再乘 combo
export const REWARD = {
  BASE: 30,
  LEVEL_DIV: 2,
  RAND_MAX: 10,
  COMBO_CAP: 5,     // 连击最高 ×(1+5)
  COIN_PICKUP: 40,  // 金币道具面额
};

export const STEP = 1 / 60;

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'get-on-bus-3d-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'get-on-bus-3d-save',
  tutorialKey: 'get-on-bus-3d-tutorial-done',
};
