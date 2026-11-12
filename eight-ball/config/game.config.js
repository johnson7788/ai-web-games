// 全局数值配置：所有坐标按 1280×720 逻辑世界书写，逻辑层不出现裸数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };

export const STEP = 1 / 60;

// HUD 安全区：顶部 0–112 逻辑 px，台面（含木框/袋口）不得进入。
export const LAYOUT = { HUD_SAFE_BOTTOM: 112 };

// 台面内框（库边鼻线）：等比缩放到 HUD 安全区以下、y ≤ 712 的可用区域并水平居中。
// 木框+袋口整块落在 [118, 712]（PLAY 上下各留 RIBBER+WOOD=42），故内框 1020 × 510（2:1）。
export const PLAY = { left: 130, top: 160, right: 1150, bottom: 670 };
export const PLAY_W = PLAY.right - PLAY.left;
export const PLAY_H = PLAY.bottom - PLAY.top;
export const MID_X = (PLAY.left + PLAY.right) / 2;
export const MID_Y = (PLAY.top + PLAY.bottom) / 2;

export const TABLE = {
  RIBBER: 15, // 绒布库边厚度（鼻线以外）
  WOOD: 27, // 木框宽度
  RADIUS: 30, // 木框圆角
  BALL_R: 11,
  POCKET_R: 26,
  // 开球线 / 置球点
  HEAD_X: PLAY.left + PLAY_W / 4,
  FOOT_X: PLAY.right - PLAY_W / 4,
  SPOT_R: 2.6,
  SIGHT: { long: [1, 2, 3], short: [1] }, // 库边钻石头标刻度
};

// 6 个袋口：4 角袋 + 2 中袋。axes 标记该袋吞掉的库边方向。
export const POCKETS = [
  { x: PLAY.left, y: PLAY.top, axes: 'xy' },
  { x: MID_X, y: PLAY.top, axes: 'y' },
  { x: PLAY.right, y: PLAY.top, axes: 'xy' },
  { x: PLAY.left, y: PLAY.bottom, axes: 'xy' },
  { x: MID_X, y: PLAY.bottom, axes: 'y' },
  { x: PLAY.right, y: PLAY.bottom, axes: 'xy' },
];

export const BALL = {
  R: TABLE.BALL_R,
  DIAM: TABLE.BALL_R * 2,
  CUE_ID: 0,
  EIGHT_ID: 8,
  SOLID: [1, 2, 3, 4, 5, 6, 7],
  STRIPE: [9, 10, 11, 12, 13, 14, 15],
  GAP: 0.6, // 球堆相邻球的微间隙，避免初始重叠退让抖动
};

export const PHYSICS = {
  FRICTION: 0.985, // 每帧（60Hz）速度衰减
  CUSHION: 0.82, // 库边反弹衰减
  RESTITUTION: 0.95, // 球球弹性
  STOP_SPEED: 8, // px/s 以下归零
  MIN_SHOT_SPEED: 150,
  MAX_SHOT_SPEED: 2000,
  SUBSTEP_PX: 5.5, // 单个子步最大位移（约为半径一半），防穿透
  MAX_SUBSTEPS: 48,
  MOUTH_PAD: 2, // 袋口喇叭区额外半径
  SETTLE_TIMEOUT: 26, // 单杆最长解算时间（秒）
};

export const RULES = {
  MIN_POWER: 0.05, // 低于此力度视为无效出杆
  BREAK_POWER: 0.92,
  BALLS_PER_GROUP: 7,
  MAX_CUT_DEG: 74, // 有效切球半角
};

// 三档 AI：角度误差（度）/ 力度误差（名称文案在 locales 里）
export const AI = {
  DEFAULT: 'club',
  LEVELS: {
    amateur: { angle: 2.6, power: 0.14 },
    club: { angle: 1.2, power: 0.07 },
    pro: { angle: 0.45, power: 0.03 },
  },
  THINK: 0.9, // 思考时长（秒）后出杆
  SCRATCH_PENALTY: 0.35, // 洗袋风险线路的权重折扣
  SAFETY_POWER: 0.26,
  PLACE_SAMPLES: 9, // 自由球摆位搜索每轴采样数
};

// 球堆 15 个点位（行, 行内序号）；第三行中心固定放 8 号。
export const RACK = {
  ROW_DX: Math.sqrt(3) * (BALL.DIAM + BALL.GAP) / 2,
  COL_DY: BALL.DIAM + BALL.GAP,
  SLOTS: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 0],
    [2, 1],
    [2, 2],
    [3, 0],
    [3, 1],
    [3, 2],
    [3, 3],
    [4, 0],
    [4, 1],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  EIGHT_SLOT: [2, 1],
  CORNER_SLOTS: [[4, 0], [4, 4]],
};

export const AIM = {
  MAX_DRAG: 230, // 拖到该像素距离即满力度
  MIN_DRAG: 10,
  GRAB: 130, // 白球可抓取的半径
  LINE_DASH: [10, 9],
  GHOST_ALPHA: 0.55,
};

export const FX = {
  FREEZE_MS: 40, // 击球顿帧
  SHAKE_PX: 7,
  SHAKE_DECAY: 5.2,
  CUE_STRIKE_S: 0.11, // 前推动画时长
  CUE_BACK_S: 0.16, // 后拉动画时长
  POT_S: 0.34, // 落袋动画时长
  PARTICLES: 14,
  HIT_IMPULSE: 90, // 触发音效/粒子的最小冲量
};

export const AUDIO = { master: 0.55, sfx: 1, music: 0 };

export const COLORS = {
  room0: '#15171f',
  room1: '#05060a',
  lamp: 'rgba(255,238,196,0.13)',
  wood0: '#7a4a24',
  wood1: '#4a2a12',
  wood2: '#2d1a0c',
  woodEdge: 'rgba(255,214,158,0.22)',
  ribber0: '#12523a',
  ribber1: '#0a3325',
  ribberEdge: 'rgba(150,240,190,0.20)',
  felt0: '#1c7a52',
  felt1: '#0e4c33',
  feltShade: 'rgba(0,0,0,0.42)',
  feltLine: 'rgba(255,255,255,0.10)',
  pocket: '#05060a',
  pocketRim: 'rgba(0,0,0,0.55)',
  pocketSheen: 'rgba(210,230,255,0.16)',
  spot: 'rgba(255,255,255,0.42)',
  sight: 'rgba(245,232,205,0.72)',
  aim: 'rgba(255,255,255,0.82)',
  aimSoft: 'rgba(255,255,255,0.30)',
  ghost: 'rgba(255,255,255,0.62)',
  tangent: 'rgba(140,220,255,0.55)',
  cueStick0: '#d8a566',
  cueStick1: '#7d4a22',
  cueButt: '#23262f',
  cueTip: '#4f8fd0',
  shadow: 'rgba(0,0,0,0.38)',
  power0: '#f6d365',
  power1: '#e94560',
  handOk: 'rgba(120,255,190,0.85)',
  handBad: 'rgba(255,110,110,0.9)',
  ballText: '#1b1b1b',
};

// 1–15 号球面颜色（8 号黑）；9–15 与 1–7 同色但带白底花色。
export const BALL_COLORS = {
  1: '#f2c118',
  2: '#1f5fc4',
  3: '#d33a2c',
  4: '#6d3fa3',
  5: '#ef7d12',
  6: '#1a8043',
  7: '#8f2f3c',
  8: '#14161a',
  9: '#f2c118',
  10: '#1f5fc4',
  11: '#d33a2c',
  12: '#6d3fa3',
  13: '#ef7d12',
  14: '#1a8043',
  15: '#8f2f3c',
};

// 语言：默认英文；en + zh 双语（COMMON §3）。rtlLangs 保留空数组。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'eight-ball-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'eight-ball-save',
};
