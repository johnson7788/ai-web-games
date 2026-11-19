// GRUMPY BIRDS SIEGE · 全局数值配置（逻辑坐标系 960×540，16:9；渲染时等比适配画布）
// 纯逻辑 sim 只用这里与 sim.js；render/main 再映射到真实画布。
export const WORLD = {
  WIDTH: 960,
  HEIGHT: 540,
  GROUND_Y: 492,     // 地面带顶部（下方是护城河/城墙基底）
  CEIL_Y: 0,         // 天花板
};

// 固定步长（60Hz）
export const STEP = 1 / 60;

// 小鸟飞行物理（每帧 = 1/60s，速度为 px/frame）
export const BIRD = {
  X: 268,            // 小鸟固定横向位置
  R: 16,
  GRAVITY: 0.7,
  FLAP_VY: -8,
  DIVE_GRAVITY: 1.05,   // 按住 = 俯冲（更快下坠）
  MAX_FALL: 15,
  MAX_RISE: -15,
};

// 攻城墙（原作管道换皮）：3 根，缺口上下浮动（原作 moveBothUpDown）
export const WALL = {
  COUNT: 3,
  WIDTH: 64,
  SPACING: 300,          // 相邻墙横向间距
  FIRST_X: 480,
  GAP_BASE: 150,         // L1 缺口高度
  GAP_MIN: 118,
  GAP_MARGIN: 70,        // 缺口离顶/地最小边距
  OSC_AMP: 30,           // 缺口上下浮动幅度
  OSC_PERIOD: 2.4,       // 浮动周期（秒）
  SPEED_BASE: 3.0,       // L1 滚动速度（px/frame）
  SPEED_PER_LEVEL: 0.03,
  WIN_PASS: 10,          // 通过 10 道墙 = 破城
};

// 投石（新机制 1）：抛物线飞石（轻重力，横向掠过全屏）
export const ROCK = {
  R: 10,
  INTERVAL_BASE: 2.2,    // 发射间隔（秒）
  INTERVAL_MIN: 1.15,
  GRAVITY: 0.03,
  VX_MIN: 4.5,
  VX_SPREAD: 1.5,
};

// 哨兵敌机（原作 enemy 换皮）：横向逼近 + 上下浮动
export const SENTRY = {
  R: 14,
  SPEED: 2.2,
  BOB_AMP: 22,
  BOB_PERIOD: 1.6,
  FIRST_X: 940,
};

// 盾牌道具（新机制 2）：霓虹六边形
export const SHIELD_ITEM = {
  R: 14,
  INTERVAL: 6.0,
  DRIFT: 2.6,
};

// 连击 + 星级（新机制 3）
export const SCORE = {
  PASS_BASE: 10,
  COMBO_BONUS: 5,        // 每级连击额外加分
  STAR3_COMBO: 10,       // 满连击（全程未破盾未受伤）3 星
  STAR2_COMBO: 4,
};

// 语言：默认英文；zh 必做（完整才暴露）。本作只做 en + zh。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'grumpy-birds-siege-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'grumpy-birds-siege-save',
};
