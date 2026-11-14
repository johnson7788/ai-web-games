// 全局数值配置 —— City Bus（俯视角公交接客）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

// 道路网：3 纵 3 横，宽 84
export const ROAD_W = 84;
export const V_ROADS = [200, 640, 1080];   // 纵向道路中心 x
export const H_ROADS = [150, 360, 570];    // 横向道路中心 y

export const BUS = {
  W: 34, L: 62,                 // 宽 / 长（沿朝向）
  ACCEL: 220,                   // px/s^2
  BRAKE: 340,
  REVERSE_MAX: -90,
  MAX_SPEED: 260,
  OFFROAD_MAX: 90,              //  off-road 限速
  DRAG: 0.9,                    // 自然阻力（每秒比例）
  TURN: 2.4,                    // rad/s（满速时）
  STOP_SPEED: 26,               // 低于此速度才算“停稳”
};

export const STOP_RADIUS = 52;  // 站点上下客区域半径
export const STOPS = [
  { x: 200, y: 255 }, { x: 200, y: 465 },
  { x: 640, y: 255 }, { x: 640, y: 465 },
  { x: 1080, y: 255 }, { x: 1080, y: 465 },
  { x: 420, y: 150 }, { x: 860, y: 570 },
];

export const RULES = {
  shiftTime: 90,          // 一班时长（秒）
  capacity: 4,            // 车上最多乘客组
  fare: 15,               // 每位基础车费
  patience: 30,           // 候车耐心（秒）
  spawnEvery: 3.2,        // 生成乘客间隔
  maxWaiting: 6,          // 全站最多候车人数
  stopDwell: 0.35,        // 停稳多久才上下客
};

export const COLORS = {
  grass: '#3f6d3a',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#d9dee6',
  building: ['#8a6d5c', '#7c8a99', '#997c7c', '#6d8a7c', '#8a7c99'],
  roof: ['#6b5344', '#5f6b78', '#785f5f', '#536b5f', '#6b5f78'],
  park: '#4f8a48',
  stop: '#fbbf24',
  stopZone: 'rgba(251,191,36,0.16)',
  bus: '#f4b400',
  busDark: '#b78600',
  busWindow: '#bfe3f2',
  dest: '#38bdf8',
  passenger: '#f8fafc',
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'city-bus-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'city-bus-save',
};