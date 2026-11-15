// config/game.config.js — ROCKET DERBY 全部数值集中；逻辑层只读不写死。
export const STEP = 1 / 60;
export const VIEW = { W: 1280, H: 720 };

export const CONFIG = {
  appId: 'pipy-rocket-derby',
  title: 'ROCKET DERBY',
  defaultLang: 'en',
  languages: ['en', 'zh'],
  langNames: { en: 'English', zh: '中文' },
  rtlLangs: [],
  langStorageKey: 'rocket-derby:lang',
  saveKey: 'rocket-derby:save',
  logicFps: 60,
};

// 球场（逻辑单位 1 = 1 米；地面在 y=0，长度沿 X，宽度沿 Z）
export const ARENA = {
  HX: 60,        // 半场长（球门在 ±X）
  HZ: 38,        // 半场宽
  WALL_H: 6,     // 围栏高
  GOAL_W: 20,    // 球门宽（Z 方向）
  GOAL_D: 9,     // 球门深（X 方向，突出墙外）
  GOAL_H: 3.4,   // 球门高（球低于此高度才算进球）
};

export const MATCH = {
  DURATION: 120,   // 一局 120s（只算 play 阶段）
  KICKOFF_T: 3.0,  // 开球倒计时
  REPLAY_T: 1.5,   // 进球回放
  MAX_LEVELS: 5,
};

export const BALL = {
  R: 1.0,
  RESTITUTION: 0.7,
  FRICTION: 0.34,      // 落地每秒速度衰减
  AIR_FRICTION: 0.02,
  GRAVITY: 26,
  MAX_SPEED: 90,
  HIT_POWER: 1.5,      // 球速 = 车速 × 此系数
  MIN_HIT: 18,         // 撞球最低给速
  AERIAL_VY: 7.5,      // 空中撞球给球的向上速度
};

export const CAR = {
  R: 1.6,
  MAX_SPEED: 30,
  REVERSE: 12,
  ACCEL: 24,
  BRAKE: 42,
  STEER: 3.0,            // 满转向速率（rad/s）
  STEER_SPD_DAMP: 0.55,  // 高速时转向减弱
  BOOST_MUL: 1.55,
  BOOST_DRAIN: 1.0,      // boost 每秒消耗
  BOOST_MAX: 1.0,
  JUMP_V: 11.5,
  DOUBLE_JUMP_V: 9.5,
  GRAVITY: 26,
  DEMO_SPEED: 26,        // 触发翻车的相对速度
  DEMO_TIME: 2.0,        // 翻车时长
  PICKUP_REFILL: 0.6,    // 拾取回充
  AI_REGEN: 0.10,        // AI boost 每秒自回充
  PASSIVE_REGEN: 0.22,   // 玩家 boost 缓慢自回充（拾取给爆发）
};

export const PICKUP = {
  R: 0.9,
  RESPAWN_T: 6.0,
  // 4 个拾取点（x, z）
  SPOTS: [[0, 0], [-24, 22], [24, -22], [-20, -24], [20, 24]],
  LEVEL_MIN: 2,          // 从第 2 关开始有拾取点
};

// AI 难度（按关卡 index，1-based）
export const AI = {
  teammate: { maxSpeed: 26, accel: 20, shotSkill: 0.82, react: 0.10, boostChance: 0.5 },
  perLevel: [
    null,
    { oppMax: 18, oppAccel: 14, oppShot: 0.28, oppReact: 0.26 }, // L1 易
    { oppMax: 20, oppAccel: 16, oppShot: 0.38, oppReact: 0.21 },
    { oppMax: 23, oppAccel: 18, oppShot: 0.52, oppReact: 0.16 }, // L3 难度起跳
    { oppMax: 26, oppAccel: 20, oppShot: 0.66, oppReact: 0.13 },
    { oppMax: 29, oppAccel: 22, oppShot: 0.80, oppReact: 0.10 }, // L5 决胜
  ],
};

export const SCORE = {
  SPEED_MUL: 100,   // 进球分 = 球速 × 100
  WIN_BONUS: 300,
  ratings: [['S', 2200], ['A', 1500], ['B', 900], ['C', 0]],
};

export const COLORS = {
  bg: 0x1e1b3a,
  floor: 0x161433,
  wall: 0x2a2350,
  green: 0x4ade80,
  blue: 0x38bdf8,
  orange: 0xfb923c,
  ball: 0xf4f6fb,
  neon: 0x4ade80,
  neon2: 0x38bdf8,
  goalPost: 0xffffff,
};

export const CAMERA = {
  y: 54, z: 76, lookZ: -2,   // 俯视广播机位
  titleR: 26, titleSpeed: 0.10,
  followX: 0.55, followZ: 0.35,
};
