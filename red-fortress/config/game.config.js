// 赤色要塞 · 全局数值配置（唯一真相）
// 逻辑层不得写死数字，一律从这里读。

export const WORLD = {
  W: 1280,
  H: 720,
  TILE: 64,
  COLS: 20,
  STEP: 1 / 60,
};

export const STEP = WORLD.STEP;

// 卷轴与玩家活动范围
export const CAMERA = {
  FOLLOW_Y: 500,      // 玩家屏幕 y 高于此值 → 镜头跟随上推
  MIN_SCREEN_Y: 70,   // 屏幕上边界（玩家不能贴顶）
  MAX_SCREEN_Y: 660,  // 屏幕下边界
  MIN_X: 40,
  MAX_X: 1240,
  SHAKE_MAX: 10,      // 最大震屏像素
  SHAKE_MS: 300,
};

export const PLAYER = {
  R: 22,
  MAX_HP: 6,
  LIVES: 3,
  ACCEL: 1800,        // px/s^2
  FRICTION: 12,       // 1/s
  MAX_SPEED: 210,     // px/s
  TURRET_TURN: 10,    // rad/s
  INVULN: 1.2,        // 受击无敌秒数
  GRENADES: 5,
  MAX_GRENADES: 5,
  POW_CAP: 6,
  PICKUP_R: 34,
  START_X: 640,
  START_OFFSET_Y: 132, // 距关卡底部
  HIT_FLASH: 0.12,
};

export const WEAPON = {
  MG: {
    CD: 1 / 9,
    SPEED: 950,
    DMG: 1,
    LIFE: 0.85,
    SPREAD: 0.02,
    R: 6,
  },
  GRENADE: {
    CD: 1.2,
    FLIGHT: 0.55,
    RADIUS: 96,
    DMG: 4,
    MIN_DMG: 1,
    RANGE: 320,
    R: 10,
  },
};

export const POW = {
  HP: 1,
  R: 10,
  SPEED_MUL: 1.15,
  GAP: 26,
  DELIVER_CD: 0.35,
  SCORE: 150,
  HEAL: 1,
  GRENADE: 1,
  GOAL_RATE: 4,       // 单关交付 4 人：射速提升
  GOAL_AIRSTRIKE: 8,  // 单关交付 8 人：空袭
  DELIVER_R: 96,
};

export const DIFFICULTY = {
  normal: { count: 1, fireRate: 1, hp: 1 },
  hard: { count: 1.25, fireRate: 1.15, hp: 1.2 },
};

export const SAVE_KEY = 'red-fortress-save-v1';

export const LANG_KEY = 'red-fortress-lang';

export const DEBUG = true;
