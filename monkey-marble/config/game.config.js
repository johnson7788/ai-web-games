// config/game.config.js — 全局数值配置（config-first：逻辑层不写死数字）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };

export const STEP = 1 / 60;

// 滚球物理（自研滚球模型，判定全代码、60Hz 固定步长、可 seed 复现）
export const BALL = {
  radius: 0.5,
  maxSpeed: 11,       // 前进速度上限
  latSpeed: 7,        // 侧向最大速度
  steerRate: 9,       // 转向响应速率（速度目标模型，稳定无振荡）
  brakeDecel: 30,     // Shift 刹车减速度
  friction: 2.2,      // 无输入时的滚动阻力（每秒阻尼）
  airControl: 0.12,   // 空中转向系数（“空中不能转向”）
  gravity: 18,
  jumpVel: 7.4,       // 峰值约 1.5m，可越过移动锤
  bounceVel: 10.4,    // sqrt(2*g*3) → 弹起约 3m
  slopeGravity: 0.7,  // 坡道沿轨加速度系数
};

export const TRACK = {
  thickness: 0.5,
  fallKillY: -12,     // 低于此高度判定摔出
  fallPenalty: 3,     // 摔出扣秒
  bananaRadius: 1.0,  // 收集半径
  bananaBonus: 1,     // 每根香蕉 +1s 时间奖励
  checkpointHeight: 1.2,
  stallTimeout: 15,   // 不动/卡死超过 15s → 赛道塌陷判死（不作为也会失败）
  stallMinProgress: 1.5, // 前进超过此距离即重置卡死计时
};

export const CAMERA = {
  dist: 7.5,
  height: 3.6,
  lookAhead: 4,
  fovBase: 55,
  fovSpeed: 16,       // 速度感 FOV
  tiltMax: 0.10,      // 窄桥镜头侧倾（签名）
  posLerp: 6,
  lookLerp: 8,
};

export const FX = {
  shakeHit: 0.5,
  shakeFall: 0.7,
};

// 评级：netTime = 用时 - 香蕉奖励，对照目标时间
export const RATING = {
  order: ['S', 'A', 'B', 'C'],
  // netTime 相对 targetSec 的阈值
  s: 1.0,
  a: 1.15,
  b: 1.4,
};

// 语言：默认英文；zh 必做。ja/ko/ar/ru 不做 → 整块不暴露。
export const CONFIG = {
  title: 'MONKEY MARBLE',
  slug: 'monkey-marble',
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],   // 无 RTL 语言，保持空
  langStorageKey: 'monkey-marble-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'monkey-marble-save',
};
