// 全局数值配置：世界、物理、星级阈值、配色、语言
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 拆螺丝玩法参数（逻辑层不写死数字，全部从这里读）
export const GAME = {
  GRAVITY: 1500,          // px/s²
  LINEAR_DAMPING: 1.6,    // 1/s，水平漂移衰减
  ANGULAR_DAMPING: 2.0,   // 1/s，翻滚角速度衰减
  RELEASE_SPIN: 1.8,      // rad/s，掉板时由初始倾斜带出的翻滚
  REMOVE_MARGIN: 60,      // 板中心超出底边多少才判定移除
  SCREW_RADIUS: 18,       // 螺丝头半径
  SCREW_HIT_RADIUS: 24,   // 命中判定半径（触屏更宽松）
  FLY_TIME: 0.5,          // 螺丝旋出 + 飞向 HUD 的动画时长（秒）
  FLY_ROT: Math.PI * 3,   // 旋出总转角 540°
  SHAKE_AMP: 3,           // 掉板震屏幅度（px）
  SHAKE_TIME: 0.28,       // 震屏时长（秒）
  // 构图：按关卡外接盒缩放居中，让主体占屏 55–70% 宽 / 45–65% 高，顶部留 HUD 安全区
  FIT: {
    topSafe: 90,          // 顶部 HUD 安全区高度
    width: 0.7,           // 目标外接盒宽占屏比
    height: 0.65,         // 目标外接盒高占可用区比
    min: 0.6,             // 缩放下限
    max: 1.6,             // 缩放上限
  },
  // 每关 1–3 星 = 用时阈值（秒），随螺丝总数线性放宽
  STARS: {
    base: { three: 6, two: 14 },
    perScrew: { three: 1.4, two: 3.2 },
  },
  COLORS: {
    steel: '#8a97a5',
    gunmetal: '#4a5560',
    copper: '#b87333',
    brass: '#c9a24b',
    iron: '#6b7280',
    olive: '#7a7a52',
    rust: '#a0522d',
    slate: '#5c6b73',
    navy: '#46586a',
  },
  BG: '#16181d',
  BG_GRID: '#23262d',
  VIGNETTE: 0.5,
};

// 语言：默认英文；zh 必做；只暴露 en/zh。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'screw-puzzle-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'screw-puzzle-save',
};
