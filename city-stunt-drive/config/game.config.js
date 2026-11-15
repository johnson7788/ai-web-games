// config/game.config.js — CITY STUNT DRIVE 全部数值集中。逻辑层只读不写死。
export const STEP = 1 / 60;
export const VIEW = { W: 1280, H: 720 };

export const CONFIG = {
  appId: 'pipy-city-stunt-drive',
  title: 'CITY STUNT DRIVE',
  defaultLang: 'en',
  languages: ['en', 'zh'],
  langNames: { en: 'English', zh: '中文' },
  rtlLangs: ['ar'],
  langStorageKey: 'city-stunt-drive:lang',
  saveKey: 'city-stunt-drive:save',
  logicFps: 60,
};

// 物理世界（单位 ≈ 米）
export const WORLD = {
  gravity: 18,          // 重力加速度，垂直向下
  airDrag: 0.06,        // 空中前进方向每帧衰减
  trackHalfWidth: 11,   // 跑道半宽（x 方向护栏）
  carY: 0.55,           // 车体离地高度（重心/接地偏移）
};

// 车辆手感（3 辆：基础 / 肌肉 / 超跑）
// 手感和参数不同：超跑更快更飘、翻转更快；肌肉加速猛但转向重。
export const CARS = [
  { id: 'rookie',  name: 'ROOKIE',  tint: 0xff9f43, maxSpeed: 26, accel: 11, brake: 22, steer: 9,  steerLerp: 7,  airRoll: 5.2, airYaw: 2.2, nitroMul: 1.40, cost: 0 },
  { id: 'muscle',  name: 'MUSCLE',  tint: 0xff5a5f, maxSpeed: 29, accel: 14, brake: 24, steer: 8,  steerLerp: 6,  airRoll: 5.6, airYaw: 2.0, nitroMul: 1.50, cost: 600 },
  { id: 'hyper',   name: 'HYPER',   tint: 0x22d3ee, maxSpeed: 33, accel: 12, brake: 26, steer: 10, steerLerp: 8,  airRoll: 6.2, airYaw: 2.6, nitroMul: 1.60, cost: 1600 },
];

export const CAR_COMMON = {
  nitroMax: 1,          // 一罐氮气（满 1 才能烧）
  nitroTime: 1.6,       // 氮气持续时间
  flipRecover: 3.2,     // 地面翻正角速度（←/→ 自救）
  overturnThreshold: 1.75, // 车身与地面夹角超过 ~100° 视为翻车
  wreckTime: 3.0,       // 翻车持续多久自动吊回
  pitchLevel: 6,        // 空中 pitch 自动回平
  yawLevel: 4,          // 落地前 yaw 自动对齐跑道
  crashSpeedMul: 0.55,  // 摔落减速
  bounceVy: 4.5,        // 摔落弹跳
};

// 坡道（5 组，config 数据驱动；角度/间距决定抛物线）
export const RAMPS = [
  { z: 45,  len: 14, h: 9,  id: 1 },
  { z: 155, len: 14, h: 9,  id: 2 },
  { z: 265, len: 15, h: 10, id: 3 },
  { z: 375, len: 15, h: 11, id: 4 },
  { z: 485, len: 16, h: 14, id: 5 }, // 终极大坡：氮气下可做 2–3 圈
];

// 赛道：直线天桥，5 区 + 冲线
export const TRACK = {
  halfWidth: WORLD.trackHalfWidth,
  finishZ: 620,             // 冲线结算（给终极大坡留落地缓冲）
  // 每区 checkpoint：越过即触发 zone 事件（坡道后 + 落地缓冲）
  zoneZ: RAMPS.map((r) => r.z + r.len + 26),
  zoneBonus: 120,           // 每区冲线分
  distEvery: 20,            // 每前进 20 单位记一次里程事件（节奏反馈）
  distScore: 5,
};

// 金币：沿每段抛物线最佳路径摆放（坡顶→落点），平路少量补给
export const COINS = {
  radius: 3.4,              // 拾取判定半径（3D 距离）
  score: 15,                // 单币得分（×连击）
  currency: 1,              // 货币（跨局解锁新车）
  nitro: 0.22,              // 每币充氮
  rows: 4,                  // 弧线上币列数
};

// 落地判定 / 得分
export const LAND = {
  perfectAngle: 25 * Math.PI / 180,   // 车身与地面夹角 <25°
  perfectYaw: 42 * Math.PI / 180,     // 速度方向与跑道夹角 <42°
  circlesScore: 100,                  // 圈数 × 100
  perfectBonus: 50,                   // 完美落地 + 50
  comboMax: 9,
};

// 结算评级（分数阈值）
export const RATINGS = [
  ['S', 1500],
  ['A', 900],
  ['B', 400],
  ['C', 0],
];

// 相机
export const CAMERA = {
  dist: 10.5,
  height: 4.2,
  lookAhead: 7,
  posLerp: 7,
  lookLerp: 8,
  fovBase: 56,
  fovSpeed: 14,
  fovBoost: 10,
};

// 解锁里程碑（金币解锁 3 辆车）
export const GARAGE = [
  { id: 'rookie', cost: 0,   locked: false },
  { id: 'muscle', cost: 600, locked: true },
  { id: 'hyper',  cost: 1600, locked: true },
];
