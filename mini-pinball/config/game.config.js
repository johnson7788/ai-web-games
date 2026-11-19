// MINI PINBALL · 全局数值配置（霓虹街机换皮弹球）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

export const BALL = {
  RADIUS: 22,
  LAUNCH_SPEED: 1000,
  GRAVITY: 350,
  MAX_FLIGHT_SEC: 15,   // 单球最长飞行时间，超时强制落底（防无限反弹）
  LAUNCH_X: WORLD.WIDTH / 2,
  LAUNCH_Y: WORLD.HEIGHT - 96,
};

export const ARENA = {
  LEFT: BALL.RADIUS,
  RIGHT: WORLD.WIDTH - BALL.RADIUS,
  TOP: BALL.RADIUS,
  BOTTOM: WORLD.HEIGHT + BALL.RADIUS, // 球完全出底才算落空
};

export const SCORING = {
  BRICK: 100,
  RUBBER: 300,
  BUMPER: 50,
  ORB: 500,
  MAX_COMBO: 5,
  STAR_LAUNCHES_3: 2, // ≤2 发 = 3 星
  STAR_LAUNCHES_2: 4, // ≤4 发 = 2 星
};

export const LAUNCH = {
  MIN_DRAG: 30, // 拖拽距离 < 该值视为点按，不发射
  AIM_DOTS: 9,
};

// 语言：默认英文；zh 必做；未翻译的语言整块删掉（不暴露在下拉里）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'mini-pinball-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'mini-pinball-save',
};
