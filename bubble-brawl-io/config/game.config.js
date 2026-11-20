// 全局数值配置（BUBBLE BRAWL IO · 霓虹街机气泡决斗）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  CX: 640,           // 竞技场中心 x（圆环/核心的圆心）
  RING_CY: 372,      // 圆环圆心 y
  CORE_CX: 640,
  CORE_CY: 372,      // 核心圆心 y（与圆环同心，核心被圆环护在中心）
  CORE_R: 52,        // 核心半径
  TURRET_Y: 656,     // 炮塔 y（底部）
  TURRET_MIN_X: 300,
  TURRET_MAX_X: 980,
  TURRET_HALF_W: 26, // 炮塔碰撞半宽
  TURRET_HOME_SPEED: 420, // 无输入时回中速度 px/s
  TURRET_MOVE_SPEED: 520, // 手动移动速度 px/s
  BUBBLE_R: 9,
  BUBBLE_UP: 1050,   // 上升速度
  BUBBLE_DOWN: 480,  // 反弹下落速度
  SPIKE_R: 10,
  RING_BAND: 16,     // 圆环带宽（碰撞判定用全宽）
};

export const STEP = 1 / 60;

export const TURRET = {
  HEARTS: 3,
  FIRE_COOLDOWN: 0.22,
  BASE_DAMAGE: 50,
  CRIT_CHANCE: 0.10,
  CRIT_MULT: 2,
  COMBO_MAX: 10,
  COMBO_PER_STEP: 0.10,
  GAP_SCORE: 100,    // 惊险穿过缺口加分（每个圆环一次）
};

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'bubble-brawl-io-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'bubble-brawl-io-save',
};
