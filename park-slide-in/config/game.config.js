// PARK SLIDE IN · 全局数值配置
// 世界：1280×720 横屏，y 向下。车头朝向 θ：0=+X(右)，正值=顺时针(下)。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  DPR_MAX: 2,
  STEP: 1 / 60,
};

export const STEP = WORLD.STEP;

// 车辆（自行车模型）物理
export const CAR = {
  LENGTH: 120,       // 车长（局部 +X 为车头）
  WIDTH: 56,         // 车宽
  WHEELBASE: 84,     // 前后轴距
  FRONT_AXLE: 40,    // 前轴相对中心偏移（+X）
  REAR_AXLE: -44,    // 后轴相对中心偏移
  ACCEL: 150,        // px/s^2
  FRICTION: 95,      // px/s^2（滑行减速）
  MAX_SPEED: 260,    // px/s
  MAX_STEER: (30 * Math.PI) / 180, // 30°
  STEER_RATE: 2.2,   // rad/s（方向盘角速度）
  PARK_SPEED: 42,    // 低于此速度且完全入位才判成功
  // 局部多边形（凸，中心原点，+X=车头）——车体轮廓
  LOCAL: [
    [60, -22], [60, 22], [28, 27], [-26, 28],
    [-52, 22], [-52, -22], [-26, -28], [28, -27],
  ],
};

// 事件节奏：播放期每 PULSE_S 秒发一次 pulse（引擎心跳/分数脉冲），保证可感知反馈密度
export const PULSE_S = 1.5;

// 语言：默认英文；zh 必做；只暴露 locales 里真实存在的语言
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'park-slide-in-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'park-slide-in-save',
};
