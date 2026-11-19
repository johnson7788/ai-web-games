// MY PLANET GROW · 全局数值配置（零依赖，纯逻辑数值只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 玩法规则数值：行星吞噬生存（drag 移动 / 吞噬流星成长 / 躲黑洞）
export const GAME = {
  HP_MAX: 3,            // 初始生命
  SHIELD_MAX: 3,        // 护盾上限
  PLANET_R0: 26,        // 初始半径

  // 进化档位（质量阈值 → 半径）：体积变大=更好接、更难躲，形成取舍
  TIER_MASS: [0, 8, 20, 40, 70],
  TIER_RADIUS: [26, 33, 41, 51, 63],

  COMBO_WINDOW: 2.5,    // 连击窗口（秒）
  COMBO_MAX: 8,         // 连击倍率上限

  // 生成节奏（随时间变难）
  METEOR_INTERVAL_START: 0.9,
  METEOR_INTERVAL_MIN: 0.34,
  METEOR_RAMP: 0.006,   // 每秒缩短的生成间隔
  HOLE_INTERVAL_START: 2.4,
  HOLE_INTERVAL_MIN: 0.75,
  HOLE_RAMP: 0.02,
  SHIELD_AFTER: 16,     // 开局多少秒后开始出护盾
  SHIELD_INTERVAL: 9,

  // 下落速度
  METEOR_FALL: 165,
  METEOR_FALL_RAMP: 3,
  HOLE_FALL: 140,
  HOLE_FALL_RAMP: 3,
  HOLE_HOME: 60,        // 黑洞朝星球横向追踪强度

  GOLD_CHANCE: 0.13,    // 黄金流星概率

  SCORE_METEOR: 10,
  SCORE_GOLD: 50,
  MASS_METEOR: 1,
  MASS_GOLD: 5,

  STAR_2: 120,          // 2 星分数门槛
  STAR_3: 300,          // 3 星分数门槛

  SAFE_TOP: 88,         // 星球上边界（HUD 之下）
  SAFE_BOTTOM: 22,      // 星球下边界
  SPAWN_TOP: -30,       // 流星生成 y（屏幕外顶部）
};

// 语言：默认英文；zh 必做；只暴露 locales 里真实存在的语言
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'my-planet-grow-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'my-planet-grow-save',
};
