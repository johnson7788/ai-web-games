// 全局数值配置（Lead 拥有；数值改动只改这里）
// RETRO RACER GT · 霓虹街机风 4 车道纵向赛车（玩法骨架 1:1 参考掌机赛车，主题/机制原创）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 4 条车道中心 x（道路 320..960，每车道 160 宽）
export const LANE_X = [400, 560, 720, 880];

export const PLAYER = {
  Y: 520,
  W: 60,
  H: 100,
  START_LANE: 2,
};

// 车辆速度 / 氮气 / 转向（px/s 与秒）
export const CAR = {
  maxSpeed: 850,        // 常规极速（道路滚动速度）
  addSpeed: 500,        // 常规加速度
  maxSpeedN: 1200,      // 氮气极速
  addSpeedN: 700,       // 氮气加速度
  nitroTime: 4.5,       // 氮气持续秒数
  nitroCd: 9,           // 氮气冷却秒数
  starNitroRefill: 1.6, // 每颗能量星减免冷却秒数
  maxSpeedX: 500,       // 换道横向速度
  carAng: 12,           // 换道倾角（度，渲染用）
};

export const SPAWN = {
  Y: -500,              // 生成点（画面上方 1 屏外）
  carW: 58,
  carH: 100,
};

// 同向车（中车道）/ 对向车（边车道）在世界系里的速度
export const TRAFFIC = {
  sameDirSpeed: 500,
  oncomingSpeed: 70,
};

export const OBSTACLE = {
  rockW: 52,
  rockH: 52,
  rockEvery: 2.8,       // 基准生成间隔（tier 配置可覆盖）
  maxConcurrent: 3,
};

export const STAR = {
  w: 40,
  h: 40,
  every: 2.2,
  score: 120,
};

export const SCORE = {
  distanceScale: 0.2,   // 距离分数 = speed * dt * scale
  passBase: 25,         // 超车基础分
  comboStep: 25,        // 连击每层额外分
  nearMissBonus: 40,    // 擦身而过奖励
};

export const COMBO = {
  window: 2.5,          // 连击维持窗口（秒）
};

// 难度阶梯（tier 0..5）：score 为升级门槛，interval 为各类生成间隔
export const TIERS = [
  { score: 0,     carIntervalMid: 1.0,  carIntervalEdge: 1.3,  rockEvery: 0,   starEvery: 2.2 },
  { score: 3000,  carIntervalMid: 0.85, carIntervalEdge: 1.15, rockEvery: 2.8, starEvery: 2.1 },
  { score: 7000,  carIntervalMid: 0.75, carIntervalEdge: 1.0,  rockEvery: 2.4, starEvery: 2.0 },
  { score: 12000, carIntervalMid: 0.65, carIntervalEdge: 0.9,  rockEvery: 2.1, starEvery: 1.9 },
  { score: 19000, carIntervalMid: 0.55, carIntervalEdge: 0.8,  rockEvery: 1.9, starEvery: 1.8 },
  { score: 28000, carIntervalMid: 0.5,  carIntervalEdge: 0.7,  rockEvery: 1.7, starEvery: 1.7 },
];

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'retro-racer-gt-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'retro-racer-gt-save',
};
