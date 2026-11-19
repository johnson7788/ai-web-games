// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,            // 顶部 HUD 条高
  MARGIN_X: 28,         // 左右安全边
  MARGIN_Y: 20,
  BOARD_MAX: 600,       // 棋盘边长上限
  BOARD_GAP: 24,        // 棋盘与 HUD 间距
};

// 语言：默认英文；zh 必做；完整翻译后才加入其它语言（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'spin-pingpong-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'spin-pingpong-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  COUNTDOWN: 3,            // 3-2-1 读秒总长（秒）
  PEEK_SECONDS: 1.0,       // 窥视重显时长
  BALL_SEG_SEC: 0.16,      // 球穿过一格耗时（秒）
  STAR_TIME_RATIO: 0.5,    // 剩余时间 ≥50% → 快速星
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 4,
};
