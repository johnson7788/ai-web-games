// 全局数值配置（Lead 拥有；数值改动只改这里）
// 逻辑世界 1280×720；sim 用秒为单位、渲染按 1 逻辑像素 = 1 世界像素换算。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 跳跃/落点判定的核心数值（sim 只读这里的常量，不写死数字）
export const GAME = {
  CHARGE_SPEED: 400,          // 蓄力每秒折算的跳远距离（世界像素）
  MAX_CHARGE: 1.6,            // 蓄力上限（秒）
  MIN_CHARGE: 0.06,           // 轻点也算一跳的下限（秒）
  JUMP_DURATION: 0.5,         // 起跳到落地的飞行时长（秒）
  PERFECT_RATIO: 0.14,        // 中心判定半径 = 平台宽 × 此比例
  NORMAL_RATIO: 0.42,         // 普通落点半径 = 平台宽 × 此比例（之外到边缘 = 失足）
  NARROW_NORMAL_RATIO: 0.30,  // 断头台更窄：普通落点半径更小，边缘判定更宽
  HEADWIND_FACTOR: 0.82,      // 逆风段：实际跳远距离 × 此系数（阻力）
  ICE_SLIDE_RATIO: 0.30,      // 冰面台：落点沿行进方向滑动 = 平台宽 × 此比例（半格感）
  SPRING_DRIFT_RATIO: 0.30,   // 弹簧台：弹射落点的横向漂移 = 平台宽 × 此比例（±）
  MOVE_AMP: 40,               // 移动平台左右缓动幅度（世界像素）
  MOVE_SPEED: 0.7,            // 移动平台缓动角速度（rad/s）
  COMBO_BASE: 1,              // 连击基数：完美连击 1,2,4,8… 的起点
  GOAL_STAR_COMBO: 4,         // 达到此连击 → +1 星
};

// 布局常量：render 由此计算 HUD / 平台区 / 蓄力条的几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,           // 顶部 HUD 条高
  GROUND_Y: 590,       // 平台基准线（逻辑 y）
  CHARGE_BAR_W: 220,   // 蓄力条宽
  CHARGE_BAR_H: 16,    // 蓄力条高
  CHARGE_BAR_Y: 640,   // 蓄力条距顶 y
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 完整翻译后才加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'hop-charge-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'hop-charge-save',
};
