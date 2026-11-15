// config/game.config.js — 所有数值/关卡/色板集中于此；逻辑层只读不写死。
export const STEP = 1 / 60;
export const VIEW = { W: 1280, H: 720 };

export const CONFIG = {
  appId: 'pipy-moto-dash-3d',
  title: 'MOTO DASH 3D',
  defaultLang: 'en',
  languages: ['en', 'zh'],               // ja/ko/ar/ru 未翻译，整块不暴露
  langNames: { en: 'English', zh: '中文' },
  rtlLangs: ['ar'],
  langStorageKey: 'moto-dash-3d:lang',
  saveKey: 'moto-dash-3d:save',
};

// 道路：4 车道（左 2 对向 + 右 2 同向），laneX 为各车道中心横向坐标（米）。
export const ROAD = {
  laneWidth: 3.6,
  laneCount: 4,
  halfWidth: 7.2,
  laneX: [-5.4, -1.8, 1.8, 5.4],
  oncomingLaneIdx: [0, 1],   // 对向（左侧）
  sameLaneIdx: [2, 3],       // 同向（右侧）
  xMin: -6.6,
  xMax: 6.6,
  visibleAhead: 420,
  visibleBehind: 40,
};

// 摩托（第一人称）：速度单位 m/s。180km/h = 50m/s。
export const MOTO = {
  halfW: 0.35,
  length: 2.0,
  baseSpeed: 30,          // 无油门巡航（让 noinput 也会撞上前方慢车，保证自动推进与死亡基线）
  topSpeed: 50,           // 全油门极速 = 180km/h
  nitroTop: 60,           // 氮气极速
  minSpeed: 8,
  accel: 9,
  brake: 26,
  coastDecel: 4,
  steerSpeed: 8,          // 连续横移速度
  nitroMax: 1,
  nitroBurn: 1 / 3.2,     // 满氮气约 3.2s 烧完
  nitroRecharge: 1 / 10,  // 约 10s 回满
  nitroBoost: 10,
  fovBase: 60,
  fovTop: 85,
  windSpeed: 42,          // 速度线触发阈值
};

export const TRAFFIC = {
  carHW: 0.85, carLen: 4.4,
  truckHW: 1.15, truckLen: 9.0, truckFrom: 900, truckChance: 0.28,
  speedSame: [0.45, 0.62],        // × MOTO.topSpeed（同向车慢于极速，玩家要超车）
  speedOncoming: [0.62, 0.90],    // 对向车更快更险
  sameGap(d) { return clamp(46 - d * 0.010, 20, 46); },     // 同向车距随距离缩小
  oncomingGap(d) { return clamp(42 - d * 0.009, 18, 42); },
  spawnAhead: 200,
  despawnBehind: 30,
  max: 30,
  maxPerDir: 15,                  // 每方向车位上限，避免同向车占满池子饿死对向车
};

export const NEARMISS = { gap: 0.35, base: 25, comboWindow: 3.0, speedDiv: 20 };

export const SCORE = {
  distPerM: 1,
  ratings: [['S', 2000], ['A', 1500], ['B', 1000], ['C', 500], ['D', 0]],
};

export const CHECKPOINT_EVERY = 500;
export const SEGMENTS = [
  { name: 'day',   from: 0,    sky: 0x7ec8e3, fog: 0xa5d8ef, ground: 0x2b2f36, sun: 2.0, hemi: 1.0, skyI: 1.0, night: false },
  { name: 'dusk',  from: 500,  sky: 0xe8914a, fog: 0xd58a56, ground: 0x2b2f36, sun: 1.0, hemi: 0.6, skyI: 0.6, night: false },
  { name: 'night', from: 1000, sky: 0x0a1030, fog: 0x0a1030, ground: 0x1a1f2b, sun: 0.35, hemi: 0.3, skyI: 0.3, night: true },
];

export const CRASH = { slowmoTime: 1.5, slowmoScale: 0.2 };

// 小工具（sim 纯逻辑层复用，避免 sim 引 three）
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
