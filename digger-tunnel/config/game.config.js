// 全局数值配置（builder 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 网格与物理：纯逻辑 sim 不依赖像素，render 据此绘制
export const CELL = 20;                 // 网格格宽（px）
export const COLS = WORLD.WIDTH / CELL;  // 64
export const ROWS = WORLD.HEIGHT / CELL;  // 36

export const ORB = {
  R: 24,             // 钻头球半径
  GRAVITY: 1500,     // 重力（px/s²）
  TERMINAL: 1200,    // 终端速度（px/s）
  FRICTION: 0.985,   // 接触地面时的水平摩擦
  REST_EPS: 6,       // 静止判定的速度阈值
};

export const BRUSH_R = 30;   // 钻头笔刷半径（挖出的隧道直径约 60px）
export const GOAL_R = 52;    // 终点门半径
export const GEM_R = 15;     // 宝石半径

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'digger-tunnel-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'digger-tunnel-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 4,             // 挖到岩石的小震屏幅度（px）
  COMBO_WINDOW: 2.0,        // 连击窗口（秒）
  TUTORIAL_KEY: 'digger-tunnel-tutorial-done',
};
