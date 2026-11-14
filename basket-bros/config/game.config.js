// 全局数值配置 —— Basket Bros（1v1 街头篮球）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 620,
  GRAVITY: 2000,        // px/s^2
};

export const STEP = 1 / 60;

export const COURT = {
  // 两个篮筐：左筐由 P2(红) 攻击，右筐由 P1(蓝) 攻击
  left:  { x: 112,  y: 330, boardX: 60,   boardTop: 240, boardBottom: 372 },
  right: { x: 1168, y: 330, boardX: 1220, boardTop: 240, boardBottom: 372 },
  rimHalf: 38,          // 筐口半宽
  rimR: 4,              // 筐沿半径（碰撞用）
};

export const BALL = {
  R: 15,
  REST: 0.62,           // 弹性
  DRAG: 0.06,           // 空气阻力系数
  GRAB_RADIUS: 52,      // 拾取半径
};

export const PLAYER = {
  W: 46,
  H: 78,
  SPEED: 340,
  SPEED_BALL: 290,      // 持球略慢
  JUMP_V: -820,
  ACCEL: 2600,
  STEAL_RANGE: 74,
  STEAL_CD: 0.6,
  STEAL_CHANCE: 0.55,
  CONTEST_RANGE: 120,
};

export const RULES = {
  winScore: 11,
  scoreValue: 2,
  chargeTime: 0.75,     // 蓄力满所需秒
  idealCharge: 0.8,
  shotPickupCd: 0.35,
  scoreResetCd: 0.6,
};

export const COLORS = {
  skyTop: '#1e2a4a',
  skyBottom: '#3a2f5e',
  floor: '#b8763d',
  floorDark: '#8f5a2b',
  line: '#f4e9d8',
  p1: '#38bdf8',
  p1Dark: '#0c4a6e',
  p2: '#fb7185',
  p2Dark: '#881337',
  ball: '#f97316',
  ballDark: '#9a3412',
  rim: '#ef4444',
  board: '#e8edf5',
  net: '#f8fafc',
};

// 语言：默认英文；zh 必做
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'basket-bros-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'basket-bros-save',
};