// 全局数值配置：所有数值/颜色/关卡数据只允许出现在这里，逻辑层不写死数字。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_BASE: 600,
};

export const STEP = 1 / 60;

// 弹道与击球
export const GOLF = {
  TEE_X: 140,            // 开球台 x
  BALL_R: 7,             // 球半径 px
  PX_PER_M: 10,          // 10px = 1 米
  V0_BASE: 380,          // v0 = 380 + power*820 + powerLv*V0_PER_LVL
  V0_POWER_SCALE: 820,
  ANGLE_MIN: -10,        // 度
  ANGLE_MAX: 80,
  BOUNCE_FRICTION: 0.86, // 落地 vx *= friction
  ROLL_ENTER_V: 70,      // 反弹后 |vy| 低于此值转滚动
  STOP_SPEED: 20,        // 滚动速度低于此值判停
  ROLL_DECAY: 0.55,      // 滚动摩擦（每秒速度衰减比例）
  ROLL_SLOPE_ACCEL: 0.6, // 下坡加速度系数
  MAX_FLIGHT_TIME: 30,   // 单杆保险时长
  BURN_SPEED: 1500,      // 起火阈值：拖尾起火，金币 -10%
  BURN_EXIT_FACTOR: 0.85,// 低于 0.85*阈值 解除起火（迟滞）
  BURNOUT_SPEED: 1750,   // 烧毁阈值：金币减半
  BURNOUT_GRACE: 0.12,   // 起飞后 0.12s 内不判烧毁（速度衰减前给高重力星球活路）
  COIN_EXP: 0.9,         // 金币 = floor(dist^0.9) + 空中奖励
  AIR_BONUS_PER_SEC: 6,  // 每秒滞空奖励金币
  MARKER_M: 50,          // 每 50 米一个标尺刻度
  POWER_DRAG_LEN: 280,   // 拖拽满力度像素距离
  POWER_OSC_HZ: 1.1,     // 空格蓄力条往复频率
  SHOTS_PER_PLANET: 3,   // 每打满 3 杆切星球
  AIM_KEY_STEP: 45,      // 方向键调角速度（度/秒）
};

// 升级价格曲线：cost = base * growth^level
export const UPGRADES = {
  power:  { base: 25, growth: 2.0, maxLevel: 10 },
  bounce: { base: 30, growth: 2.0, maxLevel: 10 },
  luck:   { base: 20, growth: 2.0, maxLevel: 10 },
  spin:   { base: 35, growth: 2.0, maxLevel: 10 },
};

export const UPGRADE_EFFECT = {
  V0_PER_LVL: 60,          // Power: +60 px/s
  REST_PER_LVL: 0.045,     // Bounce: +restitution
  REST_MAX: 0.95,
  LUCK_PER_LVL: 0.15,      // Luck: +15% 金币
  ROLL_DECAY_PER_LVL: 0.045, // Spin: 滚动摩擦降低
  ROLL_DECAY_MIN: 0.15,
};

// 六颗星球：重力单位 px/s²（地球 = 980）
export const PLANETS = [
  {
    id: 'moon',
    gravity: 343,  drag: 0.02, restitution: 0.55, wind: 0,
    palette: {
      skyTop: '#0b1026', skyBottom: '#25355f',
      far: '#2c3d6e', mid: '#182444',
      ground: '#8a93a8', groundDark: '#565e70', accent: '#d7e1f5',
      orb: '#e8eefc', orbGlow: 'rgba(215,225,245,0.35)',
    },
  },
  {
    id: 'mars',
    gravity: 490,  drag: 0.05, restitution: 0.5, wind: 40,
    palette: {
      skyTop: '#2b0f0a', skyBottom: '#83381a',
      far: '#a34a1f', mid: '#5f2a10',
      ground: '#c1613a', groundDark: '#7e3d20', accent: '#ffd9a0',
      orb: '#ffe2b8', orbGlow: 'rgba(255,200,130,0.3)',
    },
  },
  {
    id: 'ice',
    gravity: 784,  drag: 0.04, restitution: 0.75, wind: -60,
    palette: {
      skyTop: '#06283a', skyBottom: '#12617a',
      far: '#6cc4da', mid: '#276f85',
      ground: '#d9f4fa', groundDark: '#8fc4d4', accent: '#ffffff',
      orb: '#f2fbff', orbGlow: 'rgba(180,235,255,0.4)',
    },
  },
  {
    id: 'lava',
    gravity: 1764, drag: 0.12, restitution: 0.35, wind: 0,
    palette: {
      skyTop: '#1a0505', skyBottom: '#6b120a',
      far: '#8a1e10', mid: '#3d0d08',
      ground: '#3a2320', groundDark: '#211311', accent: '#ff7a33',
      orb: '#ffb066', orbGlow: 'rgba(255,110,40,0.45)',
    },
  },
  {
    id: 'gas',
    gravity: 245,  drag: 0.35, restitution: 0.45, wind: 120,
    palette: {
      skyTop: '#170b2e', skyBottom: '#4a2485',
      far: '#6b3fb0', mid: '#31195c',
      ground: '#b48ae0', groundDark: '#71509c', accent: '#efe0ff',
      orb: '#e8d5ff', orbGlow: 'rgba(200,160,255,0.4)',
    },
  },
  {
    id: 'ring',
    gravity: 588,  drag: 0.06, restitution: 0.62, wind: -90,
    palette: {
      skyTop: '#0d0d16', skyBottom: '#332e52',
      far: '#b8973f', mid: '#26223a',
      ground: '#d8b45a', groundDark: '#8f7430', accent: '#ffe9a8',
      orb: '#fff3c9', orbGlow: 'rgba(255,225,150,0.4)',
    },
  },
];

// 地形：分段折线缓坡，seg i 的高度由 seed+i 的哈希决定（可复现）
export const TERRAIN = {
  SEG: 700,      // 每段水平长度 px
  AMP: 110,      // 高度波动幅度 px
  FLAT_SEGS: 2,  // 开头两段保持平地（发球台）
};

// 摄像机与特效
export const CAMERA = {
  OFFSET_X: 430,   // 球在屏幕上的目标 x
  LOOKAHEAD: 0.35, // 按 vx 前探
  LERP: 6,         // 每秒平滑系数
  MAX_VEL: 2000,
};

export const FX = {
  HITSTOP_MIN: 30,
  HITSTOP_MAX: 80,
  SHAKE_DECAY: 7,        // 震屏衰减（每秒）
  SHAKE_SCALE: 14,       // 最大震幅 px
  TRAIL_LEN: 26,         // 拖尾点数
  FIRE_RATE: 3,          // 起火时每帧粒子倍率
  PALETTE_FADE: 0.4,     // 星球调色板交叉淡化秒数
};

// 语言：默认英文；zh 必做；只暴露 en/zh
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'gravity-golf-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'gravity-golf-save',
};
