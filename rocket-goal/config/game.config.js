// 全局数值配置 —— Rocket Goal（俯视角车辆足球，1v1）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const ARENA = { x0: 60, y0: 110, x1: 1220, y1: 660 };
// 球门：左右开口
export const GOAL = { half: 110, depth: 40 };  // 门口半高 / 门深

export const CAR = {
  W: 30, L: 52,
  ACCEL: 420,
  BRAKE: 520,
  MAX_SPEED: 420,
  REVERSE_MAX: -160,
  DRAG: 1.1,
  TURN: 3.0,
  BOOST_ACCEL: 760,
  BOOST_MAX: 640,
  BOOST_DRAIN: 0.9,     // 每秒消耗
  BOOST_REGEN: 0.28,
};

export const BALL = {
  R: 22,
  DRAG: 0.7,
  REST: 0.8,
  KICK: 1.05,           // 车撞球的速度传递系数
  MAX_SPEED: 900,
};

export const RULES = {
  winScore: 5,
  goalPause: 1.6,
  kickoffPause: 1.0,
};

export const COLORS = {
  bg: '#0e1a14',
  field: '#1f6b3a',
  fieldAlt: '#237540',
  line: 'rgba(255,255,255,0.55)',
  wall: '#0b3d22',
  goalBlue: '#38bdf8',
  goalRed: '#fb7185',
  carBlue: '#38bdf8',
  carBlueDark: '#0c4a6e',
  carRed: '#fb7185',
  carRedDark: '#881337',
  ball: '#f8fafc',
  ballDark: '#94a3b8',
  boost: '#fbbf24',
  hud: 'rgba(8,12,26,0.72)',
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'rocket-goal-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'rocket-goal-save',
};