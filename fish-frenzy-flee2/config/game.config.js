// 全局配置（Lead 拥有；数值改动只改这里，sim 从这读）。
// 主题：霓虹街机 · 深海逃亡。坐标单位 = 逻辑像素（1280×720 画布，DPR 由 render 自行缩放）。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：en 默认，zh 必做；其它语言整块翻完才加入（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'fish-frenzy-flee2-lang',
  langNames: { en: 'English', zh: '中文' },
};

// 玩法数值（纯逻辑，可被 tests/sim.test.mjs 与 tools/selfplay.mjs 直接 import）。
export const GAME = {
  // 鱼群速度（单位/秒）
  SCHOOL_BASE_SPEED: 270,
  SCHOOL_RAMP1: 6,            // <RAMP1_CAP 时每秒 +6
  SCHOOL_RAMP1_CAP: 420,
  SCHOOL_RAMP2: 2.4,          // 之后每秒 +2.4
  SCHOOL_SPEED_CAP: 620,
  TURN_RATE: 9,               // 转向角速度 rad/s（boost 时 ×TURN_RATE_BOOST_MUL）
  TURN_RATE_BOOST_MUL: 0.55,
  BOOST_SPEED_MUL: 1.5,
  BOOST_MAX: 1.4,             // 能量表上限（秒）
  BOOST_DRAIN: 1.0,           // 每秒消耗
  BOOST_REGEN: 0.35,          // 每秒回复
  BOOST_ACTIVE_MIN: 0.05,     // 低于此值无法开 boost

  SCHOOL_BASE_R: 15,          // 鱼群基础半径
  SCHOOL_R_PER_MEMBER: 3.2,   // 每多一条鱼半径增量
  SCHOOL_R_MAX: 72,

  PREY_SPEED_MIN: 80,
  PREY_SPEED_MAX: 170,
  PREY_R: 12,
  PREY_MAX: 3,
  PREY_SPAWN_INTERVAL: 1.5,
  PREY_SPAWN_DIST_MIN: 300,
  PREY_SPAWN_DIST_MAX: 520,

  PRED_R_MIN: 20,
  PRED_R_MAX: 34,
  PRED_SPEED_OFFSET: 160,     // 鲨鱼速度 = 鱼群速度 - offset（下限见 PRED_SPEED_MIN）
  PRED_SPEED_MIN: 120,
  PRED_MAX: 30,
  PRED_SPAWN_DIST: 720,       // 在鱼群前方屏幕外生成
  PRED_NEAR_MISS_MARGIN: 30,

  COIN_R: 12,
  COIN_MAX: 10,
  COIN_SPAWN_INTERVAL: 1.9,
  COIN_CLUSTER_CHANCE: 0.34,

  ROCK_COUNT: 5,
  ROCK_R_MIN: 20,
  ROCK_R_MAX: 38,
  ROCK_HIT_COOLDOWN: 0.7,

  STAR_R: 16,
  STAR_FIRST_AT: 11,
  STAR_INTERVAL: 21,
  FRENZY_DURATION: 5,
  FRENZY_MAGNET_R: 380,
  FRENZY_EAT_SCORE: 15,

  COMBO_WINDOW: 4,
  COMBO_STEP: 4,              // 每 4 连击升一档加成

  STAGE_TIME: 20,             // 每 20 秒升一关
  STAGE_MAX: 9,

  REVIVE_COST: 10,
  REVIVE_INVULN: 1.6,

  RECYCLE_DIST: 1500,         // 距鱼群超过此距离的实体回收
  REBASE_DIST: 2500,          // 鱼群世界坐标超过此值则整体平移归零
};
